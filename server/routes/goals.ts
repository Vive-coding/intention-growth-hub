import { Router } from "express";
import { db } from "../db";
import { HabitOptimizationService } from "../services/habitOptimizationService";
import { logHabitCompletion } from "../services/habitCompletionService";

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
  users,
  feedbackEvents,
  userOnboardingProfiles,
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
const DEFAULT_GOAL_DURATION_DAYS = 30;

// Helper function to promote a suggested habit to a habit definition
async function promoteSuggestedHabit(
  suggestedHabitId: string,
  userId: string
): Promise<HabitDefinition | null> {
  try {
    // Get suggested habit
    const [suggestedHabit] = await db
      .select()
      .from(suggestedHabits)
      .where(eq(suggestedHabits.id, suggestedHabitId))
      .limit(1);

    if (!suggestedHabit) {
      console.warn(`Suggested habit ${suggestedHabitId} not found`);
      return null;
    }

    // Create habit definition
    const [habitDef] = await db
      .insert(habitDefinitions)
      .values({
        userId,
        name: suggestedHabit.title,
        description: suggestedHabit.description || '',
        category: suggestedHabit.lifeMetricId,
        globalCompletions: 0,
        globalStreak: 0,
        isActive: true,
      })
      .returning();

    // Archive suggested habit
    await db
      .update(suggestedHabits)
      .set({ archived: true })
      .where(eq(suggestedHabits.id, suggestedHabitId));

    console.log(`✓ Promoted suggested habit ${suggestedHabitId} to habit definition ${habitDef.id}`);

    return habitDef;
  } catch (error) {
    console.error(`Error promoting suggested habit ${suggestedHabitId}:`, error);
    return null;
  }
}

// Helper to calculate timezone offset in minutes
function getTimezoneOffsetMinutes(timezone: string): number {
  // Common timezone offsets (in minutes from UTC)
  const timezoneOffsets: { [key: string]: number } = {
    'UTC': 0,
    'America/New_York': -240, // EDT (UTC-4)
    'America/Chicago': -300,  // CDT (UTC-5)
    'America/Denver': -360,   // MDT (UTC-6)
    'America/Los_Angeles': -420, // PDT (UTC-7)
    'Europe/London': 0,       // BST (UTC+0) or GMT (UTC+0)
    'Europe/Paris': 120,      // CEST (UTC+2)
    'Asia/Tokyo': 540,        // JST (UTC+9)
    'Australia/Sydney': 600,  // AEST (UTC+10)
  };
  
  return timezoneOffsets[timezone] || 0;
}

// Helper to compute a user's start/end of "today" in UTC based on their timezone
export async function getUserTodayWindow(userId: string) {
  try {
    const { users } = await import('../../shared/schema');
    const rows = await db.select().from(users).where(eq(users.id as any, userId as any)).limit(1);
    const tz = (rows[0] as any)?.timezone || process.env.DEFAULT_TZ || 'UTC';
    
    const now = new Date();
    console.log('TIMEZONE-WINDOW-DEBUG:', {
      userId,
      timezone: tz,
      serverTime: now.toISOString()
    });
    
    // Use a simpler approach: create the start and end of day in the user's timezone
    // by using the Intl.DateTimeFormat to get the correct date, then create UTC dates
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // Month is 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
    
    console.log('User local date:', { year, month: month + 1, day });
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error(`Invalid date parts from timezone ${tz}: year=${year}, month=${month}, day=${day}`);
    }
    
    // Create start and end of day in UTC for the user's local date
    // This is much simpler and more reliable
    const startUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endUTC = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    
    // Now we need to adjust these UTC times to account for the user's timezone
    // We'll calculate the offset by comparing a known time in the user's timezone
    const testTime = new Date(year, month, day, 12, 0, 0); // Noon in user's timezone
    const testTimeInUserTz = new Date(testTime.toLocaleString("en-US", {timeZone: tz}));
    const testTimeInUTC = new Date(testTime.toLocaleString("en-US", {timeZone: "UTC"}));
    const offsetMs = testTimeInUserTz.getTime() - testTimeInUTC.getTime();
    
    const adjustedStartUTC = new Date(startUTC.getTime() - offsetMs);
    const adjustedEndUTC = new Date(endUTC.getTime() - offsetMs);
    
    console.log('TIMEZONE-WINDOW:', {
      userId,
      timezone: tz,
      userLocalDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      offsetMs,
      timeWindow: {
        startUTC: adjustedStartUTC.toISOString(),
        endUTC: adjustedEndUTC.toISOString()
      }
    });
    
    return { start: adjustedStartUTC, end: adjustedEndUTC, offsetMs };
  } catch (error) {
    console.error('getUserTodayWindow error:', error);
    // Fallback to server's local day
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end, offsetMs: 0 };
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
    
    // Let client handle time period filtering - server sends all goals
    
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

    // Get associated habits for each goal instance (only active habits)
    const habitInstancesMap = new Map();
    for (const { goalDefinition, goalInstance } of goalsWithInstances) {
      const associatedHabits = await db
        .select({
          habitInstance: habitInstances,
          habitDefinition: habitDefinitions,
        })
        .from(habitInstances)
        .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
        .where(and(
          eq(habitInstances.goalInstanceId, goalInstance.id),
          eq(habitDefinitions.isActive, true) // Filter out archived habits
        ));
      
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
        term: goalDefinition.term,
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
        
        // Silently backfill term classification if missing
        if (matchRow && matchRow.gd && !matchRow.gd.term && matchRow.gi?.targetDate) {
          try {
            const targetDate = new Date(matchRow.gi.targetDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysUntilTarget = Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            let term: string;
            if (daysUntilTarget <= 30) {
              term = "short";
            } else if (daysUntilTarget <= 90) {
              term = "mid";
            } else {
              term = "long";
            }
            await db.update(goalDefinitions).set({ term }).where(eq(goalDefinitions.id, matchRow.gd.id));
          } catch (e) {
            console.warn('Failed to backfill term classification:', e);
          }
        }
        
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

// Get suggested habits for a specific suggested goal
router.get("/suggested/:goalId/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const suggestedGoalId = req.params.goalId;

    // Get the suggested goal
    const [goal] = await db
      .select()
      .from(suggestedGoals)
      .where(eq(suggestedGoals.id, suggestedGoalId))
      .limit(1);

    if (!goal) {
      return res.status(404).json({ error: "Suggested goal not found" });
    }

    // Get suggested habits linked to this goal
    const suggestedHabitsForGoal = await storage.getSuggestedHabitsForGoal(suggestedGoalId);

    // Get existing active habits in the same life metric
    const existingHabits = await db
      .select({
        id: habitDefinitions.id,
        name: habitDefinitions.name,
        description: habitDefinitions.description,
        category: habitDefinitions.category,
        globalCompletions: habitDefinitions.globalCompletions,
        globalStreak: habitDefinitions.globalStreak,
      })
      .from(habitDefinitions)
      .where(and(
        eq(habitDefinitions.userId, userId),
        eq(habitDefinitions.category, goal.lifeMetricId),
        eq(habitDefinitions.isActive, true)
      ));

    res.json({
      goal,
      suggestedHabits: suggestedHabitsForGoal,
      existingHabits
    });
  } catch (error) {
    console.error("Error fetching suggested habits for goal:", error);
    res.status(500).json({ error: "Failed to fetch suggested habits for goal" });
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

// Suggest more habits for a specific goal
router.post("/:goalId/habits/suggest-more", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const goalId = req.params.goalId;
    
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
    
    // Generate new habit suggestions using AI
    const { generateHabitSuggestions } = await import('../ai/habitSuggestionAgent');
    
    const newSuggestions = await generateHabitSuggestions({
      goalTitle,
      goalDescription: goalDesc,
      lifeMetric: goalMetric,
      userId,
      limit: 5
    });

    res.json({
      success: true,
      suggestions: newSuggestions,
      message: `Generated ${newSuggestions.length} new habit suggestions`
    });
  } catch (error) {
    console.error("Error suggesting more habits:", error);
    res.status(500).json({ error: "Failed to generate habit suggestions" });
  }
});

// ====== Habit Optimization Routes (MUST be before /habits route) ======

// Archive orphaned habits (habits not linked to any active goals)
router.post("/habits/optimize/archive-orphaned", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log(`[HabitOptimization] Archiving orphaned habits for user ${userId}`);
    
    const result = await HabitOptimizationService.archiveOrphanedHabits(userId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("[HabitOptimization] Error archiving orphaned habits:", error);
    res.status(500).json({ 
      error: "Failed to archive orphaned habits",
      message: error.message 
    });
  }
});

