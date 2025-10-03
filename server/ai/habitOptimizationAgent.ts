import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

// Define the optimization output schema
const HabitToArchive = z.object({
  id: z.string(),
  name: z.string(),
  reason: z.string().describe("Why this habit should be archived or consolidated"),
});

const HabitToCreate = z.object({
  name: z.string().describe("Clear, actionable habit name"),
  description: z.string().describe("Detailed description of what this habit involves"),
  category: z.string().describe("Life metric ID this habit belongs to"),
  isHighLeverage: z.boolean().describe("True if this habit can serve multiple goals/life areas"),
  applicableGoalTypes: z.array(z.string()).describe("Array of goal types this habit supports"),
  targetFrequency: z.enum(["daily", "weekly", "monthly"]).describe("How often to perform this habit"),
  targetCount: z.number().describe("Target count per frequency period"),
  consolidates: z.array(z.string()).describe("IDs of habits this new habit replaces/consolidates"),
  coversGoals: z.array(z.string()).describe("IDs of goals this habit will help achieve"),
});

const OptimizationSummary = z.object({
  habitsBefore: z.number(),
  habitsAfter: z.number(),
  goalsFullyCovered: z.number(),
  estimatedTimeReduction: z.string().describe("Estimated time saved per day/week"),
  optimizationRationale: z.string().describe("Overall explanation of the optimization strategy"),
});

const OptimizationOutput = z.object({
  habitsToArchive: z.array(HabitToArchive),
  habitsToCreate: z.array(HabitToCreate),
  summary: OptimizationSummary,
});

export type OptimizationProposal = z.infer<typeof OptimizationOutput>;

// Create the structured output parser
const parser = StructuredOutputParser.fromZodSchema(OptimizationOutput);

