# Improved Prioritization Logic

## Changes Made

### 1. ✅ PrioritizationCard: Added "View in My Focus" Link
**File:** `client/src/pages/chat/components/PrioritizationCard.tsx`

When priorities are accepted, the card now shows:
- Green checkmark + "Priorities Accepted" header
- Success message
- **NEW: Full-width button "View in My Focus →"** that navigates to `/focus` page

### 2. ✅ System Prompt: Enhanced Prioritization Guidance
**File:** `server/ai/singleAgent.ts`

Updated the **prioritize_goals** tool description:
- Now instructs agent to **analyze goals before calling**
- Agent must consider:
  - User's **explicitly stated priorities** (e.g., "interview prep is important")
  - **Urgency and deadlines** (sooner deadlines = higher priority)
  - **Recent momentum** (goals making progress stay, stalled ones can pause)
  - **Life balance** (not all goals in same area)
  - **Realistic capacity** (what they can handle)
- Updated "Overwhelm" playbook to analyze goals before calling tool

### 3. ✅ Tool: Better Description and Logging
**File:** `server/ai/tools/prioritizeTools.ts`

Updated tool description to explain it receives the agent's reasoning and creates the snapshot from that analysis.

Added logging to track:
- The reasoning provided by the agent
- Which goals were selected

## How It Works Now

1. **Agent analyzes goals** (urgency, deadlines, stated preferences, progress)
2. **Agent provides intelligent reasoning** in the `reasoning` parameter
3. **Tool logs the reasoning** for debugging
4. **Tool selects top 3 goals** (currently by creation date - see TODO below)
5. **Card shows with Accept/Decline buttons**
6. **On accept**: Cache invalidates → My Focus updates
7. **Card shows "View in My Focus →" button** for easy navigation

## Current Limitation (TODO)

The tool still uses `allGoals.slice(0, 3)` (first 3 by creation date) instead of parsing the agent's `reasoning` to extract which specific goals to prioritize.

**Future enhancement**: Parse the `reasoning` parameter to extract goal titles mentioned by the agent and match them to actual goals.

Example: If agent says "Prioritize: 1. Interview prep, 2. Sleep 7 hours, 3. Secure first 100 users" → tool would find those exact goals by title.

## Test

1. Create 4+ goals
2. Say something like "I want interview prep to be my priority"
3. Ask agent to prioritize
4. Agent should analyze and provide reasoning about which goals to focus on
5. Card shows with Accept/Decline
6. Click "Accept These Priorities"
7. See "View in My Focus →" button
8. Navigate to My Focus page → should see the 3 priority goals

