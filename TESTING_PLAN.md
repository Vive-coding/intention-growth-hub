# Testing Plan for Card Rendering

## Setup Complete ✅

- **Simulation endpoints created:** `/api/simulate/plan-ahead` and `/api/simulate/review-progress`
- **Card payloads:** Properly formatted JSON in messages
- **Server running:** With USE_TOOL_AGENT=true enabled

## How to Test

### Quick Test (Browser Console)

1. **Open your app** (logged in)
2. **Open browser console** (F12)
3. **Run this code:**

```javascript
const token = localStorage.getItem('token');

// Test "Plan Ahead" simulation
fetch('/api/simulate/plan-ahead', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}).then(r => r.json()).then(d => {
  console.log('✅ Plan ahead thread:', d.threadId);
  alert('Plan ahead thread created! Opening...');
  window.location.href = `/chat/${d.threadId}`;
}).catch(e => console.error('Error:', e));
```

```javascript
// Test "Review Progress" simulation
fetch('/api/simulate/review-progress', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}).then(r => r.json()).then(d => {
  console.log('✅ Review progress thread:', d.threadId);
  alert('Review progress thread created! Opening...');
  window.location.href = `/chat/${d.threadId}`;
}).catch(e => console.error('Error:', e));
```

### What to Look For

**In "Plan Ahead" thread:**
- Card should appear with blue gradient background
- Title: "Launch Professional Portfolio Website"
- 3 habits with checkboxes
- "Add Goal + 3 Habits" button (bottom left)
- "Dismiss" button (bottom right)

**In "Review Progress" thread:**
- Card should appear with white background
- Title: "Review Today's Habits"
- Summary: "You've completed 2/6 priority habits today"
- 6 habits listed
- 2 marked as completed (workout, portfolio)
- 4 unchecked (read, interview prep, outreach, stretch)
- Streak indicators showing

## If Cards Don't Render

Check browser console for errors:
```javascript
console.log('[ConversationStream] Messages loaded:', window.__messages);
```

Check server logs for:
```
Card payload detected: goal_suggestion
Card payload detected: habit_review
```

## Expected vs Actual

If cards render → problem is agent not calling tools  
If cards don't render → problem is card rendering logic

This will tell us which part to debug next.
