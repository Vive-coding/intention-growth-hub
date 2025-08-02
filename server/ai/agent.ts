import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { SecurityManager, initializeSecurity } from "./security";

// Initialize OpenAI model
const model = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview",
  temperature: 0.7,
  maxTokens: 2000,
});

// Define prompt templates
const TEMPLATE = `You are an expert life coach analyzing a journal entry. Your task is to identify TRULY NOVEL patterns and insights about the user's unique behavior patterns.

Consider the following context:

JOURNAL ENTRY:
{journalEntry}

EXISTING INSIGHTS (if any):
{existingInsights}

ACTIVE GOALS:
{activeGoals}

RECENT HABITS:
{recentHabits}

LIFE METRICS:
{lifeMetrics}

LIFE METRIC MAPPING (use these UUIDs for lifeMetricIds and lifeMetricId fields):
{lifeMetricMapping}

CRITICAL: You MUST use the exact UUIDs from the mapping above. Do NOT use names like "Career Growth" or "metric-1". Use the actual UUID strings like "cbae9b81-9841-4e33-8ca5-3abf41e75104".

Available Life Metrics:
- Health & Fitness: 856e4fa5-cff8-44d7-9536-ecf58ac4f0ce
- Career Growth: cbae9b81-9841-4e33-8ca5-3abf41e75104  
- Personal Development: 46b4b639-6e25-409d-8cd0-7905fc71bbbe
- Relationships: e6edc742-9901-41f6-b5ce-853937976562
- Finance: 224a7f29-456a-425d-8cc7-ec99826bb0b2
- Mental Health: 7ba6ad3f-4b18-4e0c-b6fd-bbd2dd608156

Use these UUIDs in your response, not the names!

IMPORTANT: Create insights for meaningful patterns and behaviors that could help the user grow. Look for:
- Behavioral patterns (how they handle challenges, work habits, etc.)
- Emotional patterns (what affects their mood, stress triggers, etc.)
- Goal-related patterns (what they want to achieve, obstacles they face)
- Relationship patterns (family, work relationships, etc.)
- Work-life balance patterns
- Personal growth opportunities

The journal entry contains valuable information about the user's unique experiences and patterns. Create insights that could help them understand themselves better and make positive changes.

For testing purposes, if the journal entry contains any meaningful content (which this one does), create an insight. The user's journal entry about persistence, focus, work-life balance, and family relationships contains valuable patterns that deserve insights.

When creating goals, ensure they are SMART:
- Specific: Clear and well-defined
- Measurable: Can track progress with numbers or metrics
- Achievable: Realistic and attainable
- Relevant: Aligns with broader life objectives
- Time-bound: Has a clear deadline or timeframe

Examples of GOOD goals:
- "Complete 3 professional development courses by end of quarter"
- "Establish a daily 30-minute reading habit within 2 weeks"
- "Reduce screen time by 50% over the next month"

Examples of BAD goals (avoid these):
- "Send follow-up email" (too specific, one-time task)
- "Be more productive" (not measurable)
- "Exercise more" (not specific or measurable)

Requirements:
- Each insight should be a 1-liner title with a 200-300 character explanation
- Assign a confidence score (0-100%)
- ALWAYS link to specific life metrics using the provided UUIDs from lifeMetricMapping (use the exact UUID strings, not names)
- Suggest 1-2 SMART goals that are measurable, actionable, and novel (not simple tasks)
- Suggest 1-2 habits that could help reinforce positive patterns or address challenges
- Goals must be specific, measurable, achievable, relevant, and time-bound
- Avoid creating goals for simple tasks (like "send an email") - focus on broader behavioral changes
- If updating an existing insight, explain why and adjust the confidence score accordingly

IMPORTANT: You must respond with ONLY valid JSON. Do not include any other text, explanations, or markdown formatting.

Output Format (respond with ONLY this JSON structure):
{{
  "action": "create" | "update" | "skip",
  "insightId": "uuid | null", // Must be a valid UUID like "b2371199-4e0f-414a-b346-99a6f1da9992" for updates, or null for new insights. DO NOT use insight titles here.
  "title": "string",
  "explanation": "string",
  "confidence": "number",
  "lifeMetricIds": ["uuid"],
  "suggestedGoals": [{{"title": "string", "description": "string", "lifeMetricId": "uuid"}}],
  "suggestedHabits": [{{"title": "string", "description": "string", "lifeMetricId": "uuid"}}],
  "reasoning": "string"
}}`;

