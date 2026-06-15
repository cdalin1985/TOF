import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Swords } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRankings } from '../hooks/useRankings';
import { useAuthStore } from '../stores/authStore';
import { Avatar } from '../components/Avatar';
import { EKGLine } from '../components/EKGLine';
import { Badge } from '../components/Badge';
import { RankingRowSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import type { RankedPlayer } from '../types/database';

function canChallenge(myPos: number, theirPos: number): boolean {
  if (myPos === theirPos) return false;
  if (theirPos >= myPos) return false; // can only challenge up (no Rank #1 down-obligation in TOF)
  if (myPos <= 11) return theirPos === myPos - 1; // Top 11 can only challenge 1 spot up
  if (myPos === 12) return theirPos === 11 || theirPos === 10; // Only #11 and #12 can challenge #10
  return myPos - theirPos <= 2; // spots 12+ can challenge up to 2 spots
}

function RankCard({
  rp,
  myPosition,
  myPlayerId,
  index,
  challengeMode,
}: {
  rp: RankedPlayer;
  myPosition: number | null;
  myPlayerId: string | null;
  index: number;
  challengeMode: boolean;
}) {
  const navigate = useNavigate();
  const pos       = rp.ranking.position;
  const isMe      = rp.player.id === myPlayerId;
  const isTop3    = pos <= 3;
  const eligible  = myPosition !== null && canChallenge(myPosition, pos) && !isMe;
  const rankChange = rp.ranking.previous_position !== null
    ? rp.ranking.previous_position - pos  // positive = moved up
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.3, ease: 'easeOut' }}
    >
      <div
        className={[
          'glass-card p-3 flex items-center gap-3 cursor-pointer',
          'transition-all duration-200',
          isTop3 ? 'gold-shimmer' : '',
        ].join(' ')}
        style={isMe ? { borderColor: 'var(--toc-theme-border-strong)', boxShadow: '0 0 16px var(--toc-theme-glow-soft)' } : undefined}
        onClick={() => navigate(`/player/${rp.player.id}`)}
      >
        {/* Rank number */}
        <div className="w-8 text-center shrink-0">
          <span
            className="font-[Azeret_Mono] font-bold text-lg"
            style={{
              color: pos === 1 ? '#D4AF37' : pos === 2 ? '#9CA3AF' : pos === 3 ? '#CD7F32' : '#6B7280',
            }}
          >
            {pos}
          </span>
        </div>

        {/* Avatar */}
        <Avatar player={rp.player} size={44} />

        {/* Name + info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-[Barlow] font-semibold text-base truncate text-[#E8E2D6]">
              {rp.player.full_name}
            </span>
            {isMe && <Badge variant="info" className="shrink-0">You</Badge>}
            {!rp.player.profile_id && <Badge variant="default" className="shrink-0 text-[10px]">Unclaimed</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[#6B7280] text-xs font-[Azeret_Mono]">
              {rp.metrics?.fargo_rating ?? 'Unrated'}
              {rp.metrics?.fargo_rating ? ' FR' : ''}
            </span>
            {rp.stats && (
              <span
                className="text-[#6B7280] text-xs font-[Azeret_Mono]"
                title="Wins · Losses · Forfeits"
              >
                {rp.stats.wins}-{rp.stats.losses}-{rp.stats.forfeits}
              </span>
            )}
            {rankChange !== 0 && (
              <span className={`text-xs font-[Azeret_Mono] ${rankChange > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {rankChange > 0 ? `↑${rankChange}` : `↓${Math.abs(rankChange)}`}
              </span>
            )}
          </div>
        </div>

        {/* Challenge button */}
        {(challengeMode || eligible) && eligible && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={(e) => { e.stopPropagation(); navigate(`/challenge/${rp.player.id}`); }}
            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-[Barlow] font-semibold transition-colors min-h-[40px]"
            style={{
              backgroundColor: 'var(--toc-theme-glow-soft)',
              borderColor: 'var(--toc-theme-border-strong)',
              color: 'var(--toc-theme-accent-2)',
            }}
          >
            <Swords size={12} />
            Challenge
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function RankingsPage() {
  const { data: rankings = [], isLoading } = useRankings();
  const { player } = useAuthStore();
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState<'all' | 'near'>('all');
  const [searchParams]        = useSearchParams();
  const challengeMode         = searchParams.get('challenge') === '1';

  const myRanking = rankings.find((r) => r.player.id === player?.id);
  const myPosition = myRanking?.ranking.position ?? null;

  const filtered = useMemo(() => {
    let list = rankings;
    if (search) list = list.filter((r) => r.player.full_name.toLowerCase().includes(search.toLowerCase()));
    if (tab === 'near' && myPosition !== null) {
      list = list.filter((r) =>
        canChallenge(myPosition, r.ranking.position) && r.player.id !== player?.id
      );
    }
    return list;
  }, [rankings, search, tab, myPosition, player?.id]);

  return (
    <div className="min-h-screen px-4 pt-8 pb-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1
          className="font-[Bebas_Neue] text-6xl tracking-wide"
          style={{ textShadow: '0 0 30px var(--toc-theme-glow)' }}
        >
          The List
        </h1>
        <EKGLine className="mx-auto mt-1" />
        <p className="text-[#9CA3AF] text-xs font-[Barlow] mt-2">
          {rankings.length} players · Season Rankings
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[var(--toc-theme-accent)] transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-[#6B7280]" />
          </button>
        )}
      </div>

      {/* Tabs */}
      {player && (
        <div className="flex gap-2 mb-4">
          {(['all', 'near'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-4 py-2 rounded-full text-sm font-[Barlow] font-medium transition-all',
                tab === t
                  ? 'text-white'
                  : 'bg-[#1A1A1A] text-[#9CA3AF] border border-[#333]',
              ].join(' ')}
              style={tab === t ? { backgroundColor: 'var(--toc-theme-accent)' } : {}}
            >
              {t === 'all' ? 'All Players' : 'Can Challenge'}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => <RankingRowSkeleton key={i} />)
          : filtered.length === 0
          ? <EmptyState
              title="No Players Found"
              message={search ? `No one matches "${search}"` : 'The table is empty. Check back soon!'}
              icon="🎱"
            />
          : filtered.map((rp, i) => (
              <RankCard
                key={rp.player.id}
                rp={rp}
                myPosition={myPosition}
                myPlayerId={player?.id ?? null}
                index={i}
                challengeMode={challengeMode}
              />
            ))
        }
      </div>
    </div>
  );
}
