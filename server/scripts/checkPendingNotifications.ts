import { db } from "../db";
import { notificationFollowups } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import "dotenv/config";

async function checkPendingNotifications() {
  console.log("=== Checking Pending Notifications ===\n");
  
  const userEmail = "vivek.rok@gmail.com";
  
  // Get user
  const { users } = await import("../../shared/schema");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, userEmail));
  
  if (!user) {
    console.log("❌ User not found");
    return;
  }
  
  // Get all pending notifications
  const pending = await db
    .select()
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        eq(notificationFollowups.status, "pending")
      )
    )
    .orderBy(desc(notificationFollowups.createdAt));
  
  console.log(`Found ${pending.length} pending notifications:\n`);
  
  const now = new Date();
  
  pending.forEach((n, i) => {
    const created = new Date(n.createdAt!);
    const expires = n.expiresAt ? new Date(n.expiresAt) : null;
    const hoursSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const isExpired = expires ? now > expires : false;
    
    console.log(`${i + 1}. Notification ID: ${n.id}`);
    console.log(`   Created: ${created.toLocaleString("en-US", { timeZone: "America/Toronto" })}`);
    console.log(`   Expires: ${expires ? expires.toLocaleString("en-US", { timeZone: "America/Toronto" }) : "N/A"}`);
    console.log(`   Hours Since Created: ${hoursSinceCreated.toFixed(2)}`);
    console.log(`   Is Expired: ${isExpired ? "✅ YES" : "❌ NO"}`);
    console.log(`   Expires At: ${expires?.toISOString() || "null"}`);
    console.log("");
  });
  
  // Check if any are blocking (not expired)
  const activePending = pending.filter(n => {
    if (!n.expiresAt) return true;
    return new Date() < new Date(n.expiresAt);
  });
  
  console.log(`\nActive (non-expired) pending notifications: ${activePending.length}`);
  
  if (activePending.length > 0) {
    console.log("\n⚠️  These pending notifications are blocking new emails!");
    console.log("   The code checks for ANY pending notification that hasn't expired.");
    console.log("   You may need to clean these up or mark them as expired.");
  }
  
  process.exit(0);
}

checkPendingNotifications().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

