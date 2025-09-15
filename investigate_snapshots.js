#!/usr/bin/env node

/**
 * Investigate why there are only 1 snapshot per metric
 * Run with: node investigate_snapshots.js
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

async function investigateSnapshots() {
  try {
    console.log('🔍 Investigating snapshot creation patterns...\n');

    const mainUser = '2703277e-97db-4096-bd30-6798dd0470d9';
    
    // 1. Check all snapshots for this user
    console.log('1. Checking all snapshots for user...');
    const allSnapshots = await sql`
      SELECT 
        life_metric_name,
        month_year,
        progress_percentage,
        goals_completed,
        total_goals,
        snapshot_date,
        created_at
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
      ORDER BY life_metric_name, snapshot_date DESC
    `;
    
    console.log(`   Total snapshots: ${allSnapshots.length}`);
    
    // Group by metric
    const snapshotsByMetric = {};
    allSnapshots.forEach(snapshot => {
      if (!snapshotsByMetric[snapshot.life_metric_name]) {
        snapshotsByMetric[snapshot.life_metric_name] = [];
      }
      snapshotsByMetric[snapshot.life_metric_name].push(snapshot);
    });
    
    Object.keys(snapshotsByMetric).forEach(metric => {
      const snapshots = snapshotsByMetric[metric];
      console.log(`\n   ${metric}: ${snapshots.length} snapshots`);
      snapshots.forEach((snapshot, i) => {
        console.log(`     ${i + 1}. ${snapshot.month_year} - ${snapshot.progress_percentage}% - ${snapshot.snapshot_date}`);
      });
    });

    // 2. Check when snapshots were created
    console.log('\n2. Checking snapshot creation dates...');
    const creationDates = await sql`
      SELECT 
        DATE(created_at) as creation_date,
        COUNT(*) as snapshot_count
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
      GROUP BY DATE(created_at)
      ORDER BY creation_date DESC
    `;
    
    console.log('   Snapshots created by date:');
    creationDates.forEach(date => {
      console.log(`     ${date.creation_date}: ${date.snapshot_count} snapshots`);
    });

    // 3. Check if there are any snapshots from previous days
    console.log('\n3. Checking for historical snapshots...');
    const historicalSnapshots = await sql`
      SELECT 
        life_metric_name,
        snapshot_date,
        progress_percentage
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
        AND snapshot_date < CURRENT_DATE
      ORDER BY snapshot_date DESC
    `;
    
    console.log(`   Historical snapshots (before today): ${historicalSnapshots.length}`);
    historicalSnapshots.forEach(snapshot => {
      console.log(`     ${snapshot.life_metric_name} - ${snapshot.snapshot_date} - ${snapshot.progress_percentage}%`);
    });

    // 4. Check if snapshots are being created daily
    console.log('\n4. Checking daily snapshot creation...');
    
    // Check if there are snapshots for the last 7 days
    const last7Days = await sql`
      SELECT 
        DATE(snapshot_date) as snapshot_day,
        COUNT(*) as snapshot_count
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
        AND snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(snapshot_date)
      ORDER BY snapshot_day DESC
    `;
    
    console.log('   Snapshots in last 7 days:');
    last7Days.forEach(day => {
      console.log(`     ${day.snapshot_day}: ${day.snapshot_count} snapshots`);
    });

    // 5. Check the snapshot creation triggers
    console.log('\n5. Checking snapshot creation patterns...');
    
    // Look at the month_year field to see if snapshots are being grouped by month
    const monthYearGroups = await sql`
      SELECT 
        month_year,
        COUNT(*) as snapshot_count,
        MIN(snapshot_date) as earliest_date,
        MAX(snapshot_date) as latest_date
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
      GROUP BY month_year
      ORDER BY month_year DESC
    `;
    
    console.log('   Snapshots grouped by month_year:');
    monthYearGroups.forEach(group => {
      console.log(`     ${group.month_year}: ${group.snapshot_count} snapshots (${group.earliest_date} to ${group.latest_date})`);
    });

    // 6. Check if there's a unique constraint preventing multiple snapshots per day
    console.log('\n6. Checking for unique constraints...');
    const constraints = await sql`
      SELECT 
        constraint_name,
        constraint_type,
        column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'progress_snapshots'
    `;
    
    console.log('   Constraints on progress_snapshots table:');
    constraints.forEach(constraint => {
      console.log(`     ${constraint.constraint_name} (${constraint.constraint_type}) on ${constraint.column_name}`);
    });

    // 7. Check if snapshots are being created by the upsertTodayProgressSnapshot function
    console.log('\n7. Checking snapshot creation logic...');
    
    // Look at the created_at vs snapshot_date to see if they're the same
    const snapshotTiming = await sql`
      SELECT 
        life_metric_name,
        snapshot_date,
        created_at,
        EXTRACT(EPOCH FROM (created_at - snapshot_date)) as time_diff_seconds
      FROM progress_snapshots 
      WHERE user_id = ${mainUser}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.log('   Recent snapshot timing:');
    snapshotTiming.forEach(snapshot => {
      console.log(`     ${snapshot.life_metric_name}: snapshot_date=${snapshot.snapshot_date}, created_at=${snapshot.created_at}, diff=${snapshot.time_diff_seconds}s`);
    });

    console.log('\n✅ Snapshot investigation complete!');

  } catch (error) {
    console.error('❌ Error investigating snapshots:', error);
  } finally {
    await sql.end();
  }
}

investigateSnapshots();
