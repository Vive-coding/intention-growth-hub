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
import { 
  createGoalWithHabitsTool,
  suggestHabitsForGoalTool,
  updateGoalProgressTool,
  completeGoalTool,
  adjustGoalTool
} from "./goalTools";
import {
  reviewDailyHabitsTool,
  updateHabitTool
} from "./habitTools";
import { shareInsightTool, voteOnInsightTool } from "./insightTool";
import { showProgressSummaryTool } from "./progressTool";

/**
 * All tools available to the life coach agent
 * Total: 11 core tools
 */
export const allTools = [
  // Context (1 tool)
  getContextTool,
  
  // Goals (5 tools)
  createGoalWithHabitsTool,
  suggestHabitsForGoalTool,
  updateGoalProgressTool,
  completeGoalTool,
  adjustGoalTool,
  
  // Habits (2 tools)
  reviewDailyHabitsTool,
  updateHabitTool,
  
  // Insights (1 tool - voteOnInsightTool is called from frontend)
  shareInsightTool,
  
  // Progress (1 tool)
  showProgressSummaryTool,
];

/**
 * Create tools with userId and threadId baked into their execution context
 * This ensures tools can access user data without relying on LangChain's config passing
 */
export function createToolsForUser(userId: string, threadId: string) {
  // Store in a module-level variable that tools can access
  // This is a simple closure-based approach
  (global as any).__TOOL_USER_ID__ = userId;
  (global as any).__TOOL_THREAD_ID__ = threadId;
  
  return allTools;
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
  
  // Habits
  reviewDailyHabitsTool,
  updateHabitTool,
  
  // Insights
  shareInsightTool,
  voteOnInsightTool,
  
  // Progress
  showProgressSummaryTool,
};

