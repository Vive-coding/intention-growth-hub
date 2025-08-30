import { Router } from "express";
import { db } from "../db";

console.log('=== GOALS ROUTES FILE === Loading goals routes file...');
import { and, eq, desc, sql, inArray, gte, lt, lte } from "drizzle-orm";
import { 
  goalDefinitions, 
  goalInstances,
  suggestedGoals,
  suggestedHabits,
  habitCompletions,
  habitDefinitions,
  habitInstances,
  insights,
  lifeMetricDefinitions,
  type GoalDefinition,
  type GoalInstance,
  type SuggestedGoal,
  type SuggestedHabit,
  type HabitCompletion,
  type HabitDefinition,
  type HabitInstance,
} from "../../shared/schema";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { embedQuery, embedTexts } from "../ai/utils/embeddings";
import { embedNormalized, cosineSimilarity, decideSimilarity, conceptHash } from "../utils/textSimilarity";
import { suggestionMemory } from "../../shared/schema";
import { lt as ltOp, gte as gteOp } from "drizzle-orm";

interface AuthenticatedRequest extends Request {
  user: {
    claims: {
      sub: string;
    };
  };
}

const router = Router();

// Helper to compute a user's start/end of "today" in UTC based on their timezone
async function getUserTodayWindow(userId: string) {
  try {
    const { users } = await import('../../shared/schema');
    const rows = await db.select().from(users).where(eq(users.id as any, userId as any)).limit(1);
    const tz = (rows[0] as any)?.timezone || process.env.DEFAULT_TZ || 'UTC';
    
    console.log('getUserTodayWindow: starting with timezone:', tz);
    
    // Get the user's current local date in their timezone
    const now = new Date();
    
    // Convert to user's timezone and get start/end of their current day
    // Format: YYYY-MM-DD in user's timezone
    const userLocalDate = now.toLocaleDateString('en-CA', { timeZone: tz }); // en-CA gives YYYY-MM-DD format
    
    // Create start of day in user's timezone, then convert to UTC
    const startOfDay = new Date(`${userLocalDate}T00:00:00`);
    const start = new Date(startOfDay.toLocaleString('en-US', { timeZone: tz }));
    
    // Create end of day in user's timezone, then convert to UTC  
    const endOfDay = new Date(`${userLocalDate}T23:59:59.999`);
    const end = new Date(endOfDay.toLocaleString('en-US', { timeZone: tz }));
    
    console.log('getUserTodayWindow: using timezone-aware window:', {
      userId,
      timezone: tz,
      userLocalDate,
      serverNow: now.toISOString(),
      start: start.toISOString(),
      end: end.toISOString(),
      startLocal: start.toLocaleString('en-US', { timeZone: tz }),
      endLocal: end.toLocaleString('en-US', { timeZone: tz })
    });
    
    return { start, end };
  } catch (error) {
    console.error('getUserTodayWindow error:', error);
    // Fallback to server's local day
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end };
  }
}

// Get all goals for the authenticated user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const metricFilter = req.query.metric as string;
    const statusFilter = req.query.status as string; // New: filter by status (active, completed, archived)
    const showArchived = req.query.showArchived === 'true'; // New: show archived goals
    
    console.log('=== GOALS ENDPOINT DEBUG ===');
    console.log('Goals endpoint called with metricFilter:', metricFilter);
    console.log('Status filter:', statusFilter);
    console.log('Show archived:', showArchived);
    console.log('All query params:', req.query);
    console.log('metricFilter type:', typeof metricFilter);
    console.log('metricFilter length:', metricFilter?.length);
    console.log('===========================');

    // Build where conditions for filtering
    const whereConditions = [eq(goalDefinitions.userId, userId)];
    
    // Filter by archived status
    if (showArchived) {
      // When showing archived, only show archived goals
      whereConditions.push(eq(goalDefinitions.archived, true));
      whereConditions.push(eq(goalInstances.archived, true));
    } else {
      // When not showing archived, only show non-archived goals
      whereConditions.push(eq(goalDefinitions.archived, false));
      whereConditions.push(eq(goalInstances.archived, false));
    }
    
    // Filter by status if specified
    if (statusFilter) {
      whereConditions.push(eq(goalInstances.status, statusFilter));
    }
    
    // Get goals with their instances
    const goalsWithInstances = await db
      .select({
        goalDefinition: goalDefinitions,
        goalInstance: goalInstances,
      })
      .from(goalDefinitions)
      .innerJoin(goalInstances, eq(goalDefinitions.id, goalInstances.goalDefinitionId))
      .where(and(...whereConditions))
      .orderBy(desc(goalInstances.createdAt));

    // Get life metrics for mapping
    const lifeMetrics = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));

    // Get associated habits for each goal instance
    const habitInstancesMap = new Map();
    for (const { goalDefinition, goalInstance } of goalsWithInstances) {
      const associatedHabits = await db
        .select({
          habitInstance: habitInstances,
          habitDefinition: habitDefinitions,
        })
        .from(habitInstances)
        .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
        .where(eq(habitInstances.goalInstanceId, goalInstance.id));
      
      habitInstancesMap.set(goalInstance.id, associatedHabits);
    }

    // Transform to simplified structure
    const simplifiedGoals = await Promise.all(goalsWithInstances.map(async ({ goalDefinition, goalInstance }) => {
      // Find the life metric by direct UUID relationship
      const lifeMetric = lifeMetrics.find(lm => lm.id === goalDefinition.lifeMetricId);
      
      console.log(`Mapping goal "${goalDefinition.title}" to life metric: "${lifeMetric?.name || 'NOT FOUND'}"`);
      
      const lifeMetricData = lifeMetric || {
        id: goalDefinition.category || "general",
        name: goalDefinition.category || "General",
        color: "#6B7280"
      };

      // Filter by metric if specified - SIMPLE UUID COMPARISON
      if (metricFilter && metricFilter.trim() !== "") {
        // Find the life metric by name to get its UUID
        const targetLifeMetric = lifeMetrics.find(lm => lm.name === metricFilter);
        if (targetLifeMetric && goalDefinition.lifeMetricId !== targetLifeMetric.id) {
          console.log(`Filtering out goal "${goalDefinition.title}" - goal lifeMetricId: "${goalDefinition.lifeMetricId}" !== target: "${targetLifeMetric.id}"`);
          return null;
        } else if (targetLifeMetric) {
          console.log(`Keeping goal "${goalDefinition.title}" - matches target life metric: "${targetLifeMetric.name}"`);
        }
      }

      // Get associated habits for this goal with streak and completion data
      const associatedHabits = habitInstancesMap.get(goalInstance.id) || [];
      const habits = await Promise.all(associatedHabits.map(async (hi: any) => {
        // Get habit completions for streak calculation
        const completions = await db
          .select()
          .from(habitCompletions)
          .where(and(eq(habitCompletions.habitDefinitionId, hi.habitDefinition.id), eq(habitCompletions.userId, userId)))
          .orderBy(desc(habitCompletions.completedAt));

        let currentStreak = 0;
        let longestStreak = 0;
        let lastCompletionDate: Date | null = null;

        for (const completion of completions) {
          const normalize = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
          if (lastCompletionDate === null) {
            currentStreak = 1;
          } else {
            const daysDiff = Math.round((normalize(lastCompletionDate).getTime() - normalize(completion.completedAt).getTime()) / (1000*60*60*24));
            if (daysDiff === 1) {
            currentStreak++;
            } else if (daysDiff === 0) {
              // same day completion; ignore for streak increment
          } else {
            currentStreak = 1;
            }
          }
          longestStreak = Math.max(longestStreak, currentStreak);
          lastCompletionDate = completion.completedAt;
        }

        return {
          id: hi.habitDefinition.id,
          title: hi.habitDefinition.name,
          description: hi.habitDefinition.description,
          category: hi.habitDefinition.category,
          currentStreak: hi.habitInstance.goalSpecificStreak,
          longestStreak,
          totalCompletions: completions.length,
          targetValue: hi.habitInstance.targetValue,
          currentValue: hi.habitInstance.currentValue,
        };
      }));

      // Calculate goal progress based on associated habits (same logic as drill-down)
      let calculatedProgress = 0;
      let habitBasedProgress = 0;
      
      if (associatedHabits.length > 0) {
        let totalProgress = 0;
        
        console.log(`Calculating progress for goal: ${goalDefinition.title} (${goalInstance.id})`);
        console.log(`Associated habits: ${associatedHabits.length}`);
        
        for (const hi of associatedHabits) {
          const habitProgress = hi.habitInstance.targetValue > 0 ? 
            Math.min(((hi.habitInstance.currentValue || 0) / hi.habitInstance.targetValue) * 100, 100) : 0;
          totalProgress += habitProgress;
          
          console.log(`Habit progress: ${hi.habitDefinition.name} - ${habitProgress}% (${hi.habitInstance.currentValue}/${hi.habitInstance.targetValue})`);
        }
        
        // Calculate average progress (max 90% from habits)
        const averageProgress = totalProgress / associatedHabits.length;
        habitBasedProgress = Math.min(averageProgress, 90);
        
        console.log(`Habit-based progress calculation: ${totalProgress} total, ${averageProgress} average, ${habitBasedProgress} final`);
      }

      // New logic: currentValue stores manual adjustment offset
      const manualOffset = goalInstance.currentValue || 0;
      console.log(`Manual adjustment offset: ${manualOffset}`);
      console.log(`Habit-based progress: ${habitBasedProgress}`);
      
      // Calculate total progress: habit progress + manual offset (capped 0-100)
      calculatedProgress = Math.max(0, Math.min(100, habitBasedProgress + manualOffset));
      
      console.log(`Combined progress: habit=${habitBasedProgress} + manual=${manualOffset} = ${calculatedProgress}`);

      // Only mark as completed if it was manually completed, not from habit progress
      // Goals can reach 90% from habits but need manual completion to reach 100%
      let finalProgress = goalInstance.status === "completed" ? 100 : Math.round(calculatedProgress);
      let finalStatus = goalInstance.status;
      let finalCompletedAt = goalInstance.completedAt;

      return {
        id: goalInstance.id,
        title: goalDefinition.title,
        description: goalDefinition.description,
        lifeMetricId: lifeMetricData.id,
        lifeMetric: {
          name: lifeMetricData.name,
          color: lifeMetricData.color,
        },
        progress: finalProgress,
        createdAt: goalInstance.createdAt,
        completedAt: finalCompletedAt,
        targetDate: goalInstance.targetDate,
        status: finalStatus,
        habits, // Include associated habits
      };
    }));

    // Filter out nulls and return only goals that match the metric filter
    const filteredSimplifiedGoals = simplifiedGoals.filter((goal): goal is NonNullable<typeof goal> => goal !== null);

    res.json(filteredSimplifiedGoals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// Delete a habit definition (used when user cancels target setup after creating a habit)
router.delete("/habits/:definitionId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const { definitionId } = req.params;

    // Ensure habit belongs to user
    const habit = await db
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.id, definitionId), eq(habitDefinitions.userId, userId)))
      .limit(1);
    if (!habit[0]) {
      return res.status(404).json({ error: "Habit not found" });
    }

    // Deleting the definition will cascade delete instances and completions via FK
    await db
      .delete(habitDefinitions)
      .where(and(eq(habitDefinitions.id, definitionId), eq(habitDefinitions.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting habit definition:", error);
    res.status(500).json({ error: "Failed to delete habit" });
  }
});

