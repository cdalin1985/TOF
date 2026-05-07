import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush } from '../_shared/sendPush.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { challenged_player_id, discipline, race_length } = await req.json();

    // Validate inputs
    const validDisciplines = ['8 Ball', '9 Ball', '10 Ball'];
    if (!validDisciplines.includes(discipline)) {
      return new Response(JSON.stringify({ error: 'Invalid discipline.' }), { headers: corsHeaders });
    }
    if (!Number.isInteger(race_length) || race_length < 6) {
      return new Response(JSON.stringify({ error: 'Race length must be at least 6.' }), { headers: corsHeaders });
    }

    // Get challenger player
    const { data: challenger } = await supabase.from('players').select('id, is_active').eq('profile_id', user.id).single();
    if (!challenger) return new Response(JSON.stringify({ error: 'You must claim a player profile first.' }), { headers: corsHeaders });
    if (!challenger.is_active) return new Response(JSON.stringify({ error: 'Your account is inactive.' }), { headers: corsHeaders });
    if (challenger.id === challenged_player_id) return new Response(JSON.stringify({ error: 'You cannot challenge yourself.' }), { headers: corsHeaders });

    // Get challenged player
    const { data: challenged } = await supabase.from('players').select('id, is_active').eq('id', challenged_player_id).single();
    if (!challenged || !challenged.is_active) return new Response(JSON.stringify({ error: 'That player is not active.' }), { headers: corsHeaders });

    // Get rankings
    const [challengerRankRes, challengedRankRes] = await Promise.all([
      supabase.from('rankings').select('position').eq('player_id', challenger.id).single(),
      supabase.from('rankings').select('position').eq('player_id', challenged_player_id).single(),
    ]);
    if (!challengerRankRes.data || !challengedRankRes.data) {
      return new Response(JSON.stringify({ error: 'Could not retrieve rankings.' }), { headers: corsHeaders });
    }
    const myPos   = challengerRankRes.data.position;
    const theirPos = challengedRankRes.data.position;

    // Auto-expire stale pending challenges system-wide before our checks below.
    // This is the lazy-cleanup pattern: every create-challenge call sweeps any
    // 'pending' rows whose expires_at has passed (the 7-day window) and flips
    // them to 'expired'. Idempotent and cheap (indexable on status+expires_at).
    // Without this, stale pending rows wedge both challenger and challenged.
    await supabase.rpc('expire_stale_challenges');

    // Check if this is the challenger's first ever challenge (any status counts)
    const { count: priorChallenges } = await supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .eq('challenger_id', challenger.id);
    const isFirstChallenge = (priorChallenges ?? 0) === 0;

    // Validate challenge range
    if (myPos === 1) {
      // #1 can challenge anyone — no range restriction
    } else if (myPos <= 10) {
      // Top 10: can challenge ±5 in either direction
      if (Math.abs(myPos - theirPos) > 5) {
        return new Response(JSON.stringify({ error: 'Top 10 players can challenge anyone within 5 spots up or down.' }), { headers: corsHeaders });
      }
    } else if (isFirstChallenge) {
      // First challenge ever: up to 10 spots above (lower rank number)
      if (theirPos >= myPos || (myPos - theirPos) > 10) {
        return new Response(JSON.stringify({ error: 'Your first challenge must be directed at someone up to 10 spots above you.' }), { headers: corsHeaders });
      }
    } else {
      // Standard: up to 5 spots above only
      if (theirPos >= myPos || (myPos - theirPos) > 5) {
        return new Response(JSON.stringify({ error: 'You can only challenge players up to 5 spots above you.' }), { headers: corsHeaders });
      }
    }

    // Check no pending outgoing challenge.
    // Using maybeSingle() because zero-row is a valid normal case and
    // .single() throws on zero rows (would manifest as a 500 to the client).
    const { data: existingOut } = await supabase
      .from('challenges')
      .select('id')
      .eq('challenger_id', challenger.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingOut) return new Response(JSON.stringify({ error: 'You already have a pending outgoing challenge.' }), { headers: corsHeaders });

    // Check challenged player doesn't already have a pending challenge (must play first challenger first)
    const { data: existingIn } = await supabase
      .from('challenges')
      .select('id')
      .eq('challenged_id', challenged_player_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingIn) return new Response(JSON.stringify({ error: 'That player already has a pending challenge they must respond to first.' }), { headers: corsHeaders });

    // Create challenge — 7 day response window
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { data: challenge, error: insertErr } = await supabase.from('challenges').insert({
      challenger_id: challenger.id,
      challenged_id: challenged_player_id,
      discipline,
      race_length,
      status: 'pending',
      expires_at: expiresAt,
    }).select().single();
    if (insertErr) throw insertErr;

    // Update challenge stats
    const { data: challengerStats } = await supabase.from('player_season_stats').select('challenges_issued').eq('player_id', challenger.id).single();
    if (challengerStats) {
      await supabase.from('player_season_stats')
        .update({ challenges_issued: challengerStats.challenges_issued + 1 })
        .eq('player_id', challenger.id);
    }
    const { data: challengedStats } = await supabase.from('player_season_stats').select('challenges_received').eq('player_id', challenged_player_id).single();
    if (challengedStats) {
      await supabase.from('player_season_stats')
        .update({ challenges_received: challengedStats.challenges_received + 1 })
        .eq('player_id', challenged_player_id);
    }
    // Discipline stats — seed rows for both players before incrementing
    await Promise.all([
      supabase.from('player_discipline_stats')
        .upsert({ player_id: challenger.id, discipline }, { onConflict: 'player_id,discipline', ignoreDuplicates: true }),
      supabase.from('player_discipline_stats')
        .upsert({ player_id: challenged_player_id, discipline }, { onConflict: 'player_id,discipline', ignoreDuplicates: true }),
    ]);
    const [dStatsC, dStatsD] = await Promise.all([
      supabase.from('player_discipline_stats').select('challenges_issued').eq('player_id', challenger.id).eq('discipline', discipline).single(),
      supabase.from('player_discipline_stats').select('challenges_received').eq('player_id', challenged_player_id).eq('discipline', discipline).single(),
    ]);
    if (dStatsC.data) {
      await supabase.from('player_discipline_stats')
        .update({ challenges_issued: dStatsC.data.challenges_issued + 1 })
        .eq('player_id', challenger.id).eq('discipline', discipline);
    }
    if (dStatsD.data) {
      await supabase.from('player_discipline_stats')
        .update({ challenges_received: dStatsD.data.challenges_received + 1 })
        .eq('player_id', challenged_player_id).eq('discipline', discipline);
    }

    // Notify challenged player
    const { data: challengerPlayer } = await supabase.from('players').select('full_name').eq('id', challenger.id).single();
    await supabase.from('notifications').insert({
      player_id: challenged_player_id,
      type: 'challenge_received',
      title: `⚔️ ${challengerPlayer?.full_name} challenged you!`,
      body: `${discipline} · Race to ${race_length}. You have 7 days to respond.`,
      reference_id: challenge.id,
      reference_type: 'challenge',
    });
    await sendPush(supabase, challenged_player_id, `⚔️ ${challengerPlayer?.full_name} challenged you!`, `${discipline} · Race to ${race_length}. Tap to respond.`, '/challenges');

    // Activity feed
    const { data: challengedPlayer } = await supabase.from('players').select('full_name').eq('id', challenged_player_id).single();
    await supabase.from('activity_feed').insert({
      event_type: 'challenge_issued',
      headline: `${challengerPlayer?.full_name} challenged ${challengedPlayer?.full_name} to ${discipline}!`,
      actor_player_id: challenger.id,
    });

    return new Response(JSON.stringify({ challenge_id: challenge.id }), {
      headers: { ...corsHeaders: 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
