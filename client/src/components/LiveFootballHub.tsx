import { useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';

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
  minute: number;
  status: 'live' | 'ft' | 'ht';
  competition: Competition;
  goalScorers: GoalScorer[];
  isFavorite: boolean;
  justScored?: boolean; // For animation
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
  // Sort by minute
  goalScorers.sort((a, b) => a.minute - b.minute);
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
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
          // 15% chance to update score
          const scoreHome = Math.random() > 0.5;
          const newHomeScore = scoreHome ? match.homeScore + 1 : match.homeScore;
          const newAwayScore = !scoreHome ? match.awayScore + 1 : match.awayScore;
          
          // Check if goal was scored
          const previousTotal = previousScoresRef.current.get(match.id) || 0;
          const newTotal = newHomeScore + newAwayScore;
          const justScored = newTotal > previousTotal;
          
          if (justScored) {
            previousScoresRef.current.set(match.id, newTotal);
            
            // Add goal scorer
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

  // Clear justScored flag after animation
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMatches(prev => prev.map(match => 
        match.justScored ? { ...match, justScored: false } : match
      ));
    }, 2000);

    return () => clearTimeout(timeout);
  }, [matches]);

  const toggleFavorite = (matchId: string) => {
    setMatches(prev => prev.map(match => 
      match.id === matchId ? { ...match, isFavorite: !match.isFavorite } : match
    ));
  };

  // Sort matches: Favorites first, then by competition priority
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return competitionPriority[a.competition] - competitionPriority[b.competition];
  });

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

      {/* Matches */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-2 hide-scrollbar">
        {sortedMatches.map((match) => (
          <div
            key={match.id}
            className={`bg-gray-800/50 backdrop-blur-sm rounded-lg p-2 border transition-all relative ${
              match.justScored 
                ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] animate-pulse' 
                : match.isFavorite
                ? 'border-yellow-500/50'
                : 'border-white/10 hover:border-green-500/30'
            }`}
          >
            {/* Goal Animation Overlay */}
            {match.justScored && (
              <div className="absolute inset-0 bg-yellow-400/20 rounded-lg animate-ping pointer-events-none" />
            )}

            {/* Status, Time, and Star */}
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  match.status === 'live' 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : match.status === 'ht'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {match.status === 'live' ? `${match.minute}'` : match.status === 'ht' ? 'HT' : 'FT'}
                </span>
                <span className={`text-xs font-semibold ${competitionColors[match.competition]}`}>
                  {match.competition}
                </span>
              </div>
              <button
                onClick={() => toggleFavorite(match.id)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title={match.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star 
                  className={`w-4 h-4 transition-colors ${
                    match.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                  }`}
                />
              </button>
            </div>

            {/* Teams and Scores */}
            <div className="space-y-2 relative z-10">
              {/* Home Team */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white truncate flex-1">
                  {match.homeTeam}
                </span>
                <span className={`text-lg font-bold ml-2 min-w-[24px] text-right ${
                  match.justScored ? 'text-yellow-400 animate-bounce' : 'text-white'
                }`}>
                  {match.homeScore}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400 truncate flex-1">
                  {match.awayTeam}
                </span>
                <span className={`text-lg font-bold ml-2 min-w-[24px] text-right ${
                  match.justScored ? 'text-yellow-400 animate-bounce' : 'text-gray-400'
                }`}>
                  {match.awayScore}
                </span>
              </div>
            </div>

            {/* Goal Scorers */}
            {match.goalScorers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5 relative z-10">
                {match.goalScorers.map((scorer, idx) => (
                  <div 
                    key={idx} 
                    className={`text-[10px] ${
                      scorer.team === 'home' ? 'text-gray-300' : 'text-gray-500'
                    }`}
                  >
                    ⚽ {scorer.player} {scorer.minute}'
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