// Get suggested goals
router.get("/suggested", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const mode = String((req.query.mode as string) || 'new');

    const suggestedGoalsWithInsights = await db
      .select({
        suggestedGoal: suggestedGoals,
        insight: insights,
        lifeMetric: lifeMetricDefinitions,
      })
      .from(suggestedGoals)
      .innerJoin(insights, eq(suggestedGoals.insightId, insights.id))
      .innerJoin(lifeMetricDefinitions, eq(suggestedGoals.lifeMetricId, lifeMetricDefinitions.id))
      .where(and(
        eq(insights.userId, userId),
        eq(suggestedGoals.archived, false)
      ))
      .orderBy(desc(suggestedGoals.createdAt));

    // Load user's current goals (with instances) for active filtering
    const currentGoals = await db
      .select({ gd: goalDefinitions, gi: goalInstances })
      .from(goalDefinitions)
      .leftJoin(goalInstances, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalDefinitions.userId, userId));

    // Preload life metrics for existing items
    const allLifeMetrics = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));
    const lmById = new Map((allLifeMetrics as any[]).map((lm:any)=>[lm.id, lm]));

    // Restrict de-dup reference set to ACTIVE goals only
    const activeExistingGoals = currentGoals.filter((g:any)=> g.gd.archived === false && g.gi && g.gi.status === 'active' && g.gi.archived === false);
    const existingTexts = activeExistingGoals.map((g:any) => `${g.gd.title}\n${g.gd.description || ''}`);
    const existingGoalMetrics = activeExistingGoals.map((g:any) => g.gd.lifeMetricId || null);
    const suggestionTexts = suggestedGoalsWithInsights.map(({ suggestedGoal }) => `${suggestedGoal.title}\n${suggestedGoal.description || ''}`);
    const [existingEmbs, suggestionEmbs] = await Promise.all([
      embedNormalized(existingTexts),
      embedNormalized(suggestionTexts),
    ]);

    const existingReturned: any[] = [];
    const mappedGoals = await Promise.all(suggestedGoalsWithInsights.map(async ({ suggestedGoal, insight, lifeMetric }, idx) => {
      // Compute max similarity vs existing goals
      let maxSim = 0; let matchId: string | undefined;
      // Only compare against existing goals within the SAME life metric to avoid cross-topic collisions
      for (let i = 0; i < existingEmbs.length; i++) {
        if (existingGoalMetrics[i] !== suggestedGoal.lifeMetricId) continue;
        const sim = cosineSimilarity(suggestionEmbs[idx] as any, existingEmbs[i] as any);
        if (sim > maxSim) { maxSim = sim; matchId = activeExistingGoals[i]?.gd?.id; }
      }
      const decision = decideSimilarity(maxSim);
      const kind = decision.relation === 'duplicate' ? 'reinforce' : decision.relation === 'similar' ? 'reinforce' : 'new';
      const cHash = conceptHash(`${suggestedGoal.title}\n${suggestedGoal.description || ''}`);

      // If duplicate vs ACTIVE goal -> auto-archive suggestion and emit the ORIGINAL instead
      if (decision.relation === 'duplicate' && matchId) {
        const matchRow = activeExistingGoals.find((g:any)=> g.gd.id === matchId);
        const isActive = matchRow && matchRow.gi && matchRow.gi.status === 'active' && matchRow.gi.archived === false && matchRow.gd.archived === false;
        if (isActive) {
          try { await db.update(suggestedGoals).set({ archived: true }).where(eq(suggestedGoals.id, suggestedGoal.id)); } catch {}
          const lm = matchRow.gd.lifeMetricId ? lmById.get(matchRow.gd.lifeMetricId as any) : undefined;
          const existingItem = {
            kind: 'existing' as const,
            type: 'goal' as const,
            existingId: matchRow.gd.id,
            existingTitle: matchRow.gd.title,
            description: suggestedGoal.description || matchRow.gd.description,
            lifeMetric: lm ? { id: lm.id, name: lm.name, color: lm.color } : undefined,
            similarity: Number(maxSim.toFixed(3)),
            sourceInsightId: insight.id,
            sourceInsightTitle: insight.title,
            conceptHash: conceptHash(`${matchRow.gd.title}\n${insight.id}`),
          };
          existingReturned.push(existingItem);
          // Return null for this suggestion to exclude from normal suggestions
          return null as any;
        }
      }
      return {
      id: suggestedGoal.id,
      title: suggestedGoal.title,
      description: suggestedGoal.description,
      insight: {
        id: insight.id,
        title: insight.title,
        explanation: insight.explanation,
      },
      lifeMetric: {
        id: lifeMetric.id,
        name: lifeMetric.name,
        color: lifeMetric.color,
      },
      createdAt: suggestedGoal.createdAt,
        similarity: Number(maxSim.toFixed(3)),
        kind,
        duplicateOfId: decision.relation === 'duplicate' ? matchId : undefined,
        relatedId: (decision.relation === 'duplicate' || decision.relation === 'similar') ? matchId : undefined,
        relatedTitle: (decision.relation === 'duplicate' || decision.relation === 'similar') ? currentGoals.find((g: any) => g.gd.id === matchId)?.gd?.title : undefined,
        conceptHash: cHash,
      };
    }))
    const simplifiedSuggestedGoals = (mappedGoals.filter((g:any)=> g !== null))
    // suppress exact duplicates from "new" surface now
    .filter(item => item.kind !== 'new' || (item.similarity ?? 0) < 0.86);

    if (mode === 'reinforcements') {
      // Compute reinforcement directly from latest (or specified) insight vs ACTIVE goals
      const sourceInsightId = (req.query.sourceInsightId as string) || null;
      const baseInsight = sourceInsightId
        ? await db.query.insights.findFirst({ where: and(eq(insights.userId, userId), eq(insights.id, sourceInsightId)) })
        : await db.query.insights.findFirst({ where: eq(insights.userId, userId), orderBy: desc(insights.createdAt) as any });
      if (!baseInsight) { return res.json([]); }

      const activeGoals = await db
        .select({ gd: goalDefinitions, gi: goalInstances, lm: lifeMetricDefinitions })
        .from(goalDefinitions)
        .innerJoin(goalInstances, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
        .where(and(eq(goalDefinitions.userId, userId), eq(goalDefinitions.archived, false), eq(goalInstances.status, 'active'), eq(goalInstances.archived, false)));

      const insightText = `${baseInsight.title}\n${baseInsight.explanation}`;
      const goalTexts = activeGoals.map((g:any)=> `${g.gd.title}\n${g.gd.description || ''}`);
      const [insEmbArr, goalEmbs] = await Promise.all([
        embedNormalized([insightText]),
        embedNormalized(goalTexts),
      ]);
      const insEmb = insEmbArr[0] as any;
      const matches = activeGoals.map((g:any, i:number)=> ({
        existingId: g.gd.id,
        existingTitle: g.gd.title,
        description: g.gd.description,
        lifeMetric: g.lm ? { id: g.lm.id, name: g.lm.name, color: g.lm.color } : undefined,
        similarity: Number(cosineSimilarity(insEmb, goalEmbs[i] as any).toFixed(3)),
      }))
      .filter(m => (m.similarity ?? 0) >= 0.75)
      .sort((a,b)=> (b.similarity - a.similarity))
      .map(m => ({
        type: 'goal' as const,
        ...m,
        sourceInsightId: baseInsight.id,
        sourceInsightTitle: baseInsight.title,
        conceptHash: conceptHash(`${m.existingTitle}\n${baseInsight.id}`),
      }));

      // Cooldown for reinforcements
      const sevenDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const memory = await db.select().from(suggestionMemory).where(and(
        eq(suggestionMemory.userId, userId),
        eq(suggestionMemory.type, 'reinforcement_goal'),
        gte(suggestionMemory.lastShownAt, sevenDaysAgo)
      ));
      const recent = new Set(memory.map((m:any) => m.conceptHash));
      const cooled = matches.filter(r => !recent.has(r.conceptHash as any));
      for (const r of cooled) {
        try {
          await db.insert(suggestionMemory).values({ userId, type: 'reinforcement_goal', conceptHash: r.conceptHash as any, itemId: r.existingId as any, lastShownAt: new Date() });
        } catch {}
      }
      res.json(cooled.map(({ conceptHash, ...rest }) => rest));
      return;
    }

    // Default (new suggestions) with cooldown and include existingReturned (cooldown separately)
    const sevenDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const memory = await db.select().from(suggestionMemory).where(and(
      eq(suggestionMemory.userId, userId),
      eq(suggestionMemory.type, 'suggested_goal'),
      gte(suggestionMemory.lastShownAt, sevenDaysAgo)
    ));
    const recent = new Set(memory.map((m:any) => m.conceptHash));
    let cooled = simplifiedSuggestedGoals.filter(g => !recent.has(g.conceptHash as any));
    // Guard: if cooldown would zero-out all novel items, bypass cooldown for this response
    if (cooled.length === 0 && simplifiedSuggestedGoals.length > 0) {
      cooled = simplifiedSuggestedGoals;
    }
    for (const g of cooled) {
      try {
        await db.insert(suggestionMemory).values({ userId, type: 'suggested_goal', conceptHash: g.conceptHash as any, itemId: g.id, lastShownAt: new Date() });
      } catch {}
    }
    // Cooldown for existing originals surfaced
    const memoryExisting = await db.select().from(suggestionMemory).where(and(
      eq(suggestionMemory.userId, userId),
      eq(suggestionMemory.type, 'reinforcement_goal'),
      gte(suggestionMemory.lastShownAt, sevenDaysAgo)
    ));
    const recentExisting = new Set(memoryExisting.map((m:any)=> m.conceptHash));
    const cooledExisting = existingReturned.filter(r => !recentExisting.has(r.conceptHash as any));
    for (const r of cooledExisting) {
      try { await db.insert(suggestionMemory).values({ userId, type: 'reinforcement_goal', conceptHash: r.conceptHash as any, itemId: r.existingId as any, lastShownAt: new Date() }); } catch {}
    }
    
    // If no new suggestions survived cooldown, ensure we still show existing items
    let finalItems = [];
    if (cooled.length > 0) {
      // If we have new suggestions, include both new and existing
      finalItems = [
        ...cooledExisting.map(({ conceptHash, ...rest }) => rest),
        ...cooled.map(({ conceptHash, ...rest }) => rest),
      ];
    } else if (existingReturned.length > 0) {
      // If no new suggestions, show existing items regardless of cooldown
      finalItems = existingReturned.map(({ conceptHash, ...rest }) => rest);
    }

    // No fallback: if nothing survived, return an empty list so the client shows an empty state
    if (finalItems.length === 0) {
      res.set('X-Suggest-Fallback', '0');
    }

    // Diagnostics: add rich stats to headers and logs
    try {
      const mappedNonNull: any[] = (mappedGoals as any[]).filter(Boolean);
      const rawCandidates = (suggestedGoalsWithInsights as any[]).length;
      const newCandidates = mappedNonNull.filter((m:any)=> m.kind === 'new').length;
      const reinforceCandidates = mappedNonNull.filter((m:any)=> m.kind === 'reinforce').length;
      const newAfterSimFilter = (simplifiedSuggestedGoals as any[]).filter((m:any)=> m.kind === 'new').length;
      const newFilteredBySim86 = newCandidates - newAfterSimFilter;
      const cooldownNewFiltered = (simplifiedSuggestedGoals as any[]).length - (cooled as any[]).length;
      const cooldownExistingFiltered = (existingReturned as any[]).length - (cooledExisting as any[]).length;
      const duplicatesAutoArchived = (existingReturned as any[]).length;
      const returnedExistingCount = (finalItems as any[]).filter((i:any)=> i && i.existingId).length;
      const newReturnedCount = (finalItems as any[]).length - returnedExistingCount;

      const stats = {
        mode: 'default',
        returned: finalItems.length,
        returnedExisting: returnedExistingCount,
        returnedNew: newReturnedCount,
        rawCandidates,
        newCandidates,
        reinforceCandidates,
        newFilteredBySim86,
        cooldownNewFiltered,
        duplicatesAutoArchived,
        cooldownExistingFiltered,
      } as const;
      // Header + server log for quick inspection
      res.set('X-Suggest-Stats', JSON.stringify(stats));
      console.log('[suggested/goals] stats', stats);
    } catch {}

    res.json(finalItems);
  } catch (error) {
    console.error("Error fetching suggested goals:", error);
    res.status(500).json({ error: "Failed to fetch suggested goals" });
  }
});

