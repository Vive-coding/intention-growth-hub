#!/usr/bin/env node

/**
 * Check daily snapshots in database
 * Run with: node check_daily_snapshots.js
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

async function checkDailySnapshots() {
  try {
    console.log('📊 Checking daily snapshots in database...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    const testMetric = 'Career Growth 🚀';
    
    // Check all snapshots for Career Growth
    console.log('1. All snapshots for Career Growth 🚀:');
    const allSnapshots = await sql`
      SELECT 
        id,
        month_year,
        progress_percentage,
        goals_completed,
        total_goals,
        snapshot_date,
        created_at
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   Total snapshots: ${allSnapshots.length}`);
    allSnapshots.forEach((snapshot, i) => {
      const date = new Date(snapshot.snapshot_date);
      const dayOfMonth = date.getDate();
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      console.log(`   ${i + 1}. ${weekday} ${dayOfMonth} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // Check snapshots for current month
    console.log('\n2. Snapshots for current month (This Month query):');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const thisMonthSnapshots = await sql`
      SELECT 
        id,
        progress_percentage,
        goals_completed,
        total_goals,
        snapshot_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser} 
        AND life_metric_name = ${testMetric}
        AND snapshot_date >= ${startOfMonth}
        AND snapshot_date <= ${endOfMonth}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   This Month snapshots: ${thisMonthSnapshots.length}`);
    thisMonthSnapshots.forEach((snapshot, i) => {
      const date = new Date(snapshot.snapshot_date);
      const dayOfMonth = date.getDate();
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      console.log(`   ${i + 1}. ${weekday} ${dayOfMonth} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
    });

    // Test the chart data generation
    console.log('\n3. Testing chart data generation...');
    if (thisMonthSnapshots.length > 0) {
      const dailySnapshots = thisMonthSnapshots.map(s => ({
        date: new Date(s.snapshot_date),
        progress: s.progress_percentage,
        completions: s.goals_completed,
      })).sort((a,b) => a.date.getTime() - b.date.getTime());

      console.log(`   Daily snapshots for chart: ${dailySnapshots.length}`);
      
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
        progressValue: 57, // Current progress
        completionValue: 1, // Current completions
        isCurrent: true,
        isFuture: false,
        isHistorical: false,
      });
      
      console.log(`   Chart data points: ${chartData.length}`);
      chartData.forEach((point, i) => {
        console.log(`   ${i + 1}. ${point.period} - Progress: ${point.progressValue}%, Completions: ${point.completionValue} (${point.isCurrent ? 'current' : 'historical'})`);
      });
    }

    console.log('\n✅ Daily snapshots check complete!');

  } catch (error) {
    console.error('❌ Error checking daily snapshots:', error);
  } finally {
    await sql.end();
  }
}

checkDailySnapshots();
