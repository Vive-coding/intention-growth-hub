# Chat Thread Simulation Plan

## Goal
Create 2 simulated chat threads to visualize cards and conversation flows without relying on the agent.

## Approach

### Option 1: Direct Database Insert (Recommended)
Create a script that inserts fake chat threads with realistic messages and card payloads.

**Pros:**
- Uses real UI components
- Tests actual rendering logic
- Can refresh and see cards immediately
- No code changes needed

**Cons:**
- Need to clean up test data
- Manual trigger to run script

### Option 2: Mock API Endpoint
Create a temporary `/api/chat/simulate` endpoint that returns mock threads.

**Pros:**
- No database pollution
- Easy to reset

**Cons:**
- Requires frontend changes
- Not testing real rendering pipeline

### Option 3: Testing UI Component
Create a standalone component that renders messages with cards.

**Pros:**
- Pure visualization
- No backend required

**Cons:**
- Doesn't test full integration

## Recommended: Option 1 (Database Simulation)

### Files to Create

1. **`server/scripts/simulateChatThreads.ts`**
   - Inserts 2 chat threads
   - Each with realistic message flow
   - Includes card payloads in JSON format

2. **Thread 1: "Plan Ahead" Simulation**
   ```
   Messages:
   - User: "Plan ahead"
   - Coach: "What's on top of your mind right now?"
   - User: "I want to build a professional portfolio website"
   - Coach: [Conversation about timeframe, goals]
   - User: "I want to launch it in 2 weeks"
   - Coach: [Card payload for goal_suggestion with 2-3 habits]
   ```

3. **Thread 2: "Review Progress" Simulation**
   ```
   Messages:
   - User: "Review progress"
   - Coach: "How's your day going?"
   - User: "Good, I completed my morning workout"
   - Coach: [card payload for habit_review with 6 habits, 2 completed]
   - User: "I also worked on my portfolio for 2 hours"
   - Coach: "Great progress!" + [update_goal_progress card]
   ```

### Card Payload Examples Needed

**Goal Suggestion Card:**
```json
{
  "type": "goal_suggestion",
  "goal": {
    "title": "Launch Professional Portfolio Website",
    "description": "To showcase my work and attract clients",
    "category": "Career Development",
    "priority": "Priority 1",
    "targetDate": "2023-11-10"
  },
  "habits": [
    {
      "title": "Draft website content (2 hours daily)",
      "description": "Write and refine portfolio content",
      "frequency": "daily",
      "impact": "high"
    },
    {
      "title": "Build one new portfolio section (weekly)",
      "description": "Add a project showcase section each week",
      "frequency": "weekly",
      "impact": "medium"
    },
    {
      "title": "Gather feedback (every 3 days)",
      "description": "Share progress with peers for feedback",
      "frequency": "every 3 days",
      "impact": "medium"
    }
  ]
}
```

**Habit Review Card:**
```json
{
  "type": "habit_review",
  "summary": "You've completed 2/6 priority habits today",
  "habits": [
    {
      "id": "habit-1",
      "title": "Morning workout",
      "completed": true,
      "streak": 5
    },
    {
      "id": "habit-2",
      "title": "Portfolio work (2 hours)",
      "completed": true,
      "streak": 3
    },
    {
      "id": "habit-3",
      "title": "Read for 30 minutes",
      "completed": false,
      "streak": 2
    },
    {
      "id": "habit-4",
      "title": "Practice interview questions",
      "completed": false,
      "streak": 1
    },
    {
      "id": "habit-5",
      "title": "Outreach (5 connections)",
      "completed": false,
      "streak": 0
    },
    {
      "id": "habit-6",
      "title": "Evening stretch routine",
      "completed": false,
      "streak": 0
    }
  ]
}
```

### Implementation Steps

1. **Create the script:**
   - `server/scripts/simulateChatThreads.ts`
   - Takes userId as parameter
   - Inserts 2 threads with realistic timestamps
   - Uses actual card JSON structure

2. **Run the simulation:**
   ```bash
   npx tsx server/scripts/simulateChatThreads.ts your-user-id
   ```

3. **View in UI:**
   - Threads appear in conversation list
   - Click on each to see cards render
   - Test card interactions (accept/dismiss)

4. **Clean up:**
   ```bash
   npx tsx server/scripts/cleanupSimulation.ts your-user-id
   ```

## What This Tests

✅ Card rendering in real UI
✅ Card content structure
✅ Card interactions (buttons)
✅ Conversation flow
✅ Message formatting
✅ Card visibility and styling

## Alternative: Use PostgreSQL psql

If we want to manually insert data:
```sql
INSERT INTO chat_threads (user_id, title, created_at, updated_at)
VALUES ('user-id', 'Plan Ahead Simulation', NOW(), NOW());

INSERT INTO chat_messages (thread_id, role, content, created_at)
VALUES 
  ('thread-id', 'user', 'Plan ahead', NOW()),
  ('thread-id', 'assistant', 'What is on your mind?', NOW()),
  ('thread-id', 'user', 'I want to build a website', NOW()),
  ('thread-id', 'assistant', 'Let me help you create a plan!\n\n---json---\n{...card payload...}', NOW());
```

## Recommendation

Start with Option 1 (database simulation script) because:
- Tests full integration
- Uses real components
- Easy to verify cards render
- Can see both conversation flows side-by-side

Once we see the cards work correctly, we can debug why the agent isn't calling tools.