// Get optimization analysis (without executing)
router.get("/habits/optimize/analyze", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log(`[HabitOptimization] Analyzing habits for user ${userId}`);
    
    // First, archive orphaned habits automatically
    console.log(`[HabitOptimization] Auto-archiving orphaned habits before analysis...`);
    const orphanedResult = await HabitOptimizationService.archiveOrphanedHabits(userId);
    console.log(`[HabitOptimization] Auto-archived ${orphanedResult.archivedCount} orphaned habits`);
    
    // Then analyze remaining active habits
    const proposal = await HabitOptimizationService.analyzeHabits(userId);
    
    // Include orphaned habits info in response
    res.json({
      ...proposal,
      orphanedHabitsArchived: orphanedResult.archivedCount,
      orphanedHabitNames: orphanedResult.archivedHabits
    });
  } catch (error: any) {
    console.error("[HabitOptimization] Error analyzing habits:", error);
    res.status(500).json({ 
      error: "Failed to analyze habits",
      message: error.message 
    });
  }
});

// Execute habit optimization
router.post("/habits/optimize/execute", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const { proposal } = req.body;

    if (!proposal || !proposal.habitsToArchive || !proposal.habitsToCreate) {
      return res.status(400).json({ error: "Invalid optimization proposal" });
    }

    console.log(`[HabitOptimization] Executing optimization for user ${userId}`);
    
    await HabitOptimizationService.executeOptimization(userId, proposal);
    
    res.json({ 
      success: true,
      message: "Habits optimized successfully",
      summary: proposal.summary
    });
  } catch (error: any) {
    console.error("[HabitOptimization] Error executing optimization:", error);
    res.status(500).json({ 
      error: "Failed to execute optimization",
      message: error.message
    });
  }
});

