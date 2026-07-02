import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Users, Swords, Trophy, AlertTriangle, DollarSign,
  Activity, MapPin, CreditCard, RefreshCw, ArrowUp, ArrowDown, Minus,
  Flame, Target, CalendarDays, UserRound,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { CardSkeleton } from '../components/Skeleton';
import { formatDistanceToNow, formatDate } from '../utils/time';
import { formatCents } from '../lib/treasury';
import { paymentMethodLabel, type PaymentMethod } from '../lib/paymentMethods';
import { LEAGUE } from '../config/league';
import {
  useLeagueStats, useLeagueStatsRealtime,
  type LeagueStatsSnapshot, type StatsMatch, type StatsPlayer,
} from '../hooks/useLeagueStats';
import type { Ranking, PlayerSeasonStats } from '../types/database';

const COMPLETED_STATUSES = ['confirmed', 'resolved'];
const OPEN_CHALLENGE_STATUSES = ['pending', 'accepted', 'scheduled', 'in_progress'];
const WEEK_MS = 7 * 86400000;
const DISCIPLINES = LEAGUE.disciplines.map((d) => d.value);
const DISC_EMOJI = Object.fromEntries(LEAGUE.disciplines.map((d) => [d.value, d.emoji]));

const winPct = (wins: number, played: number) => (played > 0 ? Math.round((wins / played) * 100) : 0);

// ─── Small building blocks ───────────────────────────────────────────────────

function StatTile({ Icon, iconBg, iconColor, value, label, sub, valueColor = '#E8E2D6' }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.FC<any>;
  iconBg: string;
  iconColor: string;
  value: React.ReactNode;
  label: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: iconBg }}>
        <Icon size={18} style={{ color: iconColor }} />
      </div>
      <div className="font-[Azeret_Mono] font-bold text-3xl leading-none" style={{ color: valueColor }}>{value}</div>
      <div className="text-[#E8E2D6] text-sm font-[Barlow] font-medium mt-1.5">{label}</div>
      {sub && <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">{sub}</div>}
    </GlassCard>
  );
}

function MiniStat({ value, label, color = '#E8E2D6' }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="text-center bg-[#252525]/60 rounded-xl p-3">
      <div className="font-[Azeret_Mono] font-bold text-xl" style={{ color }}>{value}</div>
      <div className="text-[#6B7280] text-[11px] font-[Barlow] mt-1">{label}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Section({ title, Icon, children, action }: { title: string; Icon: React.FC<any>; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] flex items-center gap-2">
          <Icon size={16} className="text-[var(--toc-theme-accent)]" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </GlassCard>
  );
}

/** Horizontal magnitude bar — single hue, direct-labeled (length carries the value). */
function HBar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[#E8E2D6] text-sm font-[Barlow]">{label}</span>
        <span className="font-[Azeret_Mono] text-sm font-bold text-[#E8E2D6]">
          {value}{sub && <span className="text-[#6B7280] font-normal text-xs ml-1.5">{sub}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#252525] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: 'var(--toc-theme-accent)' }}
        />
      </div>
    </div>
  );
}

/** Win/loss split bar — green/red always paired with the numeric labels beside it. */
function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) return <div className="h-2 rounded-full bg-[#252525]" />;
  return (
    <div className="h-2 rounded-full bg-[#252525] overflow-hidden flex gap-[2px]">
      <div className="h-full bg-[#22C55E]" style={{ width: `${(wins / total) * 100}%` }} />
      <div className="h-full bg-[#EF4444]" style={{ width: `${(losses / total) * 100}%` }} />
    </div>
  );
}

