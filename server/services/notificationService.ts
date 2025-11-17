import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { userOnboardingProfiles, users, notificationFollowups } from "../../shared/schema";
import { sendEmail } from "./emailService";

interface NotificationProfile {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
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
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Exclude weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return [];
    }

    let timePeriod: "morning" | "afternoon" | "evening" | null = null;
    if (currentHour >= 8 && currentHour < 12) {
      timePeriod = "morning";
    } else if (currentHour >= 14 && currentHour < 18) {
      timePeriod = "afternoon";
    } else if (currentHour >= 18 && currentHour < 22) {
      timePeriod = "evening";
    }

    if (!timePeriod) {
      return [];
    }

    const rows = await db
      .select({
        userId: userOnboardingProfiles.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
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
      // Check time preference
      const timePrefs = typeof row.preferredNotificationTime === 'string'
        ? row.preferredNotificationTime.split(',').map(t => t.trim()).filter(Boolean)
        : Array.isArray(row.preferredNotificationTime)
          ? row.preferredNotificationTime.filter(Boolean)
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
          // Daily/weekday: send if no email sent in last 20 hours (allows for once per day)
          isDue = hoursSinceLastEmail >= 20;
          break;
        
        case "every_2_days":
        case "twice_per_week":
          // Every 2 days / twice per week: send if no email sent in last 48 hours
          isDue = hoursSinceLastEmail >= 48;
          break;
        
        case "weekly":
          // Weekly: send if no email sent in last 6 days (168 hours)
          isDue = hoursSinceLastEmail >= 144; // 6 days to allow some flexibility
          break;
        
        default:
          // Unknown frequency: default to daily behavior
          isDue = hoursSinceLastEmail >= 20;
      }

      // Additional check for weekday frequency: only send on weekdays (already checked above)
      if (frequency === "weekday" && (dayOfWeek === 0 || dayOfWeek === 6)) {
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

