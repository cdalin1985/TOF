import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// deno-lint-ignore-file no-explicit-any
async function sendPush(supabase: any, playerId: string, title: string, body: string, url: string): Promise<void> {
  try {
    const { data: row } = await supabase.from('push_subscriptions').select('subscription').eq('player_id', playerId).single();
    if (!row?.subscription) return;
    webpush.setVapidDetails(`mailto:${Deno.env.get('VAPID_SUBJECT')}`, Deno.env.get('VAPID_PUBLIC_KEY') ?? '', Deno.env.get('VAPID_PRIVATE_KEY') ?? '');
    await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }));
  } catch {
    // Push delivery should never break match submission.
  }
}

async function createPostLossCooldown(supabase: ReturnType<typeof createClient>, loserId: string): Promise<void> {
  const { data: settings } = await supabase.from('league_settings').select('cooldown_hours').single();
  const cooldownHours = settings?.cooldown_hours ?? 24;
  if (cooldownHours <= 0) return;
  const expiresAt = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
  await supabase.from('cooldowns').insert({ player_id: loserId, type: 'post_match', expires_at: expiresAt });
}

async function checkRank1Compliance(supabase: ReturnType<typeof createClient>) {
  const { data: rank1 } = await supabase.from('rankings').select('player_id, rank1_since').eq('position', 1).single();
  if (!rank1 || !rank1.rank1_since) return;

  const rank1Since = new Date(rank1.rank1_since);
  const now = new Date();
  const daysSince = (now.getTime() - rank1Since.getTime()) / (1000 * 3600 * 24);

  const { data: top5 } = await supabase.from('rankings').select('player_id').gte('position', 2).lte('position', 5);
  const top5Ids = (top5 ?? []).map((r: { player_id: string }) => r.player_id);
  if (top5Ids.length === 0) return;

  const { count: top5Matches } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .gte('completed_at', rank1.rank1_since)
    .or(`and(player1_id.eq.${rank1.player_id},player2_id.in.(${top5Ids.join(',')})),and(player2_id.eq.${rank1.player_id},player1_id.in.(${top5Ids.join(',')}))`);

  const matchCount = top5Matches ?? 0;

  if (matchCount < 2 && daysSince >= 30) {
    const { data: rank1Player } = await supabase.from('players').select('id, full_name').eq('id', rank1.player_id).single();
    await supabase.rpc('apply_rank1_penalty', { p_player_id: rank1.player_id });
    if (rank1Player) {
      await supabase.from('notifications').insert({ player_id: rank1Player.id, type: 'rank1_penalty', title: '📉 Rank 1 obligation not met', body: 'You did not play a top-5 opponent twice in your 30-day window. You have been moved to #10.', reference_type: 'ranking' });
    }
    await supabase.from('activity_feed').insert({ event_type: 'rank1_penalty', headline: `${rank1Player?.full_name} was moved to #10 for failing the #1 top-5 obligation.`, actor_player_id: rank1.player_id });
  } else if (matchCount >= 2) {
    await supabase.from('rankings').update({ rank1_since: new Date().toISOString() }).eq('player_id', rank1.player_id);
  }
}

