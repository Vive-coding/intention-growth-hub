import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { goalDefinitions, goalInstances } from '../../shared/schema';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedGoals() {
  try {
    console.log('Seeding goal definitions and instances...');
    
    const userId = "dev-user-123";
    
    // Define goals for different life areas
    const goals = [
      // Health & Fitness Goals
      {
        title: "Build Consistent Exercise Routine",
        description: "Establish a daily exercise habit for better health and fitness",
        category: "Health & Fitness",
        targetValue: 30, // 30 days
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-02-01'),
      },
      {
        title: "Improve Sleep Quality",
        description: "Get consistent 8 hours of quality sleep each night",
        category: "Health & Fitness",
        targetValue: 28, // 28 days (4 weeks)
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-01-29'),
      },
      {
        title: "Stay Hydrated Daily",
        description: "Drink 8 glasses of water every day",
        category: "Health & Fitness",
        targetValue: 31, // 31 days
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-02-01'),
      },
      
      // Career Growth Goals
      {
        title: "Complete Technical Certification",
        description: "Finish the advanced coding certification program",
        category: "Career Growth",
        targetValue: 60, // 60 hours of practice
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-03-01'),
      },
      {
        title: "Read 12 Books This Year",
        description: "Read one book per month for continuous learning",
        category: "Career Growth",
        targetValue: 12, // 12 books
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-12-31'),
      },
      {
        title: "Build Professional Network",
        description: "Connect with 50 professionals in the industry",
        category: "Career Growth",
        targetValue: 50, // 50 connections
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-06-30'),
      },
      
      // Financial Wellness Goals
      {
        title: "Save $10,000 Emergency Fund",
        description: "Build a solid emergency fund for financial security",
        category: "Financial Wellness",
        targetValue: 10000, // $10,000
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-12-31'),
      },
      {
        title: "Track All Expenses for 3 Months",
        description: "Monitor spending habits to identify areas for improvement",
        category: "Financial Wellness",
        targetValue: 90, // 90 days
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-04-01'),
      },
      {
        title: "Invest $5,000 in Index Funds",
        description: "Start building long-term wealth through investments",
        category: "Financial Wellness",
        targetValue: 5000, // $5,000
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-06-30'),
      },
      
      // Personal Development Goals
      {
        title: "Practice Daily Meditation",
        description: "Develop mindfulness through daily meditation practice",
        category: "Personal Development",
        targetValue: 100, // 100 sessions
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-04-10'),
      },
      {
        title: "Write 50 Journal Entries",
        description: "Reflect on experiences and track personal growth",
        category: "Personal Development",
        targetValue: 50, // 50 entries
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-03-01'),
      },
      {
        title: "Learn 3 New Skills",
        description: "Master three completely new skills this year",
        category: "Personal Development",
        targetValue: 3, // 3 skills
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-12-31'),
      },
      
      // Relationships Goals
      {
        title: "Strengthen Family Bonds",
        description: "Spend quality time with family members regularly",
        category: "Relationships",
        targetValue: 52, // 52 weeks (weekly family time)
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-12-31'),
      },
      {
        title: "Reconnect with Old Friends",
        description: "Reach out to 20 old friends and rebuild connections",
        category: "Relationships",
        targetValue: 20, // 20 friends
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-06-30'),
      },
      {
        title: "Improve Communication Skills",
        description: "Practice active listening and better communication",
        category: "Relationships",
        targetValue: 100, // 100 practice sessions
        status: "active",
        startDate: new Date('2025-01-01'),
        targetDate: new Date('2025-04-10'),
      },
    ];
    
    // Insert goal definitions and instances
    const insertedGoals = [];
    
    for (const goal of goals) {
      // Create goal definition
      const [goalDefinition] = await db.insert(goalDefinitions).values({
        userId,
        title: goal.title,
        description: goal.description,
        category: goal.category,
        unit: "count",
        isActive: true,
      }).returning();
      
      // Create goal instance
      const [goalInstance] = await db.insert(goalInstances).values({
        goalDefinitionId: goalDefinition.id,
        userId,
        targetValue: goal.targetValue,
        currentValue: 0, // Start at 0
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        status: goal.status,
        monthYear: goal.startDate.toISOString().slice(0, 7), // "2025-01"
      }).returning();
      
      insertedGoals.push({
        definition: goalDefinition,
        instance: goalInstance,
      });
    }
    
    console.log(`✅ Successfully seeded ${insertedGoals.length} goal definitions and instances`);
    
    // Log the created goals for reference
    console.log('\nCreated goals:');
    insertedGoals.forEach(({ definition, instance }) => {
      console.log(`- ${definition.title} (${definition.category}) - Target: ${instance.targetValue}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding goals:', error);
  } finally {
    await sql.end();
  }
}

seedGoals(); 