import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN || '';
const USE_MOCK_DATA = process.env.USE_MOCK_LIVESCORES === 'true';
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
const STATE_MAPPING: Record<string, 'upcoming' | 'live' | 'ht' | 'ft'> = {
  'NS': 'upcoming',
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
  image_path?: string;
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
  starting_at_timestamp: number;
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
  status: 'upcoming' | 'live' | 'ft' | 'ht';
  competition: Competition;
  competitionLogo?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  goalScorers: GoalScorer[];
  kickoffTime: string;
}

async function fetchInplayMatches(): Promise<Match[]> {
  if (!SPORTMONKS_API_TOKEN) {
    return [];
  }

  const leagueIds = Object.values(LEAGUE_IDS).join(',');
  const url = `${SPORTMONKS_BASE_URL}/livescores/inplay?api_token=${SPORTMONKS_API_TOKEN}&include=participants;scores;events;state;league&filters=fixtureLeagues:${leagueIds}&timezone=Europe/London`;

  try {
    console.log('[Livescores] Fetching inplay matches');
    const response = await fetch(url);
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log('[Livescores] No inplay matches');
      return [];
    }

    console.log('[Livescores] Inplay matches:', data.data.length);
    return processFixtures(data.data);
  } catch (error) {
    console.error('[Livescores] Error fetching inplay matches:', error);
    return [];
  }
}

async function fetchTodaysFixtures(): Promise<Match[]> {
  if (!SPORTMONKS_API_TOKEN) {
    console.error('SPORTMONKS_API_TOKEN not set');
    return [];
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  const leagueIds = Object.values(LEAGUE_IDS).join(',');
  
  // Use fixtures/date endpoint to get all fixtures for today
  const url = `${SPORTMONKS_BASE_URL}/fixtures/date/${dateStr}?api_token=${SPORTMONKS_API_TOKEN}&include=participants;scores;events;state;league&filters=fixtureLeagues:${leagueIds}&timezone=Europe/London`;

  try {
    console.log('[Livescores] Fetching fixtures for date:', dateStr);
    console.log('[Livescores] API URL:', url.replace(SPORTMONKS_API_TOKEN, 'REDACTED'));
    
    const response = await fetch(url);
    const data = await response.json();

    console.log('[Livescores] API Response status:', response.status);
    console.log('[Livescores] Raw fixtures from API:', data.data?.length || 0);
    
    if (data.data && data.data.length > 0) {
      console.log('[Livescores] Sample fixture:', JSON.stringify(data.data[0], null, 2));
    }

    if (!data.data || data.data.length === 0) {
      console.log('[Livescores] No fixtures returned from API');
      if (data.message) {
        console.error('[Livescores] API Error:', data.message);
      }
      return [];
    }

    return processFixtures(data.data);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return [];
  }
}

function processFixtures(fixtures: SportmonksFixture[]): Match[] {
  return fixtures
    .map((fixture: SportmonksFixture) => {
        try {
          // Get participants
          const homeParticipant = fixture.participants?.find(p => p.meta.location === 'home');
          const awayParticipant = fixture.participants?.find(p => p.meta.location === 'away');

          if (!homeParticipant || !awayParticipant) {
            return null;
          }

          // Get scores from API
          const homeScoreObj = fixture.scores?.find(
            s => s.participant_id === homeParticipant.participant_id && s.description === 'CURRENT'
          );
          const awayScoreObj = fixture.scores?.find(
            s => s.participant_id === awayParticipant.participant_id && s.description === 'CURRENT'
          );

          let homeScore = homeScoreObj?.score.goals || 0;
          let awayScore = awayScoreObj?.score.goals || 0;
          
          // Fallback: Calculate scores from goal events if API scores are 0 but goals exist
          const goalEvents = fixture.events?.filter(e => e.type_id === 14) || [];
          if (goalEvents.length > 0 && homeScore === 0 && awayScore === 0) {
            homeScore = goalEvents.filter(e => e.participant_id === homeParticipant.participant_id).length;
            awayScore = goalEvents.filter(e => e.participant_id === awayParticipant.participant_id).length;
            console.log('[Livescores] Calculated scores from events:', {
              match: `${homeParticipant.name} vs ${awayParticipant.name}`,
              homeScore,
              awayScore,
              totalGoals: goalEvents.length
            });
          }

          // Get state
          const stateName = fixture.state?.developer_name || 'NS';
          let status = STATE_MAPPING[stateName] || 'upcoming';
          
          // Fallback: If match has goals or kickoff time has passed by 5+ minutes, treat as live
          const kickoffTime = new Date(fixture.starting_at).getTime();
          const now = Date.now();
          const minutesSinceKickoff = Math.floor((now - kickoffTime) / 1000 / 60);
          const hasGoals = (fixture.events?.filter(e => e.type_id === 14).length || 0) > 0;
          
          if (status === 'upcoming' && (hasGoals || minutesSinceKickoff >= 5)) {
            console.log('[Livescores] Overriding status to live:', {
              fixtureId: fixture.id,
              match: `${homeParticipant.name} vs ${awayParticipant.name}`,
              apiState: stateName,
              hasGoals,
              minutesSinceKickoff
            });
            status = 'live';
          }
          
          // Log state for debugging
          if (fixture.id === 19568973 || fixture.id === '19568973') {
            console.log('[Livescores] FCSB vs Bologna state:', {
              fixtureId: fixture.id,
              stateName,
              status,
              fullState: fixture.state,
              hasGoals,
              minutesSinceKickoff
            });
          }

          // Calculate minute (for live matches)
          let minute = 0;
          if (status === 'live') {
            // Parse the starting time (API returns in Europe/London timezone)
            const startTime = new Date(fixture.starting_at).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000 / 60);
            minute = Math.min(Math.max(elapsed, 0), 90);
            
            if (fixture.id === 19568973 || fixture.id === '19568973') {
              console.log('[Livescores] Minute calculation:', {
                match: `${homeParticipant.name} vs ${awayParticipant.name}`,
                starting_at: fixture.starting_at,
                startTime: new Date(startTime).toISOString(),
                now: new Date(now).toISOString(),
                elapsed,
                minute
              });
            }
          } else if (status === 'ht') {
            minute = 45;
          } else if (status === 'ft') {
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
            : undefined;

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
            competitionLogo: fixture.league?.image_path,
            homeTeamLogo: homeParticipant.image_path,
            awayTeamLogo: awayParticipant.image_path,
            goalScorers,
            kickoffTime: fixture.starting_at,
          };
        } catch (error) {
          console.error('Error processing fixture:', error);
          return null;
        }
      })
      .filter((match): match is Match => match !== null);
}