const OPTIMIZATION_PROMPT = `You are an expert life coach and habit optimization specialist. Your goal is to help users maintain fewer, more effective habits while still achieving all their goals.

CURRENT USER STATE:
{currentHabitsCount} Active Habits:
{currentHabits}

{activeGoalsCount} Active Goals:
{activeGoals}

Recent Upvoted Insights (what resonates with the user):
{upvotedInsights}

Recent Journal Themes:
{journalThemes}

OPTIMIZATION OBJECTIVES:
1. **AGGRESSIVE REDUCTION**: Target 15-20 TOTAL habits (current: {currentHabitsCount}) - significant but sustainable
2. **Maximize Leverage**: Each NEW habit should serve 2-4 goals (not too generic, not too narrow)
3. **Shareable Phrasing**: Habits must use PUNCHY, 3-4 word titles that users can proudly say to others ("I ship something tiny 3x/week")
4. **Complementary Set**: New habits should work together to create a cohesive, powerful daily/weekly rhythm
5. **Maintain Goal Coverage**: Ensure EVERY goal has at least 1 supporting habit (existing OR new)
6. **Archive Aggressively**: Archive low-completion (<40%) AND redundant habits without hesitation
7. **Respect User Context**: Use insights and journal themes to create personally meaningful habits

CONSOLIDATION STRATEGIES (BE THOUGHTFUL):
- **Multi-Goal Bundling**: Find habits serving similar goals → ONE high-leverage habit serving THOSE goals
- **Theme Grouping**: Multiple vague reflection habits → One SPECIFIC reflection practice with clear prompts
- **Time-Based Stacking**: Morning/Evening routines → Integrated ritual with named steps
- **Low Engagement Replacement**: Habits with <40% completion → Replace with simpler, more engaging version

HIGH-LEVERAGE HABIT EXAMPLES (Punchy Titles + Multi-Goal Impact):
TITLE FORMAT: 3-4 words, action-oriented, memorable, shareable

✅ "Ship something tiny" → Career, creativity, learning, confidence (3x/week: post code, writing, or design)
✅ "Ask one sharp question" → Communication, learning, relationships, critical thinking (Daily: one insightful question)
✅ "Walk to think" → Mental health, problem-solving, physical health, creativity (15-min walk for reflection)
✅ "Send one signal of care" → Relationships, empathy, communication (Daily: text, call, or gesture)
✅ "Capture daily lesson + gratitude" → Reflection, mindfulness, growth mindset (Evening: 1 lesson + 1 gratitude)
✅ "Curate your first input" → Productivity, mental health, intentionality (Morning: choose first thing you consume)
✅ "Protect sleep ritual" → Health, energy, productivity, mental clarity (Consistent bedtime routine)
✅ "Upgrade small talk" → Networking, relationships, communication (Turn surface chat into real conversation)

CRITICAL PHRASING RULES:
❌ AVOID: "Daily Reflection" (generic), "Progress Check" (vague), "Exercise Routine" (boring)
❌ AVOID: Long descriptions as titles - keep titles to 3-4 punchy words
❌ AVOID: Habits users wouldn't proudly share ("Track calories", "Check email")

✅ INSTEAD: Short, memorable titles that spark curiosity when shared
✅ "Five-Line Journal" (5 sentences: energy, win, challenge, gratitude, tomorrow)
✅ "Question Storm Session" (Weekly: 20 questions about a problem in 10 minutes)
✅ "Teach One Thing" (Share something you learned with someone - solidifies knowledge)

CRITICAL MATH REQUIREMENT:
- Current habits: {currentHabitsCount}
- Target: 15-20 total habits (50% reduction)
- Required reduction: Archive at least {minArchiveCount} habits (40% of current)
- Create: 5-8 SPECIFIC, HIGH-LEVERAGE habits (each covering 2-4 goals)
- Final count MUST be less than current

CONSTRAINTS:
- MUST reduce total habit count significantly (archive much more than you create)
- Archive at least 40% of current habits
- Create 5-8 new habits that are BOTH high-leverage AND specific/novel
- Each new habit should cover 2-4 goals (populate coversGoals array with goal IDs)
- Every goal must have at least 1 habit after optimization
- **Habit Title Format**: 3-4 punchy words that users can proudly share ("I [habit] [frequency]")
- **Complementary Set**: New habits should create a cohesive rhythm (e.g., morning input + evening reflection, weekly creation + daily learning)
- **Pride Factor**: User should be excited to tell friends "I [habit name]" - avoid generic/boring phrasing
- If this is impossible, explain why in the rationale

CRITICAL OUTPUT FORMAT:
- For habitsToArchive: Use the exact "ID:" value from the habit list above (UUID format)
- For coversGoals: Use the exact "ID:" value from the goal list above (UUID format)
- DO NOT make up IDs - only use the IDs provided in the context above
- Example habit ID: "7483e9e8-1bc7-4088-924c-a991d7c36f0d" (UUID format)
- Example goal ID: "0622e27b-1b73-4b51-b8b3-f4542a207037" (UUID format)

FREQUENCY & TARGET GUIDANCE:
For each new habit, set targetFrequency and targetCount based on the habit's nature:

**Daily habits** (targetFrequency: "daily", targetCount: 1):
- "Ask one sharp question" → 1x daily
- "Send one signal of care" → 1x daily  
- "Capture daily lesson + gratitude" → 1x daily
- "Walk to think" → 1x daily
- "Curate your first input" → 1x daily

**Weekly habits** (targetFrequency: "weekly", targetCount: 1-3):
- "Ship something tiny" → 3x weekly (targetCount: 3)
- "Upgrade small talk" → 2x weekly (targetCount: 2)
- "Question storm session" → 1x weekly (targetCount: 1)

**Monthly habits** (targetFrequency: "monthly", targetCount: 1-2):
- "Deep reflection ritual" → 1x monthly (targetCount: 1)
- "Skill audit & plan" → 1x monthly (targetCount: 1)

The system will calculate total targets based on:
- targetCount (how many times per period)
- targetFrequency (daily/weekly/monthly)
- Days remaining until goal target date

ANALYSIS PROCESS:
1. Identify overlapping/redundant habits
2. Find habits with low completion rates (<30%)
3. Group habits by goal or theme
4. Design high-leverage habits that consolidate multiple habits
5. Ensure all goals are covered
6. Calculate time savings and impact

{format_instructions}

Generate a comprehensive optimization proposal that will help this user maintain fewer, more powerful habits while achieving all their goals.`;

export interface OptimizationContext {
  currentHabits: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    categoryName: string;
    completionRate: number;
    streak: number;
    linkedGoals: Array<{ id: string; title: string }>;
  }>;
  activeGoals: Array<{
    id: string;
    title: string;
    description: string;
    lifeMetricId: string;
    lifeMetricName: string;
    targetDate: string;
  }>;
  upvotedInsights: Array<{
    title: string;
    explanation: string;
  }>;
  journalThemes: string;
}

export class HabitOptimizationAgent {
  private model: ChatOpenAI;
  private promptTemplate: PromptTemplate;

