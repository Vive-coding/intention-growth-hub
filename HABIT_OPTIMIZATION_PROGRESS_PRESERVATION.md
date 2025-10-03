# Habit Optimization - Progress Preservation

## Overview
When habits are optimized (archived and replaced with new ones), goal progress is **fully preserved** by converting accumulated habit progress into manual progress adjustments.

---

## How It Works

### 1. **Before Archiving Habits**
The system captures all progress from habits being archived:

```typescript
// For each habit being archived
for (const habitId of habitIdsToArchive) {
  // Find all goal instances linked to this habit
  const instances = await db
    .select({
      goalInstanceId: habitInstances.goalInstanceId,
      currentValue: habitInstances.currentValue,
    })
    .from(habitInstances)
    .where(eq(habitInstances.habitDefinitionId, habitId));

  // Transfer progress to the goal's manual currentValue
  for (const instance of instances) {
    if (instance.currentValue > 0) {
      await db
        .update(goalInstances)
        .set({
          currentValue: sql`${goalInstances.currentValue} + ${instance.currentValue}`,
        })
        .where(eq(goalInstances.id, instance.goalInstanceId));
    }
  }
}
```

### 2. **Archive Old Habits**
After progress is transferred, habits are safely archived:
- Set `isActive = false` on `habitDefinitions`
- Record feedback events for audit trail

### 3. **Create New Habits with Recalculated Targets**
New habits are created with targets adjusted for:
- **Remaining goal target**: `goalInstance.targetValue - goalInstance.currentValue`
- **Time remaining**: Days until `goalInstance.targetDate`
- **Habit frequency**: daily/weekly/monthly

#### Target Calculation Logic:
```typescript
const remainingTarget = goalInstance.targetValue - (goalInstance.currentValue || 0);
const daysRemaining = Math.max(1, Math.ceil((targetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

if (newHabit.targetFrequency === "daily") {
  periodsCount = daysRemaining;
  perPeriodTarget = Math.max(1, Math.ceil(remainingTarget / periodsCount));
  totalHabitTarget = perPeriodTarget * periodsCount;
} else if (newHabit.targetFrequency === "weekly") {
  periodsCount = Math.max(1, Math.ceil(daysRemaining / 7));
  perPeriodTarget = Math.max(1, Math.ceil(remainingTarget / periodsCount));
  totalHabitTarget = perPeriodTarget * periodsCount;
} else if (newHabit.targetFrequency === "monthly") {
  periodsCount = Math.max(1, Math.ceil(daysRemaining / 30));
  perPeriodTarget = Math.max(1, Math.ceil(remainingTarget / periodsCount));
  totalHabitTarget = perPeriodTarget * periodsCount;
}
```

---

## Example Scenario

### Before Optimization:
**Goal**: "Read 100 Books" (Target: 100, Target Date: Dec 31, 2025)
- **Habit 1**: "Daily Reading" - 30 books completed
- **Habit 2**: "Weekly Book Club" - 10 books completed
- **Manual Progress**: 5 books
- **Total Progress**: 45 books (45%)

### After Optimization:
**Goal**: "Read 100 Books" (Target: 100, Target Date: Dec 31, 2025)
- **Manual Progress**: 45 books (converted from old habits)
- **New Habit**: "Knowledge Absorption Ritual"
  - Frequency: Daily
  - Days Remaining: 180
  - Remaining Target: 100 - 45 = 55 books
  - Per Period Target: 55 / 180 = 0.31 → 1 book per day
  - Total Habit Target: 1 × 180 = 180 (allows flexibility)
- **Total Progress**: 45 books (45%) ✅ **Preserved**

### User Experience:
- ✅ Goal progress remains at 45%
- ✅ No data loss
- ✅ New habit targets reflect remaining work
- ✅ Timeline remains achievable

---

## Benefits

1. **Zero Data Loss**: All accumulated progress is preserved
2. **Accurate Tracking**: Goals show correct progress even after optimization
3. **Smart Recalculation**: New habit targets adapt to remaining time and goals
4. **Audit Trail**: All changes are logged in `feedbackEvents`
5. **Flexibility**: Manual progress can still be adjusted independently

---

## Technical Details

### Database Fields Used:
- `goalInstances.currentValue`: Manual progress offset (can be positive or negative)
- `goalInstances.targetValue`: Total target for the goal
- `habitInstances.currentValue`: Progress from this specific habit instance
- `habitInstances.targetValue`: Target for this habit-goal pairing
- `habitInstances.frequencySettings`: Frequency breakdown for calculations

### Progress Calculation:
```
Goal Progress % = (goalInstance.currentValue + sum(habitInstances.currentValue)) / goalInstance.targetValue * 100
```

After optimization:
```
Goal Progress % = (goalInstance.currentValue [now includes old habit progress]) / goalInstance.targetValue * 100
```

---

## Edge Cases Handled

1. **No Target Date**: Defaults to 90 days in the future
2. **Already Completed Goals**: Remaining target is 0, new habits get minimal targets
3. **Multiple Habits per Goal**: Each habit's progress is summed before conversion
4. **Negative Progress**: Handled gracefully (edge case from manual adjustments)
5. **Past Target Dates**: Uses minimum of 1 day to avoid division by zero

---

## Verification

After optimization, verify:
```sql
-- Check that goal progress is preserved
SELECT 
  gd.title,
  gi.target_value,
  gi.current_value as manual_progress,
  (SELECT SUM(current_value) FROM habit_instances WHERE goal_instance_id = gi.id) as habit_progress,
  gi.current_value + COALESCE((SELECT SUM(current_value) FROM habit_instances WHERE goal_instance_id = gi.id), 0) as total_progress
FROM goal_instances gi
JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
WHERE gi.user_id = 'USER_ID' AND gi.status = 'active';
```

---

## Future Enhancements

1. **Undo Optimization**: Allow reverting within 24 hours, restoring old habits and their progress
2. **Progress Attribution**: Track which optimized habits contributed to each goal
3. **Optimization History**: Show before/after progress snapshots
4. **Smart Defaults**: Learn user's typical habit completion rates to improve target calculations

