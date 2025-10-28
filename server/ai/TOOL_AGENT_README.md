# Tool-Based Agent Implementation

## Overview

New single agent architecture with 11 specialized tools, replacing the multiple specialized agents.

## Files Created

```
server/ai/
├── tools/
│   ├── contextTool.ts      - Universal context retrieval
│   ├── goalTools.ts         - 5 goal management tools
│   ├── habitTools.ts        - 2 habit management tools
│   ├── insightTool.ts       - Insight sharing
│   ├── progressTool.ts      - Progress summaries
│   └── index.ts             - Central exports
├── singleAgent.ts           - Main tool-calling agent
└── testToolAgent.ts         - Test script

server/ai/lifeCoachService.ts - Modified to support both systems
```

## Testing

### 1. Enable Tool Agent (via environment variable)

```bash
# In your terminal or .env file
export USE_TOOL_AGENT=true
```

### 2. Test with Script

```bash
cd /Users/vivekanandaramu/AI/intention-growth-hub
npx tsx server/ai/testToolAgent.ts
```

### 3. Test in UI

1. Start your server with `USE_TOOL_AGENT=true`
2. Open chat interface
3. Try conversations like:
   - "I want to build a professional portfolio"
   - "Show me my current goals"
   - "What habits would help me with my career?"

### 4. Check Logs

Look for these log messages:
```
[lifeCoachService] Using NEW tool-based agent
[lifeCoachService] Tool agent result: { ... }
```

## Feature Flag

Toggle between old and new system:

```bash
# Use NEW tool-based agent
USE_TOOL_AGENT=true npm run dev

# Use OLD agent router (default)
npm run dev
```

## Tools Available

1. **get_context(scope, filters)** - Get user's goals, habits, insights, life metrics
2. **create_goal_with_habits(goal_data, habit_suggestions)** - Create goal with habits
3. **suggest_habits_for_goal(goal_id, context)** - Add habits to existing goal
4. **update_goal_progress(goal_id, progress_update)** - Track progress
5. **complete_goal(goal_id, reflection)** - Celebrate completion
6. **adjust_goal(goal_id, changes, reason)** - Modify goal
7. **review_daily_habits(date, pre_checked)** - Daily habit checklist
8. **update_habit(habit_id, action, value)** - Pause/resume/modify habit
9. **share_insight(insight_text, life_metric)** - Share breakthrough insight
10. **show_progress_summary(scope, filters)** - Visual progress dashboard

## Known Issues

Some schema field mismatches that will be fixed as we test:
- habitCompletions vs habitInstances
- Insight relationships
- Config structure for tool access

These will be addressed incrementally during testing.

## Fallback

If the new agent fails, it automatically falls back to the old agent router system. Check logs for error messages.

## Next Steps

1. Test basic conversation flow
2. Test each tool individually
3. Fix schema issues as they appear
4. Once stable, remove old agents

