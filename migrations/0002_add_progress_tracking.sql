-- Add month_year and completed_at columns to goal_instances table
ALTER TABLE goal_instances 
ADD COLUMN month_year VARCHAR(7),
ADD COLUMN completed_at TIMESTAMP;

-- Update existing goal instances with current month/year
UPDATE goal_instances 
SET month_year = CONCAT(EXTRACT(YEAR FROM created_at)::TEXT, '-', LPAD(EXTRACT(MONTH FROM created_at)::TEXT, 2, '0'))
WHERE month_year IS NULL;

-- Set completed_at for completed goals
UPDATE goal_instances 
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Create progress_snapshots table
CREATE TABLE progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  life_metric_name VARCHAR(100) NOT NULL,
  month_year VARCHAR(7) NOT NULL,
  progress_percentage INTEGER NOT NULL,
  goals_completed INTEGER NOT NULL,
  total_goals INTEGER NOT NULL,
  snapshot_date TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for efficient queries
CREATE INDEX idx_progress_snapshots_user_metric ON progress_snapshots(user_id, life_metric_name);
CREATE INDEX idx_progress_snapshots_date ON progress_snapshots(snapshot_date); 