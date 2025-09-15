#!/usr/bin/env node

/**
 * Simple debug script to check snapshot data in production database
 * Run with: node simple_debug.js
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

async function simpleDebug() {
  try {
    console.log('🔍 Simple debug of snapshot data...\n');

    // 1. Check if progressSnapshots table exists and has data
    console.log('1. Checking progressSnapshots table...');
    try {
      const snapshotCount = await sql`SELECT COUNT(*) as count FROM progress_snapshots`;
      console.log(`   Total snapshots in database: ${snapshotCount[0].count}`);
      
      if (snapshotCount[0].count > 0) {
        const sampleSnapshots = await sql`
          SELECT id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
          FROM progress_snapshots 
          ORDER BY snapshot_date DESC 
          LIMIT 5
        `;
        console.log('   Sample snapshots:');
        sampleSnapshots.forEach((snapshot, i) => {
          console.log(`   ${i + 1}. ${snapshot.life_metric_name} - ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying progress_snapshots:', error.message);
    }

    // 2. Check for specific user's snapshots
    console.log('\n2. Checking for user snapshots...');
    try {
      const userIds = await sql`SELECT DISTINCT user_id FROM progress_snapshots LIMIT 5`;
      console.log(`   Found ${userIds.length} unique users with snapshots`);
      
      if (userIds.length > 0) {
        const testUserId = userIds[0].user_id;
        console.log(`   Checking snapshots for user: ${testUserId}`);
        
        const userSnapshots = await sql`
          SELECT id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
          FROM progress_snapshots 
          WHERE user_id = ${testUserId}
          ORDER BY snapshot_date DESC
          LIMIT 10
        `;
        
        console.log(`   User has ${userSnapshots.length} snapshots`);
        
        if (userSnapshots.length > 0) {
          console.log('   Recent snapshots:');
          userSnapshots.forEach((snapshot, i) => {
            console.log(`   ${i + 1}. ${snapshot.life_metric_name} - ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
          });
        }
      }
    } catch (error) {
      console.log('   ❌ Error querying user snapshots:', error.message);
    }

    // 3. Check life metrics
    console.log('\n3. Checking life metrics...');
    try {
      const lifeMetrics = await sql`SELECT id, name, user_id FROM life_metric_definitions LIMIT 10`;
      console.log(`   Total life metrics: ${lifeMetrics.length}`);
      
      if (lifeMetrics.length > 0) {
        console.log('   Life metrics:');
        lifeMetrics.forEach((metric, i) => {
          console.log(`   ${i + 1}. ${metric.name} (${metric.id}) - User: ${metric.user_id}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying life_metric_definitions:', error.message);
    }

    // 4. Check goals
    console.log('\n4. Checking goals...');
    try {
      const goals = await sql`
        SELECT 
          gi.id as goal_instance_id,
          gi.user_id,
          gi.current_value,
          gi.target_value,
          gi.status,
          gd.title,
          gd.category
        FROM goal_instances gi
        JOIN goal_definitions gd ON gi.goal_definition_id = gd.id
        LIMIT 10
      `;
      
      console.log(`   Total goals: ${goals.length}`);
      
      if (goals.length > 0) {
        const goalsByUser = {};
        goals.forEach(goal => {
          if (!goalsByUser[goal.user_id]) {
            goalsByUser[goal.user_id] = [];
          }
          goalsByUser[goal.user_id].push({
            id: goal.goal_instance_id,
            title: goal.title,
            category: goal.category,
            progress: goal.current_value,
            target: goal.target_value,
            status: goal.status
          });
        });
        
        Object.keys(goalsByUser).forEach(userId => {
          console.log(`   User ${userId}: ${goalsByUser[userId].length} goals`);
          goalsByUser[userId].slice(0, 3).forEach(goal => {
            console.log(`     - ${goal.title} (${goal.category}) - ${goal.progress}/${goal.target} - ${goal.status}`);
          });
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying goals:', error.message);
    }

    // 5. Check for recent snapshot creation
    console.log('\n5. Checking recent snapshot activity...');
    try {
      const recentSnapshots = await sql`
        SELECT id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
        FROM progress_snapshots 
        WHERE snapshot_date >= NOW() - INTERVAL '7 days'
        ORDER BY snapshot_date DESC
        LIMIT 10
      `;
      
      console.log(`   Snapshots created in last 7 days: ${recentSnapshots.length}`);
      
      if (recentSnapshots.length > 0) {
        console.log('   Recent snapshots:');
        recentSnapshots.forEach((snapshot, i) => {
          console.log(`   ${i + 1}. ${snapshot.life_metric_name} - ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error querying recent snapshots:', error.message);
    }

    // 6. Check table structure
    console.log('\n6. Checking table structure...');
    try {
      const tableInfo = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'progress_snapshots'
        ORDER BY ordinal_position
      `;
      
      console.log('   progress_snapshots table columns:');
      tableInfo.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } catch (error) {
      console.log('   ❌ Error checking table structure:', error.message);
    }

    console.log('\n✅ Simple debug complete!');

  } catch (error) {
    console.error('❌ Error in simple debug:', error);
  } finally {
    await sql.end();
  }
}

simpleDebug();