// Get suggested habits
router.get("/habits/suggested", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const mode = String((req.query.mode as string) || 'new');

    const suggestedHabitsWithInsights = await db
      .select({
        suggestedHabit: suggestedHabits,
        insight: insights,
        lifeMetric: lifeMetricDefinitions,
      })
      .from(suggestedHabits)
      .innerJoin(insights, eq(suggestedHabits.insightId, insights.id))
      .innerJoin(lifeMetricDefinitions, eq(suggestedHabits.lifeMetricId, lifeMetricDefinitions.id))
      .where(and(
        eq(insights.userId, userId),
        eq(suggestedHabits.archived, false)
      ))
      .orderBy(desc(suggestedHabits.createdAt));

    // Load user's existing habit definitions with their attached active goals and metrics
    const existingHabitJoins = await db
      .select({
        habit: habitDefinitions,
        gi: goalInstances,
        gd: goalDefinitions,
        lm: lifeMetricDefinitions,
      })
      .from(habitDefinitions)
      .leftJoin(habitInstances, eq(habitDefinitions.id, habitInstances.habitDefinitionId))
      .leftJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .leftJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(eq(habitDefinitions.userId, userId));

    // Also keep a flat list of habit definitions for fallback logic
    const existingHabits = await db
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId));

    const allLifeMetrics2 = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));
    const lmById2 = new Map((allLifeMetrics2 as any[]).map((lm:any)=>[lm.id, lm]));

    // Restrict de-dup reference set to ACTIVE habits that are attached to ACTIVE goals
    const activeExistingHabits = existingHabitJoins.filter((row:any)=> row.habit?.isActive === true && row.gi && row.gi.status === 'active' && row.gi.archived === false && row.gd && row.gd.archived === false);
    const existingTexts = activeExistingHabits.map((row:any) => `${row.habit.name}\n${row.habit.description || ''}`);
    const existingHabitMetricIds = activeExistingHabits.map((row:any)=> row.lm?.id || null);
    const suggestionTexts = suggestedHabitsWithInsights.map(({ suggestedHabit }) => `${suggestedHabit.title}\n${suggestedHabit.description || ''}`);
    const [existingEmbs, suggestionEmbs] = await Promise.all([
      embedNormalized(existingTexts),
      embedNormalized(suggestionTexts),
    ]);

    const existingReturned2: any[] = [];
    const mappedHabits = await Promise.all(suggestedHabitsWithInsights.map(async ({ suggestedHabit, insight, lifeMetric }, idx) => {
      let maxSim = 0; let matchId: string | undefined;
      // Only compare within SAME metric to avoid cross-topic collisions
      for (let i = 0; i < existingEmbs.length; i++) {
        if (existingHabitMetricIds[i] !== lifeMetric.id) continue;
        const sim = cosineSimilarity(suggestionEmbs[idx] as any, existingEmbs[i] as any);
        if (sim > maxSim) { maxSim = sim; matchId = activeExistingHabits[i]?.habit?.id; }
      }
      const decision = decideSimilarity(maxSim);
      const kind = decision.relation === 'duplicate' ? 'reinforce' : decision.relation === 'similar' ? 'reinforce' : 'new';
      const cHash = conceptHash(`${suggestedHabit.title}\n${suggestedHabit.description || ''}`);

      if (decision.relation === 'duplicate' && matchId) {
        const matchRow = activeExistingHabits.find((row:any)=> row.habit?.id === matchId);
        const isActive = !!matchRow;
        if (isActive) {
          try { await db.update(suggestedHabits).set({ archived: true }).where(eq(suggestedHabits.id, suggestedHabit.id)); } catch {}
          const existingItem = {
            kind: 'existing' as const,
            type: 'habit' as const,
            existingId: matchRow.habit.id,
            existingTitle: matchRow.habit.name,
            description: suggestedHabit.description || matchRow.habit.description,
            similarity: Number(maxSim.toFixed(3)),
            sourceInsightId: insight.id,
            sourceInsightTitle: insight.title,
            conceptHash: conceptHash(`${matchRow.habit.name}\n${insight.id}`),
          };
          existingReturned2.push(existingItem);
          return null as any;
        }
      }
      return {
      id: suggestedHabit.id,
      title: suggestedHabit.title,
      description: suggestedHabit.description,
      insight: {
        id: insight.id,
        title: insight.title,
        explanation: insight.explanation,
      },
      lifeMetric: {
        id: lifeMetric.id,
        name: lifeMetric.name,
        color: lifeMetric.color,
      },
      createdAt: suggestedHabit.createdAt,
        similarity: Number(maxSim.toFixed(3)),
        kind,
        duplicateOfId: decision.relation === 'duplicate' ? matchId : undefined,
        relatedId: (decision.relation === 'duplicate' || decision.relation === 'similar') ? matchId : undefined,
        relatedTitle: (decision.relation === 'duplicate' || decision.relation === 'similar') ? existingHabitJoins.find((row: any) => row.habit?.id === matchId)?.habit?.name : undefined,
        conceptHash: cHash,
      };
    }))
    const simplifiedSuggestedHabits = (mappedHabits.filter((h:any)=> h !== null))
    .filter(item => item.kind !== 'new' || (item.similarity ?? 0) < 0.86);

    if (mode === 'reinforcements') {
      // Compute reinforcement directly from latest (or specified) insight vs ACTIVE habits
      const sourceInsightId = (req.query.sourceInsightId as string) || null;
      const baseInsight = sourceInsightId
        ? await db.query.insights.findFirst({ where: and(eq(insights.userId, userId), eq(insights.id, sourceInsightId)) })
        : await db.query.insights.findFirst({ where: eq(insights.userId, userId), orderBy: desc(insights.createdAt) as any });
      if (!baseInsight) { return res.json([]); }

      // Get active habits with their associated goals and life metrics through habit instances
      const activeHabitsWithGoals = await db
        .select({
          habit: habitDefinitions,
          goal: goalDefinitions,
          lifeMetric: lifeMetricDefinitions,
        })
        .from(habitDefinitions)
        .innerJoin(habitInstances, eq(habitDefinitions.id, habitInstances.habitDefinitionId))
        .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .innerJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
        .where(and(
          eq(habitDefinitions.userId, userId),
          eq(habitDefinitions.isActive, true),
          eq(goalDefinitions.isActive, true),
          eq(goalInstances.status, 'active')
        ));

      if (activeHabitsWithGoals.length === 0) return res.json([]);

      const insightText = `${baseInsight.title}\n${baseInsight.explanation}`;
      const habitTexts = activeHabitsWithGoals.map((h:any)=> `${h.habit.name}\n${h.habit.description || ''}`);
      const [insEmbArr, habEmbs] = await Promise.all([
        embedNormalized([insightText]),
        embedNormalized(habitTexts),
      ]);
      const insEmb = insEmbArr[0] as any;
      const matches = activeHabitsWithGoals.map((h:any, i:number)=> ({
        existingId: h.habit.id,
        existingTitle: h.habit.name,
        description: h.habit.description,
        lifeMetric: h.lifeMetric ? { id: h.lifeMetric.id, name: h.lifeMetric.name, color: h.lifeMetric.color } : undefined,
        similarity: Number(cosineSimilarity(insEmb, habEmbs[i] as any).toFixed(3)),
      }))
      .filter(m => (m.similarity ?? 0) >= 0.75)
      .sort((a,b)=> (b.similarity - a.similarity))
      .map((m: any) => ({
        type: 'habit' as const,
        ...m,
        sourceInsightId: baseInsight.id,
        sourceInsightTitle: baseInsight.title,
        conceptHash: conceptHash(`${m.existingTitle}\n${baseInsight.id}`),
      }));

      const sevenDaysAgo2 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const memory2 = await db.select().from(suggestionMemory).where(and(
        eq(suggestionMemory.userId, userId),
        eq(suggestionMemory.type, 'reinforcement_habit'),
        gte(suggestionMemory.lastShownAt, sevenDaysAgo2)
      ));
      const recent2 = new Set(memory2.map((m:any) => m.conceptHash));
      const cooled2 = matches.filter(r => !recent2.has(r.conceptHash as any));
      for (const r of cooled2) {
        try {
          await db.insert(suggestionMemory).values({ userId, type: 'reinforcement_habit', conceptHash: r.conceptHash as any, itemId: r.existingId as any, lastShownAt: new Date() });
        } catch {}
      }
      res.json(cooled2.map(({ conceptHash, ...rest }) => rest));
      return;
    }

    const sevenDaysAgo2 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const memory2 = await db.select().from(suggestionMemory).where(and(
      eq(suggestionMemory.userId, userId),
      eq(suggestionMemory.type, 'suggested_habit'),
      gte(suggestionMemory.lastShownAt, sevenDaysAgo2)
    ));
    const recent2 = new Set(memory2.map((m:any) => m.conceptHash));
    let cooled2 = simplifiedSuggestedHabits.filter(h => !recent2.has(h.conceptHash as any));
    // Guard: if cooldown would zero-out all novel items, bypass cooldown for this response
    if (cooled2.length === 0 && simplifiedSuggestedHabits.length > 0) {
      cooled2 = simplifiedSuggestedHabits;
    }
    for (const h of cooled2) {
      try {
        await db.insert(suggestionMemory).values({ userId, type: 'suggested_habit', conceptHash: h.conceptHash as any, itemId: h.id, lastShownAt: new Date() });
      } catch {}
    }
    const memoryExisting2 = await db.select().from(suggestionMemory).where(and(
      eq(suggestionMemory.userId, userId),
      eq(suggestionMemory.type, 'reinforcement_habit'),
      gte(suggestionMemory.lastShownAt, sevenDaysAgo2)
    ));
    const recentExisting2 = new Set(memoryExisting2.map((m:any)=> m.conceptHash));
    const cooledExisting2 = existingReturned2.filter(r => !recentExisting2.has(r.conceptHash as any));
    for (const r of cooledExisting2) {
      try { await db.insert(suggestionMemory).values({ userId, type: 'reinforcement_habit', conceptHash: r.conceptHash as any, itemId: r.existingId as any, lastShownAt: new Date() }); } catch {}
    }
    
    // If no new suggestions survived cooldown, ensure we still show existing items
    let finalHabits = [];
    if (cooled2.length > 0) {
      // If we have new suggestions, include both new and existing
      finalHabits = [
        ...cooledExisting2.map(({ conceptHash, ...rest }) => rest),
        ...cooled2.map(({ conceptHash, ...rest }) => rest),
      ];
    } else if (existingReturned2.length > 0) {
      // If no new suggestions, show existing items regardless of cooldown
      finalHabits = existingReturned2.map(({ conceptHash, ...rest }) => rest);
    }

    // No fallback: if nothing survived, return an empty list
    if (finalHabits.length === 0) {
      res.set('X-Suggest-Fallback', '0');
    }

    // Diagnostics: add rich stats to headers and logs
    try {
      const mappedNonNull2: any[] = (mappedHabits as any[]).filter(Boolean);
      const rawCandidates2 = (suggestedHabitsWithInsights as any[]).length;
      const newCandidates2 = mappedNonNull2.filter((m:any)=> m.kind === 'new').length;
      const reinforceCandidates2 = mappedNonNull2.filter((m:any)=> m.kind === 'reinforce').length;
      const newAfterSimFilter2 = (simplifiedSuggestedHabits as any[]).filter((m:any)=> m.kind === 'new').length;
      const newFilteredBySim86_2 = newCandidates2 - newAfterSimFilter2;
      const cooldownNewFiltered2 = (simplifiedSuggestedHabits as any[]).length - (cooled2 as any[]).length;
      const cooldownExistingFiltered2 = (existingReturned2 as any[]).length - (cooledExisting2 as any[]).length;
      const duplicatesAutoArchived2 = (existingReturned2 as any[]).length;
      const returnedExistingCount2 = (finalHabits as any[]).filter((i:any)=> i && i.existingId).length;
      const newReturnedCount2 = (finalHabits as any[]).length - returnedExistingCount2;

      const stats2 = {
        mode: 'default',
        returned: finalHabits.length,
        returnedExisting: returnedExistingCount2,
        returnedNew: newReturnedCount2,
        rawCandidates: rawCandidates2,
        newCandidates: newCandidates2,
        reinforceCandidates: reinforceCandidates2,
        newFilteredBySim86: newFilteredBySim86_2,
        cooldownNewFiltered: cooldownNewFiltered2,
        duplicatesAutoArchived: duplicatesAutoArchived2,
        cooldownExistingFiltered: cooldownExistingFiltered2,
      } as const;
      res.set('X-Suggest-Stats', JSON.stringify(stats2));
      console.log('[suggested/habits] stats', stats2);
    } catch {}

    res.json(finalHabits);
  } catch (error) {
    console.error("Error fetching suggested habits:", error);
    res.status(500).json({ error: "Failed to fetch suggested habits" });
  }
});

