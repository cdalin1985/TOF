import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OBLIGATION_DAYS = 30;
const REQUIRED_TOP5_MATCHES = 2;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Must be called by an admin.
    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return json({ error: 'Admin access required.' }, 403);
    }

    const { enforce } = await req.json().catch(() => ({ enforce: false }));

    const { data: rank1 } = await supabase
      .from('rankings')
      .select('player_id, rank1_since, players(full_name)')
      .eq('position', 1)
      .single();

    if (!rank1) return json({ error: 'No #1 player found.' });

    const playerName = rank1.players?.full_name ?? 'Rank #1 player';

    if (!rank1.rank1_since) {
      if (enforce) {
        const { error } = await supabase
          .from('rankings')
          .update({ rank1_since: new Date().toISOString() })
          .eq('player_id', rank1.player_id);
        if (error) return json({ error: error.message }, 500);
      }

      return json({
        penalized: false,
        player: playerName,
        top5_matches: 0,
        required_top5_matches: REQUIRED_TOP5_MATCHES,
        days_elapsed: 0,
        days_remaining: OBLIGATION_DAYS,
        compliant: true,
        message: enforce
          ? 'rank1_since was missing, so it was initialized instead of penalizing the #1 player.'
          : 'rank1_since is missing. Use Enforce Now to initialize it safely, or wait for the scheduled automation.',
      });
    }

    const rank1Since = new Date(rank1.rank1_since);
    const now = new Date();
    const daysElapsed = Math.floor((now.getTime() - rank1Since.getTime()) / (1000 * 3600 * 24));
    const daysRemaining = Math.max(0, OBLIGATION_DAYS - daysElapsed);

    const { data: top5 } = await supabase
      .from('rankings')
      .select('player_id')
      .gte('position', 2)
      .lte('position', 5);
    const top5Ids = (top5 ?? []).map((r: { player_id: string }) => r.player_id);

    let matchCount = 0;
    if (top5Ids.length > 0) {
      const { count, error } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('completed_at', rank1.rank1_since)
        .or(
          `and(player1_id.eq.${rank1.player_id},player2_id.in.(${top5Ids.join(',')})),` +
          `and(player2_id.eq.${rank1.player_id},player1_id.in.(${top5Ids.join(',')}))`
        );
      if (error) return json({ error: error.message }, 500);
      matchCount = count ?? 0;
    }

    const compliant = matchCount >= REQUIRED_TOP5_MATCHES;
    const overdue = daysElapsed >= OBLIGATION_DAYS;

    if (enforce && !compliant) {
      const { data: targetRank, error } = await supabase.rpc('apply_rank1_penalty', { p_player_id: rank1.player_id });
      if (error) return json({ error: error.message }, 500);

      return json({
        penalized: Boolean(targetRank),
        player: playerName,
        top5_matches: matchCount,
        required_top5_matches: REQUIRED_TOP5_MATCHES,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        target_rank: targetRank,
        compliant: false,
        message: targetRank
          ? `${playerName} was moved from #1 to #${targetRank} for missing the #1 top-5 obligation.`
          : 'No penalty was applied. The player may no longer be ranked #1 or there may not be enough ranked players.',
      });
    }

    return json({
      penalized: false,
      player: playerName,
      top5_matches: matchCount,
      required_top5_matches: REQUIRED_TOP5_MATCHES,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      target_rank: 10,
      compliant,
      message: compliant
        ? 'The #1 player has met the top-5 match obligation.'
        : overdue
          ? 'The #1 player is overdue and below the top-5 match requirement. Cron or Enforce Now can apply the penalty.'
          : 'The #1 player is still inside the 30-day obligation window.',
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
