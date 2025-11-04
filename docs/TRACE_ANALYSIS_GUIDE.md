# LangSmith Trace Analysis Guide

## How to Analyze Your Traces for Tool Calling Issues

### Getting Started
1. Go to https://smith.langchain.com
2. Navigate to **Projects** → `intention-growth-hub-dev` (or your project name)
3. Click **Traces** to see recent traces
4. Click on any trace to view details

### What to Look For

#### 1. Check Tool Call Accuracy

**For each trace, ask:**
- ✅ **Did it call the right tool?** 
  - Example: If user asks "How am I doing?", did it call `show_progress_summary`?
  
- ❌ **Did it call the wrong tool?**
  - Example: Did it call `get_context` when it should have called `review_daily_habits`?
  
- ⚠️ **Did it call tools when it shouldn't have?**
  - Example: Simple "hello" messages shouldn't trigger tool calls
  
- ⏭️ **Did it miss calling a tool it should have?**
  - Example: User says "I want to plan my week" but no tool was called

#### 2. Identify Common Patterns

**Create a tracking document with these columns:**

| Trace ID | User Message | Tool(s) Called | Should Have Called | Issue Type | Notes |
|----------|--------------|----------------|-------------------|------------|-------|
| ABC123 | "How am I doing?" | `get_context` | `show_progress_summary` | Wrong tool | Should show progress card |
| DEF456 | "I worked out today" | None | `update_goal_progress` | Missed tool | Should log progress |
| GHI789 | "hello" | `get_context`, `prioritize_goals` | None | Over-calling | Unnecessary tool calls |

#### 3. Group by Tool

**For each tool, identify:**

**`get_context`**
- When is it being called unnecessarily?
- When should it have been called but wasn't?
- What scope is most commonly used?

**`create_goal_with_habits`**
- Is it being called with incomplete information?
- Are users being asked redundant questions before calling?

**`review_daily_habits`**
- Is it showing when users ask "what should I do today"?
- Is it logging completions when users report doing habits?

**`prioritize_goals`**
- Is it being called at the right times? (4+ goals, user overwhelmed)
- Is it being called at the wrong times?

**`show_progress_summary`**
- When user asks "how am I doing?", is this called?
- Or is `get_context` being called instead?

**And so on for all tools...**

#### 4. Look for Language Patterns

**Find common user intents that trigger wrong tools:**

| User Intent | Current Tool Used | Correct Tool | How Many Times? |
|-------------|-------------------|--------------|-----------------|
| "How am I doing?" | `get_context` | `show_progress_summary` | ? |
| "Plan my week" | Multiple tools | `get_context` → then tools | ? |
| "I completed X" | None | `update_goal_progress` | ? |
| "Feel overwhelmed" | `get_context` | `prioritize_goals` | ? |

---

## Quick Analysis Workflow (30 mins)

### Step 1: Sample Traces (5 mins)
- Pick 20-30 recent traces
- Look at user message + tools called
- Quick scan: Does it feel right?

### Step 2: Find Issues (15 mins)
- Identify top 5-10 problematic traces
- Categorize the issues (wrong tool, missed tool, over-calling, under-calling)
- Note which tools are problematic

### Step 3: Prioritize (10 mins)
- Which issues happen most often?
- Which issues cause the worst user experience?
- Rank: #1 worst offender, #2, #3, etc.

---

## After Analysis: Improvement Plan

### Quick Wins (Update Descriptions)
For each problematic tool:
1. Read current description
2. Identify what's unclear
3. Add concrete examples
4. Add explicit "DO" and "DON'T" guidance
5. Add common pitfalls

### Example Improvement Template

**Before:**
```
description: "Shows user progress on goals and habits"
```

**After:**
```
description: `Shows a progress dashboard/summary across goals, streaks, and completion patterns.
  
WHEN TO USE:
- User asks "How am I doing?" or "Am I improving?" or "Can you check my progress?"
- User wants to see their overall progress
- User asks for a review of their goals/habits

WHEN NOT TO USE:
- User asks about specific goal details (use get_context instead)
- User just says "hi" or asks a question (respond directly)
- User wants to log a completion (use review_daily_habits instead)

OUTPUT: Returns interactive card showing dashboard with metrics`
```

---

## Next Steps

1. **Do the trace analysis** (follow workflow above)
2. **Create improvement list** (prioritized by frequency/impact)
3. **Improve descriptions** (start with #1)
4. **Test improvements** (make a change, run similar scenarios, compare traces)
5. **Iterate** (move to #2, #3, etc.)

Need help with a specific trace or tool? Share the trace ID or tool name and I can help analyze it!

