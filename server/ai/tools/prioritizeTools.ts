import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { eq, and, inArray } from "drizzle-orm";
import { goalDefinitions, goalInstances, lifeMetricDefinitions, userOnboardingProfiles, myFocusPrioritySnapshots } from "../../../shared/schema";
import { desc } from "drizzle-orm";

/**
 * Use LLM to intelligently extract goal titles from reasoning
 */
async function parseGoalTitlesFromReasoning(reasoning: string, availableGoals: Array<{ title: string }>): Promise<string[]> {
  const goalTitlesList = availableGoals.map(g => g.title).join('\n- ');
  
  const prompt = `You are parsing a coach's reasoning about which goals to prioritize.

AVAILABLE GOALS:
- ${goalTitlesList}

COACH'S REASONING:
${reasoning}

Extract EXACTLY 3 goal titles from the reasoning. Return ONLY the titles, one per line, matching the exact titles from the available goals list above.

Return format (3 lines only):
Goal Title 1
Goal Title 2
Goal Title 3

If you cannot find 3 specific goal titles in the reasoning, choose the 3 most relevant goals based on the reasoning context.`;

  try {
    // Use OpenAI API directly instead of LangChain to avoid conflicts
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_completion_tokens: 200,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[prioritize_goals] OpenAI API error:", response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    if (!text) {
      console.error("[prioritize_goals] No content in OpenAI response:", data);
      return [];
    }
    
    // Parse the response - extract lines with goal titles
    const extractedTitles = text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith('-') && !line.startsWith('#'))
      .slice(0, 3);
    
    console.log("[prioritize_goals] LLM extracted titles:", extractedTitles);
    return extractedTitles;
  } catch (error) {
    console.error("[prioritize_goals] LLM parsing error:", error);
    // Fallback to empty array if LLM fails
    return [];
  }
}

/**
 * Tool: Prioritize goals
 * Selects top 3 goals from user's active goals and creates a priority snapshot
 */
