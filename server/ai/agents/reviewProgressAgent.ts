import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, HabitReviewData } from "./types";
import { db } from "../../db";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { habitDefinitions, habitCompletions, habitInstances, goalInstances, goalDefinitions } from "../../../shared/schema";
import { MyFocusService } from "../../services/myFocusService";

const REVIEW_PROGRESS_AGENT_SYSTEM_PROMPT = `You are a specialized progress review agent. Your role is to:

1. **Understand what the user has worked on** and habits they've completed
2. **Provide motivation, encouragement, and celebrate successes**
3. **Put progress in context** - always personalize based on their specific situation
4. **Render habit completion cards** showing their daily progress

**Your conversation style:**
- Encouraging and celebratory
- Focus on progress and momentum
- Ask about their day and specific habit completions
- Provide personalized motivation based on their patterns

IMPORTANT:
- Focus on the user's high-leverage habits that support their current priority goals ("My Focus").
- Start with a one-line summary of today's progress: e.g., "You completed 2/6 priority habits today".
- Mention 1-2 streak highlights and 1-2 recent wins.
- Then, ask 1 focused question to understand what other priority habits they completed today.
- Do NOT use markdown headings.

**Context about the user:**
{profile}
{workingSet}
{recentHabits}
{completionData}

**Recent conversation:**
{recentMessages}

Your goal is to get a sense of what they've accomplished today and provide a personalized summary of their progress with habit completion cards.`;

export class ReviewProgressAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 400,
    });
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const { userId, userMessage, profile, workingSet, recentMessages } = context;

    // Get My Focus, recent habits and completion data
    const [myFocus, recentHabits, completionData] = await Promise.all([
      MyFocusService.getMyFocus(userId),
      this.getRecentHabits(userId),
      this.getTodayCompletions(userId)
    ]);

    // Format recent messages for context
    const recentMessagesText = recentMessages
      .slice(-6)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = REVIEW_PROGRESS_AGENT_SYSTEM_PROMPT
      .replace('{profile}', JSON.stringify(profile, null, 2))
      .replace('{workingSet}', JSON.stringify(workingSet, null, 2))
      .replace('{recentHabits}', JSON.stringify(recentHabits, null, 2))
      .replace('{completionData}', JSON.stringify(completionData, null, 2))
      .replace('{recentMessages}', recentMessagesText);

    const response = await this.model.invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage }
    ]);

    let finalText = response.content as string;

    // Generate habit review data for card rendering (prioritize My Focus high-leverage habits)
    const habitReview = this.generateHabitReviewData(recentHabits, completionData, myFocus);

    // Prepend a deterministic summary so counts always match the card
    try {
      const displayed = (habitReview?.habits || []);
      const todayCompletedCount = displayed.filter(h => h.completed).length;
      const totalShown = displayed.length;
      const summary = `You completed ${todayCompletedCount}/${totalShown} priority habits today.`;
      finalText = `${summary}\n\n${finalText}`.trim();
    } catch {}

    // If we have habit review data, also compute goals progressed
    let finalResponse = finalText;
    let structured: any = habitReview;
    if (habitReview) {
      try {
        const completedHabitIds = (habitReview.habits || []).filter(h => h.completed).map(h => h.id);
        if (completedHabitIds.length > 0) {
          const links = await db
            .select({ goalInstanceId: habitInstances.goalInstanceId })
            .from(habitInstances)
            .where(inArray(habitInstances.habitDefinitionId, completedHabitIds));
          const giIds = Array.from(new Set(links.map(l => l.goalInstanceId)));
          if (giIds.length > 0) {
            const goalRows = await db
              .select({ id: goalInstances.id, title: goalDefinitions.title })
              .from(goalInstances)
              .leftJoin(goalDefinitions, eq(goalDefinitions.id, goalInstances.goalDefinitionId))
              .where(inArray(goalInstances.id, giIds));
            const goalsProgressed = goalRows.map(r => ({ id: r.id, title: r.title || 'Goal' }));
            structured = { ...habitReview, goalsProgressed };
          }
        }
      } catch {}

      finalResponse += `\n\n---json---\n${JSON.stringify(structured)}`;
    }

    return {
      finalText: finalResponse,
      structuredData: structured,
      // Provide a lightweight CTA so the UI can offer a follow-up action
      cta: 'Mark complete',
    };
  }

  private async getRecentHabits(userId: string) {
    const habitsData = await db
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId))
      .orderBy(desc(habitDefinitions.createdAt))
      .limit(10);
    
    return habitsData;
  }

  private async getTodayCompletions(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = await db
      .select()
      .from(habitCompletions)
      .where(and(eq(habitCompletions.userId, userId), gte(habitCompletions.createdAt, start as any)))
      .orderBy(desc(habitCompletions.createdAt))
      .limit(100);
    return rows;
  }

  private generateHabitReviewData(recentHabits: any[], completions: any[], myFocus: any): HabitReviewData {
    // Create a map of habit completions for today
    // Prefer habitDefinitionId (new) with legacy habitId as fallback
    const completionMap = new Map<string, any[]>();
    completions.forEach((completion: any) => {
      const key = completion.habitDefinitionId || completion.habitId;
      if (!key) return;
      if (!completionMap.has(key)) {
        completionMap.set(key, []);
      }
      completionMap.get(key)!.push(completion);
    });

    const focusIds = new Set<string>();
    try { (myFocus?.highLeverageHabits || []).forEach((h: any) => focusIds.add(h.id)); } catch {}

    // Prioritize focus habits at top of list
    const sorted = [...recentHabits].sort((a: any, b: any) => {
      const af = focusIds.has(a.id) ? 1 : 0;
      const bf = focusIds.has(b.id) ? 1 : 0;
      return bf - af;
    });

    // Show up to 6 prioritized habits to better match summary like "0/6"
    const habitReviewHabits = sorted.slice(0, 6).map(habit => {
      const habitCompletions = completionMap.get(habit.id) || [];
      const completed = habitCompletions.length > 0;
      
      // Calculate streak (simplified - in real implementation, this would be more sophisticated)
      const streak = Math.floor(Math.random() * 15) + 1; // Placeholder
      
      return {
        id: habit.id,
        title: habit.name,
        description: habit.description,
        completed,
        streak,
        points: 1
      };
    });

    return {
      type: 'habit_review',
      habits: habitReviewHabits
    };
  }
}
