/* eslint-disable @typescript-eslint/no-explicit-any */
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

type PaymentMethod = 'cash_envelope' | 'paypal' | 'cash_app' | 'venmo';

const PAYMENT_METHODS: PaymentMethod[] = ['cash_envelope', 'paypal', 'cash_app', 'venmo'];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_envelope: 'Cash envelope',
  paypal: 'PayPal',
  cash_app: 'Cash App',
  venmo: 'Venmo',
};

const MATCH_FEE_CENTS = 500;

type SubmittedResult = {
  winnerId: string | null;
  player1Score: number | null;
  player2Score: number | null;
};

type CompleteSubmittedResult = {
  winnerId: string;
  player1Score: number;
  player2Score: number;
};

type MatchFeePayer = {
  player_id: string;
  player_name: string;
  payment_method: PaymentMethod;
};

function normalizePayment(value: unknown): PaymentMethod | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
}

function getPlayerSubmission(match: Record<string, unknown>, playerNumber: 1 | 2): SubmittedResult {
  return {
    winnerId: match[`player${playerNumber}_submitted_winner_id`] as string | null,
    player1Score: match[`player${playerNumber}_submitted_player1_score`] as number | null,
    player2Score: match[`player${playerNumber}_submitted_player2_score`] as number | null,
  };
}

function isCompleteSubmission(submission: SubmittedResult): submission is CompleteSubmittedResult {
  return Boolean(submission.winnerId)
    && Number.isInteger(submission.player1Score)
    && Number.isInteger(submission.player2Score);
}

function submissionsMatch(player1Submission: SubmittedResult, player2Submission: SubmittedResult): boolean {
  return player1Submission.winnerId === player2Submission.winnerId
    && player1Submission.player1Score === player2Submission.player1Score
    && player1Submission.player2Score === player2Submission.player2Score;
}

function validateFinalScore(
  winnerId: string,
  player1Id: string,
  player2Id: string,
  finalScorePlayer1: number,
  finalScorePlayer2: number,
  raceTarget: number,
): string | null {
  if (!Number.isInteger(finalScorePlayer1) || !Number.isInteger(finalScorePlayer2) || finalScorePlayer1 < 0 || finalScorePlayer2 < 0) {
    return 'Scores must be non-negative whole numbers.';
  }
  if (finalScorePlayer1 > raceTarget || finalScorePlayer2 > raceTarget) {
    return 'Score cannot exceed race length.';
  }
  if (finalScorePlayer1 === finalScorePlayer2) {
    return 'Tie not possible. Select the player who reached the race length.';
  }
  if (![player1Id, player2Id].includes(winnerId)) {
    return 'Winner must be one of the match players.';
  }

  const winnerScore = winnerId === player1Id ? finalScorePlayer1 : finalScorePlayer2;
  const loserScore = winnerId === player1Id ? finalScorePlayer2 : finalScorePlayer1;
  if (winnerScore < raceTarget) return `Winner must reach race length ${raceTarget}.`;
  if (loserScore >= raceTarget) return 'Only the winner can reach the race length.';
  return null;
}

async function recordMatchFeePayments(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
  actorProfileId: string,
  payers: MatchFeePayer[],
): Promise<void> {
  if (payers.length === 0) return;

  const shortMatch = matchId.slice(0, 8);
  const rows = payers.map((payer) => ({
    entry_type: 'credit',
    amount_cents: 500,
    description: `Match fee · ${payer.player_name} · ${PAYMENT_METHOD_LABELS[payer.payment_method]} · match ${shortMatch}`,
    created_by: actorProfileId,
    source_type: 'match_fee',
    source_id: matchId,
    player_id: payer.player_id,
    metadata: {
      match_id: matchId,
      player_id: payer.player_id,
      player_name: payer.player_name,
      payment_method: payer.payment_method,
      amount_cents: MATCH_FEE_CENTS,
    },
  }));

  for (const row of rows) {
    const { error } = await supabase.from('treasury_ledger').insert(row);
    if (!error) continue;
    // 23505 = unique_violation (idempotent retry); anything else is a real failure.
    if ((error as { code?: string }).code !== '23505') {
      throw error;
    }
  }
}

