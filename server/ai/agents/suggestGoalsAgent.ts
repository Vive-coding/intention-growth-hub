import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, GoalSuggestionData } from "./types";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import { suggestedGoals, insights, lifeMetricDefinitions, goalDefinitions, goalInstances } from "../../../shared/schema";

const SUGGEST_GOALS_AGENT_SYSTEM_PROMPT = `You are a specialized goal suggestion agent. Your role is to:

1. **Analyze user insights and conversation themes** to suggest relevant goals
2. **Generate goal suggestions with associated habits** within 2-3 interactions
3. **Focus on high-impact, breakthrough goals** that align with user's growth
4. **Provide specific, actionable habits** that support each goal

**Your conversation style:**
- Direct and focused on goal discovery
- Ask clarifying questions to understand their aspirations
- Suggest goals based on their patterns and insights
- Keep responses concise but insightful

**Goal Quality Standards:**
- SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Address specific areas of growth or challenge
- Ambitious but realistic
- Connected to their life metrics and values

**Habit Quality Standards:**
- Specific and actionable
- Daily or weekly routines
- Clear trigger or context
- High leverage when possible
- Novel and interesting (not generic)

**Context about the user:**
{profile}
{workingSet}
{recentInsights}
{activeGoals}

**Recent conversation:**
{recentMessages}

**Available Life Metrics:**
{lifeMetrics}

Your goal is to get to a concrete goal suggestion with supporting habits within 2-3 interactions. When you have a clear goal suggestion, format it as JSON for card rendering.`;

