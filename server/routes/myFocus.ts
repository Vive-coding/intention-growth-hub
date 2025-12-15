import { Router } from "express";
import { MyFocusService } from "../services/myFocusService";
import { db } from "../db";
import { and, eq, desc } from "drizzle-orm";
import {
  goalDefinitions,
  goalInstances,
  habitDefinitions,
  habitInstances,
  myFocusOptimizations,
  myFocusPrioritySnapshots,
  userOnboardingProfiles,
} from "../../shared/schema";
import { calculateFrequencySettings } from "./goals";

const router = Router();

// Get My Focus data
router.get("/", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const myFocus = await MyFocusService.getMyFocus(userId);
    const needsSetup = await MyFocusService.needsInitialSetup(userId);

    res.json({
      ...myFocus,
      needsSetup,
    });
  } catch (e) {
    console.error("[my-focus] failed", e);
    res.status(500).json({ message: "Failed to get My Focus data" });
  }
});

router.post("/config", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { maxGoals } = req.body || {};
    const parsed = Number(maxGoals);
    if (![3, 4, 5].includes(parsed)) {
      return res.status(400).json({ message: "maxGoals must be 3, 4, or 5" });
    }

    const now = new Date();
    const [profile] = await db
      .insert(userOnboardingProfiles)
      .values({
        userId,
        focusGoalLimit: parsed,
        updatedAt: now,
      } as any)
      .onConflictDoUpdate({
        target: userOnboardingProfiles.userId,
        set: {
          focusGoalLimit: parsed,
          updatedAt: now,
        },
      })
      .returning({ focusGoalLimit: userOnboardingProfiles.focusGoalLimit });

    res.json({ maxGoals: profile?.focusGoalLimit ?? parsed });
  } catch (e) {
    console.error("[my-focus] update config failed", e);
    res.status(500).json({ message: "Failed to update focus configuration" });
  }
});

// Check if user needs initial setup
router.get("/needs-setup", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const needsSetup = await MyFocusService.needsInitialSetup(userId);
    res.json({ needsSetup });
  } catch (e) {
    console.error("[my-focus] needs-setup failed", e);
    res.status(500).json({ message: "Failed to check setup status" });
  }
});

// Apply an optimization proposal and persist prioritization snapshot atomically
router.post("/optimization/apply", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { proposal, sourceThreadId } = req.body || {};
    if (!proposal || proposal.type !== "optimization") {
      return res.status(400).json({ message: "Invalid payload: missing optimization proposal" });
    }

    const prioritization = Array.isArray(proposal.prioritization) ? proposal.prioritization : [];
    const optimizedHabits = Array.isArray(proposal.optimizedHabits) ? proposal.optimizedHabits : [];

    // Group optimized habits by goal for batched updates
    const byGoal = new Map<string, any[]>();
    for (const oh of optimizedHabits) {
      if (!oh.goalInstanceId) continue;
      if (!byGoal.has(oh.goalInstanceId)) byGoal.set(oh.goalInstanceId, []);
      byGoal.get(oh.goalInstanceId)!.push(oh);
    }

    await db.transaction(async (tx) => {
      // compute progress using tx helper (bind tx and user)
      const computeProgress = async (gid: string) => computeHabitProgressTx(tx, userId, gid);
      // 1) Persist prioritization snapshot if provided
      if (prioritization.length > 0) {
        const items = prioritization.map((p: any) => ({
          goalInstanceId: p.goalInstanceId,
          rank: p.rank,
          reason: p.reason,
        }));
        await tx.insert(myFocusPrioritySnapshots).values({
          userId,
          items: items as any,
          sourceThreadId: sourceThreadId || null,
        } as any);
      }

      // 2) For each affected goal, preserve progress and apply habit changes
    for (const entry of Array.from(byGoal.entries())) {
      const goalInstanceId = entry[0];
      const changes = entry[1];
        // Fetch goal instance
        const goalRows = await tx
          .select({ gi: goalInstances })
          .from(goalInstances)
          .where(and(eq(goalInstances.userId, userId), eq(goalInstances.id, goalInstanceId)));
        const goal = goalRows[0]?.gi as any;
        if (!goal) continue;

        // Snapshot combined progress before changes
        const beforeHabitProgress = await computeProgress(goalInstanceId);
        const beforeOffset = goal.currentValue || 0;
        const beforeCombined = Math.max(0, Math.min(100, beforeHabitProgress + beforeOffset));

        // Apply each change
        for (const ch of changes) {
          // Only handling 'replace' per current spec
          if (ch.action === 'replace' && ch.habitDefinitionId) {
            // Remove existing habit instances for this habit+goal
            await tx
              .delete(habitInstances)
              .where(and(
                eq(habitInstances.userId, userId),
                eq(habitInstances.goalInstanceId, goalInstanceId),
                eq(habitInstances.habitDefinitionId, ch.habitDefinitionId)
              ));

            // Ensure a habit definition exists for new habit; create a new definition scoped to user
            const newDef = await tx.insert(habitDefinitions).values({
              userId,
              name: ch.newHabit?.title || 'Optimized Habit',
              description: ch.newHabit?.description || '',
              category: null as any,
              isActive: true,
            } as any).returning({ id: habitDefinitions.id });

            const newDefId = newDef[0]?.id as string;
            if (newDefId) {
              await tx.insert(habitInstances).values({
                userId,
                goalInstanceId,
                habitDefinitionId: newDefId,
                targetValue: ch.newHabit?.targetValue || 1,
                currentValue: 0,
                frequencySettings: ch.newHabit?.frequencySettings || null,
              } as any);
            }
          }
        }

        // Adjust past-due target date minimally (push to 30 days ahead)
        const now = new Date();
        if (goal.targetDate && new Date(goal.targetDate).getTime() < now.getTime()) {
          const newTarget = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          await tx.update(goalInstances)
            .set({ targetDate: newTarget as any })
            .where(eq(goalInstances.id, goalInstanceId));
        }

        // Recompute habit-based progress after changes
        const afterHabitProgress = await computeProgress(goalInstanceId);
        const neededOffset = Math.round(Math.max(0, Math.min(100, beforeCombined - afterHabitProgress)));

        // Update manual offset to preserve overall progress
        await tx.update(goalInstances)
          .set({ currentValue: neededOffset as any })
          .where(eq(goalInstances.id, goalInstanceId));
      }

      // 3) Mark optimization as applied (append-only record)
      await tx.insert(myFocusOptimizations).values({
        userId,
        summary: proposal.summary || null,
        recommendations: [{ type: 'apply', payload: proposal }] as any,
        status: 'applied',
        sourceThreadId: sourceThreadId || null,
      } as any);
    });

    res.json({ success: true });
  } catch (e) {
    console.error('[my-focus] optimization apply failed', e);
    res.status(500).json({ message: 'Failed to apply optimization' });
  }
});

