# Implementation Status

## ✅ Completed
1. **Card state persistence** - localStorage tracks "Accepted" state
2. **Query invalidation** - Refreshes My Focus on goal creation
3. **Authorization** - Simulation buttons have auth headers
4. **Goal creation** - API calls create goals and habits in DB

## ❌ Missing (Why goals don't appear in My Focus)

### Root Cause
`MyFocusService.getPriorityGoals()` returns **all active goals** ordered by creation date. 
But "My Focus" should only show **top 3 priority goals**.

### The Problem
1. When goal is created → it becomes "active" 
2. But there's no priority assignment
3. My Focus shows top 3 by creation date, which may not include new goals

### Solution Needed
**CRITICAL**: Prioritization ONLY triggers when:
1. **New goal added** AND total active goals > 3
2. **Goal completed** AND priority goals < 3  
3. **User manually clicks "Optimize"** button

When creating goals:
1. Check active goal count (ignore archived/completed)
2. If < 3 active goals: Add to priority automatically (show in My Focus)
3. If ≥ 3 active goals: **MUST trigger prioritization**
4. Agent calls prioritize_optimize tool → creates priority snapshot
5. After snapshot accepted → Agent triggers habit optimization

## Current State: What Works vs What Doesn't

### ✅ Works
- Goals are created in DB
- Habits are created and linked
- Card state persists
- My Focus API returns goals (ordered by creation)

### ❌ Doesn't Work  
- Goals don't appear in My Focus (no priority assignment)
- No prioritization triggered when ≥ 3 active goals
- No optimization triggered after prioritization
- "Optimize focus" button doesn't trigger reprioritization

## Fix Needed

### Frontend: GoalSuggestionCard
After goal creation, in `handleAccept()`:
1. Check active goal count via API: `GET /api/goals?status=active&archived=false`
2. If count < 3: Update card to show "Added to My Focus"
3. If count ≥ 3: 
   - Show message: "You have 3+ goals. Would you like to reprioritize?"
   - Trigger prioritization flow automatically

### Backend: Agent Logic
In suggestGoalsAgent or singleAgent:
- When `create_goal_with_habits` is called and returns success
- Check if user has ≥ 3 active goals
- If yes, automatically call `prioritize_optimize` tool
- Agent creates priority snapshot with top 3 goals
- Returns prioritization card to user

### Agent Prioritization Flow
1. Agent gathers all active goals
2. Uses insights + recent conversations to rank
3. Suggests new top 3 via prioritization card
4. User accepts via card
5. Agent calls habit optimization tool
6. Returns optimization card

### Files to Modify
- `client/src/pages/chat/components/GoalSuggestionCard.tsx` - Check count, show prioritization prompt
- `server/ai/singleAgent.ts` - Auto-trigger prioritization when goal count > 3
- `server/tools/index.ts` - Ensure prioritize_optimize tool exists
- `server/tools/optimizeHabits.ts` - Habit optimization logic

## Prioritization Rules (Reaffirmed)
- **Only triggers on explicit events** (not every conversation)
- **Only counts active goals** (ignore archived/completed)
- **Max 3 priority goals at any time**
- **User can push back**, ask questions during prioritization
