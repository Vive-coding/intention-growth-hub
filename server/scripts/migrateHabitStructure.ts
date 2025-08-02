import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function migrateHabitStructure() {
  try {
    console.log('Starting habit structure migration...');
    
    // 1. Drop old tables (since we want to clean up data anyway)
    console.log('Dropping old habit-related tables...');
    await sql`DROP TABLE IF EXISTS goal_habits CASCADE`;
    await sql`DROP TABLE IF EXISTS habit_targets CASCADE`;
    
    // 2. Create new habit_definitions table
    console.log('Creating habit_definitions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS habit_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        global_completions INTEGER DEFAULT 0,
        global_streak INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // 3. Create new habit_instances table
    console.log('Creating habit_instances table...');
    await sql`
      CREATE TABLE IF NOT EXISTS habit_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        habit_definition_id UUID NOT NULL REFERENCES habit_definitions(id) ON DELETE CASCADE,
        goal_instance_id UUID NOT NULL REFERENCES goal_instances(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_value INTEGER NOT NULL,
        current_value INTEGER DEFAULT 0,
        goal_specific_streak INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(habit_definition_id, goal_instance_id)
      )
    `;
    
    // 4. Update habit_completions table to reference habit_definitions
    console.log('Updating habit_completions table...');
    await sql`
      ALTER TABLE habit_completions 
      ADD COLUMN IF NOT EXISTS habit_definition_id UUID REFERENCES habit_definitions(id) ON DELETE CASCADE
    `;
    
    // 5. Add indexes for performance
    console.log('Adding indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_habit_definitions_user_id ON habit_definitions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_habit_instances_goal_instance_id ON habit_instances(goal_instance_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_habit_instances_habit_definition_id ON habit_instances(habit_definition_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_definition_id ON habit_completions(habit_definition_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_habit_completions_user_id ON habit_completions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_habit_completions_completed_at ON habit_completions(completed_at)`;
    
    // 6. Create trigger to update global habit stats
    console.log('Creating trigger for habit completions...');
    await sql`
      CREATE OR REPLACE FUNCTION update_habit_global_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update global completions count
        UPDATE habit_definitions 
        SET global_completions = global_completions + 1,
            updated_at = NOW()
        WHERE id = NEW.habit_definition_id;
        
        -- Update global streak (simplified - assumes daily completions)
        UPDATE habit_definitions 
        SET global_streak = global_streak + 1,
            updated_at = NOW()
        WHERE id = NEW.habit_definition_id;
        
        -- Update all goal instances that use this habit
        UPDATE habit_instances 
        SET current_value = current_value + 1,
            goal_specific_streak = goal_specific_streak + 1,
            updated_at = NOW()
        WHERE habit_definition_id = NEW.habit_definition_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    await sql`
      CREATE TRIGGER trigger_update_habit_global_stats
        AFTER INSERT ON habit_completions
        FOR EACH ROW
        EXECUTE FUNCTION update_habit_global_stats()
    `;
    
    // 7. Create function to calculate goal progress
    console.log('Creating goal progress calculation function...');
    await sql`
      CREATE OR REPLACE FUNCTION calculate_goal_progress(goal_instance_uuid UUID)
      RETURNS INTEGER AS $$
      DECLARE
        total_progress INTEGER := 0;
      BEGIN
        -- Calculate average progress across all habits in this goal
        SELECT 
          COALESCE(AVG(
            CASE 
              WHEN hi.target_value > 0 THEN 
                LEAST(100, (hi.current_value::DECIMAL / hi.target_value::DECIMAL) * 100)
              ELSE 0 
            END
          ), 0)::INTEGER
        INTO total_progress
        FROM habit_instances hi
        WHERE hi.goal_instance_id = goal_instance_uuid;
        
        RETURN total_progress;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    // 8. Create function to calculate life metric progress
    console.log('Creating life metric progress calculation function...');
    await sql`
      CREATE OR REPLACE FUNCTION calculate_life_metric_progress(metric_name VARCHAR, user_id_param VARCHAR)
      RETURNS INTEGER AS $$
      DECLARE
        total_progress INTEGER := 0;
      BEGIN
        -- Calculate average progress across all goals in this life metric
        SELECT 
          COALESCE(AVG(calculate_goal_progress(gi.id)), 0)::INTEGER
        INTO total_progress
        FROM goal_instances gi
        JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
        WHERE gd.category = metric_name 
          AND gi.user_id = user_id_param
          AND gi.status = 'active';
        
        RETURN total_progress;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Habit structure migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await sql.end();
  }
}

migrateHabitStructure(); 