import { Router } from "express";
import { db } from "../db";
import { and, eq, desc } from "drizzle-orm";
import { 
  insights, 
  insightLifeMetrics, 
  insightVotes, 
  suggestedGoals, 
  suggestedHabits,
  type Insight,
  type InsightVote,
  type LifeMetricDefinition,
  type SuggestedGoal,
  type SuggestedHabit,
} from "../../shared/schema";
import type { Request, Response } from "express";

interface AuthenticatedRequest extends Request {
  user: {
    claims: {
      sub: string;
    };
  };
}

interface InsightWithRelations extends Insight {
  lifeMetrics: Array<{
    lifeMetric: LifeMetricDefinition;
  }>;
  votes: InsightVote[];
  suggestedGoals: SuggestedGoal[];
  suggestedHabits: SuggestedHabit[];
  insight?: {
    userId: string;
  };
}

const router = Router();

// Get all insights for the authenticated user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";

    // Get insights with their life metrics, votes, and suggestions
    const userInsights = await db.query.insights.findMany({
      where: eq(insights.userId, userId),
      orderBy: desc(insights.createdAt),
      with: {
        lifeMetrics: {
          columns: {},
          with: {
            lifeMetric: true,
          },
        },
        votes: true,
        suggestedGoals: {
          where: eq(suggestedGoals.archived, false),
        },
        suggestedHabits: {
          where: eq(suggestedHabits.archived, false),
        },
      },
    });

    // Transform the data for the frontend
    const transformedInsights = userInsights.map((insight: any) => ({
      ...insight,
      lifeMetrics: insight.lifeMetrics.map((lm: any) => lm.lifeMetric),
      upvotes: insight.votes.filter((v: any) => v.isUpvote).length,
      downvotes: insight.votes.filter((v: any) => !v.isUpvote).length,
      userVote: insight.votes.find((v: any) => v.userId === userId)?.isUpvote,
    }));

    res.json(transformedInsights);
  } catch (error) {
    console.error("Error fetching insights:", error);
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

// Get a single insight by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const insightId = req.params.id;

    const insight = await db.query.insights.findFirst({
      where: and(
        eq(insights.id, insightId),
        eq(insights.userId, userId)
      ),
      with: {
        lifeMetrics: {
          with: {
            lifeMetric: true,
          },
        },
        votes: true,
        suggestedGoals: true,
        suggestedHabits: true,
      },
    });

    if (!insight) {
      return res.status(404).json({ error: "Insight not found" });
    }

    res.json({
      ...insight,
      lifeMetrics: insight.lifeMetrics.map(lm => lm.lifeMetric),
      upvotes: insight.votes.filter(v => v.isUpvote).length,
      downvotes: insight.votes.filter(v => !v.isUpvote).length,
      userVote: insight.votes.find(v => v.userId === userId)?.isUpvote,
    });
  } catch (error) {
    console.error("Error fetching insight:", error);
    res.status(500).json({ error: "Failed to fetch insight" });
  }
});

// Vote on an insight
router.post("/:id/vote", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const insightId = req.params.id;
    const { isUpvote } = req.body;

    if (typeof isUpvote !== "boolean") {
      return res.status(400).json({ error: "Invalid vote type" });
    }

    // Check if insight exists and belongs to user
    const insight = await db.query.insights.findFirst({
      where: and(
        eq(insights.id, insightId),
        eq(insights.userId, userId)
      ),
    });

    if (!insight) {
      return res.status(404).json({ error: "Insight not found" });
    }

    // Check for existing vote
    const existingVote = await db.query.insightVotes.findFirst({
      where: and(
        eq(insightVotes.insightId, insightId),
        eq(insightVotes.userId, userId)
      ),
    });

    if (existingVote) {
      // Update existing vote
      await db
        .update(insightVotes)
        .set({ isUpvote })
        .where(eq(insightVotes.id, existingVote.id));
    } else {
      // Create new vote
      await db.insert(insightVotes).values({
        insightId,
        userId,
        isUpvote,
      });
    }

    // Get updated vote counts
    const votes = await db.query.insightVotes.findMany({
      where: eq(insightVotes.insightId, insightId),
    });

    res.json({
      upvotes: votes.filter(v => v.isUpvote).length,
      downvotes: votes.filter(v => !v.isUpvote).length,
      userVote: isUpvote,
    });
  } catch (error) {
    console.error("Error voting on insight:", error);
    res.status(500).json({ error: "Failed to vote on insight" });
  }
});

// Archive a suggested goal
router.post("/goals/:id/archive", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const goalId = req.params.id;

    // Verify the goal exists and belongs to the user's insight
    const goal = await db.query.suggestedGoals.findFirst({
      where: eq(suggestedGoals.id, goalId),
      with: {
        insight: true,
      },
    });

    if (!goal || goal.insight.userId !== userId) {
      return res.status(404).json({ error: "Suggested goal not found" });
    }

    await db
      .update(suggestedGoals)
      .set({ archived: true })
      .where(eq(suggestedGoals.id, goalId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error archiving suggested goal:", error);
    res.status(500).json({ error: "Failed to archive suggested goal" });
  }
});

// Archive a suggested habit
router.post("/habits/:id/archive", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "dev-user-123";
    const habitId = req.params.id;

    // Verify the habit exists and belongs to the user's insight
    const habit = await db.query.suggestedHabits.findFirst({
      where: eq(suggestedHabits.id, habitId),
      with: {
        insight: true,
      },
    });

    if (!habit || habit.insight.userId !== userId) {
      return res.status(404).json({ error: "Suggested habit not found" });
    }

    await db
      .update(suggestedHabits)
      .set({ archived: true })
      .where(eq(suggestedHabits.id, habitId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error archiving suggested habit:", error);
    res.status(500).json({ error: "Failed to archive suggested habit" });
  }
});

export default router; 