// Get all habits for the user (for goal selection - includes inactive habits)
router.get("/habits/all", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Get all habits (active and inactive) for goal selection
    const habits = await db
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId))
      .limit(100); // Higher limit for goal selection

    // Simplified response for goal selection
    const habitsForSelection = habits.map((habit) => ({
      id: habit.id,
      title: habit.name,
      description: habit.description,
      isActive: habit.isActive,
    }));

    res.json(habitsForSelection);
  } catch (error) {
    console.error("Error fetching all habits:", error);
    res.status(500).json({ error: "Failed to fetch habits" });
  }
});

// Recommend existing habits for a specific goal using semantic similarity
router.get("/:goalId/habits/recommendations", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalId = req.params.goalId;
    const limit = Math.max(1, Math.min(20, parseInt(String(req.query.limit || '5')) || 5));

    // Load goal with definition and metric context
    const goalRow = await db
      .select({
        gi: goalInstances,
        gd: goalDefinitions,
        lm: lifeMetricDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goalRow[0]) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const goalTitle = goalRow[0].gd.title || "";
    const goalDesc = goalRow[0].gd.description || "";
    const goalMetric = goalRow[0].lm?.name || goalRow[0].gd.category || "";
    const queryText = `${goalTitle}\n${goalDesc}\nMetric:${goalMetric}`.trim();

    // Load user's active habits (existing pool)
    const habits = await db
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, userId)));

    if (habits.length === 0) {
      return res.json([]);
    }

    // Build embeddings
    const [qEmb, hEmbs] = await Promise.all([
      embedQuery(queryText),
      embedTexts(habits.map(h => `${h.name}\n${h.description || ''}\nCategory:${h.category || ''}`))
    ]);

    const cosine = (a: number[], b: number[]) => {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
      const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
      return dot / denom;
    };

    const scored = habits.map((h, i) => {
      const sim = cosine(qEmb, hEmbs[i]);
      // Small bonus when categories/metric align
      const bonus = (goalMetric && h.category && h.category.toLowerCase() === goalMetric.toLowerCase()) ? 0.05 : 0;
      const score = sim + bonus;
      return {
        id: h.id,
        title: h.name,
        description: h.description,
        category: h.category,
        isActive: h.isActive,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, limit));
  } catch (error) {
    console.error("Error computing habit recommendations:", error);
    res.status(500).json({ error: "Failed to compute recommendations" });
  }
});