// Apply a prioritization snapshot directly (respect user-selected items)
// Allows empty array to clear all priorities
router.post("/priorities/apply", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { items, sourceThreadId } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid payload: items[] required" });
    }

    // Allow empty array to clear all priorities
    if (items.length === 0) {
      await db.insert(myFocusPrioritySnapshots).values({
        userId,
        items: [] as any,
        sourceThreadId: sourceThreadId || null,
      } as any);
      return res.json({ success: true });
    }

    // Normalize incoming ids. Some clients/agents accidentally send goalDefinitionId instead of goalInstanceId.
    // We resolve those to the most recent active goal instance for that definition.
    const rawNormalized = items
      .map((it: any, idx: number) => ({
        rawId: it.goalInstanceId || it.id,
        rank: it.rank || idx + 1,
        reason: it.reason || null,
      }))
      .filter((it: any) => !!it.rawId);

    const normalized: Array<{ goalInstanceId: string; rank: number; reason: string | null }> = [];
    for (const it of rawNormalized) {
      const rawId = String(it.rawId);
      // 1) If it's already a goal instance id for this user, keep it.
      const [instanceRow] = await db
        .select({ id: goalInstances.id, goalDefinitionId: goalInstances.goalDefinitionId })
        .from(goalInstances)
        .where(and(eq(goalInstances.id, rawId), eq(goalInstances.userId, userId)))
        .limit(1);
      if (instanceRow?.id) {
        normalized.push({ goalInstanceId: instanceRow.id as any, rank: it.rank, reason: it.reason });
        continue;
      }

      // 2) Otherwise, treat it as a goal definition id and resolve to most recent active instance.
      const [byDef] = await db
        .select({ id: goalInstances.id })
        .from(goalInstances)
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .where(
          and(
            eq(goalDefinitions.id, rawId as any),
            eq(goalDefinitions.userId, userId),
            eq(goalDefinitions.archived, false),
            eq(goalInstances.userId, userId),
            eq(goalInstances.archived, false),
            eq(goalInstances.status, "active"),
          ),
        )
        .orderBy(desc(goalInstances.createdAt))
        .limit(1);
      if (byDef?.id) {
        normalized.push({ goalInstanceId: byDef.id as any, rank: it.rank, reason: it.reason });
      }
    }

    if (normalized.length === 0) {
      return res.status(400).json({ message: "No valid goalInstanceId in items" });
    }

    // Load previous snapshot to detect newly prioritized goals
    const [previousSnapshot] = await db
      .select()
      .from(myFocusPrioritySnapshots)
      .where(eq(myFocusPrioritySnapshots.userId, userId))
      .orderBy(desc(myFocusPrioritySnapshots.createdAt))
      .limit(1);

    const previousIds = new Set<string>(
      Array.isArray(previousSnapshot?.items)
        ? (previousSnapshot.items as any[]).map((it: any) => it.goalInstanceId).filter(Boolean)
        : [],
    );

    const newPriorityIds = normalized
      .map((it: any) => it.goalInstanceId)
      .filter((id: string) => !previousIds.has(id));

    // Detect goals that were removed from focus (were in previous snapshot but not in new one)
    const newPriorityIdsSet = new Set<string>(normalized.map((it: any) => it.goalInstanceId));
    const removedFromFocusIds = Array.from(previousIds).filter((id: string) => !newPriorityIdsSet.has(id));

    await db.insert(myFocusPrioritySnapshots).values({
      userId,
      items: normalized as any,
      sourceThreadId: sourceThreadId || null,
    } as any);

    // Update terms for goals removed from focus based on their target dates
    for (const goalId of removedFromFocusIds) {
      try {
        const [goalRow] = await db
          .select({ 
            gdId: goalInstances.goalDefinitionId,
            targetDate: goalInstances.targetDate 
          })
          .from(goalInstances)
          .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
          .limit(1);
        
        if (goalRow?.gdId) {
          // Calculate term based on target date
          let calculatedTerm: 'short' | 'mid' | 'long' | null = null;
          if (goalRow.targetDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(goalRow.targetDate);
            const daysUntilTarget = Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            
            if (daysUntilTarget <= 30) {
              calculatedTerm = 'short';
            } else if (daysUntilTarget <= 90) {
              calculatedTerm = 'mid';
            } else {
              calculatedTerm = 'long';
            }
          }

          if (calculatedTerm) {
            await db
              .update(goalDefinitions)
              .set({ term: calculatedTerm as any })
              .where(and(eq(goalDefinitions.id, goalRow.gdId as any), eq(goalDefinitions.userId, userId)));
            console.log(`[my-focus] Updated term to ${calculatedTerm} for goal removed from focus: ${goalId}`);
          }
        }
      } catch (err) {
        console.warn("[my-focus] Failed to update term for goal removed from focus", goalId, err);
      }
    }

    // Recalculate habit targets for any newly prioritized goals
    for (const goalId of newPriorityIds) {
      try {
        await recalculateHabitTargetsForGoal(userId, goalId);
      } catch (err) {
        console.error("[my-focus] Failed to recalculate targets for prioritized goal", goalId, err);
        // Don't fail the entire request if recalculation fails - it's a best-effort operation
      }
    }

    // Any goal in My Focus should be treated as "in focus" on the Goals page.
    // We set term="short" for newly prioritized goals so they render as "In focus".
    for (const goalId of newPriorityIds) {
      try {
        const [row] = await db
          .select({ gdId: goalInstances.goalDefinitionId })
          .from(goalInstances)
          .where(and(eq(goalInstances.id, goalId), eq(goalInstances.userId, userId)))
          .limit(1);
        if (row?.gdId) {
          await db
            .update(goalDefinitions)
            .set({ term: "short" as any })
            .where(and(eq(goalDefinitions.id, row.gdId as any), eq(goalDefinitions.userId, userId)));
        }
      } catch (err) {
        console.warn("[my-focus] Failed to set term=short for focus goal", goalId, err);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[my-focus] priorities apply failed', e);
    console.error('[my-focus] Error details:', {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      name: e instanceof Error ? e.name : undefined,
    });
    res.status(500).json({ 
      message: 'Failed to apply priorities',
      error: process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.message : String(e)) : undefined
    });
  }
});

