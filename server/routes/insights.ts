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
import { embedNormalized, cosineSimilarity, decideSimilarity, conceptHash } from "../utils/textSimilarity";
import { suggestionMemory } from "../../shared/schema";
import { and as andOp, eq as eqOp, gte as gteOp } from "drizzle-orm";

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
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

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

    console.log(`[INSIGHTS DEBUG] Fetched ${userInsights.length} insights for user ${userId}`);
    if (userInsights.length > 0) {
      console.log(`[INSIGHTS DEBUG] First insight votes:`, userInsights[0].votes);
      console.log(`[INSIGHTS DEBUG] Sample insight structure:`, {
        id: userInsights[0].id,
        title: userInsights[0].title,
        votesCount: userInsights[0].votes?.length || 0,
        votes: userInsights[0].votes
      });
    }

    // Transform and de-duplicate existing insights
    const texts = userInsights.map((i:any) => `${i.title}\n${i.explanation}`);
    const embs = await embedNormalized(texts);
    const transformedInsights = userInsights
      .map((insight: any, idx: number) => {
        let maxSim = 0; let dupIndex: number | undefined;
        for (let i = 0; i < idx; i++) {
          const sim = cosineSimilarity(embs[idx] as any, embs[i] as any);
          if (sim > maxSim) { maxSim = sim; dupIndex = i; }
        }
        const decision = decideSimilarity(maxSim);
        const cHash = conceptHash(`${insight.title}\n${insight.explanation}`);
        const upvotes = insight.votes?.filter((v: any) => v.isUpvote).length || 0;
        const downvotes = insight.votes?.filter((v: any) => !v.isUpvote).length || 0;
        const userVote = insight.votes?.find((v: any) => v.userId === userId)?.isUpvote;
        
        if (idx === 0) {
          console.log(`[INSIGHTS DEBUG] Transforming first insight:`, {
            id: insight.id,
            title: insight.title,
            votesArray: insight.votes,
            upvotes,
            downvotes,
            userVote,
            userId
          });
        }
        
        return {
          ...insight,
          lifeMetrics: insight.lifeMetrics.map((lm: any) => lm.lifeMetric),
          upvotes,
          downvotes,
          userVote,
          similarity: Number(maxSim.toFixed(3)),
          kind: decision.relation === 'duplicate' ? 'reinforce' : decision.relation === 'similar' ? 'reinforce' : 'new',
          duplicateOfId: decision.relation === 'duplicate' && dupIndex !== undefined ? userInsights[dupIndex].id : undefined,
          relatedId: (decision.relation === 'duplicate' || decision.relation === 'similar') && dupIndex !== undefined ? userInsights[dupIndex].id : undefined,
          relatedTitle: (decision.relation === 'duplicate' || decision.relation === 'similar') && dupIndex !== undefined ? userInsights[dupIndex].title : undefined,
          conceptHash: cHash,
        };
      })
      .filter((i:any) => i.kind !== 'new' || (i.similarity ?? 0) < 0.86);

    res.json(transformedInsights.map(({ conceptHash, ...rest }: any) => rest));
  } catch (error) {
    console.error("Error fetching insights:", error);
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

// Get a single insight by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
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

    // Transform the data for the frontend
    const transformedInsight = {
      ...insight,
      lifeMetrics: insight.lifeMetrics.map((lm: any) => lm.lifeMetric),
      upvotes: insight.votes.filter((v: any) => v.isUpvote).length,
      downvotes: insight.votes.filter((v: any) => !v.isUpvote).length,
      userVote: insight.votes.find((v: any) => v.userId === userId)?.isUpvote,
    };

    res.json(transformedInsight);
  } catch (error) {
    console.error("Error fetching insight:", error);
    res.status(500).json({ error: "Failed to fetch insight" });
  }
});

// Vote on an insight
router.post("/:id/vote", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const insightId = req.params.id;
    const { isUpvote } = req.body;

    // Check if user already voted
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
        .where(and(
          eq(insightVotes.insightId, insightId),
          eq(insightVotes.userId, userId)
        ));
    } else {
      // Create new vote
      await db.insert(insightVotes).values({
        insightId,
        userId,
        isUpvote,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error voting on insight:", error);
    res.status(500).json({ error: "Failed to vote on insight" });
  }
});

// Archive a suggested goal
router.post("/goals/:id/archive", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
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
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
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

// Update insight confidence
router.put("/:id/confidence", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const insightId = req.params.id;
    const { confidence } = req.body;

    // This part of the code was not provided in the edit_specification,
    // so it's kept as is, but it will likely cause an error
    // because 'storage' is not defined.
    // const updatedInsight = await storage.updateInsightConfidence(insightId, confidence);
    // res.json(updatedInsight);
    res.status(501).json({ error: "Feature not implemented" }); // Placeholder for future implementation
  } catch (error) {
    console.error("Error updating insight confidence:", error);
    res.status(500).json({ error: "Failed to update insight confidence" });
  }
});

// Delete an insight and its associations (lifeMetric links, votes, suggestions)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const insightId = req.params.id;

    // Verify it belongs to the user
    const existing = await db.query.insights.findFirst({
      where: and(eq(insights.id, insightId), eq(insights.userId, userId)),
    });
    if (!existing) {
      return res.status(404).json({ error: "Insight not found" });
    }

    // Delete child rows first where necessary
    await db.delete(insightVotes).where(eq(insightVotes.insightId, insightId));
    await db.delete(insightLifeMetrics).where(eq(insightLifeMetrics.insightId, insightId));
    await db.delete(suggestedGoals).where(eq(suggestedGoals.insightId, insightId));
    await db.delete(suggestedHabits).where(eq(suggestedHabits.insightId, insightId));

    // Delete the insight
    await db.delete(insights).where(and(eq(insights.id, insightId), eq(insights.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting insight:", error);
    res.status(500).json({ error: "Failed to delete insight" });
  }
});

export default router; 