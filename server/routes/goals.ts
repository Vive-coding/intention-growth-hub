import { Router } from "express";
import { db } from "../db";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
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

interface AuthenticatedRequest extends Request {
  user: {
    claims: {
      sub: string;
    };
  };
}

const router = Router();

// Get all goals for the authenticated user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const metricFilter = req.query.metric as string;
    
    console.log('=== GOALS ENDPOINT DEBUG ===');
    console.log('Goals endpoint called with metricFilter:', metricFilter);
    console.log('All query params:', req.query);
    console.log('metricFilter type:', typeof metricFilter);
    console.log('metricFilter length:', metricFilter?.length);
    console.log('===========================');

    // Get goals with their instances
    const goalsWithInstances = await db
      .select({
        goalDefinition: goalDefinitions,
        goalInstance: goalInstances,
      })
      .from(goalDefinitions)
      .innerJoin(goalInstances, eq(goalDefinitions.id, goalInstances.goalDefinitionId))
      .where(eq(goalDefinitions.userId, userId))
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
          if (lastCompletionDate === null) {
            currentStreak = 1;
          } else if (completion.completedAt.getTime() === lastCompletionDate.getTime()) {
            currentStreak++;
          } else {
            currentStreak = 1;
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
        calculatedProgress = Math.min(averageProgress, 90);
        
        console.log(`Goal progress calculation: ${totalProgress} total, ${averageProgress} average, ${calculatedProgress} final`);
      }

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

// Get suggested goals
router.get("/suggested", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";

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

    const simplifiedSuggestedGoals = suggestedGoalsWithInsights.map(({ suggestedGoal, insight, lifeMetric }) => ({
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
    }));

    res.json(simplifiedSuggestedGoals);
  } catch (error) {
    console.error("Error fetching suggested goals:", error);
    res.status(500).json({ error: "Failed to fetch suggested goals" });
  }
});

// Get suggested habits
router.get("/habits/suggested", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";

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

    const simplifiedSuggestedHabits = suggestedHabitsWithInsights.map(({ suggestedHabit, insight, lifeMetric }) => ({
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
    }));

    res.json(simplifiedSuggestedHabits);
  } catch (error) {
    console.error("Error fetching suggested habits:", error);
    res.status(500).json({ error: "Failed to fetch suggested habits" });
  }
});

// Get all habits for the user (for goal selection - includes inactive habits)
router.get("/habits/all", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";

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

// Get all habits for the user
router.get("/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";

    // First get all habits without completions (limit to 50 for performance)
    const habits = await db
      .select()
      .from(habitDefinitions)
      .where(and(
        eq(habitDefinitions.userId, userId),
        eq(habitDefinitions.isActive, true)
      ))
      .limit(50); // Limit to 50 habits for performance

    // For each habit, get recent completions (limit to last 30 for performance)
    const habitsWithStats = await Promise.all(habits.map(async (habit) => {
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
        id: habit.id,
        title: habit.name,
        description: habit.description,
        category: habit.category,
        currentStreak,
        longestStreak,
        totalCompletions: habit.globalCompletions || 0, // Use stored value instead of counting
        globalCompletions: habit.globalCompletions,
        globalStreak: habit.globalStreak,
      };
    }));

    res.json(habitsWithStats);
  } catch (error) {
    console.error("Error fetching habits:", error);
    res.status(500).json({ error: "Failed to fetch habits" });
  }
});

