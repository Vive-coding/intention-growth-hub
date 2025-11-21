import { db } from "../db";
import { users, userOnboardingProfiles, notificationFollowups } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import "dotenv/config";

async function checkEmailStatus() {
  console.log("=== Email Status Check ===\n");
  
  const userEmail = "vivek.rok@gmail.com";
  
  // Get user details
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, userEmail));
  
  if (!user) {
    console.log("❌ User not found");
    return;
  }
  
  console.log("User ID:", user.id);
  console.log("Email:", user.email);
  console.log("Timezone:", user.timezone || "UTC");
  console.log("");
  
  // Get onboarding profile
  const [profile] = await db
    .select()
    .from(userOnboardingProfiles)
    .where(eq(userOnboardingProfiles.userId, user.id));
  
  if (profile) {
    console.log("Notification Settings:");
    console.log("  Enabled:", profile.notificationEnabled);
    console.log("  Frequency:", profile.notificationFrequency);
    console.log("  Preferred Time:", profile.preferredNotificationTime);
    console.log("");
  } else {
    console.log("❌ No onboarding profile found\n");
  }
  
  // Get last sent notification
  const [lastNotification] = await db
    .select()
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        eq(notificationFollowups.status, "sent")
      )
    )
    .orderBy(desc(notificationFollowups.sentAt))
    .limit(1);
  
  if (lastNotification) {
    const now = new Date();
    const sentAt = new Date(lastNotification.sentAt!);
    const hoursSince = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
    
    console.log("Last Email:");
    console.log("  Sent At:", sentAt.toISOString());
    console.log("  Hours Since:", hoursSince.toFixed(2));
    console.log("  Status:", lastNotification.status);
    console.log("");
    
    // Check if due based on frequency
    const frequency = profile?.notificationFrequency || "daily";
    let requiredHours = 20; // default
    
    switch (frequency) {
      case "daily":
      case "weekday":
        requiredHours = 20;
        break;
      case "every_2_days":
        requiredHours = 48;
        break;
      case "twice_per_week":
        requiredHours = 84;
        break;
      case "weekly":
        requiredHours = 168;
        break;
    }
    
    console.log("Due Check:");
    console.log("  Frequency:", frequency);
    console.log("  Required Hours:", requiredHours);
    console.log("  Hours Since Last:", hoursSince.toFixed(2));
    console.log("  Is Due:", hoursSince >= requiredHours ? "✅ YES" : "❌ NO");
    console.log("");
  } else {
    console.log("Last Email: None found (should be eligible)\n");
  }
  
  // Check current local time
  const now = new Date();
  const tz = user.timezone || "UTC";
  
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    
    const formatted = formatter.format(now);
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour");
    const localHour = hourPart ? parseInt(hourPart.value, 10) : 0;
    
    console.log("Current Time:");
    console.log("  Local:", formatted);
    console.log("  Local Hour:", localHour);
    console.log("  UTC:", now.toISOString());
    console.log("");
    
    // Determine time period
    let timePeriod: string = "outside window";
    if (localHour >= 8 && localHour < 12) {
      timePeriod = "morning (8-12)";
    } else if (localHour >= 14 && localHour < 18) {
      timePeriod = "afternoon (14-18)";
    } else if (localHour >= 18 && localHour < 22) {
      timePeriod = "evening (18-22)";
    }
    
    console.log("  Time Period:", timePeriod);
    
    // Check if matches preference
    const timePrefs: string[] =
      typeof profile?.preferredNotificationTime === "string"
        ? profile.preferredNotificationTime.split(",").map((t) => t.trim()).filter(Boolean)
        : Array.isArray(profile?.preferredNotificationTime)
        ? (profile.preferredNotificationTime as string[]).filter(Boolean)
        : [];
    
    console.log("  Preferred Times:", timePrefs.length > 0 ? timePrefs.join(", ") : "any");
    
    const currentPeriod = timePeriod.split(" ")[0];
    const timeMatches = timePrefs.length === 0 || timePrefs.includes(currentPeriod);
    console.log("  Time Matches:", timeMatches ? "✅ YES" : "❌ NO");
    console.log("");
    
    // Check day of week
    const weekdayPart = parts.find((p) => p.type === "weekday");
    const dayOfWeek = weekdayPart?.value || "";
    const isWeekday = !["Saturday", "Sunday"].includes(dayOfWeek);
    
    console.log("  Day:", dayOfWeek);
    console.log("  Is Weekday:", isWeekday ? "✅ YES" : "❌ NO");
    
  } catch (error) {
    console.error("Error checking timezone:", error);
  }
  
  // Get all notifications for this user
  const allNotifications = await db
    .select({
      createdAt: notificationFollowups.createdAt,
      sentAt: notificationFollowups.sentAt,
      status: notificationFollowups.status,
    })
    .from(notificationFollowups)
    .where(eq(notificationFollowups.userId, user.id))
    .orderBy(desc(notificationFollowups.createdAt))
    .limit(10);
  
  console.log("\nRecent Notifications (last 10):");
  if (allNotifications.length === 0) {
    console.log("  None found");
  } else {
    allNotifications.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.status} - Created: ${n.createdAt}, Sent: ${n.sentAt || "N/A"}`);
    });
  }
  
  process.exit(0);
}

checkEmailStatus().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