function MovementArrow({ ranking }: { ranking: Ranking }) {
  const prev = ranking.previous_position;
  if (prev == null || prev === ranking.position) return <Minus size={14} className="text-[#6B7280]" />;
  if (prev > ranking.position) {
    return (
      <span className="flex items-center gap-0.5 text-[#22C55E] text-xs font-[Azeret_Mono]">
        <ArrowUp size={13} />{prev - ranking.position}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[#EF4444] text-xs font-[Azeret_Mono]">
      <ArrowDown size={13} />{ranking.position - prev}
    </span>
  );
}

// ─── Derived league aggregates ───────────────────────────────────────────────

function useDerived(data: LeagueStatsSnapshot | undefined, asOf: number) {
  return useMemo(() => {
    if (!data) return null;
    const playerById = new Map(data.players.map((p) => [p.id, p]));
    const nameOf = (id: string | null | undefined) =>
      (id && playerById.get(id)?.full_name) || 'Unknown';

    const completed = data.matches
      .filter((m) => COMPLETED_STATUSES.includes(m.status))
      .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime());

    // "now" is pinned to the last data refresh so the memo stays pure; the
    // query refetches at least every 30s, so buckets never drift far.
    const now = asOf;
    const completedAt = (m: StatsMatch) => new Date(m.completed_at ?? m.created_at).getTime();
    const last7 = completed.filter((m) => now - completedAt(m) <= WEEK_MS).length;
    const last30 = completed.filter((m) => now - completedAt(m) <= 30 * 86400000).length;

    const racks = completed.reduce((sum, m) => sum + m.player1_score + m.player2_score, 0);
    const avgRace = completed.length > 0
      ? (completed.reduce((s, m) => s + m.race_length, 0) / completed.length).toFixed(1)
      : '—';

    const disputed = data.matches.filter((m) => m.status === 'disputed');
    const openChallenges = data.challenges.filter((c) => OPEN_CHALLENGE_STATUSES.includes(c.status));
    const pendingChallenges = openChallenges.filter((c) => c.status === 'pending').length;

    // Per-discipline / per-venue / payment-method match counts
    const byDiscipline = DISCIPLINES.map((d) => ({
      label: d,
      count: completed.filter((m) => m.discipline === d).length,
      racks: completed.filter((m) => m.discipline === d).reduce((s, m) => s + m.player1_score + m.player2_score, 0),
    }));
    const venueNames = [...new Set([...LEAGUE.sponsorBars, ...completed.map((m) => m.venue).filter(Boolean)])];
    const byVenue = venueNames
      .map((v) => ({ label: v, count: completed.filter((m) => m.venue === v).length }))
      .sort((a, b) => b.count - a.count);
    const payCounts = new Map<PaymentMethod, number>();
    for (const m of completed) {
      for (const method of [m.player1_payment_method, m.player2_payment_method]) {
        if (method) payCounts.set(method, (payCounts.get(method) ?? 0) + 1);
      }
    }
    const byPayment = [...payCounts.entries()]
      .map(([method, count]) => ({ label: paymentMethodLabel(method), count }))
      .sort((a, b) => b.count - a.count);

    // Weekly trend — last 8 seven-day windows, oldest first
    const weekly: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = now - i * WEEK_MS;
      const start = end - WEEK_MS;
      weekly.push({
        label: new Date(start).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        count: completed.filter((m) => completedAt(m) > start && completedAt(m) <= end).length,
      });
    }

    const statsFor = (id: string) => data.seasonStats.find((s) => s.player_id === id) ?? null;
    const top5 = data.rankings.slice(0, 5).map((r) => ({
      ranking: r,
      player: playerById.get(r.player_id) ?? null,
      stats: statsFor(r.player_id),
    })).filter((r) => r.player);

    // League leaders
    const withStats = data.seasonStats
      .filter((s) => playerById.get(s.player_id)?.is_active)
      .map((s) => ({ stats: s, player: playerById.get(s.player_id)! }));
    const leaders = {
      mostMatches: [...withStats].sort((a, b) => b.stats.matches_played - a.stats.matches_played)[0] ?? null,
      bestWinPct: [...withStats]
        .filter((x) => x.stats.matches_played >= 3)
        .sort((a, b) => winPct(b.stats.wins, b.stats.matches_played) - winPct(a.stats.wins, a.stats.matches_played))[0] ?? null,
      bestStreak: [...withStats].sort((a, b) => b.stats.best_streak - a.stats.best_streak)[0] ?? null,
      mostChallenges: [...withStats].sort((a, b) => b.stats.challenges_issued - a.stats.challenges_issued)[0] ?? null,
    };

    return {
      playerById, nameOf, completed, disputed, openChallenges, pendingChallenges,
      last7, last30, racks, avgRace, byDiscipline, byVenue, byPayment, weekly, top5, leaders,
      activePlayers: data.players.filter((p) => p.is_active).length,
      claimedPlayers: data.players.filter((p) => p.profile_id).length,
      totalPlayers: data.players.length,
    };
  }, [data, asOf]);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminStatsPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  useLeagueStatsRealtime();
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useLeagueStats();
  const derived = useDerived(data, dataUpdatedAt);

  if (!profile) return null;
  if (!['admin', 'super_admin'].includes(profile.role)) {
    navigate('/', { replace: true });
    return null;
  }

  if (isLoading || !data || !derived) {
    return (
      <div className="min-h-screen px-4 pt-8 space-y-4 max-w-5xl mx-auto">
        <CardSkeleton lines={2} />
        <div className="grid grid-cols-2 gap-3">
          <CardSkeleton lines={3} /><CardSkeleton lines={3} />
          <CardSkeleton lines={3} /><CardSkeleton lines={3} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen px-4 pt-8 max-w-5xl mx-auto text-center py-16">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="font-[Bebas_Neue] text-2xl text-[#E8E2D6]">Could not load league stats</div>
        <button onClick={() => refetch()} className="mt-4 px-4 py-2 rounded-lg bg-[var(--toc-theme-accent)] text-white text-sm font-[Barlow]">
          Try again
        </button>
      </div>
    );
  }

  const treasuryBalance = data.treasury.summary.balance_cents;
  const maxWeekly = Math.max(...derived.weekly.map((w) => w.count), 1);
  const maxDiscipline = Math.max(...derived.byDiscipline.map((d) => d.count), 1);
  const maxVenue = Math.max(...derived.byVenue.map((v) => v.count), 1);
  const maxPayment = Math.max(...derived.byPayment.map((p) => p.count), 1);

  // Dropdown options: ranked players in list order, then any unranked ones
  const rankedIds = new Set(data.rankings.map((r) => r.player_id));
  const rankedOptions = data.rankings
    .map((r) => ({ r, p: derived.playerById.get(r.player_id) }))
    .filter((x): x is { r: Ranking; p: StatsPlayer } => !!x.p);
  const unrankedOptions = data.players
    .filter((p) => !rankedIds.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="min-h-screen px-4 pt-4 pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-[#9CA3AF] p-2 -ml-2 mb-3 font-[Barlow] text-sm">
        <ChevronLeft size={18} /> Admin
      </button>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-[Bebas_Neue] text-5xl text-[#E8E2D6] leading-none">League Stats</h1>
          <p className="text-[#9CA3AF] text-sm font-[Barlow] mt-1">{LEAGUE.name} — {LEAGUE.tagline}</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-[#22C55E] text-xs font-[Barlow] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
            </span>
            LIVE
          </span>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-[#252525] border border-[#333] text-[#9CA3AF] hover:text-[#E8E2D6] transition-colors"
            aria-label="Refresh stats"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <p className="text-[#6B7280] text-xs font-[Barlow] mb-5">
        Updated {formatDistanceToNow(new Date(dataUpdatedAt).toISOString())} · refreshes automatically
      </p>

      {/* Disputed alert */}
      {derived.disputed.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-3.5 flex items-center gap-3">
            <AlertTriangle size={18} className="text-[#EF4444] shrink-0" />
            <span className="text-[#EF4444] text-sm font-[Barlow] font-semibold flex-1">
              {derived.disputed.length} disputed {derived.disputed.length === 1 ? 'match requires' : 'matches require'} admin review
            </span>
            <button onClick={() => navigate('/admin')} className="text-[#E8E2D6] text-sm font-[Barlow] underline underline-offset-2 shrink-0">
              Review
            </button>
          </div>
        </motion.div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatTile Icon={Users} iconBg="rgba(198,40,40,0.18)" iconColor="var(--toc-theme-accent)"
          value={derived.activePlayers} label="Active Players" sub={`${derived.totalPlayers} total · ${derived.claimedPlayers} claimed`} />
        <StatTile Icon={Swords} iconBg="rgba(59,130,246,0.15)" iconColor="#60A5FA"
          value={derived.openChallenges.length} label="Open Challenges" sub={`${derived.pendingChallenges} pending / ${derived.openChallenges.length - derived.pendingChallenges} in play`} />
        <StatTile Icon={Trophy} iconBg="rgba(34,197,94,0.15)" iconColor="#22C55E"
          value={derived.completed.length} label="Matches Played" sub="all time" />
        <StatTile Icon={AlertTriangle} iconBg="rgba(239,68,68,0.15)" iconColor="#EF4444"
          value={derived.disputed.length} label="Disputed" sub={derived.disputed.length > 0 ? 'needs review' : 'all clear'}
          valueColor={derived.disputed.length > 0 ? '#EF4444' : '#E8E2D6'} />
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        <MiniStat value={derived.last7} label="Last 7 Days" />
        <MiniStat value={derived.last30} label="Last 30 Days" />
        <MiniStat value={derived.racks} label="Racks Played" />
        <MiniStat value={derived.avgRace} label="Avg Race" />
        <MiniStat value={formatCents(Math.abs(treasuryBalance))} label="Treasury" color={treasuryBalance >= 0 ? '#22C55E' : '#EF4444'} />
        <MiniStat value={formatCents(data.treasury.summary.total_credit_cents)} label="Collected" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Weekly trend */}
        <Section title="Matches per Week" Icon={CalendarDays}>
          {derived.completed.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-6">No completed matches yet.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-28 pt-4">
              {derived.weekly.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`Week of ${w.label}: ${w.count} matches`}>
                  <span className="text-[10px] font-[Azeret_Mono] text-[#9CA3AF] mb-1">{w.count > 0 ? w.count : ''}</span>
                  <div
                    className="w-full rounded-t-[4px] transition-all duration-500"
                    style={{
                      height: `${Math.max((w.count / maxWeekly) * 100, w.count > 0 ? 6 : 2)}%`,
                      backgroundColor: w.count > 0 ? 'var(--toc-theme-accent)' : '#252525',
                    }}
                  />
                  <span className="text-[9px] font-[Barlow] text-[#6B7280] mt-1">{w.label}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Top 5 rankings */}
        <Section title="Top 5 Rankings" Icon={Trophy}
          action={<button onClick={() => navigate('/rankings')} className="text-[#9CA3AF] text-xs font-[Barlow] flex items-center gap-0.5">View all <ChevronRight size={12} /></button>}>
          {derived.top5.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-6">No rankings yet.</p>
          ) : (
            <div className="space-y-2">
              {derived.top5.map(({ ranking, player, stats }) => (
                <button key={ranking.id} onClick={() => setSelectedPlayerId(player!.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#252525]/50 hover:bg-[#252525] transition-colors text-left">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-[Azeret_Mono] font-bold text-sm shrink-0"
                    style={{ backgroundColor: 'var(--toc-theme-accent)', color: '#fff' }}>
                    {ranking.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#E8E2D6] text-sm font-[Barlow] font-semibold truncate">{player!.full_name}</div>
                    <div className="text-[#6B7280] text-xs font-[Barlow]">
                      {stats ? `${stats.wins}W – ${stats.losses}L · ${winPct(stats.wins, stats.matches_played)}%` : 'No matches yet'}
                    </div>
                  </div>
                  {player!.preferred_discipline && <Badge variant="default">{player!.preferred_discipline}</Badge>}
                  <MovementArrow ranking={ranking} />
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Discipline breakdown */}
        <Section title="Matches by Discipline" Icon={Target}>
          {derived.byDiscipline.map((d) => (
            <HBar key={d.label} label={`${DISC_EMOJI[d.label] ?? ''} ${d.label}`} value={d.count} max={maxDiscipline}
              sub={d.count > 0 ? `${d.racks} racks` : undefined} />
          ))}
        </Section>

        {/* Venue breakdown */}
        <Section title="Matches by Venue" Icon={MapPin}>
          {derived.byVenue.map((v) => (
            <HBar key={v.label} label={v.label} value={v.count} max={maxVenue} />
          ))}
        </Section>

        {/* Payment methods */}
        <Section title="Payment Methods" Icon={CreditCard}>
          {derived.byPayment.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">No match payments recorded yet.</p>
          ) : (
            derived.byPayment.map((p) => (
              <HBar key={p.label} label={p.label} value={p.count} max={maxPayment} sub="player payments" />
            ))
          )}
          <p className="text-[#6B7280] text-[11px] font-[Barlow] mt-2">
            Match fee is ${LEAGUE.matchFeePerPlayer} per player. Treasury balance: {formatCents(treasuryBalance)}.
          </p>
        </Section>

        {/* League leaders */}
        <Section title="League Leaders" Icon={Flame}>
          <div className="space-y-2.5">
            {([
              { label: 'Most matches', entry: derived.leaders.mostMatches, fmt: (s: PlayerSeasonStats) => `${s.matches_played} played` },
              { label: 'Best win rate (3+ matches)', entry: derived.leaders.bestWinPct, fmt: (s: PlayerSeasonStats) => `${winPct(s.wins, s.matches_played)}% · ${s.wins}W–${s.losses}L` },
              { label: 'Best streak', entry: derived.leaders.bestStreak, fmt: (s: PlayerSeasonStats) => `${s.best_streak} in a row` },
              { label: 'Most challenges issued', entry: derived.leaders.mostChallenges, fmt: (s: PlayerSeasonStats) => `${s.challenges_issued} issued` },
            ]).map(({ label, entry, fmt }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[#6B7280] text-[11px] font-[Barlow] uppercase">{label}</div>
                  <div className="text-[#E8E2D6] text-sm font-[Barlow] font-semibold truncate">
                    {entry && (entry.stats.matches_played > 0 || label.includes('challenges')) ? entry.player.full_name : '—'}
                  </div>
                </div>
                <div className="font-[Azeret_Mono] text-xs text-[#9CA3AF] shrink-0 ml-3">
                  {entry && (entry.stats.matches_played > 0 || label.includes('challenges')) ? fmt(entry.stats) : ''}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Recent activity */}
        <Section title="Recent Activity" Icon={Activity}
          action={<button onClick={() => navigate('/activity')} className="text-[#9CA3AF] text-xs font-[Barlow] flex items-center gap-0.5">View all <ChevronRight size={12} /></button>}>
          {data.activity.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">No activity yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.activity.slice(0, 8).map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: 'var(--toc-theme-accent)' }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[#E8E2D6] text-sm font-[Barlow] leading-snug">{a.headline}</div>
                    {a.detail && <div className="text-[#6B7280] text-xs font-[Barlow] leading-snug">{a.detail}</div>}
                  </div>
                  <span className="text-[#6B7280] text-[11px] font-[Barlow] shrink-0">{formatDistanceToNow(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Treasury recent entries */}
        <Section title="Treasury" Icon={DollarSign}
          action={<button onClick={() => navigate('/admin')} className="text-[#9CA3AF] text-xs font-[Barlow] flex items-center gap-0.5">Manage <ChevronRight size={12} /></button>}>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-[Azeret_Mono] font-bold text-3xl" style={{ color: treasuryBalance >= 0 ? '#22C55E' : '#EF4444' }}>
              {formatCents(Math.abs(treasuryBalance))}
            </span>
            <span className="text-[#6B7280] text-xs font-[Barlow]">
              {treasuryBalance < 0 ? 'deficit · ' : ''}{data.treasury.summary.entry_count} entries
            </span>
          </div>
          <div className="space-y-1.5">
            {data.treasury.entries.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[#E8E2D6] text-sm font-[Barlow] truncate">{e.description}</div>
                  <div className="text-[#6B7280] text-[11px] font-[Barlow]">
                    {e.player_id ? `${derived.nameOf(e.player_id)} · ` : ''}{formatDistanceToNow(e.created_at)}
                  </div>
                </div>
                <span className="font-[Azeret_Mono] text-sm font-bold shrink-0"
                  style={{ color: e.effect_cents > 0 ? '#22C55E' : e.effect_cents < 0 ? '#EF4444' : '#9CA3AF' }}>
                  {e.effect_cents > 0 ? '+' : e.effect_cents < 0 ? '−' : ''}{formatCents(Math.abs(e.effect_cents))}
                </span>
              </div>
            ))}
            {data.treasury.entries.length === 0 && (
              <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-2">No ledger entries yet.</p>
            )}
          </div>
        </Section>
      </div>

      {/* ── Player drill-down ── */}
      <div className="mt-6">
        <h2 className="font-[Bebas_Neue] text-3xl text-[#E8E2D6] mb-1 flex items-center gap-2">
          <UserRound size={20} className="text-[var(--toc-theme-accent)]" /> Player Deep Dive
        </h2>
        <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-3">
          Pick a player to see their full record — disciplines, venues, payments, opponents.
        </p>
        <select
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
          className="w-full px-3 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[var(--toc-theme-accent)] appearance-none"
        >
          <option value="">Select a player…</option>
          {rankedOptions.map(({ r, p }) => (
            <option key={p.id} value={p.id}>
              #{r.position} — {p.full_name}{p.is_active ? '' : ' (inactive)'}
            </option>
          ))}
          {unrankedOptions.length > 0 && (
            <optgroup label="Unranked">
              {unrankedOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}{p.is_active ? '' : ' (inactive)'}</option>
              ))}
            </optgroup>
          )}
        </select>

        {selectedPlayerId && (
          <PlayerDeepDive key={selectedPlayerId} snapshot={data} playerId={selectedPlayerId} nameOf={derived.nameOf} />
        )}
      </div>
    </div>
  );
}

// ─── Player deep dive ────────────────────────────────────────────────────────

function PlayerDeepDive({ snapshot, playerId, nameOf }: {
  snapshot: LeagueStatsSnapshot;
  playerId: string;
  nameOf: (id: string | null | undefined) => string;
}) {
  const navigate = useNavigate();

  const d = useMemo(() => {
    const player = snapshot.players.find((p) => p.id === playerId) ?? null;
    if (!player) return null;
    const ranking = snapshot.rankings.find((r) => r.player_id === playerId) ?? null;
    const stats = snapshot.seasonStats.find((s) => s.player_id === playerId) ?? null;
    const discStats = snapshot.disciplineStats.filter((s) => s.player_id === playerId);
    const fargo = snapshot.metrics.find((m) => m.player_id === playerId)?.fargo_rating ?? null;

    const matches = snapshot.matches
      .filter((m) => COMPLETED_STATUSES.includes(m.status) && (m.player1_id === playerId || m.player2_id === playerId))
      .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime());

    const venueRecord = new Map<string, { played: number; wins: number; losses: number }>();
    const oppRecord = new Map<string, { played: number; wins: number; losses: number }>();
    const payUsage = new Map<PaymentMethod, number>();
    for (const m of matches) {
      const won = m.winner_id === playerId;
      const oppId = m.player1_id === playerId ? m.player2_id : m.player1_id;
      const myPay = m.player1_id === playerId ? m.player1_payment_method : m.player2_payment_method;
      if (m.venue) {
        const v = venueRecord.get(m.venue) ?? { played: 0, wins: 0, losses: 0 };
        v.played++;
        if (won) v.wins++; else v.losses++;
        venueRecord.set(m.venue, v);
      }
      const o = oppRecord.get(oppId) ?? { played: 0, wins: 0, losses: 0 };
      o.played++;
      if (won) o.wins++; else o.losses++;
      oppRecord.set(oppId, o);
      if (myPay) payUsage.set(myPay, (payUsage.get(myPay) ?? 0) + 1);
    }

    const ledger = snapshot.treasury.entries.filter((e) => e.player_id === playerId);
    const totalPaidIn = ledger.filter((e) => e.effect_cents > 0).reduce((s, e) => s + e.effect_cents, 0);

    const challengesIssued = snapshot.challenges.filter((c) => c.challenger_id === playerId).length;
    const challengesReceived = snapshot.challenges.filter((c) => c.challenged_id === playerId).length;

    return {
      player, ranking, stats, discStats, fargo, matches,
      venues: [...venueRecord.entries()].sort((a, b) => b[1].played - a[1].played),
      opponents: [...oppRecord.entries()].sort((a, b) => b[1].played - a[1].played).slice(0, 5),
      payUsage: [...payUsage.entries()].sort((a, b) => b[1] - a[1]),
      ledger, totalPaidIn, challengesIssued, challengesReceived,
    };
  }, [snapshot, playerId]);

  if (!d) return null;
  const { player, ranking, stats } = d;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-4 space-y-4">
      {/* Hero */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <Avatar player={player} size={52} />
          <div className="flex-1 min-w-0">
            <div className="text-[#E8E2D6] font-[Bebas_Neue] text-2xl leading-none truncate">{player.full_name}</div>
            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
              {ranking && <Badge variant="gold">Rank #{ranking.position}</Badge>}
              {d.fargo != null && <Badge variant="default">FR {d.fargo}</Badge>}
              <Badge variant={player.is_active ? 'success' : 'loss'}>{player.is_active ? 'Active' : 'Inactive'}</Badge>
              <Badge variant={player.profile_id ? 'info' : 'default'}>{player.profile_id ? 'Claimed' : 'Unclaimed'}</Badge>
            </div>
          </div>
          <button onClick={() => navigate(`/player/${player.id}`)}
            className="text-[#9CA3AF] text-xs font-[Barlow] flex items-center gap-0.5 shrink-0">
            Profile <ChevronRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-4 pt-3 border-t border-white/5">
          {[
            { label: 'Wins', value: stats?.wins ?? 0, color: '#22C55E' },
            { label: 'Losses', value: stats?.losses ?? 0, color: '#EF4444' },
            { label: 'Win %', value: `${winPct(stats?.wins ?? 0, stats?.matches_played ?? 0)}%`, color: '#E8E2D6' },
            { label: 'Matches', value: stats?.matches_played ?? 0, color: '#E8E2D6' },
            { label: 'Streak', value: stats?.current_streak ?? 0, color: (stats?.current_streak ?? 0) > 0 ? '#22C55E' : '#9CA3AF' },
            { label: 'Best Streak', value: stats?.best_streak ?? 0, color: '#9CA3AF' },
            { label: 'Best Rank', value: stats?.best_rank_achieved ? `#${stats.best_rank_achieved}` : '—', color: '#D4AF37' },
            { label: 'Forfeits', value: stats?.forfeits ?? 0, color: '#D4AF37' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-[Azeret_Mono] font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[#6B7280] text-[10px] font-[Barlow] uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <MiniStat value={d.challengesIssued} label="Challenges Issued" />
          <MiniStat value={d.challengesReceived} label="Challenges Received" />
          <MiniStat value={stats?.challenger_wins ?? 0} label="Wins as Challenger" />
          <MiniStat value={stats?.defender_wins ?? 0} label="Wins as Defender" />
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Disciplines */}
        <Section title="By Discipline" Icon={Target}>
          {d.discStats.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">No discipline stats yet.</p>
          ) : (
            <div className="space-y-3">
              {DISCIPLINES.map((disc) => {
                const s = d.discStats.find((x) => x.discipline === disc);
                if (!s || s.matches_played === 0) return null;
                return (
                  <div key={disc}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[#E8E2D6] text-sm font-[Barlow] font-medium">{DISC_EMOJI[disc]} {disc}</span>
                      <span className="text-xs font-[Azeret_Mono]">
                        <span className="text-[#22C55E]">{s.wins}W</span>
                        <span className="text-[#6B7280]"> – </span>
                        <span className="text-[#EF4444]">{s.losses}L</span>
                        <span className="text-[#9CA3AF]"> · {winPct(s.wins, s.matches_played)}%</span>
                      </span>
                    </div>
                    <WinLossBar wins={s.wins} losses={s.losses} />
                    <div className="text-[#6B7280] text-[11px] font-[Barlow] mt-1">
                      {s.matches_played} matches · best streak {s.best_streak} · avg race {(s.total_race_length / s.matches_played).toFixed(1)}
                      {s.forfeits > 0 ? ` · ${s.forfeits} forfeits` : ''}
                    </div>
                  </div>
                );
              })}
              {d.discStats.every((s) => s.matches_played === 0) && (
                <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-2">No matches played yet.</p>
              )}
            </div>
          )}
        </Section>

        {/* Venues */}
        <Section title="By Venue" Icon={MapPin}>
          {d.venues.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">No venue history yet.</p>
          ) : (
            <div className="space-y-3">
              {d.venues.map(([venue, rec]) => (
                <div key={venue}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[#E8E2D6] text-sm font-[Barlow] font-medium">{venue}</span>
                    <span className="text-xs font-[Azeret_Mono]">
                      <span className="text-[#22C55E]">{rec.wins}W</span>
                      <span className="text-[#6B7280]"> – </span>
                      <span className="text-[#EF4444]">{rec.losses}L</span>
                      <span className="text-[#9CA3AF]"> · {rec.played} played</span>
                    </span>
                  </div>
                  <WinLossBar wins={rec.wins} losses={rec.losses} />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payments */}
        <Section title="Payments" Icon={DollarSign}>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-[Azeret_Mono] font-bold text-2xl text-[#22C55E]">{formatCents(d.totalPaidIn)}</span>
            <span className="text-[#6B7280] text-xs font-[Barlow]">paid into treasury · {d.ledger.length} entries</span>
          </div>
          {d.payUsage.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {d.payUsage.map(([method, count]) => (
                <Badge key={method} variant="default">{paymentMethodLabel(method)} × {count}</Badge>
              ))}
            </div>
          )}
          {d.ledger.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow]">No ledger entries linked to this player yet.</p>
          ) : (
            <div className="space-y-1.5">
              {d.ledger.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[#E8E2D6] text-sm font-[Barlow] truncate">{e.description}</div>
                    <div className="text-[#6B7280] text-[11px] font-[Barlow]">{formatDate(e.created_at)}</div>
                  </div>
                  <span className="font-[Azeret_Mono] text-sm font-bold shrink-0"
                    style={{ color: e.effect_cents > 0 ? '#22C55E' : e.effect_cents < 0 ? '#EF4444' : '#9CA3AF' }}>
                    {e.effect_cents > 0 ? '+' : e.effect_cents < 0 ? '−' : ''}{formatCents(Math.abs(e.effect_cents))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Opponents */}
        <Section title="Top Opponents" Icon={Swords}>
          {d.opponents.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">No head-to-head history yet.</p>
          ) : (
            <div className="space-y-2">
              {d.opponents.map(([oppId, rec]) => (
                <div key={oppId} className="flex items-center justify-between gap-3">
                  <span className="text-[#E8E2D6] text-sm font-[Barlow] font-medium truncate">{nameOf(oppId)}</span>
                  <span className="text-xs font-[Azeret_Mono] shrink-0">
                    <span className="text-[#22C55E]">{rec.wins}W</span>
                    <span className="text-[#6B7280]"> – </span>
                    <span className="text-[#EF4444]">{rec.losses}L</span>
                    <span className="text-[#9CA3AF]"> · {rec.played} played</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Recent matches */}
      <Section title="Recent Matches" Icon={Trophy}>
        {d.matches.length === 0 ? (
          <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-4">No completed matches yet.</p>
        ) : (
          <div className="space-y-2">
            {d.matches.slice(0, 8).map((m) => {
              const won = m.winner_id === playerId;
              const oppId = m.player1_id === playerId ? m.player2_id : m.player1_id;
              const myScore = m.player1_id === playerId ? m.player1_score : m.player2_score;
              const theirScore = m.player1_id === playerId ? m.player2_score : m.player1_score;
              return (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#252525]/50">
                  <div className={`w-1 h-9 rounded-full shrink-0 ${won ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-[Barlow] font-medium text-[#E8E2D6] truncate">
                      <span style={{ color: won ? '#22C55E' : '#EF4444' }}>{won ? 'W' : 'L'}</span> vs {nameOf(oppId)}
                    </div>
                    <div className="text-[11px] text-[#6B7280] font-[Barlow] truncate">
                      {m.discipline} · {m.venue || 'No venue'} · {formatDate(m.completed_at ?? m.scheduled_at)}
                    </div>
                  </div>
                  <div className="font-[Azeret_Mono] font-bold text-base text-[#E8E2D6] shrink-0">
                    <span style={{ color: won ? '#22C55E' : '#EF4444' }}>{myScore}</span>–{theirScore}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </motion.div>
  );
}
