import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchTreasurySnapshot, type TreasurySnapshot } from '../lib/treasury';
import type {
  Player,
  Ranking,
  Match,
  Challenge,
  PlayerSeasonStats,
  PlayerDisciplineStats,
  PlayerMetrics,
  ActivityFeedItem,
} from '../types/database';

/** Slim slices fetched for the stats dashboard — small league, so we pull
 *  everything once and derive all aggregates client-side. */
export type StatsPlayer = Pick<
  Player,
  'id' | 'full_name' | 'profile_id' | 'is_active' | 'preferred_discipline' | 'avatar_url' | 'created_at'
>;

export type StatsMatch = Pick<
  Match,
  | 'id' | 'player1_id' | 'player2_id' | 'discipline' | 'race_length' | 'venue'
  | 'player1_score' | 'player2_score' | 'winner_id' | 'loser_id' | 'status'
  | 'player1_payment_method' | 'player2_payment_method'
  | 'scheduled_at' | 'completed_at' | 'created_at'
>;

export type StatsChallenge = Pick<
  Challenge,
  'id' | 'challenger_id' | 'challenged_id' | 'discipline' | 'status' | 'venue' | 'created_at' | 'expires_at'
>;

export interface LeagueStatsSnapshot {
  players: StatsPlayer[];
  rankings: Ranking[];
  seasonStats: PlayerSeasonStats[];
  disciplineStats: PlayerDisciplineStats[];
  metrics: Pick<PlayerMetrics, 'player_id' | 'fargo_rating'>[];
  challenges: StatsChallenge[];
  matches: StatsMatch[];
  treasury: TreasurySnapshot;
  activity: ActivityFeedItem[];
}

export const LEAGUE_STATS_KEY = ['league-stats'] as const;

async function fetchLeagueStatsSnapshot(): Promise<LeagueStatsSnapshot> {
  const [
    playersRes,
    rankingsRes,
    seasonStatsRes,
    disciplineStatsRes,
    metricsRes,
    challengesRes,
    matchesRes,
    treasury,
    activityRes,
  ] = await Promise.all([
    supabase
      .from('players')
      .select('id, full_name, profile_id, is_active, preferred_discipline, avatar_url, created_at'),
    supabase.from('rankings').select('*').order('position'),
    supabase.from('player_season_stats').select('*'),
    supabase.from('player_discipline_stats').select('*'),
    supabase.from('player_reference_metrics').select('player_id, fargo_rating'),
    supabase
      .from('challenges')
      .select('id, challenger_id, challenged_id, discipline, status, venue, created_at, expires_at'),
    supabase
      .from('matches')
      .select('id, player1_id, player2_id, discipline, race_length, venue, player1_score, player2_score, winner_id, loser_id, status, player1_payment_method, player2_payment_method, scheduled_at, completed_at, created_at'),
    fetchTreasurySnapshot(),
    supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(15),
  ]);

  // Core slices must load — surface the failure so the page shows an error
  // state instead of an empty dashboard.
  if (playersRes.error) throw playersRes.error;
  if (rankingsRes.error) throw rankingsRes.error;
  if (matchesRes.error) throw matchesRes.error;
  if (challengesRes.error) throw challengesRes.error;

  return {
    players: (playersRes.data ?? []) as StatsPlayer[],
    rankings: (rankingsRes.data ?? []) as Ranking[],
    seasonStats: (seasonStatsRes.data ?? []) as PlayerSeasonStats[],
    disciplineStats: (disciplineStatsRes.data ?? []) as PlayerDisciplineStats[],
    metrics: (metricsRes.data ?? []) as Pick<PlayerMetrics, 'player_id' | 'fargo_rating'>[],
    challenges: (challengesRes.data ?? []) as StatsChallenge[],
    matches: (matchesRes.data ?? []) as StatsMatch[],
    treasury,
    activity: (activityRes.data ?? []) as ActivityFeedItem[],
  };
}

export function useLeagueStats() {
  return useQuery<LeagueStatsSnapshot>({
    queryKey: [...LEAGUE_STATS_KEY],
    queryFn: fetchLeagueStatsSnapshot,
    staleTime: 15_000,
    refetchInterval: 30_000, // fallback when realtime events are missed
  });
}

/** Live updates: any change to the tables feeding the dashboard invalidates
 *  the snapshot, so the page refreshes within a second of a result landing. */
export function useLeagueStatsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const tables = [
      'matches',
      'challenges',
      'rankings',
      'players',
      'player_season_stats',
      'player_discipline_stats',
      'treasury_ledger',
      'activity_feed',
    ];
    let channel = supabase.channel('tof-league-stats');
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => qc.invalidateQueries({ queryKey: [...LEAGUE_STATS_KEY] }),
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
