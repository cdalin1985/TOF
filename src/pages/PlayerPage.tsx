import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Swords } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useRankings } from '../hooks/useRankings';
import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { InactivePlayerBanner } from '../components/InactivePlayerBanner';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { CardSkeleton } from '../components/Skeleton';
import { formatDate } from '../utils/time';
import type { Match, PlayerDisciplineStats } from '../types/database';
import { LEAGUE, type LeagueDiscipline } from '../config/league';

type Discipline = LeagueDiscipline;
const DISCIPLINES = LEAGUE.disciplines.map((d) => d.value) as Discipline[];
const DISC_EMOJI: Record<Discipline, string> = {
  '8 Ball': '🎱',
  '9 Ball': '🔵',
  '10 Ball': '🟡',
  Saratoga: '🎯',
};
type HistoryFilter = 'All' | 'Wins' | 'Losses' | Discipline;

function canChallenge(myPos: number, theirPos: number): boolean {
  if (myPos === theirPos) return false;
  if (myPos === 1) return theirPos <= 5; // #1 can challenge down to top-5 to fulfill obligation
  if (theirPos >= myPos) return false; // normally can only challenge up
  if (myPos <= 11) return theirPos === myPos - 1; // Top 11 can only challenge 1 spot up
  if (myPos === 12) return theirPos === 11 || theirPos === 10; // Only #11 and #12 can challenge #10
  return myPos - theirPos <= 2; // spots 12+ can challenge up to 2 spots
}

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { player: myPlayer } = useAuthStore();
  const { data: rankings = [] } = useRankings();
  const [discTab, setDiscTab]         = useState<Discipline>('8 Ball');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('All');

  const targetRanking = rankings.find((r) => r.player.id === id);
  const myRanking     = rankings.find((r) => r.player.id === myPlayer?.id);

  const eligible = myRanking && targetRanking
    ? canChallenge(myRanking.ranking.position, targetRanking.ranking.position)
    : false;

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ['player-matches', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${id},player2_id.eq.${id}`)
        .in('status', ['confirmed', 'resolved'])
        .order('completed_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: disciplineStats = [] } = useQuery<PlayerDisciplineStats[]>({
    queryKey: ['player-discipline-stats', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('player_discipline_stats')
        .select('*')
        .eq('player_id', id);
      return data ?? [];
    },
    enabled: !!id,
  });

  if (!targetRanking) {
    return (
      <div className="min-h-screen px-4 pt-8 space-y-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    );
  }

  const { player, ranking, metrics, stats } = targetRanking;
  const totalMatches = stats?.matches_played ?? 0;
  const overallWinPct = totalMatches > 0 ? Math.round(((stats?.wins ?? 0) / totalMatches) * 100) : 0;

  // Head-to-head vs viewer
  const h2h = matches.filter((m) =>
    (m.player1_id === myPlayer?.id || m.player2_id === myPlayer?.id) &&
    (m.player1_id === id || m.player2_id === id)
  );
  const h2hWins   = h2h.filter((m) => m.winner_id === myPlayer?.id).length;
  const h2hLosses = h2h.filter((m) => m.loser_id === myPlayer?.id).length;

  // Active discipline stats
  const ds = disciplineStats.find((d) => d.discipline === discTab);
  const dsWinPct = ds && ds.matches_played > 0 ? Math.round((ds.wins / ds.matches_played) * 100) : 0;
  const dsAvgRace = ds && ds.matches_played > 0 ? (ds.total_race_length / ds.matches_played).toFixed(1) : '—';

  return (
    <div className="min-h-screen px-4 pt-4 pb-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-[#9CA3AF] font-[Barlow] text-sm mb-4 p-2 -ml-2"
      >
        <ChevronLeft size={18} /> Back
      </button>

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <GlassCard className="p-6 text-center relative overflow-hidden mb-4">
          <div
            className="absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(to bottom right, var(--toc-theme-glow-soft), transparent)' }}
          />
          <Avatar player={player} size={80} className="mx-auto mb-4" />
          {player && !player.is_active && (
            <InactivePlayerBanner playerName={player.full_name} />
          )}
          <h1 className="font-[Bebas_Neue] text-4xl text-[#E8E2D6]">{player.full_name}</h1>
          <div className="flex items-center justify-center flex-wrap gap-2 mt-2">
            <span className="font-[Azeret_Mono] text-2xl font-bold" style={{ color: 'var(--toc-theme-accent)' }}>
              #{ranking.position}
            </span>
            {metrics?.fargo_rating && <Badge variant="default">FR {metrics.fargo_rating}</Badge>}
            {player.preferred_discipline && <Badge variant="default">{player.preferred_discipline}</Badge>}
            {!player.profile_id && <Badge variant="default">Unclaimed</Badge>}
            {stats?.best_rank_achieved && stats.best_rank_achieved < ranking.position && (
              <Badge variant="success">Best #{stats.best_rank_achieved}</Badge>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-6 pt-4 border-t border-white/5">
            {[
              { label: 'Wins',   value: stats?.wins ?? 0,     color: '#22C55E' },
              { label: 'Losses', value: stats?.losses ?? 0,   color: '#EF4444' },
              { label: 'Streak', value: stats?.current_streak ?? 0, color: (stats?.current_streak ?? 0) > 0 ? '#22C55E' : '#9CA3AF' },
              { label: 'Win %',  value: `${overallWinPct}%`,  color: '#E8E2D6' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-[Azeret_Mono] font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[#6B7280] text-[10px] font-[Barlow] mt-1 uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Action button */}
          {eligible && player.is_active && (
            <div className="mt-5 pt-2 border-t border-white/5 flex gap-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/rankings?challenge=1')}
              >
                <Swords size={16} /> Challenge Player
              </Button>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Discipline Stats */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
        <GlassCard className="p-4 mb-4">
          <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">Discipline Stats</h2>
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-0.5">
            {DISCIPLINES.map((d) => (
              <button
                key={d}
                onClick={() => setDiscTab(d)}
                className={[
                  'flex-1 py-2 px-3 rounded-lg text-xs font-[Barlow] font-medium transition-all duration-200 flex items-center justify-center gap-1',
                  discTab === d ? 'text-white' : 'text-[#9CA3AF]',
                ].join(' ')}
                style={discTab === d ? { backgroundColor: 'var(--toc-theme-accent)' } : {}}
              >
                {DISC_EMOJI[d]} {d}
              </button>
            ))}
          </div>
          {ds && ds.matches_played > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Wins',          value: ds.wins,                    color: '#22C55E' },
                { label: 'Losses',        value: ds.losses,                  color: '#EF4444' },
                { label: 'Forfeits',      value: ds.forfeits,                color: '#D4AF37' },
                { label: 'Win %',         value: `${dsWinPct}%`,             color: '#E8E2D6' },
                { label: 'Streak',        value: ds.current_streak,          color: ds.current_streak > 0 ? '#22C55E' : '#9CA3AF' },
                { label: 'Best Streak',   value: ds.best_streak,             color: '#9CA3AF' },
                { label: 'Avg Race',      value: dsAvgRace,                  color: '#9CA3AF' },
                { label: 'Challenger W',  value: ds.challenger_wins,         color: '#22C55E' },
                { label: 'Forfeit W',     value: ds.forfeit_wins,            color: '#D4AF37' },
              ].map((s) => (
                <div key={s.label} className="text-center bg-[#252525]/60 rounded-xl p-3">
                  <div className="font-[Azeret_Mono] font-bold text-2xl" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">
              No {discTab} matches played yet.
            </p>
          )}
        </GlassCard>
      </motion.div>

      {/* Head-to-head */}
      {h2h.length > 0 && myPlayer && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.35 }}>
          <GlassCard className="p-4 mb-4">
            <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">Head to Head</h2>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="font-[Azeret_Mono] text-3xl font-bold text-[#22C55E]">{h2hWins}</div>
                <div className="text-[#6B7280] text-xs font-[Barlow]">Your Wins</div>
              </div>
              <div className="text-[#6B7280] text-lg font-[Bebas_Neue]">VS</div>
              <div className="text-center">
                <div className="font-[Azeret_Mono] text-3xl font-bold text-[#EF4444]">{h2hLosses}</div>
                <div className="text-[#6B7280] text-xs font-[Barlow]">Their Wins</div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Match history */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35 }}>
        <GlassCard className="p-4">
          <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">Match History</h2>
          {matchesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : matches.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] py-4 text-center">No matches yet.</p>
          ) : (
            <>
              {/* Filters */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {(['All', 'Wins', 'Losses', ...DISCIPLINES] as HistoryFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={[
                      'px-3 py-1 rounded-full text-xs font-[Barlow] font-medium whitespace-nowrap transition-all shrink-0',
                      historyFilter === f ? 'text-white' : 'bg-[#1A1A1A] text-[#9CA3AF] border border-[#333]',
                    ].join(' ')}
                    style={historyFilter === f ? { backgroundColor: 'var(--toc-theme-accent)' } : {}}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {matches
                  .filter((m) => {
                    if (historyFilter === 'Wins')   return m.winner_id === id;
                    if (historyFilter === 'Losses') return m.loser_id  === id;
                    if (DISCIPLINES.includes(historyFilter as Discipline))
                      return m.discipline === historyFilter;
                    return true;
                  })
                  .map((m) => {
                    const won = m.winner_id === id;
                    const s1  = m.player1_id === id ? m.player1_score : m.player2_score;
                    const s2  = m.player1_id === id ? m.player2_score : m.player1_score;
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#252525]/50">
                        <div className={`w-1 h-8 rounded-full ${won ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                        <div className="flex-1">
                          <div className="text-sm font-[Barlow] font-medium text-[#E8E2D6]">{m.discipline}</div>
                          <div className="text-xs text-[#6B7280] font-[Barlow]">{formatDate(m.completed_at ?? m.scheduled_at)}</div>
                        </div>
                        <div className="font-[Azeret_Mono] font-bold text-lg text-[#E8E2D6]">
                          <span style={{ color: won ? '#22C55E' : '#EF4444' }}>{s1}</span>–{s2}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
