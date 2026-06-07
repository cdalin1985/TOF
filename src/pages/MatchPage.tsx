import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Flag,
  CheckCircle,
  Wallet,
  Mail,
  Smartphone,
  Send,
  Undo2,
  ExternalLink,
} from 'lucide-react';
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
import {
  PAYMENT_METHODS,
  paymentMethodUrl,
  type PaymentMethod,
  type PaymentMethodDefinition,
} from '../lib/paymentMethods';

function ScoreDisplay({ value, color }: { value: number; color: string }) {
  return (
    <motion.div
      key={value}
      initial={{ scale: 1.3, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 25 }}
      className="font-[Azeret_Mono] font-bold leading-none"
      style={{ fontSize: '88px', color }}
    >
      {value}
    </motion.div>
  );
}

const PAYMENT_ICONS: Record<PaymentMethod, React.ComponentType<{ size?: number; className?: string }>> = {
  cash_envelope: Mail,
  paypal: Wallet,
  cash_app: Smartphone,
  venmo: Send,
};

type LastScoreAction = {
  prevPlayer1Score: number;
  prevPlayer2Score: number;
  prevPlayer1Submitted: boolean;
  prevPlayer2Submitted: boolean;
};

type ScoreboardSideProps = {
  playerId: string;
  name: string;
  pos: number;
  score: number;
  isWinnerSide: boolean;
  isLoserSide: boolean;
  canScore: boolean;
  raceComplete: boolean;
  disabled: boolean;
  onAddPoint: (playerId: string) => void;
};

function ScoreboardSide({
  playerId,
  name,
  pos,
  score,
  isWinnerSide,
  isLoserSide,
  canScore,
  raceComplete,
  disabled,
  onAddPoint,
}: ScoreboardSideProps) {
  const color = isWinnerSide ? '#22C55E' : isLoserSide ? '#EF4444' : '#E8E2D6';
  const firstName = name.split(' ')[0];

  return (
    <button
      type="button"
      aria-label={`Add point for ${name}`}
      onClick={() => onAddPoint(playerId)}
      disabled={disabled}
      className={[
        'group flex-1 flex flex-col items-center justify-between gap-3 rounded-2xl py-5 px-3 min-h-[180px]',
        'border transition-all duration-150',
        'select-none',
        disabled
          ? 'border-[#2a2a2a] bg-[#1a1a1a]/40 cursor-default'
          : 'border-[#333] bg-[#1f1f1f]/80 hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5 active:scale-[0.98] active:bg-[#22C55E]/15 cursor-pointer',
      ].join(' ')}
    >
      <div className="flex flex-col items-center gap-1.5">
        <PoolBall position={pos} size={44} />
        <div className="font-[Barlow] font-semibold text-sm text-[#E8E2D6] text-center max-w-[110px] leading-tight">
          {firstName}
        </div>
      </div>
      <ScoreDisplay value={score} color={color} />
      {canScore && !raceComplete && (
        <div className="text-[10px] font-[Barlow] uppercase tracking-wider text-[#22C55E]/70 group-active:text-[#22C55E]">
          Tap to add point
        </div>
      )}
      {raceComplete && isWinnerSide && (
        <div className="text-[10px] font-[Barlow] uppercase tracking-wider text-[#22C55E]">
          Race won
        </div>
      )}
    </button>
  );
}

type TableSideScoreboardProps = {
  match: Match;
  p1Name: string;
  p2Name: string;
  p1Pos: number;
  p2Pos: number;
  canScore: boolean;
  submitting: boolean;
  onAddPoint: (playerId: string) => void;
};

