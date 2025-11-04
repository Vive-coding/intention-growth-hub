# LangSmith Action Plan - Tool Calling Improvements

## Current Status ✅
- Phase 1: Complete (LangSmith installed, env configured, tracing working)
- Phase 2: Partial (tracing enabled in main agent, metadata added)
- Phase 3-8: Not started yet

## Your Current Need 🎯
**Problem:** Tool descriptions need improvement so tools get called at the right time.

**Goal:** Systematically improve tool calling accuracy using LangSmith trace data.

---

## Recommended Execution Path

### STEP 1: Trace Analysis First (Do This Now)
**Why:** You need to understand current patterns before making changes.

**Tasks:**
1. **Collect Baseline Data** (1-2 hours)
   - Review 20-50 recent traces in LangSmith dashboard
   - Document what you observe for each major tool
   - Create a spreadsheet or notes document with findings

2. **Identify Patterns** (30 mins)
   - Which tools are being called incorrectly?
   - Which tools should be called but aren't?
   - What are the most common mistakes?
   - Group similar cases together

**Output:** A prioritized list of tool calling issues

---

### STEP 2: Quick Wins - Tool Descriptions (30-60 mins)
**Based on your analysis, improve the most problematic tools.**

**Focus Areas:**
- Add concrete examples to descriptions
- Clarify when NOT to use a tool
- Add decision trees ("If X, call this tool; if Y, don't")
- Include common pitfalls

**Files to modify:**
- `server/ai/tools/*.ts` - Tool description fields

---

### STEP 3: Test & Validate
**Use LangSmith to verify improvements.**

1. Make changes to 1-3 tools
2. Test with similar scenarios as baseline
3. Compare traces before/after
4. Measure improvement

---

### STEP 4: Iterate
Repeat Steps 2-3 for remaining tools.

---

## Alternative Path: Full Evaluation Framework First

**If you prefer:** Set up Phase 5 (datasets) and Phase 6 (evaluators) first, then systematically test all tools.

**Pros:** More rigorous, repeatable testing
**Cons:** Takes longer to set up, requires writing test cases

---

## Recommendation

**Go with STEP 1 NOW** (Trace Analysis):
1. You already have traces coming through
2. Fastest way to actionable insights
3. You can identify the biggest pain points in 1-2 hours
4. Then focus improvements on what actually matters

**Then do STEP 2-4** for rapid iteration on real issues.

**Later:** Set up full evaluation framework for ongoing monitoring.

---

## Next Immediate Action

Let's do a guided trace analysis session. I can help you:
1. Look at your recent traces
2. Identify patterns
3. Create a prioritized improvement list
4. Then improve the worst offenders

**Ready to start?**

