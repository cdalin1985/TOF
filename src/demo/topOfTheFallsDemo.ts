import type { RankedPlayer } from '../types/database';

const DEMO_STORAGE_KEY = 'toc-demo-mode';
const TOTF_DEMO_VALUE = 'totf';

export const TOP_OF_THE_FALLS_DEMO_EMAIL = 'cj_higgins@msn.com';

export const TOP_OF_THE_FALLS_ROSTER = [
  'Jerrod Korst',
  'Roger Kriedeman',
  'Carl Higgins',
  'Wade Thompson',
  'Ron DeWitt',
  'Will Goodwin',
  'John Servoss',
  'Patrick Murphy',
  'Chad Hovland',
  'Brittany Korst',
  'John Bede',
  'Robert Musekamp',
  'Dan Patton',
  'Jason Riphenburg',
  'Owen Tomlinson',
  'Jerry Schuler',
  'Edin Smith',
  'Chuck Stelzer',
  'Joel Miller',
  "God'King Deezie Ratcliff",
  'Kelton Roberts',
  'Kevin Burnett',
  'Trace Marney',
  'Matt Dalla Mura',
  'Stuart Paterson',
  'Mark O’Loughlin',
  'Tel McWilliams',
  'David Korst',
  'Nate Beebe',
  'Cody Lattin',
  'Mike Birkoski',
  'Brian D. Lundquist',
  'Jack Barnes',
  'Nicole Tomlinson Lundquist',
  'Brice Courtnage',
  'Dan Rayl',
  'Roger Kness',
  'Jan Nicola-Higgins',
  'Greg Bushman',
  'Kevin Kofod',
  'Samantha Henderson',
  'Steve Patrick',
  'Katherine Block',
  'Mark Hegel',
  'Barry Munns',
  'Stephanie Thompson',
  'Michael Trotchie',
  'Austin Nelson',
  'Beau Johnson',
  'Devin Gray',
  'Mark Farris',
  'Dusty Barnes',
  'John Barnes',
  'Jody Dyson',
  'Mike Hilliard',
  'Shawn Brass',
  'Landon Smith',
  'Tyler Warnick',
  'Krystal Moen',
  'Lloyd Keels',
  'Johnny Hill',
  'Curt Moore',
  'Tyler Sasek',
  'Dawna Kraus',
  'Kayla Leighann Norris',
  'Tyler Coburn',
  'Kristi Farris',
  'Kory Trash Panda Boots',
  'Kurt Mueller',
  'Jennifer LaPlante Allan',
  'John M Johnson',
  'John Jay Mann',
  'Curtis G. Thompson',
  'Dustin Iszler',
  'Justin Burnham',
  'Drayke Anthony Holefelder',
  'Andrew Schur',
  'Katrina Adkins',
  'Don Marney',
  'Greg Schoby',
  'Cassidy P. Knapstad',
  'Russell Flanigan',
  'Patty Kness',
  'Nathaniel McCann',
  'Bryan Vaden',
  'Gary Skunkcap',
  'Linda Ballew',
  'Tyler Korst',
  'Dylan Riphenburg',
  'Ricky Sauvé',
  'Kevin Mock',
  'Chas Trueman',
  'Bradley Horton',
  'Carp Mazing',
  'Nikki Guckeen',
  'Airn Houle',
  'Michael Stanley',
  'Casey Hall',
  'Cary Allan',
  'Kevin Pfleger',
  'Brad VanSteenvoort',
  'Trena Gladeau',
  'Josh Micheletti',
  'Michael Krebs',
  'Nicky Wibbenmeyer',
  'Jacob Johnson',
  'Jeff Pistelak',
  'Bob Paranteau',
  'Braden Amundson',
  'Malaki Hvamstad',
  'Donnie Dues',
  'Kyrah Heusel',
  'Eric Oakland',
  'Scott Coble',
  'Justin VanAken',
  'Tish Schur',
  'Richard Sprau',
] as const;

function demoUuid(position: number) {
  return `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`;
}

function nowIso() {
  return new Date('2026-06-09T00:00:00.000Z').toISOString();
}

export function isLocalDemoHost() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function isTopOfTheFallsDemoMode() {
  if (typeof window === 'undefined' || !isLocalDemoHost()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === TOTF_DEMO_VALUE) {
    window.localStorage.setItem(DEMO_STORAGE_KEY, TOTF_DEMO_VALUE);
    return true;
  }
  return window.localStorage.getItem(DEMO_STORAGE_KEY) === TOTF_DEMO_VALUE;
}

export function getTopOfTheFallsDemoRankings(): RankedPlayer[] {
  return TOP_OF_THE_FALLS_ROSTER.map((fullName, index) => {
    const position = index + 1;
    const playerId = demoUuid(position);
    return {
      player: {
        id: playerId,
        profile_id: null,
        full_name: fullName,
        bio: null,
        preferred_discipline: null,
        avatar_url: null,
        is_active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      ranking: {
        id: demoUuid(position + 1000),
        player_id: playerId,
        position,
        previous_position: null,
        rank1_since: position === 1 ? nowIso() : null,
        updated_at: nowIso(),
      },
      metrics: null,
      stats: {
        id: demoUuid(position + 2000),
        player_id: playerId,
        wins: 0,
        losses: 0,
        current_streak: 0,
        best_streak: 0,
        matches_played: 0,
        challenges_issued: 0,
        challenges_received: 0,
        defender_wins: 0,
        challenger_wins: 0,
        forfeit_wins: 0,
        forfeits: 0,
        best_rank_achieved: position,
        updated_at: nowIso(),
      },
    };
  });
}
