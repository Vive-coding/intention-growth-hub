import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { insights, insightLifeMetrics, insightVotes, lifeMetricDefinitions } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { ChatOpenAI } from "@langchain/openai";

const titleModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
  maxTokens: 60,
});

async function generateInsightTitle(insightText: string): Promise<string> {
  const trimmed = insightText.trim();
  if (!trimmed) {
    return "New Insight";
  }

  try {
    const response = await titleModel.invoke([
      {
        role: "system",
        content:
          "You write short, descriptive headlines (6-10 words) that summarize personal insights. No punctuation at the end.",
      },
      {
        role: "user",
        content: `Insight text:\n${trimmed}\n\nProvide a concise headline capturing the central pattern.`,
      },
    ]);

    const raw =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
        ? response.content
            .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
        : "";

    const candidate = raw.split("\n")[0]?.trim();
    if (candidate) {
      return candidate.replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    console.warn("[shareInsightTool] Unable to generate title via model, using fallback.", error);
  }

  const firstSentence = trimmed.split(/[\n\.!?]/).find((sentence) => sentence.trim().length > 0);
  if (firstSentence && firstSentence.trim().length > 0) {
    return firstSentence.trim().slice(0, 100);
  }

  return trimmed.slice(0, 100);
}

/**
 * Tool: Share breakthrough insight
 */
export const shareInsightTool = new DynamicStructuredTool({
  name: "share_insight",
  description: `Shares a breakthrough insight with the user.
  
  Args:
  - insight_text: The insight (pattern/learning about them)
  - life_metric: Which life area this relates to
  
  Use when:
  - You've identified a meaningful pattern in their behavior
  - User has a self-realization through your questions
  - You've provided advice that felt transformative
  
  Call when you identify a meaningful pattern. Share insights conversationally without requiring explicit confirmation first. The card includes feedback options for the user.
  
  Returns: Insight card with thumbs up/down for user feedback`,
  
  schema: z.object({
    insight_text: z.string().describe("The breakthrough insight or pattern"),
    life_metric: z.string().describe("Life area category")
  }),
  
  func: async ({ insight_text, life_metric }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      // Find the life metric ID
      const [metric] = await db
        .select()
        .from(lifeMetricDefinitions)
        .where(
          eq(lifeMetricDefinitions.name, life_metric)
        )
        .limit(1);
      
      const lifeMetricIds = metric ? [metric.id] : [];
      const generatedTitle = await generateInsightTitle(insight_text);
      
      // Create insight record (pending user vote)
      const [newInsight] = await db
        .insert(insights)
        .values({
          userId,
          title: generatedTitle,
          explanation: insight_text,
          confidence: 80, // Medium-high confidence
          themes: [] // Empty themes array for now
        })
        .returning();
      
      // Create life metric association if metric was found
      if (metric) {
        await db.insert(insightLifeMetrics).values({
          insightId: newInsight.id,
          lifeMetricId: metric.id
        });
      }
      
      // Return card data matching existing insight card format
      const result = {
        type: "insight",
        id: newInsight.id,
        title: generatedTitle,
        explanation: insight_text,
        confidence: 80
      };
      
      console.log("[shareInsightTool] ✅ Returning insight data:", result.type);
      return JSON.stringify(result);
    } catch (error) {
      console.error("[shareInsightTool] Error:", error);
      throw error;
    }
  }
});

/**
 * Helper tool: Vote on insight (called from frontend CTA)
 */
export const voteOnInsightTool = new DynamicStructuredTool({
  name: "vote_on_insight",
  description: `Records user's vote on an insight (upvote/downvote).
  
  This is typically called from the frontend, not by the agent directly.`,
  
  schema: z.object({
    insight_id: z.string().describe("UUID of the insight"),
    vote: z.enum(["upvote", "downvote"]).describe("User's vote")
  }),
  
  func: async ({ insight_id, vote }, config) => {
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
    }
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      const isUpvote = vote === "upvote";
      
      // Check if user already voted on this insight
      const existingVote = await db
        .select()
        .from(insightVotes)
        .where(
          and(
            eq(insightVotes.insightId, insight_id),
            eq(insightVotes.userId, userId)
          )
        )
        .limit(1);
      
      if (existingVote.length > 0) {
        // Update existing vote
        await db
          .update(insightVotes)
          .set({ isUpvote })
          .where(
            and(
              eq(insightVotes.insightId, insight_id),
              eq(insightVotes.userId, userId)
            )
          );
      } else {
        // Create new vote
        await db.insert(insightVotes).values({
          insightId: insight_id,
          userId,
          isUpvote
        });
      }
      
      return {
        success: true,
        message: vote === "upvote" ? "Thanks for the feedback!" : "Thanks, I'll keep learning about you.",
        vote: vote
      };
    } catch (error) {
      console.error("[voteOnInsightTool] Error:", error);
      throw error;
    }
  }
});

