import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { insights, lifeMetricDefinitions } from "../../../shared/schema";
import { eq } from "drizzle-orm";

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
  
  IMPORTANT: Always ask first if it resonates!
  Examples: "Does this resonate with you?" or "Is this something you hadn't realized before?"
  Only call this tool if they confirm it's valuable/new to them.
  
  Returns: Insight card with thumbs up/down for user feedback`,
  
  schema: z.object({
    insight_text: z.string().describe("The breakthrough insight or pattern"),
    life_metric: z.string().describe("Life area category")
  }),
  
  func: async ({ insight_text, life_metric }, config) => {
    const userId = config?.configurable?.userId;
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
      
      // Create insight record (pending user vote)
      const [newInsight] = await db
        .insert(insights)
        .values({
          userId,
          title: insight_text.slice(0, 100), // First 100 chars as title
          explanation: insight_text,
          confidence: 80, // Medium-high confidence
          lifeMetricIds,
          votes: 0, // Will be updated when user votes
          source: "agent_conversation",
          createdAt: new Date()
        })
        .returning();
      
      // Return card data matching existing insight card format
      const result = {
        type: "insight",
        id: newInsight.id,
        title: insight_text.slice(0, 100),
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
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      const voteValue = vote === "upvote" ? 1 : -1;
      
      await db
        .update(insights)
        .set({ votes: voteValue })
        .where(eq(insights.id, insight_id));
      
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

