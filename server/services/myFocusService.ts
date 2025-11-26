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
  userOnboardingProfiles,
} from "../../shared/schema";

function deriveInsightTitle(title?: string | null, explanation?: string | null): string {
  const trimmedTitle = (title ?? "").trim();
  if (trimmedTitle.length >= 4) {
    return trimmedTitle;
  }

  const normalizedExplanation = (explanation ?? "").replace(/\s+/g, " ").trim();
  if (normalizedExplanation.length === 0) {
    return "Insight";
  }

  const firstSentence =
    normalizedExplanation.split(/(?<=[\.!?])\s+/).find((sentence) => sentence.trim().length > 0) ??
    normalizedExplanation;

  return firstSentence.slice(0, 110);
}

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
    currentValue?: number;
    targetValue?: number;
    frequencySettings?: {
      frequency?: string;
      perPeriodTarget?: number;
      periodsCount?: number;
    } | null;
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
  config?: {
    maxGoals: number;
  };
}

export class MyFocusService {
  private static cache = new Map<string, { ts: number; data: MyFocusData }>();
  private static readonly CACHE_TTL_MS = 0; // disable cache during development to reflect changes immediately
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
    if (this.CACHE_TTL_MS > 0 && cached && now - cached.ts < this.CACHE_TTL_MS) return cached.data;

