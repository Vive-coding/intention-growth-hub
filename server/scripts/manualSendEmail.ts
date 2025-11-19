/**
 * Manually trigger a coach follow-up email for a single user by email.
 * Usage: tsx server/scripts/manualSendEmail.ts user@example.com
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db";
import { users, notificationFollowups } from "../../shared/schema";
import { MyFocusService } from "../services/myFocusService";
import { NotificationService } from "../services/notificationService";
import { GoalFollowUpService } from "../services/goalFollowUpService";
import { sendEmail } from "../services/emailService";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: tsx server/scripts/manualSendEmail.ts <userEmail>");
    process.exit(1);
  }

  console.log(`\n🔔 Manually triggering follow-up email for: ${email}\n`);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error("❌ User not found");
    process.exit(1);
  }

  if (!user.email) {
    console.error("❌ User has no email on file");
    process.exit(1);
  }

  console.log("✅ User found:", {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
  });

  const now = new Date();

  // Ensure there is no active follow-up blocking a new email (same check as scheduled job)
  const ACTIVE_FOLLOWUP_STATUSES = ["pending", "sent"] as const;
  const existing = await db
    .select({
      id: notificationFollowups.id,
      status: notificationFollowups.status,
      expiresAt: notificationFollowups.expiresAt,
    })
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        inArray(
          notificationFollowups.status,
          ACTIVE_FOLLOWUP_STATUSES as unknown as string[],
        ),
        gt(notificationFollowups.expiresAt, now),
      ),
    );

  if (existing.length > 0) {
    console.log("\n⚠️  User has an active follow-up that hasn't expired yet:", {
      id: existing[0].id,
      status: existing[0].status,
      expiresAt: existing[0].expiresAt,
    });
    console.log(
      "   Skipping send to avoid conflicting with an active follow-up.\n",
    );
    process.exit(0);
  }

  // Fetch focus, goals and habits (same inputs as scheduled job)
  const focus = await MyFocusService.getMyFocus(user.id);
  const goals = (focus?.priorityGoals || [])
    .filter((goal: any) => goal.status !== "completed")
    .slice(0, 3);

  if (!goals.length) {
    console.log(
      "\n⚠️  User has no active priority goals – follow-up email requires at least one active goal.\n",
    );
    process.exit(0);
  }

  const habits = (focus?.highLeverageHabits || []).slice(0, 5);

  console.log("\n🎯 Goals and habits for email:", {
    goalTitles: goals.map((g: any) => g.title),
    habitTitles: habits.map((h: any) => h.title),
  });

  // Generate personalized AI email content
  const bodyParagraphs = await GoalFollowUpService.generateEmailContent(
    user.id,
    goals,
    habits,
    user.firstName,
  );

  // Resolve app origin similarly to GoalFollowUpService
  const candidates = [
    process.env.APP_BASE_URL,
    process.env.APP_ORIGIN,
    process.env.FRONTEND_URL,
  ];
  const origin =
    candidates.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) || "https://intention-growth-hub.vercel.app";
  const appOrigin = origin.replace(/\/$/, "");

  const token = randomBytes(24).toString("hex");
  const ctaPath = `/?followup=${token}`;
  const ctaUrl = `${appOrigin}${ctaPath}`;
  const previewText = `Quick check-in on your focus goals${
    goals.length > 1 ? "" : `: ${goals[0].title}`
  }`;

  const profileForEnvelope = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    notificationEnabled: true,
    notificationFrequency: null,
    preferredNotificationTime: null,
    coachingStyle: null,
  } as any;

  const envelope = NotificationService.generateEmailEnvelope(
    profileForEnvelope,
    {
      subject: "How are your focus goals coming along?",
      previewText,
      bodyParagraphs,
      ctaLabel: "Continue this check-in",
      ctaUrl,
    },
  );

  const expiresAt = new Date(
    Date.now() + GoalFollowUpService.FOLLOW_UP_EXPIRY_MS,
  );
  const payload = {
    goals: goals.map((goal: any) => ({
      id: goal.id,
      title: goal.title,
      progress: goal.progress,
      status: goal.status,
    })),
    generatedAt: new Date().toISOString(),
  };

  console.log("\n✉️  Creating follow-up record and sending email...");

  const [record] = await db
    .insert(notificationFollowups)
    .values({
      userId: user.id,
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
      to: user.email,
      subject: envelope.subject,
      html: envelope.html,
      text: envelope.text,
      headers: { "X-Entity-Preview": envelope.previewText },
    });

    await db
      .update(notificationFollowups)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(notificationFollowups.id, record.id));

    console.log("\n✅ Follow-up email sent successfully!", {
      to: user.email,
      followupId: record.id,
      ctaUrl,
    });
  } catch (error) {
    console.error("\n❌ Failed to send follow-up email:", error);
    await db
      .update(notificationFollowups)
      .set({ status: "failed" })
      .where(eq(notificationFollowups.id, record.id));
    process.exit(1);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Unhandled error in manualSendEmail script:", err);
  process.exit(1);
});