function getMockMatches(): Match[] {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  return [
    // Champions League - Live match with goals
    {
      id: '1',
      homeTeam: 'Real Madrid',
      awayTeam: 'Bayern Munich',
      homeScore: 2,
      awayScore: 1,
      minute: 67,
      status: 'live',
      competition: 'Champions League',
      goalScorers: [
        { player: 'Vinícius Jr', minute: 23, team: 'home' },
        { player: 'Bellingham', minute: 45, team: 'home' },
        { player: 'Kane', minute: 58, team: 'away' },
      ],
      kickoffTime: new Date(now.getTime() - 67 * 60 * 1000).toISOString(),
    },
    // Champions League - Half time
    {
      id: '2',
      homeTeam: 'Barcelona',
      awayTeam: 'PSG',
      homeScore: 1,
      awayScore: 1,
      minute: 45,
      status: 'ht',
      competition: 'Champions League',
      goalScorers: [
        { player: 'Lewandowski', minute: 12, team: 'home' },
        { player: 'Mbappé', minute: 34, team: 'away' },
      ],
      kickoffTime: new Date(now.getTime() - 50 * 60 * 1000).toISOString(),
    },
    // Europa League - Live match
    {
      id: '3',
      homeTeam: 'Arsenal',
      awayTeam: 'Roma',
      homeScore: 3,
      awayScore: 0,
      minute: 78,
      status: 'live',
      competition: 'Europa League',
      goalScorers: [
        { player: 'Saka', minute: 15, team: 'home' },
        { player: 'Ødegaard', minute: 42, team: 'home' },
        { player: 'Jesus', minute: 71, team: 'home' },
      ],
      kickoffTime: new Date(now.getTime() - 78 * 60 * 1000).toISOString(),
    },
    // Europa League - Finished
    {
      id: '4',
      homeTeam: 'Sevilla',
      awayTeam: 'Ajax',
      homeScore: 2,
      awayScore: 2,
      minute: 90,
      status: 'ft',
      competition: 'Europa League',
      goalScorers: [
        { player: 'En-Nesyri', minute: 8, team: 'home' },
        { player: 'Tadic', minute: 23, team: 'away' },
        { player: 'Ocampos', minute: 67, team: 'home' },
        { player: 'Brobbey', minute: 89, team: 'away' },
      ],
      kickoffTime: new Date(now.getTime() - 105 * 60 * 1000).toISOString(),
    },
    // Premier League - Live match
    {
      id: '5',
      homeTeam: 'Liverpool',
      awayTeam: 'Man City',
      homeScore: 1,
      awayScore: 2,
      minute: 54,
      status: 'live',
      competition: 'Premier League',
      goalScorers: [
        { player: 'Salah', minute: 18, team: 'home' },
        { player: 'Haaland', minute: 31, team: 'away' },
        { player: 'De Bruyne', minute: 49, team: 'away' },
      ],
      kickoffTime: new Date(now.getTime() - 54 * 60 * 1000).toISOString(),
    },
    // Premier League - Upcoming (10 minutes - RED BLINKING)
    {
      id: '6',
      homeTeam: 'Chelsea',
      awayTeam: 'Tottenham',
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      status: 'upcoming',
      competition: 'Premier League',
      goalScorers: [],
      kickoffTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    },
    // Premier League - Finished
    {
      id: '7',
      homeTeam: 'Man United',
      awayTeam: 'Newcastle',
      homeScore: 0,
      awayScore: 1,
      minute: 90,
      status: 'ft',
      competition: 'Premier League',
      goalScorers: [
        { player: 'Isak', minute: 76, team: 'away' },
      ],
      kickoffTime: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
    },
    // Championship - Live
    {
      id: '8',
      homeTeam: 'Leeds United',
      awayTeam: 'Southampton',
      homeScore: 2,
      awayScore: 2,
      minute: 82,
      status: 'live',
      competition: 'Championship',
      goalScorers: [
        { player: 'Rutter', minute: 12, team: 'home' },
        { player: 'Adams', minute: 28, team: 'away' },
        { player: 'Gnonto', minute: 56, team: 'home' },
        { player: 'Armstrong', minute: 79, team: 'away' },
      ],
      kickoffTime: new Date(now.getTime() - 82 * 60 * 1000).toISOString(),
    },
    // Championship - Upcoming
    {
      id: '9',
      homeTeam: 'Leicester City',
      awayTeam: 'Ipswich Town',
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      status: 'upcoming',
      competition: 'Championship',
      goalScorers: [],
      kickoffTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
    },
    // Championship - Finished
    {
      id: '10',
      homeTeam: 'Burnley',
      awayTeam: 'Sheffield United',
      homeScore: 3,
      awayScore: 1,
      minute: 90,
      status: 'ft',
      competition: 'Championship',
      goalScorers: [
        { player: 'Foster', minute: 15, team: 'home' },
        { player: 'McBurnie', minute: 34, team: 'away' },
        { player: 'Brownhill', minute: 67, team: 'home' },
        { player: 'Zaroury', minute: 88, team: 'home' },
      ],
      kickoffTime: new Date(now.getTime() - 110 * 60 * 1000).toISOString(),
    },
  ];
}

export const livescoresRouter = router({
  getLivescores: publicProcedure.query(async () => {
    if (USE_MOCK_DATA) {
      return { matches: getMockMatches() };
    }
    
    // Fetch both inplay matches and today's fixtures
    const [inplayMatches, todaysFixtures] = await Promise.all([
      fetchInplayMatches(),
      fetchTodaysFixtures(),
    ]);
    
    // Merge matches, preferring inplay data for live matches
    const matchMap = new Map<string, Match>();
    
    // Add all fixtures first
    todaysFixtures.forEach(match => matchMap.set(match.id, match));
    
    // Override with inplay data (more up-to-date)
    inplayMatches.forEach(match => matchMap.set(match.id, match));
    
    const matches = Array.from(matchMap.values());
    console.log('[Livescores] Total matches after merge:', matches.length);
    console.log('[Livescores] Live matches:', matches.filter(m => m.status === 'live').length);
    
    return { matches };
  }),
});