// Get all habits for the user
router.get("/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const statusFilter = req.query.status as string || 'active';
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Build status condition based on filter
    let statusCondition;
    if (statusFilter === 'active') {
      statusCondition = eq(habitDefinitions.isActive, true);
    } else if (statusFilter === 'archived') {
      statusCondition = eq(habitDefinitions.isActive, false);
    } else {
      // 'all' - no status filter
      statusCondition = undefined;
    }

    // First get all habits with their associated goals and life metrics
    const habitsWithLifeMetrics = await db
      .select({
        habit: habitDefinitions,
        goal: goalDefinitions,
        lifeMetric: lifeMetricDefinitions,
      })
      .from(habitDefinitions)
      .leftJoin(habitInstances, eq(habitDefinitions.id, habitInstances.habitDefinitionId))
      .leftJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .leftJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(and(
        eq(habitDefinitions.userId, userId),
        ...(statusCondition ? [statusCondition] : [])
      ))
      .limit(50); // Limit to 50 habits for performance

    // Group habits by ID and collect their life metrics
    const habitMap = new Map();
    
    for (const row of habitsWithLifeMetrics) {
      const habitId = row.habit.id;
      
      if (!habitMap.has(habitId)) {
        // Initialize habit entry
        habitMap.set(habitId, {
          id: row.habit.id,
          title: row.habit.name,
          description: row.habit.description,
          category: row.habit.category,
          currentStreak: row.habit.globalStreak || 0,
          longestStreak: 0,
          totalCompletions: row.habit.globalCompletions || 0,
          globalCompletions: row.habit.globalCompletions,
          globalStreak: row.habit.globalStreak,
          lifeMetrics: []
        });
      }
      
      // Add life metric if it exists
      if (row.lifeMetric && row.lifeMetric.id) {
        const existingHabit = habitMap.get(habitId);
        const lifeMetricExists = existingHabit.lifeMetrics.some((lm: any) => lm.id === row.lifeMetric!.id);
        if (!lifeMetricExists) {
          existingHabit.lifeMetrics.push({
            id: row.lifeMetric.id,
            name: row.lifeMetric.name,
            color: row.lifeMetric.color
          });
        }
      }
    }
    
    // For active habits, only keep those with active goal associations (life metrics)
    // For archived habits, show all (they might have been archived but still have goal associations)
    let filteredHabits;
    if (statusFilter === 'active') {
      filteredHabits = Array.from(habitMap.values()).filter(habit => habit.lifeMetrics.length > 0);
    } else {
      filteredHabits = Array.from(habitMap.values());
    }
    
    // Convert filtered habits to array and get completion stats for each habit
    const habitsWithStats = await Promise.all(filteredHabits.map(async (habit) => {
      const recentCompletions = await db
        .select()
        .from(habitCompletions)
        .where(eq(habitCompletions.habitDefinitionId, habit.id))
        .orderBy(desc(habitCompletions.completedAt))
        .limit(30); // Limit to last 30 completions for performance

      let currentStreak = 0;
      let longestStreak = 0;
      let lastCompletionDate: Date | null = null;

      for (const completion of recentCompletions) {
        if (lastCompletionDate === null) {
          currentStreak = 1;
        } else {
          const daysDiff = Math.floor(
            (lastCompletionDate.getTime() - completion.completedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysDiff === 1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, currentStreak);
        lastCompletionDate = completion.completedAt;
      }

      return {
        ...habit,
        currentStreak: habit.globalStreak ?? currentStreak,
        longestStreak,
      };
    }));

    res.json(habitsWithStats);
  } catch (error) {
    console.error("Error fetching habits:", error);
    res.status(500).json({ error: "Failed to fetch habits" });
  }
});

