# Card State and Persistence Fixes

## Summary of Required Changes

### 1. Goal Creation Card - Button Behavior
- Current: Clicking redirects to goals page
- Needed: Create goal/habits in DB, update card state, no redirect
- Priority: < 3 active goals = add as priority, ≥ 3 active goals = need prioritization

### 2. Prioritization Flow - When Does It Trigger?

**Only count active goals** (ignore archived/completed)

**Triggers**:
1. **New goal added** AND total active goals > 3
   - Agent MUST call `prioritize_optimize` tool
   - Suggest new top 3 from ALL active goals (including new one)
   - User can push back, ask questions, guide prioritization

2. **Goal completed** AND priority goals < 3
   - Agent suggests which other active goals should fill the priority slot
   - Help user decide what to prioritize next

3. **User clicks "Optimize" button**
   - Agent calls `prioritize_optimize` tool
   - Review and optimize current priority goals

**Result**: Max 3 active priority goals at any time

### 3. Habit Completion Persistence
- Issue: Don't persist or reflect "My Focus"
- Fix: Actually log via API, update card state

### 4. Timestamp Issues
- Fix: Use user's timezone for all simulation timestamps

## Implementation Order
1. Timestamps
2. Habit completion
3. Goal creation with priority logic
4. Prioritization flow (3 triggers)

## Goal Priority State Logic
- < 3 active goals → Auto-add as priority → "View in My Focus →"
- ≥ 3 active goals → Trigger prioritization → Show selected top 3 status