async function confirmResult(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
  winnerId: string,
  loserId: string,
  p1Score: number,
  p2Score: number,
  match: { discipline: string; race_length: number; player1_id: string; player2_id: string; challenge_id: string },
) {
  await supabase.from('matches').update({ status: 'confirmed', winner_id: winnerId, loser_id: loserId, player1_score: p1Score, player2_score: p2Score, completed_at: new Date().toISOString() }).eq('id', matchId);
  await supabase.from('challenges').update({ status: 'confirmed' }).eq('id', match.challenge_id);

  const [winnerRank, loserRank] = await Promise.all([
    supabase.from('rankings').select('position, rank1_since').eq('player_id', winnerId).single(),
    supabase.from('rankings').select('position').eq('player_id', loserId).single(),
  ]);

  if (winnerRank.data && loserRank.data) {
    const wPos = winnerRank.data.position;
    const lPos = loserRank.data.position;
    if (wPos > lPos) {
      await supabase.rpc('cascade_ranking_after_win', { p_winner_id: winnerId, p_loser_id: loserId });
      if (lPos === 1 && !winnerRank.data.rank1_since) await supabase.from('rankings').update({ rank1_since: new Date().toISOString() }).eq('player_id', winnerId);
    }
  }

  const [winnerStats, loserStats] = await Promise.all([
    supabase.from('player_season_stats').select('*').eq('player_id', winnerId).single(),
    supabase.from('player_season_stats').select('*').eq('player_id', loserId).single(),
  ]);
  const winnerIsChallenger = match.player1_id === winnerId;

  if (winnerStats.data) {
    const s = winnerStats.data;
    const newStreak = s.current_streak >= 0 ? s.current_streak + 1 : 1;
    const currentRank = winnerRank.data?.position ?? null;
    const bestRank = currentRank !== null ? (s.best_rank_achieved === null || currentRank < s.best_rank_achieved ? currentRank : s.best_rank_achieved) : s.best_rank_achieved;
    await supabase.from('player_season_stats').update({ wins: s.wins + 1, matches_played: s.matches_played + 1, current_streak: newStreak, best_streak: Math.max(s.best_streak, newStreak), challenger_wins: winnerIsChallenger ? s.challenger_wins + 1 : s.challenger_wins, defender_wins: !winnerIsChallenger ? s.defender_wins + 1 : s.defender_wins, best_rank_achieved: bestRank }).eq('player_id', winnerId);
  }

  if (loserStats.data) {
    const s = loserStats.data;
    await supabase.from('player_season_stats').update({ losses: s.losses + 1, matches_played: s.matches_played + 1, current_streak: 0 }).eq('player_id', loserId);
  }

  await createPostLossCooldown(supabase, loserId);

  const disc = match.discipline;
  await Promise.all([winnerId, loserId].map((pid) => supabase.from('player_discipline_stats').upsert({ player_id: pid, discipline: disc }, { onConflict: 'player_id,discipline', ignoreDuplicates: true })));

  for (const [pid, isWinner, isChallenger] of [[winnerId, true, winnerIsChallenger], [loserId, false, !winnerIsChallenger]] as [string, boolean, boolean][]) {
    const { data: ds } = await supabase.from('player_discipline_stats').select('*').eq('player_id', pid).eq('discipline', disc).single();
    if (ds) {
      const newStreak = isWinner ? (ds.current_streak >= 0 ? ds.current_streak + 1 : 1) : 0;
      await supabase.from('player_discipline_stats').update({ matches_played: ds.matches_played + 1, wins: isWinner ? ds.wins + 1 : ds.wins, losses: isWinner ? ds.losses : ds.losses + 1, current_streak: newStreak, best_streak: isWinner ? Math.max(ds.best_streak, newStreak) : ds.best_streak, challenger_wins: isWinner && isChallenger ? ds.challenger_wins + 1 : ds.challenger_wins, defender_wins: isWinner && !isChallenger ? ds.defender_wins + 1 : ds.defender_wins, total_race_length: ds.total_race_length + match.race_length, updated_at: new Date().toISOString() }).eq('player_id', pid).eq('discipline', disc);
    }
  }

  const [wp, lp] = await Promise.all([
    supabase.from('players').select('full_name').eq('id', winnerId).single(),
    supabase.from('players').select('full_name').eq('id', loserId).single(),
  ]);

  await supabase.from('notifications').insert([
    { player_id: winnerId, type: 'result_confirmed', title: '🏆 Match confirmed — Victory!', body: `Final: ${p1Score}–${p2Score}`, reference_id: matchId, reference_type: 'match' },
    { player_id: loserId, type: 'result_confirmed', title: '📊 Match confirmed', body: `Final: ${p1Score}–${p2Score}`, reference_id: matchId, reference_type: 'match' },
  ]);
  await Promise.all([
    sendPush(supabase, winnerId, '🏆 Match confirmed — Victory!', `Final: ${p1Score}–${p2Score}`, `/match/${matchId}`),
    sendPush(supabase, loserId, '📊 Match confirmed', `Final: ${p1Score}–${p2Score}`, `/match/${matchId}`),
  ]);
  await supabase.from('activity_feed').insert({ event_type: 'match_confirmed', headline: `${wp.data?.full_name} def. ${lp.data?.full_name} · ${p1Score}–${p2Score}`, actor_player_id: winnerId });
  await checkRank1Compliance(supabase);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const { match_id, winner_id, final_score_player1, final_score_player2, payment_method } = await req.json();
    if (payment_method && !['envelope', 'digital'].includes(payment_method)) return new Response(JSON.stringify({ error: 'Invalid payment method.' }), { headers: cors });
    if (!Number.isInteger(final_score_player1) || !Number.isInteger(final_score_player2) || final_score_player1 < 0 || final_score_player2 < 0) return new Response(JSON.stringify({ error: 'Scores must be non-negative whole numbers.' }), { headers: cors });

    const { data: match } = await supabase.from('matches').select('*').eq('id', match_id).single();
    if (!match) return new Response(JSON.stringify({ error: 'Match not found.' }), { headers: cors });
    if (!['in_progress', 'scheduled', 'submitted'].includes(match.status)) return new Response(JSON.stringify({ error: 'Match is not in progress.' }), { headers: cors });
    if (![match.player1_id, match.player2_id].includes(winner_id)) return new Response(JSON.stringify({ error: 'Winner must be one of the match players.' }), { headers: cors });

    const raceTarget = match.race_length;
    const winnerScore = winner_id === match.player1_id ? final_score_player1 : final_score_player2;
    if (winnerScore < raceTarget) return new Response(JSON.stringify({ error: `Winner must reach race length ${raceTarget}.` }), { headers: cors });

    const { data: caller } = await supabase.from('players').select('id').eq('profile_id', user.id).single();
    if (!caller) return new Response(JSON.stringify({ error: 'Player not found.' }), { headers: cors });
    const isP1 = match.player1_id === caller.id;
    const isP2 = match.player2_id === caller.id;
    if (!isP1 && !isP2) return new Response(JSON.stringify({ error: 'Not a participant.' }), { headers: cors });

    const submissionUpdates: Record<string, unknown> = { player1_score: final_score_player1, player2_score: final_score_player2, status: 'submitted' };
    if (isP1) {
      submissionUpdates.player1_submitted = true;
      if (payment_method) submissionUpdates.player1_payment_method = payment_method;
    } else {
      submissionUpdates.player2_submitted = true;
      if (payment_method) submissionUpdates.player2_payment_method = payment_method;
    }

    await supabase.from('matches').update(submissionUpdates).eq('id', match_id);
    const { data: updated } = await supabase.from('matches').select('*').eq('id', match_id).single();
    if (!updated) return new Response(JSON.stringify({ error: 'Update failed.' }), { headers: cors });

    if (updated.player1_submitted && updated.player2_submitted) {
      const { data: claimed } = await supabase.from('matches').update({ status: 'confirming' } as Record<string, unknown>).eq('id', match_id).eq('status', 'submitted').select('id');
      if (!claimed?.length) return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;
      await confirmResult(supabase, match_id, winner_id, loser_id, final_score_player1, final_score_player2, match);
    } else {
      const otherId = isP1 ? match.player2_id : match.player1_id;
      const { data: callerPlayer } = await supabase.from('players').select('full_name').eq('id', caller.id).single();
      await supabase.from('notifications').insert({ player_id: otherId, type: 'result_submitted', title: '📊 Opponent submitted result', body: `${callerPlayer?.full_name} submitted the match result. Please submit yours to confirm.`, reference_id: match_id, reference_type: 'match' });
      await sendPush(supabase, otherId, '📊 Opponent submitted result', `${callerPlayer?.full_name} submitted. Tap to confirm.`, `/match/${match_id}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
