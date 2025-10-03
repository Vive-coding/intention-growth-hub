# Habit Optimization Feature - Changelog

## Overview
Implemented AI-powered habit optimization that automatically archives orphaned habits and consolidates redundant habits into fewer, high-leverage habits that serve multiple goals.

## New Files Created

### 1. `server/ai/habitOptimizationAgent.ts`
- AI agent using GPT-4o for habit analysis and optimization
- Validates optimization proposals ensure goal coverage
- Enforces aggressive reduction (40%+ archive, 15-20 total habits target)
- Uses punchy, shareable habit phrasing (3-4 words)
- Examples: "Ship something tiny", "Walk to think", "Ask one sharp question"

### 2. `server/services/habitOptimizationService.ts`
- `archiveOrphanedHabits()` - Auto-archives habits not linked to any active goals
- `buildOptimizationContext()` - Gathers user data for AI analysis
- `analyzeHabits()` - Calls AI agent and validates proposal
- `executeOptimization()` - Archives old habits, creates new ones, preserves progress
- Includes UUID validation and explicit casting for PostgreSQL compatibility
- Progress preservation: transfers habit progress to goal manual progress
- Dynamic target recalculation based on goal dates and habit frequency

### 3. `client/src/components/OptimizeHabitsModal.tsx`
- Modal UI for displaying optimization proposal
- Shows before/after comparison, habits to archive, habits to create
- Displays auto-archived orphaned habits count
- JWT authentication headers for API calls
- Auto-triggers analysis when modal opens

## Modified Files

### 1. `server/routes/goals.ts`
- Added `POST /habits/optimize/archive-orphaned` - Archive orphaned habits endpoint
- Added `GET /habits/optimize/analyze` - Get optimization proposal
  - Auto-archives orphaned habits before analysis
  - Returns proposal with orphaned habits info
- Added `POST /habits/optimize/execute` - Execute optimization
- Routes positioned before general `/habits` route to avoid conflicts

### 2. `client/src/components/HabitsScreen.tsx`
- Added "Optimize Habits" button (shown when ≥5 active habits)
- Integrated `OptimizeHabitsModal`
- Added state management for modal visibility
- Refetches habits after successful optimization

