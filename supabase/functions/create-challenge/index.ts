/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// deno-lint-ignore-file no-explicit-any
async function sendPush(supabase: any, playerId: string, title: string, body: string, url: string): Promise<void> {
  try {
    const { data: row } = await supabase.from('push_subscriptions').select('subscription').eq('player_id', playerId).single();
    if (!row?.subscription) return;
    webpush.setVapidDetails(`mailto:${Deno.env.get('VAPID_SUBJECT')}`, Deno.env.get('VAPID_PUBLIC_KEY') ?? '', Deno.env.get('VAPID_PRIVATE_KEY') ?? '');
    await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }));
  } catch {
    // Push delivery should never break challenge creation.
  }
}

function canChallenge(
  myPos: number,
  theirPos: number,
  isFirstChallenge: boolean,
  challengeRange: number,
  firstChallengeRange: number,
): string | null {
  if (myPos === theirPos) return 'You cannot challenge yourself.';
  if (myPos === 1) return null;

  if (myPos <= 10) {
    if (Math.abs(myPos - theirPos) > challengeRange) {
      return `Top-10 players can only challenge within ${challengeRange} spots up or down.`;
    }
    return null;
  }

  if (isFirstChallenge) {
    if (theirPos >= myPos) return 'Your first challenge must be against someone ranked above you.';
    if ((myPos - theirPos) > firstChallengeRange) {
      return `Your first challenge can only be up to ${firstChallengeRange} spots above you.`;
    }
    return null;
  }

  if (theirPos >= myPos) return 'You can only challenge players ranked above you.';
  if ((myPos - theirPos) > challengeRange) {
    return `You can only challenge players up to ${challengeRange} spots above you.`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { challenged_player_id, discipline, race_length } = await req.json();

    const { data: settings } = await supabase
      .from('league_settings')
      .select('min_race, max_race, challenge_range, first_challenge_range, challenge_expiry_days, challenge_weekly_limit')
      .single();

    const minRace = settings?.min_race ?? 6;
    const maxRace = settings?.max_race;
    const challengeRange = settings?.challenge_range ?? 5;
    const firstChallengeRange = settings?.first_challenge_range ?? 10;
    const challengeExpiryDays = settings?.challenge_expiry_days ?? 7;
    const weeklyLimit = settings?.challenge_weekly_limit ?? 2;

    const validDisciplines = ['8 Ball', '9 Ball', '10 Ball'];
    if (!validDisciplines.includes(discipline)) return new Response(JSON.stringify({ error: 'Invalid discipline.' }), { headers: corsHeaders });
    if (!Number.isInteger(race_length) || race_length < minRace) return new Response(JSON.stringify({ error: `Race length must be at least ${minRace}.` }), { headers: corsHeaders });
    if (Number.isInteger(maxRace) && race_length > maxRace) return new Response(JSON.stringify({ error: `Race length cannot exceed ${maxRace}.` }), { headers: corsHeaders });

    const { data: challenger } = await supabase.from('players').select('id, is_active').eq('profile_id', user.id).single();
    if (!challenger) return new Response(JSON.stringify({ error: 'You must claim a player profile first.' }), { headers: corsHeaders });
    if (!challenger.is_active) return new Response(JSON.stringify({ error: 'Your account is inactive.' }), { headers: corsHeaders });
    if (challenger.id === challenged_player_id) return new Response(JSON.stringify({ error: 'You cannot challenge yourself.' }), { headers: corsHeaders });

    const { data: challenged } = await supabase.from('players').select('id, is_active').eq('id', challenged_player_id).single();
    if (!challenged) return new Response(JSON.stringify({ error: 'That player does not exist.' }), { headers: corsHeaders });
    if (!challenged.is_active) return new Response(JSON.stringify({ error: 'That player is currently inactive and cannot be challenged.' }), { headers: corsHeaders });

    const [challengerRankRes, challengedRankRes] = await Promise.all([
      supabase.from('rankings').select('position').eq('player_id', challenger.id).single(),
      supabase.from('rankings').select('position').eq('player_id', challenged_player_id).single(),
    ]);
    if (!challengerRankRes.data || !challengedRankRes.data) return new Response(JSON.stringify({ error: 'Could not retrieve rankings.' }), { headers: corsHeaders });

    const myPos = challengerRankRes.data.position;
    const theirPos = challengedRankRes.data.position;

    await supabase.rpc('expire_stale_challenges');

    const { count: priorChallenges } = await supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('challenger_id', challenger.id);
    const isFirstChallenge = (priorChallenges ?? 0) === 0;

    const eligibilityError = canChallenge(myPos, theirPos, isFirstChallenge, challengeRange, firstChallengeRange);
    if (eligibilityError) return new Response(JSON.stringify({ error: eligibilityError }), { headers: corsHeaders });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: weeklyCount } = await supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('challenger_id', challenger.id).gte('created_at', sevenDaysAgo);
    if ((weeklyCount ?? 0) >= weeklyLimit) return new Response(JSON.stringify({ error: `You have reached the weekly challenge limit (${weeklyLimit} per 7 days).` }), { headers: corsHeaders });

    const { data: existingOut } = await supabase.from('challenges').select('id').eq('challenger_id', challenger.id).in('status', ['pending', 'accepted', 'scheduled', 'in_progress']).maybeSingle();
    if (existingOut) return new Response(JSON.stringify({ error: 'You already have an active outgoing challenge.' }), { headers: corsHeaders });

    const { data: existingIn } = await supabase.from('challenges').select('id').eq('challenged_id', challenged_player_id).in('status', ['pending', 'accepted', 'scheduled', 'in_progress']).maybeSingle();
    if (existingIn) return new Response(JSON.stringify({ error: 'That player already has an active challenge they must resolve first.' }), { headers: corsHeaders });

    const now = new Date().toISOString();
    const { data: myCooldown } = await supabase.from('cooldowns').select('expires_at').eq('player_id', challenger.id).eq('type', 'post_match').gt('expires_at', now).maybeSingle();
    if (myCooldown) return new Response(JSON.stringify({ error: `You are in a post-match cooldown period until ${new Date(myCooldown.expires_at).toLocaleString()}.` }), { headers: corsHeaders });

    const expiresAt = new Date(Date.now() + challengeExpiryDays * 24 * 3600 * 1000).toISOString();
    const { data: challenge, error: insertErr } = await supabase.from('challenges').insert({ challenger_id: challenger.id, challenged_id: challenged_player_id, discipline, race_length, status: 'pending', expires_at: expiresAt }).select().single();
    if (insertErr) throw insertErr;

    const { data: challengerStats } = await supabase.from('player_season_stats').select('challenges_issued').eq('player_id', challenger.id).single();
    if (challengerStats) await supabase.from('player_season_stats').update({ challenges_issued: challengerStats.challenges_issued + 1 }).eq('player_id', challenger.id);

    const { data: challengedStats } = await supabase.from('player_season_stats').select('challenges_received').eq('player_id', challenged_player_id).single();
    if (challengedStats) await supabase.from('player_season_stats').update({ challenges_received: challengedStats.challenges_received + 1 }).eq('player_id', challenged_player_id);

    await Promise.all([
      supabase.from('player_discipline_stats').upsert({ player_id: challenger.id, discipline }, { onConflict: 'player_id,discipline', ignoreDuplicates: true }),
      supabase.from('player_discipline_stats').upsert({ player_id: challenged_player_id, discipline }, { onConflict: 'player_id,discipline', ignoreDuplicates: true }),
    ]);

    const [dStatsC, dStatsD] = await Promise.all([
      supabase.from('player_discipline_stats').select('challenges_issued').eq('player_id', challenger.id).eq('discipline', discipline).single(),
      supabase.from('player_discipline_stats').select('challenges_received').eq('player_id', challenged_player_id).eq('discipline', discipline).single(),
    ]);
    if (dStatsC.data) await supabase.from('player_discipline_stats').update({ challenges_issued: dStatsC.data.challenges_issued + 1 }).eq('player_id', challenger.id).eq('discipline', discipline);
    if (dStatsD.data) await supabase.from('player_discipline_stats').update({ challenges_received: dStatsD.data.challenges_received + 1 }).eq('player_id', challenged_player_id).eq('discipline', discipline);

    const { data: challengerPlayer } = await supabase.from('players').select('full_name').eq('id', challenger.id).single();
    await supabase.from('notifications').insert({
      player_id: challenged_player_id,
      type: 'challenge_received',
      title: `${challengerPlayer?.full_name} challenged you!`,
      body: `${discipline} - Race to ${race_length}. You have ${challengeExpiryDays} days to respond.`,
      reference_id: challenge.id,
      reference_type: 'challenge',
    });
    await sendPush(supabase, challenged_player_id, `${challengerPlayer?.full_name} challenged you!`, `${discipline} - Race to ${race_length}. Tap to respond.`, '/challenges');

    const { data: challengedPlayer } = await supabase.from('players').select('full_name').eq('id', challenged_player_id).single();
    await supabase.from('activity_feed').insert({
      event_type: 'challenge_issued',
      headline: `${challengerPlayer?.full_name} challenged ${challengedPlayer?.full_name} to ${discipline}!`,
      detail: `Race to ${race_length} · #${myPos} → #${theirPos} · responds within ${challengeExpiryDays} days`,
      actor_player_id: challenger.id,
    });

    return new Response(JSON.stringify({ challenge_id: challenge.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});

