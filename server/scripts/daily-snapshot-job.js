#!/usr/bin/env node

/**
 * Daily Snapshot Job
 * Creates daily progress snapshots for all active users
 * Run with: node server/scripts/daily-snapshot-job.js
 * 
 * This should be scheduled to run daily via:
 * - Cron job (Linux/Mac)
 * - GitHub Actions (if deployed on GitHub)
 * - Railway Cron (if using Railway)
 * - Vercel Cron (if using Vercel)
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
    console.log('📅 Starting daily snapshot job...\n');

    // Get all active users with their timezones
    const users = await sql`
      SELECT DISTINCT 
        u.id as user_id,
        u.timezone,
        lmd.name as life_metric_name
      FROM users u
      JOIN life_metric_definitions lmd ON lmd.user_id = u.id
      WHERE u.id IS NOT NULL
      ORDER BY u.id, lmd.name
    `;

    console.log(`Found ${users.length} user-metric combinations`);

    if (users.length === 0) {
      console.log('No users found, exiting...');
      return;
    }

    // Group by user for better organization
    const usersByMetric = {};
    users.forEach(user => {
      if (!usersByMetric[user.user_id]) {
        usersByMetric[user.user_id] = {
          timezone: user.timezone || 'UTC',
          metrics: []
        };
      }
      usersByMetric[user.user_id].metrics.push(user.life_metric_name);
    });

    const userIds = Object.keys(usersByMetric);
    console.log(`Processing ${userIds.length} users...\n`);

    let totalSnapshotsCreated = 0;
    let totalSnapshotsUpdated = 0;

    for (const userId of userIds) {
      const userData = usersByMetric[userId];
      console.log(`👤 Processing user ${userId} (${userData.metrics.length} metrics)`);

      for (const metricName of userData.metrics) {
        try {
          // Check if snapshot already exists for today
          const today = new Date();
          const userTimezone = userData.timezone || 'UTC';
          
          // Calculate start and end of day in user's timezone
          const userDate = new Date(today.toLocaleString("en-CA", { timeZone: userTimezone }));
          const startOfDay = new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate(), 0, 0, 0, 0);
          const endOfDay = new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate(), 23, 59, 59, 999);
          
          // Convert to UTC for database storage
          const startOfDayUTC = new Date(startOfDay.toLocaleString("en-CA", { timeZone: "UTC" }));
          const endOfDayUTC = new Date(endOfDay.toLocaleString("en-CA", { timeZone: "UTC" }));

          // Check if snapshot exists for today
          const existingSnapshot = await sql`
            SELECT id, progress_percentage, goals_completed, total_goals
            FROM progress_snapshots 
            WHERE user_id = ${userId}
              AND life_metric_name = ${metricName}
              AND snapshot_date >= ${startOfDayUTC}
              AND snapshot_date <= ${endOfDayUTC}
            LIMIT 1
          `;

          // Calculate current progress
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
            WHERE gi.user_id = ${userId} AND lmd.name = ${metricName}
          `;

          if (goals.length === 0) {
            console.log(`   ⚠️  ${metricName}: No goals found, skipping`);
            continue;
          }

          // Calculate progress
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
          const monthYear = `${userDate.getFullYear()}-${String(userDate.getMonth() + 1).padStart(2, '0')}`;

          if (existingSnapshot.length > 0) {
            // Update existing snapshot
            await sql`
              UPDATE progress_snapshots 
              SET 
                progress_percentage = ${averageProgress},
                goals_completed = ${completedGoals},
                total_goals = ${goals.length},
                month_year = ${monthYear},
                snapshot_date = ${new Date()}
              WHERE id = ${existingSnapshot[0].id}
            `;
            totalSnapshotsUpdated++;
            console.log(`   ✅ ${metricName}: Updated snapshot (${averageProgress}%, ${completedGoals}/${goals.length})`);
          } else {
            // Create new snapshot
            await sql`
              INSERT INTO progress_snapshots (
                id, user_id, life_metric_name, month_year, 
                progress_percentage, goals_completed, total_goals, 
                snapshot_date, created_at
              ) VALUES (
                gen_random_uuid(), ${userId}, ${metricName}, ${monthYear},
                ${averageProgress}, ${completedGoals}, ${goals.length},
                ${new Date()}, ${new Date()}
              )
            `;
            totalSnapshotsCreated++;
            console.log(`   ✅ ${metricName}: Created snapshot (${averageProgress}%, ${completedGoals}/${goals.length})`);
          }

        } catch (error) {
          console.error(`   ❌ ${metricName}: Error creating snapshot:`, error.message);
        }
      }
    }

    console.log(`\n📊 Daily snapshot job completed:`);
    console.log(`   Created: ${totalSnapshotsCreated} snapshots`);
    console.log(`   Updated: ${totalSnapshotsUpdated} snapshots`);
    console.log(`   Total processed: ${totalSnapshotsCreated + totalSnapshotsUpdated}`);

  } catch (error) {
    console.error('❌ Daily snapshot job failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createDailySnapshots();
