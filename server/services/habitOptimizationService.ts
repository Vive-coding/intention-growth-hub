import { db } from "../db";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";
import {
  habitDefinitions,
  habitInstances,
  goalInstances,
  goalDefinitions,
  insights,
  feedbackEvents,
  lifeMetricDefinitions,
  journalEntries,
} from "../../shared/schema";
import {
  HabitOptimizationAgent,
  OptimizationContext,
  OptimizationProposal,
} from "../ai/habitOptimizationAgent";

export class HabitOptimizationService {
  /**
   * Archive orphaned habits (habits not linked to any active goals)
   * These habits remain available for future goal associations
   */
  static async archiveOrphanedHabits(userId: string): Promise<{ archivedCount: number; archivedHabits: string[] }> {
    console.log(`[HabitOptimization] Finding orphaned habits for user ${userId}`);

    // Get all active habits
    const activeHabits = await db
      .select({
        id: habitDefinitions.id,
        name: habitDefinitions.name,
      })
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, userId), eq(habitDefinitions.isActive, true)));

    console.log(`[HabitOptimization] Found ${activeHabits.length} active habits`);

    // For each habit, check if it's linked to any active goals
    const orphanedHabits: { id: string; name: string }[] = [];

    for (const habit of activeHabits) {
      const linkedGoals = await db
        .select({
          id: goalInstances.goalDefinitionId,
        })
        .from(habitInstances)
        .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
        .where(
          and(
            sql`${habitInstances.habitDefinitionId} = ${habit.id}::uuid`,
            eq(habitInstances.userId, userId),
            eq(goalInstances.status, "active")
          )
        );

      if (linkedGoals.length === 0) {
        orphanedHabits.push(habit);
      }
    }

    console.log(`[HabitOptimization] Found ${orphanedHabits.length} orphaned habits`);

    // Archive orphaned habits
    if (orphanedHabits.length > 0) {
      const orphanedIds = orphanedHabits.map(h => h.id);
      
      await db
        .update(habitDefinitions)
        .set({ isActive: false })
        .where(
          and(
            eq(habitDefinitions.userId, userId),
            inArray(habitDefinitions.id, orphanedIds)
          )
        );

      // Log feedback events
      for (const habit of orphanedHabits) {
        await db.insert(feedbackEvents).values({
          userId,
          type: "habit_optimization",
          action: "archive_orphaned",
          itemId: habit.id,
          context: { reason: "No active goal associations" },
        });
      }

      console.log(`[HabitOptimization] Archived ${orphanedHabits.length} orphaned habits`);
    }

    return {
      archivedCount: orphanedHabits.length,
      archivedHabits: orphanedHabits.map(h => h.name),
    };
  }

  /**
   * Build comprehensive context for optimization analysis
   */
  static async buildOptimizationContext(userId: string): Promise<OptimizationContext> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Fetch all active habit definitions with their metrics
    const activeHabits = await db
      .select({
        id: habitDefinitions.id,
        name: habitDefinitions.name,
        description: habitDefinitions.description,
        category: habitDefinitions.category,
        globalCompletions: habitDefinitions.globalCompletions,
        globalStreak: habitDefinitions.globalStreak,
      })
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, userId), eq(habitDefinitions.isActive, true)));

    // 2. For each habit, get completion rate and linked goals
    const habitsWithMetrics = await Promise.all(
      activeHabits.map(async (habit) => {
        // Get life metric name (handle null category)
        let categoryName = "Unknown";
        let categoryId = "";
        
        if (habit.category) {
          try {
            // Validate that category looks like a UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(habit.category)) {
              const [lifeMetric] = await db
                .select({ name: lifeMetricDefinitions.name })
                .from(lifeMetricDefinitions)
                .where(sql`${lifeMetricDefinitions.id} = ${habit.category}::uuid`)
                .limit(1);
              categoryName = lifeMetric?.name || "Unknown";
              categoryId = habit.category;
            } else {
              // If category is not a UUID, try to find it by name
              const [lifeMetric] = await db
                .select({ id: lifeMetricDefinitions.id, name: lifeMetricDefinitions.name })
                .from(lifeMetricDefinitions)
                .where(eq(lifeMetricDefinitions.name, habit.category))
                .limit(1);
              
              if (lifeMetric) {
                categoryName = lifeMetric.name;
                categoryId = lifeMetric.id;
              }
            }
          } catch (error) {
            console.error(`[HabitOptimization] Error fetching life metric for habit ${habit.id}:`, error);
          }
        }

        // Get linked goals via habit instances
        const linkedGoals = await db
          .select({
            id: goalInstances.goalDefinitionId,
            title: goalDefinitions.title,
          })
          .from(habitInstances)
          .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
          .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
          .where(
            and(
              sql`${habitInstances.habitDefinitionId} = ${habit.id}::uuid`,
              eq(habitInstances.userId, userId),
              eq(goalInstances.status, "active")
            )
          );

        // Calculate completion rate for last 30 days (simplified)
        const completionRate = Math.min(100, (habit.globalCompletions || 0) * 5); // Rough approximation

        return {
          id: habit.id,
          name: habit.name,
          description: habit.description || "",
          category: habit.category || "",
          categoryName,
          completionRate,
          streak: habit.globalStreak || 0,
          linkedGoals: linkedGoals.map((g) => ({ id: g.id || "", title: g.title })),
        };
      })
    );

    // 3. Fetch all active goals
    const activeGoals = await db
      .select({
        id: goalDefinitions.id,
        title: goalDefinitions.title,
        description: goalDefinitions.description,
        lifeMetricId: goalDefinitions.lifeMetricId,
        targetDate: goalInstances.targetDate,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(eq(goalInstances.userId, userId), eq(goalInstances.status, "active")));

    // Get life metric names for goals
    const goalsWithMetrics = await Promise.all(
      activeGoals.map(async (goal) => {
        let lifeMetricName = "Unknown";
        if (goal.lifeMetricId) {
          try {
            // Validate UUID format before querying
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(goal.lifeMetricId)) {
              const [lifeMetric] = await db
                .select({ name: lifeMetricDefinitions.name })
                .from(lifeMetricDefinitions)
                .where(sql`${lifeMetricDefinitions.id} = ${goal.lifeMetricId}::uuid`)
                .limit(1);
              lifeMetricName = lifeMetric?.name || "Unknown";
            }
          } catch (error) {
            console.error(`[HabitOptimization] Error fetching life metric for goal ${goal.id}:`, error);
          }
        }

        return {
          id: goal.id,
          title: goal.title,
          description: goal.description || "",
          lifeMetricId: goal.lifeMetricId || "",
          lifeMetricName,
          targetDate: goal.targetDate?.toISOString().split("T")[0] || "No target date",
        };
      })
    );

    // 4. Fetch upvoted insights
    const upvotedInsights = await db
      .select({
        title: insights.title,
        explanation: insights.explanation,
      })
      .from(feedbackEvents)
      .innerJoin(insights, sql`${feedbackEvents.itemId}::uuid = ${insights.id}`)
      .where(
        and(
          eq(feedbackEvents.userId, userId),
          eq(feedbackEvents.type, "insight"),
          eq(feedbackEvents.action, "upvote")
        )
      )
      .orderBy(desc(feedbackEvents.createdAt))
      .limit(5);

    // 5. Get recent journal themes (last 5 entries)
    const recentJournals = await db
      .select({
        content: journalEntries.content,
      })
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), gte(journalEntries.createdAt, thirtyDaysAgo)))
      .orderBy(desc(journalEntries.createdAt))
      .limit(5);

    const journalThemes =
      recentJournals.length > 0
        ? `Recent journal focus: ${recentJournals.map((j) => j.content.substring(0, 100)).join(" | ")}`
        : "No recent journal entries.";

    return {
      currentHabits: habitsWithMetrics,
      activeGoals: goalsWithMetrics,
      upvotedInsights,
      journalThemes,
    };
  }

  /**
   * Analyze habits and generate optimization proposal
   */
  static async analyzeHabits(userId: string): Promise<OptimizationProposal> {
    console.log(`[HabitOptimization] Starting analysis for user ${userId}`);

    // Build context
    const context = await this.buildOptimizationContext(userId);

    // Validate that user has enough habits to optimize
    if (context.currentHabits.length < 3) {
      throw new Error("Need at least 3 habits to perform optimization");
    }

    console.log(
      `[HabitOptimization] Context built: ${context.currentHabits.length} habits, ${context.activeGoals.length} goals`
    );

    // Call AI agent
    const agent = new HabitOptimizationAgent();
    const proposal = await agent.analyzeAndOptimize(context);

    // Validate the proposal
    const validation = agent.validateOptimization(proposal, context);
    if (!validation.valid) {
      console.error("[HabitOptimization] Invalid proposal:", validation.errors);
      throw new Error(`Invalid optimization proposal: ${validation.errors.join("; ")}`);
    }

    // Fix the math - AI sometimes gets this wrong
    const actualHabitsBefore = context.currentHabits.length;
    const actualHabitsAfter = actualHabitsBefore - proposal.habitsToArchive.length + proposal.habitsToCreate.length;
    
    // Override the AI's calculations with correct math
    proposal.summary.habitsBefore = actualHabitsBefore;
    proposal.summary.habitsAfter = actualHabitsAfter;

    console.log("[HabitOptimization] Valid proposal generated");
    console.log(`[HabitOptimization] Corrected math: ${actualHabitsBefore} - ${proposal.habitsToArchive.length} + ${proposal.habitsToCreate.length} = ${actualHabitsAfter} habits`);
    return proposal;
  }

  /**
   * Execute the optimization: archive old habits and create new ones
   */
  static async executeOptimization(
    userId: string,
    proposal: OptimizationProposal
  ): Promise<void> {
    console.log(`[HabitOptimization] Executing optimization for user ${userId}`);

    try {
      // Start transaction-like operation
      // 1. BEFORE archiving, capture progress and convert to manual for affected goals
      // Validate all habit IDs are UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const habitIdsToArchive = proposal.habitsToArchive
        .map((h) => h.id)
        .filter((id) => {
          if (!uuidRegex.test(id)) {
            console.warn(`[HabitOptimization] Skipping invalid habit ID for archiving: ${id}`);
            return false;
          }
          return true;
        });
      
      if (habitIdsToArchive.length > 0) {
        // For each habit being archived, find its instances and transfer progress to goals
        for (const habitId of habitIdsToArchive) {
          const instances = await db
            .select({
              goalInstanceId: habitInstances.goalInstanceId,
              currentValue: habitInstances.currentValue,
            })
            .from(habitInstances)
            .where(sql`${habitInstances.habitDefinitionId} = ${habitId}::uuid`);

          // Transfer each instance's progress as manual progress to the goal
          for (const instance of instances) {
            if (instance.currentValue && instance.currentValue > 0) {
              // Add the habit's progress to the goal's manual currentValue
              await db
                .update(goalInstances)
                .set({
                  currentValue: sql`${goalInstances.currentValue} + ${instance.currentValue}`,
                })
                .where(sql`${goalInstances.id} = ${instance.goalInstanceId}::uuid`);

              console.log(
                `[HabitOptimization] Transferred ${instance.currentValue} progress from habit ${habitId} to goal ${instance.goalInstanceId}`
              );
            }
          }
        }

        // Now archive the habits
        await db
          .update(habitDefinitions)
          .set({ isActive: false })
          .where(
            and(
              eq(habitDefinitions.userId, userId),
              inArray(habitDefinitions.id, habitIdsToArchive)
            )
          );

        console.log(`[HabitOptimization] Archived ${habitIdsToArchive.length} habits`);

        // Record feedback events for archived habits
        for (const habit of proposal.habitsToArchive) {
          await db.insert(feedbackEvents).values({
            userId,
            type: "habit_optimization",
            action: "archive",
            itemId: habit.id,
            context: { reason: habit.reason },
          });
        }
      }

      // 2. Create new habits
      const newHabitIds: { oldConsolidatedIds: string[]; newHabitId: string }[] = [];

      for (const newHabit of proposal.habitsToCreate) {
        // Validate and potentially lookup the category
        // The AI might return a UUID, a name, or something else
        let categoryValue: string | null = null;
        
        if (newHabit.category) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          
          if (uuidRegex.test(newHabit.category)) {
            // It's already a valid UUID
            categoryValue = newHabit.category;
          } else {
            // Try to look it up by name
            const [lifeMetric] = await db
              .select({ id: lifeMetricDefinitions.id })
              .from(lifeMetricDefinitions)
              .where(eq(lifeMetricDefinitions.name, newHabit.category))
              .limit(1);
            
            if (lifeMetric) {
              categoryValue = lifeMetric.id;
            } else {
              console.warn(`[HabitOptimization] Could not resolve category: ${newHabit.category}`);
              // Leave it as null or the original value as a fallback
              categoryValue = null;
            }
          }
        }
        
        const [createdHabit] = await db
          .insert(habitDefinitions)
          .values({
            userId,
            name: newHabit.name,
            description: newHabit.description,
            category: categoryValue,
            globalCompletions: 0,
            globalStreak: 0,
            isActive: true,
          })
          .returning();

        console.log(`[HabitOptimization] Created habit: ${createdHabit.name}`);

        newHabitIds.push({
          oldConsolidatedIds: newHabit.consolidates,
          newHabitId: createdHabit.id,
        });

        // Record feedback event for created habit
        await db.insert(feedbackEvents).values({
          userId,
          type: "habit_optimization",
          action: "create",
          itemId: createdHabit.id,
          context: {
            consolidates: newHabit.consolidates,
            coversGoals: newHabit.coversGoals,
            isHighLeverage: newHabit.isHighLeverage,
          },
        });

        // 3. Create habit instances for covered goals with recalculated targets
        for (const goalId of newHabit.coversGoals) {
          // Validate goalId is a UUID before using it
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(goalId)) {
            console.warn(`[HabitOptimization] Skipping invalid goal ID: ${goalId}`);
            continue;
          }
          
          // Get the goal instance with all details
          const [goalInstance] = await db
            .select()
            .from(goalInstances)
            .where(
              and(
                sql`${goalInstances.goalDefinitionId} = ${goalId}::uuid`,
                eq(goalInstances.userId, userId)
              )
            )
            .limit(1);

          if (goalInstance) {
            // Get goal target date and calculate time remaining
            const targetDate = goalInstance.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // Default 90 days if no target
            const daysRemaining = Math.max(1, Math.ceil((targetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            
            // Calculate habit target based on AI-suggested frequency and time remaining
            // The AI provides targetCount (how many times per period) and targetFrequency (daily/weekly/monthly)
            let periodsCount = 1;
            let perPeriodTarget = newHabit.targetCount || 1; // Use AI's suggested count per period
            let totalHabitTarget = perPeriodTarget;

            // Calculate number of periods based on frequency and days remaining
            if (newHabit.targetFrequency === "daily") {
              periodsCount = daysRemaining;
              totalHabitTarget = perPeriodTarget * periodsCount;
            } else if (newHabit.targetFrequency === "weekly") {
              periodsCount = Math.max(1, Math.ceil(daysRemaining / 7));
              totalHabitTarget = perPeriodTarget * periodsCount;
            } else if (newHabit.targetFrequency === "monthly") {
              periodsCount = Math.max(1, Math.ceil(daysRemaining / 30));
              totalHabitTarget = perPeriodTarget * periodsCount;
            }

            // Create habit instance with calculated targets
            await db.insert(habitInstances).values({
              userId,
              habitDefinitionId: createdHabit.id,
              goalInstanceId: goalInstance.id,
              targetValue: totalHabitTarget,
              currentValue: 0,
              goalSpecificStreak: 0,
              frequencySettings: {
                frequency: newHabit.targetFrequency,
                perPeriodTarget,
                periodsCount,
              },
            });

            console.log(
              `[HabitOptimization] Linked habit "${createdHabit.name}" to goal "${goalInstance.id}"\n` +
              `  Frequency: ${newHabit.targetFrequency}\n` +
              `  Target: ${perPeriodTarget}x per ${newHabit.targetFrequency} × ${periodsCount} periods = ${totalHabitTarget} total\n` +
              `  Days remaining: ${daysRemaining}, Target date: ${targetDate.toISOString().split('T')[0]}`
            );
          }
        }
      }

      // 4. Record optimization session
      await db.insert(feedbackEvents).values({
        userId,
        type: "habit_optimization",
        action: "complete",
        itemId: userId, // Use userId as itemId for session-level events
        context: {
          habitsBefore: proposal.summary.habitsBefore,
          habitsAfter: proposal.summary.habitsAfter,
          archivedCount: proposal.habitsToArchive.length,
          createdCount: proposal.habitsToCreate.length,
          summary: proposal.summary,
        },
      });

      console.log("[HabitOptimization] Optimization completed successfully");
    } catch (error: any) {
      console.error("[HabitOptimization] Error during execution:", error);
      throw new Error(`Failed to execute optimization: ${error.message || 'Unknown error'}`);
    }
  }
}
