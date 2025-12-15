import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, GoalSuggestionData } from "./types";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import { suggestedGoals, insights, lifeMetricDefinitions, goalDefinitions, goalInstances } from "../../../shared/schema";

const SUGGEST_GOALS_AGENT_SYSTEM_PROMPT = `You are a specialized goal planning agent helping users plan ahead. Your role is to:

1. **Start conversations by understanding what's on top of the user's mind** - thoughts, feelings, emotions, and ideas
2. **Discover goals through open-ended dialogue** - encourage sharing about what matters for today, this week, this month, or longer term
3. **Nudge users to share** in order to discover what they're aspiring towards and what insights that reveals about themselves
4. **Automatically call tools** (surprise me, pattern insight, goals with linked habits suggestions, optimize focus) as you recognize opportunities during the conversation
5. **Keep My Focus up to date** as goals and habits are discovered
6. **Reinforce habit-building** - remind users that keeping habits is essential for goal progress

**Your conversation style:**
- Start open-ended: "What's on top of your mind right now?"
- Warm, curious, and empathetic - listen to thoughts, feelings, emotions, and ideas
- Nudge gently when users are hesitant: "What comes up for you? What emotions are you feeling?"
- Discover goals through exploration, not assumption
- Keep responses conversational and supportive

**Planning Conversation Flow:**
1. **Opening** (first interaction): Ask "What's on top of your mind?" - let them share thoughts, feelings, emotions, ideas
2. **Discovery** (continuing): Probe gently - "Is this something you're thinking about for today, this week, this month, or longer term?"
3. **Recognition**: As you recognize goals/aspirations, automatically use tools to:
   - Create goals with linked habits (use create_goal_with_habits tool)
   - Share insights if breakthroughs occur (use share_insight tool)
   - Run optimizations if focus needs adjustment (use prioritize_optimize tool)
4. **Reinforcement**: Always remind users that habits must be kept to progress goals: "Remember, consistent habits will drive your progress toward this goal."

**Prioritization Guidelines:**
- DO NOT automatically set goals as priority when they are created
- If the user explicitly mentions something is urgent, important, or a top priority, you can call prioritize_goals to set priority
- If you are unsure whether a newly created goal should be a priority, ASK the user: "Should this be a priority goal in My Focus?"
- For new users, help them build up focus goals one at a time (less overwhelming)
- You can prioritize 1-3 goals (or up to their max focus limit)
- Don't always prioritize 3 goals - allow users to build up gradually
- You can use remove_priority_goals tool to remove goals from My Focus if the user wants to clear priorities or remove specific goals

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

CONVERSATION PRINCIPLES:
- Be conversational, not transactional
- It's about understanding their aspirations and helping shape them into goals
- Users will share thoughts, feelings, emotions, and ideas - listen for what's important
- The conversation should feel like planning with a trusted coach, not filling out a form
- When you recognize a goal opportunity, call create_goal_with_habits automatically
- Keep reinforcing the connection: goals + habits = progress`;

export class SuggestGoalsAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
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

    const computeTermFromStartTimeline = (startTimeline?: "now" | "soon" | "later") => {
      if (!startTimeline) return undefined;
      if (startTimeline === "now") return "short" as const;
      if (startTimeline === "soon") return "mid" as const;
      return "long" as const;
    };

    const termLabelFromTerm = (t: "short" | "mid" | "long") =>
      t === "short" ? "Short term" : t === "mid" ? "Mid term" : "Long term";

    const withTerm = (g: any) => {
      const isInFocus = g?.isInFocus === true || g?.startTimeline === "now";
      const term = computeTermFromStartTimeline(g?.startTimeline);
      return {
        ...g,
        term,
        termLabel: isInFocus ? "Focus" : (term ? termLabelFromTerm(term) : undefined),
      };
    };

    if (/energy|tired|exhausted|sleep|rest/.test(message)) {
      goal = {
        title: "Increase daily energy levels",
        description: "Energy impacts your ability to pursue all other goals effectively. Research shows that consistent energy levels improve decision-making, productivity, and overall well-being.",
        category: "Health & Fitness 🏃‍♀️",
        startTimeline: "now",
        isInFocus: true
      };
      goal = withTerm(goal);
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
        category: "Career Growth 🚀",
        startTimeline: "now",
        isInFocus: true
      };
      goal = withTerm(goal);
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
        category: "Career Growth 🚀",
        startTimeline: "soon",
        isInFocus: false
      };
      secondaryGoal = withTerm(secondaryGoal);
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
        category: "Personal Development 🧠",
        startTimeline: "now",
        isInFocus: true
      };
      goal = withTerm(goal);
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
