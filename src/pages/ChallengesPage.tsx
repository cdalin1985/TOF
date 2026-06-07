import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, MapPin, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useRankings } from '../hooks/useRankings';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { RankingRowSkeleton } from '../components/Skeleton';
import { formatDateTime } from '../utils/time';
import type { Challenge } from '../types/database';
import { LEAGUE } from '../config/league';

const VENUES = LEAGUE.sponsorBars;
type Venue = typeof VENUES[number];
type ChallengeWithHoursLeft = Challenge & { hours_left: number };

function usePlayerChallenges(playerId: string | undefined) {
  return useQuery<ChallengeWithHoursLeft[]>({
    queryKey: ['challenges', playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
        .order('created_at', { ascending: false });
      const now = Date.now();
      return (data ?? []).map((challenge) => ({
        ...challenge,
        hours_left: Math.max(0, Math.ceil((new Date(challenge.expires_at).getTime() - now) / 3600000)),
      }));
    },
    enabled: !!playerId,
  });
}

function RespondModal({
  challenge,
  onClose,
  onSuccess,
}: {
  challenge: Challenge;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [venue, setVenue]     = useState<Venue | ''>('');
  const [date, setDate]       = useState('');
  const [time, setTime]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const callFn = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/respond-to-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ success?: boolean; error?: string }>;
  };

  const handleAccept = async () => {
    if (!venue || !date || !time) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const json = await callFn({ challenge_id: challenge.id, action: 'accept', venue, scheduled_at: scheduledAt });
    setLoading(false);
    if (json.error) { setError(json.error); return; }
    onSuccess();
  };

  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const handleDecline = async () => {
    setLoading(true);
    setError('');
    const json = await callFn({ challenge_id: challenge.id, action: 'decline' });
    setLoading(false);
    if (json.error) { setError(json.error); return; }
    setShowDeclineConfirm(false);
    onSuccess();
  };

  const handleWash = async () => {
    setLoading(true);
    await callFn({ challenge_id: challenge.id, action: 'wash' });
    setLoading(false);
    onSuccess();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="glass-card p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-[Bebas_Neue] text-2xl text-[#E8E2D6] mb-1">Respond to Challenge</h2>
        <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-4">
          {challenge.discipline} · Race to {challenge.race_length}
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[#9CA3AF] text-xs font-[Barlow] mb-1.5 flex items-center gap-1">
              <MapPin size={12} /> Venue
            </label>
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value as Venue)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[var(--toc-theme-accent)]"
            >
              <option value="">Select venue…</option>
              {VENUES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#9CA3AF] text-xs font-[Barlow] mb-1.5 flex items-center gap-1">
                <Calendar size={12} /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[var(--toc-theme-accent)]"
              />
            </div>
            <div>
              <label className="block text-[#9CA3AF] text-xs font-[Barlow] mb-1.5 flex items-center gap-1">
                <Clock size={12} /> Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[var(--toc-theme-accent)]"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-[#EF4444] text-xs font-[Barlow] mb-3">{error}</p>}

        {showDeclineConfirm ? (
          <div className="space-y-3 mb-2 p-3 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/5">
            <div className="text-sm font-[Barlow] font-semibold text-[#E8E2D6]">
              Decline counts as a forfeit
            </div>
            <ul className="text-xs font-[Barlow] text-[#9CA3AF] space-y-1 list-disc list-inside">
              <li>The challenger gets a win by forfeit and may take your spot if they are lower ranked.</li>
              <li>You get a forfeit on your record and a post-match cooldown.</li>
              <li>No match fee is owed.</li>
              <li>An admin can reverse this only if your rankings and stats have not changed yet.</li>
            </ul>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" fullWidth size="sm" onClick={() => setShowDeclineConfirm(false)} disabled={loading}>
                Keep pending
              </Button>
              <Button variant="danger" fullWidth size="sm" onClick={handleDecline} loading={loading}>
                Decline anyway
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mb-2">
            <Button variant="danger" fullWidth onClick={() => setShowDeclineConfirm(true)} disabled={loading}>
              Decline (forfeit)
            </Button>
            <Button variant="success" fullWidth onClick={handleAccept} loading={loading}>
              Accept ✓
            </Button>
          </div>
        )}
        <Button variant="ghost" fullWidth size="sm" onClick={handleWash} loading={loading}>
          We couldn't agree on a time
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default function ChallengesPage() {
  const { player } = useAuthStore();
  const { data: rankings = [] } = useRankings();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'incoming' | 'outgoing' | 'history'>('incoming');
  const [responding, setResponding] = useState<Challenge | null>(null);

  const { data: challenges = [], isLoading } = usePlayerChallenges(player?.id);

  const getPlayerName = (id: string) =>
    rankings.find((r) => r.player.id === id)?.player.full_name ?? 'Unknown';

  const incoming = challenges.filter((c) => c.challenged_id === player?.id && c.status === 'pending');
  const outgoing = challenges.filter((c) => c.challenger_id === player?.id && ['pending', 'accepted', 'scheduled'].includes(c.status));
  const history  = challenges.filter((c) => ['confirmed', 'declined', 'expired', 'forfeited', 'cancelled', 'in_progress', 'submitted'].includes(c.status));

  const statusBadge = (status: string): 'pending' | 'win' | 'loss' | 'default' => {
    const map: Record<string, 'pending' | 'win' | 'loss' | 'default'> = {
      pending: 'pending', accepted: 'win', scheduled: 'pending',
      declined: 'loss', expired: 'default', forfeited: 'loss', cancelled: 'default',
      confirmed: 'win', in_progress: 'pending', submitted: 'pending',
    };
    return map[status] ?? 'default';
  };

  const handleSuccess = () => {
    setResponding(null);
    qc.invalidateQueries({ queryKey: ['challenges'] });
    qc.invalidateQueries({ queryKey: ['matches'] });
  };

  const callFn = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/respond-to-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    qc.invalidateQueries({ queryKey: ['challenges'] });
  };

  const currentList = tab === 'incoming' ? incoming : tab === 'outgoing' ? outgoing : history;

  return (
    <div className="min-h-screen px-4 pt-8 pb-4">
      <h1 className="font-[Bebas_Neue] text-5xl tracking-wide text-[#E8E2D6] mb-5">Challenges</h1>

      <div className="flex gap-1 mb-5 bg-[#1A1A1A] rounded-xl p-1">
        {([
          { key: 'incoming', label: 'Incoming', count: incoming.length },
          { key: 'outgoing', label: 'Outgoing', count: outgoing.length },
          { key: 'history',  label: 'History',  count: 0 },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-[Barlow] font-medium transition-all duration-200',
              tab === t.key ? 'text-white' : 'text-[#9CA3AF]',
            ].join(' ')}
            style={tab === t.key ? { backgroundColor: 'var(--toc-theme-accent)' } : {}}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 bg-white/20 text-white text-xs rounded-full px-1.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <RankingRowSkeleton key={i} />)}
        </div>
      ) : currentList.length === 0 ? (
        <EmptyState
          icon={tab === 'incoming' ? '📥' : tab === 'outgoing' ? '📤' : '📋'}
          title={tab === 'incoming' ? 'No Incoming Challenges' : tab === 'outgoing' ? 'No Active Challenges' : 'No History Yet'}
          message={
            tab === 'incoming' ? 'No one has challenged you yet.'
            : tab === 'outgoing' ? "You haven't sent any challenges. Step up!"
            : 'Your completed challenges will appear here.'
          }
          action={tab !== 'history' ? (
            <Button variant="primary" onClick={() => navigate('/rankings?challenge=1')}>
              Find an Opponent
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {currentList.map((c, i) => {
            const isChallenger = c.challenger_id === player?.id;
            const opponentId   = isChallenger ? c.challenged_id : c.challenger_id;
            const opponentName = getPlayerName(opponentId);
            const hoursLeft    = c.hours_left;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <GlassCard
                  className="p-4"
                  hover={c.status === 'scheduled' || c.status === 'in_progress'}
                  onClick={c.status === 'scheduled' || c.status === 'in_progress'
                    ? () => navigate(`/match/${c.id}`)
                    : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-[Barlow] font-semibold text-[#E8E2D6] truncate">
                          {isChallenger ? `→ ${opponentName}` : `← ${opponentName}`}
                        </span>
                        <Badge variant={statusBadge(c.status)}>
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-[#9CA3AF] text-xs font-[Azeret_Mono]">
                        {c.discipline} · Race to {c.race_length}
                      </div>
                      {c.scheduled_at && (
                        <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-1">
                          📅 {formatDateTime(c.scheduled_at)} @ {c.venue}
                        </div>
                      )}
                      {c.match_deadline && c.status === 'scheduled' && (
                        <div className="text-[#F59E0B] text-xs font-[Barlow] mt-1">
                          ⏰ Must be played by {new Date(c.match_deadline).toLocaleDateString()}
                        </div>
                      )}
                      {c.status === 'pending' && hoursLeft > 0 && (
                        <div className={`text-xs font-[Barlow] mt-1 ${hoursLeft <= 24 ? 'text-[#EF4444]' : hoursLeft <= 72 ? 'text-[#F59E0B]' : 'text-[#6B7280]'}`}>
                          {hoursLeft <= 24 ? '⚠️' : '⏰'}{' '}
                          Expires in{' '}
                          {hoursLeft >= 48
                            ? `${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h`
                            : `${hoursLeft}h`}
                        </div>
                      )}
                      {c.status === 'pending' && hoursLeft === 0 && (
                        <div className="text-[#EF4444] text-xs font-[Barlow] mt-1">⚠️ Expiring soon</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {tab === 'incoming' && c.status === 'pending' && (
                        <Button variant="primary" size="sm" onClick={() => setResponding(c)}>
                          Respond
                        </Button>
                      )}
                      {tab === 'outgoing' && c.status === 'pending' && (
                        <Button variant="ghost" size="sm" onClick={() => callFn({ challenge_id: c.id, action: 'cancel' })}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Respond Modal */}
      {responding && (
        <AnimatePresence>
          <RespondModal
            challenge={responding}
            onClose={() => setResponding(null)}
            onSuccess={handleSuccess}
          />
        </AnimatePresence>
      )}
    </div>
  );
}