// Clear all priorities (remove all goals from My Focus)
router.post("/priorities/clear", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { sourceThreadId } = req.body || {};

    // Create empty snapshot to clear all priorities
    await db.insert(myFocusPrioritySnapshots).values({
      userId,
      items: [] as any,
      sourceThreadId: sourceThreadId || null,
    } as any);

    res.json({ success: true });
  } catch (e) {
    console.error('[my-focus] priorities clear failed', e);
    res.status(500).json({ message: 'Failed to clear priorities' });
  }
});

// Remove specific goals from priority
router.post("/priorities/remove", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { goalInstanceIds, sourceThreadId } = req.body || {};
    if (!Array.isArray(goalInstanceIds) || goalInstanceIds.length === 0) {
      return res.status(400).json({ message: "Invalid payload: goalInstanceIds[] required" });
    }

    // Get current priority snapshot
    const [currentSnapshot] = await db
      .select()
      .from(myFocusPrioritySnapshots)
      .where(eq(myFocusPrioritySnapshots.userId, userId))
      .orderBy(desc(myFocusPrioritySnapshots.createdAt))
      .limit(1);

    let updatedItems: any[] = [];
    if (currentSnapshot?.items && Array.isArray(currentSnapshot.items)) {
      // Filter out the goals to remove
      updatedItems = (currentSnapshot.items as any[]).filter(
        (item: any) => !goalInstanceIds.includes(item.goalInstanceId || item.id)
      );
    }

    // Create new snapshot with remaining priorities (or empty if all removed)
    await db.insert(myFocusPrioritySnapshots).values({
      userId,
      items: updatedItems as any,
      sourceThreadId: sourceThreadId || null,
    } as any);

    res.json({ success: true, remainingCount: updatedItems.length });
  } catch (e) {
    console.error('[my-focus] priorities remove failed', e);
    res.status(500).json({ message: 'Failed to remove priorities' });
  }
});