export const prioritizeGoalsTool = new DynamicStructuredTool({
  name: "prioritize_goals",
  description: `Helps user focus on their priority goals (1-3 goals, or up to their max focus limit).
  
  CRITICAL: DO NOT automatically set goals as priority when they are created. Only call this tool when:
  - User EXPLICITLY asks to prioritize goals or set focus
  - User EXPLICITLY mentions something is urgent/important and wants it prioritized
  - User feels overwhelmed and asks for help prioritizing
  - User asks to re-prioritize or change priorities
  
  If you are unsure whether a newly created goal should be a priority, ASK the user first: "Should this be a priority goal in My Focus?"
  
  Workflow:
  1. First call get_context("all_goals") to see all available goals
  2. Then call this tool with your selection and reasoning explaining which 1-3 goals to prioritize and why
  3. The tool will match those goals and create the prioritization
  
  In the "reasoning" parameter, list the goal titles you want to prioritize (1-3 goals). The tool will search for those exact titles. After the tool returns prioritized goals, use those exact titles in your response.
  
  IMPORTANT: You can prioritize just 1 goal if the user is new or if they mention something is particularly important. This improves onboarding and makes it less overwhelming.
  
  Returns: Priority focus card with selected priority goals`,
  
  schema: z.object({
    reasoning: z.string().describe("Which 1-3 goals to prioritize and why. Include the EXACT goal titles like '1. Secure First 100 Users' or '1. Secure First 100 Users, 2. Enter 3 more interview processes' - use the exact titles you see in get_context('all_goals'). You can prioritize just 1 goal for new users or when something is particularly important."),
  }),
  
  func: async ({ reasoning }) => {
    const userId = (global as any).__TOOL_USER_ID__;
    const threadId = (global as any).__TOOL_THREAD_ID__;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Get all active goals for the user with their metadata
      const allGoals = await db
        .select({
          goalInstance: goalInstances,
          goalDefinition: goalDefinitions,
        })
        .from(goalDefinitions)
        .innerJoin(goalInstances, eq(goalDefinitions.id, goalInstances.goalDefinitionId))
        .where(and(
          eq(goalInstances.userId, userId),
          eq(goalInstances.status, "active"),
          eq(goalInstances.archived, false),
          eq(goalDefinitions.archived, false)
        ));

      if (allGoals.length === 0) {
        return JSON.stringify({
          type: "error",
          message: "No active goals found to prioritize"
        });
      }

      console.log("\n=== [prioritize_goals] TOOL CALLED ===");
      console.log("[prioritize_goals] User:", userId);
      console.log("[prioritize_goals] Reasoning provided:", reasoning);
      console.log("[prioritize_goals] Available goals:", allGoals.map(g => g.goalDefinition.title).join(', '));

      // Helper: tokenize for similarity scoring
      const tokenize = (text: string): string[] => {
        return String(text || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2);
      };

      // Step 1: Try to extract goal titles from reasoning (regex patterns)
      let selectedGoalTitles: string[] = [];
      {
        const numberedMatch = reasoning.match(/\d+\.\s*([^\n,]+)/g);
        if (numberedMatch) {
          selectedGoalTitles = numberedMatch.map(m => m.replace(/^\d+\.\s*/, '').trim());
        }
        if (selectedGoalTitles.length === 0) {
          const prioritizeMatch = reasoning.match(/Prioritize:\s*([^\n]+)/i);
          if (prioritizeMatch && prioritizeMatch[1]) {
            selectedGoalTitles = prioritizeMatch[1].split(',').map(t => t.trim());
          }
        }
        if (selectedGoalTitles.length === 0) {
          const quotedMatch = reasoning.match(/"([^"]+)"/g);
          if (quotedMatch) {
            selectedGoalTitles = quotedMatch.map(m => m.replace(/"/g, '').trim());
          }
        }
      }

      // Step 2: If regex failed or incomplete, use LLM to extract EXACT titles
      // Allow 1-3 goals (not always 3)
      if (selectedGoalTitles.length === 0) {
        try {
          const availableGoalsList = allGoals.map(g => ({ title: g.goalDefinition.title }));
          const llmTitles = await parseGoalTitlesFromReasoning(reasoning, availableGoalsList);
          for (const t of llmTitles) {
            if (!selectedGoalTitles.includes(t)) selectedGoalTitles.push(t);
            // Allow up to 3, but don't force 3
            if (selectedGoalTitles.length >= 3) break;
          }
          console.log("[prioritize_goals] LLM assistance added titles:", llmTitles);
        } catch (e) {
          console.warn("[prioritize_goals] LLM extraction skipped due to error");
        }
      }

      console.log("[prioritize_goals] Selected titles after extraction:", selectedGoalTitles);

      // Map extracted titles to actual DB goals (exact, then partial)
      const top3Goals: typeof allGoals = [];
      const goalTitles = allGoals.map(g => ({
        title: g.goalDefinition.title,
        goal: g,
        normalized: g.goalDefinition.title.toLowerCase().trim()
      }));

      // Get user's focus limit (max 3-5 goals)
      const [profileRow] = await db
        .select({ focusGoalLimit: userOnboardingProfiles.focusGoalLimit })
        .from(userOnboardingProfiles)
        .where(eq(userOnboardingProfiles.userId, userId))
        .limit(1);
      const configuredLimit = profileRow?.focusGoalLimit ?? 3;
      const focusGoalLimit = Math.min(Math.max(configuredLimit, 3), 5);
      const maxGoalsToSelect = Math.min(selectedGoalTitles.length || focusGoalLimit, focusGoalLimit);

      for (const extractedTitle of selectedGoalTitles.slice(0, maxGoalsToSelect)) {
        const normalized = extractedTitle.toLowerCase().trim();
        let found = goalTitles.find(g => g.normalized === normalized);
        if (!found) {
          found = goalTitles.find(g => g.normalized.includes(normalized) || normalized.includes(g.normalized));
        }
        if (found && !top3Goals.find(g => g.goalInstance.id === found!.goal.goalInstance.id)) {
          top3Goals.push(found.goal);
          if (top3Goals.length >= maxGoalsToSelect) break;
        }
      }

      // Step 3: If still not enough and we have less than 1 goal, use keyword similarity to choose best matches
      // Only fill up if we have 0 goals selected (don't force 3 if user only wants 1-2)
      if (top3Goals.length === 0 && selectedGoalTitles.length === 0) {
        const reasonTokens = tokenize(reasoning);
        const reasonSet = new Set(reasonTokens);
        const scored = allGoals
          .map(g => {
            const titleTokens = tokenize(g.goalDefinition.title);
            const descTokens = tokenize(g.goalDefinition.description || '');
            let score = 0;
            for (const tok of titleTokens) if (reasonSet.has(tok)) score += 3; // title matches weigh higher
            for (const tok of descTokens) if (reasonSet.has(tok)) score += 1;
            const createdAt = g.goalInstance.createdAt ? new Date(g.goalInstance.createdAt).getTime() : 0;
            return { goal: g, score, createdAt };
          })
          .sort((a, b) => (b.score - a.score) || (a.createdAt - b.createdAt));
        // Only add the top 1 goal if we have 0 (for single goal prioritization)
        if (scored.length > 0) {
          top3Goals.push(scored[0].goal);
          console.log("[prioritize_goals] Added via similarity scoring:", scored[0].goal.goalDefinition.title);
        }
      }

      // Step 4: Final safety fallback - only if we have 0 goals (shouldn't happen, but safety net)
      if (top3Goals.length === 0) {
        // Just take the first goal as a last resort
        if (allGoals.length > 0) {
          top3Goals.push(allGoals[0]);
          console.log("[prioritize_goals] Filled via fallback; final count:", top3Goals.length);
        }
      }

      console.log("[prioritize_goals] Final selected goals:", top3Goals.map(g => g.goalDefinition.title).join(', '));
      console.log("=== [prioritize_goals] COMPLETE ===\n");
      
      // Fetch life metrics for all goals
      const lifeMetricIds = [...new Set(top3Goals.map(g => g.goalDefinition.lifeMetricId).filter(Boolean))] as string[];
      const lifeMetricsMap = new Map<string, string>();
      if (lifeMetricIds.length > 0) {
        const metrics = await db
          .select({ id: lifeMetricDefinitions.id, name: lifeMetricDefinitions.name })
          .from(lifeMetricDefinitions)
          .where(inArray(lifeMetricDefinitions.id, lifeMetricIds));
        for (const metric of metrics) {
          lifeMetricsMap.set(metric.id, metric.name);
        }
      }

      // Format goals for prioritization (same format for both card and database)
      const items = top3Goals.map((g, idx) => ({
        goalInstanceId: g.goalInstance.id,
        rank: idx + 1,
        title: g.goalDefinition.title,
        description: g.goalDefinition.description || '',
        targetDate: g.goalInstance.targetDate ? new Date(g.goalInstance.targetDate).toISOString() : undefined,
        lifeMetric: g.goalDefinition.lifeMetricId ? lifeMetricsMap.get(g.goalDefinition.lifeMetricId) : undefined,
        // Keep id for frontend card display
        id: g.goalInstance.id,
      }));

      // Return structured data for frontend card rendering
      // NOTE: Do NOT persist here - wait for user confirmation via PrioritizationCard
      // The card will call /api/my-focus/priorities/apply when user accepts
      const result = {
        type: "prioritization",
        items: items
      };
      
      console.log("[prioritize_goals] Created prioritization proposal for", items.length, "goals (awaiting user confirmation)");
      
      // IMPORTANT: Return as JSON string for LangChain
      console.log("[prioritize_goals] ✅ Returning prioritization data:", result.type);
      return JSON.stringify(result);
    } catch (error) {
      console.error("[prioritize_goals] Error:", error);
      throw error;
    }
  }
});

