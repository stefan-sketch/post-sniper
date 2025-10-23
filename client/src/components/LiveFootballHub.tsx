import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { trpc } from '../lib/trpc';

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
  const [matches, setMatches] = useState<Match[]>([]);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<Competition>>(new Set());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const previousScoresRef = useRef<Map<string, number>>(new Map());

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

    // Detect new goals
    setMatches(prev => {
      return newMatches.map(newMatch => {
        const prevMatch = prev.find(m => m.id === newMatch.id);
        const prevTotal = previousScoresRef.current.get(newMatch.id) || 0;
        const newTotal = newMatch.homeScore + newMatch.awayScore;

        // Check if there's a new goal (only for live/ht/ft matches, not upcoming)
        const justScored = prevMatch && newMatch.status !== 'upcoming' && newTotal > prevTotal;

        if (justScored) {
          previousScoresRef.current.set(newMatch.id, newTotal);
        } else if (!previousScoresRef.current.has(newMatch.id)) {
          // Initialize score tracking
          previousScoresRef.current.set(newMatch.id, newTotal);
        }

        return {
          ...newMatch,
          justScored: justScored || false,
        };
      });
    });
  }, [data]);

  // Clear justScored flag after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMatches(prev => prev.map(match => 
        match.justScored ? { ...match, justScored: false } : match
      ));
    }, 5000);

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

  // Group matches by competition
  const matchesByCompetition = matches.reduce((acc, match) => {
    if (!acc[match.competition]) {
      acc[match.competition] = [];
    }
    acc[match.competition].push(match);
    return acc;
  }, {} as Record<Competition, Match[]>);

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
    const scorers = match.goalScorers.filter(s => s.team === team);
    if (scorers.length === 0) return null;
    return scorers.map(s => `${s.player} ${s.minute}'`).join(', ');
  };

  // Helper function to format kickoff time
  const formatKickoffTime = (kickoffTime: string) => {
    const date = new Date(kickoffTime);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // Helper function to get time until kickoff
  const getTimeUntilKickoff = (kickoffTime: string) => {
    const kickoff = new Date(kickoffTime).getTime();
    const now = currentTime;
    const diff = kickoff - now;
    
    if (diff <= 0) return null;
    
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return { text: `Starts in ${hours} hour${hours > 1 ? 's' : ''}`, urgent: false };
    } else if (minutes > 0) {
      return { text: `Starts in ${minutes} minute${minutes > 1 ? 's' : ''}`, urgent: minutes <= 15 };
    } else {
      return { text: 'Starting now', urgent: true };
    }
  };

  // Render match card
  const renderMatchCard = (match: Match) => {
    const homeScorers = getTeamScorers(match, 'home');
    const awayScorers = getTeamScorers(match, 'away');
    const isFinished = match.status === 'ft';
    const isLive = match.status === 'live';
    const isUpcoming = match.status === 'upcoming';
    
    return (
      <div
        key={match.id}
        className={`bg-gray-800/50 backdrop-blur-sm rounded-lg border transition-all relative ${
          isFinished ? 'p-2 opacity-60' : 'p-3'
        } ${
          match.justScored 
            ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-shake-red' 
            : isLive
            ? 'border-green-500/50 animate-pulse-border'
            : 'border-white/10 hover:border-green-500/30'
        }`}
        style={{
          animation: match.justScored ? 'shake-red 5s ease-in-out' : isLive ? 'pulse-border 2s ease-in-out infinite' : 'none'
        }}
      >
        {/* Goal Animation Overlay */}
        {match.justScored && (
          <div className="absolute inset-0 bg-red-500/10 rounded-lg pointer-events-none animate-pulse-red" 
               style={{ animation: 'pulse-red 5s ease-in-out' }} />
        )}

        {/* Match Minute / Kickoff Time / Full Time - Top Left Corner */}
        {isLive && (
          <div className="absolute top-2 left-2 text-[10px] text-red-400 font-bold z-10">
            {match.minute > 90 ? `90+${match.minute - 90}'` : match.minute > 45 && match.minute <= 50 ? `45+${match.minute - 45}'` : `${match.minute}'`}
          </div>
        )}
        {isUpcoming && (
          <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-bold z-10">
            {formatKickoffTime(match.kickoffTime)}
          </div>
        )}
        {isFinished && (
          <div className="absolute top-2 left-2 text-[9px] text-gray-500 font-medium z-10">
            Full Time
          </div>
        )}

        {/* Teams and Scores */}
        <div className={`${isFinished ? 'space-y-1' : 'space-y-3'} relative z-10`}>
          {/* Home Team */}
          <div>
            <div className="flex items-center justify-between gap-2">
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
                <span className={`${isFinished ? 'text-xs' : 'text-sm'} font-semibold text-white`}>
                  {match.homeTeam}
                </span>
              </div>
              {!isUpcoming && (
                <span className={`${isFinished ? 'text-lg' : 'text-xl'} font-bold ${
                  match.justScored ? 'text-red-400' : 'text-white'
                }`}>
                  {match.homeScore}
                </span>
              )}
            </div>
            {homeScorers && !isUpcoming && !isFinished && (
              <div className="text-[9px] text-gray-400 mt-1 pr-2">
                ⚽ {homeScorers}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div>
            <div className="flex items-center justify-between gap-2">
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
                <span className={`${isFinished ? 'text-xs' : 'text-sm'} font-medium text-gray-400`}>
                  {match.awayTeam}
                </span>
              </div>
              {!isUpcoming && (
                <span className={`${isFinished ? 'text-lg' : 'text-xl'} font-bold ${
                  match.justScored ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {match.awayScore}
                </span>
              )}
            </div>
            {awayScorers && !isUpcoming && !isFinished && (
              <div className="text-[9px] text-gray-500 mt-1 pr-2">
                ⚽ {awayScorers}
              </div>
            )}
          </div>
        </div>

        {/* Countdown for upcoming matches */}
        {isUpcoming && (() => {
          const countdown = getTimeUntilKickoff(match.kickoffTime);
          if (!countdown) return null;
          return (
            <div className={`text-[10px] text-center mt-2 font-semibold ${
              countdown.urgent ? 'text-red-500 animate-blink' : 'text-gray-400'
            }`}>
              {countdown.text}
            </div>
          );
        })()}
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
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center justify-center gap-2 flex-1">
          <h2 className="text-lg font-semibold text-white">
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center justify-center gap-2 flex-1">
          <h2 className="text-lg font-semibold text-white">
            MATCHDAY
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 overflow-y-auto flex-1 pr-2 hide-scrollbar">
        {/* Printer line - thin white line at the top */}
        <div className="sticky top-0 z-10 relative h-0.5 bg-white/30 mb-3 overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse"></div>
        </div>
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
                  {/* Competition Logo */}
                  {leagueMatches[0]?.competitionLogo && (
                    <img 
                      src={leagueMatches[0].competitionLogo} 
                      alt={competition}
                      className="w-5 h-5 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
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
                  {leagueMatches.map(match => renderMatchCard(match))}
                </div>
              )}
            </div>
          );
        })}
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

