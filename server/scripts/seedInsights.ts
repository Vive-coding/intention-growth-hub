// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { db } from "../db";
import { 
  insights, 
  insightLifeMetrics, 
  lifeMetricDefinitions,
  suggestedGoals,
  suggestedHabits,
} from "../../shared/schema";
import { eq } from "drizzle-orm";

async function seedInsights() {
  try {
    // Create life metrics if they don't exist
    const existingMetrics = await db.query.lifeMetricDefinitions.findMany({
      where: eq(lifeMetricDefinitions.userId, "dev-user-123"),
    });

    let healthMetric, careerMetric, personalMetric, relationshipsMetric, financeMetric;

    if (existingMetrics.length === 0) {
      [healthMetric, careerMetric, personalMetric, relationshipsMetric, financeMetric] = await db
        .insert(lifeMetricDefinitions)
        .values([
          {
            userId: "dev-user-123",
            name: "Health & Fitness",
            description: "Physical and mental wellbeing",
            color: "#10b981",
            isActive: true,
          },
          {
            userId: "dev-user-123",
            name: "Career Growth",
            description: "Professional development and skills",
            color: "#3b82f6",
            isActive: true,
          },
          {
            userId: "dev-user-123",
            name: "Personal Development",
            description: "Learning and self-improvement",
            color: "#8b5cf6",
            isActive: true,
          },
          {
            userId: "dev-user-123",
            name: "Relationships",
            description: "Social connections and relationships",
            color: "#f59e0b",
            isActive: true,
          },
          {
            userId: "dev-user-123",
            name: "Finance",
            description: "Financial planning and investments",
            color: "#ef4444",
            isActive: true,
          },
          {
            userId: "dev-user-123",
            name: "Mental Health",
            description: "Work efficiency and time management",
            color: "#84cc16",
            isActive: true,
          },
        ])
        .returning();
      console.log("✅ Created life metrics");
    } else {
      [healthMetric, careerMetric, personalMetric, relationshipsMetric, financeMetric] = existingMetrics;
      console.log("✅ Using existing life metrics");
    }

    // Create some insights
    const sampleInsights = [
      {
        userId: "dev-user-123",
        title: "Morning workouts boost your mental health significantly",
        explanation: "Based on your recent journals, there's a clear pattern of increased energy and focus on days you exercise before 9am. This has led to better task completion rates.",
        confidence: 85,
        themes: ["Exercise", "Mental Health", "Morning Routine"],
        lifeMetricIds: [healthMetric.id],
        suggestedGoals: [
          { title: "Schedule all important tasks between 10am-2pm" }
        ],
        suggestedHabits: [
          { title: "7am workout routine" }
        ]
      },
      {
        userId: "dev-user-123",
        title: "Documentation improves problem-solving",
        explanation: "Writing about technical challenges has led to solutions 80% of the time. Your problem-solving process is more structured when documented.",
        confidence: 91,
        themes: ["Documentation", "Problem Solving", "Learning"],
        lifeMetricIds: [careerMetric.id],
        suggestedHabits: [
          { title: "15min rubber duck journaling for bugs" }
        ]
      },
      {
        userId: "dev-user-123",
        title: "Reading enhances journal quality",
        explanation: "Journal entries are more analytical and structured after reading sessions. Non-fiction reading appears to improve your reflection quality.",
        confidence: 78,
        themes: ["Reading", "Reflection", "Learning"],
        lifeMetricIds: [personalMetric.id],
        suggestedGoals: [
          { title: "Read 2 books this quarter" }
        ]
      }
    ];

    for (const insightData of sampleInsights) {
      const { lifeMetricIds, suggestedGoals: goals, suggestedHabits: habits, ...data } = insightData;
      
      // Create insight
      const [insight] = await db.insert(insights).values(data).returning();
      console.log(`✅ Created insight: ${insight.title}`);

      // Create life metric associations
      if (lifeMetricIds?.length) {
        await db.insert(insightLifeMetrics).values(
          lifeMetricIds.filter(Boolean).map(metricId => ({
            insightId: insight.id,
            lifeMetricId: metricId!,
          }))
        );
      }

      // Create suggested goals
      if (goals?.length) {
        await db.insert(suggestedGoals).values(
          goals.map(goal => ({
            insightId: insight.id,
            lifeMetricId: lifeMetricIds![0]!,
            title: goal.title,
            archived: false,
          }))
        );
      }

      // Create suggested habits
      if (habits?.length) {
        await db.insert(suggestedHabits).values(
          habits.map(habit => ({
            insightId: insight.id,
            lifeMetricId: lifeMetricIds![0]!,
            title: habit.title,
            archived: false,
          }))
        );
      }
    }

    console.log("✨ Successfully seeded insights data!");
  } catch (error) {
    console.error("❌ Error seeding insights:", error);
    process.exit(1);
  }
}

seedInsights(); 