    const [profileRow] = await db
      .select({ focusGoalLimit: userOnboardingProfiles.focusGoalLimit })
      .from(userOnboardingProfiles)
      .where(eq(userOnboardingProfiles.userId, userId))
      .limit(1);
    const configuredLimit = profileRow?.focusGoalLimit ?? 3;
    const focusGoalLimit = Math.min(Math.max(configuredLimit, 3), 5);

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
      priorityGoals = await this.getPriorityGoals(userId, focusGoalLimit);
    }

    priorityGoals = (priorityGoals || []).slice(0, focusGoalLimit);

    // Only show habits that actually move the current priority goals forward
    const priorityGoalIds = (priorityGoals || []).map(g => g.id).filter(Boolean);
    const highLeverageHabits = await this.getHighLeverageHabits(userId, priorityGoalIds);
    const keyInsights = await this.getKeyInsights(userId);
    const pendingOptimization = await this.getPendingOptimization(userId);

    const data: MyFocusData = {
      priorityGoals,
      highLeverageHabits,
      keyInsights,
      ...(priorityMeta ? { priorityMeta } : {}),
      ...(pendingOptimization ? { pendingOptimization } : {}),
      config: { maxGoals: focusGoalLimit },
    };
    if (this.CACHE_TTL_MS > 0) this.cache.set(userId, { ts: now, data });
    return data;
  }

  private static async getPriorityGoals(userId: string, limit = 3) {
    const max = Math.max(1, limit);
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
      .limit(max);

    // Compute progress the same way as the Goals page: habit-based (avg, max 90%) + manual offset
    const results: any[] = [];
    for (const g of goals) {
      let habitBasedProgress = 0;
      try {
        const associatedHabits = await db
          .select({ habitInst: habitInstances, habitDef: habitDefinitions })
          .from(habitInstances)
          .leftJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
          .where(and(eq(habitInstances.goalInstanceId, g.goalInst!.id)));

        if (associatedHabits.length > 0) {
          let total = 0;
          for (const hi of associatedHabits) {
            const target = (hi as any).habitInst?.targetValue || 0;
            const current = (hi as any).habitInst?.currentValue || 0;
            const p = target > 0 ? Math.min((current / target) * 100, 100) : 0;
            total += p;
          }
          const average = total / associatedHabits.length;
          habitBasedProgress = Math.min(average, 90);
        }
      } catch {}

      const manualOffset = g.goalInst?.currentValue || 0;
      const combined = Math.max(0, Math.min(100, habitBasedProgress + manualOffset));
      const finalProgress = (g.goalInst?.status === 'completed') ? 100 : Math.round(combined);

      results.push({
        id: g.goalInst?.id || '',
        title: g.goalDef.title,
        description: g.goalDef.description || undefined,
        category: g.goalDef.category || undefined,
        targetDate: g.goalInst?.targetDate?.toISOString(),
        progress: finalProgress,
        status: g.goalInst?.status || 'active',
        term: g.goalDef.term || undefined,
        lifeMetric: g.lifeMetric ? {
          id: g.lifeMetric.id,
          name: g.lifeMetric.name,
          color: g.lifeMetric.color,
        } : undefined,
      });
    }

    return results;
  }

  private static async getHighLeverageHabits(userId: string, priorityGoalIds?: string[]): Promise<any[]> {
    // If we have priority goals, ONLY show habits linked to those goal instances
    const limitToPriority = Array.isArray(priorityGoalIds) && priorityGoalIds.length > 0;

    // Build WHERE clause conditions
    const whereConditions = [
      eq(habitDefinitions.userId, userId),
      eq(habitDefinitions.isActive, true), // Only show active habits
      eq(goalInstances.archived, false),
      eq(goalInstances.status, 'active')
    ];

    // If filtering by priority goals, add condition to only include habits linked to those goals
    if (limitToPriority) {
      whereConditions.push(inArray(goalInstances.id, priorityGoalIds));
    }

    // Query habits - NO artificial limit when filtering by priority goals
    // Only limit to 10 if we're showing ALL habits (no priority filtering)
    const query = db
      .select({
        habitDef: habitDefinitions,
        habitInst: habitInstances,
        goalDef: goalDefinitions,
        goalInst: goalInstances,
      })
      .from(habitDefinitions)
      .innerJoin(habitInstances, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
      .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(...whereConditions))
      .orderBy(desc(habitDefinitions.createdAt));

    const habits = await query;

    // Group habits by habit definition (dedupe if same habit is linked to multiple priority goals)
    const habitMap = new Map();
    
    habits.forEach(h => {
      // All habits at this point are already filtered to priority goals if limitToPriority is true
      if (!habitMap.has(h.habitDef.id)) {
        habitMap.set(h.habitDef.id, {
          id: h.habitDef.id,
          title: h.habitDef.name,
          description: h.habitDef.description || undefined,
          frequency: (h.habitInst?.frequencySettings as any)?.frequency || 'daily',
          streak: h.habitInst?.goalSpecificStreak || h.habitDef.globalStreak || 0,
          completionRate: 0, // TODO: Calculate from completions
          currentValue: h.habitInst?.currentValue ?? null,
          targetValue: h.habitInst?.targetValue ?? null,
          frequencySettings: (h.habitInst?.frequencySettings as any) ?? null,
          linkedGoals: [],
        });
      }
      
      // Add this goal to the linkedGoals array if not already present
      if (h.goalDef && h.goalInst) {
        const existingGoal = habitMap.get(h.habitDef.id).linkedGoals.find(
          (g: any) => g.id === h.goalInst.id
        );
        if (!existingGoal) {
          habitMap.get(h.habitDef.id).linkedGoals.push({
            id: h.goalInst.id,
            title: h.goalDef.title,
          });
        }
      }
    });

    const result = Array.from(habitMap.values());
    
    // Fallback: if filtering by priority goals produced zero habits, show all active habits instead
    if (limitToPriority && result.length === 0) {
      console.log('[MyFocus] No habits found for priority goals, falling back to all active habits');
      return await this.getHighLeverageHabits(userId, undefined);
    }
    
    if (priorityGoalIds && priorityGoalIds.length > 0) {
      const priorityIndex = new Map<string, number>();
      priorityGoalIds.forEach((id, idx) => priorityIndex.set(id, idx));
      result.sort((a: any, b: any) => {
        const ranksA = (a.linkedGoals || []).map((g: any) => priorityIndex.get(g.id) ?? Number.MAX_SAFE_INTEGER);
        const ranksB = (b.linkedGoals || []).map((g: any) => priorityIndex.get(g.id) ?? Number.MAX_SAFE_INTEGER);
        const minA = ranksA.length > 0 ? Math.min(...ranksA) : Number.MAX_SAFE_INTEGER;
        const minB = ranksB.length > 0 ? Math.min(...ranksB) : Number.MAX_SAFE_INTEGER;
        if (minA !== minB) return minA - minB;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
    }

    return result;
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
      title: deriveInsightTitle(i.title, i.explanation),
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
    const ordered = await Promise.all(items.map(async (it, idx) => {
      const g = byId.get(it.goalInstanceId); if (!g) return null;
        // Compute progress same as Goals page: habit avg (cap 90) + manual offset
        let habitBasedProgress = 0;
        try {
          const associatedHabits = await db
            .select({ habitInst: habitInstances, habitDef: habitDefinitions })
            .from(habitInstances)
            .leftJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
            .where(and(eq(habitInstances.goalInstanceId, g.goalInst.id)));
          if (associatedHabits.length > 0) {
            let total = 0;
            for (const hi of associatedHabits) {
              const target = (hi as any).habitInst?.targetValue || 0;
              const current = (hi as any).habitInst?.currentValue || 0;
              const p = target > 0 ? Math.min((current / target) * 100, 100) : 0;
              total += p;
            }
            const average = total / associatedHabits.length;
            habitBasedProgress = Math.min(average, 90);
          }
        } catch {}

        const manualOffset = g.goalInst?.currentValue || 0;
        const combined = Math.max(0, Math.min(100, habitBasedProgress + manualOffset));
        const finalProgress = (g.goalInst?.status === 'completed') ? 100 : Math.round(combined);

        return {
        id: g.goalInst.id,
        title: g.goalDef.title,
        description: g.goalDef.description || undefined,
        category: g.goalDef.category || undefined,
        targetDate: g.goalInst?.targetDate?.toISOString(),
        progress: finalProgress,
        status: g.goalInst?.status || 'active',
        term: g.goalDef.term || undefined,
        lifeMetric: g.lifeMetric ? { id: g.lifeMetric.id, name: g.lifeMetric.name, color: g.lifeMetric.color } : undefined,
        rank: it.rank ?? idx + 1,
        reason: it.reason,
      };
    })).then(arr => arr.filter(Boolean) as MyFocusData["priorityGoals"]);
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
