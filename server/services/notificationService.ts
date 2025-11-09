import { eq } from "drizzle-orm";
import { db } from "../db";
import { userOnboardingProfiles, users } from "../../shared/schema";

interface NotificationProfile {
  userId: string;
  notificationEnabled: boolean | null;
  notificationFrequency: string | null;
  preferredNotificationTime: string | null;
  coachingStyle: string[] | null;
}

export class NotificationService {
  static async getUsersDueForNotification(): Promise<NotificationProfile[]> {
    const now = new Date();
    const currentHour = now.getHours();

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
        notificationEnabled: userOnboardingProfiles.notificationEnabled,
        notificationFrequency: userOnboardingProfiles.notificationFrequency,
        preferredNotificationTime: userOnboardingProfiles.preferredNotificationTime,
        coachingStyle: userOnboardingProfiles.coachingStyle,
      })
      .from(userOnboardingProfiles)
      .innerJoin(users, eq(userOnboardingProfiles.userId, users.id))
      .where(eq(userOnboardingProfiles.notificationEnabled, true));

    // TODO: add persistence for last notification timestamps and respect frequency cadence
    return rows.filter((row) => (row.preferredNotificationTime ?? timePeriod) === timePeriod);
  }

  static generateNotificationMessage(profile: { coachingStyle?: string[] | null }): string {
    const styles = profile.coachingStyle || [];
    if (styles.includes("accountability")) {
      return "Quick check-in: how did your habits go today?";
    }
    if (styles.includes("suggestions")) {
      return "Have a minute? Let’s review your progress and plan the next step.";
    }
    return "Hey! Just checking in—how are your goals feeling today?";
  }

  static async sendSMS(phoneNumber: string, message: string) {
    // Placeholder for future SMS integration (Twilio, etc.)
    console.log(`[NotificationService] Sending SMS to ${phoneNumber}: ${message}`);
  }
}