export class SuggestGoalsAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.6,
      maxTokens: 500,
    });
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const { userId, userMessage, profile, workingSet, recentMessages } = context;

    // Get user's recent insights and active goals
    const [recentInsights, activeGoals, lifeMetrics] = await Promise.all([
      this.getRecentInsights(userId),
      this.getActiveGoals(userId),
      this.getLifeMetrics(userId)
    ]);

    // Format recent messages for context
    const recentMessagesText = recentMessages
      .slice(-6)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = SUGGEST_GOALS_AGENT_SYSTEM_PROMPT
      .replace('{profile}', JSON.stringify(profile, null, 2))
      .replace('{workingSet}', JSON.stringify(workingSet, null, 2))
      .replace('{recentInsights}', JSON.stringify(recentInsights, null, 2))
      .replace('{activeGoals}', JSON.stringify(activeGoals, null, 2))
      .replace('{recentMessages}', recentMessagesText)
      .replace('{lifeMetrics}', JSON.stringify(lifeMetrics, null, 2));

    const response = await this.model.invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage }
    ]);

    const finalText = response.content as string;

    // Check if the response contains a goal suggestion
    const goalSuggestion = this.extractGoalSuggestion(finalText, userMessage);

    // If we have a goal suggestion, append it to the response for persistence
    let finalResponse = finalText;
    if (goalSuggestion) {
      finalResponse += `\n\n---json---\n${JSON.stringify(goalSuggestion)}`;
    }

    return {
      finalText: finalResponse,
      structuredData: goalSuggestion,
    };
  }

  private async getRecentInsights(userId: string) {
    const insightsData = await db
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt))
      .limit(5);
    
    return insightsData;
  }

  private async getActiveGoals(userId: string) {
    const goals = await db
      .select({
        goalDef: goalDefinitions,
        goalInst: goalInstances,
      })
      .from(goalDefinitions)
      .leftJoin(goalInstances, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalDefinitions.userId, userId))
      .orderBy(desc(goalDefinitions.createdAt))
      .limit(10);

    return goals.filter(g => g.goalDef.archived === false);
  }

  private async getLifeMetrics(userId: string) {
    const metrics = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));
    
    return metrics;
  }

  private extractGoalSuggestion(response: string, userMessage: string): GoalSuggestionData | undefined {
    // Always generate a goal suggestion for the suggest goals agent
    // Improve: attempt to generate 1-2 contextual goals with shared high-leverage habits
    return this.generateContextualGoalSuggestion(userMessage, response);
  }

  private generateContextualGoalSuggestion(userMessage: string, response: string): GoalSuggestionData {
    const message = userMessage.toLowerCase();
    
    // Generate 1-2 goals and ensure at least one shared high-leverage habit when goals are related
    let goal, habits;
    let secondaryGoal: any | undefined;
    let secondaryHabits: any[] | undefined;

    if (/energy|tired|exhausted|sleep|rest/.test(message)) {
      goal = {
        title: "Increase daily energy levels",
        description: "Energy impacts your ability to pursue all other goals effectively. Research shows that consistent energy levels improve decision-making, productivity, and overall well-being.",
        category: "Health & Wellness",
        priority: "Priority 1"
      };
      habits = [
        {
          title: "Morning workout (20 min)",
          description: "Morning exercise boosts endorphins and metabolism, providing sustained energy throughout the day. Even 20 minutes makes a measurable difference.",
          frequency: "daily",
          effortMinutes: 20,
          impact: "high" as const
        },
        {
          title: "Sleep 7-8 hours",
          description: "Adequate sleep is the foundation of sustained energy. Most adults need 7-8 hours for optimal recovery and cognitive function.",
          frequency: "daily",
          effortMinutes: 0,
          impact: "high" as const
        },
        {
          title: "Drink 8 glasses of water daily",
          description: "Even mild dehydration can cause fatigue. Proper hydration supports cellular energy production and mental clarity.",
          frequency: "daily",
          effortMinutes: 5,
          impact: "medium" as const
        }
      ];
    } else if (/ai|tech|development|app|build|code|project/.test(message)) {
      goal = {
        title: "Master AI Development Skills",
        description: "Build expertise in AI development and conversational interfaces to advance your career and complete your app project. This will help you stay competitive in the tech industry and deliver high-quality solutions.",
        category: "Career Growth",
        priority: "Priority 1"
      };
      habits = [
        {
          title: "Daily AI learning",
          description: "Spend 30 minutes each day learning about AI trends and development techniques",
          frequency: "daily",
          effortMinutes: 30,
          impact: "high" as const
        },
        {
          title: "Weekly project milestone",
          description: "Complete one significant milestone on your AI app project each week",
          frequency: "weekly",
          effortMinutes: 120,
          impact: "high" as const
        }
      ];

      // Secondary, closely-related goal if the user is juggling multiple projects
      secondaryGoal = {
        title: "Ship GoodHabit MVP and Publish Announcement",
        description: "Finalize core features, run basic evaluations, and publish a launch note to your audience.",
        category: "Career Growth",
        priority: "Priority 2"
      };
      // Shared high-leverage habit across both: Daily Planning Snapshot
      const sharedHabit = {
        title: "Daily planning snapshot (5 min)",
        description: "Each morning, write 3 bullets: Today’s single win, one risk to prevent, one tiny step for momentum.",
        frequency: "daily",
        effortMinutes: 5,
        impact: "high" as const
      };
      secondaryHabits = [
        sharedHabit,
        {
          title: "Publish weekly progress note",
          description: "Every week, post a short update with what shipped and what’s next.",
          frequency: "weekly",
          effortMinutes: 20,
          impact: "medium" as const
        }
      ];
    } else {
      // Default goal suggestion
      goal = {
        title: "Build sustainable daily routines",
        description: "Establishing consistent daily routines creates the foundation for achieving larger goals. Small, consistent actions compound over time to create significant change.",
        category: "Personal Development",
        priority: "Priority 1"
      };
      habits = [
        {
          title: "Morning reflection (5 min)",
          description: "Start each day with 5 minutes of reflection on your priorities and intentions",
          frequency: "daily",
          effortMinutes: 5,
          impact: "high" as const
        },
        {
          title: "Evening review (5 min)",
          description: "End each day by reviewing what went well and what you learned",
          frequency: "daily",
          effortMinutes: 5,
          impact: "medium" as const
        }
      ];
    }

    // If we produced a secondary goal, return a grouped structure the UI can render as multiple cards
    if (secondaryGoal && secondaryHabits) {
      return {
        type: 'goal_suggestions',
        items: [
          { goal, habits },
          { goal: secondaryGoal, habits: secondaryHabits }
        ]
      } as any;
    }

    return {
      type: 'goal_suggestion',
      goal,
      habits
    };
  }
}