// ====== End Habit Optimization Routes ======

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
          lifeMetrics: [],
          status: row.habit.isActive ? "active" : "archived",
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
    
    console.log('=== HABITS/TODAY ENDPOINT CALLED ===');
    console.log('User ID:', userId);
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Today window (user timezone aware)
    const { start: today, end: tomorrow, offsetMs } = await getUserTodayWindow(userId);
    
    console.log('=== TIMEZONE WINDOW ===');
    console.log('Today start:', today.toISOString());
    console.log('Today end:', tomorrow.toISOString());

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

    console.log('=== ACTIVE HABIT ROWS ===');
    console.log('Number of active habit rows:', activeHabitRows.length);
    console.log('Sample row:', activeHabitRows[0] ? {
      habitDefinitionId: activeHabitRows[0].habitDefinition.id,
      habitName: activeHabitRows[0].habitDefinition.name,
      frequencySettings: activeHabitRows[0].habitInstance.frequencySettings
    } : 'No rows');

    // Group by habit definition to avoid duplicates (same habit across multiple goals)
    // Helper function to determine if a habit should be shown for completion
    const shouldShowHabitForCompletion = async (habitDefinitionId: string, habitInstance: any, userId: string, todayStart: Date, todayEnd: Date) => {
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
            gte(habitCompletions.completedAt, todayStart),
            lt(habitCompletions.completedAt, todayEnd)
          ))
          .limit(1);
        return alreadyToday.length === 0;
      }

      const { frequency, perPeriodTarget, periodsCount, weekdaysOnly } = frequencySettings;
      const totalTarget = perPeriodTarget * periodsCount;
      
      // Debug: Log the frequency settings being checked
      console.log(`FREQUENCY-SETTINGS-CHECK: habitId=${habitDefinitionId}, hasSettings=${!!frequencySettings}, frequencySettings=${JSON.stringify(frequencySettings)}, frequency=${frequency}, perPeriodTarget=${perPeriodTarget}, periodsCount=${periodsCount}, totalTarget=${totalTarget}`);

      // If this is a weekdays-only daily habit, skip weekends entirely
      const todayMid = new Date(todayStart.getTime() + (todayEnd.getTime() - todayStart.getTime()) / 2);
      if (frequency === 'daily' && weekdaysOnly) {
        const dow = todayMid.getDay(); // 0 = Sun, 6 = Sat
        if (dow === 0 || dow === 6) {
          return false;
        }
      }

      // Calculate the start of the current period based on frequency
      let periodStart: Date;
      let periodEnd: Date;
      
      // Use the timezone-aware today window for all calculations
      const today = todayMid; // Middle of the day
      
      switch (frequency) {
        case 'daily':
          // Daily: use the timezone-aware today window
          periodStart = todayStart;
          periodEnd = todayEnd;
          break;
          
        case 'weekly':
          // Weekly: check if completed this week (Monday to Sunday) in user's timezone
          // Use the timezone-aware todayStart to get the correct day of week
          const dayOfWeek = todayStart.getDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
          periodStart = new Date(todayStart);
          periodStart.setDate(todayStart.getDate() - daysFromMonday);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
          break;
          
        case 'monthly':
          // Monthly: check if completed this month in user's timezone
          periodStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
          periodEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
          
        default:
          // Fallback to daily using timezone-aware window
          periodStart = todayStart;
          periodEnd = todayEnd;
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

      // Debug: Log the completion check
      console.log(`HABIT-COMPLETION-CHECK: habitId=${habitDefinitionId}, frequency=${frequency}, perPeriodTarget=${perPeriodTarget}, periodsCount=${periodsCount}, totalTarget=${totalTarget}, periodStart=${periodStart.toISOString()}, periodEnd=${periodEnd.toISOString()}, completionsInPeriod=${completionsInPeriod.length}, shouldShow=${completionsInPeriod.length < perPeriodTarget}`);
      console.log(`HABIT-COMPLETION-DETAILS: completions=${JSON.stringify(completionsInPeriod.map(c => ({ id: c.id, completedAt: c.completedAt })))}`);

      // Show habit if not completed enough times for the current period
      return completionsInPeriod.length < perPeriodTarget;
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
        today,
        tomorrow
      );
      
      // Debug: Log the result of the completion check
      console.log(`HABIT-SHOW-RESULT: habitId=${row.habitDefinition.id}, habitName=${row.habitDefinition.name}, shouldShowHabit=${shouldShowHabit}, hasFrequencySettings=${!!row.habitInstance.frequencySettings}, frequencySettings=${JSON.stringify(row.habitInstance.frequencySettings)}`);
      
      // Debug: Log the continue logic
      console.log(`HABIT-CONTINUE-CHECK: habitId=${row.habitDefinition.id}, shouldShowHabit=${shouldShowHabit}, !shouldShowHabit=${!shouldShowHabit}, willContinue=${!shouldShowHabit}`);
      
      if (!shouldShowHabit) {
        console.log(`HABIT-SKIPPED: habitId=${row.habitDefinition.id}, habitName=${row.habitDefinition.name} - skipping due to shouldShowHabit=false`);
        continue;
      }

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
        frequencySettings: row.habitInstance.frequencySettings,
      });
    }

    console.log(`HABITS/TODAY: Returning ${result.length} habits for user ${userId}`);
    console.log(`HABITS/TODAY: Result details:`, result.map(r => ({ id: r.id, name: r.name, frequencySettings: r.frequencySettings })));
    res.json(result);
  } catch (error) {
    console.error("Error fetching today's habits:", error);
    res.status(500).json({ error: "Failed to fetch today's habits" });
  }
});

// Test endpoint to check timezone calculation (for debugging)
router.get("/habits/timezone-test", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const { start, end } = await getUserTodayWindow(userId);
    const now = new Date();
    
    // Get user's actual timezone from database
    const { users } = await import('../../shared/schema');
    const userRows = await db.select().from(users).where(eq(users.id as any, userId as any)).limit(1);
    const userTimezone = userRows[0]?.timezone || 'UTC';
    
    res.json({
      userId,
      userTimezone,
      serverTime: now.toISOString(),
      timezoneWindow: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      testHabitCompletion: {
        habitId: '8aef91af-456e-4cd5-a41e-22cf0cafe2ea',
        completedAt: '2025-08-31T02:24:52.034Z',
        isInWindow: start <= new Date('2025-08-31T02:24:52.034Z') && new Date('2025-08-31T02:24:52.034Z') < end
      }
    });
  } catch (error) {
    console.error("Timezone test error:", error);
    res.status(500).json({ error: "Timezone test failed" });
  }
});

