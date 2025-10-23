import { useState, useEffect } from 'react';

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: 'live' | 'ft' | 'ht';
}

const teams = [
  'Arsenal', 'Liverpool', 'Man City', 'Man United', 'Chelsea', 'Tottenham',
  'Newcastle', 'Brighton', 'Aston Villa', 'West Ham', 'Everton', 'Fulham',
  'Brentford', 'Crystal Palace', 'Wolves', 'Bournemouth', 'Nottm Forest', 'Luton'
];

const generateRandomMatch = (): Match => {
  const homeTeam = teams[Math.floor(Math.random() * teams.length)];
  let awayTeam = teams[Math.floor(Math.random() * teams.length)];
  while (awayTeam === homeTeam) {
    awayTeam = teams[Math.floor(Math.random() * teams.length)];
  }
  
  const statusRand = Math.random();
  const status: 'live' | 'ft' | 'ht' = statusRand > 0.7 ? 'ft' : statusRand > 0.5 ? 'ht' : 'live';
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    homeTeam,
    awayTeam,
    homeScore: Math.floor(Math.random() * 5),
    awayScore: Math.floor(Math.random() * 5),
    minute: status === 'ft' ? 90 : status === 'ht' ? 45 : Math.floor(Math.random() * 90) + 1,
    status
  };
};

export default function LiveFootballHub() {
  const [matches, setMatches] = useState<Match[]>(() => 
    Array.from({ length: 8 }, generateRandomMatch)
  );

  // Update scores randomly every 5 seconds for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(prev => prev.map(match => {
        if (match.status === 'live' && Math.random() > 0.7) {
          // 30% chance to update score
          const scoreHome = Math.random() > 0.5;
          return {
            ...match,
            homeScore: scoreHome ? match.homeScore + 1 : match.homeScore,
            awayScore: !scoreHome ? match.awayScore + 1 : match.awayScore,
            minute: Math.min(match.minute + Math.floor(Math.random() * 3), 90)
          };
        }
        return match;
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-green-500 flex items-center gap-2 flex-1 justify-center">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" className="animate-pulse" />
          </svg>
          LIVE FOOTBALL HUB
        </h2>
      </div>

      {/* Separator line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent mb-3 flex-shrink-0"></div>

      {/* Matches */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-2 hide-scrollbar">
        {matches.map((match) => (
          <div
            key={match.id}
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-2 border border-white/10 hover:border-green-500/30 transition-all"
          >
            {/* Status and Time */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                match.status === 'live' 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : match.status === 'ht'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}>
                {match.status === 'live' ? `${match.minute}'` : match.status === 'ht' ? 'HT' : 'FT'}
              </span>
            </div>

            {/* Teams and Scores */}
            <div className="space-y-2">
              {/* Home Team */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white truncate flex-1">
                  {match.homeTeam}
                </span>
                <span className="text-lg font-bold text-white ml-2 min-w-[24px] text-right">
                  {match.homeScore}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400 truncate flex-1">
                  {match.awayTeam}
                </span>
                <span className="text-lg font-bold text-gray-400 ml-2 min-w-[24px] text-right">
                  {match.awayScore}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

