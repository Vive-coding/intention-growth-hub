import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { progressSnapshots, goalInstances, goalDefinitions, habitInstances, habitCompletions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedProgressSnapshots() {
  try {
    console.log('Seeding progress snapshots based on habit-driven progress...');
    
    const userId = "dev-user-123";
    
    // Get all goal instances with their definitions
    const goalsWithDefinitions = await db
      .select({
        goalInstance: goalInstances,
        goalDefinition: goalDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalInstances.userId, userId));
    
    console.log(`Found ${goalsWithDefinitions.length} goals to create snapshots for`);
    
    // Group goals by life metric (category)
    const goalsByMetric: { [key: string]: any[] } = {};
    goalsWithDefinitions.forEach(({ goalInstance, goalDefinition }) => {
      const metric = goalDefinition.category || 'Unknown';
      if (!goalsByMetric[metric]) {
        goalsByMetric[metric] = [];
      }
      goalsByMetric[metric].push({ goalInstance, goalDefinition });
    });
    
    const insertedSnapshots: Array<{metric: string, monthYear: string, progress: number, completed: number, total: number}> = [];
    
    // Generate snapshots for the last 6 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 6);
    
    // For each life metric
    for (const [metricName, goals] of Object.entries(goalsByMetric)) {
      console.log(`\nProcessing ${metricName} with ${goals.length} goals`);
      
      // Generate monthly snapshots
      const currentDate = new Date(startDate);
      currentDate.setDate(1); // Start at beginning of month
      
      while (currentDate <= endDate) {
        const monthYear = currentDate.toISOString().slice(0, 7); // "2025-01"
        
        // Calculate progress for each goal in this metric
        let totalProgress = 0;
        let totalGoals = goals.length;
        let completedGoals = 0;
        
        for (const { goalInstance, goalDefinition } of goals) {
          // Get habit instances for this goal
          const habitInstancesForGoal = await db
            .select()
            .from(habitInstances)
            .where(eq(habitInstances.goalInstanceId, goalInstance.id));
          
          if (habitInstancesForGoal.length === 0) {
            // No habits associated, use default progress
            totalProgress += 0;
            continue;
          }
          
          // Calculate goal progress based on habit completions
          let goalProgress = 0;
          let totalHabitProgress = 0;
          
          for (const habitInstance of habitInstancesForGoal) {
            // Get habit completions for this month
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            
            // Get all completions for this habit and filter by date in JavaScript
            const allCompletions = await db
              .select()
              .from(habitCompletions)
              .where(and(
                eq(habitCompletions.habitDefinitionId, habitInstance.habitDefinitionId),
                eq(habitCompletions.userId, userId)
              ));
            
            const completions = allCompletions.filter(completion => {
              const completionDate = new Date(completion.completedAt);
              return completionDate >= monthStart && completionDate <= monthEnd;
            });
            
            // Calculate habit progress percentage
            const habitProgress = habitInstance.targetValue > 0 
              ? Math.min(100, (completions.length / habitInstance.targetValue) * 100)
              : 0;
            
            totalHabitProgress += habitProgress;
          }
          
          // Average progress across all habits for this goal
          goalProgress = habitInstancesForGoal.length > 0 
            ? totalHabitProgress / habitInstancesForGoal.length 
            : 0;
          
          totalProgress += goalProgress;
          
          // Check if goal is completed (progress >= 100%)
          if (goalProgress >= 100) {
            completedGoals++;
          }
        }
        
        // Calculate average progress for this metric
        const averageProgress = totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0;
        
        // Create progress snapshot
        await db.insert(progressSnapshots).values({
          userId,
          lifeMetricName: metricName,
          monthYear,
          progressPercentage: averageProgress,
          goalsCompleted: completedGoals,
          totalGoals,
          snapshotDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15), // Mid-month snapshot
        });
        
        insertedSnapshots.push({
          metric: metricName,
          monthYear,
          progress: averageProgress,
          completed: completedGoals,
          total: totalGoals,
        });
        
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
    
    console.log(`✅ Successfully seeded ${insertedSnapshots.length} progress snapshots`);
    
    // Log snapshot statistics
    const metrics = Array.from(new Set(insertedSnapshots.map(s => s.metric)));
    console.log(`\nSnapshots created for ${metrics.length} life metrics:`);
    metrics.forEach(metric => {
      const metricSnapshots = insertedSnapshots.filter(s => s.metric === metric);
      const avgProgress = Math.round(
        metricSnapshots.reduce((sum, s) => sum + s.progress, 0) / metricSnapshots.length
      );
      console.log(`- ${metric}: ${metricSnapshots.length} snapshots, avg progress: ${avgProgress}%`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding progress snapshots:', error);
  } finally {
    await sql.end();
  }
}

seedProgressSnapshots(); 