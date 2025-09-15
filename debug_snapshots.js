#!/usr/bin/env node

/**
 * Debug script to check snapshot data in production database
 * Run with: node debug_snapshots.js
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { eq, desc, gte, and } from 'drizzle-orm';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

// Import schema
import { progressSnapshots, lifeMetricDefinitions, goalInstances, goalDefinitions } from './shared/schema.ts';

async function debugSnapshots() {
  try {
    console.log('🔍 Debugging snapshot data in production database...\n');

    // 1. Check if progressSnapshots table exists and has data
    console.log('1. Checking progressSnapshots table...');
    const snapshotCount = await db.select().from(progressSnapshots);
    console.log(`   Total snapshots in database: ${snapshotCount.length}`);
    
    if (snapshotCount.length > 0) {
      console.log('   Sample snapshots:');
      snapshotCount.slice(0, 5).forEach((snapshot, i) => {
        console.log(`   ${i + 1}. ${snapshot.lifeMetricName} - ${snapshot.monthYear} - ${snapshot.progressPercentage}% - ${snapshot.snapshotDate}`);
      });
    }

    // 2. Check for specific user's snapshots
    console.log('\n2. Checking for user snapshots...');
    const userIds = [...new Set(snapshotCount.map(s => s.userId))];
    console.log(`   Found ${userIds.length} unique users with snapshots`);
    
    if (userIds.length > 0) {
      const testUserId = userIds[0];
      console.log(`   Checking snapshots for user: ${testUserId}`);
      
      const userSnapshots = await db
        .select()
        .from(progressSnapshots)
        .where(eq(progressSnapshots.userId, testUserId))
        .orderBy(desc(progressSnapshots.snapshotDate));
      
      console.log(`   User has ${userSnapshots.length} snapshots`);
      
      if (userSnapshots.length > 0) {
        console.log('   Recent snapshots:');
        userSnapshots.slice(0, 10).forEach((snapshot, i) => {
          console.log(`   ${i + 1}. ${snapshot.lifeMetricName} - ${snapshot.monthYear} - ${snapshot.progressPercentage}% - ${snapshot.snapshotDate}`);
        });
      }
    }

    // 3. Check life metrics
    console.log('\n3. Checking life metrics...');
    const lifeMetrics = await db.select().from(lifeMetricDefinitions);
    console.log(`   Total life metrics: ${lifeMetrics.length}`);
    
    if (lifeMetrics.length > 0) {
      console.log('   Life metrics:');
      lifeMetrics.forEach((metric, i) => {
        console.log(`   ${i + 1}. ${metric.name} (${metric.id}) - User: ${metric.userId}`);
      });
    }

    // 4. Check goals for snapshot correlation
    console.log('\n4. Checking goals...');
    const goals = await db
      .select({
        goalInstance: goalInstances,
        goalDefinition: goalDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id));
    
    console.log(`   Total goals: ${goals.length}`);
    
    if (goals.length > 0) {
      const goalsByUser = {};
      goals.forEach(({ goalInstance, goalDefinition }) => {
        if (!goalsByUser[goalInstance.userId]) {
          goalsByUser[goalInstance.userId] = [];
        }
        goalsByUser[goalInstance.userId].push({
          id: goalInstance.id,
          title: goalDefinition.title,
          category: goalDefinition.category,
          progress: goalInstance.currentValue,
          target: goalInstance.targetValue,
          status: goalInstance.status
        });
      });
      
      Object.keys(goalsByUser).forEach(userId => {
        console.log(`   User ${userId}: ${goalsByUser[userId].length} goals`);
        goalsByUser[userId].slice(0, 3).forEach(goal => {
          console.log(`     - ${goal.title} (${goal.category}) - ${goal.progress}/${goal.target} - ${goal.status}`);
        });
      });
    }

    // 5. Check for recent snapshot creation
    console.log('\n5. Checking recent snapshot activity...');
    const recentSnapshots = await db
      .select()
      .from(progressSnapshots)
      .where(gte(progressSnapshots.snapshotDate, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // Last 7 days
      .orderBy(desc(progressSnapshots.snapshotDate));
    
    console.log(`   Snapshots created in last 7 days: ${recentSnapshots.length}`);
    
    if (recentSnapshots.length > 0) {
      console.log('   Recent snapshots:');
      recentSnapshots.forEach((snapshot, i) => {
        console.log(`   ${i + 1}. ${snapshot.lifeMetricName} - ${snapshot.monthYear} - ${snapshot.progressPercentage}% - ${snapshot.snapshotDate}`);
      });
    }

    // 6. Check for specific metric snapshots
    console.log('\n6. Checking for specific metric snapshots...');
    if (lifeMetrics.length > 0) {
      const testMetric = lifeMetrics[0];
      console.log(`   Checking snapshots for metric: ${testMetric.name}`);
      
      const metricSnapshots = await db
        .select()
        .from(progressSnapshots)
        .where(and(
          eq(progressSnapshots.lifeMetricName, testMetric.name),
          eq(progressSnapshots.userId, testMetric.userId)
        ))
        .orderBy(desc(progressSnapshots.snapshotDate));
      
      console.log(`   Found ${metricSnapshots.length} snapshots for ${testMetric.name}`);
      
      if (metricSnapshots.length > 0) {
        console.log('   Snapshots:');
        metricSnapshots.forEach((snapshot, i) => {
          console.log(`   ${i + 1}. ${snapshot.monthYear} - ${snapshot.progressPercentage}% - ${snapshot.snapshotDate}`);
        });
      }
    }

    console.log('\n✅ Debug complete!');

  } catch (error) {
    console.error('❌ Error debugging snapshots:', error);
  } finally {
    await sql.end();
  }
}

// Functions already imported at the top

debugSnapshots();
