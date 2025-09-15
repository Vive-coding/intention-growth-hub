#!/usr/bin/env node

/**
 * Targeted debug script to check specific user and metric
 * Run with: node targeted_debug.js
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

async function targetedDebug() {
  try {
    console.log('🎯 Targeted debug for specific user and metric...\n');

    // Get the main user from the snapshots
    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    const testMetric = 'Career Growth 🚀';
    
    console.log(`Testing with user: ${mainUser}`);
    console.log(`Testing with metric: ${testMetric}\n`);

    // 1. Check snapshots for this specific user and metric
    console.log('1. Checking snapshots for specific user and metric...');
    const userMetricSnapshots = await sql`
      SELECT id, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} AND life_metric_name = ${testMetric}
      ORDER BY snapshot_date DESC
    `;
    
    console.log(`   Found ${userMetricSnapshots.length} snapshots for ${testMetric}`);
    userMetricSnapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // 2. Check goals for this user and metric
    console.log('\n2. Checking goals for this user and metric...');
    const userGoals = await sql`
      SELECT 
        gi.id as goal_instance_id,
        gi.current_value,
        gi.target_value,
        gi.status,
        gd.title,
        gd.category,
        lmd.name as life_metric_name
      FROM goal_instances gi
      JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
      JOIN life_metric_definitions lmd ON gd.life_metric_id = lmd.id
      WHERE gi.user_id = ${mainUser} AND lmd.name = ${testMetric}
    `;
    
    console.log(`   Found ${userGoals.length} goals for ${testMetric}`);
    userGoals.forEach((goal, i) => {
      const progress = goal.target_value > 0 ? Math.round((goal.current_value / goal.target_value) * 100) : 0;
      console.log(`   ${i + 1}. ${goal.title} - ${progress}% (${goal.current_value}/${goal.target_value}) - ${goal.status}`);
    });

    // 3. Test the API query that the frontend would make
    console.log('\n3. Testing API query simulation...');
    
    // Simulate "This Month" query
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    console.log(`   Date range: ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);
    
    const thisMonthSnapshots = await sql`
      SELECT id, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric}
        AND snapshot_date >= ${startOfMonth}
        AND snapshot_date <= ${endOfMonth}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   This Month snapshots: ${thisMonthSnapshots.length}`);
    thisMonthSnapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // 4. Test "Last 3 Months" query
    console.log('\n4. Testing Last 3 Months query...');
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const last3MonthsSnapshots = await sql`
      SELECT id, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric}
        AND snapshot_date >= ${threeMonthsAgo}
        AND snapshot_date <= ${now}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   Last 3 Months snapshots: ${last3MonthsSnapshots.length}`);
    last3MonthsSnapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // 5. Check if there are any snapshots with different date formats
    console.log('\n5. Checking for date format issues...');
    const allSnapshots = await sql`
      SELECT DISTINCT 
        DATE_TRUNC('month', snapshot_date) as month_start,
        month_year,
        COUNT(*) as count
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} AND life_metric_name = ${testMetric}
      GROUP BY DATE_TRUNC('month', snapshot_date), month_year
      ORDER BY month_start DESC
    `;
    
    console.log(`   Month groupings:`);
    allSnapshots.forEach((group, i) => {
      console.log(`   ${i + 1}. ${group.month_start} (${group.month_year}) - ${group.count} snapshots`);
    });

    // 6. Check current progress calculation
    console.log('\n6. Calculating current progress manually...');
    if (userGoals.length > 0) {
      let totalProgress = 0;
      let completedGoals = 0;
      
      userGoals.forEach(goal => {
        if (goal.status === 'completed') {
          completedGoals++;
          totalProgress += 100;
        } else if (goal.target_value > 0) {
          const progress = Math.round((goal.current_value / goal.target_value) * 100);
          totalProgress += Math.min(progress, 100);
        }
      });
      
      const averageProgress = userGoals.length > 0 ? Math.round(totalProgress / userGoals.length) : 0;
      console.log(`   Total goals: ${userGoals.length}`);
      console.log(`   Completed goals: ${completedGoals}`);
      console.log(`   Average progress: ${averageProgress}%`);
    } else {
      console.log('   No goals found for this metric');
    }

    console.log('\n✅ Targeted debug complete!');

  } catch (error) {
    console.error('❌ Error in targeted debug:', error);
  } finally {
    await sql.end();
  }
}

targetedDebug();
