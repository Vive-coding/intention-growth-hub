#!/usr/bin/env node

/**
 * Test the actual API endpoints
 * Run with: node test_api.js
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

async function testAPI() {
  try {
    console.log('🧪 Testing API endpoints...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    const testMetric = 'Career Growth 🚀';
    
    // Simulate the exact API call that the frontend makes
    console.log('1. Testing progress-snapshots API simulation...');
    
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    console.log(`   Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // This is the exact query from the API
    const snapshots = await sql`
      SELECT id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric}
        AND snapshot_date >= ${startDate}
        AND snapshot_date <= ${endDate}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   API would return ${snapshots.length} snapshots:`);
    snapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // Test the useMetricProgress hook logic
    console.log('\n2. Testing useMetricProgress hook logic...');
    
    if (snapshots.length === 0) {
      console.log('   No snapshots found, would trigger lazy upsert...');
      
      // Simulate lazy upsert
      const currentProgress = await sql`
        SELECT 
          lmd.name,
          COUNT(gi.id) as total_goals,
          COUNT(CASE WHEN gi.status = 'completed' THEN 1 END) as completed_goals,
          COALESCE(AVG(
            CASE 
              WHEN gi.status = 'completed' THEN 100
              WHEN gi.target_value > 0 THEN LEAST(ROUND((gi.current_value::float / gi.target_value) * 100), 100)
              ELSE 0
            END
          ), 0) as progress
        FROM life_metric_definitions lmd
        LEFT JOIN goal_definitions gd ON lmd.id = gd.life_metric_id
        LEFT JOIN goal_instances gi ON gd.id = gi.goal_definition_id AND gi.user_id = ${mainUser}
        WHERE lmd.user_id = ${mainUser} AND lmd.name = ${testMetric}
        GROUP BY lmd.id, lmd.name
      `;
      
      console.log('   Current progress calculation:', currentProgress[0]);
    } else {
      console.log('   Snapshots found, using snapshot data');
      const latest = snapshots[snapshots.length - 1];
      console.log(`   Latest snapshot: ${latest.progress_percentage}% progress, ${latest.goals_completed} completed, ${latest.total_goals} total`);
    }

    // Test the chart data generation
    console.log('\n3. Testing chart data generation...');
    
    if (snapshots.length > 0) {
      // This simulates the getGraphData function for "This Month"
      const dailySnapshots = snapshots.map(s => ({
        date: new Date(s.snapshot_date),
        progress: s.progress_percentage,
        completions: s.goals_completed,
      })).sort((a,b) => a.date.getTime() - b.date.getTime());

      console.log(`   Daily snapshots for chart: ${dailySnapshots.length}`);
      dailySnapshots.forEach((snapshot, i) => {
        const dayOfMonth = snapshot.date.getDate();
        const weekday = snapshot.date.toLocaleDateString('en-US', { weekday: 'short' });
        const label = `${weekday} ${dayOfMonth}`;
        console.log(`   ${i + 1}. ${label} - Progress: ${snapshot.progress}%, Completions: ${snapshot.completions}`);
      });

      // Generate chart data
      const chartData = [];
      const today = new Date();
      const todayDateStr = today.toISOString().split('T')[0];
      
      dailySnapshots.forEach((snapshot, index) => {
        const date = snapshot.date;
        const snapshotDateStr = date.toISOString().split('T')[0];
        
        if (snapshotDateStr !== todayDateStr) {
          const dayOfMonth = date.getDate();
          const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
          const label = `${weekday} ${dayOfMonth}`;
          
          chartData.push({
            period: label,
            progressValue: snapshot.progress,
            completionValue: snapshot.completions,
            isCurrent: false,
            isFuture: false,
            isHistorical: true,
          });
        }
      });
      
      console.log(`   Chart data points: ${chartData.length}`);
      chartData.forEach((point, i) => {
        console.log(`   ${i + 1}. ${point.period} - Progress: ${point.progressValue}%, Completions: ${point.completionValue}`);
      });
    }

    // Check for data quality issues
    console.log('\n4. Checking data quality issues...');
    
    const problematicGoals = await sql`
      SELECT 
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
        AND lmd.name = ${testMetric}
        AND (
          gi.current_value < 0 
          OR (gi.target_value > 0 AND gi.current_value > gi.target_value * 10)
          OR (gi.target_value > 0 AND gi.current_value::float / gi.target_value > 10)
        )
    `;
    
    if (problematicGoals.length > 0) {
      console.log(`   Found ${problematicGoals.length} goals with problematic values:`);
      problematicGoals.forEach((goal, i) => {
        console.log(`   ${i + 1}. ${goal.title} - ${goal.current_value}/${goal.target_value} = ${goal.calculated_progress}%`);
      });
    } else {
      console.log('   No problematic goal values found');
    }

    console.log('\n✅ API test complete!');

  } catch (error) {
    console.error('❌ Error in API test:', error);
  } finally {
    await sql.end();
  }
}

testAPI();
