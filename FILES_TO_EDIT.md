# Files to Edit for System Prompts and Tool Descriptions

## Main System Prompt (Primary File)
**File**: `server/ai/singleAgent.ts`
- **Lines 17-95**: Contains the `LIFE_COACH_PROMPT` - the main system prompt
- This is where you define when and how to call tools
- Key sections:
  - `YOUR TOOLS (use proactively)` - lists all tools
  - `WHEN TO TAKE ACTION` - when to call tools
  - `PRIORITIZATION TRIGGERS` - when to prioritize
  - `COACHING PRINCIPLES` - behavioral guidelines
  - `EXAMPLES` - concrete examples of tool usage

## Tool Descriptions (Secondary Files)
These files contain the individual tool descriptions that the LLM sees:

### Goal Tools
**File**: `server/ai/tools/goalTools.ts`
- Line ~78: `createGoalWithHabitsTool` - description in `description` field
- Line ~155: `suggestHabitsForGoalTool`
- Line ~237: `updateGoalProgressTool`
- Line ~328: `completeGoalTool`
- Line ~398: `adjustGoalTool`

### Habit Tools
**File**: `server/ai/tools/habitTools.ts`
- Line ~11: `reviewDailyHabitsTool`
- Line ~196: `updateHabitTool`

### Context Tool
**File**: `server/ai/tools/contextTool.ts`
- Line ~12: `getContextTool`

### Insight Tool
**File**: `server/ai/tools/insightTool.ts`
- Line ~10: `shareInsightTool`

### Progress Tool
**File**: `server/ai/tools/progressTool.ts`
- Line ~10: `showProgressSummaryTool`

### Prioritization Tool
**File**: `server/ai/tools/prioritizeTools.ts`
- Line ~13: `prioritizeGoalsTool`

## Recommended Edits

1. **Make tool calling MANDATORY** in `singleAgent.ts`:
   - Add explicit rules like "When user mentions a goal, you MUST call create_goal_with_habits"
   - Change "use proactively" to "use ALWAYS when applicable"

2. **Make tool descriptions more explicit** in each tool file:
   - Add clearer "When to use" sections
   - Add examples of when the tool should be called
   - Be more prescriptive about required conditions

3. **Add hard triggers** in the prompt:
   - Specific phrases that force tool calls
   - Remove ambiguity about when to use tools
