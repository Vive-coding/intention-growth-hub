# Card Rendering Debug Guide

This document helps you verify that cards are rendering correctly in chat.

## How to Track Card Rendering

### 1. Server-Side Logs (Card Generation)

Check your server console for these log messages when cards are created:

```
[processWithToolAgent] ✅ Found structured data with type: goal_suggestion
[processWithToolAgent] Full structured data: { ... }
```

**Expected log flow:**
1. Agent receives request with `requestedAgentType`
2. Agent determines which tools to call
3. Tools return structured data with `type` property
4. System extracts structured data from tool output
5. Structured data is sent to frontend via SSE event

### 2. Frontend Console Logs (Card Rendering)

Open browser DevTools (F12) and check:

- **When agent responds:** Look for SSE events like:
  ```
  { type: "structured_data", data: { type: "goal_suggestion", ... } }
  ```

- **ConversationStream:** Cards are rendered in `ConversationStream.tsx`
  - Cards render when `payload.type` matches one of the card types below

### 3. Card Types That Should Render

Based on `ConversationStream.tsx`, these card types can render:

1. **goal_suggestion** - Single goal with habits
   - Triggered by: `create_goal_with_habits` tool
   - Component: `GoalSuggestionCard`
   
2. **goal_suggestions** - Multiple goals in grid
   - Triggered by: Multiple goal suggestions at once
   - Component: `GoalSuggestionCard` (multiple)
   
3. **habit_review** - Interactive habit checklist
   - Triggered by: `review_daily_habits` tool
   - Component: Inline habit review card
   
4. **habit_suggestion** - Suggested habits
   - Triggered by: Habit suggestion tools
   - Component: `HabitCard` (multiple)
   
5. **optimization** - Optimization proposal
   - Triggered by: `prioritize_optimize` agent
   - Component: `OptimizationCard`
   
6. **prioritization** - Prioritization card
   - Triggered by: Prioritization tools
   - Component: `PrioritizationCard`
   
7. **insight** - Pattern insight
   - Triggered by: `share_insight` tool
   - Component: Inline insight card

### 4. Testing Card Rendering

#### Test "Plan Ahead"
1. Click "Plan ahead" button
2. Check server logs: Should see `requestedAgentType: 'suggest_goals'`
3. Agent should call `create_goal_with_habits` tool
4. Tool output should have `type: "goal_suggestion"`
5. Frontend should render `GoalSuggestionCard`

**Console commands to check:**
```javascript
// In browser console after clicking "Plan ahead"
// Check recent messages for structured data
const messages = document.querySelectorAll('[class*="message"]');
// Look for elements with goal suggestion cards
```

#### Test "Review Progress"
1. Click "Review progress" button
2. Check server logs: Should see `requestedAgentType: 'review_progress'`
3. Agent should call `review_daily_habits` tool
4. Tool output should have `type: "habit_review"`
5. Frontend should render habit review card

### 5. Common Issues & Debugging

#### Issue: Cards Not Rendering

**Check 1: Tool Output Format**
```javascript
// Server should log:
console.log("[processWithToolAgent] ✅ Found structured data with type:", output.type);
```

If missing, the tool output doesn't have `type` property.

**Check 2: SSE Event**
```javascript
// Browser console should show:
EventSource receiving: { type: "structured_data", data: {...} }
```

**Check 3: Card Rendering**
```javascript
// In ConversationStream, check:
if (payload && payload.type === 'goal_suggestion') {
  return <GoalSuggestionCard ... />
}
```

#### Issue: Wrong Card Content

**Expected structure:**
```json
{
  "type": "goal_suggestion",
  "goal": {
    "title": "...",
    "description": "...",
    "category": "...",
    "priority": "..."
  },
  "habits": [
    {
      "title": "...",
      "description": "...",
      "frequency": "...",
      "impact": "high"
    }
  ]
}
```

### 6. Quick Debug Script

Add this to browser console:
```javascript
// Monitor SSE events
const eventListener = (e) => {
  try {
    const data = JSON.parse(e.data);
    if (data.type === 'structured_data') {
      console.log('📊 CARD RENDERING:', data.data.type);
      console.log('Full card data:', data.data);
    }
  } catch {}
};

// Add to ConversationStream component temporarily
```

## How to Verify Agents Are Called

Check server console for:
1. `requestedAgentType` being passed correctly
2. Mode detection (`mode: "Plan Ahead"` or `mode: "Review Progress"`)
3. Tool invocation logs
4. Structured data extraction

## Expected Flow

```
Button Click → sendAction() → 
  SSE Request with requestedAgentType → 
  agent processes → 
  calls tool → 
  tool returns structured data → 
  SSE sends structured_data event → 
  frontend renders card
```
