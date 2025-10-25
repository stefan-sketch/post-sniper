import { createContext, useContext, useState, ReactNode } from 'react';

interface GoalCelebration {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoringTeam: 'home' | 'away';
  timestamp: number;
}

interface GoalCelebrationContextType {
  currentGoal: GoalCelebration | null;
  celebrateGoal: (goal: GoalCelebration) => void;
}

const GoalCelebrationContext = createContext<GoalCelebrationContextType | undefined>(undefined);

export function GoalCelebrationProvider({ children }: { children: ReactNode }) {
  const [currentGoal, setCurrentGoal] = useState<GoalCelebration | null>(null);

  const celebrateGoal = (goal: GoalCelebration) => {
    setCurrentGoal(goal);
    
    // Clear after 30 seconds
    setTimeout(() => {
      setCurrentGoal(null);
    }, 30000);
  };

  return (
    <GoalCelebrationContext.Provider value={{ currentGoal, celebrateGoal }}>
      {children}
    </GoalCelebrationContext.Provider>
  );
}

export function useGoalCelebration() {
  const context = useContext(GoalCelebrationContext);
  if (context === undefined) {
    throw new Error('useGoalCelebration must be used within a GoalCelebrationProvider');
  }
  return context;
}