function TableSideScoreboard({
  match,
  p1Name,
  p2Name,
  p1Pos,
  p2Pos,
  canScore,
  submitting,
  onAddPoint,
}: TableSideScoreboardProps) {
  const raceComplete = match.player1_score >= match.race_length || match.player2_score >= match.race_length;
  const totalGames = match.player1_score + match.player2_score;
  const progressPct = Math.min(100, (Math.max(match.player1_score, match.player2_score) / match.race_length) * 100);
  const disabled = !canScore || submitting || raceComplete;

  return (
    <GlassCard className="p-4 mb-5">
      <div className="flex items-stretch gap-3">
        <ScoreboardSide
          playerId={match.player1_id}
          name={p1Name}
          pos={p1Pos}
          score={match.player1_score}
          isWinnerSide={match.winner_id === match.player1_id}
          isLoserSide={match.winner_id != null && match.winner_id !== match.player1_id}
          canScore={canScore}
          raceComplete={raceComplete}
          disabled={disabled}
          onAddPoint={onAddPoint}
        />
        <div className="flex items-center font-[Bebas_Neue] text-2xl text-[#6B7280] px-1">VS</div>
        <ScoreboardSide
          playerId={match.player2_id}
          name={p2Name}
          pos={p2Pos}
          score={match.player2_score}
          isWinnerSide={match.winner_id === match.player2_id}
          isLoserSide={match.winner_id != null && match.winner_id !== match.player2_id}
          canScore={canScore}
          raceComplete={raceComplete}
          disabled={disabled}
          onAddPoint={onAddPoint}
        />
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs text-[#6B7280] font-[Barlow] mb-1">
          <span>Race to {match.race_length}</span>
          <span>{totalGames} games played</span>
        </div>
        <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--toc-theme-accent)] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { player } = useAuthStore();
  const { data: rankings = [] } = useRankings();
  const [submitting, setSubmitting]               = useState(false);
  const [submitStep, setSubmitStep]               = useState<'winner' | 'payment' | null>(null);
  const [submitError, setSubmitError]             = useState('');
  const [submittedWinner, setSubmittedWinner]     = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod]         = useState<PaymentMethod | null>(null);
  const [lastScoreAction, setLastScoreAction]     = useState<LastScoreAction | null>(null);
  const [undoing, setUndoing]                     = useState(false);

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
  const player1ReachedRace = match.player1_score >= match.race_length;
  const player2ReachedRace = match.player2_score >= match.race_length;
  const raceWinnerId = player1ReachedRace !== player2ReachedRace
    ? player1ReachedRace ? match.player1_id : match.player2_id
    : null;
  const raceSubmissionReason = !player1ReachedRace && !player2ReachedRace
    ? `Race to ${match.race_length}: a player must reach ${match.race_length} games before submitting.`
    : !raceWinnerId
    ? 'Only one player can be at the race length. Adjust the score before submitting.'
    : '';
  const canSubmitRaceResult = raceWinnerId !== null && raceSubmissionReason === '';
  const raceWinnerName = raceWinnerId === match.player1_id ? p1Name : raceWinnerId === match.player2_id ? p2Name : '';
  const paymentMethodAvailable = (method: PaymentMethodDefinition) => !method.urlEnv || !!paymentMethodUrl(method.id);

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

  const sendScore = async (p1Score: number, p2Score: number) => {
    await callFn('update-match-score', {
      match_id: match.id,
      my_score: isPlayer1 ? p1Score : p2Score,
      opponent_score: isPlayer1 ? p2Score : p1Score,
    });
    qc.invalidateQueries({ queryKey: ['match', id] });
  };

  const handleAddPoint = async (winnerId: string) => {
    if (!amInMatch || submitting) return;
    const snapshot: LastScoreAction = {
      prevPlayer1Score: match.player1_score,
      prevPlayer2Score: match.player2_score,
      prevPlayer1Submitted: match.player1_submitted,
      prevPlayer2Submitted: match.player2_submitted,
    };
    const newP1 = winnerId === match.player1_id ? match.player1_score + 1 : match.player1_score;
    const newP2 = winnerId === match.player2_id ? match.player2_score + 1 : match.player2_score;

    setSubmitting(true);
    setSubmitError('');
    try {
      await sendScore(newP1, newP2);
      setLastScoreAction(snapshot);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Score update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoLastPoint = async () => {
    if (!lastScoreAction || undoing) return;
    setUndoing(true);
    setSubmitError('');
    try {
      await sendScore(lastScoreAction.prevPlayer1Score, lastScoreAction.prevPlayer2Score);
      setLastScoreAction(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Undo failed.');
    } finally {
      setUndoing(false);
    }
  };

  const handleSubmitResult = async () => {
    const winnerId = raceWinnerId;
    if (!winnerId) {
      setSubmitError(raceSubmissionReason || 'Complete the race before submitting.');
      return;
    }
    if (submittedWinner !== winnerId) {
      setSubmittedWinner(winnerId);
      setSubmitError(`${raceWinnerName} is the valid winner for this score.`);
      return;
    }
    if (!paymentMethod) return;
    const selectedPayment = PAYMENT_METHODS.find((method) => method.id === paymentMethod);
    if (!selectedPayment || !paymentMethodAvailable(selectedPayment)) {
      setSubmitError('Choose cash envelope or a configured digital payment link.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const json = await callFn('submit-result', {
        match_id: match.id,
        winner_id: winnerId,
        final_score_player1: match.player1_score,
        final_score_player2: match.player2_score,
        payment_method: paymentMethod,
      });
      if (json.error) { setSubmitError(json.error); return; }
      setSubmitStep(null);
      setLastScoreAction(null);
      qc.invalidateQueries({ queryKey: ['match', id] });
      qc.invalidateQueries({ queryKey: ['rankings'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['home-action-matches'] });
      qc.invalidateQueries({ queryKey: ['home-pending-challenges'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['activity-feed'] });
      qc.invalidateQueries({ queryKey: ['treasury'] });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Result submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasSubmitted = (isPlayer1 && match.player1_submitted) || (isPlayer2 && match.player2_submitted);
  const isWinner    = match.winner_id === player?.id;
  const canScore    = match.status === 'in_progress' && amInMatch && !hasSubmitted;
  const showUndo    = canScore && lastScoreAction !== null;

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

      <TableSideScoreboard
        match={match}
        p1Name={p1Name}
        p2Name={p2Name}
        p1Pos={p1Pos}
        p2Pos={p2Pos}
        canScore={canScore}
        submitting={submitting}
        onAddPoint={handleAddPoint}
      />

      {showUndo && (
        <button
          type="button"
          onClick={handleUndoLastPoint}
          disabled={undoing}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-5 rounded-xl bg-[#252525]/80 border border-[#333] text-[#E8E2D6] text-sm font-[Barlow] active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <Undo2 size={16} />
          {undoing ? 'Undoing…' : 'Undo last point'}
        </button>
      )}

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
            <GlassCard className="p-4 mb-1 border border-[#F59E0B]/40">
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
            <div className="space-y-2">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                disabled={!canSubmitRaceResult}
                onClick={() => {
                  if (!canSubmitRaceResult) {
                    setSubmitError(raceSubmissionReason);
                    return;
                  }
                  setSubmittedWinner(raceWinnerId);
                  setPaymentMethod(null);
                  setSubmitStep('winner');
                  setSubmitError('');
                }}
              >
                <Flag size={18} /> {match.status === 'submitted' ? 'Confirm Result' : 'Submit Final Result'}
              </Button>
              {raceSubmissionReason && (
                <div className="text-[#F59E0B] text-xs font-[Barlow] p-3 bg-[#F59E0B]/10 rounded-lg border border-[#F59E0B]/20">
                  {raceSubmissionReason}
                </div>
              )}
            </div>
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
                  {raceWinnerName && (
                    <div className="text-[#22C55E] text-xs font-[Barlow] p-3 mb-3 bg-[#22C55E]/10 rounded-lg border border-[#22C55E]/20">
                      {raceWinnerName} is auto-selected because they reached the race length.
                    </div>
                  )}
                  {raceSubmissionReason && (
                    <div className="text-[#F59E0B] text-xs font-[Barlow] p-3 mb-3 bg-[#F59E0B]/10 rounded-lg border border-[#F59E0B]/20">
                      {raceSubmissionReason}
                    </div>
                  )}
                  <div className="space-y-3 mb-5">
                    {[
                      { id: match.player1_id, name: p1Name, score: match.player1_score, pos: p1Pos },
                      { id: match.player2_id, name: p2Name, score: match.player2_score, pos: p2Pos },
                    ].map((p) => {
                      const isValidWinner = p.id === raceWinnerId;
                      const selected = submittedWinner === p.id;
                      return (
                        <button
                          key={p.id}
                          disabled={!isValidWinner}
                          onClick={() => {
                            if (isValidWinner) setSubmittedWinner(p.id);
                          }}
                          className={[
                            'w-full flex items-center gap-3 p-4 rounded-xl border transition-all',
                            selected
                              ? 'border-[#22C55E] bg-[#22C55E]/10'
                              : 'border-[#333] bg-[#252525]/50',
                            !isValidWinner ? 'opacity-55 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          <PoolBall position={p.pos} size={36} />
                          <div className="flex-1 text-left">
                            <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">{p.name}</div>
                            <div className="text-[#9CA3AF] text-xs font-[Azeret_Mono]">{p.score} games</div>
                            {!isValidWinner && (
                              <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">
                                Winner must reach {match.race_length}.
                              </div>
                            )}
                          </div>
                          {selected && <CheckCircle size={20} className="text-[#22C55E]" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" fullWidth onClick={() => setSubmitStep(null)}>Cancel</Button>
                    <Button
                      variant="primary" fullWidth
                      disabled={submittedWinner !== raceWinnerId}
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
                    {PAYMENT_METHODS.map((method: PaymentMethodDefinition) => {
                      const Icon = PAYMENT_ICONS[method.id];
                      const selected = paymentMethod === method.id;
                      const link = method.urlEnv ? paymentMethodUrl(method.id) : undefined;
                      const available = paymentMethodAvailable(method);
                      const helperText = method.urlEnv && !link
                        ? 'Payment link not configured. Use cash envelope or ask an admin.'
                        : method.helper;
                      return (
                        <button
                          key={method.id}
                          disabled={!available}
                          onClick={() => {
                            if (available) setPaymentMethod(method.id);
                          }}
                          className={[
                            'w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                            selected
                              ? 'border-[var(--toc-theme-accent)] bg-[var(--toc-theme-accent)]/10'
                              : 'border-[#333] bg-[#252525]/50',
                            !available ? 'opacity-55 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          <Icon size={22} className="text-[#9CA3AF] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">{method.label}</div>
                            <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">{helperText}</div>
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 mt-1.5 text-[10px] uppercase tracking-wider font-[Barlow] text-[#22C55E] underline decoration-dotted"
                              >
                                Open {method.label} <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          {selected && <CheckCircle size={20} className="text-[var(--toc-theme-accent)]" />}
                        </button>
                      );
                    })}
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
