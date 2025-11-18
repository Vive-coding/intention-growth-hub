import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { goalDefinitions, goalInstances, habitDefinitions, lifeMetricDefinitions, insights } from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

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
            summary: insight.summary,
            source: 'goal_creation',
            isFavorite: false,
            createdAt: new Date(),
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
 */
export const updateGoalProgressTool = new DynamicStructuredTool({
  name: "update_goal_progress",
  description: `Updates progress on a goal based on user's report.
  
  **IMPORTANT**: You MUST call get_context("all_goals") first to get the goal UUID. Never use goal names as the goal_id.
  
  Use when user shares accomplishments or progress on a goal ("I worked out," "I saved $200 this week," "I completed 3 interviews").
  This tool updates the goal's progress percentage in the database (not just fetching/displaying).
  System will parse the update and adjust progress % automatically.
  
  Workflow:
  1. Call get_context("all_goals") to see all goals and their UUIDs
  2. Find the goal by matching the title
  3. Use that goal's UUID (not the title!) in the goal_id parameter
  
  Returns: Updated goal card with celebration if milestone reached`,
  
  schema: z.object({
    goal_id: z.string().uuid().describe("UUID of the goal (from get_context output)"),
    progress_update: z.string().describe("What they accomplished (natural language)")
  }),
  
  func: async ({ goal_id, progress_update }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(goal_id)) {
      throw new Error(`Invalid goal_id "${goal_id}". You must use the UUID from get_context("all_goals"), not the goal name. Call get_context("all_goals") first to get the correct UUID.`);
    }
    
    try {
      const resolved = await resolveGoalInstance(userId, goal_id);
      if (!resolved) {
        console.error(`[updateGoalProgressTool] Goal not found - userId: ${userId}, goal_id: ${goal_id}`);
        throw new Error(`Goal instance not found. The goal may have been archived or deleted. Please use get_context("all_goals") to see the user's current active goals.`);
      }
      
      // Check if goal is archived or inactive
      if (resolved.instance.status === 'completed' || resolved.instance.status === 'cancelled' || resolved.instance.archived) {
        throw new Error(`This goal is ${resolved.instance.status || 'archived'}. Use get_context("all_goals") to see active goals instead.`);
      }

      const instance = resolved.instance;
      const goalInstanceId = instance.id;
      
      // Simple progress parsing (can be enhanced with AI)
      const currentProgress = instance.currentValue || 0;
      const targetValue = instance.targetValue || 100;
      const currentPercentage = Math.round((currentProgress / targetValue) * 100);
      
      // Look for numbers in the update
      const numberMatch = progress_update.match(/(\d+)/);
      const increment = numberMatch ? parseInt(numberMatch[1]) : Math.round(targetValue * 0.1); // 10% default
      
      const newValue = Math.min(currentProgress + increment, targetValue);
      const newPercentage = Math.round((newValue / targetValue) * 100);
      
      // Update in database
      await db
        .update(goalInstances)
        .set({ 
          currentValue: newValue,
          status: newValue >= targetValue ? "completed" : instance.status,
          completedAt: newValue >= targetValue ? new Date() : instance.completedAt
        })
        .where(eq(goalInstances.id, goalInstanceId));
      
      // Get goal definition for title
      const goalDef = resolved.definition;
      
      const milestoneReached = (currentPercentage < 25 && newPercentage >= 25) ||
                                (currentPercentage < 50 && newPercentage >= 50) ||
                                (currentPercentage < 75 && newPercentage >= 75);
      
      return {
        type: "progress_update",
        goal_id: goalInstanceId,
        goal_title: goalDef?.title || "Goal",
        old_progress: currentPercentage,
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