// Complete a habit
router.post("/habits/:id/complete", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const habitId = req.params.id;
    const { notes, goalId } = req.body; // Add goalId to know which goal to update

    // Check if habit exists
    const habit = await db
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.id, habitId), eq(habitDefinitions.userId, userId)))
      .limit(1);

    if (!habit[0]) {
      return res.status(404).json({ error: "Habit not found" });
    }

    // Create completion record
    const [completion] = await db
      .insert(habitCompletions)
      .values({
        habitDefinitionId: habitId,
        userId,
        notes: notes || null,
      })
      .returning();

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

    // If goalId is provided, update goal-specific progress
    if (goalId) {
      // Find the habit instance for this goal
      const habitInstance = await db
        .select()
        .from(habitInstances)
        .where(and(
          eq(habitInstances.habitDefinitionId, habitId),
          eq(habitInstances.goalInstanceId, goalId)
        ))
        .limit(1);

      if (habitInstance[0]) {
        // Update habit instance current value
        const newCurrentValue = (habitInstance[0].currentValue || 0) + 1;
        
        await db
          .update(habitInstances)
          .set({
            currentValue: newCurrentValue,
            goalSpecificStreak: currentStreak,
          })
          .where(eq(habitInstances.id, habitInstance[0].id));

        // Note: Goal progress is now calculated dynamically when fetching goal details
        // No need to store it in the database
        console.log('Habit completed and goal progress will be calculated dynamically on next fetch');
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
    const userId = (req as any).user?.id || "dev-user-123";
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
    const userId = (req as any).user?.id || "dev-user-123";
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

// Add habit to goal
router.post("/:goalId/habits", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const goalInstanceId = req.params.goalId;
    const { habitDefinitionId, targetValue } = req.body;

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
    const [habitInstance] = await db
      .insert(habitInstances)
      .values({
        habitDefinitionId,
        goalInstanceId,
        userId,
        targetValue: targetValue || 1,
        currentValue: 0,
        goalSpecificStreak: 0,
      })
      .returning();

    res.status(201).json(habitInstance);
  } catch (error) {
    console.error("Error adding habit to goal:", error);
    res.status(500).json({ error: "Failed to add habit to goal" });
  }
});

// Remove habit from goal
router.delete("/:goalId/habits/:habitId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
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
    const userId = (req as any).user?.id || "dev-user-123";
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

    // Calculate goal progress based on associated habits
    let calculatedProgress = 0;
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
      calculatedProgress = Math.min(averageProgress, 90);
      
      console.log('Goal progress calculation:', {
        totalProgress,
        averageProgress,
        calculatedProgress
      });
    }

    // If goal reaches 100% through habits, automatically mark as completed
    let finalProgress = goal.goalInstance.status === "completed" ? 100 : Math.round(calculatedProgress);
    let finalStatus = goal.goalInstance.status;
    let finalCompletedAt = goal.goalInstance.completedAt;
    
    // Only mark as completed if it was manually completed, not from habit progress
    // Goals can reach 90% from habits but need manual completion to reach 100%

    // Get life metric
    const lifeMetric = goal.goalDefinition.category ? await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.name, goal.goalDefinition.category))
      .limit(1) : null;

    const goalWithHabits = {
      ...goal,
      lifeMetric,
      goalInstance: {
        ...goal.goalInstance,
        currentValue: finalProgress,
        status: finalStatus,
        completedAt: finalCompletedAt,
      },
      habits: associatedHabits.map(hi => ({
        id: hi.habitDefinition.id,
        title: hi.habitDefinition.name,
        description: hi.habitDefinition.description,
        category: hi.habitDefinition.category,
        targetValue: hi.habitInstance.targetValue,
        currentValue: hi.habitInstance.currentValue,
        goalSpecificStreak: hi.habitInstance.goalSpecificStreak,
      })),
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
    const userId = (req as any).user?.id || "dev-user-123";
    const { title, description, category, targetValue, targetDate, habitIds } = req.body;

    // Create goal definition
    const [goalDefinition] = await db
      .insert(goalDefinitions)
      .values({
        userId,
        title,
        description,
        category,
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
        targetValue: parseInt(targetValue),
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

    res.status(201).json({ goal: goalInstance, definition: goalDefinition });
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// Update a goal
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const goalId = req.params.id;
    const { title, description, targetValue, targetDate, status } = req.body;

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
    const userId = (req as any).user?.id || "dev-user-123";
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

export default router; 