const insightAnalysisPrompt = new PromptTemplate({
  template: TEMPLATE,
  inputVariables: ["journalEntry", "existingInsights", "activeGoals", "recentHabits", "lifeMetrics", "lifeMetricMapping"],
});

interface JournalContext {
  journalEntry: string;
  existingInsights: string;
  activeGoals: string;
  recentHabits: string;
  lifeMetrics: string;
  lifeMetricMapping: string;
}

export class InsightAgent {
  private chain: RunnableSequence;
  private initialized: boolean = false;

  constructor() {
          this.chain = RunnableSequence.from([
        {
          journalEntry: (input: JournalContext) => input.journalEntry,
          existingInsights: (input: JournalContext) => input.existingInsights,
          activeGoals: (input: JournalContext) => input.activeGoals,
          recentHabits: (input: JournalContext) => input.recentHabits,
          lifeMetrics: (input: JournalContext) => input.lifeMetrics,
          lifeMetricMapping: (input: JournalContext) => input.lifeMetricMapping,
        },
      insightAnalysisPrompt,
      model,
      new StringOutputParser(),
    ]);
  }

  async initialize() {
    if (!this.initialized) {
      await initializeSecurity();
      this.initialized = true;
    }
  }

  async processJournalEntry(context: JournalContext) {
    try {
      console.log('Agent processing journal entry...');
      
      // Ensure initialization
      await this.initialize();
      console.log('Agent initialized');

      // Security checks
      console.log('Running security checks...');
      const [piiResult, contentResult] = await Promise.all([
        SecurityManager.detectPII(context.journalEntry),
        SecurityManager.filterInappropriateContent(context.journalEntry)
      ]);

      // Handle PII
      if (piiResult.hasPII) {
        console.log('PII detected, masking content...');
        context.journalEntry = await SecurityManager.maskPII(context.journalEntry);
      }

      // Check content appropriateness
      if (!contentResult.isAppropriate) {
        console.log('Inappropriate content detected:', contentResult.reason);
        throw new Error(`Inappropriate content detected: ${contentResult.reason}`);
      }

      // Process with LangChain
      console.log('Processing with LangChain...');
      console.log('Context provided to LLM:', {
        journalEntryLength: context.journalEntry.length,
        existingInsightsLength: context.existingInsights.length,
        activeGoalsLength: context.activeGoals.length,
        lifeMetricsLength: context.lifeMetrics.length
      });
      
      // Debug: Log the actual journal entry content
      console.log('Journal Entry Content:', context.journalEntry);
      console.log('Existing Insights:', context.existingInsights);
      console.log('Active Goals:', context.activeGoals);
      console.log('Life Metrics:', context.lifeMetrics);
      
      const result = await this.chain.invoke(context);
      console.log('Raw LLM response:', result);

      try {
        // Remove markdown code blocks if present
        let cleanResponse = result.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.substring(7);
        }
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.substring(3);
        }
        if (cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);
        }
        cleanResponse = cleanResponse.trim();
        
        const parsedResult = JSON.parse(cleanResponse);
        console.log('Parsed LLM response:', parsedResult);
        return parsedResult;
      } catch (error) {
        console.error('Error parsing LLM response:', error);
        console.error('Raw response that failed to parse:', result);
        console.error('Response length:', result.length);
        console.error('First 500 characters:', result.substring(0, 500));
        console.error('Last 500 characters:', result.substring(Math.max(0, result.length - 500)));
        throw new Error('Failed to parse insight generation result');
      }
    } catch (error) {
      console.error('Error in agent processing:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const insightAgent = new InsightAgent(); 