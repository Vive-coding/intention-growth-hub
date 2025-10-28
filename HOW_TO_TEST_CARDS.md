# How to Test Card Rendering

## Three Ways to Test

### 🎯 Method 1: Developer Buttons (Easiest - Just Added!)

1. Navigate to `http://localhost:3000/chat`
2. Look for the yellow "🧪 Developer Tools" box at the top
3. Click either button:
   - **📋 Create "Plan Ahead" Simulation** → Opens thread with goal card
   - **📊 Create "Review Progress" Simulation** → Opens thread with habit card
4. Inspect the cards that appear below the messages

### 🔧 Method 2: Browser Console (For developers)

Open your browser console on `http://localhost:3000/chat` and paste:

```javascript
// Plan Ahead
fetch('/api/simulate/plan-ahead', { method: 'POST' })
  .then(r => r.json())
  .then(({ threadId }) => window.location = `/chat/${threadId}`);

// Review Progress
fetch('/api/simulate/review-progress', { method: 'POST' })
  .then(r => r.json())
  .then(({ threadId }) => window.location = `/chat/${threadId}`);
```

### 📡 Method 3: Direct API Call (For debugging)

From your terminal:

```bash
curl -X POST http://localhost:3000/api/simulate/plan-ahead \
  -H "Cookie: auth_token=your_session_token"
```

## Expected Results

### ✅ Plan Ahead Thread Should Show:

- Conversation about planning a portfolio website
- **Goal Card** with:
  - Title: "Launch Professional Portfolio Website"
  - Description
  - 3 suggested habits
  - "Add to My Focus" and "Dismiss" buttons

### ✅ Review Progress Thread Should Show:

- Conversation about daily progress
- **Habit Card** with:
  - Summary: "2/6 habits completed today"
  - 6 habits with checkboxes (2 checked)
  - Ability to mark/unmark habits

## Debugging

**If cards don't appear:**
1. Check browser console for errors
2. Look for these logs:
   - `[ConversationStream] 📊 Card payload detected: goal_suggestion`
   - `[Composer] 🎴 RECEIVED CARD FROM SERVER: habit_review`

**If cards appear broken:**
- Check `GoalSuggestionCard.tsx` component
- Check `HabitCard.tsx` component
- Check browser console for component errors

## What This Confirms

✅ Frontend can parse and render structured cards  
✅ Cards appear in correct location in conversation  
✅ Card styling works  
❌ Does NOT test agent calling tools automatically (separate issue)

Once you confirm cards render, the next step is fixing why the agent doesn't call tools during conversations!
