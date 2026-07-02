import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isTopOfTheFallsDemoMode } from '../demo/topOfTheFallsDemo';
import { LEAGUE } from '../config/league';
import type { Challenge, Match } from '../types/database';

export interface BreakdownRow {
  name: string;
  count: number;
}

export interface LeagueStats {
  matchesPlayed: number;
  racksPlayed: number;
  openChallenges: number;
  challengesIssued: number;
  byDiscipline: BreakdownRow[];
  byVenue: BreakdownRow[];
}

const COMPLETED_MATCH_STATUSES: Match['status'][] = ['confirmed', 'resolved'];
const OPEN_CHALLENGE_STATUSES: Challenge['status'][] = [
  'pending',
  'accepted',
  'scheduled',
  'in_progress',
];

// Canonical rows come first (even at zero) so the breakdown always shows the
// league's configured disciplines/venues; anything unexpected in match data is
// appended rather than silently dropped.
function buildBreakdown(canonical: readonly string[], values: (string | null)[]): BreakdownRow[] {
  const counts = new Map<string, number>(canonical.map((name) => [name, 0]));
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count }));
}

function emptyLeagueStats(): LeagueStats {
  return {
    matchesPlayed: 0,
    racksPlayed: 0,
    openChallenges: 0,
    challengesIssued: 0,
    byDiscipline: buildBreakdown(LEAGUE.disciplines.map((d) => d.value), []),
    byVenue: buildBreakdown(LEAGUE.sponsorBars, []),
  };
}

export function useLeagueStats() {
  return useQuery<LeagueStats>({
    queryKey: ['league-stats'],
    queryFn: async () => {
      if (isTopOfTheFallsDemoMode()) return emptyLeagueStats();

      const [matchesRes, challengesRes] = await Promise.all([
        supabase.from('matches').select('discipline, venue, player1_score, player2_score, status'),
        supabase.from('challenges').select('status'),
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (challengesRes.error) throw challengesRes.error;

      type MatchRow = Pick<Match, 'discipline' | 'venue' | 'player1_score' | 'player2_score' | 'status'>;
      const matches = (matchesRes.data ?? []) as MatchRow[];
      const challenges = (challengesRes.data ?? []) as Pick<Challenge, 'status'>[];

      const completed = matches.filter((m) => COMPLETED_MATCH_STATUSES.includes(m.status));

      return {
        matchesPlayed: completed.length,
        racksPlayed: completed.reduce((sum, m) => sum + m.player1_score + m.player2_score, 0),
        openChallenges: challenges.filter((c) => OPEN_CHALLENGE_STATUSES.includes(c.status)).length,
        challengesIssued: challenges.length,
        byDiscipline: buildBreakdown(
          LEAGUE.disciplines.map((d) => d.value),
          completed.map((m) => m.discipline)
        ),
        byVenue: buildBreakdown(LEAGUE.sponsorBars, completed.map((m) => m.venue)),
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
