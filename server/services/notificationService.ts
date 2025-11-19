import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { userOnboardingProfiles, users, notificationFollowups } from "../../shared/schema";
import { sendEmail } from "./emailService";

interface NotificationProfile {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  timezone?: string | null;
  notificationEnabled: boolean | null;
  notificationFrequency: string | null;
  preferredNotificationTime: string | null;
  coachingStyle: string[] | null;
}

interface EmailTemplateOptions {
  ctaUrl?: string;
  previewText?: string;
  subject?: string;
  bodyParagraphs?: string[];
  ctaLabel?: string;
}

export class NotificationService {
  static async getUsersDueForNotification(): Promise<NotificationProfile[]> {
    const now = new Date();

    const rows = await db
      .select({
        userId: userOnboardingProfiles.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        timezone: users.timezone,
        notificationEnabled: userOnboardingProfiles.notificationEnabled,
        notificationFrequency: userOnboardingProfiles.notificationFrequency,
        preferredNotificationTime: userOnboardingProfiles.preferredNotificationTime,
        coachingStyle: userOnboardingProfiles.coachingStyle,
      })
      .from(userOnboardingProfiles)
      .innerJoin(users, eq(userOnboardingProfiles.userId, users.id))
      .where(eq(userOnboardingProfiles.notificationEnabled, true));

    // Filter users based on their preferences and frequency
    const eligibleUsers: NotificationProfile[] = [];
    
    for (const row of rows) {
      // Derive the user's local time using their timezone (or a sensible default).
      const tz = (row as any).timezone || process.env.DEFAULT_TZ || "UTC";
      let localHour = now.getUTCHours();
      let localDayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

      try {
        const formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          hour: "2-digit",
          hour12: false,
          weekday: "short",
        });
        const parts = formatter.formatToParts(now);
        const hourPart = parts.find((p) => p.type === "hour");
        const weekdayPart = parts.find((p) => p.type === "weekday");

        if (hourPart?.value) {
          const parsedHour = parseInt(hourPart.value, 10);
          if (!Number.isNaN(parsedHour)) {
            localHour = parsedHour;
          }
        }

        if (weekdayPart?.value) {
          const map: Record<string, number> = {
            Sun: 0,
            Mon: 1,
            Tue: 2,
            Wed: 3,
            Thu: 4,
            Fri: 5,
            Sat: 6,
          };
          if (weekdayPart.value in map) {
            localDayOfWeek = map[weekdayPart.value];
          }
        }
      } catch {
        // Fallback to UTC-based values if timezone parsing fails
        localHour = now.getUTCHours();
        localDayOfWeek = now.getUTCDay();
      }

      // Only send on weekdays in the user's local timezone.
      if (localDayOfWeek === 0 || localDayOfWeek === 6) {
        continue;
      }

      // Map local time to a coarse time period for preference matching.
      // These windows mirror the onboarding copy roughly:
      //  - Morning:   8–11
      //  - Afternoon: 14–17
      //  - Evening:   18–21
      let timePeriod: "morning" | "afternoon" | "evening" | null = null;
      if (localHour >= 8 && localHour < 12) {
        timePeriod = "morning";
      } else if (localHour >= 14 && localHour < 18) {
        timePeriod = "afternoon";
      } else if (localHour >= 18 && localHour < 22) {
        timePeriod = "evening";
      }

      // If we're outside all supported windows, skip this user for this run.
      if (!timePeriod) {
        continue;
      }

      // Check time preference
      const timePrefs: string[] =
        typeof row.preferredNotificationTime === "string"
          ? row.preferredNotificationTime.split(",").map((t) => t.trim()).filter(Boolean)
          : Array.isArray(row.preferredNotificationTime)
          ? (row.preferredNotificationTime as string[]).filter(Boolean)
          : [];
      
      // User must have current timePeriod in their preferences (or no preference = send anytime)
      const timeMatches = timePrefs.length === 0 || timePrefs[0] === null || timePrefs.includes(timePeriod);
      
      if (!timeMatches) {
        continue;
      }

      // Check frequency preference
      const frequency = row.notificationFrequency;
      if (!frequency) {
        // No frequency preference = send daily
        eligibleUsers.push(row);
        continue;
      }

      // Get the most recent sent notification for this user
      const [lastNotification] = await db
        .select({ sentAt: notificationFollowups.sentAt })
        .from(notificationFollowups)
        .where(
          and(
            eq(notificationFollowups.userId, row.userId),
            eq(notificationFollowups.status, "sent")
          )
        )
        .orderBy(desc(notificationFollowups.sentAt))
        .limit(1);

      const lastSentAt = lastNotification?.sentAt ? new Date(lastNotification.sentAt) : null;
      const hoursSinceLastEmail = lastSentAt 
        ? (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60)
        : Infinity;

      // Check if user is due based on frequency
      let isDue = false;
      
