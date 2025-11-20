import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import {
  goalDefinitions,
  goalInstances,
  habitDefinitions,
  habitInstances,
  lifeMetricDefinitions,
  insights,
} from "../../../shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

/**
 * Helper: Generate habit suggestions for a goal
 */
async function generateHabitSuggestions(goalTitle: string, lifeMetric: string, userId: string) {
  // Simple rule-based suggestions (can be enhanced with AI later)
  const suggestions = [];
  
  const titleLower = goalTitle.toLowerCase();
  
  // Career goals
  if (lifeMetric.includes("Career") || titleLower.includes("career") || titleLower.includes("job")) {
    suggestions.push({
      title: "Update resume and portfolio (15 min/day)",
      frequency: "daily",
      reasoning: "Consistent small improvements compound into a strong professional presence"
    });
    suggestions.push({
      title: "Network with 1 person in your field",
      frequency: "weekly",
      reasoning: "Relationships open doors to opportunities you won't find posted online"
    });
  }
  
  // Health goals
  if (lifeMetric.includes("Health") || titleLower.includes("health") || titleLower.includes("fitness")) {
    suggestions.push({
      title: "20-minute morning workout",
      frequency: "daily",
      reasoning: "Morning exercise boosts energy and sets a positive tone for the day"
    });
    suggestions.push({
      title: "Track food and water intake",
      frequency: "daily",
      reasoning: "Awareness is the first step to sustainable change"
    });
  }
  
  // Learning goals
  if (titleLower.includes("learn") || titleLower.includes("skill") || titleLower.includes("study")) {
    suggestions.push({
      title: "Focused practice session (30 min)",
      frequency: "daily",
      reasoning: "Daily practice builds competence faster than sporadic marathon sessions"
    });
    suggestions.push({
      title: "Teach someone what you learned",
      frequency: "weekly",
      reasoning: "Teaching reinforces your understanding and reveals gaps"
    });
  }
  
  // Default suggestions if no specific patterns match
  if (suggestions.length === 0) {
    suggestions.push({
      title: "Daily progress check-in (5 min)",
      frequency: "daily",
      reasoning: "Regular reflection keeps you aligned with your goal"
    });
    suggestions.push({
      title: "Weekly goal review and planning",
      frequency: "weekly",
      reasoning: "Step back to assess progress and adjust approach"
    });
  }
  
  return suggestions.slice(0, 3); // Max 3 suggestions
}

