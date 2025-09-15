#!/usr/bin/env node

/**
 * Fix goals with 400% progress
 * Run with: node fix_400_percent_goals.js
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

async function fix400PercentGoals() {
  try {
    console.log('🔧 Fixing goals with 400% progress...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    
    // Find goals with 400% progress
    console.log('1. Finding goals with 400% progress...');
    const goals400 = await sql`
      SELECT 
        gi.id,
        gd.title,
        gi.current_value,
        gi.target_value,
        gi.status,
        lmd.name as metric_name
      FROM goal_instances gi
      JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
      JOIN life_metric_definitions lmd ON gd.life_metric_id = lmd.id
      WHERE gi.user_id = ${mainUser} 
        AND gi.target_value = 1 
        AND gi.current_value = 4
    `;
    
    console.log(`   Found ${goals400.length} goals with 400% progress:`);
    goals400.forEach((goal, i) => {
      console.log(`   ${i + 1}. [${goal.metric_name}] ${goal.title} - ${goal.current_value}/${goal.target_value} = 400%`);
    });

    if (goals400.length === 0) {
      console.log('   No 400% goals found!');
      return;
    }

    // Fix each goal
    console.log('\n2. Fixing 400% progress goals...');
    for (const goal of goals400) {
      // Set target to 4 to make it 100% progress
      const newTargetValue = 4;
      const newCurrentValue = 4;
      
      await sql`
        UPDATE goal_instances 
        SET current_value = ${newCurrentValue}, target_value = ${newTargetValue}
        WHERE id = ${goal.id}
      `;
      
      console.log(`   ✅ Updated ${goal.title}: ${newCurrentValue}/${newTargetValue} = 100%`);
    }

    // Recalculate snapshots for all metrics
    console.log('\n3. Recalculating snapshots for all metrics...');
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
        
        // Delete existing snapshot for this month
        await sql`
          DELETE FROM progress_snapshots 
          WHERE user_id = ${mainUser} 
            AND life_metric_name = ${metric.name} 
            AND month_year = ${monthYear}
        `;
        
        // Insert new snapshot
        await sql`
          INSERT INTO progress_snapshots (id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date, created_at)
          VALUES (gen_random_uuid(), ${mainUser}, ${metric.name}, ${monthYear}, ${averageProgress}, ${completedGoals}, ${goals.length}, ${now}, ${now})
        `;
        
        console.log(`     ✅ ${metric.name}: ${averageProgress}% progress, ${completedGoals}/${goals.length} completed`);
      }
    }

    console.log('\n✅ All 400% goals fixed and snapshots recalculated!');

  } catch (error) {
    console.error('❌ Error fixing 400% goals:', error);
  } finally {
    await sql.end();
  }
}

fix400PercentGoals();
