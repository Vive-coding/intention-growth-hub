# Habit Optimization Feature - Implementation Plan

## Overview
Add an "Optimize Habits" button that uses AI to consolidate existing habits into fewer, high-leverage habits while maintaining goal coverage.

## User Flow
1. User clicks "Optimize Habits" button on Habits page
2. System analyzes:
   - All active habits (with completion rates, streak data)
   - All active goals and their requirements
   - Recent upvoted insights
   - Recent journal entries
3. AI agent identifies:
   - Redundant/overlapping habits
   - Low-engagement habits (poor completion rates)
   - Opportunities for consolidation
   - High-leverage habits that can serve multiple goals
4. Show confirmation modal with:
   - **Archive**: List of habits to be removed (with reasons)
   - **Create**: List of new high-leverage habits (with coverage mapping)
   - **Impact Summary**: Before/After habit count, goal coverage maintained
5. User reviews and confirms or cancels
6. If confirmed: Archive old habits, create new ones, update goal associations

---

## Database Changes

### Option A: New table for optimization history
```sql
CREATE TABLE habit_optimization_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  habits_before INTEGER NOT NULL,
  habits_after INTEGER NOT NULL,
  archived_habit_ids UUID[] NOT NULL,
  created_habit_ids UUID[] NOT NULL,
  optimization_reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Option B: Use existing feedback_events
- Track as new event types: 'habit_optimization_accepted', 'habit_optimization_rejected'
- Store optimization details in metadata

**Decision**: Use Option B for consistency with existing patterns.

---

## AI Agent Design

### New Service: `HabitOptimizationService`

**Input Context:**
```typescript
{
  currentHabits: Array<{
    id: string;
    name: string;
    description: string;
    category: string; // life metric
    completionRate: number; // last 30 days
    streak: number;
    linkedGoals: Array<{ id: string; title: string }>;
  }>;
  activeGoals: Array<{
    id: string;
    title: string;
    description: string;
    lifeMetricId: string;
    targetDate: string;
    requiredHabits: Array<{ id: string; name: string }>;
  }>;
  recentInsights: Array<{
    title: string;
    explanation: string;
    upvoted: boolean;
  }>;
  userJournalThemes: string; // Summary of recent journal patterns
}
```

**AI Prompt Objectives:**
1. Identify habits that serve similar purposes (consolidation candidates)
2. Detect low-engagement habits (completion rate < 30%)
3. Find habits that could be replaced by one high-leverage habit
4. Ensure all goals remain covered after optimization
5. Suggest 2-5 new high-leverage habits maximum
6. Target reduction: aim for 5-8 total daily habits

**Output Format:**
```json
{
  "optimization": {
    "habitsToArchive": [
      {
        "id": "uuid",
        "name": "Morning Meditation",
        "reason": "Can be consolidated with 'Daily Mindfulness Practice' which serves multiple goals"
      }
    ],
    "habitsToCreate": [
      {
        "name": "Energy & Focus Ritual",
        "description": "Morning routine combining mindfulness, energy tracking, and intention setting",
        "category": "mental_health",
        "isHighLeverage": true,
        "applicableGoalTypes": ["career", "personal", "health"],
        "targetFrequency": "daily",
        "targetCount": 1,
        "consolidates": ["uuid1", "uuid2", "uuid3"],
        "coversGoals": ["goal-uuid1", "goal-uuid2"]
      }
    ],
    "summary": {
      "habitsBefore": 12,
      "habitsAfter": 6,
      "goalsFullyCovered": 8,
      "estimatedTimeReduction": "30 minutes/day"
    }
  }
}
```

---

## Backend Implementation

### 1. New Service: `server/services/habitOptimizationService.ts`
```typescript
export class HabitOptimizationService {
  // Gather all context for optimization
  static async buildOptimizationContext(userId: string): Promise<OptimizationContext>
  
  // Call AI agent to analyze and suggest optimizations
  static async analyzeHabits(userId: string): Promise<OptimizationProposal>
  
