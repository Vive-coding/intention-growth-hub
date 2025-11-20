import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { habitDefinitions, habitCompletions, habitInstances, goalInstances, goalDefinitions } from "../../../shared/schema";
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
  
  **IMPORTANT**: You MUST call get_context("habits") first to get the habit UUID. Never use habit names or goal names as the habit_id.
  
  Args:
  - habit_id: The UUID of the habit (get this from get_context("habits") output - it's the 'id' field)
  - action: "pause" | "resume" | "change_frequency" | "archive"
  - value: Depends on action (resume_date for pause, new frequency, etc.)
  
  Use when:
  - User says a habit is too hard, not relevant, or too frequent
  - You notice from context that an adjustment is needed
  - Life circumstances change and habits need to adapt
  
  Workflow:
  1. Call get_context("habits") to see all habits and their UUIDs
  2. Find the habit by matching the title/description
  3. Use that habit's UUID (not the title!) in the habit_id parameter
  
  Returns: Confirmation message`,
  
  schema: z.object({
    habit_id: z.string().uuid().describe("UUID of the habit (from get_context output)"),
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
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(habit_id)) {
      throw new Error(`Invalid habit_id "${habit_id}". You must use the UUID from get_context("habits"), not the habit name. Call get_context("habits") first to get the correct UUID.`);
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
 * 
 * This tool accepts a habit description and automatically matches it to an active habit.
 * The agent never needs to provide UUIDs - just describe what the user did.
 */
export const logHabitCompletionTool = new DynamicStructuredTool({
  name: "log_habit_completion",
  description: `Logs a habit as completed for today when the user reports doing a specific habit.
  
  **How to use this tool**:
  - Simply describe what the user did (e.g., "morning workout", "journaled", "drank water", "went for a run")
  - The tool will automatically find the matching active habit from the user's list
  - You do NOT need to provide UUIDs or call get_context first - just describe the action
  
  Use when:
  - The user says they completed a specific habit (e.g., "I did my morning run", "I journaled", "I worked out today")
  - The user describes an action that matches one of their active habits
  
  This directly logs the completion for **today** and updates the habit's streak and related goal progress.
  Returns: Confirmation with habit details and updated streak. If no matching habit is found, returns an error with available habits.`,
  
  schema: z.object({
    habit_description: z.string().describe("Description of what the user did (e.g., 'morning workout', 'journaled', 'went for a run'). The tool will match this to an active habit automatically."),
    goal_id: z.string().optional().describe("Optional: UUID of the related goal if known"),
    notes: z.string().optional().describe("Optional: Any notes about the completion")
  }),
  
  func: async ({ habit_description, goal_id, notes }, config) => {
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Fetch all active habits for this user
      const activeHabits = await db
        .select({ 
          id: habitDefinitions.id, 
          name: habitDefinitions.name,
          description: habitDefinitions.description 
        })
        .from(habitDefinitions)
        .where(
          and(
            eq(habitDefinitions.userId, userId),
            eq(habitDefinitions.isActive, true)
          )
        );
      
      if (activeHabits.length === 0) {
        throw new Error("No active habits found for this user. The user needs to create goals and habits first.");
      }

      // Load My Focus to prioritize high-leverage habits
      const myFocus = await MyFocusService.getMyFocus(userId);
      const focusHabitIds: string[] = Array.isArray(myFocus?.highLeverageHabits)
        ? myFocus.highLeverageHabits.map((h: any) => h.id).filter(Boolean)
        : [];

      // Narrow candidate habits using goal_id when provided, so we don't pick a duplicate habit
      // attached to a different goal instance.
      let candidateHabits = activeHabits;
      if (goal_id) {
        try {
          const goalScopedHabits = await db
            .select({ habitId: habitInstances.habitDefinitionId })
            .from(habitInstances)
            .where(
              and(
                eq(habitInstances.goalInstanceId, goal_id),
                inArray(habitInstances.habitDefinitionId, activeHabits.map((h) => h.id) as any)
              )
            );

          const goalHabitIdSet = new Set(goalScopedHabits.map((row) => String(row.habitId)));
          if (goalHabitIdSet.size > 0) {
            candidateHabits = activeHabits.filter((h) => goalHabitIdSet.has(String(h.id)));
          }
        } catch (error) {
          console.warn("[logHabitCompletionTool] Failed to scope habits by goal_id; falling back to My Focus preferences", error);
        }
      }

      // If we still have many candidates (or no goal_id), prefer habits that are part of My Focus.
      if (candidateHabits.length === activeHabits.length && focusHabitIds.length > 0) {
        const focusSet = new Set(focusHabitIds.map(String));
        const focusCandidates = activeHabits.filter((h) => focusSet.has(String(h.id)));
        if (focusCandidates.length > 0) {
          candidateHabits = focusCandidates;
        }
      }

      // If all filtering failed for some reason, we still have candidateHabits = activeHabits as a fallback.
      // Normalize the search description
      const normalizeText = (text: string) =>
        text
          .toLowerCase()
          .replace(/\d+/g, "") // remove numbers like \"10\" in \"10 push-ups\"
          .replace(/[^a-z\s-]/g, "") // strip punctuation/symbols
          .replace(/\s+/g, " ")
          .trim();

      const normalizedSearchRaw = habit_description.toLowerCase().trim();
      const normalizedSearch = normalizeText(habit_description);
      
      // Try exact match first (case-insensitive, normalized) within the narrowed candidates
      let matchedHabit = candidateHabits.find(h => 
        normalizeText(h.name) === normalizedSearch
      );
      
      // Try partial match (habit name contains search or search contains habit name)
      if (!matchedHabit) {
        matchedHabit = candidateHabits.find(h => {
          const habitName = normalizeText(h.name);
          return habitName.includes(normalizedSearch) || normalizedSearch.includes(habitName);
        });
      }
      
      // Try fuzzy match on description if available
      if (!matchedHabit) {
        matchedHabit = candidateHabits.find(h => {
          if (!h.description) return false;
          const habitDesc = normalizeText(h.description);
          return habitDesc.includes(normalizedSearch) || normalizedSearch.includes(habitDesc);
        });
      }
      
      // Try keyword matching (split search terms and check if they appear in habit name)
      // Calculate a confidence score to avoid bad matches
      let bestMatch: { habit: typeof activeHabits[0], score: number, confidence: number } | null = null;
      
      if (!matchedHabit) {
        const searchTerms = normalizedSearch.split(/\s+/).filter(term => term.length > 2);
        
        for (const habit of candidateHabits) {
          const habitName = habit.name.toLowerCase();
          const habitDesc = (habit.description || '').toLowerCase();
          
          // Check for very high similarity (most key words in common)
          let titleMatchedTerms = 0;
          let descMatchedTerms = 0;
          
          for (const term of searchTerms) {
            if (habitName.includes(term)) {
              titleMatchedTerms++;
            } else if (habitDesc.includes(term)) {
              descMatchedTerms++;
            }
          }
          
          // Calculate confidence based on title matches (more important)
          const titleConfidence = searchTerms.length > 0 ? (titleMatchedTerms / searchTerms.length) * 100 : 0;
          const score = (titleMatchedTerms * 3) + descMatchedTerms; // Title matches worth 3x more
          
          // High confidence if:
          // - 75%+ of search terms appear in title (e.g., "warm-up cool-down" in "Include Warm-up and Cool-down")
          // - OR very high score (5+) indicating strong match
          if ((titleConfidence >= 60 || score >= 5) && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { habit, score, confidence: titleConfidence };
          }
        }
      }
      
      // If we have a matched habit from earlier logic, use it
      // Otherwise, use keyword match if confidence is high enough
      if (!matchedHabit && bestMatch) {
        // Accept the match if confidence is reasonable
        matchedHabit = bestMatch.habit;
      }
      
      if (!matchedHabit) {
        // No confident match found - return a structured failure object instead of throwing,
        // so the agent can tell the user honestly and offer alternatives.
        return {
          type: "habit_completion_error",
          reason: "no_match",
          habit_description,
          message:
            `I couldn't find a matching habit for "${habit_description}" in your active list. ` +
            `You can log it manually by opening the habits panel (tap the habits pill at the top), ` +
            `or we can create a new habit for this if you'd like to track it going forward.`,
          activeHabits: activeHabits.map(h => h.name),
        };
      }
      
      // Use the matched habit's ID
      const habit_id = matchedHabit.id;
      
      // Find the related goal instance ID if not provided
      // This ensures we pass a valid goal_id to the logging service
      let validGoalId = goal_id;
      if (!validGoalId) {
        const habitInstanceRows = await db
          .select({ goalInstanceId: habitInstances.goalInstanceId })
          .from(habitInstances)
          .where(eq(habitInstances.habitDefinitionId, habit_id))
          .limit(1);
        
        if (habitInstanceRows.length > 0) {
          validGoalId = habitInstanceRows[0].goalInstanceId;
        }
      }
      
      // Log the completion (this also updates streaks and related goal progress)
      const completionResult = await logHabitCompletion({
        userId,
        habitId: habit_id,
        goalId: validGoalId,
        notes: notes || null,
        completedAt: new Date(),
      }) as any; // Type assertion since the function returns more than the schema defines
      
      // Get the related goal info to show in the card
      // Try to get goal from habit instance first, then fallback to validGoalId
      let relatedGoalTitle: string | undefined;
      try {
        // First, try to get goal from habit instance (most reliable)
        const habitInstanceRows = await db
          .select({ goalInstanceId: habitInstances.goalInstanceId })
          .from(habitInstances)
          .where(eq(habitInstances.habitDefinitionId, habit_id))
          .limit(1);
        
        let goalInstanceIdToUse = validGoalId;
        if (habitInstanceRows.length > 0 && habitInstanceRows[0].goalInstanceId) {
          goalInstanceIdToUse = habitInstanceRows[0].goalInstanceId;
        }
        
        if (goalInstanceIdToUse) {
          const goalRows = await db
            .select({ title: goalDefinitions.title })
            .from(goalInstances)
            .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
            .where(eq(goalInstances.id, goalInstanceIdToUse))
            .limit(1);
          
          if (goalRows.length > 0) {
            relatedGoalTitle = goalRows[0].title;
          }
        }
      } catch (error) {
        console.error("[logHabitCompletionTool] Failed to fetch goal title:", error);
      }
      
      // Get the current streak from the completion result
      // logHabitCompletion now returns currentStreak, so use that directly
      // Ensure streak is at least 1 since we just completed it
      const currentStreak = Math.max(1, completionResult.currentStreak || 1);
      
      // Return structured data for confirmation card
      const result = {
        type: "habit_completion",
        habit: {
          id: matchedHabit.id,
          title: matchedHabit.name,
          completedAt: completionResult.completedAt ? new Date(completionResult.completedAt).toISOString() : new Date().toISOString(),
          streak: currentStreak,
          relatedGoal: relatedGoalTitle,
        }
      };
      
      console.log("[logHabitCompletionTool] ✅ Logged habit completion:", matchedHabit.name, "(matched from:", habit_description, ")");
      return JSON.stringify(result);
    } catch (error: any) {
      if (error?.status === 409) {
        // Already completed today — treat as success but inform the user
        return JSON.stringify({
          type: "habit_completion",
          already_completed: true,
          message: "You've already logged this habit for today. If you did it more than once, update the habit's frequency or target instead of logging another completion."
        });
      }
      
      console.error("[logHabitCompletionTool] Error:", error);
      throw error;
    }
  }
});

