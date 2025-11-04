# LangSmith Prompt & Tool Improvement Notes

## Observations from Trace Analysis

### Current State
✅ **Working Well:**
- Traces are coming through correctly
- Can see when tools are explicitly called
- Tool execution is visible in LangSmith dashboard

### Areas for Improvement

#### 1. Tool Descriptions
**Issue:** Tool descriptions may not be clear enough for the LLM to always select the right tool.

**Action Items:**
- Review all tool descriptions in `server/ai/tools/`
- Enhance descriptions with:
  - More specific use cases
  - Clear examples of when to use vs. when not to use
  - Expected input/output patterns
  - Common misconceptions to avoid

**Files to Review:**
- `server/ai/tools/contextTool.ts`
- `server/ai/tools/goalTools.ts`
- `server/ai/tools/habitTools.ts`
- `server/ai/tools/prioritizeTools.ts`
- `server/ai/tools/progressTool.ts`
- `server/ai/tools/insightTool.ts`

#### 2. Prompt Enhancement for Tool Calling
**Issue:** The agent may not be making optimal tool selection decisions.

**Current Prompt Location:** `server/ai/singleAgent.ts` - `LIFE_COACH_PROMPT`

**Potential Improvements:**
- Add explicit guidance on when to call tools vs. when to respond directly
- Provide examples of good tool calling patterns
- Clarify when assumptions are acceptable vs. when tools must be called
- Add decision tree logic for tool selection

#### 3. Agent Decision-Making
**Issue:** Agent should make reasonable assumptions instead of calling tools unnecessarily.

**Approach:**
- Train agent to recognize when it has enough context
- Balance between tool calling for accuracy vs. making reasonable inferences
- Use LangSmith traces to identify patterns of over/under tool calling

## Using LangSmith for Improvement

### Trace Analysis Workflow
1. **Identify Patterns:**
   - Filter traces by tool name to see all calls for a specific tool
   - Look for cases where tools weren't called but should have been
   - Look for cases where wrong tools were called

2. **Compare Scenarios:**
   - Group traces by user intent (e.g., "plan ahead", "review progress")
   - Compare tool selection patterns across similar scenarios
   - Identify inconsistencies

3. **Test Improvements:**
   - Make prompt/tool description changes
   - Run new traces and compare to baseline
   - Use LangSmith's comparison features to see improvements

### Key Metrics to Track
- **Tool Call Accuracy:** % of traces where the correct tool was called
- **Tool Call Frequency:** Average number of tool calls per conversation
- **Over-calling Rate:** % of traces where unnecessary tools were called
- **Under-calling Rate:** % of traces where tools should have been called but weren't

## Example Trace Analysis Questions

1. When users say "How am I doing?", does the agent call `show_progress_summary` or `review_daily_habits`?
2. When users want to "plan my week", does it call `get_context("my_focus")` first?
3. Are there cases where the agent calls multiple tools when one would suffice?
4. Are there cases where the agent responds without calling tools when it should?

## Next Steps

1. **Collect Baseline Data** (Current)
   - Review 20-30 real user traces
   - Document tool calling patterns
   - Identify top 5 issues

2. **Hypothesis & Test**
   - Create hypotheses: "If we improve tool X description, it will be called more accurately"
   - Make changes
   - Compare new traces to baseline

3. **Iterate**
   - Refine based on trace evidence
   - Use Phase 6 (Evaluation Framework) to systematically test improvements

