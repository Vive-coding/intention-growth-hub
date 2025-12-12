import { NotificationService } from "../services/notificationService";
import { MyFocusService } from "../services/myFocusService";
import { db } from "../db";
import { notificationFollowups, users } from "../../shared/schema";
import { eq, and, desc, gt } from "drizzle-orm";
import "dotenv/config";

async function debugNotificationFlow() {
  console.log("=== Debugging Notification Flow ===\n");
  
  const userEmail = "vivek.rok@gmail.com";
  
  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, userEmail));
  
  if (!user) {
    console.log("❌ User not found");
    return;
  }
  
  console.log("Step 1: Checking if user is eligible via getUsersDueForNotification()...");
  
  // Manually check what getUsersDueForNotification would return
  const eligibleUsers = await NotificationService.getUsersDueForNotification();
  const isEligible = eligibleUsers.some(u => u.email === userEmail);
  
  console.log(`   Eligible users found: ${eligibleUsers.length}`);
  console.log(`   User in eligible list: ${isEligible ? "✅ YES" : "❌ NO"}`);
  
  if (!isEligible) {
    console.log("\n❌ User was filtered out by getUsersDueForNotification()");
    console.log("   Check: time preference, frequency, weekday, hours since last email");
    process.exit(0);
  }
  
  console.log("\n✅ User passed getUsersDueForNotification() check");
  console.log("\nStep 2: Checking for blocking pending emails...");
  
  // Check for pending emails (what the code checks)
  const existing = await db
    .select({ id: notificationFollowups.id, expiresAt: notificationFollowups.expiresAt })
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        eq(notificationFollowups.status, "pending"),
        gt(notificationFollowups.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    console.log(`   ⚠️  Found ${existing.length} active pending notification(s) - would BLOCK`);
    console.log(`   ID: ${existing[0].id}`);
    console.log(`   Expires: ${existing[0].expiresAt}`);
  } else {
    console.log("   ✅ No active pending notifications - would NOT block");
  }
  
  console.log("\nStep 3: Checking for priority goals...");
  
  const focus = await MyFocusService.getMyFocus(user.id);
  const goals = (focus?.priorityGoals || []).filter((goal: any) => goal.status !== "completed").slice(0, 3);
  
  console.log(`   Priority goals found: ${goals.length}`);
  
  if (goals.length === 0) {
    console.log("   ❌ No active priority goals - would SKIP sending email");
    console.log("\n   This is likely why no email was sent!");
    console.log("   The code requires at least 1 active priority goal to send a check-in email.");
    
    // Show what goals exist
    const allGoals = focus?.priorityGoals || [];
    console.log(`\n   Total priority goals in focus: ${allGoals.length}`);
    if (allGoals.length > 0) {
      allGoals.forEach((g: any, i: number) => {
        console.log(`   ${i + 1}. ${g.title} - Status: ${g.status}`);
      });
    }
  } else {
    console.log("   ✅ Has active priority goals:");
    goals.forEach((g: any, i: number) => {
      console.log(`      ${i + 1}. ${g.title}`);
    });
  }
  
  if (existing.length === 0 && goals.length > 0) {
    console.log("\n✅ All checks passed! User should receive email on next cron run.");
    console.log("   If no email arrives, check Railway logs for errors in the cron job.");
  }
  
  process.exit(0);
}

debugNotificationFlow().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

