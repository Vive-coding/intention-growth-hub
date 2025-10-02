# REVISED PLAN: Suggested Goals with Habits Flow

## 🎯 **Overview**

Implement a multi-step wizard for accepting suggested goals that includes habit selection and target setting, reusing existing UI patterns from `AddHabitModal`.

---

## **Multi-Step Flow Design**

### **Flow:** Goal Details → Select Habits → Set Habit Targets

### **Step 1: Goal Details & Target Date**
- Goal title (pre-filled from suggestion)
- Goal description (pre-filled)
- Life metric (pre-selected, read-only)
- **Target date** (user input - required)
- Target value (optional, default to 1)

### **Step 2: Select Habits** *(Reuses existing habit selection pattern)*
- **AI-Suggested Habits** for this specific goal:
  - Display with priority badges (Essential/Helpful/Optional)
  - Display high-leverage badge (🌟) for multi-goal habits
  - Pre-select "Essential" habits by default
- **Existing Habits** that match the life metric:
  - Show which goals they're already associated with
  - Indicate which are high-leverage
- Allow multi-select
- Option to skip (habits can be added later)

### **Step 3: Set Habit Targets** *(Reuses existing target setting UI)*
- For each selected habit:
  - Frequency (daily/weekly/monthly)
  - Per-period target (e.g., 1x per day)
  - Periods count (auto-calculated from goal's target date)
- Show total completions required
- Display daily habit count warning if approaching 10
- Final action: Create goal + associate habits

---

## **Key Design Decisions**

1. **Reuse Existing UI Patterns**: Leverage the 3-step wizard in `AddHabitModal.tsx` (lines 56-69)
2. **Goal-Specific Habits**: AI generates 2-3 habits per goal (nested structure)
3. **High-Leverage Identification**: Mark habits that can serve multiple goals
4. **Context-Aware AI**: Use recent accepted goals/habits to prevent duplicates
5. **Habit Count Management**: Keep total daily habits under 10

---

## **Implementation Phases**

### **Phase 1: Database Schema Changes** ✅

#### 1.1 Create Goal-Habit Link Table
```sql
-- Links suggested habits to suggested goals
CREATE TABLE suggested_goal_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_goal_id UUID NOT NULL REFERENCES suggested_goals(id) ON DELETE CASCADE,
  suggested_habit_id UUID NOT NULL REFERENCES suggested_habits(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1, -- 1=essential, 2=helpful, 3=optional
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(suggested_goal_id, suggested_habit_id)
);

CREATE INDEX idx_suggested_goal_habits_goal ON suggested_goal_habits(suggested_goal_id);
CREATE INDEX idx_suggested_goal_habits_habit ON suggested_goal_habits(suggested_habit_id);
```

#### 1.2 Enhance Suggested Habits Table
```sql
ALTER TABLE suggested_habits 
ADD COLUMN is_high_leverage BOOLEAN DEFAULT false,
ADD COLUMN applicable_goal_types TEXT[], -- ['career', 'health', 'personal']
ADD COLUMN novelty_score INTEGER CHECK (novelty_score >= 1 AND novelty_score <= 10),
ADD COLUMN impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
ADD COLUMN actionability_score INTEGER CHECK (actionability_score >= 1 AND actionability_score <= 10);
```

---

### **Phase 2: AI Agent Enhancements**

#### 2.1 Add Context Builder Service

**New File:** `server/services/contextBuilder.ts`

**Purpose:** Fetch recent user activity to provide context for AI

**Methods:**
- `getRecentAcceptedGoals(userId)` - Last 3-5 accepted goals (30 days)
- `getRecentAcceptedHabits(userId)` - Last 3-5 accepted habits (30 days)
- `getUpvotedInsights(userId)` - Last 5 upvoted insights
- `getCurrentDailyHabitCount(userId)` - Count of active daily habits

**Usage:** Called before AI agent processes journal entry

#### 2.2 Update AI Prompt Template

**File:** `server/ai/agent.ts` (lines 172-294)

**Key Additions:**

```
GOAL-HABIT STRUCTURE:
For each suggested goal, provide 2-3 specific habits:
- priority: 1 (Essential) - Critical for goal success
- priority: 2 (Helpful) - Supportive but not required
- priority: 3 (Optional) - Nice to have

HIGH LEVERAGE CRITERIA:
- Habit supports multiple goal types
- Habit is a meta-skill (reflection, learning, communication)
- Mark with isHighLeverage: true
- Example: "Energy Autopsy" helps career, health, personal goals

NOVELTY REQUIREMENTS:
Current daily habits: {currentDailyHabitCount}/10
- Habits must be NOVEL and INTERESTING
- Users should feel proud to share with others
- Not generic ("go for a walk", "meditate")
- Include specific triggers and actions

CONTEXT TO AVOID DUPLICATES:
{recentAcceptedGoals}
{recentAcceptedHabits}
{upvotedInsights}

HIGH-LEVERAGE EXAMPLES:
✓ "Energy Autopsy" (Daily): One line - what gave/drained energy?
✓ "Future Self Ping" (Weekly): Note to "3 months from now me"
✓ "Skill Dividend" (Weekly): Apply existing skill in new context
✓ "Uncomfortable Compliment" (Daily/Weekly): Vulnerable compliment
✓ "Micro-Adventure" (Weekly): Try one novel thing
✓ "Second Brain Snapshot" (Daily): Most surprising learning

Output Format:
{
  "suggestedGoals": [
    {
      "title": "string",
      "lifeMetricId": "uuid",
      "habits": [
        {
          "title": "string",
          "description": "string",
          "priority": 1,
          "isHighLeverage": true,
          "applicableGoalTypes": ["career", "personal"],
          "frequency": "daily",
          "targetCount": 1
        }
      ]
    }
  ]
}
```

#### 2.3 Update Insight Service

**File:** `server/services/insightService.ts`

**Changes:**
1. Fetch context using `ContextBuilder`
2. Pass context to AI agent
3. Update goal/habit creation to handle nested structure:
   - Create goal
   - Create habits for goal
   - Link habits to goal via `suggested_goal_habits`

---

### **Phase 3: Backend API Updates**

#### 3.1 New Endpoint: Get Suggested Habits for Goal

```typescript
// GET /api/goals/suggested/:goalId/habits
// Returns:
// - suggestedHabits: habits linked to this goal (with priority)
// - existingHabits: user's existing habits in same life metric
// - goal: the suggested goal details
```

#### 3.2 Update Goal Creation Endpoint

```typescript
// POST /api/goals
{
  title: string,
  description: string,
  lifeMetricId: string,
  targetValue: number,
  targetDate: string,          // Required for target calculation
  habitIds?: string[],          // Existing habit IDs
  suggestedHabitIds?: string[], // Suggested habit IDs to promote
  habitTargets?: {              // Target settings per habit
    [habitId: string]: {
      frequency: 'daily' | 'weekly' | 'monthly',
      perPeriodTarget: number,
      periodsCount: number
    }
  }
}
```

**Process:**
1. Create goal definition
2. Create goal instance
3. Promote suggested habits → habit definitions
4. Associate all habits with goal (create habit instances)
5. Record feedback events for accepted habits
6. Archive suggested goal

#### 3.3 Helper: Promote Suggested Habit

```typescript
async function promoteSuggestedHabit(
  suggestedHabitId: string,
  userId: string
): Promise<HabitDefinition>
```

**Process:**
1. Fetch suggested habit
2. Create habit definition
3. Archive suggested habit
4. Return habit definition

#### 3.4 Update Storage Service

**File:** `server/storage.ts`

**Add Methods:**
- `linkSuggestedGoalHabit()` - Link habit to goal
- `getSuggestedHabitsForGoal()` - Get habits for a goal with priority

---

### **Phase 4: Frontend UI Changes**

#### 4.1 Create Goal Creation Wizard Component

**New File:** `client/src/components/CreateGoalWizard.tsx`

**Props:**
```typescript
interface CreateGoalWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
  suggestedGoalId: string;
  prefillData: {
    title: string;
    description: string;
    lifeMetricId: string;
    lifeMetricName: string;
    lifeMetricColor: string;
  };
}
```

**State Management:**
- Current step (1-3)
- Goal details (title, description, targetDate, targetValue)
- Habit selection (selectedSuggestedHabitIds, selectedExistingHabitIds)
- Habit targets (frequency, perPeriodTarget, periodsCount per habit)

**Step Components:**

**Step 1: Goal Details**
- Pre-filled title, description
- Life metric display (colored badge)
- Target date picker (required)
- Target value input

**Step 2: Habit Selection**
- **AI-Suggested Habits Section:**
  - Habit card with checkbox
  - Title + description
  - Priority badge (Essential/Helpful/Optional)
  - High-leverage badge (🌟 Sparkles icon)
  - Frequency display
  - Click to select/deselect
  - Essential habits pre-selected
  
- **Existing Habits Section:**
  - Habit card with checkbox
  - Title + description
  - Click to select/deselect

**Step 3: Habit Targets**
- For each selected habit:
  - Habit title
  - Frequency dropdown (daily/weekly/monthly)
  - Per-period target input
  - Periods count (auto-calculated, editable)
  - Total completions display
- Daily habit count warning (if needed)

**Navigation:**
- Back button (disabled on step 1)
- Next button (enabled when step valid)
- Create Goal button (on step 3)

**Styling:**
- High-leverage badge: Yellow/gold background, sparkles icon
- Priority badges: Red (essential), Blue (helpful), Gray (optional)
- Selected habits: Blue border and background

#### 4.2 Update Dashboard Component

**File:** `client/src/components/Dashboard.tsx`

**Changes:**
1. Import `CreateGoalWizard`
2. Add state: `showGoalWizard`, `selectedSuggestedGoal`
3. Update "Add to Life Metric" button click handler
4. Render wizard when goal selected

**Button Handler (line ~930):**
```typescript
onClick={() => {
  setSelectedSuggestedGoal({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    lifeMetricId: goal.lifeMetric?.id,
    lifeMetricName: goal.lifeMetric?.name,
    lifeMetricColor: goal.lifeMetric?.color
  });
  setShowGoalWizard(true);
}}
```

---

### **Phase 5: Migration & Schema Updates**

#### Migration File Structure

**File:** `migrations/0005_add_goal_habit_suggestions.sql`

```sql
-- Add goal-habit linking table
CREATE TABLE suggested_goal_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_goal_id UUID NOT NULL REFERENCES suggested_goals(id) ON DELETE CASCADE,
  suggested_habit_id UUID NOT NULL REFERENCES suggested_habits(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(suggested_goal_id, suggested_habit_id)
);

CREATE INDEX idx_suggested_goal_habits_goal ON suggested_goal_habits(suggested_goal_id);
CREATE INDEX idx_suggested_goal_habits_habit ON suggested_goal_habits(suggested_habit_id);

-- Enhance suggested habits table
ALTER TABLE suggested_habits 
ADD COLUMN is_high_leverage BOOLEAN DEFAULT false,
ADD COLUMN applicable_goal_types TEXT[],
ADD COLUMN novelty_score INTEGER CHECK (novelty_score >= 1 AND novelty_score <= 10),
ADD COLUMN impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
ADD COLUMN actionability_score INTEGER CHECK (actionability_score >= 1 AND actionability_score <= 10);
```

**File:** `shared/schema.ts`

Add new table definition:

```typescript
export const suggestedGoalHabits = pgTable("suggested_goal_habits", {
  id: uuid("id").defaultRandom().primaryKey(),
  suggestedGoalId: uuid("suggested_goal_id").notNull().references(() => suggestedGoals.id, { onDelete: "cascade" }),
  suggestedHabitId: uuid("suggested_habit_id").notNull().references(() => suggestedHabits.id, { onDelete: "cascade" }),
  priority: integer("priority").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Update `suggestedHabits` table:

```typescript
export const suggestedHabits = pgTable("suggested_habits", {
  // ... existing fields
  isHighLeverage: boolean("is_high_leverage").default(false),
  applicableGoalTypes: text("applicable_goal_types").array(),
  noveltyScore: integer("novelty_score"),
  impactScore: integer("impact_score"),
  actionabilityScore: integer("actionability_score"),
});
```

Add relations:

```typescript
export const suggestedGoalHabitsRelations = relations(suggestedGoalHabits, ({ one }) => ({
  suggestedGoal: one(suggestedGoals, {
    fields: [suggestedGoalHabits.suggestedGoalId],
    references: [suggestedGoals.id],
  }),
  suggestedHabit: one(suggestedHabits, {
    fields: [suggestedGoalHabits.suggestedHabitId],
    references: [suggestedHabits.id],
  }),
}));
```

---

## **Implementation Checklist**

### **Phase 1: Database** ✅
- [ ] Create migration file `0005_add_goal_habit_suggestions.sql`
- [ ] Add `suggested_goal_habits` table
- [ ] Add columns to `suggested_habits` table
- [ ] Update `schema.ts` with new table and relations
- [ ] Run migration: `npm run db:push` or migration command

### **Phase 2: Backend - Context & AI** ✅
- [ ] Create `server/services/contextBuilder.ts`
  - [ ] `getRecentAcceptedGoals()`
  - [ ] `getRecentAcceptedHabits()`
  - [ ] `getUpvotedInsights()`
  - [ ] `getCurrentDailyHabitCount()`
  - [ ] `buildInsightContext()`
- [ ] Update `server/ai/agent.ts` prompt template
  - [ ] Add context variables
  - [ ] Add high-leverage examples
  - [ ] Update output schema
- [ ] Update `server/services/insightService.ts`
  - [ ] Fetch context using ContextBuilder
  - [ ] Pass context to AI agent
  - [ ] Update goal/habit creation logic for nested structure

### **Phase 3: Backend - API & Storage** ✅
- [ ] Update `server/storage.ts`
  - [ ] Add `linkSuggestedGoalHabit()`
  - [ ] Add `getSuggestedHabitsForGoal()`
- [ ] Update `server/routes/goals.ts`
  - [ ] Create `GET /api/goals/suggested/:goalId/habits`
  - [ ] Create `promoteSuggestedHabit()` helper
  - [ ] Update `POST /api/goals` to accept habit associations
  - [ ] Add feedback event recording

### **Phase 4: Frontend** ✅
- [ ] Create `client/src/components/CreateGoalWizard.tsx`
  - [ ] Component structure and props
  - [ ] State management
  - [ ] Step 1: Goal details UI
  - [ ] Step 2: Habit selection UI
  - [ ] Step 3: Habit targets UI
  - [ ] Navigation logic
  - [ ] Submit handler
  - [ ] Badge components (high-leverage, priority)
- [ ] Update `client/src/components/Dashboard.tsx`
  - [ ] Import CreateGoalWizard
  - [ ] Add state for wizard
  - [ ] Update button handler
  - [ ] Render wizard component

### **Testing** ✅
- [ ] Test database migration
- [ ] Test context builder fetches correct data
- [ ] Test AI generates goal-specific habits
- [ ] Test API endpoint returns habits for goal
- [ ] Test goal creation with habits
- [ ] Test habit promotion (suggested → definition)
- [ ] Test wizard UI flow (all 3 steps)
- [ ] Test high-leverage badge display
- [ ] Test priority badge display
- [ ] Test target auto-calculation
- [ ] Test feedback events recorded
- [ ] Test suggested goal archived after acceptance

---

## **Example End-to-End Flow**

### User Journey:

**1. User Writes Journal:**
> "I want to get better at system design. I need to study consistently and apply what I learn."

**2. AI Generates Insight:**
- Title: "Ready to commit to technical skill development"
- Life Metric: Career Growth
- Confidence: 85%

**3. AI Suggests Goal with Habits:**

**Goal:** "Complete 3 system design courses by Q2"

**Habits:**
1. **"Learning Snapshot"** (Daily, Essential, 🌟 High-Leverage)
   - "Each evening, write one sentence about the most valuable thing you learned today"
   - Applicable to: Career, Personal Development
   - Priority: 1 (Essential)

2. **"Skill Dividend"** (Weekly, Essential, 🌟 High-Leverage)
   - "Apply one system design concept to a real problem this week"
   - Applicable to: Career, Personal Development
   - Priority: 1 (Essential)

3. **"Study Time Block"** (Daily, Helpful)
   - "Dedicate 30 minutes to course work before checking email"
   - Priority: 2 (Helpful)

**4. User Accepts Goal:**
- Clicks "Add to Career Growth"
- `CreateGoalWizard` opens

**Step 1:**
- Title: "Complete 3 system design courses by Q2" ✓
- Description: pre-filled ✓
- Target Date: User selects "June 30, 2025"
- Clicks "Next"

**Step 2:**
- Sees 3 suggested habits (1 & 2 pre-selected as Essential)
- Notices 🌟 badge on habits 1 & 2
- Deselects habit 3 (not needed)
- Clicks "Next"

**Step 3:**
- **Learning Snapshot:**
  - Frequency: Daily
  - Per period: 1x
  - Periods: 120 days (auto-calculated)
  - Total: 120 completions

- **Skill Dividend:**
  - Frequency: Weekly
  - Per period: 1x
  - Periods: 17 weeks (auto-calculated)
  - Total: 17 completions

- Daily habit count: 8/10 ✓
- Clicks "Create Goal"

**5. Backend Processing:**
- Creates goal definition + instance
- Promotes 2 suggested habits → habit definitions
- Creates 2 habit instances linked to goal
- Archives suggested goal
- Records 3 feedback events (goal accept + 2 habit accepts)
- Updates suggestion memory

**6. Result:**
- Goal appears in user's Career Growth section
- 2 habits appear in daily habit list
- User can start completing habits immediately

**7. Next Journal Entry:**
- AI sees context: "Recently accepted: System design courses goal"
- AI sees context: "Recently accepted: Learning Snapshot, Skill Dividend"
- AI avoids suggesting duplicate habits
- AI builds on this foundation with complementary suggestions

---

## **Success Metrics**

After implementation, track:

1. **Adoption Rate**: % of suggested goals accepted with habits
2. **Habit Selection**: Avg habits selected per goal (target: 2-3)
3. **High-Leverage Usage**: % of high-leverage habits selected
4. **Daily Habit Count**: Avg active daily habits per user (keep <10)
5. **Completion Rate**: Do users complete these habits?
6. **Novelty Score**: User feedback on habit creativity
7. **Context Effectiveness**: % reduction in duplicate suggestions

---

## **Future Enhancements** (Post-MVP)

### 1. Judge LLM System
- Evaluate habit quality before showing to users
- Score: novelty, actionability, impact
- Filter out low-quality suggestions

### 2. Habit Impact Analytics
- Track which habits lead to goal completion
- Identify high-performing habit patterns
- Use data to improve future suggestions

### 3. Habit Consolidation
- Suggest merging similar habits
- Auto-archive habits that become automatic
- Recommend habit graduation system

### 4. Cross-Goal Habit Analysis
- Identify habits that could serve multiple goals
- Proactively suggest high-leverage habits
- Build habit-goal impact matrix

---

## **Ready to Implement! 🚀**

**Recommended Implementation Order:**

1. **Start with Phase 1** (Database) - 30 min
   - Creates foundation for everything else
   - Can test schema changes independently

2. **Then Phase 2** (Context & AI) - 2 hours
   - Context builder is straightforward
   - AI prompt updates are iterative (can refine later)
   - Test with journal entries to see goal+habit output

3. **Then Phase 3** (Backend API) - 2 hours
   - Storage methods are simple CRUD
   - API endpoints build on existing patterns
   - Test with Postman/curl

4. **Finally Phase 4** (Frontend) - 3 hours
   - Wizard component is the biggest piece
   - Reuses existing UI components
   - Most visible impact for users

**Total Estimated Time: 7-8 hours**

---

Which phase would you like to start with? I'm ready to implement! 🎯


