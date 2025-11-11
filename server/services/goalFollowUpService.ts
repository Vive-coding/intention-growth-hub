import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db";
import { NotificationService } from "./notificationService";
import { MyFocusService } from "./myFocusService";
import { notificationFollowups } from "../../shared/schema";
import { sendEmail } from "./emailService";

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

        const goalSummaryLines = goals.map((goal) => {
          const progress = typeof goal.progress === "number" ? `${goal.progress}%` : "in progress";
          return `• ${goal.title}${progress ? ` — ${progress}` : ""}`;
        });

        const bodyParagraphs = [
          "I just reviewed your focus goals and wanted to check in.",
          `Here’s how things look right now:\n${goalSummaryLines.join("\n")}`,
          "When you have a minute, reply so we can celebrate the wins and tackle anything that feels stuck.",
        ];

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