  constructor() {
    this.model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      maxTokens: 4000,
    });

    this.promptTemplate = PromptTemplate.fromTemplate(OPTIMIZATION_PROMPT);
  }

  async analyzeAndOptimize(context: OptimizationContext): Promise<OptimizationProposal> {
    try {
      // Format current habits for the prompt - INCLUDE IDs so AI can reference them!
      const currentHabitsText = context.currentHabits
        .map(
          (h) =>
            `- ID: ${h.id}\n  Name: "${h.name}" (${h.categoryName})\n  Description: ${h.description}\n  Completion Rate: ${h.completionRate}% | Streak: ${h.streak} days\n  Supports Goals: ${h.linkedGoals.map((g) => g.title).join(", ") || "None"}`
        )
        .join("\n\n");

      // Format active goals for the prompt - INCLUDE IDs so AI can reference them!
      const activeGoalsText = context.activeGoals
        .map(
          (g) =>
            `- ID: ${g.id}\n  Title: "${g.title}" (${g.lifeMetricName})\n  Description: ${g.description}\n  Target Date: ${g.targetDate}`
        )
        .join("\n\n");

      // Format upvoted insights
      const upvotedInsightsText =
        context.upvotedInsights.length > 0
          ? context.upvotedInsights
              .map((i) => `- ${i.title}\n  ${i.explanation.substring(0, 150)}...`)
              .join("\n")
          : "No recent upvoted insights.";

      // Calculate minimum archive count (40% of current habits)
      const minArchiveCount = Math.floor(context.currentHabits.length * 0.4);
      
      // Create the prompt
      const prompt = await this.promptTemplate.format({
        currentHabitsCount: context.currentHabits.length,
        minArchiveCount: minArchiveCount,
        currentHabits: currentHabitsText,
        activeGoalsCount: context.activeGoals.length,
        activeGoals: activeGoalsText,
        upvotedInsights: upvotedInsightsText,
        journalThemes: context.journalThemes || "No recent journal entries available.",
        format_instructions: parser.getFormatInstructions(),
      });

      console.log("[HabitOptimization] Sending prompt to AI agent...");

      // Call the AI model
      const response = await this.model.invoke(prompt);
      const content = response.content as string;

      console.log("[HabitOptimization] Received response, parsing...");

      // Parse the structured output
      const optimization = await parser.parse(content);

      console.log(
        `[HabitOptimization] Proposal: Archive ${optimization.habitsToArchive.length} habits, Create ${optimization.habitsToCreate.length} habits`
      );

      return optimization;
    } catch (error: any) {
      console.error("[HabitOptimization] Error during analysis:", error);
      throw new Error(`Failed to generate optimization proposal: ${error.message || 'Unknown error'}`);
    }
  }

  // Validate that the optimization maintains goal coverage
  validateOptimization(
    proposal: OptimizationProposal,
    context: OptimizationContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // CRITICAL: Check that we're actually reducing total habits
    const netChange = proposal.habitsToCreate.length - proposal.habitsToArchive.length;
    const finalHabitCount = context.currentHabits.length + netChange;
    
    if (netChange >= 0) {
      errors.push(
        `Optimization must REDUCE habits, not increase them. Current: ${context.currentHabits.length}, Proposed: ${finalHabitCount} (archive ${proposal.habitsToArchive.length}, create ${proposal.habitsToCreate.length})`
      );
    }

    // Check minimum reduction (archive at least 30% of current habits)
    const minArchive = Math.ceil(context.currentHabits.length * 0.3);
    if (proposal.habitsToArchive.length < minArchive) {
      errors.push(
        `Must archive at least ${minArchive} habits (30% of ${context.currentHabits.length}), proposed: ${proposal.habitsToArchive.length}`
      );
    }

    // Check that we're creating a reasonable number of new habits
    if (proposal.habitsToCreate.length < 5 || proposal.habitsToCreate.length > 8) {
      errors.push(`Must create 5-8 new habits (proposed: ${proposal.habitsToCreate.length})`);
    }

    // Check that all goals are covered by either new habits OR remaining habits
    // First, get IDs of habits being archived
    const archivedHabitIds = new Set(proposal.habitsToArchive.map((h) => h.id));
    
    // Build coverage from remaining existing habits (not being archived)
    const goalCoverage = new Set<string>();
    context.currentHabits.forEach((habit) => {
      if (!archivedHabitIds.has(habit.id)) {
        // This habit is staying, add its goal coverage
        habit.linkedGoals.forEach((goal) => goalCoverage.add(goal.id));
      }
    });
    
    // Add coverage from new habits
    proposal.habitsToCreate.forEach((habit) => {
      habit.coversGoals.forEach((goalId) => goalCoverage.add(goalId));
    });

    const uncoveredGoals = context.activeGoals.filter(
      (goal) => !goalCoverage.has(goal.id)
    );
    
    // Allow up to 20% of goals to not have coverage (they might be nearly complete or low priority)
    const maxAllowedUncovered = Math.ceil(context.activeGoals.length * 0.2);
    
    if (uncoveredGoals.length > maxAllowedUncovered) {
      errors.push(
        `Too many goals without habit coverage (${uncoveredGoals.length}/${context.activeGoals.length}). Max allowed: ${maxAllowedUncovered}. Uncovered: ${uncoveredGoals.map((g) => g.title).join(", ")}`
      );
    } else if (uncoveredGoals.length > 0) {
      console.warn(
        `[HabitOptimization] Warning: ${uncoveredGoals.length} goals without coverage (within acceptable threshold): ${uncoveredGoals.map((g) => g.title).join(", ")}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

