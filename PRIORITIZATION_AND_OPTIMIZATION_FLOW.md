# Prioritization and Optimization Flow

## Plan Ahead Flow

1. **Start**: User clicks "Plan ahead"
2. **Discover goals**: Agent identifies new goals through conversation
3. **Add goals**: User accepts new goals via card
4. **Check total**: If total active goals > 3 → trigger prioritization
5. **Prioritize**: 
   - Agent calls `prioritize_optimize` tool
   - Uses insights + recent conversations to suggest top 3
   - **Show card** with new priorities for user acceptance
6. **User accepts priorities** via card
7. **Auto-optimize habits**:
   - Agent checks for duplicate/similar habits
   - Calls existing "optimize habits" capability
   - Suggests optimized habit set
8. **Complete**: New goals + habits in "My Focus"

## Review Progress Flow

1. **Start**: User clicks "Review progress"
2. **Check completions**: Which habits were completed today
3. **Celebrate**: Acknowledge progress
4. **Provide advice**: How to improve consistency
5. **Uncover issues**: Wrong goals or priorities?
6. **If issues found**: Trigger similar flow as Plan Ahead
   - Prioritization
   - Accept new priorities
   - Optimize habits

## Prioritization Triggers (Reaffirm)

1. **New goal added** AND total active goals > 3
2. **Goal completed** AND priority goals < 3
3. **User clicks "Optimize" button**

## Key Features

- Only count **active** goals (ignore archived/completed)
- Max 3 active priority goals at any time
- Prioritization shows **card for acceptance**
- After priorities accepted → **auto-optimize habits**
- Habit optimization uses existing system
