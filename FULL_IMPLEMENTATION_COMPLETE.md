# Prioritization Flow - Full Implementation Complete

## What Was Implemented

### 1. Backend - Count Endpoint ✅
- Added `/api/goals/count/active` endpoint
- Returns count of active, non-archived goals
- Used to determine if prioritization is needed (≥ 3 active goals)

### 2. Frontend - Goal Card Smart Behavior ✅
- `GoalSuggestionCard.tsx` checks active goal count
- If < 3 goals: Shows "Added to My Focus" + "View My Focus" button
- If ≥ 3 goals: Shows "Needs Prioritization" + triggers message to agent
- Sends message: "I just added a new goal. Please help me prioritize my focus."

### 3. Agent - Prioritization Tool ✅
- Created new `prioritize_goals` tool in `server/ai/tools/prioritizeTools.ts`
- Tool fetches all active goals and selects top 3
- Creates priority snapshot via `MyFocusService.persistFromAgent()`
- Returns structured data for PrioritizationCard component
- Added to agent prompt in `singleAgent.ts`

### 4. Frontend - PrioritizationCard Component ✅
- Already exists at `client/src/pages/chat/components/PrioritizationCard.tsx`
- Already wired into `ConversationStream.tsx` for rendering
- Shows top 3 goals with titles, descriptions, and rankings

### 5. MyFocusService Integration ✅
- `MyFocusService.persistFromAgent()` already handles prioritization type
- Creates `myFocusPrioritySnapshots` table entry
- "My Focus" uses snapshot to display top 3 priority goals

## How It Works (Complete Flow)

### Step 1: User Accepts Goal
1. Frontend counts active goals via `/api/goals/count/active`
2. If count ≥ 3: Sets `needsPrioritization` state
3. Shows "Needs Prioritization" badge
4. Sends message to agent: "I just added a new goal. Please help me prioritize my focus."

### Step 2: Agent Detects Trigger
1. Agent receives message about new goal
2. Prompt instructions detect this is a prioritization trigger
3. Agent calls `prioritize_goals` tool

### Step 3: Tool Executes
1. Tool fetches all active goals for user
2. Selects top 3 goals (ordered by creation date for now)
3. Formats goals for PrioritizationCard
4. Calls `MyFocusService.persistFromAgent()` to save snapshot
5. Returns structured data: `{ type: "prioritization", items: [...] }`

### Step 4: Frontend Renders Card
1. Structured data sent via SSE to frontend
2. `ConversationStream.tsx` detects `type: "prioritization"`
3. Renders `<PrioritizationCard items={...} />`
4. Card shows top 3 goals in priority order

### Step 5: My Focus Updates
1. Priority snapshot saved to database
2. Next time user views "My Focus"
3. `MyFocusService.getMyFocus()` reads snapshot
4. Shows top 3 priority goals from snapshot

## Files Modified/Created

### Created:
- `server/ai/tools/prioritizeTools.ts` - New prioritization tool

### Modified:
- `server/routes/goals.ts` - Added count endpoint
- `client/src/pages/chat/components/GoalSuggestionCard.tsx` - Added prioritization logic
- `server/ai/singleAgent.ts` - Added tool to prompt and instructions
- `server/ai/tools/index.ts` - Added tool to exports

### Already Existed (No Changes Needed):
- `client/src/pages/chat/components/PrioritizationCard.tsx` - Card component
- `client/src/pages/chat/ConversationStream.tsx` - Card rendering
- `server/services/myFocusService.ts` - Persistence logic

## Testing Instructions

1. **Create 4+ goals** using plan ahead simulations or manually
2. **Accept a goal card** when you already have 3 active goals
3. **Verify message** is sent to agent about prioritization
4. **Check agent logs** for "prioritize_goals" tool call
5. **Verify PrioritizationCard** appears in chat
6. **Check "My Focus"** to see top 3 priorities updated

## Next Steps (Optional Enhancements)

1. **Improve goal selection logic** - Use AI to select top 3 based on:
   - Goal urgency and target dates
   - Recent conversations and context
   - Goal progress and momentum
   - User's stated priorities

2. **Add habit optimization** - After priorities accepted, trigger habit optimization

3. **Add acceptance flow** - Add button in PrioritizationCard to confirm priorities

