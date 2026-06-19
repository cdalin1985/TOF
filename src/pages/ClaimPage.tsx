import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { QueryError } from '../components/QueryError';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { PoolBall } from '../components/PoolBall';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import type { Player, Ranking, PlayerMetrics } from '../types/database';


interface UnclaimedPlayer {
  player: Player;
  ranking: Ranking;
  metrics: PlayerMetrics | null;
}

export default function ClaimPage() {
  const { setPlayer } = useAuthStore();
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<UnclaimedPlayer | null>(null);
  const [claiming, setClaiming]       = useState(false);
  const [claimError, setClaimError]   = useState('');

  const { data: players = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['unclaimed-players'],
    queryFn: async () => {
      const [playersRes, rankingsRes, metricsRes] = await Promise.all([
        supabase.from('players').select('*').is('profile_id', null).eq('is_active', true).order('full_name'),
        supabase.from('rankings').select('*'),
        supabase.from('player_reference_metrics').select('*'),
      ]);
      if (playersRes.error)  throw playersRes.error;
      if (rankingsRes.error) throw rankingsRes.error;
      const rankings = (rankingsRes.data ?? []) as Ranking[];
      const metrics  = (metricsRes.data  ?? []) as PlayerMetrics[];
      return ((playersRes.data ?? []) as Player[]).map((p) => ({
        player:  p,
        ranking: rankings.find((r) => r.player_id === p.id)!,
        metrics: metrics.find((m) => m.player_id === p.id) ?? null,
      })).filter((p) => p.ranking);
    },
  });

  const filtered = players.filter((p) =>
    p.player.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleClaim = async () => {
    if (!selected) return;
    setClaiming(true);
    setClaimError('');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ player_id: selected.player.id }),
    });
    const json = await res.json() as { success?: boolean; error?: string };
    setClaiming(false);
    if (json.error) { setClaimError(json.error); return; }
    // Refresh player in store
    const { data } = await supabase.from('players').select('*').eq('id', selected.player.id).single();
    if (data) {
      setPlayer(data);
      localStorage.setItem('toc-new-user', '1');
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="font-[Bebas_Neue] text-5xl tracking-wide"
            style={{ textShadow: '0 0 30px rgba(198,40,40,0.3)' }}
          >
            Claim Your Spot
          </h1>
          <p className="text-[#9CA3AF] font-[Barlow] text-sm mt-2">
            Find your name in the league roster and claim your profile.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search your name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] text-[#E8E2D6] font-[Barlow] focus:outline-none focus:border-[var(--toc-theme-accent)] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} className="text-[#6B7280]" />
            </button>
          )}
        </div>

        {/* Player list */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-card p-4 flex items-center gap-3">
                  <div className="skeleton w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-36" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                </div>
              ))
            : isError
            ? <QueryError onRetry={() => refetch()} />
            : filtered.length === 0
            ? (
                <div className="text-center py-12 text-[#6B7280] font-[Barlow]">
                  {players.length === 0
                    ? 'All players have been claimed. Contact the league admin.'
                    : 'No players match your search.'}
                </div>
              )
            : filtered.map((p, i) => (
                <motion.div
                  key={p.player.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  <GlassCard
                    hover
                    onClick={() => setSelected(p)}
                    className="p-4 flex items-center gap-3"
                  >
                    <PoolBall position={p.ranking?.position ?? 99} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="font-[Barlow] font-semibold text-[#E8E2D6] truncate">
                        {p.player.full_name}
                      </div>
                      <div className="text-[#6B7280] text-xs font-[Azeret_Mono] mt-0.5">
                        #{p.ranking?.position}
                        {p.metrics?.fargo_rating ? ` · Fargo ${p.metrics.fargo_rating}` : ''}
                      </div>
                    </div>
                    <div className="text-[var(--toc-theme-accent)] text-xs font-[Barlow] font-medium">Claim →</div>
                  </GlassCard>
                </motion.div>
              ))
          }
        </div>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => { if (!claiming) setSelected(null); }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="glass-card p-8 w-full max-w-sm text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <PoolBall position={selected.ranking?.position ?? 1} size={64} className="mx-auto mb-4" />
              <h2 className="font-[Bebas_Neue] text-3xl text-[#E8E2D6] mb-1">
                Are you {selected.player.full_name}?
              </h2>
              <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-6">
                This will link your account to this player profile.
                You can't undo this without contacting the admin.
              </p>
              {claimError && (
                <p className="text-[#EF4444] text-sm mb-4 font-[Barlow]">{claimError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setSelected(null)}
                  disabled={claiming}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  loading={claiming}
                  onClick={handleClaim}
                >
                  <CheckCircle size={16} /> Yes, that's me
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
