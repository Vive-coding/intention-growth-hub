import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { SecurityManager, initializeSecurity } from "./security";
import { db } from "../db";
import { feedbackEvents, acceptanceMetrics, goalDefinitions, habitDefinitions, insights as insightsTable } from "../../shared/schema";
import { and, eq } from "drizzle-orm";
import { retrieveResearch } from "./tools/researchRetriever";
import { retrieveUserHistory } from "./tools/userHistoryRetriever";
import { loadResearchBriefCapped } from "./research";
import { embedQuery } from "./utils/embeddings";

// Similarity checking utilities
interface SimilarityCheckResult {
  isSimilar: boolean;
  similarityScore: number;
  similarItems: Array<{ id: string; title: string; type: 'goal' | 'habit' | 'insight'; similarity: number }>;
}

class SimilarityChecker {
  private static readonly SIMILARITY_THRESHOLD = 0.85; // Cosine similarity threshold
  
  /**
   * Check if a new suggestion is similar to existing items
   */
  static async checkExistingSimilarity(
    userId: string,
    newTitle: string,
    newDescription: string,
    type: 'goal' | 'habit' | 'insight'
  ): Promise<SimilarityCheckResult> {
    try {
      // Generate embedding for new item
      const newText = `${newTitle} ${newDescription}`;
      const newEmbedding = await embedQuery(newText);
      
      // Get existing items of the same type
      let existingItems: Array<{ id: string; title: string; description?: string }> = [];
      
      if (type === 'goal') {
        const goals = await db
          .select({ id: goalDefinitions.id, title: goalDefinitions.title, description: goalDefinitions.description })
          .from(goalDefinitions)
          .where(eq(goalDefinitions.userId, userId));
        existingItems = goals.map(g => ({ id: g.id, title: g.title, description: g.description ?? '' }));
      } else if (type === 'habit') {
        const habits = await db
          .select({ id: habitDefinitions.id, title: habitDefinitions.name, description: habitDefinitions.description })
          .from(habitDefinitions)
          .where(eq(habitDefinitions.userId, userId));
        existingItems = habits.map(h => ({ id: h.id, title: h.title, description: h.description ?? '' }));
      } else if (type === 'insight') {
        const insightsRows = await db
          .select({ id: insightsTable.id, title: insightsTable.title, description: insightsTable.explanation })
          .from(insightsTable)
          .where(eq(insightsTable.userId, userId));
        existingItems = insightsRows.map(i => ({ id: i.id, title: i.title, description: i.description ?? '' }));
      }
      
      if (existingItems.length === 0) {
        return { isSimilar: false, similarityScore: 0, similarItems: [] };
      }
      
      // Check similarity against each existing item
      let maxSimilarity = 0;
      const similarItems: Array<{ id: string; title: string; type: 'goal' | 'habit' | 'insight'; similarity: number }> = [];
      
      for (const item of existingItems) {
        const itemText = `${item.title} ${item.description || ''}`;
        const itemEmbedding = await embedQuery(itemText);
        
        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(newEmbedding, itemEmbedding);
        
        if (similarity > this.SIMILARITY_THRESHOLD) {
          similarItems.push({
            id: item.id,
            title: item.title,
            type,
            similarity
          });
        }
        
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      return {
        isSimilar: maxSimilarity > this.SIMILARITY_THRESHOLD,
        similarityScore: maxSimilarity,
        similarItems
      };
      
    } catch (error) {
      console.warn('Error checking existing similarity:', error);
      return { isSimilar: false, similarityScore: 0, similarItems: [] };
    }
  }
  
  /**
   * Check similarity among new suggestions to avoid duplicates
   */
  static async checkNewSuggestionsSimilarity(
    suggestions: Array<{ title: string; description: string; type: 'goal' | 'habit' | 'insight' }>
  ): Promise<Array<{ index: number; similarTo: number[]; shouldRemove: boolean }>> {
    if (suggestions.length <= 1) return [];
    
    const results: Array<{ index: number; similarTo: number[]; shouldRemove: boolean }> = [];
    
          for (let i = 0; i < suggestions.length; i++) {
        const current = suggestions[i];
        const currentText = `${current.title} ${current.description}`;
        const currentEmbedding = await embedQuery(currentText);
        
        const similarTo: number[] = [];
        
        for (let j = i + 1; j < suggestions.length; j++) {
          const other = suggestions[j];
          const otherText = `${other.title} ${other.description}`;
          const otherEmbedding = await embedQuery(otherText);
          
          const similarity = this.cosineSimilarity(currentEmbedding, otherEmbedding);
          
          if (similarity > this.SIMILARITY_THRESHOLD) {
            similarTo.push(j);
        }
        }
        
        // Mark for removal if it's too similar to multiple others
        const shouldRemove = similarTo.length > 0;
        
        results.push({
          index: i,
          similarTo,
          shouldRemove
        });
      }
    
    return results;
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Initialize OpenAI model
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 4000, // Increased for comprehensive two-phase analysis
});

// Define prompt templates
const TEMPLATE = `You are an expert life coach analyzing a journal entry. Your task is to identify TRULY NOVEL patterns and insights about the user's unique behavior patterns.

IMPORTANT: This is a TWO-PHASE PROCESS that you MUST follow:

PHASE 1: EXTRACT ALL NOVEL IDEAS
First, identify EVERY creative thought, idea, insight, or opportunity mentioned in the journal entry. Don't limit yourself - capture everything that could be valuable, even if it's just a seed of an idea. Look for at least 4-6 distinct ideas.

PHASE 2: CURATE FOR QUALITY
From all the ideas extracted in Phase 1, select the BEST 1-2 insights and 2-4 goals/habits that meet quality standards. Quality over quantity - but ensure you're not artificially limiting good ideas.

CRITICAL: If the journal entry contains multiple distinct ideas (like AI persona, recruiting systems, creative approaches, skill development), you MUST capture at least 2-3 of these different ideas in your goals. Don't focus on just one theme.

Consider the following context:

RESEARCH_BRIEF (evidence-based frameworks the assistant must follow) [capped]:
{researchBrief}

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

RESEARCH_SUPPORT (top retrieved snippets):
{researchSupport}

RELATED_HISTORY (top retrieved user items):
{relatedHistory}

LIFE METRIC MAPPING (use these UUIDs for lifeMetricIds and lifeMetricId fields):
{lifeMetricMapping}

CRITICAL: You MUST use the exact UUIDs from the mapping above. Do NOT use names like "Career Growth" or "metric-1". Use the exact UUID strings like "cbae9b81-9841-4e33-8ca5-3abf41e75104".

Available Life Metrics:
- Health & Fitness: 856e4fa5-cff8-44d7-9536-ecf58ac4f0ce
- Career Growth: cbae9b81-9841-4e33-8ca5-3abf41e75104  
- Personal Development: 46b4b639-6e25-409d-8cd0-7905fc71bbbe
- Relationships: e6edc742-9901-41f6-b5ce-853937976562
- Finance: 224a7f29-456a-425d-8cc7-ec99826bb0b2
- Mental Health: 7ba6ad3f-4b18-4e0c-b6fd-bbd2dd608156

Use these UUIDs in your response, not the names!

PHASE 1: IDEA EXTRACTION
Look for ALL of these types of ideas in the journal entry:
- **Creative concepts**: New approaches, reframing, innovative thinking
- **Growth opportunities**: Skills to develop, areas to improve, challenges to overcome
- **Behavioral insights**: Patterns, habits, routines, decision-making processes
- **Emotional insights**: Mood patterns, stress triggers, motivation factors
- **Goal-oriented thoughts**: What you want to achieve, obstacles, progress
- **Relationship insights**: Work dynamics, communication, collaboration
- **Work-life patterns**: Time management, energy allocation, boundaries
- **Personal breakthroughs**: Areas of stuckness, recurring challenges, solutions

PHASE 2: QUALITY CURATION
From all extracted ideas, select only the BEST that meet these standards:

QUALITY STANDARDS:
- Each insight must reveal a PATTERN, not just an observation
- Must be specific enough to be actionable
- Should connect to broader life themes, not isolated incidents
- Must provide genuine self-awareness value

GOAL QUALITY REQUIREMENTS:
- Goals must be SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Focus on broader behavioral changes, not simple tasks
- Address specific areas of growth or challenge
- Ambitious but realistic

HABIT QUALITY REQUIREMENTS:
- Specific and actionable (e.g., "Practice deep breathing for 5 minutes when stressed")
- Tied to specific goals and life metrics
- Daily or weekly routines, not one-time actions
- Clear trigger or context
- HIGH LEVERAGE: Habits should be applicable to multiple goals when possible
- NOVEL & INTERESTING: Habits should be unique and shareable (not generic "go for a walk")

GOAL-HABIT STRUCTURE:
For each suggested goal, provide 2-3 specific habits:
- priority: 1 (Essential) - Critical for goal success
- priority: 2 (Helpful) - Supportive but not required
- priority: 3 (Optional) - Nice to have
- Mark high-leverage habits with isHighLeverage: true

HIGH LEVERAGE CRITERIA:
- Habit supports multiple goal types (career + personal development)
- Habit is a meta-skill (reflection, learning, communication)
- Example: "Energy Autopsy" helps career, health, personal goals

NOVELTY REQUIREMENTS:
Current daily habits: {currentDailyHabitCount}/10
- Habits must be NOVEL and INTERESTING
- Users should feel proud to share with others
- Not generic ("exercise", "meditate", "drink water")
- Include specific triggers and actions

CONTEXT TO AVOID DUPLICATES:
Recently Accepted Goals:
{recentAcceptedGoals}

Recently Accepted Habits:
{recentAcceptedHabits}

Upvoted Insights:
{upvotedInsights}

HIGH-LEVERAGE HABIT EXAMPLES:
✓ "Energy Autopsy" (Daily): One line each night - what gave me energy? What drained me?
✓ "One-Sentence Story" (Daily): Capture the story of your day in one sentence
✓ "Future Self Ping" (Weekly): Write a short note to "3 months from now me"
✓ "Uncomfortable Compliment" (Daily/Weekly): Give one compliment that feels slightly vulnerable
✓ "Micro-Adventure" (Weekly): Try one novel thing (new café, route, wardrobe experiment)
✓ "Second Brain Snapshot" (Daily): Capture the most surprising thing you learned today
✓ "Skill Dividend" (Weekly): Apply one existing skill in a new context

BAD HABITS (too generic):
✗ "Exercise daily"
✗ "Meditate for 10 minutes"
✗ "Drink 8 glasses of water"
✗ "Read before bed"

FINAL OUTPUT CONSTRAINTS:
- Generate 1-2 insights (only the most impactful)
- Generate 2-4 goals total (capture more ideas while maintaining quality)
- Each goal should include 2-3 habits (nested structure)
- Quality over quantity - but don't artificially limit good ideas
- Keep total daily habit count under 10 across all goals

Examples of GOOD goals:
- "Complete 3 professional development courses by end of quarter" (specific, measurable, time-bound)
- "Establish a daily 30-minute reading habit within 2 weeks" (specific, measurable, time-bound)
- "Reduce screen time by 50% over the next month" (specific, measurable, time-bound)

Examples of BAD goals (avoid these):
- "Send follow-up email" (too specific, one-time task)
- "Be more productive" (not measurable)
- "Learn new skills" (not specific or measurable)

Requirements:
- Each insight should be a 1-liner title with a 200-300 character explanation
- Assign a confidence score (0-100%)
- ALWAYS link to specific life metrics using the provided UUIDs from lifeMetricMapping
- Suggest 1-2 SMART goals that are measurable, actionable, and novel
- Each goal must include 2-3 habits in a NESTED structure
- Don't refer to the user as "the user", refer to them as "you" in most cases

IMPORTANT: You must respond with ONLY valid JSON. Do not include any other text, explanations, or markdown formatting.

Output Format (respond with ONLY this JSON structure):
{{
  "action": "create" | "update" | "skip",
  "insightId": "uuid | null", // Must be a valid UUID like "b2371199-4e0f-414a-b346-99a6f1da9992" for updates, or null for new insights. DO NOT use insight titles here.
  "title": "string",
  "explanation": "string",
  "confidence": "number",
  "lifeMetricIds": ["uuid"],
  "suggestedGoals": [
    {{
      "title": "string",
      "description": "string",
      "lifeMetricId": "uuid",
      "habits": [
        {{
          "title": "string",
          "description": "string",
          "lifeMetricId": "uuid",
          "priority": 1,
          "isHighLeverage": true,
          "applicableGoalTypes": ["career", "personal"],
          "frequency": "daily",
          "targetCount": 1
        }}
      ]
    }}
  ],
  "reasoning": "string"
}}`;

const insightAnalysisPrompt = new PromptTemplate({
  template: TEMPLATE,
  inputVariables: ["researchBrief", "journalEntry", "existingInsights", "activeGoals", "recentHabits", "lifeMetrics", "researchSupport", "relatedHistory", "lifeMetricMapping", "recentAcceptedGoals", "recentAcceptedHabits", "upvotedInsights", "currentDailyHabitCount"],
});

interface JournalContext {
  journalEntry: string;
  existingInsights: string;
  activeGoals: string;
  recentHabits: string;
  lifeMetrics: string;
  lifeMetricMapping: string;
  recentAcceptedGoals: string;
  recentAcceptedHabits: string;
  upvotedInsights: string;
  currentDailyHabitCount: number;
}

export class InsightAgent {
  private chain: RunnableSequence;
  private initialized: boolean = false;

