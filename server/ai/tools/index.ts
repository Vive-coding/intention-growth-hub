/**
 * Central export for all coaching tools
 * 
 * These tools enable the life coach agent to:
 * - Get context about user's goals, habits, insights
 * - Create and manage goals with linked habits
 * - Track habit completions
 * - Share breakthrough insights
 * - Show progress summaries
 */

import { getContextTool } from "./contextTool";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { 
  createGoalWithHabitsTool,
  suggestHabitsForGoalTool,
  updateGoalProgressTool,
  completeGoalTool,
  adjustGoalTool,
  archiveGoalsTool,
  swapHabitsForGoalTool
} from "./goalTools";
import {
  reviewDailyHabitsTool,
  updateHabitTool,
  logHabitCompletionTool
} from "./habitTools";
import { shareInsightTool, voteOnInsightTool, createInsightTool } from "./insightTool";
import { showProgressSummaryTool } from "./progressTool";
import { prioritizeGoalsTool, removePriorityGoalsTool } from "./prioritizeTools";

/**
 * All tools available to the life coach agent
 * Total: 14 core tools (includes bulk goal archiving)
 */
export const allTools = [
  // Context (1 tool)
  getContextTool,
  
  // Goals
  createGoalWithHabitsTool,
  suggestHabitsForGoalTool,
  updateGoalProgressTool,
  completeGoalTool,
  adjustGoalTool,
  archiveGoalsTool,
  swapHabitsForGoalTool,
  
  // Habits (3 tools)
  reviewDailyHabitsTool,
  updateHabitTool,
  logHabitCompletionTool,
  
  // Insights (2 tools - voteOnInsightTool is called from frontend)
  shareInsightTool,
  createInsightTool,
  
  // Progress (1 tool)
  showProgressSummaryTool,
  
  // Prioritization (2 tools)
  prioritizeGoalsTool,
  removePriorityGoalsTool,
];

/**
 * Anthropic tool-calling requires tool result message content to be a string (or an array of content blocks).
 * Some of our tools return objects/arrays, which can crash @langchain/anthropic during payload formatting
 * ("content.map is not a function") when the agent executes multiple tool actions.
 *
 * We wrap tools so their outputs are always strings (JSON if needed).
 */
function wrapToolToStringOutput(tool: any) {
  // Only wrap DynamicStructuredTool-like tools that have a schema and invoke().
  // Keep name/description/schema identical so the agent sees the same tool contract.
  const name = tool?.name;
  const description = tool?.description;
  const schema = tool?.schema;
  if (!name || !schema || typeof tool?.invoke !== "function") {
    return tool;
  }

  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (input: any) => {
      const out = await tool.invoke(input);
      if (typeof out === "string") return out;
      try {
        return JSON.stringify(out);
      } catch {
        return String(out);
      }
    },
  });
}

/**
 * Create tools with userId and threadId baked into their execution context
 * This ensures tools can access user data without relying on LangChain's config passing
 */
export function createToolsForUser(userId: string, threadId: string) {
  // Store in a module-level variable that tools can access
  // This is a simple closure-based approach
  (global as any).__TOOL_USER_ID__ = userId;
  (global as any).__TOOL_THREAD_ID__ = threadId;
  
  return allTools.map(wrapToolToStringOutput);
}

// Log tools on module load
console.log("[tools/index] Loaded tools:", allTools.map(t => t.name));

// Export individual tools for testing
export {
  // Context
  getContextTool,
  
  // Goals
  createGoalWithHabitsTool,
  suggestHabitsForGoalTool,
  updateGoalProgressTool,
  completeGoalTool,
  adjustGoalTool,
  swapHabitsForGoalTool,
  
  // Habits
  reviewDailyHabitsTool,
  updateHabitTool,
  logHabitCompletionTool,
  
  // Insights
  shareInsightTool,
  voteOnInsightTool,
  createInsightTool,
  
  // Progress
  showProgressSummaryTool,
  
  // Prioritization
  prioritizeGoalsTool,
  removePriorityGoalsTool,
};