export default router;

// Helper: compute habit-based progress (avg of habit instance progress, capped at 90)
async function computeHabitProgressTx(tx: any, userId: string, goalInstanceId: string): Promise<number> {
  try {
    const habits = await tx
      .select({ hi: habitInstances })
      .from(habitInstances)
      .where(and(eq(habitInstances.userId, userId), eq(habitInstances.goalInstanceId, goalInstanceId)));
    if (habits.length === 0) return 0;
    let total = 0;
    for (const row of habits) {
      const target = (row as any).hi?.targetValue || 0;
      const current = (row as any).hi?.currentValue || 0;
      const p = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      total += p;
    }
    const avg = total / habits.length;
    return Math.min(avg, 90);
  } catch {
    return 0;
  }
}

// Helper: recalculate all habit targets for a goal based on remaining time to target date
async function recalculateHabitTargetsForGoal(userId: string, goalInstanceId: string): Promise<void> {
  try {
    // Load goal to get target date and ensure it belongs to user
    const [goal] = await db
      .select()
      .from(goalInstances)
      .where(and(eq(goalInstances.id, goalInstanceId), eq(goalInstances.userId, userId)))
      .limit(1);

    if (!goal || !goal.targetDate) {
      console.log(`[my-focus] Skipping recalculate for goal ${goalInstanceId}: no target date`);
      return;
    }

    // Convert targetDate to Date if it's a string
    const targetDate = goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate);
    if (isNaN(targetDate.getTime())) {
      console.warn(`[my-focus] Invalid target date for goal ${goalInstanceId}: ${goal.targetDate}`);
      return;
    }

    // Load all habit instances for this goal
    const habitRows = await db
      .select()
      .from(habitInstances)
      .where(and(eq(habitInstances.goalInstanceId, goalInstanceId), eq(habitInstances.userId, userId)));

    if (habitRows.length === 0) {
      console.log(`[my-focus] No habits to recalculate for goal ${goalInstanceId}`);
      return;
    }

    for (const hi of habitRows as any[]) {
      try {
        const currentValue = hi.currentValue || 0;
        const settings: any = hi.frequencySettings || {};
        const frequency: string = settings.frequency || "daily";
        const perPeriodTarget: number = settings.perPeriodTarget || 1;
        const weekdaysOnly: boolean = !!settings.weekdaysOnly;

        const calc = calculateFrequencySettings(
          targetDate,
          frequency,
          perPeriodTarget,
          weekdaysOnly,
        );

        const periodsRemaining = calc.periodsCount;
        const remainingTarget = perPeriodTarget * periodsRemaining;
        const newTargetValue = currentValue + remainingTarget;

        const newSettings: any = {
          frequency: calc.frequency,
          perPeriodTarget: calc.perPeriodTarget,
          periodsCount: calc.periodsCount,
          ...(weekdaysOnly ? { weekdaysOnly: true } : {}),
        };

        await db
          .update(habitInstances)
          .set({
            targetValue: newTargetValue,
            frequencySettings: newSettings as any,
          })
          .where(eq(habitInstances.id, hi.id));
      } catch (habitErr) {
        console.error(`[my-focus] Failed to recalculate habit ${hi.id} for goal ${goalInstanceId}:`, habitErr);
        // Continue with other habits
      }
    }
  } catch (err) {
    console.error(`[my-focus] Error in recalculateHabitTargetsForGoal for goal ${goalInstanceId}:`, err);
    throw err; // Re-throw to be caught by the caller
  }
}
