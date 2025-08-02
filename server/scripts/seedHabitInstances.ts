import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { habitInstances, habitDefinitions, goalInstances, goalDefinitions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedHabitInstances() {
  try {
    console.log('Seeding habit instances (linking habits to goals)...');
    
    const userId = "dev-user-123";
    
    // Get all habit definitions and goal instances with their definitions
    const habits = await db.select().from(habitDefinitions).where(eq(habitDefinitions.userId, userId));
    
    const goalsWithDefinitions = await db
      .select({
        goalInstance: goalInstances,
        goalDefinition: goalDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalInstances.userId, userId));
    
    console.log(`Found ${habits.length} habits and ${goalsWithDefinitions.length} goals`);
    
    // Define habit-goal associations with realistic targets
    const habitGoalAssociations = [
      // Health & Fitness Goals
      {
        goalTitle: "Build Consistent Exercise Routine",
        habitName: "Exercise 30 minutes",
        targetValue: 30, // 30 days of exercise
      },
      {
        goalTitle: "Build Consistent Exercise Routine", 
        habitName: "Take a 10-minute walk",
        targetValue: 30, // 30 days of walking
      },
      {
        goalTitle: "Improve Sleep Quality",
        habitName: "Get 8 hours of sleep",
        targetValue: 28, // 28 days of good sleep
      },
      {
        goalTitle: "Stay Hydrated Daily",
        habitName: "Drink 8 glasses of water",
        targetValue: 31, // 31 days of hydration
      },
      {
        goalTitle: "Stay Hydrated Daily",
        habitName: "Eat a healthy meal",
        targetValue: 31, // 31 days of healthy eating
      },
      
      // Career Growth Goals
      {
        goalTitle: "Complete Technical Certification",
        habitName: "Practice coding 1 hour",
        targetValue: 60, // 60 hours of coding
      },
      {
        goalTitle: "Complete Technical Certification",
        habitName: "Learn a new skill",
        targetValue: 60, // 60 hours of learning
      },
      {
        goalTitle: "Read 12 Books This Year",
        habitName: "Read 20 pages",
        targetValue: 240, // 12 books * 20 pages = 240 reading sessions
      },
      {
        goalTitle: "Build Professional Network",
        habitName: "Call a friend",
        targetValue: 50, // 50 networking calls
      },
      {
        goalTitle: "Build Professional Network",
        habitName: "Express appreciation",
        targetValue: 50, // 50 expressions of appreciation
      },
      
      // Financial Wellness Goals
      {
        goalTitle: "Save $10,000 Emergency Fund",
        habitName: "Save money",
        targetValue: 200, // 200 days of saving
      },
      {
        goalTitle: "Track All Expenses for 3 Months",
        habitName: "Track expenses",
        targetValue: 90, // 90 days of tracking
      },
      {
        goalTitle: "Invest $5,000 in Index Funds",
        habitName: "Research investment",
        targetValue: 50, // 50 research sessions
      },
      {
        goalTitle: "Invest $5,000 in Index Funds",
        habitName: "Review budget",
        targetValue: 26, // 26 weeks of budget review
      },
      
      // Personal Development Goals
      {
        goalTitle: "Practice Daily Meditation",
        habitName: "Practice meditation",
        targetValue: 100, // 100 meditation sessions
      },
      {
        goalTitle: "Write 50 Journal Entries",
        habitName: "Write in journal",
        targetValue: 50, // 50 journal entries
      },
      {
        goalTitle: "Learn 3 New Skills",
        habitName: "Learn a new skill",
        targetValue: 3, // 3 skills
      },
      {
        goalTitle: "Learn 3 New Skills",
        habitName: "Watch educational content",
        targetValue: 30, // 30 educational sessions
      },
      
      // Relationships Goals
      {
        goalTitle: "Strengthen Family Bonds",
        habitName: "Spend quality time",
        targetValue: 52, // 52 weeks of family time
      },
      {
        goalTitle: "Strengthen Family Bonds",
        habitName: "Express appreciation",
        targetValue: 52, // 52 expressions of appreciation
      },
      {
        goalTitle: "Reconnect with Old Friends",
        habitName: "Call a friend",
        targetValue: 20, // 20 friend calls
      },
      {
        goalTitle: "Reconnect with Old Friends",
        habitName: "Listen actively",
        targetValue: 20, // 20 active listening sessions
      },
      {
        goalTitle: "Improve Communication Skills",
        habitName: "Listen actively",
        targetValue: 100, // 100 active listening sessions
      },
      {
        goalTitle: "Improve Communication Skills",
        habitName: "Express appreciation",
        targetValue: 100, // 100 expressions of appreciation
      },
    ];
    
    // Create habit instances
    const insertedHabitInstances = [];
    
    for (const association of habitGoalAssociations) {
      // Find the goal
      const goalWithDefinition = goalsWithDefinitions.find((g: any) => g.goalDefinition.title === association.goalTitle);
      if (!goalWithDefinition) {
        console.log(`Goal not found: ${association.goalTitle}`);
        continue;
      }
      
      const goal = goalWithDefinition.goalInstance;
      const goalTitle = goalWithDefinition.goalDefinition.title;
      
      // Find the habit
      const habit = habits.find((h: any) => h.name === association.habitName);
      if (!habit) {
        console.log(`Habit not found: ${association.habitName}`);
        continue;
      }
      
      // Check if association already exists
      const existingAssociation = await db.select().from(habitInstances).where(
        and(
          eq(habitInstances.goalInstanceId, goal.id),
          eq(habitInstances.habitDefinitionId, habit.id)
        )
      ).limit(1);
      
      if (existingAssociation.length > 0) {
        console.log(`Association already exists: ${habit.name} -> ${goalTitle}`);
        continue;
      }
      
      // Create habit instance
      const [habitInstance] = await db.insert(habitInstances).values({
        habitDefinitionId: habit.id,
        goalInstanceId: goal.id,
        userId,
        targetValue: association.targetValue,
        currentValue: 0, // Start at 0
        goalSpecificStreak: 0,
      }).returning();
      
      insertedHabitInstances.push({
        habit: habit.name,
        goal: goalTitle,
        targetValue: association.targetValue,
      });
    }
    
    console.log(`✅ Successfully seeded ${insertedHabitInstances.length} habit instances`);
    
    // Log the associations for reference
    console.log('\nCreated habit-goal associations:');
    insertedHabitInstances.forEach(({ habit, goal, targetValue }) => {
      console.log(`- ${habit} -> ${goal} (Target: ${targetValue})`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding habit instances:', error);
  } finally {
    await sql.end();
  }
}

seedHabitInstances(); 