import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useGoalCelebration } from '../contexts/GoalCelebrationContext';

type Competition = 'Champions League' | 'Europa League' | 'Premier League' | 'Championship';

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
  justScored?: boolean;
  scoringTeam?: 'home' | 'away' | null;
  homeRedCards?: number;
  awayRedCards?: number;
  justGotRedCard?: boolean;
  redCardTeam?: 'home' | 'away' | null;
}

const competitionPriority: Record<Competition, number> = {
  'Champions League': 1,
  'Europa League': 2,
  'Premier League': 3,
  'Championship': 4,
};

const competitionColors: Record<Competition, string> = {
  'Champions League': 'text-blue-400',
  'Europa League': 'text-orange-400',
  'Premier League': 'text-purple-400',
  'Championship': 'text-yellow-400',
};

export default function LiveFootballHub() {
  const { celebrateGoal } = useGoalCelebration();
  const [matches, setMatches] = useState<Match[]>([]);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<Competition>>(new Set());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [matchStatusFilter, setMatchStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  const previousStatusRef = useRef<Map<string, string>>(new Map());
  const previousRedCardsRef = useRef<Map<string, { home: number; away: number }>>(new Map());
  const [celebratingGoals, setCelebratingGoals] = useState<Set<string>>(new Set());
  const [justFinishedMatches, setJustFinishedMatches] = useState<Set<string>>(new Set());
  const [celebratingRedCards, setCelebratingRedCards] = useState<Set<string>>(new Set());

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Click-away behavior for status filter dropdown
  useEffect(() => {
    if (!showStatusFilter) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the dropdown and its trigger button
      if (!target.closest('.status-filter-dropdown') && !target.closest('.status-filter-trigger')) {
        setShowStatusFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusFilter]);

  // Fetch livescores
  const { data, refetch } = trpc.livescores.getLivescores.useQuery(undefined, {
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: true,
  });

  // Update matches when data changes
  useEffect(() => {
    if (!data?.matches) return;

    const newMatches = data.matches.map(match => ({
      ...match,
      justScored: false,
    }));

    // Detect new goals and status changes
    setMatches(prev => {
      return newMatches.map(newMatch => {
        const prevMatch = prev.find(m => m.id === newMatch.id);
        const prevTotal = previousScoresRef.current.get(newMatch.id) || 0;
        const newTotal = newMatch.homeScore + newMatch.awayScore;
        const prevStatus = previousStatusRef.current.get(newMatch.id);

        // Check if there's a new goal and which team scored
        const justScored = prevMatch && newMatch.status !== 'upcoming' && newTotal > prevTotal;
        let scoringTeam: 'home' | 'away' | null = null;
        if (justScored && prevMatch) {
          if (newMatch.homeScore > prevMatch.homeScore) {
            scoringTeam = 'home';
          } else if (newMatch.awayScore > prevMatch.awayScore) {
            scoringTeam = 'away';
          }
        }

        // Check if there's a new red card
        const prevRedCards = previousRedCardsRef.current.get(newMatch.id) || { home: 0, away: 0 };
        const newHomeRedCards = newMatch.homeRedCards || 0;
        const newAwayRedCards = newMatch.awayRedCards || 0;
        const totalPrevRedCards = prevRedCards.home + prevRedCards.away;
        const totalNewRedCards = newHomeRedCards + newAwayRedCards;
        
        const justGotRedCard = prevMatch && newMatch.status !== 'upcoming' && totalNewRedCards > totalPrevRedCards;
        let redCardTeam: 'home' | 'away' | null = null;
        if (justGotRedCard && prevMatch) {
          if (newHomeRedCards > prevRedCards.home) {
            redCardTeam = 'home';
          } else if (newAwayRedCards > prevRedCards.away) {
            redCardTeam = 'away';
          }
        }

        // Check if match just finished
        const justFinished = prevStatus && prevStatus !== 'ft' && newMatch.status === 'ft';

        if (justScored) {
          previousScoresRef.current.set(newMatch.id, newTotal);
          // Trigger celebration animation
          setCelebratingGoals(prev => new Set(prev).add(newMatch.id));
          
          // Trigger Facebook LIVE logo replacement for Premier League goals only
          if (newMatch.competition === 'Premier League' && scoringTeam) {
            celebrateGoal({
              matchId: newMatch.id,
              homeTeam: newMatch.homeTeam,
              awayTeam: newMatch.awayTeam,
              homeScore: newMatch.homeScore,
              awayScore: newMatch.awayScore,
              scoringTeam: scoringTeam,
              timestamp: Date.now(),
            });
          }
          // Remove from celebration after 5 seconds
          setTimeout(() => {
            setCelebratingGoals(prev => {
              const newSet = new Set(prev);
              newSet.delete(newMatch.id);
              return newSet;
            });
          }, 5000);
        } else if (!previousScoresRef.current.has(newMatch.id)) {
          // Initialize score tracking
          previousScoresRef.current.set(newMatch.id, newTotal);
        }

        if (justGotRedCard) {
          previousRedCardsRef.current.set(newMatch.id, { home: newHomeRedCards, away: newAwayRedCards });
          // Trigger red card animation
          setCelebratingRedCards(prev => new Set(prev).add(newMatch.id));
          // Remove from celebration after 5 seconds
          setTimeout(() => {
            setCelebratingRedCards(prev => {
              const newSet = new Set(prev);
              newSet.delete(newMatch.id);
              return newSet;
            });
          }, 5000);
        } else if (!previousRedCardsRef.current.has(newMatch.id)) {
          // Initialize red card tracking
          previousRedCardsRef.current.set(newMatch.id, { home: newHomeRedCards, away: newAwayRedCards });
        }

        // Track status changes
        if (justFinished) {
          setJustFinishedMatches(prev => new Set(prev).add(newMatch.id));
          // Remove animation flag after animation completes
          setTimeout(() => {
            setJustFinishedMatches(prev => {
              const newSet = new Set(prev);
              newSet.delete(newMatch.id);
              return newSet;
            });
          }, 700); // Match animation duration
        }
        previousStatusRef.current.set(newMatch.id, newMatch.status);

        return {
          ...newMatch,
          justScored: justScored || false,
          scoringTeam: scoringTeam,
          justGotRedCard: justGotRedCard || false,
          redCardTeam: redCardTeam,
        };
      });
    });
  }, [data]);

  // Clear justScored flag after 30 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMatches(prev => prev.map(match => 
        match.justScored ? { ...match, justScored: false } : match
      ));
    }, 30000);

    return () => clearTimeout(timeout);
  }, [matches]);

  const toggleLeague = (competition: Competition) => {
    setCollapsedLeagues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(competition)) {
        newSet.delete(competition);
      } else {
        newSet.add(competition);
      }
      return newSet;
    });
  };

  // Filter matches based on status filter
  const filteredMatches = matches.filter(match => {
    if (matchStatusFilter === 'all') return true;
    if (matchStatusFilter === 'live') return match.status === 'live' || match.status === 'ht';
    if (matchStatusFilter === 'upcoming') return match.status === 'upcoming';
    if (matchStatusFilter === 'finished') return match.status === 'ft';
    return true;
  });

  // Group matches by competition
  const matchesByCompetition = filteredMatches.reduce((acc, match) => {
    if (!acc[match.competition]) {
      acc[match.competition] = [];
    }
    acc[match.competition].push(match);
    return acc;
  }, {} as Record<Competition, Match[]>);

  // Sort matches within each competition: live/ht/upcoming first, then finished
  Object.keys(matchesByCompetition).forEach(competition => {
    matchesByCompetition[competition as Competition].sort((a, b) => {
      // Finished matches go to bottom
      if (a.status === 'ft' && b.status !== 'ft') return 1;
      if (a.status !== 'ft' && b.status === 'ft') return -1;
      // Otherwise maintain order
      return 0;
    });
  });

  // Sort competitions by priority
  const sortedCompetitions = Object.keys(matchesByCompetition).sort(
    (a, b) => competitionPriority[a as Competition] - competitionPriority[b as Competition]
  ) as Competition[];

  // Helper function to get earliest status for league header
  const getLeagueStatus = (competition: Competition) => {
    const leagueMatches = matchesByCompetition[competition];
    const liveMatch = leagueMatches.find(m => m.status === 'live');
    if (liveMatch) return { status: 'live', minute: liveMatch.minute };
    
    const htMatch = leagueMatches.find(m => m.status === 'ht');
    if (htMatch) return { status: 'ht', minute: 45 };
    
    const upcomingMatch = leagueMatches.find(m => m.status === 'upcoming');
    if (upcomingMatch) return { status: 'upcoming', minute: 0 };
    
    return { status: 'ft', minute: 90 };
  };

  // Helper function to get goal scorers for a team
  const getTeamScorers = (match: Match, team: 'home' | 'away') => {
    const scorers = match.goalScorers
      .filter(s => s.team === team)
      .sort((a, b) => a.minute - b.minute); // Sort by minute (first goal first)
    if (scorers.length === 0) return null;
    return scorers;
  };

  // Helper function to format kickoff time
  // API returns time in Europe/London timezone (BST/GMT) based on timezone parameter
  const formatKickoffTime = (kickoffTime: string) => {
    const date = new Date(kickoffTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Helper function to get time until kickoff
  const getTimeUntilKickoff = (kickoffTime: string) => {
    const kickoff = new Date(kickoffTime).getTime();
    const now = currentTime;
    const diff = kickoff - now;
    
    if (diff <= 0) return null;
    
    const totalMinutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
    // Show minute countdown when less than 1 hour
    if (totalMinutes < 60) {
      if (totalMinutes > 0) {
        return { text: `Starts in ${totalMinutes}m`, urgent: totalMinutes <= 15 };
      } else {
        return { text: 'Starting now', urgent: true };
      }
    } else if (hours > 0) {
      return { text: `Starts in ${hours} hour${hours > 1 ? 's' : ''}`, urgent: false };
    }
    
    return null;
  };

  // Render match card
  const renderMatchCard = (match: Match) => {
    const homeScorers = getTeamScorers(match, 'home');
    const awayScorers = getTeamScorers(match, 'away');
    const isFinished = match.status === 'ft';
    const isLive = match.status === 'live';
    const isUpcoming = match.status === 'upcoming';
    const isHalfTime = match.status === 'ht';
    const isCelebrating = celebratingGoals.has(match.id);
    const isRedCardCelebrating = celebratingRedCards.has(match.id);
    
    return (
      <div
        key={match.id}
        className={`bg-gray-800/50 backdrop-blur-sm rounded-lg border border-white/10 transition-all relative ${
          isFinished ? 'p-2 opacity-60' : 'p-3'
        }`}
      >
        {/* Red Card Animation Overlay */}
        {isRedCardCelebrating && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 rounded-lg animate-pulse">
            <div className="flex flex-col items-center gap-2">
              {/* Red Card Image */}
              <div className="w-16 h-24 bg-red-600 rounded-lg shadow-2xl shadow-red-600/50 flex items-center justify-center animate-bounce">
                <div className="w-12 h-20 bg-red-700 rounded-md"></div>
              </div>
              {/* RED CARD Text */}
              <div className="text-2xl font-black text-red-500 tracking-wider animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                RED CARD!
              </div>
            </div>
          </div>
        )}

        {/* Match Minute / Kickoff Time / Full Time / Half Time - Top Right Corner */}
        {isLive && (
          <div className="absolute top-2 right-2 text-[10px] text-red-400 font-bold z-10">
            {match.minute > 90 ? `90+${match.minute - 90}'` : `${match.minute}'`}
          </div>
        )}
        {isHalfTime && (
          <div className="absolute top-2 right-2 z-10 animate-pulse">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
        )}
        {isUpcoming && (
          <div className="absolute top-2 right-2 text-[10px] font-semibold text-gray-400 z-10">
            {formatKickoffTime(match.kickoffTime)}
          </div>
        )}
        {isFinished && (
          <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-semibold z-10">
            FT
          </div>
        )}

        {/* Teams and Scores */}
        <div className={`${isFinished ? 'space-y-1' : 'space-y-4'} relative z-10`}>
          {/* Home Team */}
          <div>
            <div className="flex items-center gap-2">
              {/* Home Team Logo */}
              {match.homeTeamLogo && (
                <img 
                  src={match.homeTeamLogo} 
                  alt={match.homeTeam}
                  className={`${isFinished ? 'w-4 h-4' : 'w-5 h-5'} object-contain flex-shrink-0`}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <span className={`${
                isFinished ? 'text-xs' : 
                match.homeTeam.length > 15 ? 'text-xs' : 'text-sm'
              } font-semibold truncate max-w-[140px] transition-all duration-300 ${
                isFinished ? 'text-gray-500' : 
                (match.justScored && match.scoringTeam === 'home' ? 'text-green-400 animate-pulse' : 'text-white')
              }`}>
                {match.homeTeam}
              </span>
              {/* Red Cards */}
              {(match.homeRedCards || 0) > 0 && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: match.homeRedCards || 0 }).map((_, idx) => (
                    <div key={idx} className="w-2 h-3 bg-red-600 rounded-sm"></div>
                  ))}
                </div>
              )}
              {!isUpcoming && (
                <span className={`${isFinished ? 'text-lg' : 'text-xl'} font-bold transition-all duration-300 ${
                  isFinished ? 'text-gray-500' : 
                  (match.justScored && match.scoringTeam === 'home' ? 'text-green-400 animate-pulse' : 'text-white')
                }`}>
                  {match.homeScore}
                </span>
              )}
            </div>
            {homeScorers && !isUpcoming && !isFinished && (
              <div className="text-[10px] text-gray-400 mt-1.5 pr-2 space-y-1">
                {homeScorers.map((scorer, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-[10px]">⚽</span>
                    <span>{scorer.player} {scorer.minute}'</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div>
            <div className="flex items-center gap-2">
              {/* Away Team Logo */}
              {match.awayTeamLogo && (
                <img 
                  src={match.awayTeamLogo} 
                  alt={match.awayTeam}
                  className={`${isFinished ? 'w-4 h-4' : 'w-5 h-5'} object-contain flex-shrink-0`}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <span className={`${
                isFinished ? 'text-xs' : 
                match.awayTeam.length > 15 ? 'text-xs' : 'text-sm'
              } font-semibold truncate max-w-[140px] transition-all duration-300 ${
                isFinished ? 'text-gray-500' : 
                (match.justScored && match.scoringTeam === 'away' ? 'text-green-400 animate-pulse' : 'text-white')
              }`}>
                {match.awayTeam}
              </span>
              {/* Red Cards */}
              {(match.awayRedCards || 0) > 0 && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: match.awayRedCards || 0 }).map((_, idx) => (
                    <div key={idx} className="w-2 h-3 bg-red-600 rounded-sm"></div>
                  ))}
                </div>
              )}
              {!isUpcoming && (
                <span className={`${isFinished ? 'text-lg' : 'text-xl'} font-bold transition-all duration-300 ${
                  isFinished ? 'text-gray-500' : 
                  (match.justScored && match.scoringTeam === 'away' ? 'text-green-400 animate-pulse' : 'text-white')
                }`}>
                  {match.awayScore}
                </span>
              )}
            </div>
            {awayScorers && !isUpcoming && !isFinished && (
              <div className="text-[10px] text-gray-400 mt-1.5 pr-2 space-y-1">
                {awayScorers.map((scorer, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-[10px]">⚽</span>
                    <span>{scorer.player} {scorer.minute}'</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


      </div>
    );
  };

  // Show loading or empty state
  if (!data) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-400">
        <div className="animate-pulse">Loading live scores...</div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center justify-center gap-2 flex-1">
          <h2 className="text-base font-semibold text-white" style={{ lineHeight: '1.5rem', margin: 0, padding: 0 }}>
            MATCHDAY
          </h2>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">⚽</div>
            <div>No matches today</div>
            <div className="text-sm text-gray-600 mt-1">Check back on match days!</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ paddingTop: '0px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2" style={{ minHeight: '28px' }}>
        <div className="flex items-center justify-center gap-2 flex-1">
          {/* Test Goal Buttons (for demo) */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                celebrateGoal({
                  id: '', // Will be auto-generated
                  matchId: 'test-1',
                  homeTeam: 'Arsenal',
                  awayTeam: 'Chelsea',
                  homeScore: 2,
                  awayScore: 1,
                  homeBadge: 'https://resources.premierleague.com/premierleague/badges/t3.svg',
                  awayBadge: 'https://resources.premierleague.com/premierleague/badges/t8.svg',
                  scoringTeam: 'home',
                  timestamp: Date.now(),
                });
              }}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              title="Test goal 1"
            >
              Goal 1 ⚽
            </button>
            <button
              onClick={() => {
                celebrateGoal({
                  id: '', // Will be auto-generated
                  matchId: 'test-2',
                  homeTeam: 'Man City',
                  awayTeam: 'Liverpool',
                  homeScore: 1,
                  awayScore: 2,
                  homeBadge: 'https://resources.premierleague.com/premierleague/badges/t43.svg',
                  awayBadge: 'https://resources.premierleague.com/premierleague/badges/t14.svg',
                  scoringTeam: 'away',
                  timestamp: Date.now(),
                });
              }}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              title="Test goal 2"
            >
              Goal 2 ⚽
            </button>
            <button
              onClick={() => {
                celebrateGoal({
                  id: '', // Will be auto-generated
                  matchId: 'test-3',
                  homeTeam: 'Man Utd',
                  awayTeam: 'Spurs',
                  homeScore: 3,
                  awayScore: 0,
                  homeBadge: 'https://resources.premierleague.com/premierleague/badges/t1.svg',
                  awayBadge: 'https://resources.premierleague.com/premierleague/badges/t6.svg',
                  scoringTeam: 'home',
                  timestamp: Date.now(),
                });
              }}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              title="Test goal 3 (queued)"
            >
              Goal 3 ⚽
            </button>
          </div>
          {/* Integrated MATCHDAY + Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              className="status-filter-trigger flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-base font-semibold text-white" style={{ lineHeight: '1.5rem', margin: 0, padding: 0 }}>
                MATCHDAY
              </h2>
              <div className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white shadow-sm flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {matchStatusFilter === 'all' ? 'All' : matchStatusFilter === 'live' ? 'Live' : matchStatusFilter === 'upcoming' ? 'Upcoming' : 'Finished'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {showStatusFilter && (
              <div className="status-filter-dropdown absolute top-full right-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] w-[140px] max-w-[calc(100vw-2rem)]">
                {['all', 'live', 'upcoming', 'finished'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setMatchStatusFilter(status as typeof matchStatusFilter);
                      setShowStatusFilter(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      matchStatusFilter === status ? 'bg-white border-white' : 'border-gray-600'
                    }`}>
                      {matchStatusFilter === status && (
                        <svg className="w-3 h-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={matchStatusFilter === status ? 'text-white font-medium' : 'text-gray-400'}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content with printer line inside */}
      <div className="overflow-y-auto flex-1 pr-2 hide-scrollbar">
        {/* Printer line - thin white line where new matches emerge from */}
        <div className="sticky top-0 z-10 relative h-0.5 bg-white/40 mb-3 overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse"></div>
        </div>
        <div className="space-y-3">
        {/* League Sections */}
        {sortedCompetitions.map((competition) => {
          const leagueMatches = matchesByCompetition[competition];
          const isCollapsed = collapsedLeagues.has(competition);
          const leagueStatus = getLeagueStatus(competition);
          
          return (
            <div key={competition} className="space-y-2">
              {/* League Header - Simple text without card */}
              <div 
                className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity py-1 px-1"
                onClick={() => toggleLeague(competition)}
              >
                <div className="flex items-center gap-2">
                  {/* Competition Name with Match Count */}
                  <span className={`text-xs font-semibold ${competitionColors[competition]}`}>
                    {competition} ({leagueMatches.length})
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* League Matches */}
              {!isCollapsed && (
                <div className="space-y-2">
                  {leagueMatches.map(match => (
                    <div
                      key={match.id}
                      className="transition-all duration-700 ease-in-out"
                      style={{
                        animation: justFinishedMatches.has(match.id) ? 'slideToBottom 0.7s ease-in-out' : 'none'
                      }}
                    >
                      {renderMatchCard(match)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      <style>{`
        @keyframes shake-red {
          0%, 100% { transform: translateX(0); }
          2%, 6%, 10%, 14%, 18% { transform: translateX(-8px); }
          4%, 8%, 12%, 16%, 20% { transform: translateX(8px); }
          22% { transform: translateX(0); }
        }
        
        @keyframes pulse-red {
          0%, 100% { opacity: 0; }
          5%, 15% { opacity: 0.15; }
          10% { opacity: 0.25; }
          20% { opacity: 0; }
        }

        @keyframes pulse-border {
          0%, 100% { 
            border-color: rgba(34, 197, 94, 0.3);
            box-shadow: 0 0 0 rgba(34, 197, 94, 0);
          }
          50% { 
            border-color: rgba(34, 197, 94, 0.8);
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
          }
        }
        
        .animate-shake-red {
          animation: shake-red 5s ease-in-out;
        }
        
        .animate-pulse-red {
          animation: pulse-red 5s ease-in-out;
        }

        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

