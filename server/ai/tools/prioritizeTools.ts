import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { goalDefinitions, goalInstances } from "../../../shared/schema";
import { MyFocusService } from "../../services/myFocusService";

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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 200,
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
  description: `Selects the top 3 priority goals based on your analysis.
  
  WORKFLOW:
  1. Call get_context("all_goals") FIRST to see all available goals
  2. Based on user feedback and context, list which 3 goals to prioritize in the "reasoning" parameter
  3. The tool will match those goals and create the prioritization
  
  In the "reasoning" parameter, list the 3 goal titles you want to prioritize. The tool will search for those exact titles.`,
  
  schema: z.object({
    reasoning: z.string().describe("Which 3 goals to prioritize and why. Include the EXACT goal titles like '1. Secure First 100 Users, 2. Enter 3 more interview processes, 3. Sleep 7 hours' - use the exact titles you see in get_context('all_goals')."),
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
      if (selectedGoalTitles.length < 3) {
        try {
          const availableGoalsList = allGoals.map(g => ({ title: g.goalDefinition.title }));
          const llmTitles = await parseGoalTitlesFromReasoning(reasoning, availableGoalsList);
          for (const t of llmTitles) {
            if (!selectedGoalTitles.includes(t)) selectedGoalTitles.push(t);
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

      for (const extractedTitle of selectedGoalTitles.slice(0, 3)) {
        const normalized = extractedTitle.toLowerCase().trim();
        let found = goalTitles.find(g => g.normalized === normalized);
        if (!found) {
          found = goalTitles.find(g => g.normalized.includes(normalized) || normalized.includes(g.normalized));
        }
        if (found && !top3Goals.find(g => g.goalInstance.id === found!.goal.goalInstance.id)) {
          top3Goals.push(found.goal);
          if (top3Goals.length >= 3) break;
        }
      }

      // Step 3: If still not enough, use keyword similarity to choose best matches from available goals
      if (top3Goals.length < 3) {
        const reasonTokens = tokenize(reasoning);
        const reasonSet = new Set(reasonTokens);
        const scored = allGoals
          .filter(g => !top3Goals.find(t => t.goalInstance.id === g.goalInstance.id))
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
        for (const s of scored) {
          top3Goals.push(s.goal);
          if (top3Goals.length >= 3) break;
        }
        console.log("[prioritize_goals] Added via similarity scoring:", scored.slice(0, 3).map(s => s.goal.goalDefinition.title));
      }

      // Step 4: Final safety fallback (oldest first) to ensure 3
      if (top3Goals.length < 3) {
        for (const goal of allGoals) {
          if (!top3Goals.find(g => g.goalInstance.id === goal.goalInstance.id)) {
            top3Goals.push(goal);
            if (top3Goals.length >= 3) break;
          }
        }
        console.log("[prioritize_goals] Filled remainder via fallback; final count:", top3Goals.length);
      }

      console.log("[prioritize_goals] Final selected goals:", top3Goals.map(g => g.goalDefinition.title).join(', '));
      console.log("=== [prioritize_goals] COMPLETE ===\n");
      
      // Format goals for prioritization (same format for both card and database)
      const items = top3Goals.map((g, idx) => ({
        goalInstanceId: g.goalInstance.id,
        rank: idx + 1,
        title: g.goalDefinition.title,
        description: g.goalDefinition.description || '',
        // Keep id for frontend card display
        id: g.goalInstance.id,
      }));

      // Create prioritization data for card (format matches what persistFromAgent expects)
      const prioritizationData = {
        type: "prioritization",
        items: items.map((item) => ({
          goalInstanceId: item.goalInstanceId,
          rank: item.rank,
          title: item.title,
          description: item.description,
        }))
      };

      // Persist to MyFocus service
      await MyFocusService.persistFromAgent(prioritizationData, { userId, threadId });
      
      console.log("[prioritize_goals] Created prioritization for", items.length, "goals");

      // Return structured data for frontend card rendering
      const result = {
        type: "prioritization",
        items: items
      };
      
      // IMPORTANT: Return as JSON string for LangChain
      console.log("[prioritize_goals] ✅ Returning prioritization data:", result.type);
      return JSON.stringify(result);
    } catch (error) {
      console.error("[prioritize_goals] Error:", error);
      throw error;
    }
  }
});
