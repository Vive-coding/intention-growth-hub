/**
 * Context Builder Service
 * 
 * Builds contextual information for AI agent based on recent user activity.
 * Helps AI avoid duplicate suggestions and build on user's trajectory.
 */

import { db } from '../db';
import { 
  feedbackEvents, 
  goalDefinitions, 
  habitDefinitions, 
  insights,
  goalInstances,
  habitInstances
} from '../../shared/schema';
import { and, eq, desc, gte } from 'drizzle-orm';

export interface InsightContext {
  recentAcceptedGoals: string;
  recentAcceptedHabits: string;
  upvotedInsights: string;
  currentDailyHabitCount: number;
}

export class ContextBuilder {
  /**
   * Build comprehensive context for AI agent
   */
  static async buildInsightContext(userId: string): Promise<InsightContext> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Fetch all context in parallel for efficiency
      const [
        acceptedGoalEvents,
        acceptedHabitEvents,
        upvotedInsightEvents,
        dailyHabits
      ] = await Promise.all([
        this.getRecentAcceptedGoals(userId, thirtyDaysAgo),
        this.getRecentAcceptedHabits(userId, thirtyDaysAgo),
        this.getUpvotedInsights(userId),
        this.getCurrentDailyHabitCount(userId)
      ]);

      // Format context strings
      const recentAcceptedGoals = acceptedGoalEvents.length > 0
        ? acceptedGoalEvents.map(e => 
            `- ${e.goal.title}${e.goal.description ? ': ' + e.goal.description : ''}`
          ).join('\n')
        : 'None';

      const recentAcceptedHabits = acceptedHabitEvents.length > 0
        ? acceptedHabitEvents.map(e => 
            `- ${e.habit.name}${e.habit.description ? ': ' + e.habit.description : ''}`
          ).join('\n')
        : 'None';

      const upvotedInsights = upvotedInsightEvents.length > 0
        ? upvotedInsightEvents.map(e => 
            `- ${e.insight.title}: ${e.insight.explanation}`
          ).join('\n')
        : 'None';

      return {
        recentAcceptedGoals,
        recentAcceptedHabits,
        upvotedInsights,
        currentDailyHabitCount: dailyHabits
      };
    } catch (error) {
      console.error('Error building insight context:', error);
      // Return empty context on error
      return {
        recentAcceptedGoals: 'None',
        recentAcceptedHabits: 'None',
        upvotedInsights: 'None',
        currentDailyHabitCount: 0
      };
    }
  }

  /**
   * Get recently accepted goals from feedback events
   */
  private static async getRecentAcceptedGoals(userId: string, since: Date) {
    try {
      // Get accepted goal feedback events
      const events = await db
        .select({
          goal: goalDefinitions,
          feedback: feedbackEvents
        })
        .from(feedbackEvents)
        .innerJoin(goalDefinitions, eq(feedbackEvents.itemId, goalDefinitions.id))
        .where(and(
          eq(feedbackEvents.userId, userId),
          eq(feedbackEvents.type, 'suggested_goal'),
          eq(feedbackEvents.action, 'accept'),
          gte(feedbackEvents.createdAt, since)
        ))
        .orderBy(desc(feedbackEvents.createdAt))
        .limit(5);

      return events;
    } catch (error) {
      console.warn('Error fetching recent accepted goals:', error);
      return [];
    }
  }

  /**
   * Get recently accepted habits from feedback events
   */
  private static async getRecentAcceptedHabits(userId: string, since: Date) {
    try {
      const events = await db
        .select({
          habit: habitDefinitions,
          feedback: feedbackEvents
        })
        .from(feedbackEvents)
        .innerJoin(habitDefinitions, eq(feedbackEvents.itemId, habitDefinitions.id))
        .where(and(
          eq(feedbackEvents.userId, userId),
          eq(feedbackEvents.type, 'suggested_habit'),
          eq(feedbackEvents.action, 'accept'),
          gte(feedbackEvents.createdAt, since)
        ))
        .orderBy(desc(feedbackEvents.createdAt))
        .limit(5);

      return events;
    } catch (error) {
      console.warn('Error fetching recent accepted habits:', error);
      return [];
    }
  }

  /**
   * Get recently upvoted insights
   */
  private static async getUpvotedInsights(userId: string) {
    try {
      const events = await db
        .select({
          insight: insights,
          feedback: feedbackEvents
        })
        .from(feedbackEvents)
        .innerJoin(insights, eq(feedbackEvents.itemId, insights.id))
        .where(and(
          eq(feedbackEvents.userId, userId),
          eq(feedbackEvents.type, 'insight'),
          eq(feedbackEvents.action, 'upvote')
        ))
        .orderBy(desc(feedbackEvents.createdAt))
        .limit(5);

      return events;
    } catch (error) {
      console.warn('Error fetching upvoted insights:', error);
      return [];
    }
  }

  /**
   * Count current daily habits (active habits that user should do daily)
   */
  private static async getCurrentDailyHabitCount(userId: string): Promise<number> {
    try {
      // Count distinct active habit definitions that have active habit instances
      // A habit instance with daily frequency counts toward the daily total
      const activeHabitInstances = await db
        .select({
          habitDefId: habitInstances.habitDefinitionId,
          frequencySettings: habitInstances.frequencySettings
        })
        .from(habitInstances)
        .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
        .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
        .where(and(
          eq(habitInstances.userId, userId),
          eq(habitDefinitions.isActive, true),
          eq(goalInstances.status, 'active')
        ));

      // Count unique daily habits (dedup by habit definition ID)
      const uniqueDailyHabits = new Set<string>();
      for (const instance of activeHabitInstances) {
        const settings = instance.frequencySettings as any;
        if (settings?.frequency === 'daily') {
          uniqueDailyHabits.add(instance.habitDefId);
        }
      }

      return uniqueDailyHabits.size;
    } catch (error) {
      console.warn('Error counting daily habits:', error);
      return 0;
    }
  }
}