// Records the $5 match fee for each player who attached a payment method to
// the match, regardless of whether the match is heading to confirmed or
// disputed. Called from both paths so admin dispute resolution doesn't have
// to chase down payment methods after the fact.
async function recordSubmittedMatchFees(
  supabase: ReturnType<typeof createClient>,
  match: Record<string, unknown>,
  actorProfileId: string,
): Promise<void> {
  const matchId = match.id as string;
  const player1Id = match.player1_id as string;
  const player2Id = match.player2_id as string;
  const player1PaymentMethod = normalizePayment(match.player1_payment_method);
  const player2PaymentMethod = normalizePayment(match.player2_payment_method);

  if (!player1PaymentMethod && !player2PaymentMethod) return;

  const [{ data: p1Player }, { data: p2Player }] = await Promise.all([
    supabase.from('players').select('full_name').eq('id', player1Id).single(),
    supabase.from('players').select('full_name').eq('id', player2Id).single(),
  ]);

  const payers: MatchFeePayer[] = [];
  if (player1PaymentMethod) {
    payers.push({
      player_id: player1Id,
      player_name: p1Player?.full_name ?? 'Player 1',
      payment_method: player1PaymentMethod,
    });
  }
  if (player2PaymentMethod) {
    payers.push({
      player_id: player2Id,
      player_name: p2Player?.full_name ?? 'Player 2',
      payment_method: player2PaymentMethod,
    });
  }

  if (payers.length === 0) return;

  await recordMatchFeePayments(supabase, matchId, actorProfileId, payers);
  for (const payer of payers) {
    const { data: existing } = await supabase
      .from('activity_feed')
      .select('id')
      .eq('event_type', 'match_fee_recorded')
      .eq('actor_player_id', payer.player_id)
      .ilike('detail', `%${matchId.slice(0, 8)}%`)
      .limit(1)
      .maybeSingle();
    if (existing) continue;
    await supabase.from('activity_feed').insert({
      event_type: 'match_fee_recorded',
      headline: `${payer.player_name} paid the $5 match fee · ${PAYMENT_METHOD_LABELS[payer.payment_method]}`,
      detail: `Match ${matchId.slice(0, 8)} · credited to league treasury`,
      actor_player_id: payer.player_id,
    });
  }
}

async function createPostLossCooldown(supabase: ReturnType<typeof createClient>, loserId: string): Promise<void> {
  const { data: settings } = await supabase.from('league_settings').select('cooldown_hours').single();
  const cooldownHours = settings?.cooldown_hours ?? 24;
  if (cooldownHours <= 0) return;
  const expiresAt = new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString();
  const { error } = await supabase.from('cooldowns').insert({ player_id: loserId, type: 'post_match', expires_at: expiresAt });
  if (error) throw error;
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
      await supabase.from('notifications').insert({ player_id: rank1Player.id, type: 'rank1_penalty', title: 'ðŸ“‰ Rank 1 obligation not met', body: 'You did not play a top-5 opponent twice in your 30-day window. You have been moved to #10.', reference_type: 'ranking' });
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
  const { error: matchError } = await supabase.from('matches').update({ status: 'confirmed', winner_id: winnerId, loser_id: loserId, player1_score: p1Score, player2_score: p2Score, completed_at: new Date().toISOString() }).eq('id', matchId);
  if (matchError) throw matchError;

  const { error: challengeError } = await supabase.from('challenges').update({ status: 'confirmed' }).eq('id', match.challenge_id);
  if (challengeError) throw challengeError;

  const [winnerRank, loserRank] = await Promise.all([
    supabase.from('rankings').select('position, rank1_since').eq('player_id', winnerId).single(),
    supabase.from('rankings').select('position').eq('player_id', loserId).single(),
  ]);
  const winnerIsChallenger = match.player1_id === winnerId;

  if (winnerRank.data && loserRank.data) {
    const wPos = winnerRank.data.position;
    const lPos = loserRank.data.position;
    let winnerCurrentPosition = wPos;
    if (wPos > lPos) {
      const { error: cascadeError } = await supabase.rpc('cascade_ranking_after_win', { p_winner_id: winnerId, p_loser_id: loserId });
      if (cascadeError) throw cascadeError;

      const { data: refreshedWinnerRank, error: refreshedWinnerRankError } = await supabase
        .from('rankings')
        .select('position')
        .eq('player_id', winnerId)
        .single();
      if (refreshedWinnerRankError) throw refreshedWinnerRankError;
      winnerCurrentPosition = refreshedWinnerRank?.position ?? winnerCurrentPosition;

      if (lPos === 1 && !winnerRank.data.rank1_since) {
        const { error: rank1Error } = await supabase.from('rankings').update({ rank1_since: new Date().toISOString() }).eq('player_id', winnerId);
        if (rank1Error) throw rank1Error;
      }
    }

    const [winnerStats, loserStats] = await Promise.all([
      supabase.from('player_season_stats').select('*').eq('player_id', winnerId).single(),
      supabase.from('player_season_stats').select('*').eq('player_id', loserId).single(),
    ]);
    if (winnerStats.data) {
      const s = winnerStats.data;
      const newStreak = s.current_streak >= 0 ? s.current_streak + 1 : 1;
      const bestRank = s.best_rank_achieved === null || winnerCurrentPosition < s.best_rank_achieved ? winnerCurrentPosition : s.best_rank_achieved;
      const { error: winnerStatsError } = await supabase.from('player_season_stats').update({ wins: s.wins + 1, matches_played: s.matches_played + 1, current_streak: newStreak, best_streak: Math.max(s.best_streak, newStreak), challenger_wins: winnerIsChallenger ? s.challenger_wins + 1 : s.challenger_wins, defender_wins: !winnerIsChallenger ? s.defender_wins + 1 : s.defender_wins, best_rank_achieved: bestRank }).eq('player_id', winnerId);
      if (winnerStatsError) throw winnerStatsError;
    }

    if (loserStats.data) {
      const s = loserStats.data;
      const { error: loserStatsError } = await supabase.from('player_season_stats').update({ losses: s.losses + 1, matches_played: s.matches_played + 1, current_streak: 0 }).eq('player_id', loserId);
      if (loserStatsError) throw loserStatsError;
    }
  }

  await createPostLossCooldown(supabase, loserId);

  const disc = match.discipline;
  const disciplineSeeds = await Promise.all([winnerId, loserId].map((pid) => supabase.from('player_discipline_stats').upsert({ player_id: pid, discipline: disc }, { onConflict: 'player_id,discipline', ignoreDuplicates: true })));
  for (const seed of disciplineSeeds) {
    if (seed.error) throw seed.error;
  }

  for (const [pid, isWinner, isChallenger] of [[winnerId, true, winnerIsChallenger], [loserId, false, !winnerIsChallenger]] as [string, boolean, boolean][]) {
    const { data: ds } = await supabase.from('player_discipline_stats').select('*').eq('player_id', pid).eq('discipline', disc).single();
    if (ds) {
      const newStreak = isWinner ? (ds.current_streak >= 0 ? ds.current_streak + 1 : 1) : 0;
      const { error: disciplineStatsError } = await supabase.from('player_discipline_stats').update({ matches_played: ds.matches_played + 1, wins: isWinner ? ds.wins + 1 : ds.wins, losses: isWinner ? ds.losses : ds.losses + 1, current_streak: newStreak, best_streak: isWinner ? Math.max(ds.best_streak, newStreak) : ds.best_streak, challenger_wins: isWinner && isChallenger ? ds.challenger_wins + 1 : ds.challenger_wins, defender_wins: isWinner && !isChallenger ? ds.defender_wins + 1 : ds.defender_wins, total_race_length: ds.total_race_length + match.race_length, updated_at: new Date().toISOString() }).eq('player_id', pid).eq('discipline', disc);
      if (disciplineStatsError) throw disciplineStatsError;
    }
  }

  const [wp, lp] = await Promise.all([
    supabase.from('players').select('full_name').eq('id', winnerId).single(),
    supabase.from('players').select('full_name').eq('id', loserId).single(),
  ]);

  const { error: notificationError } = await supabase.from('notifications').insert([
    { player_id: winnerId, type: 'result_confirmed', title: 'ðŸ† Match confirmed â€” Victory!', body: `Final: ${p1Score}â€“${p2Score}`, reference_id: matchId, reference_type: 'match' },
    { player_id: loserId, type: 'result_confirmed', title: 'ðŸ“Š Match confirmed', body: `Final: ${p1Score}â€“${p2Score}`, reference_id: matchId, reference_type: 'match' },
  ]);
  if (notificationError) throw notificationError;
  await Promise.all([
    sendPush(supabase, winnerId, 'ðŸ† Match confirmed â€” Victory!', `Final: ${p1Score}â€“${p2Score}`, `/match/${matchId}`),
    sendPush(supabase, loserId, 'ðŸ“Š Match confirmed', `Final: ${p1Score}â€“${p2Score}`, `/match/${matchId}`),
  ]);
  const { error: activityError } = await supabase.from('activity_feed').insert({ event_type: 'match_confirmed', headline: `${wp.data?.full_name} def. ${lp.data?.full_name} Â· ${p1Score}â€“${p2Score}`, actor_player_id: winnerId });
  if (activityError) throw activityError;
  try {
    await checkRank1Compliance(supabase);
  } catch (error) {
    console.error('rank1 compliance check failed after match confirmation', error);
    // Match confirmation is already complete at this point. A maintenance check
    // must not make both players see a failed result submission.
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const { match_id, winner_id, final_score_player1, final_score_player2, payment_method } = await req.json();
    const normalizedPayment = normalizePayment(payment_method);
    if (payment_method != null && payment_method !== '' && normalizedPayment === null) return new Response(JSON.stringify({ error: 'Invalid payment method.' }), { status: 400, headers: cors });

    const { data: match } = await supabase.from('matches').select('*').eq('id', match_id).single();
    if (!match) return new Response(JSON.stringify({ error: 'Match not found.' }), { status: 404, headers: cors });
    if (!['in_progress', 'scheduled', 'submitted'].includes(match.status)) return new Response(JSON.stringify({ error: 'Match is not in progress.' }), { status: 409, headers: cors });

    const raceTarget = match.race_length;
    const scoreError = validateFinalScore(winner_id, match.player1_id, match.player2_id, final_score_player1, final_score_player2, raceTarget);
    if (scoreError) return new Response(JSON.stringify({ error: scoreError }), { status: 400, headers: cors });

    const { data: caller } = await supabase.from('players').select('id').eq('profile_id', user.id).single();
    if (!caller) return new Response(JSON.stringify({ error: 'Player not found.' }), { status: 404, headers: cors });
    const isP1 = match.player1_id === caller.id;
    const isP2 = match.player2_id === caller.id;
    if (!isP1 && !isP2) return new Response(JSON.stringify({ error: 'Not a participant.' }), { status: 403, headers: cors });

    const submissionUpdates: Record<string, unknown> = { status: 'submitted' };
    const submittedAt = new Date().toISOString();
    if (isP1) {
      submissionUpdates.player1_submitted = true;
      submissionUpdates.player1_submitted_winner_id = winner_id;
      submissionUpdates.player1_submitted_player1_score = final_score_player1;
      submissionUpdates.player1_submitted_player2_score = final_score_player2;
      submissionUpdates.player1_submitted_at = submittedAt;
      if (normalizedPayment) submissionUpdates.player1_payment_method = normalizedPayment;
    } else {
      submissionUpdates.player2_submitted = true;
      submissionUpdates.player2_submitted_winner_id = winner_id;
      submissionUpdates.player2_submitted_player1_score = final_score_player1;
      submissionUpdates.player2_submitted_player2_score = final_score_player2;
      submissionUpdates.player2_submitted_at = submittedAt;
      if (normalizedPayment) submissionUpdates.player2_payment_method = normalizedPayment;
    }

    const { error: submissionError } = await supabase
      .from('matches')
      .update(submissionUpdates)
      .eq('id', match_id)
      .in('status', ['scheduled', 'in_progress', 'submitted']);
    if (submissionError) throw submissionError;

    const { data: updated } = await supabase.from('matches').select('*').eq('id', match_id).single();
    if (!updated) return new Response(JSON.stringify({ error: 'Update failed.' }), { status: 500, headers: cors });

    if (updated.player1_submitted && updated.player2_submitted) {
      const { data: claimed } = await supabase.from('matches').update({ status: 'confirming' } as Record<string, unknown>).eq('id', match_id).eq('status', 'submitted').select('id');
      if (!claimed?.length) return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });

      const player1Submission = getPlayerSubmission(updated, 1);
      const player2Submission = getPlayerSubmission(updated, 2);

      if (!isCompleteSubmission(player1Submission) || !isCompleteSubmission(player2Submission)) {
        await supabase.from('matches').update({ status: 'disputed' }).eq('id', match_id).eq('status', 'confirming');
        await recordSubmittedMatchFees(supabase, updated, user.id);
        return new Response(JSON.stringify({ success: true, disputed: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (!submissionsMatch(player1Submission, player2Submission)) {
        const { error: disputeError } = await supabase.from('matches').update({ status: 'disputed' }).eq('id', match_id).eq('status', 'confirming');
        if (disputeError) throw disputeError;

        const [{ data: p1Player }, { data: p2Player }] = await Promise.all([
          supabase.from('players').select('full_name').eq('id', updated.player1_id).single(),
          supabase.from('players').select('full_name').eq('id', updated.player2_id).single(),
        ]);
        await supabase.from('notifications').insert([
          { player_id: updated.player1_id, type: 'result_disputed', title: 'Match result needs review', body: `Your submitted result did not match ${p2Player?.full_name ?? 'your opponent'}'s submission. An admin will review it.`, reference_id: match_id, reference_type: 'match' },
          { player_id: updated.player2_id, type: 'result_disputed', title: 'Match result needs review', body: `Your submitted result did not match ${p1Player?.full_name ?? 'your opponent'}'s submission. An admin will review it.`, reference_id: match_id, reference_type: 'match' },
        ]);
        await supabase.from('activity_feed').insert({
          event_type: 'match_disputed',
          headline: `${p1Player?.full_name ?? 'Player 1'} and ${p2Player?.full_name ?? 'Player 2'} submitted different match results.`,
          detail: `${updated.discipline} match ${match_id.slice(0, 8)} needs admin review.`,
        });

        await recordSubmittedMatchFees(supabase, updated, user.id);
        return new Response(JSON.stringify({ success: true, disputed: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const finalWinnerId = player1Submission.winnerId;
      const finalPlayer1Score = player1Submission.player1Score;
      const finalPlayer2Score = player1Submission.player2Score;
      const finalScoreError = validateFinalScore(finalWinnerId, updated.player1_id, updated.player2_id, finalPlayer1Score, finalPlayer2Score, updated.race_length);
      if (finalScoreError) {
        const { error: disputeError } = await supabase.from('matches').update({ status: 'disputed' }).eq('id', match_id).eq('status', 'confirming');
        if (disputeError) throw disputeError;
        await recordSubmittedMatchFees(supabase, updated, user.id);
        return new Response(JSON.stringify({ success: true, disputed: true, error: finalScoreError }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const loser_id = finalWinnerId === updated.player1_id ? updated.player2_id : updated.player1_id;
      await confirmResult(supabase, match_id, finalWinnerId, loser_id, finalPlayer1Score, finalPlayer2Score, updated);

      const { data: finalMatch } = await supabase.from('matches').select('*').eq('id', match_id).single();
      if (finalMatch) {
        await recordSubmittedMatchFees(supabase, finalMatch, user.id);
      }
    } else {
      const otherId = isP1 ? match.player2_id : match.player1_id;
      const { data: callerPlayer } = await supabase.from('players').select('full_name').eq('id', caller.id).single();
      await supabase.from('notifications').insert({ player_id: otherId, type: 'result_submitted', title: 'ðŸ“Š Opponent submitted result', body: `${callerPlayer?.full_name} submitted the match result. Please submit yours to confirm.`, reference_id: match_id, reference_type: 'match' });
      await sendPush(supabase, otherId, 'ðŸ“Š Opponent submitted result', `${callerPlayer?.full_name} submitted. Tap to confirm.`, `/match/${match_id}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    const detail = e instanceof Error
      ? { message: e.message, name: e.name, stack: e.stack }
      : e && typeof e === 'object'
        ? e
        : { message: String(e) };
    console.error('submit-result failed', detail);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

