/**
 * Judge Agent for Automated Evaluation
 * 
 * This agent evaluates life coach conversations against the rubric defined in rubric.md
 * It uses GPT-4 to score conversations on 5 dimensions and identify issues.
 */

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

// Evaluation result schema
export const EvaluationResultSchema = z.object({
  conversationId: z.string(),
  timestamp: z.string(),
  scores: z.object({
    toolUsage: z.number().min(0).max(5).describe("Tool usage appropriateness (0-5)"),
    responseQuality: z.number().min(0).max(5).describe("Response quality (0-5)"),
    goalUnderstanding: z.number().min(0).max(5).describe("Goal understanding & context awareness (0-5)"),
    actionability: z.number().min(0).max(5).describe("Actionability & next steps (0-5)"),
    frameworkApplication: z.number().min(0).max(5).describe("Coaching framework application (0-5)"),
  }),
  conversationMetrics: z.object({
    flowQuality: z.enum(["pass", "fail"]).describe("Natural conversation flow"),
    userEngagement: z.enum(["pass", "fail"]).describe("User engagement level"),
    outcomeAchievement: z.enum(["pass", "fail"]).describe("Tangible outcome achieved"),
  }),
  criticalIssues: z.array(z.string()).describe("List of critical issues found"),
  qualityIssues: z.array(z.string()).describe("List of quality issues found"),
  goodExamples: z.array(z.string()).describe("List of good examples to reinforce"),
  overallAssessment: z.string().describe("Brief summary of conversation quality"),
  recommendations: z.array(z.string()).describe("Specific improvements for this conversation pattern"),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// Conversation format for evaluation
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    tool: string;
    input: any;
    output?: any;
  }>;
}

export interface ConversationToEvaluate {
  id: string;
  messages: ConversationMessage[];
  metadata?: {
    userType?: "new" | "returning";
    outcome?: string;
    duration?: number;
  };
}

/**
 * Judge Agent class
 */
