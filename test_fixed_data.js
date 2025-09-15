#!/usr/bin/env node

/**
 * Test the API with fixed data
 * Run with: node test_fixed_data.js
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

async function testFixedData() {
  try {
    console.log('🧪 Testing API with fixed data...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    const testMetric = 'Career Growth 🚀';
    
    // Check the fixed goals
    console.log('1. Checking fixed goals...');
    const fixedGoals = await sql`
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
      WHERE gi.user_id = ${mainUser} AND lmd.name = ${testMetric}
    `;
    
    console.log(`   Found ${fixedGoals.length} goals for ${testMetric}:`);
    fixedGoals.forEach((goal, i) => {
      console.log(`   ${i + 1}. ${goal.title} - ${goal.current_value}/${goal.target_value} = ${goal.calculated_progress}% (${goal.status})`);
    });

    // Calculate current progress
    console.log('\n2. Calculating current progress...');
    let totalProgress = 0;
    let completedGoals = 0;
    
    fixedGoals.forEach(goal => {
      if (goal.status === 'completed') {
        completedGoals++;
        totalProgress += 100;
      } else if (goal.target_value > 0) {
        const progress = Math.round((goal.current_value / goal.target_value) * 100);
        totalProgress += Math.min(progress, 100);
      }
    });
    
    const averageProgress = fixedGoals.length > 0 ? Math.round(totalProgress / fixedGoals.length) : 0;
    console.log(`   Total goals: ${fixedGoals.length}`);
    console.log(`   Completed goals: ${completedGoals}`);
    console.log(`   Average progress: ${averageProgress}%`);

    // Create a new snapshot with the fixed data
    console.log('\n3. Creating new snapshot with fixed data...');
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Delete existing snapshots for this month to avoid conflicts
    await sql`
      DELETE FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric} 
        AND month_year = ${monthYear}
    `;
    
    // Insert new snapshot
    await sql`
      INSERT INTO progress_snapshots (id, user_id, life_metric_name, month_year, progress_percentage, goals_completed, total_goals, snapshot_date, created_at)
      VALUES (gen_random_uuid(), ${mainUser}, ${testMetric}, ${monthYear}, ${averageProgress}, ${completedGoals}, ${fixedGoals.length}, ${now}, ${now})
    `;
    
    console.log(`   ✅ Created snapshot: ${averageProgress}% progress, ${completedGoals}/${fixedGoals.length} completed`);

    // Test the API query again
    console.log('\n4. Testing API query with fixed data...');
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    const snapshots = await sql`
      SELECT id, month_year, progress_percentage, goals_completed, total_goals, snapshot_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric}
        AND snapshot_date >= ${startDate}
        AND snapshot_date <= ${endDate}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   API returns ${snapshots.length} snapshots:`);
    snapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // Test chart data generation
    console.log('\n5. Testing chart data generation...');
    if (snapshots.length > 0) {
      const dailySnapshots = snapshots.map(s => ({
        date: new Date(s.snapshot_date),
        progress: s.progress_percentage,
        completions: s.goals_completed,
      })).sort((a,b) => a.date.getTime() - b.date.getTime());

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
      
      // Add today's live value
      const todayDayOfMonth = today.getDate();
      const todayWeekday = today.toLocaleDateString('en-US', { weekday: 'short' });
      const todayLabel = `${todayWeekday} ${todayDayOfMonth}`;
      
      chartData.push({
        period: todayLabel,
        progressValue: averageProgress,
        completionValue: completedGoals,
        isCurrent: true,
        isFuture: false,
        isHistorical: false,
      });
      
      console.log(`   Chart data points: ${chartData.length}`);
      chartData.forEach((point, i) => {
        console.log(`   ${i + 1}. ${point.period} - Progress: ${point.progressValue}%, Completions: ${point.completionValue} (${point.isCurrent ? 'current' : 'historical'})`);
      });
    }

    console.log('\n✅ Fixed data test complete!');

  } catch (error) {
    console.error('❌ Error testing fixed data:', error);
  } finally {
    await sql.end();
  }
}

testFixedData();
