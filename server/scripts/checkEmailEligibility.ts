/**
 * Diagnostic script to check why a user isn't receiving emails
 * Run with: tsx server/scripts/checkEmailEligibility.ts <userEmail>
 */

import 'dotenv/config';
import { db } from '../db';
import { users, userOnboardingProfiles, notificationFollowups, goalInstances, goalDefinitions } from '../../shared/schema';
import { eq, and, desc, inArray, gt } from 'drizzle-orm';
import { MyFocusService } from '../services/myFocusService';

async function checkEmailEligibility(userEmail: string) {
  console.log(`\n🔍 Checking email eligibility for: ${userEmail}\n`);

  // 1. Find user
  const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  console.log(`✅ User found: ${user.id}`);

  // 2. Check onboarding profile
  const [profile] = await db
    .select()
    .from(userOnboardingProfiles)
    .where(eq(userOnboardingProfiles.userId, user.id))
    .limit(1);

  if (!profile) {
    console.log('❌ No onboarding profile found');
    return;
  }

  console.log(`\n📧 Notification Settings:`);
  console.log(`  - Enabled: ${profile.notificationEnabled}`);
  console.log(`  - Frequency: ${profile.notificationFrequency || 'not set (defaults to daily)'}`);
  console.log(`  - Preferred Time: ${profile.preferredNotificationTime || 'not set (anytime)'}`);

  if (!profile.notificationEnabled) {
    console.log('\n❌ Notifications are DISABLED for this user');
    return;
  }

  // 3. Check current time and eligibility
  const now = new Date();
  const currentHourUTC = now.getUTCHours();
  const dayOfWeekUTC = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  console.log(`\n⏰ Current Time (UTC):`);
  console.log(`  - Hour: ${currentHourUTC}`);
  console.log(`  - Day: ${dayOfWeekUTC} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeekUTC]})`);

  if (dayOfWeekUTC === 0 || dayOfWeekUTC === 6) {
    console.log('\n❌ It\'s a weekend - emails only send on weekdays');
    return;
  }

  // Check time period
  let timePeriod: "morning" | "afternoon" | "evening" | null = null;
  if (currentHourUTC >= 8 && currentHourUTC < 12) {
    timePeriod = "morning";
  } else if (currentHourUTC >= 14 && currentHourUTC < 18) {
    timePeriod = "afternoon";
  } else if (currentHourUTC >= 18 && currentHourUTC < 22) {
    timePeriod = "evening";
  }

  console.log(`  - Time Period: ${timePeriod || 'OUTSIDE email windows (8-12, 14-18, 18-22 UTC)'}`);

  if (!timePeriod) {
    console.log('\n❌ Current time is outside email sending windows');
    console.log('   Cron runs at: 9:15, 15:15, 19:15 UTC on weekdays');
    return;
  }

  // Check time preference match
  const timePrefs = typeof profile.preferredNotificationTime === 'string'
    ? profile.preferredNotificationTime.split(',').map(t => t.trim()).filter(Boolean)
    : Array.isArray(profile.preferredNotificationTime)
      ? profile.preferredNotificationTime.filter(Boolean)
      : [];

  const timeMatches = timePrefs.length === 0 || timePrefs[0] === null || timePrefs.includes(timePeriod);
  console.log(`  - Time Preference Match: ${timeMatches ? '✅' : '❌'} (user wants: ${timePrefs.join(', ') || 'anytime'})`);

  if (!timeMatches) {
    console.log(`\n❌ User's time preference (${timePrefs.join(', ')}) doesn't match current period (${timePeriod})`);
    return;
  }

  // 4. Check frequency eligibility
  const frequency = profile.notificationFrequency;
  const [lastNotification] = await db
    .select({ sentAt: notificationFollowups.sentAt })
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        eq(notificationFollowups.status, "sent")
      )
    )
    .orderBy(desc(notificationFollowups.sentAt))
    .limit(1);

  const lastSentAt = lastNotification?.sentAt ? new Date(lastNotification.sentAt) : null;
  const hoursSinceLastEmail = lastSentAt 
    ? (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60)
    : Infinity;

  console.log(`\n📅 Frequency Check:`);
  console.log(`  - Last email sent: ${lastSentAt ? lastSentAt.toISOString() : 'Never'}`);
  console.log(`  - Hours since last: ${hoursSinceLastEmail.toFixed(1)}`);

  let isDue = false;
  let requiredHours = 0;
  
  switch (frequency) {
    case "daily":
    case "weekday":
      requiredHours = 20;
      isDue = hoursSinceLastEmail >= requiredHours;
      break;
    case "every_2_days":
    case "twice_per_week":
      requiredHours = 48;
      isDue = hoursSinceLastEmail >= requiredHours;
      break;
    case "weekly":
      requiredHours = 144;
      isDue = hoursSinceLastEmail >= requiredHours;
      break;
    default:
      requiredHours = 20;
      isDue = hoursSinceLastEmail >= requiredHours;
  }

  console.log(`  - Required hours: ${requiredHours} (for frequency: ${frequency || 'daily'})`);
  console.log(`  - Is due: ${isDue ? '✅' : '❌'}`);

  if (!isDue) {
    console.log(`\n❌ Not enough time has passed since last email (need ${requiredHours} hours, got ${hoursSinceLastEmail.toFixed(1)})`);
    return;
  }

  // 5. Check for active follow-ups
  const ACTIVE_FOLLOWUP_STATUSES = ["pending", "sent"];
  const existing = await db
    .select({ id: notificationFollowups.id, status: notificationFollowups.status, expiresAt: notificationFollowups.expiresAt })
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        inArray(notificationFollowups.status, ACTIVE_FOLLOWUP_STATUSES as unknown as string[]),
        gt(notificationFollowups.expiresAt, now)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(`\n❌ User has an active follow-up that hasn't expired yet:`);
    console.log(`  - Status: ${existing[0].status}`);
    console.log(`  - Expires: ${existing[0].expiresAt}`);
    return;
  }

  // 6. Check for active goals
  const focus = await MyFocusService.getMyFocus(user.id);
  const goals = (focus?.priorityGoals || []).filter((goal: any) => goal.status !== "completed").slice(0, 3);

  console.log(`\n🎯 Goals Check:`);
  console.log(`  - Priority goals: ${goals.length}`);
  if (goals.length > 0) {
    goals.forEach((g: any, i: number) => {
      console.log(`    ${i + 1}. ${g.title} (${g.progress}% complete)`);
    });
  }

  if (!goals.length) {
    console.log('\n❌ User has no active priority goals');
    console.log('   Emails only send when user has at least 1 active priority goal');
    return;
  }

  // 7. Summary
  console.log(`\n✅ USER IS ELIGIBLE FOR EMAIL!`);
  console.log(`\nAll checks passed:`);
  console.log(`  ✅ Notifications enabled`);
  console.log(`  ✅ Weekday`);
  console.log(`  ✅ Within time window (${timePeriod})`);
  console.log(`  ✅ Time preference matches`);
  console.log(`  ✅ Frequency requirement met`);
  console.log(`  ✅ No active follow-ups`);
  console.log(`  ✅ Has active priority goals`);
  console.log(`\nIf email still not sent, check:`);
  console.log(`  - Railway logs for cron job execution`);
  console.log(`  - Email service configuration (MAILGUN_DOMAIN, NOTIFICATION_EMAIL_FROM)`);
  console.log(`  - Email service errors in logs`);
}

// Get email from command line
const userEmail = process.argv[2];
if (!userEmail) {
  console.error('Usage: tsx server/scripts/checkEmailEligibility.ts <userEmail>');
  process.exit(1);
}

checkEmailEligibility(userEmail).catch(console.error);

