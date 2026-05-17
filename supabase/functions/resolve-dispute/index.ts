import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

type PaymentMethod = 'cash_envelope' | 'paypal' | 'cash_app' | 'venmo';
const PAYMENT_METHODS: PaymentMethod[] = ['cash_envelope', 'paypal', 'cash_app', 'venmo'];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_envelope: 'Cash envelope',
  paypal: 'PayPal',
  cash_app: 'Cash App',
  venmo: 'Venmo',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 403, headers: cors });
    }

    const {
      match_id,
      winner_id,
      final_score_player1,
      final_score_player2,
      notes,
      player1_payment_method,
      player2_payment_method,
    } = await req.json();

    const normalizePayment = (value: unknown): PaymentMethod | null => {
      if (value == null || value === '') return null;
      if (typeof value !== 'string') return null;
      return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : null;
    };
    const explicitPlayer1Payment = normalizePayment(player1_payment_method);
    const explicitPlayer2Payment = normalizePayment(player2_payment_method);
    if (player1_payment_method != null && player1_payment_method !== '' && explicitPlayer1Payment === null) {
      return new Response(JSON.stringify({ error: 'Invalid player1 payment method.' }), { headers: cors });
    }
    if (player2_payment_method != null && player2_payment_method !== '' && explicitPlayer2Payment === null) {
      return new Response(JSON.stringify({ error: 'Invalid player2 payment method.' }), { headers: cors });
    }

    const { data: match } = await supabase.from('matches').select('*').eq('id', match_id).single();
    if (!match) return new Response(JSON.stringify({ error: 'Match not found.' }), { headers: cors });

    const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;

    // Update match to resolved
    const matchUpdate: Record<string, unknown> = {
      status: 'resolved',
      winner_id,
      loser_id,
      player1_score: final_score_player1,
      player2_score: final_score_player2,
      completed_at: new Date().toISOString(),
    };
    if (explicitPlayer1Payment) matchUpdate.player1_payment_method = explicitPlayer1Payment;
    if (explicitPlayer2Payment) matchUpdate.player2_payment_method = explicitPlayer2Payment;
    await supabase.from('matches').update(matchUpdate).eq('id', match_id);

    if (match.challenge_id) {
      await supabase.from('challenges').update({ status: 'resolved' }).eq('id', match.challenge_id);
    }

    // Apply ranking cascade atomically via RPC
    const [winnerRank, loserRank] = await Promise.all([
      supabase.from('rankings').select('position').eq('player_id', winner_id).single(),
      supabase.from('rankings').select('position').eq('player_id', loser_id).single(),
    ]);
    if (winnerRank.data && loserRank.data && winnerRank.data.position > loserRank.data.position) {
      await supabase.rpc('cascade_ranking_after_win', {
        p_winner_id: winner_id,
        p_loser_id: loser_id,
      });
    }

    // Update stats
    const [ws, ls] = await Promise.all([
      supabase.from('player_season_stats').select('*').eq('player_id', winner_id).single(),
      supabase.from('player_season_stats').select('*').eq('player_id', loser_id).single(),
    ]);
    if (ws.data) {
      const s = ws.data;
      const streak = s.current_streak >= 0 ? s.current_streak + 1 : 1;
      await supabase.from('player_season_stats').update({ wins: s.wins + 1, matches_played: s.matches_played + 1, points: s.points + 3, current_streak: streak, best_streak: Math.max(s.best_streak, streak) }).eq('player_id', winner_id);
    }
    if (ls.data) {
      const s = ls.data;
      await supabase.from('player_season_stats').update({ losses: s.losses + 1, matches_played: s.matches_played + 1, points: s.points + 1, current_streak: -1 }).eq('player_id', loser_id);
    }

    // Audit log
    await supabase.from('audit_events').insert({
      actor_profile_id: user.id,
      action: 'resolve_dispute',
      target_type: 'match',
      target_id: match_id,
      detail: { winner_id, notes },
    });

    // Notifications
    const [wp, lp] = await Promise.all([
      supabase.from('players').select('full_name').eq('id', winner_id).single(),
      supabase.from('players').select('full_name').eq('id', loser_id).single(),
    ]);
    await supabase.from('notifications').insert([
      { player_id: winner_id, type: 'result_confirmed', title: '🏆 Dispute resolved — you won!', body: `Admin ruled in your favor. ${final_score_player1}–${final_score_player2}.`, reference_id: match_id, reference_type: 'match' },
      { player_id: loser_id,  type: 'result_confirmed', title: '📊 Dispute resolved',            body: `Admin ruled: ${wp.data?.full_name} wins ${final_score_player1}–${final_score_player2}.`, reference_id: match_id, reference_type: 'match' },
    ]);

    await supabase.from('activity_feed').insert({
      event_type: 'dispute_resolved',
      headline: `Admin resolved disputed match: ${wp.data?.full_name} defeated ${lp.data?.full_name}`,
      detail: `Final score recorded as ${final_score_player1}–${final_score_player2}. Admin notes: ${notes ?? '—'}.`,
      actor_player_id: winner_id,
    });

    const explicitPayers: { player_id: string; player_name: string; method: PaymentMethod }[] = [];
    if (explicitPlayer1Payment) {
      explicitPayers.push({
        player_id: match.player1_id,
        player_name: (match.player1_id === winner_id ? wp.data?.full_name : lp.data?.full_name) ?? 'Player 1',
        method: explicitPlayer1Payment,
      });
    }
    if (explicitPlayer2Payment) {
      explicitPayers.push({
        player_id: match.player2_id,
        player_name: (match.player2_id === winner_id ? wp.data?.full_name : lp.data?.full_name) ?? 'Player 2',
        method: explicitPlayer2Payment,
      });
    }

    for (const payer of explicitPayers) {
      const { error } = await supabase.from('treasury_ledger').insert({
        entry_type: 'credit',
        amount_cents: 500,
        description: `Match fee · ${payer.player_name} · ${PAYMENT_METHOD_LABELS[payer.method]} · match ${match_id.slice(0, 8)}`,
        created_by: user.id,
        source_type: 'match_fee',
        source_id: match_id,
        player_id: payer.player_id,
        metadata: {
          match_id,
          player_id: payer.player_id,
          player_name: payer.player_name,
          payment_method: payer.method,
          amount_cents: 500,
          recorded_via: 'resolve_dispute',
        },
      });
      if (error && (error as { code?: string }).code !== '23505') throw error;
      await supabase.from('activity_feed').insert({
        event_type: 'match_fee_recorded',
        headline: `${payer.player_name} paid the $5 match fee · ${PAYMENT_METHOD_LABELS[payer.method]}`,
        detail: `Match ${match_id.slice(0, 8)} · recorded by admin during dispute resolution`,
        actor_player_id: payer.player_id,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
