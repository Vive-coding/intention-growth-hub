# How to Test Card Rendering

## Quick Start

The simulation endpoints are now accessible directly from the app.

### Option 1: Use the Developer Buttons (Easiest)

1. Navigate to `http://localhost:3000/chat` (blank chat page)
2. You'll see a yellow "Developer Tools" section at the top with two buttons:
   - **📋 Create "Plan Ahead" Simulation** - Creates a thread with a `goal_suggestion` card
   - **📊 Create "Review Progress" Simulation** - Creates a thread with a `habit_review` card
3. Click either button to create and view the simulated thread

### Option 2: Call Endpoints Directly from Browser Console

Open your browser console (F12) on the chat page and run:

```javascript
// Create "Plan Ahead" simulation
await fetch('/api/simulate/plan-ahead', { method: 'POST' })
  .then(r => r.json())
  .then(({ threadId }) => window.location = `/chat/${threadId}`);

// Create "Review Progress" simulation
await fetch('/api/simulate/review-progress', { method: 'POST' })
  .then(r => r.json())
  .then(({ threadId }) => window.location = `/chat/${threadId}`);
```

### Option 3: Using curl (from terminal)

```bash
# Get auth token first (logged in user)
TOKEN=$(curl -s http://localhost:3000/api/auth/user -H "Authorization: Bearer test" -c /tmp/cookies -b /tmp/cookies 2>&1 | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Create Plan Ahead simulation
curl -X POST http://localhost:3000/api/simulate/plan-ahead \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Create Review Progress simulation
curl -X POST http://localhost:3000/api/simulate/review-progress \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

## What to Look For

### "Plan Ahead" Simulation Should Show:

- A conversation about planning a portfolio website
- A `goal_suggestion` card with:
  - Goal: "Launch Professional Portfolio Website"
  - 3 suggested habits
  - Accept/Dismiss buttons (currently placeholder actions)

### "Review Progress" Simulation Should Show:

- A conversation about reviewing daily progress
- A `habit_review` card with:
  - Summary: "2/6 priority habits completed"
  - 6 habits (2 marked as `completed: true`)
  - Ability to mark remaining habits as completed

## Testing Card Rendering

1. Check if cards appear below the assistant messages
2. Verify card styling and layout
3. Check that buttons/actions work (even if placeholders)
4. Look for console logs showing:
   - `[ConversationStream] 📊 Card payload detected: [card type]`
   - `[Composer] 🎴 RECEIVED CARD FROM SERVER: [card type]`

## Troubleshooting

- **No cards appear**: Check browser console for parsing errors on the JSON payload
- **Cards appear but look broken**: Check `GoalSuggestionCard.tsx` and `HabitCard.tsx` rendering logic
- **Buttons not working**: Check action handlers in card components

## What This Tests

- ✅ Card payloads are being parsed from assistant messages
- ✅ Card components are rendering
- ✅ Structured data flows through the system
- ❌ Does NOT test: Agent calling tools automatically (that's the next step)