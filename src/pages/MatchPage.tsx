import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Flag, CheckCircle, Wallet, Mail } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useRankings } from '../hooks/useRankings';
import { PoolBall } from '../components/PoolBall';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { formatDateTime } from '../utils/time';
import type { Match } from '../types/database';

function ScoreDisplay({ value, color }: { value: number; color: string }) {
  return (
    <motion.div
      key={value}
      initial={{ scale: 1.3, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 25 }}
      className="font-[Azeret_Mono] font-bold leading-none"
      style={{ fontSize: '72px', color }}
    >
      {value}
    </motion.div>
  );
}

type PaymentMethod = 'envelope' | 'digital';

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { player } = useAuthStore();
  const { data: rankings = [] } = useRankings();
  const [submitting, setSubmitting]           = useState(false);
  const [submitStep, setSubmitStep]           = useState<'winner' | 'payment' | null>(null);
  const [submitError, setSubmitError]         = useState('');
  const [submittedWinner, setSubmittedWinner] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod]     = useState<PaymentMethod | null>(null);

  const { data: match, isLoading } = useQuery<Match>({
    queryKey: ['match', id],
    queryFn: async () => {
      // id may be either a match UUID (from MatchesPage) or a challenge UUID (from ChallengesPage)
      const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`id.eq.${id},challenge_id.eq.${id}`)
        .single();
      return data!;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });

  if (isLoading || !match) {
    return (
      <div className="min-h-screen px-4 pt-4 space-y-4">
        <div className="skeleton h-8 w-24" />
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  const isPlayer1 = match.player1_id === player?.id;
  const isPlayer2 = match.player2_id === player?.id;
  const amInMatch  = isPlayer1 || isPlayer2;

  const p1Name = rankings.find((r) => r.player.id === match.player1_id)?.player.full_name ?? 'Player 1';
  const p2Name = rankings.find((r) => r.player.id === match.player2_id)?.player.full_name ?? 'Player 2';
  const p1Pos  = rankings.find((r) => r.player.id === match.player1_id)?.ranking.position ?? 1;
  const p2Pos  = rankings.find((r) => r.player.id === match.player2_id)?.ranking.position ?? 2;

  const myScore    = isPlayer1 ? match.player1_score : match.player2_score;
  const theirScore = isPlayer1 ? match.player2_score : match.player1_score;
  const myId       = isPlayer1 ? match.player1_id : match.player2_id;
  const theirId    = isPlayer1 ? match.player2_id : match.player1_id;

  const callFn = async (path: string, body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Session expired — please log in again.');
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    try {
      return await res.json();
    } catch {
      throw new Error(`Unexpected server response (${res.status})`);
    }
  };

  const handleScoreUpdate = async (winnerId: string) => {
    if (!amInMatch || submitting) return;
    const newMyScore    = winnerId === myId    ? myScore + 1 : myScore;
    const newTheirScore = winnerId === theirId ? theirScore + 1 : theirScore;
    setSubmitting(true);
    setSubmitError('');
    const p1Score = isPlayer1 ? newMyScore : newTheirScore;
    const p2Score = isPlayer1 ? newTheirScore : newMyScore;
    try {
      await callFn('update-match-score', {
        match_id: match.id,
        my_score: isPlayer1 ? p1Score : p2Score,
        opponent_score: isPlayer1 ? p2Score : p1Score,
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Score update failed.');
    } finally {
      setSubmitting(false);
    }
    qc.invalidateQueries({ queryKey: ['match', id] });
  };

  const handleSubmitResult = async () => {
    if (!submittedWinner || !paymentMethod) return;
    setSubmitting(true);
    setSubmitError('');
    const json = await callFn('submit-result', {
      match_id: match.id,
      winner_id: submittedWinner,
      final_score_player1: match.player1_score,
      final_score_player2: match.player2_score,
      payment_method: paymentMethod,
    });
    setSubmitting(false);
    if (json.error) { setSubmitError(json.error); return; }
    setSubmitStep(null);
    qc.invalidateQueries({ queryKey: ['match', id] });
    qc.invalidateQueries({ queryKey: ['rankings'] });
    qc.invalidateQueries({ queryKey: ['matches'] });
    qc.invalidateQueries({ queryKey: ['home-action-matches'] });
    qc.invalidateQueries({ queryKey: ['home-pending-challenges'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['activity-feed'] });
  };

  const hasSubmitted = (isPlayer1 && match.player1_submitted) || (isPlayer2 && match.player2_submitted);
  const isWinner    = match.winner_id === player?.id;

  return (
    <div className="min-h-screen px-4 pt-4 pb-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[#9CA3AF] p-2 -ml-2 mb-4">
        <ChevronLeft size={18} /> Back
      </button>

      <div className="text-center mb-5">
        <Badge variant={match.status === 'confirmed' ? 'win' : match.status === 'disputed' ? 'loss' : 'pending'}>
          {match.status.replace('_', ' ').toUpperCase()}
        </Badge>
        <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-2">
          {match.discipline} · Race to {match.race_length}
        </div>
        <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">
          {formatDateTime(match.scheduled_at)} @ {match.venue}
        </div>
      </div>

      {/* Scoreboard */}
      <GlassCard className="p-6 mb-5">
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center gap-2">
            <PoolBall position={p1Pos} size={52} />
            <div className="font-[Barlow] font-semibold text-sm text-[#E8E2D6] text-center max-w-[80px] leading-tight">
              {p1Name.split(' ')[0]}
            </div>
            <ScoreDisplay
              value={match.player1_score}
              color={match.winner_id === match.player1_id ? '#22C55E'
                   : match.winner_id && match.winner_id !== match.player1_id ? '#EF4444'
                   : '#E8E2D6'}
            />
            {match.status === 'in_progress' && amInMatch && !hasSubmitted && (
              <button
                onClick={() => handleScoreUpdate(match.player1_id)}
                disabled={submitting || match.player1_score >= match.race_length || match.player2_score >= match.race_length}
                className="w-10 h-10 rounded-full bg-[#22C55E]/20 border border-[#22C55E]/40 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={20} className="text-[#22C55E]" />
              </button>
            )}
          </div>

          <div className="font-[Bebas_Neue] text-3xl text-[#6B7280]">VS</div>

          <div className="flex flex-col items-center gap-2">
            <PoolBall position={p2Pos} size={52} />
            <div className="font-[Barlow] font-semibold text-sm text-[#E8E2D6] text-center max-w-[80px] leading-tight">
              {p2Name.split(' ')[0]}
            </div>
            <ScoreDisplay
              value={match.player2_score}
              color={match.winner_id === match.player2_id ? '#22C55E'
                   : match.winner_id && match.winner_id !== match.player2_id ? '#EF4444'
                   : '#E8E2D6'}
            />
            {match.status === 'in_progress' && amInMatch && !hasSubmitted && (
              <button
                onClick={() => handleScoreUpdate(match.player2_id)}
                disabled={submitting || match.player1_score >= match.race_length || match.player2_score >= match.race_length}
                className="w-10 h-10 rounded-full bg-[#22C55E]/20 border border-[#22C55E]/40 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={20} className="text-[#22C55E]" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-[#6B7280] font-[Barlow] mb-1">
            <span>Race to {match.race_length}</span>
            <span>{Math.max(match.player1_score, match.player2_score)}/{match.race_length} games played</span>
          </div>
          <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C62828] rounded-full transition-all duration-500"
              style={{ width: `${(Math.max(match.player1_score, match.player2_score) / match.race_length) * 100}%` }}
            />
          </div>
        </div>
      </GlassCard>

      {amInMatch && (
        <div className="space-y-3">
          {submitError && (
            <div className="text-[#EF4444] text-xs font-[Barlow] p-3 bg-[#EF4444]/10 rounded-lg border border-[#EF4444]/20">
              {submitError}
            </div>
          )}
          {match.status === 'scheduled' && (
            <Button
              variant="primary" fullWidth size="lg" loading={submitting}
              onClick={async () => {
                setSubmitting(true);
                setSubmitError('');
                try {
                  await callFn('update-match-score', { match_id: match.id, my_score: 0, opponent_score: 0 });
                } catch (e) {
                  setSubmitError(e instanceof Error ? e.message : 'Failed to start match.');
                } finally {
                  setSubmitting(false);
                }
                qc.invalidateQueries({ queryKey: ['match', id] });
              }}
            >
              🎱 Start Match
            </Button>
          )}

          {/* Opponent submitted — needs confirmation from this player */}
          {match.status === 'submitted' && !hasSubmitted && (
            <GlassCard className="p-4 mb-1" style={{ borderColor: 'rgba(245,158,11,0.4)', border: '1px solid rgba(245,158,11,0.4)' }}>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">📋</div>
                <div>
                  <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
                    Opponent submitted — your confirmation needed
                  </div>
                  <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-1">
                    Recorded score: {match.player1_score}–{match.player2_score}. Submit your result below to confirm or dispute.
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {(match.status === 'in_progress' || match.status === 'submitted') && !hasSubmitted && (
            <Button variant="primary" fullWidth size="lg" onClick={() => { setSubmitStep('winner'); setSubmitError(''); }}>
              <Flag size={18} /> {match.status === 'submitted' ? 'Confirm Result' : 'Submit Final Result'}
            </Button>
          )}

          {hasSubmitted && match.status === 'submitted' && (
            <GlassCard className="p-4 text-center">
              <CheckCircle size={32} className="text-[#22C55E] mx-auto mb-2" />
              <div className="font-[Barlow] font-semibold text-[#E8E2D6]">Result submitted!</div>
              <div className="text-[#9CA3AF] text-sm font-[Barlow] mt-1">
                Waiting for your opponent to confirm…
              </div>
            </GlassCard>
          )}

          {match.status === 'confirmed' && (
            <GlassCard className="p-6 text-center">
              <div className="text-5xl mb-3">{isWinner ? '🏆' : '😤'}</div>
              <div className="font-[Bebas_Neue] text-4xl" style={{ color: isWinner ? '#22C55E' : '#EF4444' }}>
                {isWinner ? 'Victory!' : 'Defeat'}
              </div>
              <div className="text-[#9CA3AF] font-[Barlow] text-sm mt-2">
                Final: {match.player1_score}–{match.player2_score}
              </div>
            </GlassCard>
          )}

          {match.status === 'disputed' && (
            <GlassCard className="p-4">
              <div className="text-[#EF4444] font-[Barlow] font-semibold mb-1">⚠️ Result Disputed</div>
              <div className="text-[#9CA3AF] text-sm font-[Barlow]">
                The submitted scores don't match. An admin will review and resolve this match.
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Submit result modal — two steps: winner then payment */}
      <AnimatePresence>
        {submitStep && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSubmitStep(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="glass-card p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {submitStep === 'winner' && (
                <>
                  <h2 className="font-[Bebas_Neue] text-2xl text-[#E8E2D6] mb-2">Who Won?</h2>
                  <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-5">
                    Final score: {match.player1_score}–{match.player2_score}
                  </p>
                  <div className="space-y-3 mb-5">
                    {[
                      { id: match.player1_id, name: p1Name, score: match.player1_score, pos: p1Pos },
                      { id: match.player2_id, name: p2Name, score: match.player2_score, pos: p2Pos },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSubmittedWinner(p.id)}
                        className={[
                          'w-full flex items-center gap-3 p-4 rounded-xl border transition-all',
                          submittedWinner === p.id
                            ? 'border-[#22C55E] bg-[#22C55E]/10'
                            : 'border-[#333] bg-[#252525]/50',
                        ].join(' ')}
                      >
                        <PoolBall position={p.pos} size={36} />
                        <div className="flex-1 text-left">
                          <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">{p.name}</div>
                          <div className="text-[#9CA3AF] text-xs font-[Azeret_Mono]">{p.score} games</div>
                        </div>
                        {submittedWinner === p.id && <CheckCircle size={20} className="text-[#22C55E]" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" fullWidth onClick={() => setSubmitStep(null)}>Cancel</Button>
                    <Button
                      variant="primary" fullWidth
                      disabled={!submittedWinner}
                      onClick={() => setSubmitStep('payment')}
                    >
                      Next →
                    </Button>
                  </div>
                </>
              )}

              {submitStep === 'payment' && (
                <>
                  <h2 className="font-[Bebas_Neue] text-2xl text-[#E8E2D6] mb-2">Match Fee — $5</h2>
                  <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-5">
                    How are you paying your $5 match fee?
                  </p>
                  <div className="space-y-3 mb-5">
                    <button
                      onClick={() => setPaymentMethod('envelope')}
                      className={[
                        'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                        paymentMethod === 'envelope'
                          ? 'border-[#C62828] bg-[#C62828]/10'
                          : 'border-[#333] bg-[#252525]/50',
                      ].join(' ')}
                    >
                      <Mail size={24} className="text-[#9CA3AF] shrink-0" />
                      <div>
                        <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">Used the envelope</div>
                        <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">Cash in the drop box at the venue</div>
                      </div>
                      {paymentMethod === 'envelope' && <CheckCircle size={20} className="text-[#C62828] ml-auto" />}
                    </button>
                    <button
                      onClick={() => setPaymentMethod('digital')}
                      className={[
                        'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                        paymentMethod === 'digital'
                          ? 'border-[#C62828] bg-[#C62828]/10'
                          : 'border-[#333] bg-[#252525]/50',
                      ].join(' ')}
                    >
                      <Wallet size={24} className="text-[#9CA3AF] shrink-0" />
                      <div>
                        <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">Paid digitally</div>
                        <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">Venmo, Cash App, or PayPal</div>
                      </div>
                      {paymentMethod === 'digital' && <CheckCircle size={20} className="text-[#C62828] ml-auto" />}
                    </button>
                  </div>
                  {submitError && <p className="text-[#EF4444] text-xs font-[Barlow] mb-3">{submitError}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" fullWidth onClick={() => setSubmitStep('winner')}>Back</Button>
                    <Button
                      variant="primary" fullWidth
                      loading={submitting}
                      disabled={!paymentMethod}
                      onClick={handleSubmitResult}
                    >
                      Submit Result
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
