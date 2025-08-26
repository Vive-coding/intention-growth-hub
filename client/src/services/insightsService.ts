import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";

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
  kind?: 'new' | 'reinforce';
  relatedTitle?: string;
}

class InsightsService {
  async getInsights(): Promise<Insight[]> {
    try {
      return await apiRequest('/api/insights');
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Failed to load insights');
      return [];
    }
  }

  async getInsight(id: string): Promise<Insight | null> {
    try {
      return await apiRequest(`/api/insights/${id}`);
    } catch (error) {
      console.error('Error fetching insight:', error);
      toast.error('Failed to load insight');
      return null;
    }
  }

  async voteOnInsight(id: string, isUpvote: boolean): Promise<{ upvotes: number; downvotes: number; userVote: boolean } | null> {
    try {
      const result = await apiRequest(`/api/insights/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ isUpvote }),
      });
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
      await apiRequest(`/api/insights/goals/${id}/archive`, {
        method: 'POST',
      });
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
      await apiRequest(`/api/insights/habits/${id}/archive`, {
        method: 'POST',
      });
      toast.success('Habit archived');
      return true;
    } catch (error) {
      console.error('Error archiving habit:', error);
      toast.error('Failed to archive habit');
      return false;
    }
  }

  async deleteInsight(id: string): Promise<boolean> {
    try {
      await apiRequest(`/api/insights/${id}`, { method: 'DELETE' });
      toast.success('Insight deleted');
      return true;
    } catch (error) {
      console.error('Error deleting insight:', error);
      toast.error('Failed to delete insight');
      return false;
    }
  }
}

export const insightsService = new InsightsService(); 