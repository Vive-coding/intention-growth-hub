#!/usr/bin/env node

/**
 * Create daily snapshots for the current month
 * Run with: node create_daily_snapshots.js
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

async function createDailySnapshots() {
  try {
    console.log('📅 Creating daily snapshots for current month...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    
    // Get all life metrics for this user
    const userMetrics = await sql`
      SELECT DISTINCT lmd.name
      FROM life_metric_definitions lmd
      WHERE lmd.user_id = ${mainUser}
    `;
    
    console.log(`Found ${userMetrics.length} life metrics: ${userMetrics.map(m => m.name).join(', ')}`);

    // Generate daily snapshots for the current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Start from the beginning of the current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    console.log(`Generating snapshots from ${startOfMonth.toDateString()} to ${endOfMonth.toDateString()}`);

    // For each day in the current month
    for (let day = 1; day <= endOfMonth.getDate(); day++) {
      const currentDate = new Date(currentYear, currentMonth, day);
      
      // Skip future dates
      if (currentDate > now) {
        continue;
      }
      
      console.log(`\n📅 Creating snapshots for ${currentDate.toDateString()}...`);
      
      // For each life metric
      for (const metric of userMetrics) {
        // Get goals for this metric
        const goals = await sql`
          SELECT 
            gi.current_value,
            gi.target_value,
            gi.status,
            gi.created_at,
            gi.completed_at
          FROM goal_instances gi
          JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
          JOIN life_metric_definitions lmd ON gd.life_metric_id = lmd.id
          WHERE gi.user_id = ${mainUser} AND lmd.name = ${metric.name}
        `;
        
        if (goals.length === 0) {
          continue;
        }
        
        // Calculate progress for this day
        // For historical days, we'll simulate some progress variation
        let totalProgress = 0;
        let completedGoals = 0;
        
        goals.forEach(goal => {
          // Check if goal was completed on or before this date
          if (goal.completed_at && new Date(goal.completed_at) <= currentDate) {
            completedGoals++;
            totalProgress += 100;
          } else if (goal.status === 'completed') {
            // If goal is completed but no completion date, assume it was completed recently
            if (day >= 15) { // Assume completed in second half of month
              completedGoals++;
              totalProgress += 100;
            } else {
              // Partial progress based on day of month
              const progress = Math.min(100, Math.round((day / 30) * 100));
              totalProgress += progress;
            }
          } else {
            // Active goal - simulate progress over time
            const goalCreated = new Date(goal.created_at);
            const daysSinceCreated = Math.max(0, Math.floor((currentDate - goalCreated) / (1000 * 60 * 60 * 24)));
            
            if (goal.target_value > 0) {
              // Simulate progress based on days since creation
              const baseProgress = Math.min(100, Math.round((daysSinceCreated / 30) * 100));
              const randomVariation = Math.floor(Math.random() * 20) - 10; // ±10% variation
              const progress = Math.max(0, Math.min(100, baseProgress + randomVariation));
              totalProgress += progress;
            }
          }
        });
        
        const averageProgress = goals.length > 0 ? Math.round(totalProgress / goals.length) : 0;
        
        // Check if snapshot already exists for this day
        const existingSnapshot = await sql`
          SELECT id FROM progress_snapshots 
          WHERE user_id = ${mainUser} 
            AND life_metric_name = ${metric.name}
            AND DATE(snapshot_date) = ${currentDate.toISOString().split('T')[0]}
        `;
        
        if (existingSnapshot.length > 0) {
          console.log(`   ${metric.name}: Snapshot already exists for ${currentDate.toDateString()}`);
          continue;
        }
        
        // Create snapshot for this day
        const monthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const snapshotDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0); // Noon
        
        await sql`
          INSERT INTO progress_snapshots (id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date, created_at)
          VALUES (gen_random_uuid(), ${mainUser}, ${metric.name}, ${monthYear}, ${averageProgress}, ${completedGoals}, ${goals.length}, ${snapshotDate}, ${now})
        `;
        
        console.log(`   ✅ ${metric.name}: ${averageProgress}% progress, ${completedGoals}/${goals.length} completed`);
      }
    }

    // Verify the snapshots were created
    console.log('\n📊 Verifying daily snapshots...');
    const dailySnapshots = await sql`
      SELECT 
        life_metric_name,
        DATE(snapshot_date) as snapshot_day,
        progress_percentage,
        goals_completed
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
        AND DATE(snapshot_date) >= ${startOfMonth.toISOString().split('T')[0]}
        AND DATE(snapshot_date) <= ${endOfMonth.toISOString().split('T')[0]}
      ORDER BY life_metric_name, snapshot_date
    `;
    
    console.log(`Created ${dailySnapshots.length} daily snapshots:`);
    const snapshotsByMetric = {};
    dailySnapshots.forEach(snapshot => {
      if (!snapshotsByMetric[snapshot.life_metric_name]) {
        snapshotsByMetric[snapshot.life_metric_name] = [];
      }
      snapshotsByMetric[snapshot.life_metric_name].push(snapshot);
    });
    
    Object.keys(snapshotsByMetric).forEach(metric => {
      const snapshots = snapshotsByMetric[metric];
      console.log(`\n   ${metric}: ${snapshots.length} daily snapshots`);
      snapshots.slice(0, 5).forEach(snapshot => {
        console.log(`     ${snapshot.snapshot_day}: ${snapshot.progress_percentage}% (${snapshot.goals_completed} completed)`);
      });
      if (snapshots.length > 5) {
        console.log(`     ... and ${snapshots.length - 5} more`);
      }
    });

    console.log('\n✅ Daily snapshots created successfully!');

  } catch (error) {
    console.error('❌ Error creating daily snapshots:', error);
  } finally {
    await sql.end();
  }
}

createDailySnapshots();
