# Fixed All Tools Returning Structured Data

## Problem
All tools that return structured data (with `type` field) were returning plain JavaScript objects instead of JSON strings, causing this error:
```
TypeError: Cannot read properties of undefined (reading 'map')
at _convertMessagesToOpenAIParams
```

## Tools Fixed

### 1. `createGoalWithHabitsTool` ✅
- File: `server/ai/tools/goalTools.ts`
- Returns: `type: "goal_suggestion"`
- Now returns: `JSON.stringify(result)`

### 2. `prioritizeGoalsTool` ✅
- File: `server/ai/tools/prioritizeTools.ts`
- Returns: `type: "prioritization"`
- Now returns: `JSON.stringify(result)`

### 3. `showProgressSummaryTool` ✅
- File: `server/ai/tools/progressTool.ts`
- Returns: `type: "progress_summary"` (3 variants: goals, habits, life_metric)
- Now returns: `JSON.stringify(result)` for all 3 cases

### 4. `shareInsightTool` ✅
- File: `server/ai/tools/insightTool.ts`
- Returns: `type: "insight"`
- Now returns: `JSON.stringify(result)`

## Already Working
- `reviewDailyHabitsTool` - Already returns `JSON.stringify(result)` ✅
  - Returns: `type: "habit_review"`

## Pattern Applied
```typescript
// OLD (broken):
return {
  type: "goal_suggestion",
  ...
};

// NEW (fixed):
const result = {
  type: "goal_suggestion",
  ...
};
return JSON.stringify(result);
```

## Verification
All tools that render cards in chat now return JSON strings instead of plain objects.

## Next Steps
1. Restart server
2. Test goal creation, prioritization, progress summary, insights
3. All should work without the `.map()` error
4. Cards should render properly

