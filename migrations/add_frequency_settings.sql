-- Add frequency_settings column to habit_instances table
-- This enables storing frequency breakdown (frequency, perPeriodTarget, periodsCount)
-- alongside the existing targetValue

ALTER TABLE habit_instances 
ADD COLUMN IF NOT EXISTS frequency_settings JSONB;

-- Add a comment to document the column purpose
COMMENT ON COLUMN habit_instances.frequency_settings IS 'Stores frequency breakdown: {frequency, perPeriodTarget, periodsCount}';
