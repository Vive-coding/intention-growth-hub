# My Focus - Implementation Plan

## Goals
- Single source of truth for priorities, insights, and optimizations.
- Special-agent outputs are persisted and surfaced in My Focus; same state feeds agent context.

## Data Flow
### Write Path (Agents → Persistence)
- On `structured_data` from agents:
  - `goal_suggestion`: persist accepted goals/habits (existing) + suggestion audit.
  - `prioritization`: write a priority snapshot (ranked goal IDs + reasons).
  - `optimization`: write an optimization proposal (recommendations, status).
  - `insight`: persist to `insights` (existing), tagged with `sourceThreadId`.
- Hook: in SSE handler after streaming, call `MyFocusService.persistFromAgent`.

### Read Path (Dashboard API)
- `GET /api/my-focus` returns:
  - `priorityGoals` from latest snapshot (hydrated with progress)
  - `highLeverageHabits` (active, with streaks)
  - `keyInsights` (recent)
  - Optionally, `pendingOptimizations` (latest open)

### Agent Context
- `ChatContextService.getWorkingSet` includes latest top-3 priorities, recent insights, and any open optimization summary.

## UI Architecture
- `client/src/components/focus/`
  - `MyFocusDashboard.tsx` (page shell)
  - `PriorityGoalsSection.tsx`
  - `ActiveHabitsSection.tsx`
  - `KeyInsightsSection.tsx`
  - `ViewAllSection.tsx`
- Query: React Query key `['/api/my-focus']`, `staleTime: 60000`.

## API / Services
- Extend `MyFocusService`:
  - `persistFromAgent(structured, { userId, threadId })`
  - `getMyFocus(userId)` already returns goals/habits/insights.
  - Add snapshot/optimization storage and retrieval.

## Schema Additions (minimal)
- `my_focus_priority_snapshots`
  - `id, userId, items(jsonb), createdAt, sourceThreadId`
- `my_focus_optimizations`
  - `id, userId, summary, recommendations(jsonb), status, createdAt, sourceThreadId`

## UX Details
- Loading shimmers per section.
- Empty states with CTAs (Set priorities, Choose habits, Start chat).
- Responsive: stacked on mobile; 2-col on desktop.

## Milestones
1) Persist-from-agent hook + schema tables
2) Dashboard API composition with caching (<500ms)
3) Focus components + routing
4) QA, accessibility, analytics