// Get habits that are associated with active goals and not yet completed today
router.get("/habits/today", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Today window (user timezone aware)
    const { start: today, end: tomorrow } = await getUserTodayWindow(userId);

    // Habit instances connected to active goals for this user
    const activeHabitRows = await db
      .select({
        habitInstance: habitInstances,
        habitDefinition: habitDefinitions,
        goalInstance: goalInstances,
      })
      .from(habitInstances)
      .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
      .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalInstances.status, "active"),
        eq(habitDefinitions.isActive, true)
      ))
      .limit(200);

    // Group by habit definition to avoid duplicates (same habit across multiple goals)
    // Helper function to determine if a habit should be shown for completion
    const shouldShowHabitForCompletion = async (habitDefinitionId: string, habitInstance: any, userId: string, today: Date) => {
      // Get the habit's frequency settings
      const frequencySettings = habitInstance.frequencySettings;
      
      if (!frequencySettings) {
        // Fallback: if no frequency settings, treat as daily
        const alreadyToday = await db
          .select()
          .from(habitCompletions)
          .where(and(
            eq(habitCompletions.habitDefinitionId, habitDefinitionId),
            eq(habitCompletions.userId, userId),
            gte(habitCompletions.completedAt, today),
            lt(habitCompletions.completedAt, new Date(today.getTime() + 24 * 60 * 60 * 1000))
          ))
          .limit(1);
        return alreadyToday.length === 0;
      }

      const { frequency, perPeriodTarget, periodsCount } = frequencySettings;
      const totalTarget = perPeriodTarget * periodsCount;

      // Calculate the start of the current period based on frequency
      let periodStart: Date;
      let periodEnd: Date;
      
      switch (frequency) {
        case 'daily':
          // Daily: check if completed today
          periodStart = new Date(today);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(today);
          periodEnd.setHours(23, 59, 59, 999);
          break;
          
        case 'weekly':
          // Weekly: check if completed this week (Monday to Sunday)
          const dayOfWeek = today.getDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
          periodStart = new Date(today);
          periodStart.setDate(today.getDate() - daysFromMonday);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
          break;
          
        case 'monthly':
          // Monthly: check if completed this month
          periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
          periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
          
        default:
          // Fallback to daily
          periodStart = new Date(today);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(today);
          periodEnd.setHours(23, 59, 59, 999);
      }

      // Count completions in the current period
      const completionsInPeriod = await db
        .select()
        .from(habitCompletions)
        .where(and(
          eq(habitCompletions.habitDefinitionId, habitDefinitionId),
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedAt, periodStart),
          lte(habitCompletions.completedAt, periodEnd)
        ));

      // Show habit if not completed enough times for the current period
      return completionsInPeriod.length < totalTarget;
    };

    // Group rows by habit definition, keeping all goal associations
    const habitIdToRows: Record<string, typeof activeHabitRows> = {} as any;
    for (const row of activeHabitRows) {
      const hid = row.habitDefinition.id;
      if (!habitIdToRows[hid]) habitIdToRows[hid] = [] as any;
      habitIdToRows[hid].push(row);
    }

    const result: any[] = [];
    for (const rows of Object.values(habitIdToRows)) {
      const row = rows[0];
      
      // Check if habit should be shown based on its frequency and completion status
      const shouldShowHabit = await shouldShowHabitForCompletion(
        row.habitDefinition.id, 
        row.habitInstance, 
        userId, 
        today
      );
      
      if (!shouldShowHabit) continue;

      const goalIds = rows.map(r => r.goalInstance.id);
      // Compute streak and totals for this habit for the user
      const allCompletions = await db
        .select()
        .from(habitCompletions)
        .where(and(
          eq(habitCompletions.habitDefinitionId, row.habitDefinition.id),
          eq(habitCompletions.userId, userId)
        ))
        .orderBy(desc(habitCompletions.completedAt));

      let currentStreak = 0;
      let longestStreak = 0;
      let lastCompletionDate: Date | null = null;
      for (const completion of allCompletions) {
        if (lastCompletionDate === null) {
          currentStreak = 1;
        } else {
          const daysDiff = Math.floor((lastCompletionDate.getTime() - completion.completedAt.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff === 1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, currentStreak);
        lastCompletionDate = completion.completedAt;
      }

      result.push({
        id: row.habitDefinition.id,
        title: row.habitDefinition.name,
        description: row.habitDefinition.description,
        goalId: row.goalInstance.id,
        goalIds,
        currentStreak,
        longestStreak,
        totalCompletions: allCompletions.length,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching today's habits:", error);
    res.status(500).json({ error: "Failed to fetch today's habits" });
  }
});

// Get habits completed today
router.get("/habits/completed-today", async (req: Request, res: Response) => {
  console.log('=== COMPLETED-TODAY ENDPOINT CALLED ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log('GET /habits/completed-today called for user:', userId);

    // Today window (user timezone aware)
    const { start: today, end: tomorrow } = await getUserTodayWindow(userId);
    
    console.log('Completed-today query using time window:', {
      start: today.toISOString(),
      end: tomorrow.toISOString()
    });

    // Get completed habits for today with full details
    console.log('Executing completed-today query with conditions:', {
      userId,
      start: today.toISOString(),
      end: tomorrow.toISOString(),
      startLocal: today.toLocaleString('en-US', { timeZone: 'America/Toronto' }),
      endLocal: tomorrow.toLocaleString('en-US', { timeZone: 'America/Toronto' })
    });
    
    const completedHabits = await db
      .select({
        habitDefinition: habitDefinitions,
        completion: habitCompletions,
        goalInstance: goalInstances,
        goalDefinition: goalDefinitions,
        lifeMetric: lifeMetricDefinitions,
      })
      .from(habitCompletions)
      .innerJoin(habitDefinitions, eq(habitCompletions.habitDefinitionId, habitDefinitions.id))
      .leftJoin(habitInstances, eq(habitCompletions.habitDefinitionId, habitInstances.habitDefinitionId))
      .leftJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .leftJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .leftJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(
        and(
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedAt, today),
          lt(habitCompletions.completedAt, tomorrow)
        )
      )
      .orderBy(desc(habitCompletions.completedAt));

    console.log('Database query returned', completedHabits.length, 'completed habits');
    if (completedHabits.length > 0) {
      console.log('First completed habit:', {
        id: completedHabits[0].completion.id,
        completedAt: completedHabits[0].completion.completedAt,
        habitName: completedHabits[0].habitDefinition.name
      });
    }

    // Group by habit definition and get the best metric association
    const habitIdToData: Record<string, any> = {};
    for (const row of completedHabits) {
      const habitId = row.habitDefinition.id;
      if (!habitIdToData[habitId]) {
        habitIdToData[habitId] = {
          id: row.habitDefinition.id,
          title: row.habitDefinition.name,
          description: row.habitDefinition.description,
          category: row.habitDefinition.category,
          currentStreak: 0,
          longestStreak: 0,
          totalCompletions: 0,
          metric: row.lifeMetric ? {
            id: row.lifeMetric.id,
            name: row.lifeMetric.name,
            color: row.lifeMetric.color || '#6B7280'
          } : undefined,
          completedAt: row.completion.completedAt,
        };
      }
    }

    // Calculate streaks and totals for each habit
    const result = await Promise.all(Object.values(habitIdToData).map(async (habit) => {
      const completions = await db
        .select()
        .from(habitCompletions)
        .where(and(
          eq(habitCompletions.habitDefinitionId, habit.id),
          eq(habitCompletions.userId, userId)
        ))
        .orderBy(desc(habitCompletions.completedAt));

      let currentStreak = 0;
      let longestStreak = 0;
      let lastCompletionDate: Date | null = null;

      for (const completion of completions) {
        if (lastCompletionDate === null) {
          currentStreak = 1;
        } else {
          const daysDiff = Math.floor(
            (lastCompletionDate.getTime() - completion.completedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysDiff === 1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, currentStreak);
        lastCompletionDate = completion.completedAt;
      }

      return {
        ...habit,
        currentStreak,
        longestStreak,
        totalCompletions: completions.length,
      };
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching completed habits:", error);
    res.status(500).json({ error: "Failed to fetch completed habits" });
  }
});

// Complete a habit
router.post("/habits/:id/complete", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const habitId = req.params.id;
    const { notes, goalId } = req.body; // goalId is optional; if missing, fan-out to all associated goals

    // Check if habit exists
    const habit = await db
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.id, habitId), eq(habitDefinitions.userId, userId)))
      .limit(1);

    if (!habit[0]) {
      return res.status(404).json({ error: "Habit not found" });
    }

    // Check for existing completion today to prevent duplicates
    const { start: today, end: tomorrow } = await getUserTodayWindow(userId);
    
    console.log('Duplicate check for habit:', habitId, 'user:', userId, 'timezone window:', { 
      start: today, 
      end: tomorrow,
      startISO: today.toISOString(),
      endISO: tomorrow.toISOString(),
      serverNow: new Date().toISOString()
    });

    const existingTodayCompletion = await db
      .select()
      .from(habitCompletions)
      .where(and(
        eq(habitCompletions.habitDefinitionId, habitId),
        eq(habitCompletions.userId, userId),
        gte(habitCompletions.completedAt, today),
        lt(habitCompletions.completedAt, tomorrow)
      ))
      .limit(1);

    console.log('Existing completions found:', existingTodayCompletion.length, 'for habit:', habitId);
    if (existingTodayCompletion.length > 0) {
      console.log('Existing completion details:', {
        id: existingTodayCompletion[0].id,
        completedAt: existingTodayCompletion[0].completedAt,
        completedAtISO: existingTodayCompletion[0].completedAt?.toISOString()
      });
    }

    if (existingTodayCompletion.length > 0) {
      console.log('Habit already completed today, skipping duplicate completion');
      return res.status(409).json({ 
        error: "Habit already completed today",
        completion: existingTodayCompletion[0]
      });
    }

    // Create completion record
    const now = new Date();
    console.log('Creating habit completion with timestamp:', {
      habitId,
      userId,
      serverNow: now.toISOString(),
      serverNowLocal: now.toLocaleString('en-US', { timeZone: 'America/Toronto' })
    });
    
    const [completion] = await db
      .insert(habitCompletions)
      .values({
        habitDefinitionId: habitId,
        userId,
        notes: notes || null,
        completedAt: now, // Explicitly set the timestamp
      })
      .returning();
    
    console.log('Habit completion created:', {
      completionId: completion.id,
      completedAt: completion.completedAt,
      completedAtISO: completion.completedAt?.toISOString()
    });

    // Update habit's global stats
    const completions = await db
      .select()
      .from(habitCompletions)
      .where(eq(habitCompletions.habitDefinitionId, habitId))
      .orderBy(desc(habitCompletions.completedAt));

    let currentStreak = 0;
    let lastCompletionDate: Date | null = null;

    for (const comp of completions) {
      if (lastCompletionDate === null) {
        currentStreak = 1;
      } else {
        const daysDiff = Math.floor(
          (lastCompletionDate.getTime() - comp.completedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      lastCompletionDate = comp.completedAt;
    }

    // Update habit definition with new global stats
    await db
      .update(habitDefinitions)
      .set({
        globalCompletions: completions.length,
        globalStreak: currentStreak,
      })
      .where(eq(habitDefinitions.id, habitId));

    // Update goal-specific progress: single goal or fan-out to all associated goals if goalId omitted
    const targetHabitInstances = goalId
      ? await db
          .select()
          .from(habitInstances)
          .where(and(eq(habitInstances.habitDefinitionId, habitId), eq(habitInstances.goalInstanceId, goalId)))
      : await db
          .select()
          .from(habitInstances)
          .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
          .where(and(eq(habitInstances.habitDefinitionId, habitId), eq(goalInstances.userId, userId), eq(goalInstances.status, 'active')));

    for (const hiRow of targetHabitInstances as any[]) {
      const hi = hiRow.habit_instances || hiRow; // support join/no-join shapes
      const newCurrentValue = (hi.currentValue || 0) + 1;
      await db
        .update(habitInstances)
        .set({ currentValue: newCurrentValue, goalSpecificStreak: currentStreak })
        .where(eq(habitInstances.id, hi.id));

      try {
        const goalJoin = await db
          .select({ def: goalDefinitions, inst: goalInstances, metric: lifeMetricDefinitions })
          .from(goalInstances)
          .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
          .innerJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
          .where(and(eq(goalInstances.id, hi.goalInstanceId), eq(goalInstances.userId, userId)))
          .limit(1);
        if (goalJoin[0]) {
          console.log('[snapshot] trigger after habit completion', {
            userId,
            lifeMetricName: goalJoin[0].metric.name,
            habitId,
            goalInstanceId: hi.goalInstanceId,
          });
          await storage.upsertTodayProgressSnapshot(userId, goalJoin[0].metric.name);
        }
      } catch (e) {
        console.warn('Snapshot upsert failed after habit completion (fan-out)', e);
      }
    }

    res.json(completion);
  } catch (error) {
    console.error("Error completing habit:", error);
    res.status(500).json({ error: "Failed to complete habit" });
  }
});

// Manually complete a goal
router.post("/:goalId/complete", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalId = req.params.goalId;

    // Check if goal exists
    const goal = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Update goal to 100% complete
    await db
      .update(goalInstances)
      .set({
        currentValue: 100,
        status: "completed",
        completedAt: new Date(), // Set completion date
      })
      .where(eq(goalInstances.id, goalId));

    res.json({ message: "Goal completed successfully" });
  } catch (error) {
    console.error("Error completing goal:", error);
    res.status(500).json({ error: "Failed to complete goal" });
  }
});

// Create a new habit
router.post("/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const { title, description, category } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Habit title is required" });
    }

    // Create habit definition
    const [habitDefinition] = await db
      .insert(habitDefinitions)
      .values({
        userId,
        name: title,
        description: description || null,
        category: category || null,
        isActive: true,
        globalCompletions: 0,
        globalStreak: 0,
      })
      .returning();

    res.status(201).json({
      id: habitDefinition.id,
      title: habitDefinition.name,
      description: habitDefinition.description,
      category: habitDefinition.category,
      isActive: habitDefinition.isActive,
    });
  } catch (error) {
    console.error("Error creating habit:", error);
    res.status(500).json({ error: "Failed to create habit" });
  }
});

