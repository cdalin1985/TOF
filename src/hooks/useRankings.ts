import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getTopOfTheFallsDemoRankings, isTopOfTheFallsDemoMode } from '../demo/topOfTheFallsDemo';
import type { RankedPlayer, Player, Ranking, PlayerMetrics, PlayerSeasonStats } from '../types/database';

export function useRankings() {
  return useQuery<RankedPlayer[]>({
    queryKey: ['rankings'],
    queryFn: async () => {
      if (isTopOfTheFallsDemoMode()) return getTopOfTheFallsDemoRankings();

      const [playersRes, rankingsRes, metricsRes, statsRes] = await Promise.all([
        supabase.from('players').select('*').eq('is_active', true),
        supabase.from('rankings').select('*').order('position'),
        supabase.from('player_reference_metrics').select('*'),
        supabase.from('player_season_stats').select('*'),
      ]);

      const players  = (playersRes.data  ?? []) as Player[];
      const rankings = (rankingsRes.data ?? []) as Ranking[];
      const metrics  = (metricsRes.data  ?? []) as PlayerMetrics[];
      const stats    = (statsRes.data    ?? []) as PlayerSeasonStats[];

      return rankings.map((r) => ({
        player:  players.find((p) => p.id === r.player_id)!,
        ranking: r,
        metrics: metrics.find((m) => m.player_id === r.player_id) ?? null,
        stats:   stats.find((s)   => s.player_id === r.player_id) ?? null,
      })).filter((rp) => rp.player);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
