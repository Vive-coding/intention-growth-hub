import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { chatThreads, chatMessages } from "../../shared/schema";

const router = Router();

// Create a test thread with mock cards
router.post("/test-cards", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Create test thread
    const testThread = await db.insert(chatThreads).values({
      userId,
      title: "Test Cards Thread",
      summary: "Testing all card types",
      isTest: true,
      privacyScope: null,
    }).returning();

    const threadId = testThread[0].id;

    // Add test messages with different card types
    const testMessages = [
      {
        threadId,
        role: "user",
        content: "I want to test goal suggestions",
        status: "complete",
      },
      {
        threadId,
        role: "assistant", 
        content: "Here are some goal suggestions based on your current focus:\n\n---json---\n" + JSON.stringify({
          type: "goal_suggestion",
          goal: {
            title: "Increase daily energy levels",
            description: "Energy impacts your ability to pursue all other goals effectively. Research shows that consistent energy levels improve decision-making, productivity, and overall well-being.",
            category: "Health & Wellness",
            priority: "Priority 1"
          },
          habits: [
            {
              title: "Morning workout (20 min)",
              description: "Morning exercise boosts endorphins and metabolism, providing sustained energy throughout the day. Even 20 minutes makes a measurable difference.",
              frequency: "daily",
              effortMinutes: 20,
              impact: "high"
            },
            {
              title: "Sleep 7-8 hours",
              description: "Adequate sleep is the foundation of sustained energy. Most adults need 7-8 hours for optimal recovery and cognitive function.",
              frequency: "daily",
              effortMinutes: 0,
              impact: "high"
            },
            {
              title: "Drink 8 glasses of water daily",
              description: "Even mild dehydration can cause fatigue. Proper hydration supports cellular energy production and mental clarity.",
              frequency: "daily",
              effortMinutes: 5,
              impact: "medium"
            }
          ]
        }),
        status: "complete",
      },
      {
        threadId,
        role: "user",
        content: "Let me review my habits",
        status: "complete",
      },
      {
        threadId,
        role: "assistant",
        content: "Here's your habit review for today:\n\n---json---\n" + JSON.stringify({
          type: "habit_review",
          habits: [
            {
              id: "habit-1",
              title: "Morning workout (20 min)",
              description: "Morning exercise for energy",
              completed: true,
              streak: 12,
              points: 1
            },
            {
              id: "habit-2", 
              title: "Sleep 7-8 hours",
              description: "Adequate sleep for recovery",
              completed: false,
              streak: 8,
              points: 1
            },
            {
              id: "habit-3",
              title: "Read leadership content (15 min/day)",
              description: "Daily learning and growth",
              completed: true,
              streak: 5,
              points: 1
            },
            {
              id: "habit-4",
              title: "One-on-one check-in with team member",
              description: "Build relationships and provide support",
              completed: false,
              streak: 3,
              points: 1
            }
          ]
        }),
        status: "complete",
      },
      {
        threadId,
        role: "user",
        content: "Help me optimize my focus",
        status: "complete",
      },
      {
        threadId,
        role: "assistant",
        content: "Here are some optimization suggestions:\n\n---json---\n" + JSON.stringify({
          type: "optimization",
          summary: "Based on your 4 goals and 8 habits, here are strategic optimizations to maximize your impact:",
          recommendations: [
            {
              type: "archive",
              title: "Archive low-impact habits",
              description: "You have many habits. Consider archiving 2-3 that have lower impact to focus on your most important ones."
            },
            {
              type: "modify",
              title: "Consolidate similar goals",
              description: "You have multiple goals in similar areas. Consider consolidating them into 2-3 focused objectives."
            },
            {
              type: "add",
              title: "Add energy management habit",
              description: "Consider adding a daily energy check-in to optimize your performance across all goals."
            }
          ]
        }),
        status: "complete",
      },
      {
        threadId,
        role: "user",
        content: "Surprise me with insights",
        status: "complete",
      },
      {
        threadId,
        role: "assistant",
        content: "Here's an insight about your patterns:\n\n---json---\n" + JSON.stringify({
          type: "insight",
          title: "You're a natural connector",
          explanation: "I notice you consistently bring up relationships and collaboration in our conversations. You seem to naturally think about how things connect and how people work together, which is a valuable skill that might be underutilized in your current goals.",
          confidence: 85,
          lifeMetricIds: ["e6edc742-9901-41f6-b5ce-853937976562"]
        }),
        status: "complete",
      }
    ];

    // Insert all test messages
    for (const message of testMessages) {
      await db.insert(chatMessages).values(message);
    }

    res.json({ 
      threadId, 
      message: "Test thread created with all card types",
      cards: ["goal_suggestion", "habit_review", "optimization", "insight"]
    });

  } catch (e) {
    console.error("[test-cards] failed", e);
    res.status(500).json({ message: "Failed to create test thread" });
  }
});

export default router;
