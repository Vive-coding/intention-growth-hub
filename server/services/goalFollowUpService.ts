import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db";
import { NotificationService } from "./notificationService";
import { MyFocusService } from "./myFocusService";
import { notificationFollowups } from "../../shared/schema";
import { sendEmail } from "./emailService";
import { ChatThreadService } from "./chatThreadService";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const ACTIVE_FOLLOWUP_STATUSES = ["pending", "sent"] as const;

export class GoalFollowUpService {
  static readonly FOLLOW_UP_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  private static resolveAppOrigin(): string {
    const candidates = [
      process.env.APP_BASE_URL,
      process.env.APP_ORIGIN,
      process.env.FRONTEND_URL,
    ];
    const origin = candidates.find((value) => typeof value === "string" && value.trim().length > 0)
      || "https://intention-growth-hub.vercel.app";
    return origin.replace(/\/$/, "");
  }

  /**
   * Generate personalized email content using AI, referencing conversation history and habits
   */
  static async generateEmailContent(
    userId: string,
    goals: any[],
    habits: any[],
    firstName: string | null,
    options?: { timezone?: string | null; now?: Date }
  ): Promise<string[]> {
    try {
      const now = options?.now ?? new Date();
      const tz = options?.timezone || process.env.DEFAULT_TZ || "UTC";

      // Derive coarse time-of-day in the user's local timezone
      let timePeriod: "morning" | "afternoon" | "evening" | "anytime" = "anytime";
      try {
        const formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          hour: "2-digit",
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const hourPart = parts.find((p) => p.type === "hour");
        if (hourPart?.value) {
          const parsedHour = parseInt(hourPart.value, 10);
          if (!Number.isNaN(parsedHour)) {
            if (parsedHour >= 8 && parsedHour < 12) {
              timePeriod = "morning";
            } else if (parsedHour >= 14 && parsedHour < 18) {
              timePeriod = "afternoon";
            } else if (parsedHour >= 18 && parsedHour < 22) {
              timePeriod = "evening";
            }
          }
        }
      } catch {
        // If timezone parsing fails, fall back to UTC-based hour
        const hour = now.getUTCHours();
        if (hour >= 8 && hour < 12) {
          timePeriod = "morning";
        } else if (hour >= 14 && hour < 18) {
          timePeriod = "afternoon";
        } else if (hour >= 18 && hour < 22) {
          timePeriod = "evening";
        }
      }

      const timeContext =
        timePeriod === "morning"
          ? "It's morning for the user. Focus on how they want to approach today, referencing wins or effort from yesterday to motivate them."
          : timePeriod === "afternoon"
          ? "It's afternoon for the user. Ask how the day is going so far and which habits or goals they've already touched, using recent streaks as encouragement."
          : timePeriod === "evening"
          ? "It's evening for the user. Ask how the day went overall, what they were able to complete, and gently surface any habits that could use a reset tomorrow."
          : "The exact time of day is unclear. Mix gentle planning questions with light reflection on recent days.";

      // Get the most recent conversation thread
      const recentThreads = await ChatThreadService.listThreads(userId, 1);
      let conversationContext = "";
      
      if (recentThreads.length > 0) {
        const mostRecentThread = recentThreads[0];
        const recentMessages = await ChatThreadService.getMessages(mostRecentThread.id, 10);
        
        if (recentMessages.length > 0) {
          // Extract key insights from recent conversation (last 5-10 messages)
          const relevantMessages = recentMessages.slice(-10);
          const conversationSummary = relevantMessages
            .map((msg: any) => {
              const role = msg.role === 'user' ? 'User' : 'Coach';
              const content = (msg.content || '').substring(0, 200); // Truncate long messages
              return `${role}: ${content}`;
            })
            .join('\n\n');
          
          conversationContext = `\n\nRecent conversation context:\n${conversationSummary}`;
        }
      }

      // Build context about goals and habits
      const habitsList = habits.length > 0
        ? habits
            .map((h: any) => {
              const goalTitles = (h.linkedGoals || []).map((g: any) => g.title).join(', ');
              const streak =
                typeof h.streak === "number" && h.streak > 0
                  ? ` — current streak: ${h.streak} days`
                  : "";
              return `- ${h.title}${goalTitles ? ` (linked to: ${goalTitles})` : ''}${streak}`;
            })
            .join('\n')
        : 'No active habits yet';
      
      const goalsList = goals
        .map((g: any) => {
          const progress = typeof g.progress === "number" ? `${g.progress}%` : "in progress";
          return `- ${g.title} — ${progress}`;
        })
        .join('\n');

      // Use AI to generate personalized email content
      const model = new ChatOpenAI({
        model: "gpt-5-mini",
        temperature: 0.7,
        maxTokens: 300,
      });

      const systemPrompt = `You are a warm, encouraging life coach writing a brief check-in email. Your goal is to:
1. Reference the user's habits FIRST (since habits are the actions they take), then relate them to goals
2. Ask intuitive questions that reference the last conversation if relevant (e.g., if they mentioned lacking motivation, struggling with progress, or feeling excited)
3. Ask about specific habits that are important and in focus
4. Keep it conversational, warm, and brief (2-3 short paragraphs max)
5. Focus on engagement and starting a conversation, not just reporting status
6. Use the time-of-day context to shape your questions:
   - Morning: focus on how they want to approach today, grounded in what worked or didn't work yesterday.
   - Afternoon: ask how the day is going so far and what they've already done.
   - Evening: review how the day went and reinforce streaks and small wins.

Time-of-day context: ${timeContext}

Format your response as 2-3 separate paragraphs, each on a new line.`;

      const userPrompt = `Generate a personalized check-in email for ${firstName || 'the user'}.

Their current focus goals (including current progress % which reflects recent days of effort):
${goalsList}

Their high-leverage habits (including streaks that reflect recent consistency):
${habitsList}
${conversationContext}

Write a warm, engaging email that:
- Asks about specific habits first (e.g., "Were you able to send networking outreach today? We discussed that this is crucial for your goal of lining up calls for next week")
- References the last conversation if there's anything relevant (motivation struggles, progress challenges, excitement)
- Invites them to share how things are going
- Keeps it brief and conversational
- Uses the time-of-day guidance above so the questions feel natural (planning in the morning, check-in during the afternoon, reflection in the evening)
- Uses habit streaks and goal progress to encourage them based on the last few days, not just today

Return ONLY the email body paragraphs (2-3 paragraphs), one per line. Do not include greetings or signatures.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const response = await model.invoke(messages);
      const content = response.content as string;
      
      // Split into paragraphs, clean up, and return
      const paragraphs = content
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.match(/^(Hi|Hello|Dear|Best|Thanks|—)/i));
      
      // If AI didn't generate good content, fall back to a simple personalized version
      if (paragraphs.length === 0) {
        const primaryHabit = habits[0];
        if (primaryHabit) {
          return [
            `Quick check-in: Were you able to ${primaryHabit.title.toLowerCase()} today?`,
            `We discussed that this habit is crucial for your goal of ${goals[0]?.title || 'making progress'}. How did it go?`,
          ];
        }
        return [
          "I wanted to check in on your focus goals.",
          `How are things going with ${goals[0]?.title || 'your progress'}? Any wins to celebrate or challenges to work through?`,
        ];
      }

      return paragraphs;
    } catch (error) {
      console.error("[GoalFollowUpService] Failed to generate AI email content:", error);
      // Fallback to simple personalized content
      const primaryHabit = habits[0];
      if (primaryHabit) {
        return [
          `Quick check-in: Were you able to ${primaryHabit.title.toLowerCase()} today?`,
          `We discussed that this habit is crucial for your goal of ${goals[0]?.title || 'making progress'}. How did it go?`,
        ];
      }
      return [
        "I wanted to check in on your focus goals.",
        `How are things going with ${goals[0]?.title || 'your progress'}? Any wins to celebrate or challenges to work through?`,
      ];
    }
  }

  static async runScheduledCheckIns(): Promise<void> {
    const profiles = await NotificationService.getUsersDueForNotification();
    if (!profiles.length) {
      return;
    }

    for (const profile of profiles) {
      try {
        if (!profile.userId || !profile.email) {
          continue;
        }

        const existing = await db
          .select({ id: notificationFollowups.id })
          .from(notificationFollowups)
          .where(
            and(
              eq(notificationFollowups.userId, profile.userId),
              inArray(notificationFollowups.status, ACTIVE_FOLLOWUP_STATUSES as unknown as string[]),
              gt(notificationFollowups.expiresAt, new Date())
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue;
        }

        const focus = await MyFocusService.getMyFocus(profile.userId);
        const goals = (focus?.priorityGoals || []).filter((goal) => goal.status !== "completed").slice(0, 3);
        if (!goals.length) {
          continue;
        }

        // Get high-leverage habits for email personalization
        const habits = (focus?.highLeverageHabits || []).slice(0, 5); // Get top 5 habits

        // Generate AI-powered personalized email content (time-of-day aware)
        const bodyParagraphs = await this.generateEmailContent(
          profile.userId,
          goals,
          habits,
          profile.firstName,
          { timezone: (profile as any).timezone ?? null }
        );

        const appOrigin = this.resolveAppOrigin();
        const token = randomBytes(24).toString("hex");
        const ctaPath = `/?followup=${token}`;
        const ctaUrl = `${appOrigin}${ctaPath}`;
        const previewText = `Quick check-in on your focus goals${goals.length > 1 ? "" : `: ${goals[0].title}`}`;

        const envelope = NotificationService.generateEmailEnvelope(profile, {
          subject: "How are your focus goals coming along?",
          previewText,
          bodyParagraphs,
          ctaLabel: "Continue this check-in",
          ctaUrl,
        });

        const expiresAt = new Date(Date.now() + this.FOLLOW_UP_EXPIRY_MS);
        const payload = {
          goals: goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            progress: goal.progress,
            status: goal.status,
          })),
          generatedAt: new Date().toISOString(),
        };

        const [record] = await db
          .insert(notificationFollowups)
          .values({
            userId: profile.userId,
            token,
            status: "pending",
            subject: envelope.subject,
            previewText: envelope.previewText,
            bodyParagraphs,
            payload,
            ctaPath,
            expiresAt,
          })
          .returning({ id: notificationFollowups.id });

        try {
          await sendEmail({
            to: profile.email,
            subject: envelope.subject,
            html: envelope.html,
            text: envelope.text,
            headers: { "X-Entity-Preview": envelope.previewText },
          });

          await db
            .update(notificationFollowups)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(notificationFollowups.id, record.id));
        } catch (sendError) {
          console.error("[GoalFollowUpService] Failed to send follow-up email", sendError);
          await db
            .update(notificationFollowups)
            .set({ status: "failed" })
            .where(eq(notificationFollowups.id, record.id));
        }
      } catch (error) {
        console.error("[GoalFollowUpService] Failed to process notification for user", profile.userId, error);
      }
    }
  }
}
