import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, Trophy, Swords, CircleDot } from 'lucide-react';
import { useRankings } from '../hooks/useRankings';
import { useLeagueStats, type BreakdownRow } from '../hooks/useLeagueStats';
import { GlassCard } from '../components/GlassCard';
import { EKGLine } from '../components/EKGLine';
import { Avatar } from '../components/Avatar';
import { CardSkeleton } from '../components/Skeleton';
import { QueryError } from '../components/QueryError';
import { LEAGUE } from '../config/league';
import type { RankedPlayer } from '../types/database';

const MIN_MATCHES_FOR_WIN_PCT = 3;

interface LeaderRow {
  label: string;
  rp: RankedPlayer;
  value: string;
}

// Each leader category surfaces at most one player; categories with no
// qualifying player (e.g. nobody has a streak yet) are omitted.
function buildLeaders(rankings: RankedPlayer[]): LeaderRow[] {
  const withStats = rankings.filter((r) => r.stats);
  const top = (
    score: (rp: RankedPlayer) => number,
    format: (rp: RankedPlayer) => string,
    label: string
  ): LeaderRow | null => {
    let best: RankedPlayer | null = null;
    for (const rp of withStats) {
      if (score(rp) <= 0) continue;
      if (!best || score(rp) > score(best)) best = rp;
    }
    return best ? { label, rp: best, value: format(best) } : null;
  };

  const winPct = (rp: RankedPlayer) =>
    rp.stats!.matches_played >= MIN_MATCHES_FOR_WIN_PCT
      ? rp.stats!.wins / rp.stats!.matches_played
      : 0;

  return [
    top((rp) => rp.stats!.wins, (rp) => `${rp.stats!.wins} wins`, 'Most wins'),
    top(winPct, (rp) => `${Math.round(winPct(rp) * 100)}% (${rp.stats!.wins}-${rp.stats!.losses})`, 'Best win rate'),
    top((rp) => rp.stats!.current_streak, (rp) => `${rp.stats!.current_streak} in a row`, 'Hot streak'),
    top((rp) => rp.stats!.matches_played, (rp) => `${rp.stats!.matches_played} played`, 'Most matches'),
  ].filter((row): row is LeaderRow => row !== null);
}

// Horizontal single-hue bars: the accent fill carries magnitude, the value
// sits in ink beside the name so no legend or axis is needed. Labels ride
// above the bars so long venue names never truncate.
function BreakdownBars({ rows }: { rows: BreakdownRow[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-[Barlow] text-[#9CA3AF]">{row.name}</span>
            <span className="text-xs font-[Azeret_Mono] text-[#E8E2D6]">{row.count}</span>
          </div>
          <div className="h-[14px] rounded-r-[4px] bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-r-[4px] transition-[width] duration-500"
              style={{
                width: row.count > 0 ? `${Math.max((row.count / max) * 100, 4)}%` : 0,
                backgroundColor: 'var(--toc-theme-accent)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-[#9CA3AF]">
        {icon}
        <span className="text-xs font-[Barlow]">{label}</span>
      </div>
      <div className="font-[Azeret_Mono] font-bold text-2xl text-[#E8E2D6] mt-1.5">
        {value.toLocaleString()}
      </div>
    </GlassCard>
  );
}

export default function StatsPage() {
  const navigate = useNavigate();
  const rankingsQuery = useRankings();
  const statsQuery = useLeagueStats();

  const rankings = rankingsQuery.data ?? [];
  const stats = statsQuery.data;
  const isLoading = rankingsQuery.isLoading || statsQuery.isLoading;
  const isError = rankingsQuery.isError || statsQuery.isError;

  const leaders = buildLeaders(rankings);

  return (
    <div className="min-h-screen px-4 pt-8 pb-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1
          className="font-[Bebas_Neue] text-6xl tracking-wide"
          style={{ textShadow: '0 0 30px var(--toc-theme-glow)' }}
        >
          League Stats
        </h1>
        <EKGLine className="mx-auto mt-1" />
        <p className="text-[#9CA3AF] text-xs font-[Barlow] mt-2">
          {LEAGUE.name} · Season to date
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <CardSkeleton lines={2} />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError || !stats ? (
        <QueryError
          onRetry={() => {
            rankingsQuery.refetch();
            statsQuery.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* KPI tiles */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-2 gap-3"
          >
            <StatTile icon={<Users size={14} />}     label="Active players"  value={rankings.length} />
            <StatTile icon={<Trophy size={14} />}    label="Matches played"  value={stats.matchesPlayed} />
            <StatTile icon={<Swords size={14} />}    label="Open challenges" value={stats.openChallenges} />
            <StatTile icon={<CircleDot size={14} />} label="Racks played"    value={stats.racksPlayed} />
          </motion.div>

          {/* Matches by discipline */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
            <GlassCard className="p-4">
              <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">Matches by Discipline</h2>
              <BreakdownBars rows={stats.byDiscipline} />
            </GlassCard>
          </motion.div>

          {/* Matches by venue */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }}>
            <GlassCard className="p-4">
              <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">Matches by Venue</h2>
              <BreakdownBars rows={stats.byVenue} />
            </GlassCard>
          </motion.div>

          {/* Leaders */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <GlassCard className="p-4">
              <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">League Leaders</h2>
              {leaders.length === 0 ? (
                <p className="text-[#6B7280] text-sm font-[Barlow] py-2 text-center">
                  No completed matches yet — leaders show up after the first results.
                </p>
              ) : (
                <div className="space-y-1">
                  {leaders.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 cursor-pointer"
                      onClick={() => navigate(`/player/${row.rp.player.id}`)}
                    >
                      <span className="w-24 shrink-0 text-xs font-[Barlow] text-[#9CA3AF]">
                        {row.label}
                      </span>
                      <Avatar player={row.rp.player} size={28} />
                      <span className="flex-1 min-w-0 truncate text-sm font-[Barlow] font-semibold text-[#E8E2D6]">
                        {row.rp.player.full_name}
                      </span>
                      <span className="shrink-0 text-xs font-[Azeret_Mono] text-[#E8E2D6]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
}
