import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN || '';
const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

// League IDs
const LEAGUE_IDS = {
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 5,
  PREMIER_LEAGUE: 8,
  CHAMPIONSHIP: 9,
};

// Competition mapping
type Competition = 'Champions League' | 'Europa League' | 'Premier League' | 'Championship';

const LEAGUE_ID_TO_COMPETITION: Record<number, Competition> = {
  [LEAGUE_IDS.CHAMPIONS_LEAGUE]: 'Champions League',
  [LEAGUE_IDS.EUROPA_LEAGUE]: 'Europa League',
  [LEAGUE_IDS.PREMIER_LEAGUE]: 'Premier League',
  [LEAGUE_IDS.CHAMPIONSHIP]: 'Championship',
};

// State mapping
const STATE_MAPPING: Record<string, 'live' | 'ht' | 'ft'> = {
  'LIVE': 'live',
  'INPLAY': 'live',
  'HT': 'ht',
  'FT': 'ft',
  'AET': 'ft',
  'PEN_LIVE': 'live',
};

interface SportmonksParticipant {
  id: number;
  fixture_id: number;
  participant_id: number;
  meta: {
    location: 'home' | 'away';
    winner: boolean;
    position: number;
  };
  name: string;
}

interface SportmonksScore {
  id: number;
  fixture_id: number;
  type_id: number;
  participant_id: number;
  score: {
    goals: number;
    participant: 'home' | 'away';
  };
  description: string;
}

interface SportmonksEvent {
  id: number;
  fixture_id: number;
  type_id: number;
  player_id: number | null;
  player_name: string | null;
  minute: number;
  extra_minute: number | null;
  participant_id: number;
}

interface SportmonksState {
  id: number;
  state: string;
  name: string;
  short_name: string;
  developer_name: string;
}

interface SportmonksLeague {
  id: number;
  name: string;
  short_code: string;
  image_path: string;
}

interface SportmonksFixture {
  id: number;
  name: string;
  starting_at: string;
  state_id: number;
  participants?: SportmonksParticipant[];
  scores?: SportmonksScore[];
  events?: SportmonksEvent[];
  state?: SportmonksState;
  league?: SportmonksLeague;
}

interface GoalScorer {
  player: string;
  minute: number;
  team: 'home' | 'away';
}

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: 'live' | 'ft' | 'ht';
  competition: Competition;
  goalScorers: GoalScorer[];
}

async function fetchLivescores(): Promise<Match[]> {
  if (!SPORTMONKS_API_TOKEN) {
    console.error('SPORTMONKS_API_TOKEN not set');
    return [];
  }

  const leagueIds = Object.values(LEAGUE_IDS).join(',');
  const url = `${SPORTMONKS_BASE_URL}/livescores?api_token=${SPORTMONKS_API_TOKEN}&include=participants;scores;events;state;league&filters=fixtureLeagues:${leagueIds}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return [];
    }

    const matches: Match[] = data.data
      .map((fixture: SportmonksFixture) => {
        try {
          // Get participants
          const homeParticipant = fixture.participants?.find(p => p.meta.location === 'home');
          const awayParticipant = fixture.participants?.find(p => p.meta.location === 'away');

          if (!homeParticipant || !awayParticipant) {
            return null;
          }

          // Get scores
          const homeScoreObj = fixture.scores?.find(
            s => s.participant_id === homeParticipant.participant_id && s.description === 'CURRENT'
          );
          const awayScoreObj = fixture.scores?.find(
            s => s.participant_id === awayParticipant.participant_id && s.description === 'CURRENT'
          );

          const homeScore = homeScoreObj?.score.goals || 0;
          const awayScore = awayScoreObj?.score.goals || 0;

          // Get state
          const stateName = fixture.state?.developer_name || 'FT';
          const status = STATE_MAPPING[stateName] || 'ft';

          // Calculate minute (for live matches)
          let minute = 0;
          if (status === 'live') {
            const startTime = new Date(fixture.starting_at).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000 / 60);
            minute = Math.min(elapsed, 90);
          } else if (status === 'ht') {
            minute = 45;
          } else {
            minute = 90;
          }

          // Get goal scorers
          const goalEvents = fixture.events?.filter(e => e.type_id === 14) || [];
          const goalScorers: GoalScorer[] = goalEvents.map(event => {
            const isHomeTeam = event.participant_id === homeParticipant.participant_id;
            return {
              player: event.player_name || 'Unknown',
              minute: event.minute + (event.extra_minute || 0),
              team: isHomeTeam ? 'home' : 'away',
            };
          });

          // Get competition
          const competition = fixture.league?.id 
            ? LEAGUE_ID_TO_COMPETITION[fixture.league.id]
            : 'Premier League';

          if (!competition) {
            return null;
          }

          return {
            id: fixture.id.toString(),
            homeTeam: homeParticipant.name,
            awayTeam: awayParticipant.name,
            homeScore,
            awayScore,
            minute,
            status,
            competition,
            goalScorers,
          };
        } catch (error) {
          console.error('Error processing fixture:', error);
          return null;
        }
      })
      .filter((match): match is Match => match !== null);

    return matches;
  } catch (error) {
    console.error('Error fetching livescores:', error);
    return [];
  }
}

export const livescoresRouter = router({
  getLivescores: publicProcedure.query(async () => {
    const matches = await fetchLivescores();
    return { matches };
  }),
});

