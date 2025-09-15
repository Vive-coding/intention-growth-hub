#!/usr/bin/env node

/**
 * Fix problematic goal data
 * Run with: node fix_goal_data.js
 */

import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sql = postgres(connectionString);

async function fixGoalData() {
  try {
    console.log('🔧 Fixing problematic goal data...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    
    // Find goals with problematic values
    console.log('1. Finding goals with problematic values...');
    const problematicGoals = await sql`
      SELECT 
        gi.id,
        gd.title,
        gi.current_value,
        gi.target_value,
        gi.status,
        CASE 
          WHEN gi.target_value > 0 THEN ROUND((gi.current_value::float / gi.target_value) * 100)
          ELSE 0
        END as calculated_progress
      FROM goal_instances gi
      JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
      JOIN life_metric_definitions lmd ON gd.life_metric_id = lmd.id
      WHERE gi.user_id = ${mainUser} 
        AND (
          gi.current_value < 0 
          OR (gi.target_value > 0 AND gi.current_value > gi.target_value * 10)
          OR (gi.target_value > 0 AND gi.current_value::float / gi.target_value > 10)
        )
    `;
    
    console.log(`   Found ${problematicGoals.length} goals with problematic values:`);
    problematicGoals.forEach((goal, i) => {
      console.log(`   ${i + 1}. ${goal.title} - ${goal.current_value}/${goal.target_value} = ${goal.calculated_progress}%`);
    });

    if (problematicGoals.length === 0) {
      console.log('   No problematic goals found!');
      return;
    }

    // Fix each problematic goal
    console.log('\n2. Fixing problematic goals...');
    for (const goal of problematicGoals) {
      let newCurrentValue = goal.current_value;
      let newTargetValue = goal.target_value;
      
      // Fix negative values
      if (goal.current_value < 0) {
        newCurrentValue = 0;
        console.log(`   Fixing ${goal.title}: negative current value ${goal.current_value} → 0`);
      }
      
      // Fix extreme values (over 1000% progress)
      if (goal.target_value > 0 && goal.current_value > goal.target_value * 10) {
        // Cap at 100% progress
        newCurrentValue = goal.target_value;
        console.log(`   Fixing ${goal.title}: extreme progress ${goal.current_value}/${goal.target_value} → ${newCurrentValue}/${goal.target_value}`);
      }
      
      // Fix unrealistic target values (if target is 1 but current is much higher)
      if (goal.target_value === 1 && goal.current_value > 10) {
        newTargetValue = Math.max(goal.current_value, 10);
        newCurrentValue = Math.min(goal.current_value, newTargetValue);
        console.log(`   Fixing ${goal.title}: unrealistic target ${goal.current_value}/1 → ${newCurrentValue}/${newTargetValue}`);
      }
      
      // Update the goal if changes are needed
      if (newCurrentValue !== goal.current_value || newTargetValue !== goal.target_value) {
        await sql`
          UPDATE goal_instances 
          SET current_value = ${newCurrentValue}, target_value = ${newTargetValue}
          WHERE id = ${goal.id}
        `;
        
        const newProgress = newTargetValue > 0 ? Math.round((newCurrentValue / newTargetValue) * 100) : 0;
        console.log(`   ✅ Updated ${goal.title}: ${newCurrentValue}/${newTargetValue} = ${newProgress}%`);
      }
    }

    // Recalculate snapshots for all metrics
    console.log('\n3. Recalculating snapshots...');
    const userMetrics = await sql`
      SELECT DISTINCT lmd.name
      FROM life_metric_definitions lmd
      WHERE lmd.user_id = ${mainUser}
    `;
    
    for (const metric of userMetrics) {
      console.log(`   Recalculating snapshots for ${metric.name}...`);
      
      // Get current goals for this metric
      const goals = await sql`
        SELECT 
          gi.current_value,
          gi.target_value,
          gi.status
        FROM goal_instances gi
        JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
        JOIN life_metric_definitions lmd ON gd.life_metric_id = lmd.id
        WHERE gi.user_id = ${mainUser} AND lmd.name = ${metric.name}
      `;
      
      if (goals.length > 0) {
        let totalProgress = 0;
        let completedGoals = 0;
        
        goals.forEach(goal => {
          if (goal.status === 'completed') {
            completedGoals++;
            totalProgress += 100;
          } else if (goal.target_value > 0) {
            const progress = Math.round((goal.current_value / goal.target_value) * 100);
            totalProgress += Math.min(progress, 100);
          }
        });
        
        const averageProgress = Math.round(totalProgress / goals.length);
        
        // Update or create snapshot for today
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await sql`
          INSERT INTO progress_snapshots (id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date, created_at)
          VALUES (gen_random_uuid(), ${mainUser}, ${metric.name}, ${monthYear}, ${averageProgress}, ${completedGoals}, ${goals.length}, ${now}, ${now})
          ON CONFLICT (user_id, life_metric_name, month_year) 
          DO UPDATE SET 
            progress_percentage = ${averageProgress},
            goals_completed = ${completedGoals},
            total_goals = ${goals.length},
            snapshot_date = ${now}
        `;
        
        console.log(`     ✅ ${metric.name}: ${averageProgress}% progress, ${completedGoals}/${goals.length} completed`);
      }
    }

    console.log('\n✅ Goal data fix complete!');

  } catch (error) {
    console.error('❌ Error fixing goal data:', error);
  } finally {
    await sql.end();
  }
}

fixGoalData();
