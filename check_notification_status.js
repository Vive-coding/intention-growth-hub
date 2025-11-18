/**
 * Diagnostic script to check why notifications aren't triggering for a user
 * Usage: node check_notification_status.js vivek.rok@gmail.com
 */

import { db } from './server/db.js';
import { userOnboardingProfiles, users, notificationFollowups } from './shared/schema.js';
import { eq, desc, and, gt, inArray } from 'drizzle-orm';
import { NotificationService } from './server/services/notificationService.js';
import { MyFocusService } from './server/services/myFocusService.js';

const email = process.argv[2] || 'vivek.rok@gmail.com';

async function checkNotificationStatus() {
  console.log(`\n🔍 Checking notification status for: ${email}\n`);

  // 1. Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('✅ User found:', {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
  });

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

  console.log('\n📋 Notification Settings:');
  console.log({
    notificationEnabled: profile.notificationEnabled,
    notificationFrequency: profile.notificationFrequency,
    preferredNotificationTime: profile.preferredNotificationTime,
  });

  if (!profile.notificationEnabled) {
    console.log('❌ Notifications are DISABLED for this user');
    return;
  }

  // 3. Check current time and eligibility
  const now = new Date();
  const currentHour = now.getHours();
  const dayOfWeek = now.getDay();
  
  console.log('\n⏰ Current Time Check:');
  console.log({
    currentHour: `${currentHour}:00`,
    dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  });

  let timePeriod = null;
  if (currentHour >= 8 && currentHour < 12) {
    timePeriod = 'morning';
  } else if (currentHour >= 14 && currentHour < 18) {
    timePeriod = 'afternoon';
  } else if (currentHour >= 18 && currentHour < 22) {
    timePeriod = 'evening';
  }

  console.log({
    timePeriod,
    matchesTimePreference: (() => {
      const timePrefs = typeof profile.preferredNotificationTime === 'string'
        ? profile.preferredNotificationTime.split(',').map(t => t.trim()).filter(Boolean)
        : Array.isArray(profile.preferredNotificationTime)
          ? profile.preferredNotificationTime.filter(Boolean)
          : [];
      
      if (timePrefs.length === 0 || timePrefs[0] === null) {
        return 'No preference (matches any time)';
      }
      return timePrefs.includes(timePeriod) ? '✅ Matches' : `❌ Doesn't match (prefers: ${timePrefs.join(', ')})`;
    })(),
  });

  // 4. Check frequency eligibility
  const [lastNotification] = await db
    .select({ sentAt: notificationFollowups.sentAt })
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        eq(notificationFollowups.status, 'sent')
      )
    )
    .orderBy(desc(notificationFollowups.sentAt))
    .limit(1);

  const lastSentAt = lastNotification?.sentAt ? new Date(lastNotification.sentAt) : null;
  const hoursSinceLastEmail = lastSentAt 
    ? (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60)
    : Infinity;

  console.log('\n📧 Last Email Check:');
  console.log({
    lastSentAt: lastSentAt ? lastSentAt.toISOString() : 'Never',
    hoursSinceLastEmail: hoursSinceLastEmail === Infinity ? 'Never sent' : hoursSinceLastEmail.toFixed(1),
    frequency: profile.notificationFrequency || 'daily (default)',
    isDue: (() => {
      const frequency = profile.notificationFrequency;
      if (!frequency) return true; // No frequency = daily
      
      switch (frequency) {
        case 'daily':
        case 'weekday':
          return hoursSinceLastEmail >= 20;
        case 'every_2_days':
        case 'twice_per_week':
          return hoursSinceLastEmail >= 48;
        case 'weekly':
          return hoursSinceLastEmail >= 144;
        default:
          return hoursSinceLastEmail >= 20;
      }
    })(),
  });

  // 5. Check if user would be returned by getUsersDueForNotification
  const eligibleUsers = await NotificationService.getUsersDueForNotification();
  const isEligible = eligibleUsers.some(u => u.userId === user.id);
  
  console.log('\n🎯 Eligibility Check:');
  console.log({
    wouldBeSelected: isEligible ? '✅ YES' : '❌ NO',
    totalEligibleUsers: eligibleUsers.length,
  });

  // 6. Check for active follow-ups
  const activeFollowups = await db
    .select()
    .from(notificationFollowups)
    .where(
      and(
        eq(notificationFollowups.userId, user.id),
        inArray(notificationFollowups.status, ['pending', 'sent']),
        gt(notificationFollowups.expiresAt, now)
      )
    );

  console.log('\n📬 Active Follow-ups:');
  console.log({
    count: activeFollowups.length,
    followups: activeFollowups.map(f => ({
      status: f.status,
      expiresAt: f.expiresAt.toISOString(),
      subject: f.subject,
    })),
  });

  if (activeFollowups.length > 0) {
    console.log('⚠️  User has active follow-ups - new emails won\'t be sent until these expire');
  }

  // 7. Check goals
  const focus = await MyFocusService.getMyFocus(user.id);
  const goals = (focus?.priorityGoals || []).filter(g => g.status !== 'completed').slice(0, 3);
  
  console.log('\n🎯 Goals Check:');
  console.log({
    hasActiveGoals: goals.length > 0,
    goalCount: goals.length,
    goals: goals.map(g => ({
      title: g.title,
      status: g.status,
      progress: g.progress,
    })),
  });

  if (goals.length === 0) {
    console.log('⚠️  User has no active goals - emails require at least one active goal');
  }

  // 8. Summary
  console.log('\n📊 Summary:');
  const issues = [];
  
  if (!profile.notificationEnabled) {
    issues.push('Notifications are disabled');
  }
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    issues.push('Today is a weekend (emails only sent on weekdays)');
  }
  
  if (!timePeriod) {
    issues.push(`Current hour (${currentHour}) is outside notification windows (8-12, 14-18, 18-22)`);
  }
  
  if (activeFollowups.length > 0) {
    issues.push(`Has ${activeFollowups.length} active follow-up(s) that haven't expired`);
  }
  
  if (goals.length === 0) {
    issues.push('No active goals');
  }
  
  if (issues.length === 0 && isEligible) {
    console.log('✅ User SHOULD receive notifications - check server logs for errors');
  } else {
    console.log('❌ Issues preventing notifications:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  console.log('\n');
}

checkNotificationStatus().catch(console.error);