export class JudgeAgent {
  private model: ChatOpenAI;
  private prompt: PromptTemplate;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0.1, // Low temperature for consistent evaluation
      maxTokens: 2000,
    });

    this.prompt = new PromptTemplate({
      template: `You are an expert evaluator of AI coaching conversations. Your job is to score conversations against a detailed rubric.

## Evaluation Rubric

### 1. Tool Usage Appropriateness (0-5)
- **5**: All tools appropriate, optimal timing, correct parameters
- **4**: Most tools appropriate, minor timing issues
- **3**: Some unnecessary tools or one missing tool call
- **2**: Multiple wrong tools or missing critical tools
- **1**: Frequent inappropriate usage
- **0**: Complete failure to use tools

### 2. Response Quality (0-5)
- **5**: Warm, empathetic, clear, concise, natural
- **4**: Good tone, mostly clear
- **3**: Acceptable tone, some verbosity
- **2**: Robotic or confusing
- **1**: Inappropriate tone or very confusing
- **0**: Offensive or unhelpful

### 3. Goal Understanding & Context Awareness (0-5)
- **5**: Perfect understanding, remembers context, makes good inferences
- **4**: Good understanding, mostly remembers context
- **3**: Basic understanding, some context loss
- **2**: Misunderstands main intent, forgets context
- **1**: Frequent misunderstandings
- **0**: Cannot understand simple requests

### 4. Actionability & Next Steps (0-5)
- **5**: Clear, specific, realistic next steps
- **4**: Good next steps, minor ambiguity
- **3**: Vague next steps
- **2**: No clear next steps or unrealistic
- **1**: No actionability
- **0**: Actively blocks progress

### 5. Coaching Framework Application (0-5)
- **5**: Frameworks applied invisibly and appropriately
- **4**: Frameworks mostly applied well
- **3**: Mechanical application
- **2**: Frameworks mentioned by name or rigid
- **1**: No framework visible
- **0**: Contradicts coaching principles

## Conversation to Evaluate

{conversation}

## Your Task

Evaluate this conversation carefully against the rubric. Provide:

1. **Scores** (0-5) for each of the 5 dimensions
2. **Conversation Metrics** (pass/fail) for:
   - Flow Quality: Natural progression?
   - User Engagement: User shares details and emotions?
   - Outcome Achievement: Tangible result (goal created, progress logged, clarity gained)?
3. **Critical Issues**: List any hallucinations, tool failures, context loss, inappropriate suggestions
4. **Quality Issues**: List verbose responses, robotic tone, weak suggestions, duplicate goals
5. **Good Examples**: Note specific good responses or interactions
6. **Overall Assessment**: 2-3 sentence summary
7. **Recommendations**: 2-3 specific improvements for this conversation pattern

## Response Format

Respond with ONLY valid JSON matching this structure:

{{
  "conversationId": "{conversationId}",
  "timestamp": "{timestamp}",
  "scores": {{
    "toolUsage": <number 0-5>,
    "responseQuality": <number 0-5>,
    "goalUnderstanding": <number 0-5>,
    "actionability": <number 0-5>,
    "frameworkApplication": <number 0-5>
  }},
  "conversationMetrics": {{
    "flowQuality": "pass" | "fail",
    "userEngagement": "pass" | "fail",
    "outcomeAchievement": "pass" | "fail"
  }},
  "criticalIssues": ["issue1", "issue2", ...],
  "qualityIssues": ["issue1", "issue2", ...],
  "goodExamples": ["example1", "example2", ...],
  "overallAssessment": "2-3 sentence summary",
  "recommendations": ["rec1", "rec2", "rec3"]
}}`,
      inputVariables: ["conversation", "conversationId", "timestamp"],
    });
  }

  /**
   * Evaluate a single conversation
   */
  async evaluateConversation(
    conversation: ConversationToEvaluate
  ): Promise<EvaluationResult> {
    // Format conversation for the prompt
    const formattedConversation = this.formatConversation(conversation);

    // Get evaluation from judge model
    const prompt = await this.prompt.format({
      conversation: formattedConversation,
      conversationId: conversation.id,
      timestamp: new Date().toISOString(),
    });

    const response = await this.model.call([
      { role: "system", content: "You are an expert conversation evaluator. Respond with valid JSON only." },
      { role: "user", content: prompt },
    ]);

    // Parse JSON response
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from judge response");
    }

    const evaluation = JSON.parse(jsonMatch[0]);

    // Validate against schema
    return EvaluationResultSchema.parse(evaluation);
  }

  /**
   * Evaluate multiple conversations in batch
   */
  async evaluateBatch(
    conversations: ConversationToEvaluate[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (let i = 0; i < conversations.length; i++) {
      try {
        const result = await this.evaluateConversation(conversations[i]);
        results.push(result);

        if (onProgress) {
          onProgress(i + 1, conversations.length);
        }
      } catch (error) {
        console.error(`Failed to evaluate conversation ${conversations[i].id}:`, error);
        // Continue with next conversation
      }
    }

    return results;
  }

  /**
   * Calculate aggregate statistics from evaluation results
   */
  calculateStatistics(results: EvaluationResult[]): {
    averageScores: {
      toolUsage: number;
      responseQuality: number;
      goalUnderstanding: number;
      actionability: number;
      frameworkApplication: number;
      overall: number;
    };
    passRates: {
      flowQuality: number;
      userEngagement: number;
      outcomeAchievement: number;
    };
    mostCommonIssues: {
      critical: Map<string, number>;
      quality: Map<string, number>;
    };
    topRecommendations: Map<string, number>;
  } {
    if (results.length === 0) {
      throw new Error("No results to calculate statistics from");
    }

    // Calculate average scores
    const scoresSumagg = results.reduce(
      (acc, r) => ({
        toolUsage: acc.toolUsage + r.scores.toolUsage,
        responseQuality: acc.responseQuality + r.scores.responseQuality,
        goalUnderstanding: acc.goalUnderstanding + r.scores.goalUnderstanding,
        actionability: acc.actionability + r.scores.actionability,
        frameworkApplication: acc.frameworkApplication + r.scores.frameworkApplication,
      }),
      { toolUsage: 0, responseQuality: 0, goalUnderstanding: 0, actionability: 0, frameworkApplication: 0 }
    );

    const count = results.length;
    const averageScores = {
      toolUsage: scoresSumagg.toolUsage / count,
      responseQuality: scoresSumagg.responseQuality / count,
      goalUnderstanding: scoresSumagg.goalUnderstanding / count,
      actionability: scoresSumagg.actionability / count,
      frameworkApplication: scoresSumagg.frameworkApplication / count,
      overall:
        (scoresSumagg.toolUsage +
          scoresSumagg.responseQuality +
          scoresSumagg.goalUnderstanding +
          scoresSumagg.actionability +
          scoresSumagg.frameworkApplication) /
        (5 * count),
    };

    // Calculate pass rates
    const passRates = {
      flowQuality: results.filter((r) => r.conversationMetrics.flowQuality === "pass").length / count,
      userEngagement: results.filter((r) => r.conversationMetrics.userEngagement === "pass").length / count,
      outcomeAchievement: results.filter((r) => r.conversationMetrics.outcomeAchievement === "pass").length / count,
    };

    // Count issue occurrences
    const criticalIssues = new Map<string, number>();
    const qualityIssues = new Map<string, number>();
    const recommendations = new Map<string, number>();

    for (const result of results) {
      result.criticalIssues.forEach((issue) => {
        criticalIssues.set(issue, (criticalIssues.get(issue) || 0) + 1);
      });
      result.qualityIssues.forEach((issue) => {
        qualityIssues.set(issue, (qualityIssues.get(issue) || 0) + 1);
      });
      result.recommendations.forEach((rec) => {
        recommendations.set(rec, (recommendations.get(rec) || 0) + 1);
      });
    }

    return {
      averageScores,
      passRates,
      mostCommonIssues: {
        critical: criticalIssues,
        quality: qualityIssues,
      },
      topRecommendations: recommendations,
    };
  }

  /**
   * Format conversation for evaluation prompt
   */
  private formatConversation(conversation: ConversationToEvaluate): string {
    let formatted = "";

    if (conversation.metadata) {
      formatted += `Metadata:\n`;
      formatted += `- User Type: ${conversation.metadata.userType || "unknown"}\n`;
      formatted += `- Outcome: ${conversation.metadata.outcome || "unknown"}\n`;
      formatted += `\n`;
    }

    formatted += `Conversation:\n\n`;

    for (let i = 0; i < conversation.messages.length; i++) {
      const msg = conversation.messages[i];
      formatted += `[Message ${i + 1}] ${msg.role.toUpperCase()}:\n`;
      formatted += `${msg.content}\n`;

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formatted += `\nTool Calls:\n`;
        msg.toolCalls.forEach((call) => {
          formatted += `- ${call.tool}(${JSON.stringify(call.input)})\n`;
          if (call.output) {
            formatted += `  Output: ${JSON.stringify(call.output).substring(0, 200)}...\n`;
          }
        });
      }

      formatted += `\n`;
    }

    return formatted;
  }
}

/**
 * Export singleton instance
 */
export const judgeAgent = new JudgeAgent();

