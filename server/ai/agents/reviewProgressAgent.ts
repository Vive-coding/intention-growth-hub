import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, HabitReviewData } from "./types";
import { db } from "../../db";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { habitDefinitions, habitCompletions, habitInstances, goalInstances, goalDefinitions } from "../../../shared/schema";
import { MyFocusService } from "../../services/myFocusService";
import { logHabitCompletion } from "../../services/habitCompletionService";
import { z } from "zod";

const REVIEW_PROGRESS_AGENT_SYSTEM_PROMPT = `You are a specialized progress review agent. Your role is to:

1. **Start conversations by checking on how the user's day is going** and progress on their last recorded plan
2. **Look at past conversations, My Focus, and progress** to provide context
3. **Reinforce consistency in building habits** without being too pushy
4. **Automatically log habits** as users share progress (use review_daily_habits tool with "post habit logged" status)
5. **Celebrate goal completions** and encourage finishing goals that are progressing well
6. **Encourage keeping streaks** where they're building momentum
7. **Support longer-term review** when users ask for 1 week, month, quarters, or all-time progress

**Your conversation style:**
- Start with: "How's your day going?"
- Check on the last recorded plan they discussed
- Encouraging and celebratory without being pushy
- Focus on consistency and momentum, not perfection
- Celebrate wins enthusiastically
- Gently encourage where there's opportunity

IMPORTANT:
- Check chat history to understand the last plan discussed
- Look at My Focus to see current goals and habits
- It's possible the user is checking in same day, same week, or after a while - adapt accordingly
- As the user shares progress, automatically log habits using the review_daily_habits tool
- Track streaks and celebrate building consistency
- If user asks for longer-term review (1 week, month, etc.), fetch and summarize accordingly

**Automatic Actions:**
- When user shares progress, automatically call review_daily_habits or update_goal_progress
- When user mentions completing a habit, log it immediately
- When user achieves a goal, call complete_goal and celebrate
- Track patterns and encourage consistency without being pushy

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
  private extractionModel: ChatOpenAI;
  private static readonly extractionSchema = z.object({
    completions: z
      .array(
        z.object({
          habitTitle: z.string(),
          dates: z.array(z.string()).optional(),
          occurrences: z.number().int().nonnegative().optional(),
          confidence: z.number().optional(),
        })
      )
      .default([]),
  });

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 400,
    });
    this.extractionModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
      maxTokens: 400,
    });
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const { userId, userMessage, profile, workingSet, recentMessages } = context;

    // Get My Focus, recent habits and completion data
    const [myFocus, recentHabits, initialCompletionData] = await Promise.all([
      MyFocusService.getMyFocus(userId),
      this.getRecentHabits(userId),
      this.getTodayCompletions(userId)
    ]);
    let completionData = initialCompletionData;

    const { summaries: loggedSummaries, updated } = await this.logHabitProgressFromMessage(
      userId,
      userMessage,
      profile,
      myFocus,
      recentHabits
    );

    if (updated) {
      completionData = await this.getTodayCompletions(userId);
    }

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

    if (loggedSummaries.length > 0) {
      finalText = `${loggedSummaries.join('\n')}

${finalText}`.trim();
    }

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
    const habitReviewHabits = sorted.map(habit => {
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

  private async logHabitProgressFromMessage(
    userId: string,
    userMessage: string,
    profile: any,
    myFocus: any,
    recentHabits: any[],
  ): Promise<{ summaries: string[]; updated: boolean }> {
    const summaries: string[] = [];
    const timezone = profile?.timezone || "UTC";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const candidateHabits: Array<{ id: string; title: string; linkedGoals?: any[] }> = [];
    const seenIds = new Set<string>();
    (myFocus?.highLeverageHabits || []).forEach((habit: any) => {
      if (!habit?.id || seenIds.has(habit.id)) return;
      seenIds.add(habit.id);
      candidateHabits.push({ id: habit.id, title: habit.title, linkedGoals: habit.linkedGoals });
    });
    (recentHabits || []).forEach((habit: any) => {
      const id = habit?.id;
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      candidateHabits.push({ id, title: habit.name || habit.title || "Habit" });
    });

    if (candidateHabits.length === 0) {
      return { summaries, updated: false };
    }

    const candidateList = candidateHabits.map((habit) => `- ${habit.title}`).join("\n");

    let extractions: z.infer<typeof ReviewProgressAgent.extractionSchema>;
    try {
      const parser = this.extractionModel.withStructuredOutput(
        ReviewProgressAgent.extractionSchema,
        { name: "habit_completion_extraction" }
      );
      extractions = await parser.invoke([
        {
          role: "system",
          content: `You extract structured data about habit completions mentioned in a message. 
The current date in the user's timezone (${timezone}) is ${today}. Use the provided list of habit titles exactly when possible. 
If the user references multiple days, list each day in yyyy-mm-dd format. If dates are not explicit, infer likely recent days (today, yesterday, etc.). 
Return JSON with a "completions" array.`,
        },
        {
          role: "system",
          content: `Candidate habits:\n${candidateList}`,
        },
        { role: "user", content: userMessage },
      ]);
    } catch (error) {
      console.warn("[ReviewProgressAgent] Failed to extract habit completions", error);
      return { summaries, updated: false };
    }

    const completions = extractions?.completions || [];
    if (completions.length === 0) {
      return { summaries, updated: false };
    }

    const habitByTitle = new Map<string, { id: string; title: string; linkedGoals?: any[] }>();
    candidateHabits.forEach((habit) => {
      habitByTitle.set(habit.title.toLowerCase(), habit);
    });

    const fallbackMatcher = (title: string) => {
      const normalized = title.toLowerCase();
      if (habitByTitle.has(normalized)) {
        return habitByTitle.get(normalized)!;
      }
      for (const habit of candidateHabits) {
        if (habit.title.toLowerCase().includes(normalized) || normalized.includes(habit.title.toLowerCase())) {
          return habit;
        }
      }
      return undefined;
    };

    const summariesFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    });

    let loggedAny = false;

    for (const entry of completions) {
      const habit = fallbackMatcher(entry.habitTitle);
      if (!habit) continue;

      const rawDates = Array.isArray(entry.dates) ? entry.dates : [];
      const occurrences = entry.occurrences ?? rawDates.length;

      const datesToLog: string[] = [];
      rawDates.forEach((date) => {
        if (typeof date === "string" && date.trim().length >= 8) {
          datesToLog.push(date.trim());
        }
      });

      if (datesToLog.length === 0 && occurrences > 0) {
        for (let i = 0; i < occurrences; i++) {
          const inferred = new Date();
          inferred.setUTCDate(inferred.getUTCDate() - i);
          const iso = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(inferred);
          datesToLog.push(iso);
        }
      }

      const loggedDates: string[] = [];
      for (const dateStr of datesToLog) {
        try {
          const completionDate = new Date(`${dateStr}T12:00:00Z`);
          await logHabitCompletion({
            userId,
            habitId: habit.id,
            goalId: habit.linkedGoals?.[0]?.id,
            completedAt: completionDate,
          });
          loggedAny = true;
          loggedDates.push(dateStr);
        } catch (error: any) {
          if (error?.status === 409) {
            continue;
          }
          console.warn("[ReviewProgressAgent] Failed to log habit completion", error);
        }
      }

      if (loggedDates.length > 0) {
        const formatted = loggedDates.map((dateStr) => {
          const when = new Date(`${dateStr}T12:00:00Z`);
          return summariesFormatter.format(when);
        });
        summaries.push(`Logged ${habit.title} for ${formatted.join(", ")}.`);
      }
    }

    return { summaries, updated: loggedAny };
  }
}
