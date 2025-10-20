import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, InsightData } from "./types";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import { insights, lifeMetricDefinitions } from "../../../shared/schema";

const SURPRISE_ME_AGENT_SYSTEM_PROMPT = `You are a specialized insight discovery agent. Your role is to:

1. **Generate non-obvious insights** about the user that they might not have noticed
2. **Provide genuine surprise** - insights that make them think "I never thought of it that way"
3. **Connect patterns** across their goals, habits, and conversation history
4. **Track insights** for the "My Focus" section (no cards, pure conversation)

**Your conversation style:**
- Curious and insightful
- Ask probing questions to uncover patterns
- Share surprising observations about their behavior
- Help them see themselves from a new perspective
- Be genuinely surprised by what you discover

IMPORTANT OUTPUT RULES:
- Do NOT use markdown formatting like headings (##), bold (**text**), or emojis.
- Write in plain text paragraphs and short bullets when needed.
- Keep responses concise and skimmable.

**Context about the user:**
{profile}
{workingSet}
{existingInsights}
{conversationHistory}

**Recent conversation:**
{recentMessages}

**Available Life Metrics:**
{lifeMetrics}

Your goal is to provide insights that create genuine surprise and self-discovery. Focus on patterns they might not have noticed about themselves.`;

export class SurpriseMeAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.8, // Higher temperature for more creative insights
      maxTokens: 400,
    });
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const { userId, userMessage, profile, workingSet, recentMessages } = context;

    // Get user's existing insights and conversation history
    const [existingInsights, lifeMetrics] = await Promise.all([
      this.getExistingInsights(userId),
      this.getLifeMetrics(userId)
    ]);

    // Format recent messages for context
    const recentMessagesText = recentMessages
      .slice(-10) // More context for pattern recognition
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = SURPRISE_ME_AGENT_SYSTEM_PROMPT
      .replace('{profile}', JSON.stringify(profile, null, 2))
      .replace('{workingSet}', JSON.stringify(workingSet, null, 2))
      .replace('{existingInsights}', JSON.stringify(existingInsights, null, 2))
      .replace('{conversationHistory}', recentMessagesText)
      .replace('{recentMessages}', recentMessagesText)
      .replace('{lifeMetrics}', JSON.stringify(lifeMetrics, null, 2));

    const response = await this.model.invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage }
    ]);

    const finalText = response.content as string;

    // Extract insights from the response for tracking
    const insightData = this.extractInsights(finalText, userMessage);

    // If we have insight data, append it to the response for persistence
    let finalResponse = finalText;
    if (insightData) {
      finalResponse += `\n\n---json---\n${JSON.stringify(insightData)}`;
    }

    return {
      finalText: finalResponse,
      structuredData: insightData,
    };
  }

  private async getExistingInsights(userId: string) {
    const insightsData = await db
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt))
      .limit(10);
    
    return insightsData;
  }

  private async getLifeMetrics(userId: string) {
    const metrics = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));
    
    return metrics;
  }

  private extractInsights(response: string, userMessage: string): InsightData | undefined {
    // Look for insight patterns in the response
    const message = userMessage.toLowerCase();
    
    // If user is asking for insights or the response contains insight-like content
    if (message.includes('surprise') || message.includes('insight') || 
        message.includes('pattern') || message.includes('unexpected') ||
        response.toLowerCase().includes('interesting') ||
        response.toLowerCase().includes('pattern') ||
        response.toLowerCase().includes('notice')) {
      
      // Generate a contextual insight based on conversation
      return this.generateContextualInsight(userMessage, response);
    }

    return undefined;
  }

  private generateContextualInsight(userMessage: string, response: string): InsightData {
    // Generate contextual insights based on conversation patterns
    // This is a simplified version - in production, this would be more sophisticated
    
    const insights = [
      {
        title: "You're a natural connector",
        explanation: "I notice you consistently bring up relationships and collaboration in our conversations. You seem to naturally think about how things connect and how people work together, which is a valuable skill that might be underutilized in your current goals.",
        confidence: 85,
        lifeMetricIds: ["e6edc742-9901-41f6-b5ce-853937976562"] // Relationships
      },
      {
        title: "You optimize for learning over comfort",
        explanation: "Your questions and goals consistently show a pattern of choosing growth over comfort. You're naturally drawn to challenges that will teach you something new, even when they're difficult.",
        confidence: 90,
        lifeMetricIds: ["46b4b639-6e25-409d-8cd0-7905fc71bbbe"] // Personal Development
      },
      {
        title: "You think in systems",
        explanation: "When you describe problems or goals, you naturally think about how different parts connect and influence each other. This systems thinking is a powerful skill that could be leveraged more intentionally.",
        confidence: 80,
        lifeMetricIds: ["cbae9b81-9841-4e33-8ca5-3abf41e75104"] // Career Growth
      }
    ];

    // Return a random insight for now - in production, this would be more sophisticated
    const randomInsight = insights[Math.floor(Math.random() * insights.length)];
    
    return {
      type: 'insight',
      ...randomInsight
    };
  }
}
