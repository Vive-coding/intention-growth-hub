# Tool Return Format Fix

## Error
```
TypeError: Cannot read properties of undefined (reading 'map')
at _convertMessagesToOpenAIParams
```

## Root Cause
The `createGoalWithHabitsTool` was returning a plain object, but LangChain's `_convertMessagesToOpenAIParams` expects tools to return JSON strings.

Looking at the working `reviewDailyHabitsTool` (line 185), it returns `JSON.stringify(result)`.

## Fix Applied
Changed `createGoalWithHabitsTool` in `server/ai/tools/goalTools.ts`:

**Before:**
```typescript
return {
  type: "goal_suggestion",
  goal: { ... },
  habits: [ ... ]
};
```

**After:**
```typescript
const result = {
  type: "goal_suggestion",
  goal: { ... },
  habits: [ ... ]
};

// IMPORTANT: Return as JSON string for LangChain
return JSON.stringify(result);
```

## Verification
This matches the pattern used in `reviewDailyHabitsTool` which works correctly.

## Next Steps
1. Restart server
2. Test goal creation again
3. Should now complete without the map error
4. Card should render properly

