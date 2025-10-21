import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import { 
  goalDefinitions, 
  goalInstances, 
  habitDefinitions, 
  habitInstances, 
  insights,
  lifeMetricDefinitions,
  myFocusOptimizations,
  myFocusPrioritySnapshots,
} from "../../shared/schema";

export interface MyFocusData {
  priorityGoals: Array<{
    id: string;
    title: string;
    description?: string;
    category?: string;
    targetDate?: string;
    progress: number;
    status: string;
    lifeMetric?: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  highLeverageHabits: Array<{
    id: string;
    title: string;
    description?: string;
    frequency: string;
    streak: number;
    completionRate: number;
    linkedGoals: Array<{
      id: string;
      title: string;
    }>;
  }>;
  keyInsights: Array<{
    id: string;
    title: string;
    explanation: string;
    confidence: number;
    lifeMetricIds: string[];
  }>;
}

export class MyFocusService {
  static async persistFromAgent(structured: any, opts: { userId: string; threadId?: string }): Promise<void> {
    const { userId, threadId } = opts;
    if (!structured || typeof structured !== 'object') return;

    // Prioritization snapshot (expect { type: 'prioritization', items: [{ goalInstanceId, rank, reason? }] })
    if (structured.type === 'prioritization' && Array.isArray(structured.items)) {
      try {
        await db.insert(myFocusPrioritySnapshots).values({
          userId,
          items: structured.items,
          sourceThreadId: threadId as any,
        } as any);
      } catch (e) {
        console.error('[MyFocus] failed to persist priority snapshot', e);
      }
      return;
    }

    // Optimization proposal (expect { type: 'optimization', summary, recommendations: [...] })
    if (structured.type === 'optimization' && Array.isArray(structured.recommendations)) {
      try {
        await db.insert(myFocusOptimizations).values({
          userId,
          summary: structured.summary || null,
          recommendations: structured.recommendations,
          status: 'open',
          sourceThreadId: threadId as any,
        } as any);
      } catch (e) {
        console.error('[MyFocus] failed to persist optimization', e);
      }
      return;
    }

    // Goal suggestion and insight are already persisted via existing flows; no-op here
  }
  static async getMyFocus(userId: string): Promise<MyFocusData> {
    // Get priority goals (top 3-4 active goals)
    const priorityGoals = await this.getPriorityGoals(userId);
    
    // Get high leverage habits
    const highLeverageHabits = await this.getHighLeverageHabits(userId);
    
    // Get key insights (upvoted or recent)
    const keyInsights = await this.getKeyInsights(userId);
    
    return {
      priorityGoals,
      highLeverageHabits,
      keyInsights,
    };
  }

  private static async getPriorityGoals(userId: string) {
    const goals = await db
      .select({
        goalDef: goalDefinitions,
        goalInst: goalInstances,
        lifeMetric: lifeMetricDefinitions,
      })
      .from(goalDefinitions)
      .leftJoin(goalInstances, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(
        and(
          eq(goalDefinitions.userId, userId),
          eq(goalDefinitions.archived, false),
          eq(goalInstances.archived, false),
          eq(goalInstances.status, 'active')
        )
      )
      .orderBy(desc(goalInstances.createdAt))
      .limit(4);

    return goals.map(g => ({
      id: g.goalInst?.id || '',
      title: g.goalDef.title,
      description: g.goalDef.description || undefined,
      category: g.goalDef.category || undefined,
      targetDate: g.goalInst?.targetDate?.toISOString(),
      progress: g.goalInst?.currentValue || 0,
      status: g.goalInst?.status || 'active',
      lifeMetric: g.lifeMetric ? {
        id: g.lifeMetric.id,
        name: g.lifeMetric.name,
        color: g.lifeMetric.color,
      } : undefined,
    }));
  }

  private static async getHighLeverageHabits(userId: string) {
    const habits = await db
      .select({
        habitDef: habitDefinitions,
        habitInst: habitInstances,
        goalDef: goalDefinitions,
        goalInst: goalInstances,
      })
      .from(habitDefinitions)
      .leftJoin(habitInstances, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
      .leftJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .leftJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(
        and(
          eq(habitDefinitions.userId, userId),
          eq(goalInstances.archived, false),
          eq(goalInstances.status, 'active')
        )
      )
      .orderBy(desc(habitDefinitions.createdAt))
      .limit(10);

    // Group habits by habit definition
    const habitMap = new Map();
    
    habits.forEach(h => {
      if (!habitMap.has(h.habitDef.id)) {
        habitMap.set(h.habitDef.id, {
          id: h.habitDef.id,
          title: h.habitDef.name,
          description: h.habitDef.description || undefined,
          frequency: 'daily', // Default frequency since it's not in schema
          streak: h.habitInst?.goalSpecificStreak || 0,
          completionRate: 0, // TODO: Calculate from completions
          linkedGoals: [],
        });
      }
      
      if (h.goalDef && h.goalInst) {
        habitMap.get(h.habitDef.id).linkedGoals.push({
          id: h.goalInst.id,
          title: h.goalDef.title,
        });
      }
    });

    return Array.from(habitMap.values());
  }

  private static async getKeyInsights(userId: string) {
    const insightsData = await db
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt))
      .limit(5);

    return insightsData.map(i => ({
      id: i.id,
      title: i.title,
      explanation: i.explanation,
      confidence: i.confidence,
      lifeMetricIds: [], // TODO: Add lifeMetricIds to insights schema
    }));
  }

  static async updatePriorityGoals(userId: string, goalIds: string[]): Promise<void> {
    // This would be implemented to allow users to manually set their priority goals
    // For now, we'll use the automatic selection based on recency and activity
    console.log('Priority goals update not yet implemented');
  }

  static async needsInitialSetup(userId: string): Promise<boolean> {
    const myFocus = await this.getMyFocus(userId);
    return myFocus.priorityGoals.length === 0 || myFocus.highLeverageHabits.length === 0;
  }
}