  // Execute the optimization (archive + create)
  static async executeOptimization(
    userId: string, 
    proposal: OptimizationProposal
  ): Promise<void>
}
```

### 2. New AI Agent: `server/ai/habitOptimizationAgent.ts`
- Uses LangChain with detailed prompt
- Calls OpenAI GPT-4 for complex reasoning
- Returns structured optimization proposal

### 3. New API Routes: `server/routes/habits.ts`
```typescript
// GET /api/habits/optimize/analyze
// Returns optimization proposal without making changes
router.get('/optimize/analyze', authenticate, async (req, res) => {
  const proposal = await HabitOptimizationService.analyzeHabits(req.user.id);
  res.json(proposal);
});

// POST /api/habits/optimize/execute
// Executes the optimization with user confirmation
router.post('/optimize/execute', authenticate, async (req, res) => {
  const { proposal } = req.body;
  await HabitOptimizationService.executeOptimization(req.user.id, proposal);
  res.json({ success: true });
});
```

---

## Frontend Implementation

### 1. New Component: `OptimizeHabitsModal.tsx`
- **Trigger**: "Optimize Habits" button on Habits page
- **Loading State**: Shows spinner while AI analyzes
- **Confirmation View**: Split layout showing:
  - Left: Habits to Archive (with reasons)
  - Right: New Habits to Create (with goal coverage)
  - Bottom: Summary stats and action buttons
- **Actions**: "Cancel" or "Optimize Habits"

### 2. Update `HabitsPage.tsx`
```typescript
// Add button in header
<Button 
  onClick={handleOptimize}
  variant="outline"
  disabled={activeHabits.length < 5} // Only show if enough habits
>
  <Sparkles className="w-4 h-4 mr-2" />
  Optimize Habits
</Button>
```

### 3. UI/UX Details
- Show loading spinner during analysis (can take 10-30 seconds)
- Use color coding:
  - Red/Orange for habits to archive
  - Green for new high-leverage habits
  - Blue badges for goal coverage
- Show before/after metrics prominently
- Include "Why this helps" explanation from AI

---

## Edge Cases & Validation

1. **Minimum Habits**: Don't allow optimization if user has < 3 habits
2. **Maximum Reduction**: Don't reduce by more than 50% in one optimization
3. **Goal Coverage**: Ensure every goal has at least 1 supporting habit after optimization
4. **Active Instances**: Warn if habits being archived have active instances (recent completions)
5. **Rollback**: Store optimization session so user can revert if needed (future enhancement)

---

## Testing Checklist

### Backend
- [ ] Context builder gathers all relevant data
- [ ] AI agent returns valid optimization proposal
- [ ] Optimization execution is atomic (all or nothing)
- [ ] Goal associations are correctly transferred
- [ ] Feedback events are recorded

### Frontend
- [ ] Button disabled when insufficient habits
- [ ] Loading state shows during analysis
- [ ] Modal displays all archive/create details clearly
- [ ] Confirmation flow prevents accidental optimization
- [ ] Success/error states handled properly

### Integration
- [ ] Optimized habits appear immediately on habits page
- [ ] Archived habits no longer show in active lists
- [ ] Goals still show correct habit associations
- [ ] Dashboard reflects new habit count

---

## Future Enhancements
1. Schedule automatic optimization suggestions (weekly digest)
2. "Undo Optimization" feature (restore archived habits within 24h)
3. Optimization quality scoring (track if users stick with new habits)
4. Progressive optimization (suggest optimizing 1-2 habits at a time)
5. Optimization history view

---

## Implementation Phases

### Phase 1: AI Agent & Backend (Core Logic)
1. Create `habitOptimizationAgent.ts` with prompt engineering
2. Create `habitOptimizationService.ts` with context building
3. Add API routes for analyze & execute
4. Test with various habit configurations

### Phase 2: Frontend UI (User Experience)
1. Create `OptimizeHabitsModal.tsx` component
2. Add button to Habits page
3. Implement loading and confirmation states
4. Add error handling and feedback

### Phase 3: Testing & Refinement
1. Test edge cases
2. Refine AI prompt based on results
3. Polish UI/UX
4. Add analytics tracking

---

## Estimated Effort
- Phase 1: 3-4 hours
- Phase 2: 2-3 hours  
- Phase 3: 1-2 hours
- **Total**: ~6-9 hours

## Dependencies
- Existing `ContextBuilder` service (from goal-habit feature)
- OpenAI API access
- LangChain setup

