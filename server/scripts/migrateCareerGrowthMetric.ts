/**
 * Migration script to consolidate "Career Growth" (without emoji) into "Career Growth 🚀"
 * This ensures all goals link to the emoji version and prevents duplicate metrics
 */

import { db } from "../db";
import { lifeMetricDefinitions, goalDefinitions } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function migrateCareerGrowthMetric() {
  console.log("🔄 Starting Career Growth metric migration...");

  try {
    // Find all users who have both "Career Growth" and "Career Growth 🚀"
    const allMetrics = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(
        and(
          eq(lifeMetricDefinitions.isActive, true)
        )
      );

    // Group by userId
    const metricsByUser = new Map<string, typeof allMetrics>();
    for (const metric of allMetrics) {
      if (!metricsByUser.has(metric.userId)) {
        metricsByUser.set(metric.userId, []);
      }
      metricsByUser.get(metric.userId)!.push(metric);
    }

    let totalMigrated = 0;
    let totalDeleted = 0;

    for (const [userId, metrics] of metricsByUser.entries()) {
      const careerGrowthPlain = metrics.find(m => m.name === "Career Growth" && !m.name.includes("🚀"));
      const careerGrowthEmoji = metrics.find(m => m.name === "Career Growth 🚀");

      if (!careerGrowthPlain) {
        continue; // No plain version for this user
      }

      if (!careerGrowthEmoji) {
        // No emoji version exists, rename the plain one
        console.log(`📝 Renaming "Career Growth" to "Career Growth 🚀" for user ${userId}`);
        await db
          .update(lifeMetricDefinitions)
          .set({ name: "Career Growth 🚀" })
          .where(eq(lifeMetricDefinitions.id, careerGrowthPlain.id));
        totalMigrated++;
        continue;
      }

      // Both exist - migrate all goals from plain to emoji, then delete plain
      console.log(`🔄 Migrating goals from "Career Growth" to "Career Growth 🚀" for user ${userId}`);

      // Find all goals linked to the plain version
      // Use raw SQL to avoid schema issues with term column
      const goalsToMigrate = await db.execute(sql`
        SELECT id FROM goal_definitions 
        WHERE user_id = ${userId} 
        AND life_metric_id = ${careerGrowthPlain.id}
      `);

      if (goalsToMigrate.rows && goalsToMigrate.rows.length > 0) {
        const goalIds = goalsToMigrate.rows.map((r: any) => r.id);
        console.log(`   Found ${goalIds.length} goals to migrate`);
        
        // Update all goals to point to emoji version
        for (const goalId of goalIds) {
          await db
            .update(goalDefinitions)
            .set({ lifeMetricId: careerGrowthEmoji.id })
            .where(eq(goalDefinitions.id, goalId));
        }
        totalMigrated += goalIds.length;
      }

      // Delete the plain version
      console.log(`   Deleting duplicate "Career Growth" metric`);
      await db
        .update(lifeMetricDefinitions)
        .set({ isActive: false })
        .where(eq(lifeMetricDefinitions.id, careerGrowthPlain.id));
      
      totalDeleted++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Goals migrated: ${totalMigrated}`);
    console.log(`   Duplicate metrics deleted: ${totalDeleted}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCareerGrowthMetric()
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateCareerGrowthMetric };

