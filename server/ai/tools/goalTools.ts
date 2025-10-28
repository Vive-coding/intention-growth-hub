import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { goalDefinitions, goalInstances, habitDefinitions, lifeMetricDefinitions } from "../../../shared/schema";
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

/**
 * Tool 1: Create goal with linked habits
 */
export const createGoalWithHabitsTool = new DynamicStructuredTool({
  name: "create_goal_with_habits",
  description: `Creates a new goal and suggests habits to support it.
  
  Required information (gather naturally in conversation):
  - title: Clear, specific goal statement
  - life_metric: Which life area (use get_context("life_metrics") to see options)
  - importance: WHY it matters - their personal reason/motivation
  - target_date: When they want to achieve it (ISO format YYYY-MM-DD)
  - urgency: "urgent" | "moderate" | "flexible"
  
  Optional:
  - habit_suggestions: Custom habit suggestions (will auto-generate if not provided)
  
  Only call when you have ALL required information.
  If missing any, continue the conversation to gather it naturally.
  
  Returns: Card with goal + linked habit suggestions (accept/dismiss CTAs)`,
  
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
    })).optional().describe("Custom habit suggestions (auto-generated if not provided)")
  }),
  
  func: async ({ goal_data, habit_suggestions }) => {
    const userId = (global as any).__TOOL_USER_ID__;
    const threadId = (global as any).__TOOL_THREAD_ID__;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
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
  - goal_id: Which goal needs support
  - context: Why suggesting now (e.g., "User reports lack of progress")
  
  Use when:
  - User says goal isn't progressing
  - Goal has no linked habits
  - User asks "what would help with X goal?"
  
  Returns: Habit suggestion cards (accept/modify/dismiss)`,
  
  schema: z.object({
    goal_id: z.string().describe("UUID of the goal"),
    context: z.string().optional().describe("Why suggesting habits now")
  }),
  
  func: async ({ goal_id, context }, config) => {
    const userId = config?.configurable?.userId;
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
  
  Use when user shares accomplishments or progress on a goal.
  System will parse the update and adjust progress %.
  
  Returns: Updated goal card with celebration if milestone reached`,
  
  schema: z.object({
    goal_id: z.string().describe("UUID of the goal"),
    progress_update: z.string().describe("What they accomplished (natural language)")
  }),
  
  func: async ({ goal_id, progress_update }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Get goal instance
      const [instance] = await db
        .select()
        .from(goalInstances)
        .where(
          and(
            eq(goalInstances.id, goal_id),
            eq(goalInstances.userId, userId)
          )
        )
        .limit(1);
      
      if (!instance) {
        throw new Error("Goal instance not found");
      }
      
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
        .where(eq(goalInstances.id, goal_id));
      
      // Get goal definition for title
      const [goalDef] = await db
        .select()
        .from(goalDefinitions)
        .where(eq(goalDefinitions.id, instance.goalDefinitionId))
        .limit(1);
      
      const milestoneReached = (currentPercentage < 25 && newPercentage >= 25) ||
                                (currentPercentage < 50 && newPercentage >= 50) ||
                                (currentPercentage < 75 && newPercentage >= 75);
      
      return {
        type: "progress_update",
        goal_id: goal_id,
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
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Update goal instance
      await db
        .update(goalInstances)
        .set({
          status: "completed",
          currentValue: db
            .select({ targetValue: goalInstances.targetValue })
            .from(goalInstances)
            .where(eq(goalInstances.id, goal_id))
            .then(rows => rows[0]?.targetValue || 100),
          completedAt: new Date()
        })
        .where(
          and(
            eq(goalInstances.id, goal_id),
            eq(goalInstances.userId, userId)
          )
        );
      
      // Get goal details
      const [instance] = await db
        .select()
        .from(goalInstances)
        .where(eq(goalInstances.id, goal_id))
        .limit(1);
      
      const [goalDef] = await db
        .select()
        .from(goalDefinitions)
        .where(eq(goalDefinitions.id, instance.goalDefinitionId))
        .limit(1);
      
      return {
        type: "goal_celebration",
        goal_id: goal_id,
        goal_title: goalDef?.title || "Goal",
        completed_date: new Date().toISOString(),
        reflection: reflection,
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
  description: `Adjusts goal properties (target date, title, etc.) when life circumstances change.
  
  Use when user needs to modify a goal due to changing priorities or timeline.`,
  
  schema: z.object({
    goal_id: z.string().describe("UUID of the goal"),
    changes: z.record(z.any()).describe("Properties to change"),
    reason: z.string().optional().describe("Why adjusting")
  }),
  
  func: async ({ goal_id, changes, reason }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Update goal instance or definition based on what's being changed
      if (changes.targetDate) {
        await db
          .update(goalInstances)
          .set({ targetDate: new Date(changes.targetDate) })
          .where(
            and(
              eq(goalInstances.id, goal_id),
              eq(goalInstances.userId, userId)
            )
          );
      }
      
      if (changes.title) {
        // Find the definition ID first
        const [instance] = await db
          .select()
          .from(goalInstances)
          .where(eq(goalInstances.id, goal_id))
          .limit(1);
        
        if (instance) {
          await db
            .update(goalDefinitions)
            .set({ title: changes.title })
            .where(eq(goalDefinitions.id, instance.goalDefinitionId));
        }
      }
      
      return {
        success: true,
        message: `Goal updated successfully. ${reason || ""}`,
        goal_id: goal_id
      };
    } catch (error) {
      console.error("[adjustGoalTool] Error:", error);
      throw error;
    }
  }
});

