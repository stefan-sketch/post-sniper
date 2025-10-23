import { useState, useEffect, useRef } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';

type Competition = 'Champions League' | 'Europa League' | 'Conference League' | 'Premier League' | 'Championship';

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
  homeXg: number;
  awayXg: number;
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
  'Conference League': 3,
  'Premier League': 4,
  'Championship': 5,
};

const competitionColors: Record<Competition, string> = {
  'Champions League': 'text-blue-400',
  'Europa League': 'text-orange-400',
  'Conference League': 'text-green-400',
  'Premier League': 'text-purple-400',
  'Championship': 'text-yellow-400',
};

const teams: Record<Competition, string[]> = {
  'Champions League': ['Real Madrid', 'Bayern Munich', 'PSG', 'Man City', 'Barcelona', 'Liverpool'],
  'Europa League': ['Arsenal', 'Man United', 'Roma', 'Sevilla', 'Ajax', 'Porto'],
  'Conference League': ['West Ham', 'Fiorentina', 'Aston Villa', 'Brighton', 'Nice', 'Basel'],
  'Premier League': ['Chelsea', 'Tottenham', 'Newcastle', 'Fulham', 'Brentford', 'Crystal Palace'],
  'Championship': ['Leeds', 'Leicester', 'Southampton', 'Ipswich', 'West Brom', 'Norwich'],
};

const playerNames = [
  'Haaland', 'Mbappé', 'Salah', 'Kane', 'Bellingham', 'Saka', 'Foden', 'Rashford',
  'Vinicius Jr', 'Rodri', 'De Bruyne', 'Son', 'Watkins', 'Palmer', 'Isak', 'Toney'
];

const generateRandomMatch = (competition: Competition): Match => {
  const competitionTeams = teams[competition];
  const homeTeam = competitionTeams[Math.floor(Math.random() * competitionTeams.length)];
  let awayTeam = competitionTeams[Math.floor(Math.random() * competitionTeams.length)];
  while (awayTeam === homeTeam) {
    awayTeam = competitionTeams[Math.floor(Math.random() * competitionTeams.length)];
  }
  
  const statusRand = Math.random();
  const status: 'live' | 'ft' | 'ht' = statusRand > 0.7 ? 'ft' : statusRand > 0.5 ? 'ht' : 'live';
  
  const homeScore = Math.floor(Math.random() * 4);
  const awayScore = Math.floor(Math.random() * 4);
  
  // Generate xG values (usually between 0.5 and 3.5)
  const homeXg = Math.round((Math.random() * 3 + 0.5) * 10) / 10;
  const awayXg = Math.round((Math.random() * 3 + 0.5) * 10) / 10;
  
  // Generate goal scorers
  const goalScorers: GoalScorer[] = [];
  for (let i = 0; i < homeScore; i++) {
    goalScorers.push({
      player: playerNames[Math.floor(Math.random() * playerNames.length)],
      minute: Math.floor(Math.random() * 90) + 1,
      team: 'home'
    });
  }
  for (let i = 0; i < awayScore; i++) {
    goalScorers.push({
      player: playerNames[Math.floor(Math.random() * playerNames.length)],
      minute: Math.floor(Math.random() * 90) + 1,
      team: 'away'
    });
  }
  goalScorers.sort((a, b) => a.minute - b.minute);
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    homeXg,
    awayXg,
    minute: status === 'ft' ? 90 : status === 'ht' ? 45 : Math.floor(Math.random() * 90) + 1,
    status,
    competition,
    goalScorers,
    isFavorite: false,
    justScored: false,
  };
};

export default function LiveFootballHub() {
  const [matches, setMatches] = useState<Match[]>(() => {
    const competitions: Competition[] = ['Champions League', 'Europa League', 'Conference League', 'Premier League', 'Championship'];
    return competitions.flatMap(comp => [
      generateRandomMatch(comp),
      generateRandomMatch(comp)
    ]);
  });

  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<Competition>>(new Set());
  const previousScoresRef = useRef<Map<string, number>>(new Map());

  // Initialize previous scores
  useEffect(() => {
    const scoreMap = new Map<string, number>();
    matches.forEach(match => {
      scoreMap.set(match.id, match.homeScore + match.awayScore);
    });
    previousScoresRef.current = scoreMap;
  }, []);

  // Update scores randomly every 5 seconds for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(prev => prev.map(match => {
        if (match.status === 'live' && Math.random() > 0.85) {
          const scoreHome = Math.random() > 0.5;
          const newHomeScore = scoreHome ? match.homeScore + 1 : match.homeScore;
          const newAwayScore = !scoreHome ? match.awayScore + 1 : match.awayScore;
          
          const previousTotal = previousScoresRef.current.get(match.id) || 0;
          const newTotal = newHomeScore + newAwayScore;
          const justScored = newTotal > previousTotal;
          
          if (justScored) {
            previousScoresRef.current.set(match.id, newTotal);
            
            const newGoalScorer: GoalScorer = {
              player: playerNames[Math.floor(Math.random() * playerNames.length)],
              minute: match.minute,
              team: scoreHome ? 'home' : 'away'
            };
            
            return {
              ...match,
              homeScore: newHomeScore,
              awayScore: newAwayScore,
              goalScorers: [...match.goalScorers, newGoalScorer],
              minute: Math.min(match.minute + Math.floor(Math.random() * 3), 90),
              justScored: true,
            };
          }
          
          return {
            ...match,
            minute: Math.min(match.minute + Math.floor(Math.random() * 3), 90)
          };
        }
        return match;
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
                    <span className={`text-base font-semibold ${competitionColors[competition]}`}>
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
                          onClick={() => toggleFavorite(match.id)}
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
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-base font-semibold text-white truncate">
                                  {match.homeTeam}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({match.homeXg})
                                </span>
                              </div>
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
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-base font-medium text-gray-400 truncate">
                                  {match.awayTeam}
                                </span>
                                <span className="text-xs text-gray-600">
                                  ({match.awayXg})
                                </span>
                              </div>
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

