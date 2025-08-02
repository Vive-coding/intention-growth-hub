export interface Habit {
  id: string;
  title: string;
  description?: string;
  category?: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
}

export const habitsService = {
  async getHabits(): Promise<Habit[]> {
    const response = await fetch('/api/goals/habits', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch habits');
    }
    
    return response.json();
  },

  async completeHabit(habitId: string, notes?: string): Promise<any> {
    const response = await fetch(`/api/goals/habits/${habitId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ notes }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to complete habit');
    }
    
    return response.json();
  },

  async removeHabitFromGoal(goalId: string, habitId: string): Promise<any> {
    const response = await fetch(`/api/goals/${goalId}/habits/${habitId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove habit from goal');
    }
    
    return response.json();
  },
}; 