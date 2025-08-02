import { toast } from "sonner";

export interface Insight {
  id: string;
  title: string;
  explanation: string;
  confidence: number;
  lifeMetrics: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  suggestedGoals: Array<{
    id: string;
    title: string;
    description?: string;
    archived: boolean;
  }>;
  suggestedHabits: Array<{
    id: string;
    title: string;
    description?: string;
    archived: boolean;
  }>;
  upvotes: number;
  downvotes: number;
  userVote?: boolean;
  createdAt: string;
  updatedAt: string;
}

class InsightsService {
  async getInsights(): Promise<Insight[]> {
    try {
      const response = await fetch('/api/insights');
      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }
      return response.json();
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Failed to load insights');
      return [];
    }
  }

  async getInsight(id: string): Promise<Insight | null> {
    try {
      const response = await fetch(`/api/insights/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch insight');
      }
      return response.json();
    } catch (error) {
      console.error('Error fetching insight:', error);
      toast.error('Failed to load insight');
      return null;
    }
  }

  async voteOnInsight(id: string, isUpvote: boolean): Promise<{ upvotes: number; downvotes: number; userVote: boolean } | null> {
    try {
      const response = await fetch(`/api/insights/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isUpvote }),
      });

      if (!response.ok) {
        throw new Error('Failed to vote on insight');
      }

      const result = await response.json();
      toast.success('Vote recorded');
      return result;
    } catch (error) {
      console.error('Error voting on insight:', error);
      toast.error('Failed to record vote');
      return null;
    }
  }

  async archiveGoal(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/insights/goals/${id}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to archive goal');
      }

      toast.success('Goal archived');
      return true;
    } catch (error) {
      console.error('Error archiving goal:', error);
      toast.error('Failed to archive goal');
      return false;
    }
  }

  async archiveHabit(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/insights/habits/${id}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to archive habit');
      }

      toast.success('Habit archived');
      return true;
    } catch (error) {
      console.error('Error archiving habit:', error);
      toast.error('Failed to archive habit');
      return false;
    }
  }
}

export const insightsService = new InsightsService(); 