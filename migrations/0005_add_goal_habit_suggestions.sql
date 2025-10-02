-- Migration: Add goal-habit suggestion linking and high-leverage habit tracking
-- Purpose: Support AI-generated goal-specific habits with priority and quality scoring

-- Create junction table to link suggested habits to suggested goals
CREATE TABLE IF NOT EXISTS suggested_goal_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_goal_id UUID NOT NULL REFERENCES suggested_goals(id) ON DELETE CASCADE,
  suggested_habit_id UUID NOT NULL REFERENCES suggested_habits(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1, -- 1=essential, 2=helpful, 3=optional
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(suggested_goal_id, suggested_habit_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_suggested_goal_habits_goal ON suggested_goal_habits(suggested_goal_id);
CREATE INDEX IF NOT EXISTS idx_suggested_goal_habits_habit ON suggested_goal_habits(suggested_habit_id);

-- Enhance suggested_habits table with high-leverage tracking and quality scores
ALTER TABLE suggested_habits 
ADD COLUMN IF NOT EXISTS is_high_leverage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS applicable_goal_types TEXT[], -- e.g., ['career', 'health', 'personal']
ADD COLUMN IF NOT EXISTS novelty_score INTEGER CHECK (novelty_score IS NULL OR (novelty_score >= 1 AND novelty_score <= 10)),
ADD COLUMN IF NOT EXISTS impact_score INTEGER CHECK (impact_score IS NULL OR (impact_score >= 1 AND impact_score <= 10)),
ADD COLUMN IF NOT EXISTS actionability_score INTEGER CHECK (actionability_score IS NULL OR (actionability_score >= 1 AND actionability_score <= 10));

-- Add comments for documentation
COMMENT ON TABLE suggested_goal_habits IS 'Links AI-suggested habits to their parent suggested goals with priority ranking';
COMMENT ON COLUMN suggested_goal_habits.priority IS '1=essential (critical for success), 2=helpful (supportive), 3=optional (nice to have)';
COMMENT ON COLUMN suggested_habits.is_high_leverage IS 'True if habit can serve multiple goal types (e.g., Energy Autopsy for career+health+personal)';
COMMENT ON COLUMN suggested_habits.applicable_goal_types IS 'Array of goal types this habit supports (career, health, personal, finance, relationships, mental_health)';
COMMENT ON COLUMN suggested_habits.novelty_score IS 'AI judge score 1-10: How unique/creative is this habit compared to generic suggestions';
COMMENT ON COLUMN suggested_habits.impact_score IS 'AI judge score 1-10: Potential for meaningful life improvement across multiple goals';
COMMENT ON COLUMN suggested_habits.actionability_score IS 'AI judge score 1-10: How clear, specific, and immediately doable the habit is';


