# Tools That Render Presentation Cards in Chat

## 1. create_goal_with_habits Tool ✅
**File**: `server/ai/tools/goalTools.ts`  
**Function**: Lines 112-149 in the `func` property  
**Returns**: `{ type: "goal_suggestion", goal: {...}, habits: [...] }`  
**Card Component**: `GoalSuggestionCard` (already exists)  
**Function Name**: `createGoalWithHabitsTool`

## 2. review_daily_habits Tool ✅
**File**: `server/ai/tools/habitTools.ts`  
**Function**: Lines 32-191 in the `func` property  
**Returns**: `{ type: "habit_review", habits: [...] }` (as JSON string)  
**Card Component**: `HabitCard` - renders as checklist  
**Function Name**: `reviewDailyHabitsTool`

## 3. share_insight Tool ✅
**File**: `server/ai/tools/insightTool.ts`  
**Function**: Lines 34-79 in the `func` property  
**Returns**: `{ type: "insight", title: "...", explanation: "...", confidence: 80 }`  
**Card Component**: Renders inline as div with insight  
**Function Name**: `shareInsightTool`

## 4. prioritize_goals Tool ✅ (NEW)
**File**: `server/ai/tools/prioritizeTools.ts`  
**Function**: Lines 20-88 in the `func` property  
**Returns**: `{ type: "prioritization", items: [...] }`  
**Card Component**: `PrioritizationCard` (already exists)  
**Function Name**: `prioritizeGoalsTool`

## 5. suggest_habits_for_goal Tool ⚠️ (Partial)
**File**: `server/ai/tools/goalTools.ts`  
**Function**: Lines 175-232 in the `func` property  
**Returns**: `{ type: "habit_suggestions", ... }`  
**Card Component**: Individual `HabitCard` per suggestion  
**Function Name**: `suggestHabitsForGoalTool`

## Tools WITHOUT Cards (Return text only):
- `update_goal_progress` - Returns progress_update object, no card
- `complete_goal` - Returns goal_celebration object, no card  
- `adjust_goal` - Returns confirmation message, no card
- `update_habit` - Returns confirmation message, no card
- `get_context` - Returns data only, no card
- `show_progress_summary` - Returns progress data, no card

## Summary
**4 tools render cards**: create_goal_with_habits, review_daily_habits, share_insight, prioritize_goals  
**1 tool partially renders**: suggest_habits_for_goal (renders multiple HabitCards)
