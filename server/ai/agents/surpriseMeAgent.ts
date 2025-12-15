import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, InsightData } from "./types";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import { insights, lifeMetricDefinitions } from "../../../shared/schema";
import { z } from "zod";

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

const SURPRISE_RESPONSE_SCHEMA = z.object({
  message: z.string().describe("The conversational response delivered to the user."),
  startNewThread: z.boolean().default(false).describe("Whether this insight would be better delivered in a separate thread."),
  insight: z.object({
    title: z.string().describe("Short headline summarizing the novel insight."),
    explanation: z.string().describe("Concise explanation of the pattern or trait discovered."),
    confidence: z.number().min(0).max(100).describe("Confidence (0-100)."),
    noveltyReason: z.string().describe("Why this insight is non-obvious or surprising."),
    actionableNextStep: z.string().optional().describe("Optional suggestion for how the user can leverage the insight."),
    lifeMetricNames: z.array(z.string()).default([]).describe("Life metrics that relate to this insight."),
  }),
});

export class SurpriseMeAgent {
  private model: ChatOpenAI;
  private structuredModel: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-5-nano",
      temperature: 0.7,
    });
    this.structuredModel = new ChatOpenAI({
      model: "gpt-5-nano",
      temperature: 0.7,
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

    const parser = this.structuredModel.withStructuredOutput(SURPRISE_RESPONSE_SCHEMA, {
      name: "surprise_me_response",
    });

    let structured: z.infer<typeof SURPRISE_RESPONSE_SCHEMA>;
    let noveltyCheck = { isGeneric: false, reasons: [] as string[], score: 1 };
    let retryInstruction = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      structured = await parser.invoke([
        {
          role: 'system',
          content: `${prompt}\n\nProduce a JSON response following the provided schema. Avoid repeating any existing insights. Focus on traits that are genuinely surprising.${retryInstruction}`,
        },
        { role: 'user', content: userMessage },
      ]);

      const candidateExplanation = [structured.insight.explanation, structured.insight.noveltyReason]
        .filter(Boolean)
        .join("\n\n");
      noveltyCheck = this.assessNovelty(structured.insight.title, candidateExplanation);
      console.log('[SurpriseMeAgent] Novelty check', {
        attempt: attempt + 1,
        score: noveltyCheck.score,
        generic: noveltyCheck.isGeneric,
        reasons: noveltyCheck.reasons,
      });

      if (!noveltyCheck.isGeneric) {
        break;
      }
      retryInstruction = `\n\nThe previous insight felt generic because: ${noveltyCheck.reasons.join(", ")}. Provide a more unexpected observation tied to specific evidence from the context.`;
    }

    const mappedLifeMetricIds = this.mapLifeMetricNames(structured.insight.lifeMetricNames, lifeMetrics);
    const explanationParts = [structured.insight.explanation.trim()];
    if (structured.insight.noveltyReason) {
      explanationParts.push(`Why this is unique: ${structured.insight.noveltyReason.trim()}`);
    }
    if (structured.insight.actionableNextStep) {
      explanationParts.push(`Next step: ${structured.insight.actionableNextStep.trim()}`);
    }

    const insightData: InsightData = {
      type: 'insight',
      title: structured.insight.title.trim(),
      explanation: explanationParts.join('\n\n'),
      confidence: Math.min(100, Math.max(0, Math.round(structured.insight.confidence))),
      lifeMetricIds: mappedLifeMetricIds,
    };

    const finalText = structured.message.trim();
    const responsePayload = `${finalText}\n\n---json---\n${JSON.stringify(insightData)}`;

    return {
      finalText: responsePayload,
      structuredData: {
        ...insightData,
        startNewThread: structured.startNewThread ?? false,
        noveltyScore: noveltyCheck.score,
        noveltyWarnings: noveltyCheck.reasons,
      },
      cta: structured.startNewThread ? 'Start new insight thread' : undefined,
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

  private mapLifeMetricNames(names: string[] | undefined, metrics: any[]): string[] {
    if (!Array.isArray(names) || names.length === 0) return [];
    const normalized = names.map((name) => name.toLowerCase().trim()).filter(Boolean);
    if (normalized.length === 0) return [];
    const matches: string[] = [];
    for (const metric of metrics) {
      const metricName = String(metric.name || '').toLowerCase();
      if (normalized.includes(metricName)) {
        matches.push(metric.id);
      }
    }
    return matches;
  }

  private assessNovelty(title: string, explanation: string) {
    const text = `${title} ${explanation}`.toLowerCase();
    const genericIndicators = [
      { phrase: 'work-life balance', reason: 'mentions work-life balance' },
      { phrase: 'stay positive', reason: 'contains generic encouragement' },
      { phrase: 'keep up the good work', reason: 'encourages without new information' },
      { phrase: 'consistency is key', reason: 'states obvious habit advice' },
      { phrase: 'focus on your goals', reason: 'generic goal reminder' },
      { phrase: 'take care of yourself', reason: 'generic self-care message' },
    ];

    const reasons: string[] = [];
    for (const indicator of genericIndicators) {
      if (text.includes(indicator.phrase)) {
        reasons.push(indicator.reason);
      }
    }

    if (title.trim().length < 8) {
      reasons.push('insight title too short');
    }
    const wordCount = explanation.trim().split(/\s+/).length;
    if (wordCount < 30) {
      reasons.push('explanation lacks depth');
    }
    if (!/[0-9]/.test(explanation) && !/(project|habit|pattern|conversation|journal|thread)/i.test(explanation)) {
      reasons.push('missing references to specific behavior');
    }

    const isGeneric = reasons.length > 0;
    const score = Math.max(0, 1 - reasons.length * 0.25);
    return { isGeneric, reasons, score: Number(score.toFixed(2)) };
  }
}
