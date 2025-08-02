import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { habitDefinitions } from '../../shared/schema';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedHabitDefinitions() {
  try {
    console.log('Seeding habit definitions...');
    
    const userId = "dev-user-123";
    
    // Define habit definitions (global habits that can be used across different goals)
    const habits = [
      // Physical Health Habits
      {
        name: "Exercise 30 minutes",
        description: "Daily physical activity for cardiovascular health",
        category: null, // Not tied to specific life metric
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Drink 8 glasses of water",
        description: "Stay hydrated throughout the day",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Get 8 hours of sleep",
        description: "Quality sleep for recovery and health",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Take a 10-minute walk",
        description: "Light physical activity and fresh air",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Eat a healthy meal",
        description: "Consume nutritious food for energy",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      
      // Learning & Development Habits
      {
        name: "Read 20 pages",
        description: "Daily reading for knowledge and growth",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Practice coding 1 hour",
        description: "Improve technical skills",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Learn a new skill",
        description: "Spend time on skill development",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Watch educational content",
        description: "Consume learning materials",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      
      // Financial Habits
      {
        name: "Track expenses",
        description: "Log all daily expenses",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Save money",
        description: "Daily savings contribution",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Review budget",
        description: "Weekly budget review and planning",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Research investment",
        description: "Learn about investment opportunities",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      
      // Mindfulness & Personal Growth Habits
      {
        name: "Practice meditation",
        description: "10 minutes of mindfulness practice",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Write in journal",
        description: "Reflect on daily experiences",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Practice gratitude",
        description: "List 3 things to be grateful for",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Set daily intentions",
        description: "Plan and set goals for the day",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      
      // Social & Relationship Habits
      {
        name: "Call a friend",
        description: "Reach out to maintain relationships",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Spend quality time",
        description: "Dedicated time with loved ones",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Express appreciation",
        description: "Show gratitude to someone",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Listen actively",
        description: "Practice active listening skills",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      
      // Productivity Habits
      {
        name: "Plan tomorrow",
        description: "Prepare for the next day",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Declutter workspace",
        description: "Maintain organized environment",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
      {
        name: "Take breaks",
        description: "Rest periods for productivity",
        category: null,
        globalCompletions: 0,
        globalStreak: 0,
      },
    ];
    
    // Insert habit definitions
    const insertedHabits = await db.insert(habitDefinitions).values(
      habits.map(habit => ({
        userId,
        ...habit,
      }))
    ).returning();
    
    console.log(`✅ Successfully seeded ${insertedHabits.length} habit definitions`);
    
    // Log the created habits for reference
    console.log('\nCreated habit definitions:');
    insertedHabits.forEach(habit => {
      console.log(`- ${habit.name} (${habit.category})`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding habit definitions:', error);
  } finally {
    await sql.end();
  }
}

seedHabitDefinitions(); 