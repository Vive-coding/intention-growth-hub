#!/usr/bin/env node

import postgres from 'postgres';

// Production database connection
const connectionString = 'postgresql://postgres:BCYEsXsTtaKvMpILMgnlECssCtVkJbWw@metro.proxy.rlwy.net:26112/railway';
const sql = postgres(connectionString);

async function debugLast3Months() {
  try {
    console.log('🔍 Debugging "Last 3 Months" period filtering...\n');

    // 1. Get vivek's user ID
    const vivekUser = await sql`
      SELECT id FROM users WHERE email = 'vivek.rok@gmail.com'
    `;
    
    if (vivekUser.length === 0) {
      console.log('❌ vivek.rok@gmail.com not found');
      return;
    }
    
    const vivekUserId = vivekUser[0].id;
    console.log(`✅ Found user: ${vivekUserId.substring(0, 8)}...`);

    // 2. Simulate the backend "Last 3 Months" date calculation
    console.log('\n📅 Simulating backend "Last 3 Months" date range calculation:');
    
    let endDate = new Date();
    let startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
    
    console.log(`   End Date: ${endDate.toISOString()}`);
    console.log(`   Start Date: ${startDate.toISOString()}`);
    console.log(`   Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`   Expected months: ${startDate.getMonth() + 1}-${startDate.getFullYear()} to ${endDate.getMonth() + 1}-${endDate.getFullYear()}`);

    // 3. Check what snapshots exist in that date range
    console.log('\n🔍 Career Growth snapshots in calculated date range:');
    const snapshots = await sql`
      SELECT progress_percentage, goals_completed, total_goals, 
             snapshot_date, created_at,
             TO_CHAR(snapshot_date, 'YYYY-MM-DD') as date_string,
             TO_CHAR(snapshot_date, 'Mon YYYY') as month_year
      FROM progress_snapshots 
      WHERE user_id = ${vivekUserId}
        AND life_metric_name = 'Career Growth 🚀'
        AND snapshot_date >= ${startDate.toISOString()}
        AND snapshot_date <= ${endDate.toISOString()}
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   Query returned ${snapshots.length} snapshots:`);
    snapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.date_string} (${snapshot.month_year}) - ${snapshot.progress_percentage}% (${snapshot.goals_completed}/${snapshot.total_goals})`);
    });

    // 4. Check ALL Career Growth snapshots to see what we're missing
    console.log('\n📊 ALL Career Growth snapshots (for comparison):');
    const allSnapshots = await sql`
      SELECT progress_percentage, goals_completed, total_goals, 
             snapshot_date, created_at,
             TO_CHAR(snapshot_date, 'YYYY-MM-DD') as date_string,
             TO_CHAR(snapshot_date, 'Mon YYYY') as month_year
      FROM progress_snapshots 
      WHERE user_id = ${vivekUserId}
        AND life_metric_name = 'Career Growth 🚀'
      ORDER BY snapshot_date ASC
    `;
    
    console.log(`   Found ${allSnapshots.length} total snapshots:`);
    allSnapshots.forEach((snapshot, i) => {
      const snapshotDate = new Date(snapshot.snapshot_date);
      const isInRange = snapshotDate >= startDate && snapshotDate <= endDate;
      const status = isInRange ? '✅ INCLUDED' : '❌ FILTERED OUT';
      console.log(`   ${i + 1}. ${snapshot.date_string} (${snapshot.month_year}) - ${snapshot.progress_percentage}% ${status}`);
    });

    // 5. Check if there are August snapshots that should be included
    console.log('\n🔍 August 2025 snapshots specifically:');
    const augustSnapshots = await sql`
      SELECT progress_percentage, goals_completed, total_goals, 
             snapshot_date, created_at,
             TO_CHAR(snapshot_date, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
      FROM progress_snapshots 
      WHERE user_id = ${vivekUserId}
        AND life_metric_name = 'Career Growth 🚀'
        AND snapshot_date >= '2025-08-01'
        AND snapshot_date < '2025-09-01'
      ORDER BY snapshot_date ASC
    `;
    
    if (augustSnapshots.length === 0) {
      console.log('   No August snapshots found for Career Growth');
    } else {
      console.log(`   Found ${augustSnapshots.length} August snapshots:`);
      augustSnapshots.forEach((snapshot, i) => {
        const augustDate = new Date(snapshot.snapshot_date);
        const shouldBeIncluded = augustDate >= startDate;
        console.log(`   ${i + 1}. ${snapshot.formatted_date} - ${snapshot.progress_percentage}%`);
        console.log(`       Should be included in Last 3 Months: ${shouldBeIncluded}`);
        console.log(`       Reason: ${augustDate.toISOString()} >= ${startDate.toISOString()}`);
      });
    }

    // 6. Check date calculation issue
    console.log('\n🔍 Date calculation analysis:');
    const now = new Date();
    console.log(`   Current date: ${now.toISOString()}`);
    console.log(`   Current month: ${now.getMonth() + 1} (${now.getMonth() + 1}/12)`);
    console.log(`   3 months ago: ${now.getMonth() - 2} (${(now.getMonth() - 2 + 12) % 12 + 1}/12)`);
    
    // Correct calculation
    const correctStartDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    console.log(`   Backend calculation: ${startDate.toISOString()}`);
    console.log(`   Should start from month: ${correctStartDate.getMonth() + 1}`);

    console.log('\n✅ Last 3 Months debugging completed!');

  } catch (error) {
    console.error('❌ Error debugging Last 3 Months:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
  } finally {
    await sql.end();
  }
}

debugLast3Months();