  constructor() {
          this.chain = RunnableSequence.from([
        {
          researchBrief: () => loadResearchBriefCapped(6000),
          researchSupport: async (input: JournalContext) => {
            const q = input.journalEntry.slice(0, 400);
            console.log('🔍 Retrieving research for query:', q);
            const docs = await retrieveResearch(q, 6);
            console.log('📚 Retrieved research docs:', docs.length);
            const text = docs.map(d => `• ${d.text}`).join('\n');
            const result = text.slice(0, 2200);
            console.log('📖 Research support text length:', result.length);
            return result;
          },
          relatedHistory: async (input: JournalContext) => {
            const userId = (global as any).__CURRENT_USER_ID__ || '';
            if (!userId) {
              console.log('⚠️ No userId for history retrieval');
              return '';
            }
            const q = `${input.journalEntry.slice(0, 300)}\nTopics: goals, habits, obstacles, routines`;
            console.log('🔍 Retrieving user history for query:', q);
            const docs = await retrieveUserHistory(userId, q, 6);
            console.log('📚 Retrieved user history docs:', docs.length);
            const text = docs.map(d => `• ${d.text}`).join('\n');
            const result = text.slice(0, 2200);
            console.log('📖 User history text length:', result.length);
            return result;
          },
          journalEntry: (input: JournalContext) => input.journalEntry,
          existingInsights: (input: JournalContext) => input.existingInsights,
          activeGoals: (input: JournalContext) => input.activeGoals,
          recentHabits: (input: JournalContext) => input.recentHabits,
          lifeMetrics: (input: JournalContext) => input.lifeMetrics,
          lifeMetricMapping: (input: JournalContext) => input.lifeMetricMapping,
          recentAcceptedGoals: (input: JournalContext) => input.recentAcceptedGoals,
          recentAcceptedHabits: (input: JournalContext) => input.recentAcceptedHabits,
          upvotedInsights: (input: JournalContext) => input.upvotedInsights,
          currentDailyHabitCount: (input: JournalContext) => input.currentDailyHabitCount,
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
      
      console.log('🚀 Starting TWO-PHASE analysis:');
      console.log('📝 Phase 1: Extracting ALL novel ideas from journal entry...');
      console.log('🎯 Phase 2: Curating for quality (1-2 insights, 2-3 goals/habits)...');
      
      // Fetch per-user acceptance signals to condition the model
      let acceptanceSnippet = '';
      let exemplarsSnippet = '';
      try {
        // Pull current month metrics; fallback to a lightweight 30-day heuristic if empty
        const userId = (global as any).__CURRENT_USER_ID__ || '';
        if (userId) {
          const windowMonth = new Date().toISOString().slice(0,7);
          const rows = await db.query.acceptanceMetrics.findMany({
            where: and(eq(acceptanceMetrics.userId, userId), eq(acceptanceMetrics.windowMonth, windowMonth)),
          });
          let metricsRows = rows;
          if (metricsRows.length === 0) {
            // 30-day fallback using raw feedback events
            const thirtyDaysAgoIso = new Date(Date.now() - 30*24*60*60*1000).toISOString();
            const fbLast30 = await db
              .select()
              .from(feedbackEvents)
              .where(and(eq(feedbackEvents.userId, userId), eq(feedbackEvents.type, 'insight')))
              .orderBy(feedbackEvents.createdAt);
            let up = 0, down = 0, dismiss = 0, total = 0;
            for (const e of fbLast30 as any[]) {
              const createdAt = (e.createdAt instanceof Date) ? e.createdAt : new Date(String(e.createdAt));
              if (createdAt.toISOString() < thirtyDaysAgoIso) continue;
              if (e.action === 'upvote') up++;
              if (e.action === 'downvote') down++;
              if (e.action === 'dismiss') dismiss++;
              total++;
            }
            const acc = total > 0 ? Math.round((up/total) * 100) : 0;
            metricsRows = acc > 0 ? [{ type: 'insight', metricName: 'last30d', acceptanceRate: acc, upvotes: up, downvotes: down } as any] : [];
          }
          const top = metricsRows
            .filter(r => r.acceptanceRate > 0)
            .sort((a,b) => b.acceptanceRate - a.acceptanceRate)
            .slice(0,3)
            .map(r => `${r.type}:${r.metricName} accRate=${r.acceptanceRate}% up=${r.upvotes} down=${r.downvotes}`)
            .join(' | ');
          if (top) {
            acceptanceSnippet = `\nUSER_ACCEPTANCE_METRICS: ${top}\n`;
          }

          // Few-shot exemplars from feedback events (recent), size-capped
          const fb = await db
            .select()
            .from(feedbackEvents)
            .where(and(eq(feedbackEvents.userId, userId), eq(feedbackEvents.type, 'insight')))
            .orderBy(feedbackEvents.createdAt);
          // Build per item latest states
          const byItem = new Map<string, { lastAction: string; reasons?: string[]; notes?: string; }>();
          for (const e of fb) {
            const itemId = String((e as any).itemId);
            const action = (e as any).action as string;
            const ctx = (e as any).context as any;
            const entry = byItem.get(itemId) || { lastAction: action };
            // capture reasons
            if (action === 'upvote_reason' || action === 'downvote_reason') {
              entry.reasons = Array.isArray(ctx?.reasons) ? ctx.reasons.slice(0,3) : undefined;
              entry.notes = typeof ctx?.notes === 'string' ? ctx.notes.slice(0,200) : undefined;
            }
            entry.lastAction = action;
            byItem.set(itemId, entry);
          }
          const acceptedIds: string[] = [];
          const rejectedIds: string[] = [];
          for (const entry of Array.from(byItem.entries())) {
            const [id, v] = entry as [string, { lastAction: string } & Record<string, any>];
            if ((v.lastAction === 'upvote' || v.lastAction === 'accept') && acceptedIds.length < 3) acceptedIds.push(id);
            if ((v.lastAction === 'downvote' || v.lastAction === 'dismiss') && rejectedIds.length < 2) rejectedIds.push(id);
          }
          const candidateIds = [...acceptedIds, ...rejectedIds];
          if (candidateIds.length > 0) {
            const details = await db.query.insights.findMany({
              where: (ins: any) => (ins.id in candidateIds) as any,
              with: { lifeMetrics: { with: { lifeMetric: true } } },
            } as any);
            const lines: string[] = [];
            for (const d of details as any[]) {
              const v = byItem.get(String(d.id));
              const tag = acceptedIds.includes(String(d.id)) ? 'ACCEPTED' : 'REJECTED';
              const metricNames = (d.lifeMetrics || []).map((lm:any) => lm.lifeMetric?.name).filter(Boolean).join(', ');
              const reasons = v?.reasons && v.reasons.length ? ` Reasons: ${v.reasons.join('; ')}` : '';
              const notes = v?.notes ? ` Notes: ${v.notes}` : '';
              lines.push(`[${tag}] ${d.title} — ${d.explanation?.slice(0,200)} (metrics: ${metricNames || 'N/A'})${reasons}${notes}`);
              if (lines.join('\n').length > 2500) break;
            }
            if (lines.length > 0) {
              exemplarsSnippet = `\nEXEMPLARS:\n${lines.join('\n')}\n`;
            }
          }
        }
      } catch (e) {
        console.warn('Could not load acceptance metrics for prompt conditioning', e);
      }

      const conditionedContext = {
        ...context,
        lifeMetrics: context.lifeMetrics + acceptanceSnippet + exemplarsSnippet,
      } as JournalContext;

      console.log('🎯 Final context for LLM:', {
        researchBriefLength: (await loadResearchBriefCapped(6000)).length,
        researchSupportLength: (await retrieveResearch(context.journalEntry.slice(0, 400), 6)).map(d => d.text).join('').length,
        relatedHistoryLength: (global as any).__CURRENT_USER_ID__ ? (await retrieveUserHistory((global as any).__CURRENT_USER_ID__, context.journalEntry.slice(0, 300), 6)).map(d => d.text).join('').length : 0,
        acceptanceSnippetLength: acceptanceSnippet.length,
        exemplarsSnippetLength: exemplarsSnippet.length
      });

      const result = await this.chain.invoke(conditionedContext);
      console.log('Raw LLM response:', result);
      console.log('📊 Response length:', result.length, 'characters');
      console.log('🎯 Checking if response contains multiple goals/insights...');

      // Apply similarity checking and filtering
      const filteredResult = await this.applySimilarityFiltering(result, (global as any).__CURRENT_USER_ID__ || '');
      if (typeof filteredResult !== 'string') {
        console.log('Similarity filtering applied, retrying with filtered suggestions...');
        // Retry with filtered suggestions
        const retryContext = {
          ...conditionedContext,
          journalEntry: `${conditionedContext.journalEntry}\n\nSIMILARITY FEEDBACK: Some suggestions were too similar to existing items or each other. Please provide more diverse and unique suggestions.`
        };
        const retryResult = await this.chain.invoke(retryContext);
        console.log('Retry result after similarity filtering:', retryResult);
        return this.parseAndValidateResponse(retryResult);
      }

      return this.parseAndValidateResponse(result);

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

// Helper methods attached to class prototype to avoid changing constructor structure
declare module './agent' {}

export interface ParsedSuggestionResult {
  action?: string;
  insightId?: string | null;
  title?: string;
  explanation?: string;
  confidence?: number;
  lifeMetricIds?: string[];
  suggestedGoals?: Array<{ title: string; description?: string; lifeMetricId?: string }>;
  suggestedHabits?: Array<{ title: string; description?: string; lifeMetricId?: string }>;
  reasoning?: string;
  similarityFeedback?: string[];
}

// Add methods to InsightAgent using declaration merging for typing
declare module './agent' {
  interface InsightAgent {
    parseAndValidateResponse(raw: string): ParsedSuggestionResult;
    applySimilarityFiltering(raw: string, userId: string): Promise<ParsedSuggestionResult | string>;
  }
}

(InsightAgent as any).prototype.parseAndValidateResponse = function parseAndValidateResponse(this: any, raw: string) {
  try {
    let cleanResponse = String(raw).trim();
    if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.substring(7);
    if (cleanResponse.startsWith('```')) cleanResponse = cleanResponse.substring(3);
    if (cleanResponse.endsWith('```')) cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);
    cleanResponse = cleanResponse.trim();
    const parsed = JSON.parse(cleanResponse) as ParsedSuggestionResult;
    return parsed;
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    console.error('Raw response that failed to parse:', raw);
    throw new Error('Failed to parse insight generation result');
  }
};

(InsightAgent as any).prototype.applySimilarityFiltering = async function applySimilarityFiltering(this: any, raw: string, userId: string) {
  try {
    const parsed = (this as any).parseAndValidateResponse(raw) as ParsedSuggestionResult;
    if (!parsed) return raw;

    let needsRetry = false;
    const feedback: string[] = [];

    // Existing similarity for goals
    for (const goal of parsed.suggestedGoals || []) {
      const sim = await SimilarityChecker.checkExistingSimilarity(userId, goal.title, goal.description || '', 'goal');
      if (sim.isSimilar) {
        needsRetry = true;
        feedback.push(`Goal "${goal.title}" is too similar to existing item "${sim.similarItems[0]?.title}"`);
      }
    }

    // Existing similarity for habits
    for (const habit of parsed.suggestedHabits || []) {
      const sim = await SimilarityChecker.checkExistingSimilarity(userId, habit.title, habit.description || '', 'habit');
      if (sim.isSimilar) {
        needsRetry = true;
        feedback.push(`Habit "${habit.title}" is too similar to existing item "${sim.similarItems[0]?.title}"`);
      }
    }

    // Cross-suggestion similarity
    if ((parsed.suggestedGoals || []).length > 1) {
      const cross = await SimilarityChecker.checkNewSuggestionsSimilarity(
        (parsed.suggestedGoals || []).map(g => ({ title: g.title, description: g.description || '', type: 'goal' as const }))
      );
      if (cross.some(c => c.shouldRemove)) {
        needsRetry = true;
        feedback.push('Some suggested goals are too similar to each other');
      }
    }

    if ((parsed.suggestedHabits || []).length > 1) {
      const cross = await SimilarityChecker.checkNewSuggestionsSimilarity(
        (parsed.suggestedHabits || []).map(h => ({ title: h.title, description: h.description || '', type: 'habit' as const }))
      );
      if (cross.some(c => c.shouldRemove)) {
        needsRetry = true;
        feedback.push('Some suggested habits are too similar to each other');
      }
    }

    if (needsRetry) {
      return { ...parsed, similarityFeedback: feedback } as ParsedSuggestionResult;
    }
    return raw;
  } catch (e) {
    console.warn('Similarity filtering failed; proceeding without retry', e);
    return raw;
  }
};

// Export a singleton instance
export const insightAgent = new InsightAgent(); 