import { createContext, useContext, useState, ReactNode } from 'react';

interface GoalCelebration {
  id: string; // Unique ID for each goal
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeBadge?: string; // URL to home team badge
  awayBadge?: string; // URL to away team badge
  scoringTeam: 'home' | 'away';
  timestamp: number;
}

interface GoalCelebrationContextType {
  activeGoals: GoalCelebration[]; // Up to 2 active goals
  celebrateGoal: (goal: GoalCelebration) => void;
}

const GoalCelebrationContext = createContext<GoalCelebrationContextType | undefined>(undefined);

export function GoalCelebrationProvider({ children }: { children: ReactNode }) {
  const [activeGoals, setActiveGoals] = useState<GoalCelebration[]>([]);
  const [goalQueue, setGoalQueue] = useState<GoalCelebration[]>([]);

  const celebrateGoal = (goal: GoalCelebration) => {
    setActiveGoals(prev => {
      // If we have space (less than 2 active goals), add it directly
      if (prev.length < 2) {
        const newGoal = { ...goal, id: `${goal.matchId}-${Date.now()}` };
        
        // Clear this goal after 30 seconds
        setTimeout(() => {
          setActiveGoals(current => {
            const filtered = current.filter(g => g.id !== newGoal.id);
            
            // Check if there's a queued goal to show
            setGoalQueue(queue => {
              if (queue.length > 0) {
                const [nextGoal, ...remaining] = queue;
                setActiveGoals(active => [...active, nextGoal]);
                
                // Set timer for the queued goal
                setTimeout(() => {
                  setActiveGoals(curr => curr.filter(g => g.id !== nextGoal.id));
                }, 30000);
                
                return remaining;
              }
              return queue;
            });
            
            return filtered;
          });
        }, 30000);
        
        return [...prev, newGoal];
      } else {
        // Queue it if we already have 2 active goals
        const newGoal = { ...goal, id: `${goal.matchId}-${Date.now()}` };
        setGoalQueue(queue => [...queue, newGoal]);
        return prev;
      }
    });
  };

  return (
    <GoalCelebrationContext.Provider value={{ activeGoals, celebrateGoal }}>
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

