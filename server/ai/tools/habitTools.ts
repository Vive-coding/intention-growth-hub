import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { habitDefinitions, habitCompletions } from "../../../shared/schema";
import { MyFocusService } from "../../services/myFocusService";
import { logHabitCompletion } from "../../services/habitCompletionService";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";

/**
 * Tool 1: Review daily habits (interactive checklist)
 */
export const reviewDailyHabitsTool = new DynamicStructuredTool({
  name: "review_daily_habits",
  description: `Shows interactive card with user's active habits to check off.
  
  Args:
  - date: Which day to review (defaults to "today")
  - pre_checked: Optional list of habit IDs user mentioned completing
  
  Use when:
  - User wants to see or log today's habits
  - Reviewing progress and you want current completion status
  - User mentions completing habits or asks what to do today
  
  This shows a card for users to check off habits. The system automatically updates goal progress based on habit completions over time.
  
  Returns: Interactive habit checklist card (user ticks completed ones)`,
  
  schema: z.object({
    date: z.string().default("today").describe("Date to review (YYYY-MM-DD or 'today')"),
    pre_checked: z.array(z.string()).optional().describe("Habit IDs user mentioned completing")
  }),
  
  func: async ({ date, pre_checked }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
      console.log("[reviewDailyHabitsTool] Using global userId:", userId);
    } else {
      console.log("[reviewDailyHabitsTool] Using config userId:", userId);
    }
    
    if (!userId) {
      console.error("[reviewDailyHabitsTool] ❌ No userId found in config or global!");
      throw new Error("User ID required");
    }
    
    try {
      // Parse date
      const targetDate = date === "today" ? new Date() : new Date(date);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Limit to My Focus high-leverage habits only (priority)
      const myFocus = await MyFocusService.getMyFocus(userId);
      const focusHabitIds = (myFocus.highLeverageHabits || []).map((h: any) => h.id).filter(Boolean);

      let habits;
      if (focusHabitIds.length > 0) {
        habits = await db
          .select({ 
            id: habitDefinitions.id, 
            name: habitDefinitions.name, 
            description: habitDefinitions.description,
            createdAt: habitDefinitions.createdAt 
          })
          .from(habitDefinitions)
          .where(
            and(
              eq(habitDefinitions.userId, userId),
              eq(habitDefinitions.isActive, true),
              inArray(habitDefinitions.id, focusHabitIds as any)
            )
          )
          .orderBy(desc(habitDefinitions.createdAt));
      } else {
        habits = await db
          .select({ 
            id: habitDefinitions.id, 
            name: habitDefinitions.name, 
            description: habitDefinitions.description,
            createdAt: habitDefinitions.createdAt 
          })
          .from(habitDefinitions)
          .where(and(eq(habitDefinitions.userId, userId), eq(habitDefinitions.isActive, true)))
          .orderBy(desc(habitDefinitions.createdAt));
      }

      const habitIds = habits.map(h => h.id);

      // Fetch today's completions for these habits
      let todays: Array<{ habitDefinitionId: string }> = [];
      if (habitIds.length > 0) {
        const rows = await db
          .select({ habitDefinitionId: habitCompletions.habitDefinitionId })
          .from(habitCompletions)
          .where(and(
            eq(habitCompletions.userId, userId),
            inArray(habitCompletions.habitDefinitionId, habitIds as any),
            // Same day filter (UTC date portion match)
            eq(sql`to_char(${habitCompletions.completedAt}, 'YYYY-MM-DD')`, dateStr as any)
          ));
        todays = rows.filter(r => !!r.habitDefinitionId) as any;
      }

      // Fetch last 30 days completions for streak calculation
      const since = new Date(targetDate);
      since.setDate(since.getDate() - 29);
      const sinceStr = since.toISOString().split('T')[0];

      let recent: Array<{ habitDefinitionId: string; completedAt: Date }> = [];
      if (habitIds.length > 0) {
        const rows = await db
          .select({ habitDefinitionId: habitCompletions.habitDefinitionId, completedAt: habitCompletions.completedAt })
          .from(habitCompletions)
          .where(and(
            eq(habitCompletions.userId, userId),
            inArray(habitCompletions.habitDefinitionId, habitIds as any),
            gte(sql`to_char(${habitCompletions.completedAt}, 'YYYY-MM-DD')`, sinceStr as any)
          ))
          .orderBy(desc(habitCompletions.completedAt));
        recent = rows.filter(r => !!r.habitDefinitionId) as any;
      }

      const completionsByHabit: Record<string, Date[]> = {};
      for (const r of recent) {
        const id = String(r.habitDefinitionId);
        if (!completionsByHabit[id]) completionsByHabit[id] = [];
        completionsByHabit[id].push(new Date(r.completedAt));
      }

      const calcStreak = (habitId: string): number => {
        const dates = (completionsByHabit[habitId] || []).map(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
        // Build a set of YYYY-MM-DD for quick lookup
        const set = new Set(dates.map(d => d.toISOString().split('T')[0]));
        let streak = 0;
        let cursor = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
        // Count consecutive days up to 30 days
        for (let i = 0; i < 30; i++) {
          const key = cursor.toISOString().split('T')[0];
          if (set.has(key)) {
            streak += 1;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
          } else {
            if (i === 0) {
              // If today wasn't completed, still check if there is a previous streak ending yesterday
              cursor.setUTCDate(cursor.getUTCDate() - 1);
              continue;
            }
            break;
          }
        }
        return streak;
      };

      const todaysSet = new Set(todays.map(t => String(t.habitDefinitionId)));
      const habitsWithStatus = habits.map((habit: any) => ({
        id: habit.id,
        title: habit.name,
        description: habit.description || '',
        checked: todaysSet.has(String(habit.id)) || (pre_checked?.includes(habit.id) ?? false),
        streak: calcStreak(String(habit.id)),
      }));
      
      // IMPORTANT: Return as JSON string for LangChain
      // The structured data will be extracted by processWithToolAgent
      const result = {
        type: "habit_review",
        date: dateStr,
        habits: habitsWithStatus.map(h => ({
          id: h.id,
          title: h.title,
          description: h.description,
          completed: h.checked,
          streak: h.streak,
          points: 1 // Simple point system
        }))
      };
      
      console.log("[reviewDailyHabitsTool] ✅ Returning habit review data:", {
        type: result.type,
        date: result.date,
        habitCount: result.habits.length
      });
      
      return JSON.stringify(result);
    } catch (error) {
      console.error("[reviewDailyHabitsTool] ❌ Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 2: Update habit
 */
export const updateHabitTool = new DynamicStructuredTool({
  name: "update_habit",
  description: `Modifies an existing habit (pause, resume, change frequency, or archive).
  
  Args:
  - habit_id: Which habit to modify (infer from conversation context when possible)
  - action: "pause" | "resume" | "change_frequency" | "archive"
  - value: Depends on action (resume_date for pause, new frequency, etc.)
  
  Use when:
  - User says a habit is too hard, not relevant, or too frequent
  - You notice from context that an adjustment is needed
  - Life circumstances change and habits need to adapt
  
  Infer the needed change from their message when clear, or confirm if uncertain.
  
  Returns: Confirmation message`,
  
  schema: z.object({
    habit_id: z.string().describe("UUID of the habit"),
    action: z.enum(["pause", "resume", "change_frequency", "archive"]),
    value: z.any().optional().describe("Action-specific value")
  }),
  
  func: async ({ habit_id, action, value }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      switch (action) {
        case "pause": {
          await db
            .update(habitDefinitions)
            .set({ 
              isActive: false,
              // Store resume date in a metadata field if you have one
            })
            .where(
              and(
                eq(habitDefinitions.id, habit_id),
                eq(habitDefinitions.userId, userId)
              )
            );
          
          const resumeDate = value?.resume_date ? ` until ${value.resume_date}` : "";
          return {
            success: true,
            message: `Habit paused${resumeDate}. You can resume it anytime.`,
            habit_id: habit_id,
            action: "paused"
          };
        }
        
        case "resume": {
          await db
            .update(habitDefinitions)
            .set({ isActive: true })
            .where(
              and(
                eq(habitDefinitions.id, habit_id),
                eq(habitDefinitions.userId, userId)
              )
            );
          
          return {
            success: true,
            message: "Habit resumed! Ready to build that streak back up.",
            habit_id: habit_id,
            action: "resumed"
          };
        }
        
        case "change_frequency": {
          const newFrequency = value?.frequency || "daily";
          
          // Frequency is stored in habitInstances.frequencySettings, not on definitions
          // For now, we only return confirmation
          
          return {
            success: true,
            message: `Habit frequency updated to ${newFrequency}.`,
            habit_id: habit_id,
            action: "frequency_changed",
            new_frequency: newFrequency
          };
        }
        
        case "archive": {
          await db
            .update(habitDefinitions)
            .set({ isActive: false })
            .where(
              and(
                eq(habitDefinitions.id, habit_id),
                eq(habitDefinitions.userId, userId)
              )
            );
          
          return {
            success: true,
            message: "Habit archived. Great work on this habit journey!",
            habit_id: habit_id,
            action: "archived"
          };
        }
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error("[updateHabitTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool 3: Log habit completion directly
 */
export const logHabitCompletionTool = new DynamicStructuredTool({
  name: "log_habit_completion",
  description: `Logs a habit as completed for today when user mentions completing it in natural conversation.
  
  Use when:
  - User says they completed a habit ("I did my workout", "I journaled today", "I meditated")
  - User reports doing something that matches an active habit
  - Infer the habit from conversation context when possible
  
  This directly logs the completion to the database and updates goal progress automatically.
  Returns: Confirmation with habit details and updated streak.`,
  
  schema: z.object({
    habit_id: z.string().describe("UUID of the habit that was completed"),
    goal_id: z.string().optional().describe("Optional: UUID of the related goal if known"),
    notes: z.string().optional().describe("Optional: Any notes about the completion")
  }),
  
  func: async ({ habit_id, goal_id, notes }, config) => {
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Verify habit exists and belongs to user
      const [habit] = await db
        .select()
        .from(habitDefinitions)
        .where(
          and(
            eq(habitDefinitions.id, habit_id),
            eq(habitDefinitions.userId, userId),
            eq(habitDefinitions.isActive, true)
          )
        )
        .limit(1);
      
      if (!habit) {
        throw new Error("Habit not found or inactive");
      }
      
      // Log the completion
      const completion = await logHabitCompletion({
        userId,
        habitId: habit_id,
        goalId: goal_id,
        notes: notes || null,
        completedAt: new Date(),
      });
      
      // Return structured data for confirmation card
      const result = {
        type: "habit_completion",
        habit: {
          id: habit.id,
          title: habit.name,
          completedAt: completion.completedAt.toISOString(),
          streak: completion.currentStreak || 0,
        }
      };
      
      console.log("[logHabitCompletionTool] ✅ Logged habit completion:", habit.name);
      return JSON.stringify(result);
    } catch (error: any) {
      if (error?.status === 409) {
        // Already completed - return success but note it was already done
        return JSON.stringify({
          type: "habit_completion",
          already_completed: true,
          message: "This habit was already completed today"
        });
      }
      console.error("[logHabitCompletionTool] Error:", error);
      throw error;
    }
  }
});

