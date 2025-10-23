import { useState, useEffect, useRef } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
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
  status: 'live' | 'ft' | 'ht';
  competition: Competition;
  goalScorers: GoalScorer[];
  isFavorite: boolean;
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const previousScoresRef = useRef<Map<string, number>>(new Map());

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
      isFavorite: favorites.has(match.id),
      justScored: false,
    }));

    // Detect new goals
    setMatches(prev => {
      return newMatches.map(newMatch => {
        const prevMatch = prev.find(m => m.id === newMatch.id);
        const prevTotal = previousScoresRef.current.get(newMatch.id) || 0;
        const newTotal = newMatch.homeScore + newMatch.awayScore;

        // Check if there's a new goal
        const justScored = prevMatch && newTotal > prevTotal;

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
  }, [data, favorites]);

  // Clear justScored flag after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMatches(prev => prev.map(match => 
        match.justScored ? { ...match, justScored: false } : match
      ));
    }, 5000);

    return () => clearTimeout(timeout);
  }, [matches]);

  const toggleFavorite = (matchId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(matchId)) {
        newFavorites.delete(matchId);
      } else {
        newFavorites.add(matchId);
      }
      return newFavorites;
    });

    setMatches(prev => prev.map(match => 
      match.id === matchId ? { ...match, isFavorite: !match.isFavorite } : match
    ));
  };

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
    
    return { status: 'ft', minute: 90 };
  };

  // Helper function to get goal scorers for a team
  const getTeamScorers = (match: Match, team: 'home' | 'away') => {
    const scorers = match.goalScorers.filter(s => s.team === team);
    if (scorers.length === 0) return null;
    return scorers.map(s => `${s.player} ${s.minute}'`).join(', ');
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
            <h2 className="text-lg font-semibold text-green-500 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" className="animate-pulse" />
              </svg>
              LIVE FOOTBALL HUB
            </h2>
          </div>
        </div>

        {/* Separator line */}
        <div className="sticky top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent mb-3 flex-shrink-0"></div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">⚽</div>
            <div>No live matches at the moment</div>
            <div className="text-sm text-gray-600 mt-1">Check back during match days!</div>
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
          <h2 className="text-lg font-semibold text-green-500 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" className="animate-pulse" />
            </svg>
            LIVE FOOTBALL HUB
          </h2>
        </div>
      </div>

      {/* Separator line */}
      <div className="sticky top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent mb-3 flex-shrink-0"></div>

      {/* Leagues */}
      <div className="space-y-3 overflow-y-auto flex-1 pr-2 hide-scrollbar">
        {sortedCompetitions.map((competition) => {
          const leagueMatches = matchesByCompetition[competition];
          const isCollapsed = collapsedLeagues.has(competition);
          const leagueStatus = getLeagueStatus(competition);
          const hasFavorite = leagueMatches.some(m => m.isFavorite);
          
          return (
            <div key={competition} className="space-y-2">
              {/* League Header */}
              <div 
                className={`bg-gray-800/70 backdrop-blur-sm rounded-lg p-3 border ${
                  hasFavorite ? 'border-yellow-500/50' : 'border-white/20'
                } cursor-pointer hover:border-white/40 transition-all`}
                onClick={() => toggleLeague(competition)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      leagueStatus.status === 'live' 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : leagueStatus.status === 'ht'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {leagueStatus.status === 'live' ? `${leagueStatus.minute}'` : leagueStatus.status === 'ht' ? 'HT' : 'FT'}
                    </span>
                    
                    {/* Competition Name */}
                    <span className={`text-xs font-semibold ${competitionColors[competition]}`}>
                      {competition}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {hasFavorite && (
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    )}
                    {isCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* League Matches */}
              {!isCollapsed && (
                <div className="space-y-2 pl-2">
                  {leagueMatches.map((match) => {
                    const homeScorers = getTeamScorers(match, 'home');
                    const awayScorers = getTeamScorers(match, 'away');
                    
                    return (
                      <div
                        key={match.id}
                        className={`bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border transition-all relative ${
                          match.justScored 
                            ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-shake-red' 
                            : match.isFavorite
                            ? 'border-yellow-500/50'
                            : 'border-white/10 hover:border-green-500/30'
                        }`}
                        style={{
                          animation: match.justScored ? 'shake-red 5s ease-in-out' : 'none'
                        }}
                      >
                        {/* Goal Animation Overlay */}
                        {match.justScored && (
                          <div className="absolute inset-0 bg-red-500/10 rounded-lg pointer-events-none animate-pulse-red" 
                               style={{ animation: 'pulse-red 5s ease-in-out' }} />
                        )}

                        {/* Star Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(match.id);
                          }}
                          className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded transition-colors z-10"
                          title={match.isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star 
                            className={`w-4 h-4 transition-colors ${
                              match.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                            }`}
                          />
                        </button>

                        {/* Teams and Scores */}
                        <div className="space-y-3 relative z-10 pr-8">
                          {/* Home Team */}
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-white truncate flex-1">
                                {match.homeTeam}
                              </span>
                              <span className={`text-2xl font-bold ml-2 ${
                                match.justScored ? 'text-red-400' : 'text-white'
                              }`}>
                                {match.homeScore}
                              </span>
                            </div>
                            {homeScorers && (
                              <div className="text-[9px] text-gray-400 mt-1 truncate">
                                ⚽ {homeScorers}
                              </div>
                            )}
                          </div>

                          {/* Away Team */}
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-400 truncate flex-1">
                                {match.awayTeam}
                              </span>
                              <span className={`text-2xl font-bold ml-2 ${
                                match.justScored ? 'text-red-400' : 'text-gray-400'
                              }`}>
                                {match.awayScore}
                              </span>
                            </div>
                            {awayScorers && (
                              <div className="text-[9px] text-gray-500 mt-1 truncate">
                                ⚽ {awayScorers}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
        
        .animate-shake-red {
          animation: shake-red 5s ease-in-out;
        }
        
        .animate-pulse-red {
          animation: pulse-red 5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

