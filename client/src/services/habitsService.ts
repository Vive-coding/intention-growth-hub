import { apiRequest } from "@/lib/queryClient";

export interface Habit {
  id: string;
  title: string;
  description?: string;
  category?: string;
  lifeMetrics?: Array<{ id: string; name: string; color?: string }>; // optional list for filtering
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  status?: 'active' | 'archived';
}

export const habitsService = {
  async getHabits(status?: string): Promise<Habit[]> {
    const url = status && status !== 'all' ? `/api/goals/habits?status=${status}` : '/api/goals/habits';
    return apiRequest(url);
  },

  async completeHabit(habitId: string, notes?: string): Promise<any> {
    return apiRequest(`/api/goals/habits/${habitId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async removeHabitFromGoal(goalId: string, habitId: string): Promise<any> {
    return apiRequest(`/api/goals/${goalId}/habits/${habitId}`, {
      method: 'DELETE',
    });
  },

  async updateHabit(habitId: string, updates: { title?: string; description?: string; category?: string }) {
    return apiRequest(`/api/goals/habits/${habitId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
}; 