// Get habits completed today
router.get("/habits/completed-today", async (req: Request, res: Response) => {
      // Reduced logging to avoid Railway rate limiting
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Today window (user timezone aware)
      const { start: today, end: tomorrow, offsetMs } = await getUserTodayWindow(userId);
      
      // Single consolidated log for time window
      console.log('COMPLETED-TODAY:', {
        userId,
        timeWindow: {
          start: today.toISOString(),
          end: tomorrow.toISOString()
        }
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
    
    // Debug: Check if our specific habit is in the raw results
    const specificHabitId = '8aef91af-456e-4cd5-a41e-22cf0cafe2ea';
    const specificHabitInResults = completedHabits.filter(row => 
      row.habitDefinition.id === specificHabitId
    );
    
    // Single consolidated debug log
    console.log('HABIT-DEBUG:', {
      lookingFor: specificHabitId,
      foundInResults: specificHabitInResults.length,
      totalResults: completedHabits.length,
      hasAssociations: specificHabitInResults.length > 0 ? {
        hasHabitInstance: !!specificHabitInResults[0].goalInstance,
        hasGoalInstance: !!specificHabitInResults[0].goalInstance,
        hasGoalDefinition: !!specificHabitInResults[0].goalDefinition,
        hasLifeMetric: !!specificHabitInResults[0].lifeMetric
      } : null
    });

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

      const msPerDay = 24 * 60 * 60 * 1000;
      const normalizeToLocalDay = (date: Date) => {
        const shifted = new Date(date.getTime() + (offsetMs ?? 0));
        shifted.setUTCHours(0, 0, 0, 0);
        return shifted.getTime();
      };

      const uniqueDayTimestamps: number[] = [];
      const seenDays = new Set<number>();
      for (const comp of completions) {
        const dayTs = normalizeToLocalDay(comp.completedAt);
        if (seenDays.has(dayTs)) continue;
        seenDays.add(dayTs);
        uniqueDayTimestamps.push(dayTs);
      }

      let currentStreak = 0;
      if (uniqueDayTimestamps.length > 0) {
        currentStreak = 1;
        for (let i = 1; i < uniqueDayTimestamps.length; i++) {
          const diffDays = Math.round((uniqueDayTimestamps[i - 1] - uniqueDayTimestamps[i]) / msPerDay);
          if (diffDays === 1) {
            currentStreak += 1;
          } else {
            break;
          }
        }
      }

      let longestStreak = uniqueDayTimestamps.length > 0 ? 1 : 0;
      if (uniqueDayTimestamps.length > 0) {
        let run = 1;
        for (let i = 1; i < uniqueDayTimestamps.length; i++) {
          const diffDays = Math.round((uniqueDayTimestamps[i - 1] - uniqueDayTimestamps[i]) / msPerDay);
          if (diffDays === 1) {
            run += 1;
          } else if (diffDays > 1) {
            run = 1;
          }
          if (run > longestStreak) {
            longestStreak = run;
          }
        }
      }

      // Update habit definition with new global stats
      await db
        .update(habitDefinitions)
        .set({
          globalCompletions: completions.length,
          globalStreak: longestStreak,
        })
        .where(eq(habitDefinitions.id, habit.id));

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
    const { notes, goalId, completedAt } = req.body || {};

    const completion = await logHabitCompletion({
      userId,
      habitId,
      goalId,
      notes,
      completedAt: completedAt ? new Date(completedAt) : undefined,
    });

    res.json(completion);
  } catch (error: any) {
    console.error("Error completing habit:", error);
    if (error?.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
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

    const goalInstance = goal[0];
    const goalDef = await db
      .select()
      .from(goalDefinitions)
      .where(eq(goalDefinitions.id, goalInstance.goalDefinitionId))
      .limit(1);
    
    const createdAt = goalInstance.createdAt || new Date();
    const daysToComplete = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get habit count for this goal
    const habitCount = await db
      .select()
      .from(habitInstances)
      .where(eq(habitInstances.goalInstanceId, goalId))
      .then(rows => rows.length);

    // Update goal to 100% complete
    await db
      .update(goalInstances)
      .set({
        currentValue: 100,
        status: "completed",
        completedAt: new Date(), // Set completion date
      })
      .where(eq(goalInstances.id, goalId));

    // Track goal completion
    try {
      const { backendAnalytics } = await import("../services/analyticsService");
      
      // Check if this is user's first goal completion
      const completedGoals = await db
        .select()
        .from(goalInstances)
        .where(and(
          eq(goalInstances.userId, userId),
          eq(goalInstances.status, "completed")
        ))
        .then(rows => rows.length);
      
      const isFirstGoalCompletion = completedGoals === 1;
      
      backendAnalytics.setUser(userId);
      backendAnalytics.trackEvent('goal_completed', {
        goal_id: goalId,
        goal_definition_id: goalInstance.goalDefinitionId,
        user_id: userId,
        days_to_complete: daysToComplete,
        habit_count: habitCount,
        is_first_goal: isFirstGoalCompletion,
        life_metric: goalDef[0]?.lifeMetricId || null,
      }, userId);

      if (isFirstGoalCompletion) {
        backendAnalytics.trackEvent('first_goal_completed', {
          goal_id: goalId,
          user_id: userId,
          days_to_complete: daysToComplete,
          habit_count: habitCount,
        }, userId);
        
        // Update user properties
        const { updateUserProperties } = await import("../services/analyticsHelpers");
        await updateUserProperties(userId);
      }
    } catch (analyticsError) {
      console.error('[goals] Failed to track goal completion analytics', analyticsError);
    }

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

// Recalculate a habit's targets based on time remaining to goal target date
router.put("/:goalId/habits/:habitId/recalculate", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const goalInstanceId = req.params.goalId;
    const habitDefinitionId = req.params.habitId;

    // Ensure goal exists and belongs to user
    const [goal] = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalInstanceId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Load the habit instance for this goal + habit
    const [habitInstance] = await db
      .select()
      .from(habitInstances)
      .where(
        and(
          eq(habitInstances.goalInstanceId, goalInstanceId),
          eq(habitInstances.habitDefinitionId, habitDefinitionId),
          eq(habitInstances.userId, userId)
        )
      )
      .limit(1);

    if (!habitInstance) {
      return res.status(404).json({ error: "Habit association not found for this goal" });
    }

    const currentValue = habitInstance.currentValue || 0;
    const existingSettings: any = habitInstance.frequencySettings || {};
    const frequency: string = existingSettings.frequency || "daily";
    const perPeriodTarget: number = existingSettings.perPeriodTarget || 1;
    const weekdaysOnly: boolean = !!existingSettings.weekdaysOnly;

    // Calculate remaining periods from NOW until target date using shared helper
    const calc = calculateFrequencySettings(
      goal.targetDate,
      frequency,
      perPeriodTarget,
      weekdaysOnly
    );

    const periodsCountRemaining = calc.periodsCount;
    const remainingTarget = perPeriodTarget * periodsCountRemaining;
    const newTargetValue = currentValue + remainingTarget;

    const updatedSettings = {
      frequency: calc.frequency,
      perPeriodTarget: calc.perPeriodTarget,
      periodsCount: calc.periodsCount,
      ...(weekdaysOnly ? { weekdaysOnly: true } : {}),
    };

    const [updated] = await db
      .update(habitInstances)
      .set({
        targetValue: newTargetValue,
        frequencySettings: updatedSettings as any,
      })
      .where(eq(habitInstances.id, habitInstance.id))
      .returning();

    return res.json({
      message: "Habit targets recalculated based on remaining time",
      goalId: goalInstanceId,
      habitDefinitionId,
      oldTargetValue: habitInstance.targetValue,
      newTargetValue,
      currentValue,
      oldFrequencySettings: habitInstance.frequencySettings,
      newFrequencySettings: updatedSettings,
      habitInstance: updated,
    });
  } catch (error) {
    console.error("Error recalculating habit targets:", error);
    return res.status(500).json({ error: "Failed to recalculate habit targets" });
  }
});

// Helper function to calculate frequency settings based on goal target date
export function calculateFrequencySettings(
  goalTargetDate: Date | null,
  requestedFrequency: string = 'daily',
  requestedPerPeriodTarget: number = 1,
  weekdaysOnly: boolean = false
): { frequency: string; perPeriodTarget: number; periodsCount: number; targetValue: number } {
  const targetDate = goalTargetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(1, Math.ceil((targetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  
  let periodsCount = 1;
  const perPeriodTarget = requestedPerPeriodTarget;
  
  if (requestedFrequency === 'daily') {
    if (weekdaysOnly) {
      // Count only weekdays (Mon–Fri) between now and target date
      let weekdayCount = 0;
      const today = new Date();
      for (let i = 0; i < daysRemaining; i++) {
        const d = new Date(today.getTime());
        d.setDate(today.getDate() + i);
        const day = d.getDay(); // 0 = Sun, 6 = Sat
        if (day !== 0 && day !== 6) {
          weekdayCount++;
        }
      }
      periodsCount = Math.max(1, weekdayCount);
    } else {
      periodsCount = daysRemaining;
    }
  } else if (requestedFrequency === 'weekly') {
    periodsCount = Math.max(1, Math.ceil(daysRemaining / 7));
  } else if (requestedFrequency === 'monthly') {
    periodsCount = Math.max(1, Math.ceil(daysRemaining / 30));
  }
  
  const targetValue = perPeriodTarget * periodsCount;
  
  console.log(`🎯 Calculated frequency settings: targetDate=${goalTargetDate?.toISOString() || 'null'}, daysRemaining=${daysRemaining}, frequency=${requestedFrequency}, perPeriod=${perPeriodTarget}, periods=${periodsCount}, total=${targetValue}`);
  
  return {
    frequency: requestedFrequency,
    perPeriodTarget,
    periodsCount,
    targetValue
  };
}

// Add habit to goal
router.post("/:goalId/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const goalInstanceId = req.params.goalId;
    const { habitDefinitionId, targetValue, frequency, perPeriodTarget } = req.body;
    
    console.log('🟣 Adding habit to goal - Request data:', {
      goalInstanceId,
      habitDefinitionId,
      targetValue,
      frequency,
      perPeriodTarget,
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

    // Check if association already exists (should be unique per goal-habit pair)
    // Note: Since we hard-delete associations, if one exists, it's active
    const existingAssociation = await db
      .select()
      .from(habitInstances)
      .where(and(
        eq(habitInstances.goalInstanceId, goalInstanceId),
        eq(habitInstances.habitDefinitionId, habitDefinitionId),
        eq(habitInstances.userId, userId) // Ensure we're checking for this user only
      ))
      .limit(1);

    if (existingAssociation[0]) {
      console.log('🟡 Duplicate habit association attempt:', {
        goalInstanceId,
        habitDefinitionId,
        userId,
        existingAssociationId: existingAssociation[0].id,
        existingAssociationDetails: existingAssociation[0]
      });
      
      // Instead of failing, return the existing association with a 200 status
      // This makes the operation idempotent and prevents frontend errors
      console.log('✅ Returning existing habit association instead of error');
      return res.status(200).json({ 
        ...existingAssociation[0],
        alreadyExists: true,
        message: "Habit is already associated with this goal"
      });
    }

    // Calculate proper frequency settings based on goal target date
    const requestedSettings: any = req.body.frequencySettings;
    const calculatedSettings = requestedSettings 
      ? requestedSettings 
      : calculateFrequencySettings(
          goal[0].targetDate,
          frequency || 'daily',
          perPeriodTarget || 1,
          requestedSettings?.weekdaysOnly ?? false
        );

    // Reactivate the habit if it was archived (so it can be linked to this new goal)
    // Note: habitDef was already fetched above, so we reuse it here
    if (habitDef[0] && !habitDef[0].isActive) {
      await db
        .update(habitDefinitions)
        .set({ isActive: true })
        .where(eq(habitDefinitions.id, habitDefinitionId));
      console.log(`[goals] Reactivated archived habit ${habitDefinitionId} for new goal link`);
    }

    // Create habit instance
    const insertData = {
      habitDefinitionId,
      goalInstanceId,
      userId,
      targetValue: targetValue || calculatedSettings.targetValue,
      currentValue: 0,
      goalSpecificStreak: 0,
      frequencySettings: {
        frequency: calculatedSettings.frequency,
        perPeriodTarget: calculatedSettings.perPeriodTarget,
        periodsCount: calculatedSettings.periodsCount,
        ...(calculatedSettings.weekdaysOnly ? { weekdaysOnly: true } : {}),
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
    const { targetValue, frequency, perPeriodTarget, periodsCount, weekdaysOnly } = req.body;

    // Check if goal exists and belongs to user
    const goal = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalInstanceId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Find the existing habit instance to preserve existing settings
    const [existingHabit] = await db
      .select()
      .from(habitInstances)
      .where(
        and(
          eq(habitInstances.habitDefinitionId, habitDefinitionId),
          eq(habitInstances.goalInstanceId, goalInstanceId),
          eq(habitInstances.userId, userId),
        ),
      )
      .limit(1);

    if (!existingHabit) {
      return res.status(404).json({ error: "Habit instance not found" });
    }

    const currentSettings: any = existingHabit.frequencySettings || {};

    const updatedFrequencySettings: any = {
      frequency: frequency || currentSettings.frequency || "daily",
      perPeriodTarget: perPeriodTarget ?? currentSettings.perPeriodTarget ?? 1,
      periodsCount: periodsCount ?? currentSettings.periodsCount ?? 1,
    };

    if (updatedFrequencySettings.frequency === "daily") {
      if (typeof weekdaysOnly === "boolean") {
        updatedFrequencySettings.weekdaysOnly = weekdaysOnly;
      } else if (currentSettings.weekdaysOnly) {
        updatedFrequencySettings.weekdaysOnly = true;
      }
    }

    // Find and update the habit instance
    const [updatedHabit] = await db
      .update(habitInstances)
      .set({
        targetValue: targetValue || existingHabit.targetValue || 1,
        frequencySettings: updatedFrequencySettings as any,
      })
      .where(
        and(
          eq(habitInstances.habitDefinitionId, habitDefinitionId),
          eq(habitInstances.goalInstanceId, goalInstanceId),
        ),
      )
      .returning();

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

    // Check if this habit has any remaining links to active goals
    // If not, archive it to prevent it from being auto-added back to other goals
    const remainingLinks = await db
      .select({ id: habitInstances.id })
      .from(habitInstances)
      .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
      .where(
        and(
          eq(habitInstances.habitDefinitionId, habitDefinitionId),
          eq(habitInstances.userId, userId),
          eq(goalInstances.status, "active"),
          eq(goalInstances.archived, false)
        )
      )
      .limit(1);

    // If no remaining links, archive the habit
    if (remainingLinks.length === 0) {
      await db
        .update(habitDefinitions)
        .set({ isActive: false })
        .where(
          and(
            eq(habitDefinitions.id, habitDefinitionId),
            eq(habitDefinitions.userId, userId),
            eq(habitDefinitions.isActive, true)
          )
        );
      console.log(`[goals] Archived orphaned habit ${habitDefinitionId} (no remaining goal links)`);
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

    // Get associated habits for this goal (only active habits)
    const associatedHabits = await db
      .select({
        habitInstance: habitInstances,
        habitDefinition: habitDefinitions,
      })
      .from(habitInstances)
      .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
      .where(and(
        eq(habitInstances.goalInstanceId, goalId),
        eq(habitDefinitions.isActive, true) // Filter out archived habits
      ));

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
    const {
      title,
      description,
      lifeMetricId,
      targetValue,
      targetDate,
      habitIds, // Existing habit definition IDs
      suggestedHabitIds, // Suggested habit IDs to promote
      habitTargets, // Frequency/target settings per habit
      lifeMetricName,
    } = req.body;

    const lifeMetricsForUser = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));

    const palette = [
      "#10B981", // emerald
      "#6366F1", // indigo
      "#F59E0B", // amber
      "#EC4899", // pink
      "#0EA5E9", // sky
      "#8B5CF6", // violet
    ];

    const createLifeMetric = async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const normalized = trimmed.toLowerCase();
      
      // Check for exact match first
      const exactMatch = lifeMetricsForUser.find(
        (metric) => (metric.name || "").toLowerCase() === normalized,
      );
      if (exactMatch) {
        return exactMatch;
      }
      
      // Check for similar matches (e.g., "Career Growth" vs "Career Growth 🚀")
      // Remove emojis and special chars for comparison
      const normalizeForComparison = (str: string) => {
        return str.toLowerCase()
          .replace(/[🚀🏃💪✨🎯🔥💡📈🎓💰❤️🧠]/g, '') // Remove common emojis
          .trim();
      };
      
      const normalizedInput = normalizeForComparison(trimmed);
      const similarMatch = lifeMetricsForUser.find((metric) => {
        const normalizedMetric = normalizeForComparison(metric.name || "");
        return normalizedMetric === normalizedInput && normalizedMetric.length > 0;
      });
      
      if (similarMatch) {
        console.log(`[createLifeMetric] Found similar metric "${similarMatch.name}" for "${trimmed}", using existing instead of creating duplicate`);
        return similarMatch;
      }

      // Only create if no match found
      const color = palette[lifeMetricsForUser.length % palette.length];
      const [createdMetric] = await db
        .insert(lifeMetricDefinitions)
        .values({
          userId,
          name: trimmed,
          description: null,
          color,
        })
        .returning();

      lifeMetricsForUser.push(createdMetric);
      return createdMetric;
    };

    let resolvedLifeMetric =
      typeof lifeMetricId === "string"
        ? lifeMetricsForUser.find((lm) => lm.id === lifeMetricId)
        : undefined;

    if (!resolvedLifeMetric && typeof lifeMetricName === "string" && lifeMetricName.trim().length > 0) {
      const created = await createLifeMetric(lifeMetricName);
      if (created) resolvedLifeMetric = created;
    }

    if (!resolvedLifeMetric) {
      // Fallback to the user's first metric if any exist
      if (lifeMetricsForUser.length > 0) {
        resolvedLifeMetric = lifeMetricsForUser[0];
      } else {
        // Create a default focus area when none exist yet
        const defaultMetric = await createLifeMetric("Personal Growth");
        if (defaultMetric) resolvedLifeMetric = defaultMetric;
      }
    }

    if (!resolvedLifeMetric) {
      return res.status(500).json({ message: "Failed to resolve a life metric for the new goal." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let resolvedTargetDate: Date;
    if (targetDate) {
      const parsed = new Date(targetDate);
      if (Number.isNaN(parsed.getTime())) {
        return res
          .status(400)
          .json({ message: "Invalid targetDate format. Use ISO 8601 strings." });
      }
      if (parsed.getTime() < today.getTime()) {
        return res
          .status(400)
          .json({ message: "Target date must be today or in the future." });
      }
      resolvedTargetDate = parsed;
    } else {
      resolvedTargetDate = new Date(today);
      resolvedTargetDate.setDate(resolvedTargetDate.getDate() + DEFAULT_GOAL_DURATION_DAYS);
    }
    resolvedTargetDate.setHours(23, 59, 59, 999);

    // Calculate term classification based on target date
    const daysUntilTarget = Math.ceil((resolvedTargetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    let term: string;
    if (daysUntilTarget <= 30) {
      term = "short";
    } else if (daysUntilTarget <= 90) {
      term = "mid";
    } else {
      term = "long";
    }

    // Create goal definition
    const [goalDefinition] = await db
      .insert(goalDefinitions)
      .values({
        userId,
        title,
        description,
        lifeMetricId: resolvedLifeMetric.id,
        unit: "count",
        term,
        isActive: true,
      })
      .returning();

    // Create goal instance
    const [goalInstance] = await db
      .insert(goalInstances)
      .values({
        goalDefinitionId: goalDefinition.id,
        userId,
        targetValue: targetValue ? parseInt(targetValue) || 1 : 1,
        currentValue: 0,
        targetDate: resolvedTargetDate,
        status: "active",
        monthYear: resolvedTargetDate.toISOString().slice(0, 7),
      })
      .returning();

    // Promote suggested habits first
    const promotedHabitIds: string[] = [];
    if (suggestedHabitIds && Array.isArray(suggestedHabitIds)) {
      for (const suggestedHabitId of suggestedHabitIds) {
        const promotedHabit = await promoteSuggestedHabit(suggestedHabitId, userId);
        if (promotedHabit) {
          promotedHabitIds.push(promotedHabit.id);
        }
      }
    }

    // Combine existing and promoted habit IDs
    const allHabitIds = [...(habitIds || []), ...promotedHabitIds];

    // Associate habits with goal
    if (allHabitIds.length > 0) {
      for (const habitId of allHabitIds) {
        const habitDef = await db.query.habitDefinitions.findFirst({
          where: eq(habitDefinitions.id, habitId),
        });

        if (habitDef) {
          // Reactivate the habit if it was archived (so it can be linked to this new goal)
          if (!habitDef.isActive) {
            await db
              .update(habitDefinitions)
              .set({ isActive: true })
              .where(eq(habitDefinitions.id, habitId));
            console.log(`[goals] Reactivated archived habit ${habitId} for new goal link during goal creation`);
          }

          // Get target settings for this habit (from habitTargets object) or calculate defaults
          const requestedSettings = habitTargets?.[habitId];
          const targetSettings = requestedSettings || calculateFrequencySettings(
            goalInstance.targetDate,
            requestedSettings?.frequency || 'daily',
            requestedSettings?.perPeriodTarget || 1
          );

          console.log(`🟣 Creating habit instance for goal creation - habitId: ${habitId}, targetDate: ${goalInstance.targetDate?.toISOString()}, settings:`, targetSettings);

          await db.insert(habitInstances).values({
            habitDefinitionId: habitId,
            goalInstanceId: goalInstance.id,
            userId,
            targetValue: targetSettings.targetValue || (targetSettings.perPeriodTarget * targetSettings.periodsCount),
            currentValue: 0,
            goalSpecificStreak: 0,
            frequencySettings: {
              frequency: targetSettings.frequency,
              perPeriodTarget: targetSettings.perPeriodTarget,
              periodsCount: targetSettings.periodsCount
            },
          });

          // Record acceptance feedback for promoted habits
          if (promotedHabitIds.includes(habitId)) {
            try {
              await db.insert(feedbackEvents).values({
                userId,
                type: 'suggested_habit',
                itemId: habitId,
                action: 'accept',
                context: { goalId: goalInstance.id, source: 'goal_creation' }
              });
            } catch (e) {
              console.warn('Failed to record habit acceptance feedback:', e);
            }
          }
        }
      }
    }

    // Snapshot all life metrics once after goal creation
    try {
      const metrics = lifeMetricsForUser;
      for (const m of metrics) {
        await storage.upsertTodayProgressSnapshot(userId, m.name);
      }
    } catch (e) {
      console.warn('Snapshot upsert (all metrics) after goal creation failed', e);
    }

    // Mark onboarding milestone if this is the user's first goal
    let isFirstGoal = false;
    try {
      const [userRow] = await db
        .select({
          firstGoalCreated: users.firstGoalCreated,
          onboardingStep: users.onboardingStep,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRow && !userRow.firstGoalCreated) {
        isFirstGoal = true;
        const updatePayload: Record<string, any> = {
          firstGoalCreated: true,
          updatedAt: new Date(),
        };

        const currentStep = (userRow.onboardingStep ?? "").toLowerCase();
        if (!currentStep || currentStep === "welcome" || currentStep === "profile_completed") {
          updatePayload.onboardingStep = "first_goal_completed";
        }

        await db
          .update(users)
          .set(updatePayload)
          .where(eq(users.id, userId));
        console.log('[goals] ✅ First goal milestone recorded for user', userId);
      }
    } catch (milestoneError) {
      console.error('[goals] Failed to update onboarding milestone for user', userId, milestoneError);
    }

    // Track goal creation with analytics
    try {
      const { backendAnalytics } = await import("../services/analyticsService");
      const goalSource = suggestedHabitIds && suggestedHabitIds.length > 0 ? 'ai_suggestion' : 'manual';
      const hasHabits = (habitIds && habitIds.length > 0) || (suggestedHabitIds && suggestedHabitIds.length > 0);
      
      backendAnalytics.setUser(userId);
      backendAnalytics.trackEvent('goal_created', {
        goal_id: goalInstance.id,
        goal_definition_id: goalDefinition.id,
        user_id: userId,
        source: goalSource,
        has_habits: hasHabits,
        life_metric: resolvedLifeMetric?.name || null,
        is_first_goal: isFirstGoal,
        target_date: targetDate,
        target_value: targetValue || 1,
      }, userId);

      if (isFirstGoal) {
        backendAnalytics.trackEvent('first_goal_created', {
          goal_id: goalInstance.id,
          user_id: userId,
          source: goalSource,
          has_habits: hasHabits,
          life_metric: resolvedLifeMetric?.name || null,
        }, userId);
        
        // Update user properties
        const { updateUserProperties } = await import("../services/analyticsHelpers");
        await updateUserProperties(userId);
      }
    } catch (analyticsError) {
      console.error('[goals] Failed to track goal creation analytics', analyticsError);
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
    const {
      title,
      description,
      targetValue,
      targetDate,
      status,
      lifeMetricId,
      lifeMetricName,
    } = req.body;

    // First, get the goal instance to find its definition
    const goalInstance = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goalInstance[0]) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const definitionUpdates: Record<string, any> = {};
    if (typeof title === "string") {
      definitionUpdates.title = title;
    }
    if (typeof description === "string") {
      definitionUpdates.description = description;
    }

    if (lifeMetricId !== undefined || lifeMetricName !== undefined) {
      const lifeMetricsForUser = await db
        .select()
        .from(lifeMetricDefinitions)
        .where(eq(lifeMetricDefinitions.userId, userId));

      let resolvedLifeMetric =
        typeof lifeMetricId === "string"
          ? lifeMetricsForUser.find((lm) => lm.id === lifeMetricId)
          : undefined;

      if (
        !resolvedLifeMetric &&
        typeof lifeMetricName === "string" &&
        lifeMetricName.trim().length > 0
      ) {
        const normalizedRequestedMetric = lifeMetricName.trim().toLowerCase();
        resolvedLifeMetric = lifeMetricsForUser.find(
          (lm) => (lm.name || "").toLowerCase() === normalizedRequestedMetric,
        );
      }

      if (!resolvedLifeMetric) {
        return res.status(400).json({
          message: "lifeMetricId or lifeMetricName must reference an existing life metric.",
        });
      }

      definitionUpdates.lifeMetricId = resolvedLifeMetric.id;
    }

    if (Object.keys(definitionUpdates).length > 0) {
      await db
        .update(goalDefinitions)
        .set(definitionUpdates)
        .where(eq(goalDefinitions.id, goalInstance[0].goalDefinitionId));
    }

    // Update goal instance
    const instanceUpdates: Record<string, any> = {};

    if (targetValue !== undefined) {
      const parsedTargetValue = parseInt(targetValue, 10);
      if (Number.isNaN(parsedTargetValue)) {
        return res.status(400).json({ message: "targetValue must be a number." });
      }
      instanceUpdates.targetValue = parsedTargetValue;
    }

    if (targetDate !== undefined) {
      if (targetDate === null) {
        // Skip changing the date if explicitly null to preserve existing value
      } else {
        const parsedTargetDate = new Date(targetDate);
        if (Number.isNaN(parsedTargetDate.getTime())) {
          return res.status(400).json({ message: "Invalid targetDate format." });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedTargetDate.getTime() < today.getTime()) {
          return res
            .status(400)
            .json({ message: "Target date must be today or in the future." });
        }
        parsedTargetDate.setHours(23, 59, 59, 999);
        instanceUpdates.targetDate = parsedTargetDate;
      }
    }

    if (status !== undefined) {
      instanceUpdates.status = status;
    }

    let updatedGoal;
    if (Object.keys(instanceUpdates).length > 0) {
      [updatedGoal] = await db
        .update(goalInstances)
        .set(instanceUpdates)
        .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
        .returning();
    } else {
      updatedGoal = goalInstance[0];
    }

    if (!updatedGoal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // If targetDate was updated, automatically recalculate all associated habit targets
    if (instanceUpdates.targetDate) {
      try {
        const associatedHabits = await db
          .select({
            habitInst: habitInstances,
            habitDef: habitDefinitions,
          })
          .from(habitInstances)
          .leftJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
          .where(eq(habitInstances.goalInstanceId, goalId));

        for (const habit of associatedHabits) {
          const frequencySettings = habit.habitInst.frequencySettings as any;
          if (frequencySettings?.frequency && frequencySettings?.perPeriodTarget) {
            const recalculated = calculateFrequencySettings(
              instanceUpdates.targetDate,
              frequencySettings.frequency,
              frequencySettings.perPeriodTarget
            );

            await db
              .update(habitInstances)
              .set({
                targetValue: recalculated.targetValue,
                frequencySettings: {
                  frequency: recalculated.frequency,
                  perPeriodTarget: recalculated.perPeriodTarget,
                  periodsCount: recalculated.periodsCount,
                },
              })
              .where(eq(habitInstances.id, habit.habitInst.id));

            console.log(`♻️ Recalculated habit ${habit.habitDef?.name}: ${recalculated.targetValue} (${recalculated.periodsCount} periods)`);
          }
        }
      } catch (error) {
        console.error('Failed to recalculate habit targets:', error);
        // Don't fail the goal update if habit recalculation fails
      }
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

// Count active goals for a user
router.get("/count/active", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(goalInstances)
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalInstances.status, 'active'),
        eq(goalInstances.archived, false)
      ));

    const [profileRow] = await db
      .select({ focusGoalLimit: userOnboardingProfiles.focusGoalLimit })
      .from(userOnboardingProfiles)
      .where(eq(userOnboardingProfiles.userId, userId))
      .limit(1);
    const configuredLimit = profileRow?.focusGoalLimit ?? 3;
    const focusGoalLimit = Math.min(Math.max(configuredLimit, 3), 5);

    res.json({ count: Number(row?.count || 0), focusGoalLimit });
  } catch (error) {
    console.error("Error counting active goals:", error);
    res.status(500).json({ message: "Failed to count active goals" });
  }
});

export default router; 