      switch (frequency) {
        case "daily":
        case "weekday":
          // Daily/weekday: send if no email sent today (same UTC date)
          if (lastSentAt) {
            const lastSentDate = new Date(lastSentAt);
            const todayDate = new Date(now);
            // Check if last email was sent on a different UTC date
            isDue = lastSentDate.getUTCFullYear() !== todayDate.getUTCFullYear() ||
                    lastSentDate.getUTCMonth() !== todayDate.getUTCMonth() ||
                    lastSentDate.getUTCDate() !== todayDate.getUTCDate();
          } else {
            // No previous email, so eligible
            isDue = true;
          }
          break;
        
        case "every_2_days":
        case "twice_per_week":
          // Every 2 days / twice per week: send if no email sent in last 48 hours
          isDue = hoursSinceLastEmail >= 48;
          break;
        
        case "weekly":
          // Weekly: send if no email sent in last 6 days (144 hours = 6 days)
          isDue = hoursSinceLastEmail >= 144;
          break;
        
        default:
          // Unknown frequency: default to daily behavior (check if sent today)
          if (lastSentAt) {
            const lastSentDate = new Date(lastSentAt);
            const todayDate = new Date(now);
            isDue = lastSentDate.getUTCFullYear() !== todayDate.getUTCFullYear() ||
                    lastSentDate.getUTCMonth() !== todayDate.getUTCMonth() ||
                    lastSentDate.getUTCDate() !== todayDate.getUTCDate();
          } else {
            isDue = true;
          }
      }

      // Additional check for weekday frequency: only send on weekdays (in user's local timezone)
      if (frequency === "weekday" && (localDayOfWeek === 0 || localDayOfWeek === 6)) {
        isDue = false;
      }

      if (isDue) {
        eligibleUsers.push(row);
      }
    }

    return eligibleUsers;
  }

  static generateNotificationMessage(profile: { coachingStyle?: string[] | null; firstName?: string | null; }): string {
    const styles = profile.coachingStyle || [];
    const name = profile.firstName?.trim();
    const greeting = name ? `${name}, ` : "";
    if (styles.includes("accountability")) {
      return `${greeting}quick check-in: how did your habits go today?`;
    }
    if (styles.includes("suggestions")) {
      return `${greeting}have a minute? Let’s review your progress and plan the next step.`;
    }
    return `${greeting}how are your goals feeling today?`;
  }

  static generateEmailEnvelope(profile: NotificationProfile, options: EmailTemplateOptions = {}) {
    const defaultSubject = "Your GoodHabit coach is checking in";
    const subject = options.subject ?? defaultSubject;
    const firstName = profile.firstName?.trim() || "there";
    const messageBody = this.generateNotificationMessage(profile);
    const bodyParagraphs = Array.isArray(options.bodyParagraphs) && options.bodyParagraphs.length > 0
      ? options.bodyParagraphs
      : [messageBody];
    const previewText = options.previewText || bodyParagraphs[0] || messageBody;
    const ctaCopy = options.ctaLabel || "Continue the conversation";

    const htmlParts: string[] = [];
    htmlParts.push(
      `<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background-color: #f8fafc; padding: 32px;">`
    );
    htmlParts.push(`<p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">${previewText}</p>`);
    htmlParts.push(`<p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${firstName},</p>`);
    bodyParagraphs.forEach((paragraph) => {
      const safeParagraph = (paragraph || "").replace(/\n/g, "<br />");
      htmlParts.push(`<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">${safeParagraph}</p>`);
    });

    if (options.ctaUrl) {
      htmlParts.push(
        `<a href="${options.ctaUrl}" style="display: inline-block; padding: 12px 20px; background: #0f766e; color: #ffffff; border-radius: 9999px; text-decoration: none; font-weight: 600;">${ctaCopy}</a>`
      );
    }

    htmlParts.push(`<p style="margin: 24px 0 0 0; font-size: 14px; color: #475569;">— Your GoodHabit Coach</p>`);
    htmlParts.push(`</div>`);

    const html = htmlParts.join("");
    const textLines = [
      previewText,
      "",
      `Hi ${firstName},`,
      ...bodyParagraphs,
    ];
    if (options.ctaUrl) {
      textLines.push("", `${ctaCopy}: ${options.ctaUrl}`);
    }
    textLines.push("", "— Your GoodHabit Coach");

    return {
      subject,
      html,
      text: textLines.join("\n"),
      previewText,
    };
  }

  static async sendEmailNotification(profile: NotificationProfile, options: EmailTemplateOptions = {}) {
    if (!profile.email) {
      console.warn(`[NotificationService] User ${profile.userId} is due for a notification but has no email on file.`);
      return null;
    }

    const envelope = this.generateEmailEnvelope(profile, options);
    await sendEmail({
      to: profile.email,
      subject: envelope.subject,
      html: envelope.html,
      text: envelope.text,
      headers: options.previewText ? { "X-Entity-Preview": options.previewText } : undefined,
    });
    return envelope;
  }

  static generateNotificationMessagePreview(profile: NotificationProfile): string {
    return this.generateNotificationMessage(profile);
  }

  static async sendSMS(phoneNumber: string, message: string) {
    // Placeholder for future SMS integration (Twilio, etc.)
    console.log(`[NotificationService] Sending SMS to ${phoneNumber}: ${message}`);
  }
}