/**
 * Tool: Remove goals from priority (My Focus)
 * Allows removing specific goals or clearing all priorities
 */
export const removePriorityGoalsTool = new DynamicStructuredTool({
  name: "remove_priority_goals",
  description: `Remove goals from My Focus (priority goals).
  
  Call when:
  - User wants to remove specific goals from their focus
  - User wants to clear all priorities
  - User says a goal shouldn't be a priority anymore
  
  You can remove specific goals or clear all priorities. If removing specific goals, provide their goalInstanceIds.
  If clearing all, pass an empty array or use clearAll: true.
  
  Returns: Confirmation of removal`,
  
  schema: z.object({
    goalInstanceIds: z.array(z.string()).optional().describe("Array of goal instance IDs to remove from priority. If empty or not provided, clears all priorities."),
    clearAll: z.boolean().optional().describe("If true, clears all priorities regardless of goalInstanceIds. Default: false."),
    reasoning: z.string().optional().describe("Optional reason for removing these goals from priority."),
  }),
  
  func: async ({ goalInstanceIds, clearAll, reasoning }) => {
    const userId = (global as any).__TOOL_USER_ID__;
    const threadId = (global as any).__TOOL_THREAD_ID__;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      console.log("\n=== [remove_priority_goals] TOOL CALLED ===");
      console.log("[remove_priority_goals] User:", userId);
      console.log("[remove_priority_goals] Clear all:", clearAll);
      console.log("[remove_priority_goals] Goal IDs to remove:", goalInstanceIds);

      // Get current priority snapshot
      const [currentSnapshot] = await db
        .select()
        .from(myFocusPrioritySnapshots)
        .where(eq(myFocusPrioritySnapshots.userId, userId))
        .orderBy(desc(myFocusPrioritySnapshots.createdAt))
        .limit(1);

      let updatedItems: any[] = [];
      let removedCount = 0;

      if (clearAll) {
        // Clear all priorities
        updatedItems = [];
        removedCount = currentSnapshot?.items && Array.isArray(currentSnapshot.items) 
          ? (currentSnapshot.items as any[]).length 
          : 0;
        console.log("[remove_priority_goals] Clearing all priorities, removing", removedCount, "goals");
      } else if (goalInstanceIds && goalInstanceIds.length > 0) {
        // Remove specific goals
        if (currentSnapshot?.items && Array.isArray(currentSnapshot.items)) {
          const currentItems = currentSnapshot.items as any[];
          const beforeCount = currentItems.length;
          updatedItems = currentItems.filter(
            (item: any) => !goalInstanceIds.includes(item.goalInstanceId || item.id)
          );
          removedCount = beforeCount - updatedItems.length;
          console.log("[remove_priority_goals] Removing", removedCount, "specific goals,", updatedItems.length, "remaining");
        } else {
          console.log("[remove_priority_goals] No current priorities to remove from");
        }
      } else {
        // No IDs provided and clearAll is false - clear all as fallback
        updatedItems = [];
        removedCount = currentSnapshot?.items && Array.isArray(currentSnapshot.items) 
          ? (currentSnapshot.items as any[]).length 
          : 0;
        console.log("[remove_priority_goals] No IDs provided, clearing all priorities");
      }

      // Create new snapshot with updated priorities
      await db.insert(myFocusPrioritySnapshots).values({
        userId,
        items: updatedItems as any,
        sourceThreadId: threadId || null,
      } as any);

      console.log("[remove_priority_goals] ✅ Removed", removedCount, "goals from priority");
      console.log("[remove_priority_goals] Remaining priorities:", updatedItems.length);
      console.log("=== [remove_priority_goals] COMPLETE ===\n");

      return JSON.stringify({
        type: "priority_removal",
        removedCount,
        remainingCount: updatedItems.length,
        cleared: removedCount > 0 && updatedItems.length === 0,
        message: removedCount > 0 
          ? `Removed ${removedCount} goal${removedCount !== 1 ? 's' : ''} from My Focus. ${updatedItems.length > 0 ? `${updatedItems.length} priority goal${updatedItems.length !== 1 ? 's' : ''} remaining.` : 'No priorities set.'}`
          : "No goals were removed from priority."
      });
    } catch (error) {
      console.error("[remove_priority_goals] Error:", error);
      throw error;
    }
  }
});