// Update a habit (title, description, category)
router.put("/habits/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const habitId = req.params.id;
    const { title, description, category } = req.body;

    const existing = await db
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.id, habitId), eq(habitDefinitions.userId, userId)))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: "Habit not found" });
    }

    const [updated] = await db
      .update(habitDefinitions)
      .set({
        name: title ?? undefined,
        description: description ?? undefined,
        category: category ?? undefined,
        updatedAt: new Date() as any,
      } as any)
      .where(and(eq(habitDefinitions.id, habitId), eq(habitDefinitions.userId, userId)))
      .returning();

    return res.json({
      id: updated.id,
      title: updated.name,
      description: updated.description,
      category: updated.category,
    });
  } catch (error) {
    console.error("Error updating habit:", error);
    return res.status(500).json({ error: "Failed to update habit" });
  }
});

// Add habit to goal
router.post("/:goalId/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalInstanceId = req.params.goalId;
    const { habitDefinitionId, targetValue } = req.body;
    
    console.log('🟣 Adding habit to goal - Request data:', {
      goalInstanceId,
      habitDefinitionId,
      targetValue,
      body: req.body,
      userId
    });

    // Check if goal exists
    const goal = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalInstanceId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Check if habit definition exists
    const habitDef = await db
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.id, habitDefinitionId))
      .limit(1);

    if (!habitDef[0]) {
      return res.status(404).json({ error: "Habit not found" });
    }

    // Check if association already exists
    const existingAssociation = await db
      .select()
      .from(habitInstances)
      .where(and(
        eq(habitInstances.goalInstanceId, goalInstanceId),
        eq(habitInstances.habitDefinitionId, habitDefinitionId)
      ))
      .limit(1);

    if (existingAssociation[0]) {
      return res.status(400).json({ error: "Habit already associated with this goal" });
    }

    // Create habit instance
    const insertData = {
      habitDefinitionId,
      goalInstanceId,
      userId,
      targetValue: targetValue || 1,
      currentValue: 0,
      goalSpecificStreak: 0,
      frequencySettings: req.body.frequencySettings || {
        frequency: 'daily',
        perPeriodTarget: 1,
        periodsCount: 1
      },
    };
    
    console.log('🟣 Inserting habit instance with data:', insertData);
    
    const [habitInstance] = await db
      .insert(habitInstances)
      .values(insertData)
      .returning();

    // Snapshot all life metrics once after adding a habit to a goal
    try {
      const metrics = await db
        .select()
        .from(lifeMetricDefinitions)
        .where(eq(lifeMetricDefinitions.userId, userId));
      for (const m of metrics) {
        await storage.upsertTodayProgressSnapshot(userId, m.name);
      }
    } catch (e) {
      console.warn('Snapshot upsert (all metrics) after add habit to goal failed', e);
    }

    res.status(201).json(habitInstance);
  } catch (error) {
    console.error("Error adding habit to goal:", error);
    res.status(500).json({ error: "Failed to add habit to goal" });
  }
});

// Update habit-goal association
router.patch("/:goalId/habits/:habitDefinitionId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const goalInstanceId = req.params.goalId;
    const habitDefinitionId = req.params.habitDefinitionId;
    const { targetValue, frequency, perPeriodTarget, periodsCount } = req.body;

    // Check if goal exists and belongs to user
    const goal = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalInstanceId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Find and update the habit instance
    const [updatedHabit] = await db
      .update(habitInstances)
      .set({
        targetValue: targetValue || 1,
        frequencySettings: {
          frequency: frequency || 'daily',
          perPeriodTarget: perPeriodTarget || 1,
          periodsCount: periodsCount || 1
        }
      })
      .where(and(
        eq(habitInstances.habitDefinitionId, habitDefinitionId),
        eq(habitInstances.goalInstanceId, goalInstanceId)
      ))
      .returning();

    if (!updatedHabit) {
      return res.status(404).json({ error: "Habit instance not found" });
    }

    res.json(updatedHabit);
  } catch (error) {
    console.error("Error updating habit-goal association:", error);
    res.status(500).json({ error: "Failed to update habit-goal association" });
  }
});

// Remove habit from goal
router.delete("/:goalId/habits/:habitId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalInstanceId = req.params.goalId;
    const habitDefinitionId = req.params.habitId;

    // Check if goal exists
    const goal = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalInstanceId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Delete the habit instance
    const [deletedHabitInstance] = await db
      .delete(habitInstances)
      .where(and(
        eq(habitInstances.goalInstanceId, goalInstanceId),
        eq(habitInstances.habitDefinitionId, habitDefinitionId)
      ))
      .returning();

    if (!deletedHabitInstance) {
      return res.status(404).json({ error: "Habit association not found" });
    }

    res.json({ message: "Habit removed from goal successfully" });
  } catch (error) {
    console.error("Error removing habit from goal:", error);
    res.status(500).json({ error: "Failed to remove habit from goal" });
  }
});

