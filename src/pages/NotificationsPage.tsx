import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { RankingRowSkeleton } from '../components/Skeleton';
import { formatDistanceToNow } from '../utils/time';
import type { Notification } from '../types/database';

const TYPE_ICONS: Record<string, string> = {
  challenge_received: '⚔️',
  challenge_accepted: '✅',
  challenge_declined: '❌',
  challenge_expired:  '⏰',
  match_scheduled:    '📅',
  match_reminder:     '🎱',
  result_submitted:   '📊',
  result_confirmed:   '🏆',
  result_disputed:    '⚠️',
  rank_changed:       '📈',
};

const VENUES = ['Eagles 4040', 'Valley Hub'] as const;
type Venue = typeof VENUES[number];

function RespondInline({
  challengeId,
  onDone,
}: {
  challengeId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [venue, setVenue] = useState<Venue | ''>('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callFn = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/respond-to-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ success?: boolean; error?: string }>;
  };

  const handleDecline = async () => {
    setLoading(true);
    setError('');
    const json = await callFn({ challenge_id: challengeId, action: 'decline' });
    setLoading(false);
    if (json.error) { setError(json.error); return; }
    setShowDeclineConfirm(false);
    onDone();
  };

  const handleAccept = async () => {
    if (!venue || !date || !time) { setError('Fill in all fields.'); return; }
    setLoading(true);
    setError('');
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const json = await callFn({ challenge_id: challengeId, action: 'accept', venue, scheduled_at: scheduledAt });
    setLoading(false);
    if (json.error) { setError(json.error); return; }
    onDone();
  };

  if (!open) {
    return (
      <div className="mt-3 space-y-2">
        {showDeclineConfirm ? (
          <div className="space-y-3 p-3 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/5">
            <div className="text-sm font-[Barlow] font-semibold text-[#E8E2D6]">
              Decline counts as a forfeit
            </div>
            <ul className="text-xs font-[Barlow] text-[#9CA3AF] space-y-1 list-disc list-inside">
              <li>The challenger gets a win by forfeit and may take your spot if they are lower ranked.</li>
              <li>You get a forfeit on your record and a post-match cooldown.</li>
              <li>No match fee is owed.</li>
              <li>An admin can reverse this only if your rankings and stats have not changed yet.</li>
            </ul>
            {error && <p className="text-[#EF4444] text-xs font-[Barlow]">{error}</p>}
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
          <div className="flex gap-2">
            <Button variant="danger" size="sm" disabled={loading} onClick={() => { setError(''); setShowDeclineConfirm(true); }}>
              Decline (forfeit)
            </Button>
            <Button variant="success" size="sm" onClick={() => { setError(''); setOpen(true); }}>
              Accept ✓
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 bg-[#1A1A1A] rounded-xl p-3">
      <select
        value={venue}
        onChange={(e) => setVenue(e.target.value as Venue)}
        className="w-full px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828]"
      >
        <option value="">Select venue…</option>
        {VENUES.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828]"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828]"
        />
      </div>
      {error && <p className="text-[#EF4444] text-xs font-[Barlow]">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" fullWidth onClick={() => setOpen(false)}>Back</Button>
        <Button variant="success" size="sm" fullWidth loading={loading} onClick={handleAccept}>
          Confirm Accept
        </Button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { player } = useAuthStore();
  const navigate   = useNavigate();
  const qc         = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!player,
  });

  const markRead = async (n: Notification) => {
    if (n.is_read) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
    if (n.reference_type === 'match') navigate(`/match/${n.reference_id}`);
  };

  const markAllRead = async () => {
    if (!player) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('player_id', player.id)
      .eq('is_read', false);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleChallengeActioned = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['challenges'] });
    qc.invalidateQueries({ queryKey: ['matches'] });
    qc.invalidateQueries({ queryKey: ['home-pending-challenges'] });
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen px-4 pt-8 pb-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Bell size={24} className="text-[#C62828]" />
          <h1 className="font-[Bebas_Neue] text-5xl tracking-wide text-[#E8E2D6]">Alerts</h1>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-[#C62828] text-white text-xs font-bold rounded-full px-2 py-0.5 font-[Azeret_Mono]"
            >
              {unread}
            </motion.span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-[#C62828] text-sm font-[Barlow]"
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <RankingRowSkeleton key={i} />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No Notifications"
          message="You're all caught up! Notifications from challenges and matches will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const isChallengeReceived = n.type === 'challenge_received' && !n.is_read && !!n.reference_id;
            const isResultSubmitted   = n.type === 'result_submitted' && !n.is_read && !!n.reference_id;

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <GlassCard
                  className={`p-4 ${!n.is_read ? 'border-[#C62828]/20' : ''}`}
                  hover={!isChallengeReceived}
                  onClick={!isChallengeReceived ? () => markRead(n) : undefined}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{TYPE_ICONS[n.type] ?? '🎱'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-[Barlow] font-semibold text-sm ${n.is_read ? 'text-[#9CA3AF]' : 'text-[#E8E2D6]'}`}>
                        {n.title}
                      </div>
                      <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-0.5 leading-relaxed">{n.body}</div>
                      <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">
                        {formatDistanceToNow(n.created_at)}
                      </div>

                      {/* Inline challenge response */}
                      {isChallengeReceived && (
                        <RespondInline
                          challengeId={n.reference_id!}
                          onDone={handleChallengeActioned}
                        />
                      )}

                      {/* Quick navigate to match for result submitted */}
                      {isResultSubmitted && (
                        <button
                          onClick={() => navigate(`/match/${n.reference_id}`)}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-[Barlow] font-semibold"
                        >
                          Confirm Result →
                        </button>
                      )}
                    </div>
                    {!n.is_read && !isChallengeReceived && !isResultSubmitted && (
                      <div className="w-2 h-2 rounded-full bg-[#C62828] shrink-0 mt-1" />
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