### 3. `server/ai/habitOptimizationAgent.ts` (Prompt Improvements)
- Enhanced prompt with punchy, shareable habit phrasing
- Added 8 high-leverage habit examples with 3-4 word titles
- Added phrasing rules (DO/DON'T examples)
- Emphasis on complementary habit sets that work together
- Pride factor: habits users want to share with others
- Explicit UUID format instructions for AI output

## Key Features

### 1. Automatic Orphaned Habit Archiving
- Detects habits not linked to any active goals
- Archives them automatically before optimization
- Preserves them for future goal associations
- Logs feedback events with reason

### 2. AI-Powered Optimization
- Analyzes user's habits, goals, and insights
- Proposes aggressive reduction (target 15-20 total habits)
- Archives redundant/low-performing habits (40%+ of current)
- Creates 5-8 high-leverage habits covering multiple goals
- Validates goal coverage (allows up to 20% uncovered)

### 3. Progress Preservation
- Transfers habit progress to goal manual progress before archiving
- Ensures no progress is lost during optimization

### 4. Dynamic Target Recalculation
- Calculates habit targets based on:
  - Goal target dates
  - Remaining goal progress needed
  - Habit frequency (daily/weekly/monthly)
  - Days remaining until goal deadline

### 5. UUID Type Safety
- Explicit `::uuid` casting in all PostgreSQL queries
- UUID validation for habit IDs, goal IDs, category IDs
- Defensive programming with lookup fallbacks

## Bug Fixes

### 1. PostgreSQL UUID Type Errors
- Fixed: `operator does not exist: character varying = uuid`
- Solution: Added explicit `::uuid` casting in SQL queries
- Files: `habitOptimizationService.ts` (lines 54, 87, 134, 161, 250, 261)

### 2. Invalid Goal Coverage Validation
- Fixed: Validation only checked new habits, ignored remaining habits
- Solution: Check coverage from both new habits AND remaining existing habits
- File: `habitOptimizationAgent.ts` (lines 258-274)

### 3. Incorrect Habit Count Math
- Fixed: AI miscalculated `habitsAfter` in summary
- Solution: Server-side recalculation overrides AI's math
- File: `habitOptimizationService.ts` (lines 224-233)

### 4. AI Generating Invalid IDs
- Fixed: AI returned names/strings instead of UUIDs
- Solution: Include habit/goal IDs in prompt, instruct AI to use exact UUIDs
- File: `habitOptimizationAgent.ts` (lines 43-51, 120-139)

### 5. Route Matching Order
- Fixed: General `/habits` route intercepted `/habits/optimize/*`
- Solution: Moved optimization routes before general route
- File: `routes/goals.ts` (lines 1118-1183)

### 6. Missing Authentication Headers
- Fixed: Modal API calls missing JWT token
- Solution: Added `Authorization` header with localStorage token
- File: `OptimizeHabitsModal.tsx` (lines 60-66, 91-97)

### 7. Too Strict Goal Coverage Validation
- Fixed: Required 100% goal coverage, failed for completed/low-priority goals
- Solution: Allow up to 20% of goals to be uncovered
- File: `habitOptimizationAgent.ts` (lines 276-291)

## Prompt Engineering Evolution

### Initial Version
- Basic habit consolidation
- Generic habit names
- Minimal reduction

### Final Version (Current)
- Aggressive reduction (40%+ archive, 15-20 total target)
- Punchy 3-4 word titles users can proudly share
- High-leverage examples: "Ship something tiny", "Walk to think"
- Complementary habit sets that create daily/weekly rhythm
- Pride factor: habits worth telling friends about
- Math constraints: min 40% archive, 5-8 new habits, each covering 2-4 goals

## UI/UX Enhancements

1. **Auto-Analysis**: Modal automatically triggers optimization when opened
2. **Orphaned Habits Info**: Blue card showing auto-archived orphaned habits
3. **Impact Summary**: Visual cards showing reduction percentage, goals covered
4. **Habit Comparison**: Side-by-side view of habits to archive vs create
5. **High-Leverage Badges**: Visual indicator for high-impact habits
6. **Loading States**: Clear feedback during 10-30 second AI analysis
7. **Error Handling**: Graceful error display with retry option

## Files Changed Summary

**New Files (3):**
- `server/ai/habitOptimizationAgent.ts`
- `server/services/habitOptimizationService.ts`
- `client/src/components/OptimizeHabitsModal.tsx`

**Modified Files (2):**
- `server/routes/goals.ts`
- `client/src/components/HabitsScreen.tsx`

**Total Lines Changed:** ~800+ lines added

## Testing Checklist

- [x] Orphaned habits auto-archived correctly
- [x] AI generates valid UUIDs (not names/strings)
- [x] Progress preserved when habits archived
- [x] New habits linked to correct goals
- [x] Targets calculated based on goal dates
- [x] Modal shows correct before/after counts
- [x] Authentication works for all API calls
- [x] Route matching works (no 404s)
- [x] Goal coverage validation allows reasonable exceptions
- [ ] Habit targets set correctly with goal dates and frequency (IN PROGRESS - BUG TO FIX)

## Recent Fixes (Latest Session)

### 1. Fixed Archived Habits Showing in Goal Details ✅
**Issue**: Archived habits were still appearing in goal detail views
**Root Cause** (`routes/goals.ts` lines 249, 2306):
- Goal queries weren't filtering by `habitDefinitions.isActive = true`
- Both GET "/" (all goals) and GET "/:id" (single goal) showed archived habits

**Solution**:
- Added `eq(habitDefinitions.isActive, true)` filter to both endpoints
- Now only active habits show up in goal associations
- Archived habits remain in database for potential future reactivation

**Code Changed**:
```typescript
.where(and(
  eq(habitInstances.goalInstanceId, goalId),
  eq(habitDefinitions.isActive, true) // NEW: Filter archived habits
));
```

### 2. Fixed Habit Target Calculation Bug ✅
**Issue**: Newly created habits had incorrect target values when linked to goals
**Root Cause**: 
- Logic was trying to reverse-calculate from goal progress (assuming 1:1 mapping)
- Incorrectly divided goal remaining target by number of periods
- Didn't respect AI's suggested targetCount per period

**Solution** (`habitOptimizationService.ts` lines 478-522):
- Use AI's suggested `targetCount` as the per-period target
- Calculate `periodsCount` based on goal target date and habit frequency:
  - Daily: periodsCount = days remaining
  - Weekly: periodsCount = ceil(days remaining / 7)
  - Monthly: periodsCount = ceil(days remaining / 30)
- Calculate `totalHabitTarget = targetCount × periodsCount`
- Store in `frequencySettings` for proper tracking

**Example**:
- Habit: "Ship something tiny" (weekly, targetCount: 3)
- Goal deadline: 60 days away
- Calculation: 3x weekly × 9 weeks = 27 total target ✅

### 2. Enhanced AI Prompt with Frequency Guidance ✅
**Added** (`habitOptimizationAgent.ts` lines 121-143):
- Explicit frequency and target count guidance for AI
- Daily habits examples: targetCount = 1
- Weekly habits examples: targetCount = 1-3
- Monthly habits examples: targetCount = 1-2
- Clear explanation of how system calculates totals

## Testing Checklist

- [x] Orphaned habits auto-archived correctly
- [x] AI generates valid UUIDs (not names/strings)
- [x] Progress preserved when habits archived
- [x] New habits linked to correct goals
- [x] Targets calculated based on goal dates ✅ **FIXED**
- [x] Modal shows correct before/after counts
- [x] Authentication works for all API calls
- [x] Route matching works (no 404s)
- [x] Goal coverage validation allows reasonable exceptions
- [x] Habit targets use AI's targetCount and goal target dates ✅ **FIXED**

## Files Ready for Git Push

**New Files (4):**
1. `server/ai/habitOptimizationAgent.ts`
2. `server/services/habitOptimizationService.ts`
3. `client/src/components/OptimizeHabitsModal.tsx`
4. `OPTIMIZE_HABITS_CHANGELOG.md` (this file)

**Modified Files (2):**
1. `server/routes/goals.ts`
2. `client/src/components/HabitsScreen.tsx`

## Critical: Testing Required Before Git Push ⚠️

### Habit Target Calculation Needs Verification
The target calculation fix (`habitOptimizationService.ts` lines 478-522) is implemented but **NOT YET VERIFIED** with real data:

**Issue**: Old habits in your database still have `periodsCount: 1` (created before fix)
**Need to do**:
1. Run "Optimize Habits" feature to create NEW habits with the fix
2. Check terminal logs for calculation details (lines like "Target: 3x per weekly × 9 periods = 27 total")
3. Verify new habits in goal detail view have correct `frequencySettings`
4. Confirm `periodsCount` is based on goal target date (not hardcoded to 1)

**Expected for a daily habit with 30-day goal deadline:**
```json
{
  "frequencySettings": {
    "frequency": "daily",
    "perPeriodTarget": 1,
    "periodsCount": 30,  // NOT 1!
  },
  "targetValue": 30
}
```

**Expected for a weekly habit (3x/week) with 60-day goal:**
```json
{
  "frequencySettings": {
    "frequency": "weekly", 
    "perPeriodTarget": 3,
    "periodsCount": 9,  // ceil(60/7) = 9 weeks
  },
  "targetValue": 27  // 3 × 9 = 27
}
```

## Next Steps (In Order)

1. ✅ Fix archived habits showing in goals → **COMPLETED**
2. ✅ Fix habit target calculation logic → **COMPLETED** 
3. ⚠️ **TEST optimization end-to-end** → **REQUIRED BEFORE GIT PUSH**
   - Run optimization
   - Verify new habits have correct periodsCount (not 1)
   - Check terminal logs for calculation details
4. ✅ Validate AI generates punchy habit names
5. 🚀 Push all changes to remote git (ONLY after step 3 passes)