// Get a specific goal by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalId = req.params.id;

    const goalWithDefinition = await db
      .select({
        goalInstance: goalInstances,
        goalDefinition: goalDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .limit(1);
    
    const goal = goalWithDefinition[0];

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Get associated habits for this goal
    const associatedHabits = await db
      .select({
        habitInstance: habitInstances,
        habitDefinition: habitDefinitions,
      })
      .from(habitInstances)
      .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
      .where(eq(habitInstances.goalInstanceId, goalId));

    // Debug: Log the raw habit data from database
    console.log('🟣 Raw habit data from database:', associatedHabits.map(hi => ({
      habitId: hi.habitDefinition.id,
      habitName: hi.habitDefinition.name,
      targetValue: hi.habitInstance.targetValue,
      frequencySettings: hi.habitInstance.frequencySettings,
      hasFrequencySettings: !!hi.habitInstance.frequencySettings
    })));

    // Calculate goal progress based on associated habits
    let calculatedProgress = 0;
    let habitBasedProgress = 0;
    
    if (associatedHabits.length > 0) {
      let totalProgress = 0;
      
      console.log('Calculating goal progress for goalId:', goalId);
      console.log('Associated habits:', associatedHabits.length);
      
      for (const hi of associatedHabits) {
        const habitProgress = hi.habitInstance.targetValue > 0 ? 
          Math.min(((hi.habitInstance.currentValue || 0) / hi.habitInstance.targetValue) * 100, 100) : 0;
        totalProgress += habitProgress;
        
        console.log('Habit progress:', {
          habitId: hi.habitDefinition.id,
          habitName: hi.habitDefinition.name,
          currentValue: hi.habitInstance.currentValue,
          targetValue: hi.habitInstance.targetValue,
          progress: habitProgress
        });
      }
      
      // Calculate average progress (max 90% from habits)
      const averageProgress = totalProgress / associatedHabits.length;
      habitBasedProgress = Math.min(averageProgress, 90);
      
      console.log('Habit-based progress calculation:', {
        totalProgress,
        averageProgress,
        habitBasedProgress
      });
    }

    // New logic: currentValue stores manual adjustment offset
    const manualOffset = goal.goalInstance.currentValue || 0;
    console.log('Manual adjustment offset:', manualOffset);
    console.log('Habit-based progress:', habitBasedProgress);
    
    // Calculate total progress: habit progress + manual offset (capped 0-100)
    calculatedProgress = Math.max(0, Math.min(100, habitBasedProgress + manualOffset));
    
    console.log('Combined progress calculation:', {
      habitBasedProgress,
      manualOffset,
      totalProgress: calculatedProgress
    });

    // If goal reaches 100% through any method, mark as completed
    let finalProgress = goal.goalInstance.status === "completed" ? 100 : Math.round(calculatedProgress);
    let finalStatus = goal.goalInstance.status;
    let finalCompletedAt = goal.goalInstance.completedAt;
    
    // Only mark as completed if it was manually completed, not from habit progress
    // Goals can reach 90% from habits but need manual completion to reach 100%

    // Get life metric
    let lifeMetric = null;
    if (goal.goalDefinition.category) {
      const lifeMetricResults = await db
        .select()
        .from(lifeMetricDefinitions)
        .where(eq(lifeMetricDefinitions.name, goal.goalDefinition.category))
        .limit(1);
      lifeMetric = lifeMetricResults.length > 0 ? lifeMetricResults[0] : null;
    }

    const mappedHabits = associatedHabits.map(hi => ({
      id: hi.habitDefinition.id,
      title: hi.habitDefinition.name,
      description: hi.habitDefinition.description,
      category: hi.habitDefinition.category,
      targetValue: hi.habitInstance.targetValue,
      currentValue: hi.habitInstance.currentValue,
      goalSpecificStreak: hi.habitInstance.goalSpecificStreak,
      frequencySettings: hi.habitInstance.frequencySettings || null,
      habitDefinitionId: hi.habitInstance.habitDefinitionId,
      goalId: hi.habitInstance.goalInstanceId,
    }));

    // Debug: Log the mapped habits being sent in response
    console.log('🟣 Mapped habits for response:', mappedHabits.map(h => ({
      id: h.id,
      title: h.title,
      targetValue: h.targetValue,
      frequencySettings: h.frequencySettings,
      hasFrequencySettings: !!h.frequencySettings
    })));

    const goalWithHabits = {
      ...goal,
      lifeMetric,
      goalInstance: {
        ...goal.goalInstance,
        currentValue: finalProgress,
        status: finalStatus,
        completedAt: finalCompletedAt,
        targetDate: goal.goalInstance.targetDate, // Preserve original target date
      },
      habits: mappedHabits,
    };

    res.json(goalWithHabits);
  } catch (error) {
    console.error("Error fetching goal:", error);
    res.status(500).json({ error: "Failed to fetch goal" });
  }
});

// Create a new goal
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const { title, description, lifeMetricId, targetValue, targetDate, habitIds } = req.body;

    // Create goal definition
    const [goalDefinition] = await db
      .insert(goalDefinitions)
      .values({
        userId,
        title,
        description,
        lifeMetricId,
        unit: "count",
        isActive: true,
      })
      .returning();

    // Create goal instance
    const [goalInstance] = await db
      .insert(goalInstances)
      .values({
        goalDefinitionId: goalDefinition.id,
        userId,
        targetValue: targetValue ? parseInt(targetValue) || 1 : 1, // Default to 1 if invalid
        currentValue: 0,
        targetDate: targetDate ? new Date(targetDate) : null,
        status: "active",
        monthYear: new Date().toISOString().slice(0, 7), // "2025-01"
      })
      .returning();

    // Associate habits if provided
    if (habitIds && Array.isArray(habitIds)) {
      for (const habitId of habitIds) {
        // Check if habit definition exists
        const habitDef = await db.query.habitDefinitions.findFirst({
          where: eq(habitDefinitions.id, habitId),
        });

        if (habitDef) {
          await db.insert(habitInstances).values({
            habitDefinitionId: habitId,
            goalInstanceId: goalInstance.id,
            userId,
            targetValue: 1, // Default target, can be customized
            currentValue: 0,
            goalSpecificStreak: 0,
          });
        }
      }
    }

    // Snapshot all life metrics once after goal creation
    try {
      const metrics = await db
        .select()
        .from(lifeMetricDefinitions)
        .where(eq(lifeMetricDefinitions.userId, userId));
      for (const m of metrics) {
        await storage.upsertTodayProgressSnapshot(userId, m.name);
      }
    } catch (e) {
      console.warn('Snapshot upsert (all metrics) after goal creation failed', e);
    }

    res.status(201).json({ goal: goalInstance, definition: goalDefinition });
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// Update a goal
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalId = req.params.id;
    const { title, description, targetValue, targetDate, status, lifeMetricId } = req.body;

    // First, get the goal instance to find its definition
    const goalInstance = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goalInstance[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Update goal definition if title/description provided
    if (title || description || lifeMetricId) {
      await db
        .update(goalDefinitions)
        .set({
          title: title || undefined,
          description: description || undefined,
          lifeMetricId: lifeMetricId || undefined,
        })
        .where(eq(goalDefinitions.id, goalInstance[0].goalDefinitionId));
    }

    // Update goal instance
    const [updatedGoal] = await db
      .update(goalInstances)
      .set({
        targetValue: targetValue ? parseInt(targetValue) : undefined,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        status: status || "active",
      })
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .returning();

    if (!updatedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json(updatedGoal);
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// Delete a goal
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalId = req.params.id;

    // Delete associated habit instances first
    await db.delete(habitInstances).where(eq(habitInstances.goalInstanceId, goalId));

    // Delete the goal instance
    const [deletedGoal] = await db
      .delete(goalInstances)
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .returning();

    if (!deletedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

// Archive a goal (remove life metric and set to archived status)
router.post("/:id/archive", async (req: Request, res: Response) => {
  try {
    console.log('🗄️ Archive request received for goal:', req.params.id);
    console.log('👤 User from request:', (req as any).user);
    
    const userId = (req as any).user?.id;
    
    if (!userId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalId = req.params.id;

    // First, get the goal instance to find its definition
    const goalInstance = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goalInstance[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Archive the goal definition (remove life metric and set archived)
    await db
      .update(goalDefinitions)
      .set({
        lifeMetricId: null, // Remove life metric association
        archived: true,
      })
      .where(eq(goalDefinitions.id, goalInstance[0].goalDefinitionId));

    // Archive the goal instance
    const [archivedGoal] = await db
      .update(goalInstances)
      .set({
        status: "archived",
        archived: true,
      })
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .returning();

    if (!archivedGoal) {
      console.log('❌ Goal not found after archive attempt');
      return res.status(404).json({ error: "Goal not found" });
    }

    console.log('✅ Goal archived successfully:', archivedGoal);
    res.json({ message: "Goal archived successfully", goal: archivedGoal });
  } catch (error) {
    console.error("❌ Error archiving goal:", error);
    res.status(500).json({ error: "Failed to archive goal" });
  }
});

export default router; 