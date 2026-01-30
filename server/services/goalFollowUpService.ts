import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db";
import { NotificationService } from "./notificationService";
import { MyFocusService } from "./myFocusService";
import { notificationFollowups } from "../../shared/schema";
import { sendEmail } from "./emailService";
import { ChatThreadService } from "./chatThreadService";
import { ChatOpenAI } from "@langchain/openai";
import { createModel, type ModelName } from "../ai/modelFactory";
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
    options?: { timezone?: string | null; now?: Date; modelName?: ModelName }
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

      // Get the most recent conversation thread to reference where things left off
      const recentThreads = await ChatThreadService.listThreads(userId, 1);
      let conversationContext = "";
      
      if (recentThreads.length > 0) {
        const mostRecentThread = recentThreads[0];
        const recentMessages = await ChatThreadService.getMessages(mostRecentThread.id, 6); // Last 6 messages (3 exchanges)
        
        if (recentMessages.length > 0) {
          // Extract the last few exchanges to understand where the conversation left off
          const relevantMessages = recentMessages.slice(-6);
          const conversationSummary = relevantMessages
            .map((msg: any) => {
              const role = msg.role === 'user' ? 'User' : 'Coach';
              const content = (msg.content || '').substring(0, 150); // Keep it shorter
              return `${role}: ${content}`;
            })
            .join('\n\n');
          
          conversationContext = `\n\nWhere the conversation left off (last few exchanges):\n${conversationSummary}`;
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
      const modelName = options?.modelName || "gpt-5-mini";
      const model = createModel(modelName);

      const systemPrompt = `You are a warm, encouraging life coach writing a brief check-in email. Your goal is to:
1. Start with where the last conversation left off - reference what was discussed, what next steps were mentioned, or what they were working through
2. Check in on next steps or how things are going, based on that conversation context
3. Keep it extremely brief: MAX 2-3 sentences total
4. Be tactful and conversational - don't list out all habits or dump information
5. Focus on one key thing from the conversation or one natural next step
6. Use the time-of-day context to shape your check-in:
   - Morning: gentle check-in on how they want to approach today, referencing what was discussed
   - Afternoon: brief check-in on how the day is going
   - Evening: brief reflection on how the day went

Time-of-day context: ${timeContext}

CRITICAL: Keep it to 2-3 sentences maximum. Do NOT list all habits or goals. Reference the conversation context naturally and check in on next steps.`;

      const userPrompt = `Generate a brief, tactful check-in email for ${firstName || 'the user'}.

${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ''}Their current focus goals:
${goalsList}

Their high-leverage habits:
${habitsList}

Write a warm, brief check-in email (MAX 2-3 sentences) that:
- Starts with where the last conversation left off (if there was a recent conversation)
- Checks in on next steps or how things are going
- References ONE thing naturally from the conversation context or their current focus
- Does NOT list out all habits or goals - just reference what's relevant naturally
- Uses the time-of-day context to shape the check-in naturally

Return ONLY the email body (2-3 sentences max), as a single paragraph or two very short ones. Do not include greetings, signatures, or list formatting.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const response = await model.invoke(messages);
      const content = response.content as string;
      
      // Split into paragraphs, clean up, and limit to 2-3 sentences
      let paragraphs = content
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.match(/^(Hi|Hello|Dear|Best|Thanks|—)/i));
      
      // If we got too many paragraphs, combine into 1-2 concise ones
      if (paragraphs.length > 2) {
        // Combine all paragraphs into sentences, then recombine into max 2 paragraphs
        const allSentences = paragraphs
          .join(' ')
          .split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .slice(0, 3); // Max 3 sentences
        
        // Split into 1-2 paragraphs
        if (allSentences.length <= 2) {
          paragraphs = [allSentences.join('. ') + '.'];
        } else {
          paragraphs = [
            allSentences.slice(0, 2).join('. ') + '.',
            allSentences.slice(2).join('. ') + '.'
          ];
        }
      }
      
      // If AI didn't generate good content, fall back to a simple personalized version
      if (paragraphs.length === 0) {
        // Use conversation context if available, otherwise simple check-in
        if (conversationContext) {
          return [
            "Quick check-in: How are things going with what we discussed? Anything you want to share or work through?",
          ];
        }
        const primaryGoal = goals[0];
        if (primaryGoal) {
          return [
            `Quick check-in: How are things going with ${primaryGoal.title}?`,
          ];
        }
        return [
          "Quick check-in: How are things going? Anything you want to share?",
        ];
      }

      // Ensure we don't return more than 2 paragraphs
      return paragraphs.slice(0, 2);
    } catch (error) {
      console.error("[GoalFollowUpService] Failed to generate AI email content:", error);
      // Fallback to simple, concise personalized content
      const primaryGoal = goals[0];
      if (primaryGoal) {
        return [
          `Quick check-in: How are things going with ${primaryGoal.title}?`,
        ];
      }
      return [
        "Quick check-in: How are things going? Anything you want to share?",
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

        // Only check for pending emails to avoid duplicate sends
        // "sent" emails should not block new emails - the 20-hour frequency check already handles that
        const existing = await db
          .select({ id: notificationFollowups.id })
          .from(notificationFollowups)
          .where(
            and(
              eq(notificationFollowups.userId, profile.userId),
              eq(notificationFollowups.status, "pending"),
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
