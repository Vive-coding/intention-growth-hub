// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { db } from "../db";
import {
  users,
  lifeMetricDefinitions,
  goalDefinitions,
  goalInstances,
  journalEntries,
} from "../../shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting database seed...");

  // Check if development user already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, "dev-user-123"))
    .limit(1);

  let user;
  if (existingUser.length === 0) {
    // Create development user
    const [newUser] = await db
      .insert(users)
      .values({
        id: "dev-user-123",
        email: "dev@example.com",
        firstName: "Development",
        lastName: "User",
        profileImageUrl: "https://via.placeholder.com/150",
        onboardingCompleted: true,
      })
      .returning();
    user = newUser;
    console.log("✅ Created development user:", user.email);
  } else {
    user = existingUser[0];
    console.log("✅ Using existing development user:", user.email);
  }

  // Check if life metrics already exist
  const existingMetrics = await db
    .select()
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.userId, user.id));

  let healthFitnessMetric, careerGrowthMetric, personalDevelopmentMetric, relationshipsMetric, financeMetric, mentalHealthMetric;

  if (existingMetrics.length === 0) {
    // Create life metrics
    const [hf, cg, pd, rel, fin, mh] = await db
      .insert(lifeMetricDefinitions)
      .values([
        {
          userId: user.id,
          name: "Health & Fitness",
          description: "Physical and mental wellbeing",
          color: "#10b981",
          isActive: true,
        },
        {
          userId: user.id,
          name: "Career Growth",
          description: "Professional development and skills",
          color: "#3b82f6",
          isActive: true,
        },
        {
          userId: user.id,
          name: "Personal Development",
          description: "Learning and self-improvement",
          color: "#8b5cf6",
          isActive: true,
        },
        {
          userId: user.id,
          name: "Relationships",
          description: "Social connections and relationships",
          color: "#f59e0b",
          isActive: true,
        },
              {
        userId: user.id,
        name: "Finance",
        description: "Financial planning and investments",
        color: "#ef4444",
        isActive: true,
      },
      {
        userId: user.id,
        name: "Mental Health",
        description: "Emotional wellbeing and mental clarity",
        color: "#8b5cf6",
        isActive: true,
      },

      ])
      .returning();
    
    [healthFitnessMetric, careerGrowthMetric, personalDevelopmentMetric, relationshipsMetric, financeMetric, mentalHealthMetric] = [hf, cg, pd, rel, fin, mh];
    console.log("✅ Created life metrics");
  } else {
    // Use existing metrics and create missing ones
    healthFitnessMetric = existingMetrics.find(m => m.name === "Health & Fitness")!;
    careerGrowthMetric = existingMetrics.find(m => m.name === "Career Growth")!;
    personalDevelopmentMetric = existingMetrics.find(m => m.name === "Personal Development")!;
    
    // Check if we need to create missing metrics
    const missingMetrics = [];
    if (!existingMetrics.find(m => m.name === "Relationships")) {
      missingMetrics.push({
        userId: user.id,
        name: "Relationships",
        description: "Social connections and relationships",
        color: "#f59e0b",
        isActive: true,
      });
    }
    if (!existingMetrics.find(m => m.name === "Finance")) {
      missingMetrics.push({
        userId: user.id,
        name: "Finance",
        description: "Financial planning and investments",
        color: "#ef4444",
        isActive: true,
      });
    }
    if (!existingMetrics.find(m => m.name === "Mental Health")) {
      missingMetrics.push({
        userId: user.id,
        name: "Mental Health",
        description: "Emotional wellbeing and mental clarity",
        color: "#8b5cf6",
        isActive: true,
      });
    }

    
    if (missingMetrics.length > 0) {
      const [rel, fin, mh] = await db
        .insert(lifeMetricDefinitions)
        .values(missingMetrics)
        .returning();
      
      relationshipsMetric = rel;
      financeMetric = fin;
      mentalHealthMetric = mh;
      console.log("✅ Created missing life metrics:", missingMetrics.map(m => m.name).join(", "));
    } else {
      relationshipsMetric = existingMetrics.find(m => m.name === "Relationships")!;
      financeMetric = existingMetrics.find(m => m.name === "Finance")!;
      mentalHealthMetric = existingMetrics.find(m => m.name === "Mental Health")!;
    }
    
    // Ensure all metrics are defined
    if (!healthFitnessMetric || !careerGrowthMetric || !personalDevelopmentMetric || 
        !relationshipsMetric || !financeMetric || !mentalHealthMetric) {
      throw new Error("Some life metrics are missing");
    }
    
    console.log("✅ Using existing life metrics");
  }

  // Create goals
  const [exerciseGoal, meditationGoal, socialGoal, learningGoal, investmentGoal] = await db
    .insert(goalDefinitions)
    .values([
      {
        userId: user.id,
        title: "Daily Exercise",
        description: "30 minutes of exercise daily",
        category: healthFitnessMetric.name,
        unit: "minutes",
        isActive: true,
      },
      {
        userId: user.id,
        title: "Meditation Practice",
        description: "10 minutes of meditation daily",
        category: healthFitnessMetric.name,
        unit: "minutes",
        isActive: true,
      },
      {
        userId: user.id,
        title: "Social Connections",
        description: "Connect with 3 friends weekly",
        category: relationshipsMetric.name,
        unit: "connections",
        isActive: true,
      },

      {
        userId: user.id,
        title: "Learning Goals",
        description: "Read 2 books this quarter",
        category: personalDevelopmentMetric.name,
        unit: "books",
        isActive: true,
      },
      {
        userId: user.id,
        title: "Investment Review",
        description: "Review portfolio monthly",
        category: financeMetric.name,
        unit: "reviews",
        isActive: true,
      },
    ])
    .returning();

  console.log("✅ Created goals");

  // Create goal instances
  await db.insert(goalInstances).values([
    {
      userId: user.id,
      goalDefinitionId: exerciseGoal.id,
      targetValue: 30,
      currentValue: 25,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      userId: user.id,
      goalDefinitionId: meditationGoal.id,
      targetValue: 10,
      currentValue: 8,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      userId: user.id,
      goalDefinitionId: socialGoal.id,
      targetValue: 3,
      currentValue: 2,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
    },

    {
      userId: user.id,
      goalDefinitionId: learningGoal.id,
      targetValue: 2,
      currentValue: 1,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      userId: user.id,
      goalDefinitionId: investmentGoal.id,
      targetValue: 1,
      currentValue: 0,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
    },
  ]);

  console.log("✅ Created goal instances");

  // Create journal entries
  await db.insert(journalEntries).values([
    {
      userId: user.id,
      title: "Started My Fitness Journey",
      content: "Today I began my fitness journey with a 15-minute workout. It was challenging but rewarding!",
      entryDate: new Date(),
      mood: "Energetic",
      tags: ["fitness", "health", "beginnings"],
      isPrivate: true,
    },
    {
      userId: user.id,
      title: "Learning TypeScript",
      content: "Spent 2 hours learning TypeScript today. The type system is really powerful!",
      entryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      mood: "Focused",
      tags: ["coding", "learning", "typescript"],
      isPrivate: true,
    },
  ]);

  console.log("✅ Created journal entries");
  console.log("✨ Seed completed successfully!");
}

// Run the seed function
seed()
  .catch((error) => {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  }); 