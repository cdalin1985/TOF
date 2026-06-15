import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, TrendingUp, DollarSign, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useRankings } from '../hooks/useRankings';
import { supabase } from '../lib/supabase';
import { PoolBall } from '../components/PoolBall';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { LeagueRulesCard } from '../components/LeagueRulesCard';
import type { ActivityFeedItem, Match, Notification, Challenge } from '../types/database';
import { formatDistanceToNow } from '../utils/time';
import { LEAGUE } from '../config/league';

export default function HomePage() {
  const navigate   = useNavigate();
  const { player, profile } = useAuthStore();
  const { data: rankings = [] } = useRankings();
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('toc-welcome-dismissed') === '1'
  );
  const showWelcome = localStorage.getItem('toc-new-user') === '1' && !welcomeDismissed;

  const dismissWelcome = () => {
    localStorage.removeItem('toc-new-user');
    localStorage.setItem('toc-welcome-dismissed', '1');
    setWelcomeDismissed(true);
  };

  const myRanking = rankings.find((r) => r.player.id === player?.id);

  // Pending incoming challenges
  const { data: pendingChallenges = [] } = useQuery<Challenge[]>({
    queryKey: ['home-pending-challenges', player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('challenged_id', player.id)
        .eq('status', 'pending');
      return data ?? [];
    },
    enabled: !!player,
    refetchInterval: 30000,
  });

  // Active matches needing action
  const { data: actionMatches = [] } = useQuery<Match[]>({
    queryKey: ['home-action-matches', player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .in('status', ['in_progress', 'submitted', 'scheduled']);
      return data ?? [];
    },
    enabled: !!player,
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', 'preview', player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('player_id', player.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!player,
  });

  const { data: feed = [] } = useQuery<ActivityFeedItem[]>({
    queryKey: ['activity-feed', 'preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  // TOF has no Rank #1 down-obligation, so no #1 compliance tracking.

  const myStats = myRanking?.stats;

  if (!player || !myRanking) {
    return (
      <div className="min-h-screen px-4 pt-8 space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const winPct = myStats && myStats.matches_played > 0
    ? Math.round((myStats.wins / myStats.matches_played) * 100)
    : 0;

  // Matches needing MY action (submitted by opponent, waiting on me)
  const needsConfirm = actionMatches.filter((m) => {
    if (m.status !== 'submitted') return false;
    const isP1 = m.player1_id === player.id;
    return isP1 ? !m.player1_submitted : !m.player2_submitted;
  });

  const inProgress = actionMatches.filter((m) => m.status === 'in_progress');
  const scheduled  = actionMatches.filter((m) => m.status === 'scheduled');

  const getOpponentName = (m: Match) => {
    const oppId = m.player1_id === player.id ? m.player2_id : m.player1_id;
    return rankings.find((r) => r.player.id === oppId)?.player.full_name ?? 'Opponent';
  };

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 space-y-4">

      {/* Welcome card for new users */}
      {showWelcome && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-4 border border-[#D4AF37]/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🎱</span>
              <div className="flex-1">
                <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm mb-1">
                  Welcome to {LEAGUE.name}!
                </div>
                <div className="text-[#9CA3AF] text-xs font-[Barlow] space-y-1">
                  <p>You can challenge any player ranked within <span className="text-[#E8E2D6]">1 spot up</span> in the Top 11, or <span className="text-[#E8E2D6]">up to 2 spots up</span> in spots 12+.</p>
                  <p>Accepted matches must be played within <span className="text-[#E8E2D6]">10 days</span>.</p>
                  <p>All callouts and results must be posted to the <span className="text-[var(--toc-theme-accent-2)] font-semibold">{LEAGUE.name} Facebook page</span> with the player tagged.</p>
                </div>
              </div>
              <button onClick={dismissWelcome} className="text-[#6B7280] shrink-0 -mt-0.5">
                <X size={16} />
              </button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Official league rules (collapsible) */}
      <LeagueRulesCard />

      {/* Action banners — pending challenges */}
      {pendingChallenges.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard
            className="p-4 border"
            style={{ borderColor: 'var(--toc-theme-glow)' }}
            hover
            onClick={() => navigate('/challenges')}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">⚔️</span>
              <div className="flex-1">
                <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
                  {pendingChallenges.length === 1
                    ? 'You have been challenged!'
                    : `${pendingChallenges.length} challenges waiting for you`}
                </div>
                <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-0.5">Tap to respond</div>
              </div>
              <span
                className="text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center font-[Azeret_Mono] shrink-0"
                style={{ backgroundColor: 'var(--toc-theme-accent)' }}
              >
                {pendingChallenges.length}
              </span>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Action banners — confirm result */}
      {needsConfirm.map((m) => (
        <motion.div key={m.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard
            className="p-4 border border-[#F59E0B]/40"
            hover
            onClick={() => navigate(`/match/${m.id}`)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">📋</span>
              <div className="flex-1">
                <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
                  Confirm result vs {getOpponentName(m)}
                </div>
                <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-0.5">
                  {getOpponentName(m)} submitted — your confirmation needed
                </div>
              </div>
              <div className="text-[#F59E0B] text-xs font-[Barlow] font-semibold shrink-0">Confirm →</div>
            </div>
          </GlassCard>
        </motion.div>
      ))}

      {/* Action banners — match in progress */}
      {inProgress.map((m) => (
        <motion.div key={m.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard
            className="p-4 border border-[#22C55E]/30"
            hover
            onClick={() => navigate(`/match/${m.id}`)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">🎱</span>
              <div className="flex-1">
                <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
                  Match in progress vs {getOpponentName(m)}
                </div>
                <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-0.5">
                  {m.discipline} · Race to {m.race_length} · {m.venue}
                </div>
              </div>
              <div className="font-[Azeret_Mono] font-bold text-lg text-[#22C55E] shrink-0">
                {m.player1_id === player.id ? m.player1_score : m.player2_score}
                <span className="text-[#6B7280] mx-0.5">–</span>
                <span className="text-[#E8E2D6]">
                  {m.player1_id === player.id ? m.player2_score : m.player1_score}
                </span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      ))}

      {/* Upcoming scheduled match (first one) */}
      {scheduled.length > 0 && needsConfirm.length === 0 && inProgress.length === 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard
            className="p-4 border border-white/10"
            hover
            onClick={() => navigate(`/match/${scheduled[0].id}`)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">📅</span>
              <div className="flex-1">
                <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
                  Upcoming match vs {getOpponentName(scheduled[0])}
                </div>
                <div className="text-[#9CA3AF] text-xs font-[Barlow] mt-0.5">
                  {scheduled[0].discipline} · {scheduled[0].venue}
                </div>
              </div>
              <div className="text-[#9CA3AF] text-xs font-[Barlow] shrink-0">View →</div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Player card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GlassCard className="p-5 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: 'var(--toc-theme-glow-soft)' }}
          />
          <div className="flex items-center gap-4">
            <PoolBall position={myRanking.ranking.position} size={64} />
            <div className="flex-1 min-w-0">
              <div className="font-[Bebas_Neue] text-3xl text-[#E8E2D6] leading-tight truncate">
                {profile?.display_name ?? player.full_name}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-[Azeret_Mono] font-bold text-2xl" style={{ color: 'var(--toc-theme-accent)' }}>
                  #{myRanking.ranking.position}
                </span>
                {myRanking.metrics?.fargo_rating && (
                  <span className="text-[#9CA3AF] font-[Azeret_Mono] text-sm">
                    FR {myRanking.metrics.fargo_rating}
                  </span>
                )}
                {myStats?.best_rank_achieved && myStats.best_rank_achieved < myRanking.ranking.position && (
                  <Badge variant="default">Best #{myStats.best_rank_achieved}</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-5 pt-4 border-t border-white/5">
            {[
              { label: 'Wins',      value: myStats?.wins ?? 0,           color: '#22C55E' },
              { label: 'Losses',    value: myStats?.losses ?? 0,         color: '#EF4444' },
              { label: 'Forfeits',  value: myStats?.forfeits ?? 0,       color: '#D4AF37' },
              { label: 'Win %',     value: `${winPct}%`,                 color: '#E8E2D6' },
              { label: 'Streak',    value: myStats?.current_streak ?? 0, color: (myStats?.current_streak ?? 0) > 0 ? '#22C55E' : '#9CA3AF' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-[Azeret_Mono] font-bold text-lg" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-[#6B7280] text-[10px] font-[Barlow] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate('/rankings?challenge=1')}>
            <Swords size={18} /> Challenge
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/matches')}>
            <Trophy size={18} /> My Matches
          </Button>
        </div>
      </motion.div>

      {/* Notifications preview */}
      {notifications.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6]">
                Alerts <span style={{ color: 'var(--toc-theme-accent)' }}>({notifications.length})</span>
              </h2>
              <button onClick={() => navigate('/notifications')} className="text-xs font-[Barlow]" style={{ color: 'var(--toc-theme-accent)' }}>
                View all →
              </button>
            </div>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: 'var(--toc-theme-accent)' }} />
                  <div>
                    <div className="text-sm font-[Barlow] font-medium text-[#E8E2D6]">{n.title}</div>
                    <div className="text-xs text-[#9CA3AF] font-[Barlow] mt-0.5">{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Quick links — Treasury + Activity */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}>
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-4" hover onClick={() => navigate('/activity')}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-[#9CA3AF]" />
              <span className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">Activity</span>
            </div>
            <div className="text-[#6B7280] text-xs font-[Barlow]">Full league journal</div>
          </GlassCard>
          <GlassCard className="p-4" hover onClick={() => navigate('/treasury')}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-[#9CA3AF]" />
              <span className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">Treasury</span>
            </div>
            <div className="text-[#6B7280] text-xs font-[Barlow]">League funds</div>
          </GlassCard>
        </div>
      </motion.div>

      {/* Activity feed */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#9CA3AF]" />
              <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6]">League Activity</h2>
            </div>
            <button onClick={() => navigate('/activity')} className="text-xs font-[Barlow]" style={{ color: 'var(--toc-theme-accent)' }}>
              View all →
            </button>
          </div>
          {feed.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] py-4 text-center">
              No activity yet. Be the first to challenge someone!
            </p>
          ) : (
            <div className="space-y-3">
              {feed.map((item) => (
                <div key={item.id} className="flex gap-2 items-start py-1.5 border-b border-white/5 last:border-0">
                  <div className="text-lg shrink-0">
                    {item.event_type === 'challenge_issued'   ? '⚔️'
                      : item.event_type === 'challenge_accepted' ? '✅'
                      : item.event_type === 'match_confirmed'    ? '🏆'
                      : item.event_type === 'rank_change'        ? '📈'
                      : item.event_type === 'rank1_penalty'      ? '📉'
                      : '🎱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-[Barlow] text-[#E8E2D6] leading-snug">{item.headline}</div>
                    <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">
                      {formatDistanceToNow(item.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