async function resolveGoalInstance(userId: string, identifier: string) {
  const [instance] = await db
    .select()
    .from(goalInstances)
    .where(
      and(
        eq(goalInstances.id, identifier),
        eq(goalInstances.userId, userId)
      )
    )
    .limit(1);

  if (instance) {
    const [definition] = await db
      .select()
      .from(goalDefinitions)
      .where(eq(goalDefinitions.id, instance.goalDefinitionId))
      .limit(1);

    return { instance, definition };
  }

  const [byDefinition] = await db
    .select({
      inst: goalInstances,
      def: goalDefinitions,
    })
    .from(goalDefinitions)
    .innerJoin(goalInstances, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
    .where(
      and(
        eq(goalDefinitions.id, identifier),
        eq(goalDefinitions.userId, userId),
        eq(goalInstances.userId, userId)
      )
    )
    .orderBy(desc(goalInstances.createdAt))
    .limit(1);

  if (!byDefinition) {
    return null;
  }

  return {
    instance: byDefinition.inst,
    definition: byDefinition.def,
  };
}

/**
 * Tool 1: Create goal with linked habits
 */
export const createGoalWithHabitsTool = new DynamicStructuredTool({
  name: "create_goal_with_habits",
  description: `Creates a new goal with supporting habits.

Required: title, life_metric, importance, target_date, urgency
Optional: habit_suggestions (auto-generated if not provided)

Make reasonable assumptions when appropriate:
- If timing isn't specified, assume "moderate" urgency and set target_date 30-90 days out
- If life_metric is unclear from context, infer from the goal type
- If importance isn't stated, derive it from the enthusiasm/language used

Gather missing critical details conversationally, but don't block on every detail. You can call this tool when you have the essential information (title and basic goal idea), even if some details like exact target dates need reasonable assumptions.

Returns: Interactive card with goal + habit suggestions`,
  
  schema: z.object({
    goal_data: z.object({
      title: z.string().describe("Clear, specific goal statement"),
      life_metric: z.string().describe("Life area category"),
      importance: z.string().describe("Why this matters to them personally"),
      target_date: z.string().describe("Target date YYYY-MM-DD"),
      urgency: z.enum(["urgent", "moderate", "flexible"])
    }),
    habit_suggestions: z.array(z.object({
      title: z.string(),
      frequency: z.string(),
      reasoning: z.string()
    })).optional().describe("Custom habit suggestions (auto-generated if not provided)"),
    insight: z.object({
      title: z.string().describe("Brief, memorable title for the insight (5-10 words)"),
      summary: z.string().describe("The insight about the user's pattern, motivation, or characteristic (1-2 sentences)")
    }).optional().describe("Optional insight to remember about the user's motivations, patterns, or characteristics revealed during goal setting")
  }),
  
  func: async ({ goal_data, habit_suggestions, insight }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    const threadId = (global as any).__TOOL_THREAD_ID__;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Auto-save insight if provided
      if (insight) {
        try {
          await db.insert(insights).values({
            userId,
            title: insight.title,
            explanation: insight.summary,
            confidence: 80,
            themes: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log('✅ Auto-saved insight during goal creation:', insight.title);
        } catch (error) {
          console.error('Failed to save insight during goal creation:', error);
          // Don't fail the entire goal creation if insight save fails
        }
      }
      
      // Auto-generate habits if not provided
      const habits = habit_suggestions || await generateHabitSuggestions(
        goal_data.title,
        goal_data.life_metric,
        userId
      );
      
      // Return structured data for frontend card rendering
      // This matches your existing GoalSuggestionCard format!
      const result = {
        type: "goal_suggestion",
        goal: {
          title: goal_data.title,
          description: goal_data.importance,
          category: goal_data.life_metric,
          priority: goal_data.urgency === "urgent" ? "Priority 1" : 
                    goal_data.urgency === "moderate" ? "Priority 2" : "Priority 3",
          targetDate: goal_data.target_date
        },
        habits: habits.map(h => ({
          title: h.title,
          description: h.reasoning,
          frequency: h.frequency,
          impact: "high"
        }))
      };
      
      // IMPORTANT: Return as JSON string for LangChain
      console.log("[createGoalWithHabitsTool] ✅ Returning goal suggestion:", result.type);
      return JSON.stringify(result);
    } catch (error) {
      console.error("[createGoalWithHabitsTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 2: Suggest habits for existing goal
 */
export const suggestHabitsForGoalTool = new DynamicStructuredTool({
  name: "suggest_habits_for_goal",
  description: `Suggests habits to support an existing goal that's struggling.
  
  Args:
  - goal_id: Which goal needs support (infer from conversation context when possible)
  - context: Why suggesting now (e.g., "User reports lack of progress")
  
  Use when:
  - User says goal isn't progressing
  - Goal has no linked habits
  - User asks "what would help with X goal?" or expresses uncertainty about next steps
  
  Infer the goal from conversation context when clear, or confirm if multiple goals could apply.
  
  Returns: Habit suggestion cards (accept/modify/dismiss)`,
  
  schema: z.object({
    goal_id: z.string().describe("UUID of the goal"),
    context: z.string().optional().describe("Why suggesting habits now")
  }),
  
  func: async ({ goal_id, context }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Get the goal
      const [goalDef] = await db
        .select()
        .from(goalDefinitions)
        .where(
          and(
            eq(goalDefinitions.id, goal_id),
            eq(goalDefinitions.userId, userId)
          )
        )
        .limit(1);
      
      if (!goalDef) {
        throw new Error("Goal not found");
      }
      
      // Get life metric name
      let lifeMetricName = goalDef.category || "General";
      if (goalDef.lifeMetricId) {
        const [metric] = await db
          .select()
          .from(lifeMetricDefinitions)
          .where(eq(lifeMetricDefinitions.id, goalDef.lifeMetricId))
          .limit(1);
        
        if (metric) {
          lifeMetricName = metric.name;
        }
      }
      
      // Generate suggestions
      const habits = await generateHabitSuggestions(goalDef.title, lifeMetricName, userId);
      
      return {
        type: "habit_suggestions",
        goal_id: goal_id,
        goal_title: goalDef.title,
        context: context || "To support your goal progress",
        habits: habits.map(h => ({
          title: h.title,
          description: h.reasoning,
          frequency: h.frequency,
          impact: "high"
        }))
      };
    } catch (error) {
      console.error("[suggestHabitsForGoalTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 3: Update goal progress
 * 
 * This tool accepts a goal description and automatically matches it to an active goal.
 * The agent never needs to provide UUIDs - just describe which goal.
 */
export const updateGoalProgressTool = new DynamicStructuredTool({
  name: "update_goal_progress",
  description: `Updates progress on a goal based on user's report.
  
  **CRITICAL**: DO NOT call this tool after log_habit_completion. Habit logging already updates goal progress automatically.
  
  **How to use this tool**:
  - Describe which goal the user is updating (e.g., "workout goal", "job search", "save money")
  - The tool will automatically match it to their active goals
  - You do NOT need to call get_context first - just describe the goal
  
  **CRITICAL DISTINCTION**:
  - Use log_habit_completion when user describes an ACTION they took that matches a habit (e.g., "I reached out to contacts", "I worked out", "I journaled", "I applied to jobs")
  - Use update_goal_progress ONLY when user describes OVERALL PROGRESS or PERCENTAGE advancement without mentioning a specific habit action (e.g., "I'm 40% done with the launch", "I made good progress on the project this week", "I finished half the slides")
  
  Use when:
  - User reports percentage-based progress ("I'm 40% done", "halfway there")
  - User reports general work/advancement without describing a specific habit action
  - Example: "I made a lot of progress on the Substack launch this week" (general work, not a specific habit action)
  
  DO NOT use when:
  - User describes completing a specific HABIT ACTION (e.g., "I reached out to contacts", "I worked out", "I applied to jobs") - use log_habit_completion instead
  - User says "I did [habit name]" or describes a specific action - use log_habit_completion
  - You just called log_habit_completion - goal progress is already updated
  
  Returns: Updated goal card with celebration if milestone reached`,
  
  schema: z.object({
    goal_description: z.string().describe("Description of which goal (e.g., 'workout goal', 'job search'). The tool will match this automatically."),
    progress_update: z.string().describe("What they accomplished (natural language)")
  }),
  
  func: async ({ goal_description, progress_update }, config) => {
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Fetch all active goals for matching
      const activeGoalsRows = await db
        .select({
          goalDefId: goalDefinitions.id,
          goalInstId: goalInstances.id,
          title: goalDefinitions.title,
          description: goalDefinitions.description,
          status: goalInstances.status,
          archived: goalInstances.archived,
        })
        .from(goalInstances)
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .where(
          and(
            eq(goalDefinitions.userId, userId),
            eq(goalInstances.status, 'active'),
            eq(goalInstances.archived, false)
          )
        );
      
      if (activeGoalsRows.length === 0) {
        throw new Error("No active goals found for this user.");
      }
      
      // Normalize search
      const normalizedSearch = goal_description.toLowerCase().trim();
      
      // Try exact match first
      let matchedGoal = activeGoalsRows.find(g => 
        g.title.toLowerCase() === normalizedSearch
      );
      
      // Try partial match
      if (!matchedGoal) {
        matchedGoal = activeGoalsRows.find(g => {
          const title = g.title.toLowerCase();
          return title.includes(normalizedSearch) || normalizedSearch.includes(title);
        });
      }
      
      // Try keyword matching with confidence scoring
      if (!matchedGoal) {
        const searchTerms = normalizedSearch.split(/\s+/).filter(term => term.length > 2);
        let bestMatch: { goal: typeof activeGoalsRows[0], score: number, confidence: number } | null = null;
        
        for (const goal of activeGoalsRows) {
          const goalTitle = goal.title.toLowerCase();
          const goalDesc = (goal.description || '').toLowerCase();
          
          let titleMatchedTerms = 0;
          let descMatchedTerms = 0;
          
          for (const term of searchTerms) {
            if (goalTitle.includes(term)) {
              titleMatchedTerms++;
            } else if (goalDesc.includes(term)) {
              descMatchedTerms++;
            }
          }
          
          const titleConfidence = searchTerms.length > 0 ? (titleMatchedTerms / searchTerms.length) * 100 : 0;
          const score = (titleMatchedTerms * 3) + descMatchedTerms;
          
          if ((titleConfidence >= 60 || score >= 5) && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { goal, score, confidence: titleConfidence };
          }
        }
        
        if (bestMatch) {
          matchedGoal = bestMatch.goal;
        }
      }
      
      if (!matchedGoal) {
        throw new Error(
          `Could not find a matching goal for "${goal_description}".\n\n` +
          `Tell the user: "I couldn't find that goal. You can update it manually in My Focus, or we can create a new goal if you'd like."`
        );
      }
      
      // Now resolve the full goal instance
      const resolved = await resolveGoalInstance(userId, matchedGoal.goalInstId);
      if (!resolved) {
        throw new Error("Goal instance not found after matching.");
      }

      const instance = resolved.instance;
      const goalInstanceId = instance.id;
      const goalDef = resolved.definition;
      
      // Calculate OLD progress using the same formula as everywhere else:
      // habitBasedProgress (avg of habits, capped at 90%) + manualOffset (currentValue)
      const { habitInstances: habitInstancesTable, habitDefinitions: habitDefinitionsTable } = await import('../../../shared/schema');
      const associatedHabits = await db
        .select({ habitInst: habitInstancesTable, habitDef: habitDefinitionsTable })
        .from(habitInstancesTable)
        .leftJoin(habitDefinitionsTable, eq(habitInstancesTable.habitDefinitionId, habitDefinitionsTable.id))
        .where(eq(habitInstancesTable.goalInstanceId, goalInstanceId));
      
      let oldHabitBasedProgress = 0;
      if (associatedHabits.length > 0) {
        let total = 0;
        for (const hi of associatedHabits) {
          const target = (hi as any).habitInst?.targetValue || 0;
          const current = (hi as any).habitInst?.currentValue || 0;
          const p = target > 0 ? Math.min((current / target) * 100, 100) : 0;
          total += p;
        }
        const average = total / associatedHabits.length;
        oldHabitBasedProgress = Math.min(average, 90);
      }
      
      const oldManualOffset = instance.currentValue || 0;
      const oldTotalProgress = Math.max(0, Math.min(100, oldHabitBasedProgress + oldManualOffset));
      const oldPercentage = Math.round(oldTotalProgress);
      
      // Parse the progress update to determine the manual offset increment
      // Look for numbers in the update text (percentage or raw number)
      const numberMatch = progress_update.match(/(\d+)/);
      let manualOffsetIncrement = 0;
      
      if (numberMatch) {
        const num = parseInt(numberMatch[1]);
        // If the number is > 50, it's likely a percentage (e.g., "I'm 40% done")
        // Otherwise, treat as a small increment
        if (num >= 1 && num <= 100 && progress_update.toLowerCase().includes('%')) {
          // User specified a target percentage - calculate offset needed
          const desiredTotal = Math.min(num, 99); // Cap at 99% (100% only via complete_goal)
          manualOffsetIncrement = desiredTotal - oldTotalProgress;
        } else {
          // Small increment (e.g., "added 5 more slides")
          manualOffsetIncrement = Math.min(num, 10); // Cap small increments
        }
      } else {
        // Default: add 5% manual offset for general progress reports
        manualOffsetIncrement = 5;
      }
      
      // Calculate new manual offset
      const newManualOffset = oldManualOffset + manualOffsetIncrement;
      
      // Calculate new total progress (same formula)
      const newTotalProgress = Math.max(0, Math.min(100, oldHabitBasedProgress + newManualOffset));
      const newPercentage = Math.round(newTotalProgress);
      
      // Update goal instance: store the new manual offset in currentValue
      await db
        .update(goalInstances)
        .set({ 
          currentValue: newManualOffset,
          status: newPercentage >= 100 ? "completed" : instance.status,
          completedAt: newPercentage >= 100 ? new Date() : instance.completedAt
        })
        .where(eq(goalInstances.id, goalInstanceId));
      
      const milestoneReached = (oldPercentage < 25 && newPercentage >= 25) ||
                                (oldPercentage < 50 && newPercentage >= 50) ||
                                (oldPercentage < 75 && newPercentage >= 75);
      
      return {
        type: "progress_update",
        goal_id: goalInstanceId,
        goal_title: goalDef?.title || "Goal",
        old_progress: oldPercentage,
        new_progress: newPercentage,
        update_text: progress_update,
        milestone_reached: milestoneReached,
        completed: newPercentage >= 100,
        celebration: milestoneReached ? `🎉 ${newPercentage}% milestone reached!` : undefined
      };
    } catch (error) {
      console.error("[updateGoalProgressTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 4: Complete goal
 */
export const completeGoalTool = new DynamicStructuredTool({
  name: "complete_goal",
  description: `Marks goal as completed with celebration.
  
  Use when user reports achieving their goal.
  
  Returns: Celebration card with confetti, option to archive or set new goal`,
  
  schema: z.object({
    goal_id: z.string().describe("UUID of the goal"),
    reflection: z.string().optional().describe("What they learned, what worked")
  }),
  
  func: async ({ goal_id, reflection }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      const resolved = await resolveGoalInstance(userId, goal_id);
      
      if (!resolved) {
        throw new Error(`Goal instance not found: ${goal_id}`);
      }

      const instance = resolved.instance;
      const goalInstanceId = instance.id;
      
      // Update goal instance to completed
      await db
        .update(goalInstances)
        .set({
          status: "completed",
          currentValue: instance.targetValue || 100,
          completedAt: new Date()
        })
        .where(
          and(
            eq(goalInstances.id, goalInstanceId),
            eq(goalInstances.userId, userId)
          )
        );
      
      const goalDef = resolved.definition;
    
      if (!goalDef) {
        throw new Error(`Goal definition not found for instance: ${goal_id}`);
      }
      
      return {
        type: "goal_celebration",
        goal_id: goalInstanceId,
        goal_title: goalDef.title,
        completed_date: new Date().toISOString(),
        reflection: reflection || "",
        final_progress: 100
      };
    } catch (error) {
      console.error("[completeGoalTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 5: Adjust goal
 */
export const adjustGoalTool = new DynamicStructuredTool({
  name: "adjust_goal",
  description: `Adjusts goal properties (target date, title, urgency, etc.) when life circumstances change.
  
  Use when:
  - User mentions life changes, timing slipped, or wants to slow down/refocus
  - You notice from context that an adjustment is needed (e.g., goal seems unrealistic given recent updates)
  
  Infer the needed changes from their message when clear, or confirm if the desired adjustments are unclear.`,
  
  schema: z.object({
    goal_id: z.string().describe("UUID of the goal"),
    changes: z.record(z.any()).describe("Properties to change"),
    reason: z.string().optional().describe("Why adjusting")
  }),
  
  func: async ({ goal_id, changes, reason }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      const resolved = await resolveGoalInstance(userId, goal_id);
      if (!resolved) {
        throw new Error("Goal instance not found");
      }

      const instance = resolved.instance;
      const goalInstanceId = instance.id;
      const goalDefinitionId = resolved.definition?.id;

      // Update goal instance or definition based on what's being changed
      if (changes.targetDate) {
        await db
          .update(goalInstances)
          .set({ targetDate: new Date(changes.targetDate) })
          .where(
            and(
              eq(goalInstances.id, goalInstanceId),
              eq(goalInstances.userId, userId)
            )
          );
      }
      
      if (changes.title && goalDefinitionId) {
        await db
          .update(goalDefinitions)
          .set({ title: changes.title })
          .where(eq(goalDefinitions.id, goalDefinitionId));
      }
      
      return {
        success: true,
        message: `Goal updated successfully. ${reason || ""}`,
        goal_id: goalInstanceId
      };
    } catch (error) {
      console.error("[adjustGoalTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 6: Swap habits for an existing goal
 *
 * Use this ONLY after the user explicitly confirms they want to update
 * the habits under an existing focus goal instead of creating a new goal.
 */
export const swapHabitsForGoalTool = new DynamicStructuredTool({
  name: "swap_habits_for_goal",
  description: `Replaces or augments habits for an existing goal.

Use this when:
- The user is struggling with a goal's current habits and has agreed to try new ones instead.
- You have suggested 1–3 concrete new habits and the user says \"yes\" to swapping them in.

Behavior:
- Optionally removes specific existing habits from the goal.
- Adds new habits under the same goal (reusing existing habit definitions by title when possible).

IMPORTANT:
- Never call this without explicit confirmation from the user.
- Prefer to use it on one clearly identified focus goal at a time.`,

  schema: z.object({
    goal_id: z.string().describe("UUID of the goal instance whose habits should be updated"),
    remove_habit_ids: z
      .array(z.string())
      .optional()
      .describe("Optional list of habit definition UUIDs to detach from this goal"),
    new_habits: z
      .array(
        z.object({
          title: z.string().describe("Name of the new habit"),
          description: z.string().optional().describe("Why this habit matters or what it involves"),
          frequency: z
            .enum(["daily", "weekly", "monthly"])
            .optional()
            .describe("Rough cadence; defaults to daily"),
          perPeriodTarget: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("How many times per period; defaults to 1"),
        })
      )
      .min(1)
      .describe("New habits the user has agreed to try for this goal"),
  }),

  func: async ({ goal_id, remove_habit_ids, new_habits }, config) => {
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }

    return await db.transaction(async (tx) => {
      // Verify goal belongs to user
      const [goalRow] = await tx
        .select({
          inst: goalInstances,
          def: goalDefinitions,
        })
        .from(goalInstances)
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .where(and(eq(goalInstances.id, goal_id), eq(goalInstances.userId, userId)))
        .limit(1);

      if (!goalRow) {
        throw new Error("Goal not found or does not belong to this user.");
      }

      const goalTitle = goalRow.def.title;

      // Optionally remove existing habit links for this goal
      if (remove_habit_ids && remove_habit_ids.length > 0) {
        await tx
          .delete(habitInstances)
          .where(
            and(
              eq(habitInstances.userId, userId),
              eq(habitInstances.goalInstanceId, goal_id),
              inArray(habitInstances.habitDefinitionId, remove_habit_ids as any),
            ),
          );
      }

      const addedHabits: Array<{
        habit_definition_id: string;
        habit_instance_id: string;
        title: string;
      }> = [];

      // Simple default frequency settings similar to goal creation
      const computeDefaults = () => {
        const perPeriodTarget = 1;
        const periodsCount = 30; // ~1 month
        const targetValue = perPeriodTarget * periodsCount;
        return {
          frequency: "daily",
          perPeriodTarget,
          periodsCount,
          targetValue,
        };
      };

      for (const h of new_habits) {
        // Try to reuse an existing habit definition with the same title
        const [existingDef] = await tx
          .select()
          .from(habitDefinitions)
          .where(and(eq(habitDefinitions.userId, userId), eq(habitDefinitions.name, h.title)))
          .limit(1);

        let habitDefId: string;
        if (existingDef) {
          habitDefId = existingDef.id as string;
        } else {
          const [createdDef] = await tx
            .insert(habitDefinitions)
            .values({
              userId,
              name: h.title,
              description: h.description || "",
              category: null as any,
              isActive: true,
            } as any)
            .returning({ id: habitDefinitions.id });

          habitDefId = createdDef.id as string;
        }

        const freqDefaults = computeDefaults();
        const frequency = h.frequency || "daily";
        const perPeriodTarget = h.perPeriodTarget ?? freqDefaults.perPeriodTarget;
        const periodsCount = freqDefaults.periodsCount;
        const targetValue = perPeriodTarget * periodsCount;

        const [instance] = await tx
          .insert(habitInstances)
          .values({
            userId,
            goalInstanceId: goal_id,
            habitDefinitionId: habitDefId,
            targetValue,
            currentValue: 0,
            goalSpecificStreak: 0,
            frequencySettings: {
              frequency,
              perPeriodTarget,
              periodsCount,
            },
          } as any)
          .returning({ id: habitInstances.id });

        addedHabits.push({
          habit_definition_id: habitDefId,
          habit_instance_id: instance.id as string,
          title: h.title,
        });
      }

      return {
        type: "goal_habit_swap",
        goal_id,
        goal_title: goalTitle,
        removed_habit_ids: remove_habit_ids || [],
        added_habits: addedHabits,
      };
    });
  },
});

