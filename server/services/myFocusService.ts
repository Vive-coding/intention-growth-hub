import { db } from "../db";
import { eq, desc, and, inArray } from "drizzle-orm";
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
    progress: number; // percent 0-100
    status: string;
    lifeMetric?: {
      id: string;
      name: string;
      color: string;
    };
    rank?: number;
    reason?: string;
    habitCount?: number;
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
  priorityMeta?: {
    updatedAt: string;
    sourceThreadId?: string;
  };
  pendingOptimization?: {
    summary?: string;
    recommendations: Array<{ type: string; title: string; description: string; targetId?: string }>;
    createdAt: string;
  };
}

export class MyFocusService {
  private static cache = new Map<string, { ts: number; data: MyFocusData }>();
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
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && now - cached.ts < 30_000) return cached.data;

    // Prefer latest snapshot for ordering/priorities
    const snapshot = await db
      .select()
      .from(myFocusPrioritySnapshots)
      .where(eq(myFocusPrioritySnapshots.userId, userId))
      .orderBy(desc(myFocusPrioritySnapshots.createdAt))
      .limit(1);

    let priorityGoals: MyFocusData["priorityGoals"]; let priorityMeta: MyFocusData["priorityMeta"]|undefined;
    if (snapshot[0]?.items) {
      const hydrated = await this.hydrateSnapshotGoals(userId, snapshot[0].items as any[]);
      priorityGoals = hydrated.goals;
      priorityMeta = { updatedAt: hydrated.updatedAt, sourceThreadId: (snapshot[0] as any).sourceThreadId || undefined };
    } else {
      priorityGoals = await this.getPriorityGoals(userId);
    }

    const highLeverageHabits = await this.getHighLeverageHabits(userId);
    const keyInsights = await this.getKeyInsights(userId);
    const pendingOptimization = await this.getPendingOptimization(userId);

    const data: MyFocusData = { priorityGoals, highLeverageHabits, keyInsights, ...(priorityMeta ? { priorityMeta } : {}), ...(pendingOptimization ? { pendingOptimization } : {}) };
    this.cache.set(userId, { ts: now, data });
    return data;
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

    return goals.map(g => {
      const target = g.goalInst?.targetValue || 0;
      const current = g.goalInst?.currentValue || 0;
      const percent = target > 0 ? Math.round((current / target) * 100) : Math.min(100, Math.max(0, current));
      return ({
      id: g.goalInst?.id || '',
      title: g.goalDef.title,
      description: g.goalDef.description || undefined,
      category: g.goalDef.category || undefined,
      targetDate: g.goalInst?.targetDate?.toISOString(),
      progress: Math.max(0, Math.min(100, percent)),
      status: g.goalInst?.status || 'active',
      lifeMetric: g.lifeMetric ? {
        id: g.lifeMetric.id,
        name: g.lifeMetric.name,
        color: g.lifeMetric.color,
      } : undefined,
    })});
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

  private static async hydrateSnapshotGoals(userId: string, items: Array<{ goalInstanceId: string; rank?: number; reason?: string }>): Promise<{ goals: MyFocusData["priorityGoals"]; updatedAt: string; }> {
    const ids = items.map(i => i.goalInstanceId).filter(Boolean);
    if (ids.length === 0) return { goals: [], updatedAt: new Date(0).toISOString() } as any;
    const rows = await db
      .select({ goalDef: goalDefinitions, goalInst: goalInstances, lifeMetric: lifeMetricDefinitions })
      .from(goalInstances)
      .leftJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(inArray(goalInstances.id, ids));
    const byId = new Map<string, any>(); rows.forEach(r => byId.set(r.goalInst.id, r));
    const ordered = items.map((it, idx) => {
      const g = byId.get(it.goalInstanceId); if (!g) return null;
        // Compute percent progress if targetValue is set; else use currentValue as percent clamp
        const target = g.goalInst?.targetValue || 0;
        const current = g.goalInst?.currentValue || 0;
        const percent = target > 0 ? Math.round((current / target) * 100) : Math.min(100, Math.max(0, current));

        return {
        id: g.goalInst.id,
        title: g.goalDef.title,
        description: g.goalDef.description || undefined,
        category: g.goalDef.category || undefined,
        targetDate: g.goalInst?.targetDate?.toISOString(),
          progress: Math.max(0, Math.min(100, percent)),
        status: g.goalInst?.status || 'active',
        lifeMetric: g.lifeMetric ? { id: g.lifeMetric.id, name: g.lifeMetric.name, color: g.lifeMetric.color } : undefined,
        rank: it.rank ?? idx + 1,
        reason: it.reason,
      };
    }).filter(Boolean) as MyFocusData["priorityGoals"];
    return { goals: ordered, updatedAt: new Date().toISOString() } as any;
  }

  private static async getPendingOptimization(userId: string): Promise<MyFocusData["pendingOptimization"] | undefined> {
    const rows = await db
      .select()
      .from(myFocusOptimizations)
      .where(eq(myFocusOptimizations.userId, userId))
      .orderBy(desc(myFocusOptimizations.createdAt))
      .limit(1);
    const row: any = rows[0];
    if (!row || row.status !== 'open') return undefined;
    return { summary: row.summary || undefined, recommendations: Array.isArray(row.recommendations) ? row.recommendations : [], createdAt: row.createdAt?.toISOString?.() || new Date().toISOString() };
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
