#!/usr/bin/env node

/**
 * Test script to verify snapshot creation process
 * Run with: node test_snapshot_creation.js
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

// Import schema
const { 
  progressSnapshots, 
  lifeMetricDefinitions, 
  goalInstances, 
  goalDefinitions,
  users 
} = require('./shared/schema');

const { eq, and, gte, lte, desc } = require('drizzle-orm');

async function testSnapshotCreation() {
  try {
    console.log('🧪 Testing snapshot creation process...\n');

    // 1. Find a test user
    console.log('1. Finding test user...');
    const testUsers = await db.select().from(users).limit(5);
    console.log(`   Found ${testUsers.length} users`);
    
    if (testUsers.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const testUser = testUsers[0];
    console.log(`   Using user: ${testUser.id} (${testUser.email || 'no email'})`);

    // 2. Get user's life metrics
    console.log('\n2. Getting user life metrics...');
    const userMetrics = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, testUser.id));
    
    console.log(`   Found ${userMetrics.length} life metrics`);
    userMetrics.forEach((metric, i) => {
      console.log(`   ${i + 1}. ${metric.name} (${metric.id})`);
    });

    if (userMetrics.length === 0) {
      console.log('❌ No life metrics found for user');
      return;
    }

    const testMetric = userMetrics[0];
    console.log(`   Testing with metric: ${testMetric.name}`);

    // 3. Get user's goals for this metric
    console.log('\n3. Getting user goals...');
    const userGoals = await db
      .select({
        goalInstance: goalInstances,
        goalDefinition: goalDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .innerJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
      .where(and(
        eq(goalInstances.userId, testUser.id),
        eq(lifeMetricDefinitions.id, testMetric.id)
      ));
    
    console.log(`   Found ${userGoals.length} goals for ${testMetric.name}`);
    userGoals.forEach(({ goalInstance, goalDefinition }, i) => {
      const progress = goalInstance.targetValue > 0 
        ? Math.round((goalInstance.currentValue / goalInstance.targetValue) * 100)
        : 0;
      console.log(`   ${i + 1}. ${goalDefinition.title} - ${progress}% (${goalInstance.currentValue}/${goalInstance.targetValue})`);
    });

    // 4. Check existing snapshots
    console.log('\n4. Checking existing snapshots...');
    const existingSnapshots = await db
      .select()
      .from(progressSnapshots)
      .where(and(
        eq(progressSnapshots.userId, testUser.id),
        eq(progressSnapshots.lifeMetricName, testMetric.name)
      ))
      .orderBy(desc(progressSnapshots.snapshotDate));
    
    console.log(`   Found ${existingSnapshots.length} existing snapshots`);
    if (existingSnapshots.length > 0) {
      console.log('   Recent snapshots:');
      existingSnapshots.slice(0, 5).forEach((snapshot, i) => {
        console.log(`   ${i + 1}. ${snapshot.monthYear} - ${snapshot.progressPercentage}% - ${snapshot.snapshotDate}`);
      });
    }

    // 5. Calculate current progress manually
    console.log('\n5. Calculating current progress manually...');
    let totalProgress = 0;
    let completedGoals = 0;
    let totalGoals = userGoals.length;
    
    userGoals.forEach(({ goalInstance }) => {
      if (goalInstance.status === 'completed') {
        completedGoals++;
        totalProgress += 100;
      } else if (goalInstance.targetValue > 0) {
        const progress = Math.round((goalInstance.currentValue / goalInstance.targetValue) * 100);
        totalProgress += Math.min(progress, 100);
      }
    });
    
    const averageProgress = totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0;
    console.log(`   Total goals: ${totalGoals}`);
    console.log(`   Completed goals: ${completedGoals}`);
    console.log(`   Average progress: ${averageProgress}%`);

    // 6. Test snapshot creation
    console.log('\n6. Testing snapshot creation...');
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const snapshotData = {
      userId: testUser.id,
      lifeMetricName: testMetric.name,
      monthYear,
      progressPercentage: averageProgress,
      goalsCompleted: completedGoals,
      totalGoals,
      snapshotDate: now
    };
    
    console.log('   Snapshot data:', snapshotData);
    
    try {
      const [newSnapshot] = await db
        .insert(progressSnapshots)
        .values(snapshotData)
        .returning();
      
      console.log('✅ Snapshot created successfully:', newSnapshot);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        console.log('⚠️ Snapshot already exists for this month, updating...');
        
        const [updatedSnapshot] = await db
          .update(progressSnapshots)
          .set({
            progressPercentage: averageProgress,
            goalsCompleted: completedGoals,
            totalGoals,
            snapshotDate: now
          })
          .where(and(
            eq(progressSnapshots.userId, testUser.id),
            eq(progressSnapshots.lifeMetricName, testMetric.name),
            eq(progressSnapshots.monthYear, monthYear)
          ))
          .returning();
        
        console.log('✅ Snapshot updated successfully:', updatedSnapshot);
      } else {
        throw error;
      }
    }

    // 7. Verify snapshot was created/updated
    console.log('\n7. Verifying snapshot...');
    const updatedSnapshots = await db
      .select()
      .from(progressSnapshots)
      .where(and(
        eq(progressSnapshots.userId, testUser.id),
        eq(progressSnapshots.lifeMetricName, testMetric.name)
      ))
      .orderBy(desc(progressSnapshots.snapshotDate));
    
    console.log(`   Total snapshots after test: ${updatedSnapshots.length}`);
    if (updatedSnapshots.length > 0) {
      const latest = updatedSnapshots[0];
      console.log(`   Latest snapshot: ${latest.monthYear} - ${latest.progressPercentage}% - ${latest.snapshotDate}`);
    }

    // 8. Test snapshot retrieval with date range
    console.log('\n8. Testing snapshot retrieval with date range...');
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const rangeSnapshots = await db
      .select()
      .from(progressSnapshots)
      .where(and(
        eq(progressSnapshots.userId, testUser.id),
        eq(progressSnapshots.lifeMetricName, testMetric.name),
        gte(progressSnapshots.snapshotDate, startDate),
        lte(progressSnapshots.snapshotDate, endDate)
      ))
      .orderBy(desc(progressSnapshots.snapshotDate));
    
    console.log(`   Snapshots in current month: ${rangeSnapshots.length}`);
    rangeSnapshots.forEach((snapshot, i) => {
      console.log(`   ${i + 1}. ${snapshot.monthYear} - ${snapshot.progressPercentage}% - ${snapshot.snapshotDate}`);
    });

    console.log('\n✅ Snapshot creation test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing snapshot creation:', error);
  } finally {
    await sql.end();
  }
}

testSnapshotCreation();
