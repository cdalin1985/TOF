import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useRankings } from '../hooks/useRankings';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { QueryError } from '../components/QueryError';
import { RankingRowSkeleton } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { formatDateTime } from '../utils/time';
import type { Match } from '../types/database';

type DiscFilter = 'All' | '8 Ball' | '9 Ball' | '10 Ball' | 'Saratoga';

export default function MatchesPage() {
  const { player } = useAuthStore();
  const { data: rankings = [] } = useRankings();
  const navigate = useNavigate();
  const [tab, setTab]   = useState<'active' | 'history'>('active');
  const [disc, setDisc] = useState<DiscFilter>('All');

  const { data: matches = [], isLoading, isError, refetch } = useQuery<Match[]>({
    queryKey: ['matches', player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!player,
  });

  const getPlayerName = (id: string) =>
    rankings.find((r) => r.player.id === id)?.player.full_name ?? 'Unknown';

  const active  = matches.filter((m) => ['scheduled', 'in_progress', 'submitted', 'disputed'].includes(m.status));
  const history = matches.filter((m) => ['confirmed', 'resolved'].includes(m.status));
  const baseList = tab === 'active' ? active : history;
  const list     = disc === 'All' ? baseList : baseList.filter((m) => m.discipline === disc);

  const statusBadge = (status: string) => {
    if (status === 'scheduled') return 'pending';
    if (status === 'in_progress') return 'info' as never;
    if (status === 'submitted') return 'pending';
    if (status === 'disputed') return 'loss';
    if (status === 'confirmed' || status === 'resolved') return 'win';
    return 'default';
  };

  return (
    <div className="min-h-screen px-4 pt-8 pb-4">
      <h1 className="font-[Bebas_Neue] text-5xl tracking-wide text-[#E8E2D6] mb-5">My Matches</h1>

      <div className="flex gap-1 mb-5 bg-[#1A1A1A] rounded-xl p-1">
        {[
          { key: 'active', label: 'Active', count: active.length },
          { key: 'history', label: 'History', count: history.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'active' | 'history')}
            className={`flex-1 py-2 rounded-lg text-sm font-[Barlow] font-medium transition-all ${tab === t.key ? 'bg-[var(--toc-theme-accent)] text-white' : 'text-[#9CA3AF]'}`}
          >
            {t.label} {t.count > 0 && <span className="ml-1 opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Discipline filter — only show on history tab where it's useful */}
      {tab === 'history' && history.length > 0 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-0.5">
          {(['All', '8 Ball', '9 Ball', '10 Ball'] as DiscFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDisc(d)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-[Barlow] font-medium whitespace-nowrap transition-all shrink-0',
                disc === d ? 'bg-[var(--toc-theme-accent)] text-white' : 'bg-[#1A1A1A] text-[#9CA3AF] border border-[#333]',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <RankingRowSkeleton key={i} />)}</div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'active' ? '🎯' : '📋'}
          title={tab === 'active' ? 'No Active Matches' : 'No Match History'}
          message={tab === 'active' ? "Accept a challenge to schedule a match." : "Your completed matches will appear here."}
          action={tab === 'active' ? (
            <Button variant="primary" onClick={() => navigate('/rankings?challenge=1')}>Find Opponents</Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {list.map((m, i) => {
            const opponentId   = m.player1_id === player?.id ? m.player2_id : m.player1_id;
            const opponentName = getPlayerName(opponentId);
            const myScore      = m.player1_id === player?.id ? m.player1_score : m.player2_score;
            const theirScore   = m.player1_id === player?.id ? m.player2_score : m.player1_score;
            const won          = m.winner_id === player?.id;

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <GlassCard hover className="p-4" onClick={() => navigate(`/match/${m.id}`)}>
                  <div className="flex items-center gap-3">
                    <Avatar player={{ full_name: opponentName, avatar_url: rankings.find((r) => r.player.id === opponentId)?.player.avatar_url }} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-[Barlow] font-semibold text-[#E8E2D6] truncate">{opponentName}</span>
                        <Badge variant={statusBadge(m.status) as never}>{m.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="text-[#9CA3AF] text-xs font-[Barlow]">
                        {m.discipline} · Race to {m.race_length} · {m.venue}
                      </div>
                      <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">
                        {formatDateTime(m.scheduled_at)}
                      </div>
                    </div>
                    {(m.status === 'confirmed' || m.status === 'resolved' || m.status === 'in_progress') && (
                      <div className="text-right shrink-0">
                        <div className="font-[Azeret_Mono] font-bold text-2xl">
                          <span style={{ color: won ? '#22C55E' : '#EF4444' }}>{myScore}</span>
                          <span className="text-[#6B7280] mx-1">–</span>
                          <span className="text-[#E8E2D6]">{theirScore}</span>
                        </div>
                        {m.status !== 'in_progress' && (
                          <div className={`text-xs font-[Barlow] font-semibold ${won ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                            {won ? 'WIN' : 'LOSS'}
                          </div>
                        )}
                      </div>
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
