/**
 * Comprehensive diagnostic script to check why emails aren't being sent
 * Run with: tsx server/scripts/diagnoseEmailIssues.ts <userEmail>
 * Or without email to check all users with notification issues
 */

import 'dotenv/config';
import { db } from '../db';
import { users, userOnboardingProfiles, notificationFollowups } from '../../shared/schema';
import { eq, and, desc, inArray, gt, or } from 'drizzle-orm';
import { NotificationService } from '../services/notificationService';
import { MyFocusService } from '../services/myFocusService';

async function diagnoseEmailIssues(userEmail?: string) {
  console.log(`\n🔍 Email Diagnostic Report\n`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Check email service configuration
  console.log('📧 Email Service Configuration:');
  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const fromAddress = process.env.NOTIFICATION_EMAIL_FROM;
  
  console.log(`  - MAILGUN_API_KEY: ${mailgunApiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`  - MAILGUN_DOMAIN: ${mailgunDomain || '❌ Missing'}`);
  console.log(`  - NOTIFICATION_EMAIL_FROM: ${fromAddress || '❌ Missing'}`);
  
  if (!mailgunApiKey || !mailgunDomain || !fromAddress) {
    console.log('\n⚠️  Email service is not properly configured!');
  }

  // Get users to check
  let usersToCheck: Array<{ id: string; email: string; firstName: string | null }> = [];
  
  if (userEmail) {
    const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
    if (!user) {
      console.log(`\n❌ User with email ${userEmail} not found`);
      return;
    }
    usersToCheck = [user];
  } else {
    // Get all users with notifications enabled
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .innerJoin(userOnboardingProfiles, eq(users.id, userOnboardingProfiles.userId))
      .where(eq(userOnboardingProfiles.notificationEnabled, true));
    
    usersToCheck = allUsers;
    console.log(`\nFound ${allUsers.length} users with notifications enabled\n`);
  }

  for (const user of usersToCheck) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`User: ${user.email} (${user.firstName || 'No name'})`);
    console.log(`${'='.repeat(60)}\n`);

    // 1. Check onboarding profile
    const [profile] = await db
      .select()
      .from(userOnboardingProfiles)
      .where(eq(userOnboardingProfiles.userId, user.id))
      .limit(1);

    if (!profile) {
      console.log('❌ No onboarding profile found');
      continue;
    }

    console.log('📋 Notification Settings:');
    console.log(`  - Enabled: ${profile.notificationEnabled ? '✅' : '❌'}`);
    console.log(`  - Frequency: ${profile.notificationFrequency || 'daily (default)'}`);
    console.log(`  - Preferred Time: ${profile.preferredNotificationTime || 'anytime'}`);

    if (!profile.notificationEnabled) {
      console.log('\n❌ Notifications are DISABLED for this user');
      continue;
    }

    // 2. Check all notification followups (including failed ones)
    const allFollowups = await db
      .select()
      .from(notificationFollowups)
      .where(eq(notificationFollowups.userId, user.id))
      .orderBy(desc(notificationFollowups.createdAt))
      .limit(10);

    console.log(`\n📬 Recent Notification Followups (last 10):`);
    if (allFollowups.length === 0) {
      console.log('  No followups found');
    } else {
      const statusCounts = { pending: 0, sent: 0, failed: 0 };
      allFollowups.forEach((f) => {
        const status = f.status || 'unknown';
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }
        console.log(`  - ${f.status || 'unknown'}: ${f.subject || 'No subject'}`);
        console.log(`    Created: ${f.createdAt?.toISOString() || 'N/A'}`);
        console.log(`    Sent: ${f.sentAt?.toISOString() || 'Not sent'}`);
        console.log(`    Expires: ${f.expiresAt?.toISOString() || 'N/A'}`);
        if (f.status === 'failed') {
          console.log(`    ⚠️  FAILED - Check server logs for error details`);
        }
      });
      console.log(`\n  Summary: ${statusCounts.sent} sent, ${statusCounts.pending} pending, ${statusCounts.failed} failed`);
    }

    // 3. Check for failed notifications
    const failedFollowups = allFollowups.filter(f => f.status === 'failed');
    if (failedFollowups.length > 0) {
      console.log(`\n❌ Found ${failedFollowups.length} FAILED notification(s)!`);
      console.log('   These indicate email sending errors. Check server logs for details.');
    }

    // 4. Check active followups
    const now = new Date();
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

    console.log(`\n📬 Active Follow-ups: ${activeFollowups.length}`);
    if (activeFollowups.length > 0) {
      console.log('   New emails won\'t be sent until these expire:');
      activeFollowups.forEach(f => {
        console.log(`     - ${f.subject || 'No subject'} (expires: ${f.expiresAt?.toISOString()})`);
      });
    }

    // 5. Check eligibility
    const eligibleUsers = await NotificationService.getUsersDueForNotification();
    const isEligible = eligibleUsers.some(u => u.userId === user.id);

    console.log(`\n🎯 Current Eligibility: ${isEligible ? '✅ YES' : '❌ NO'}`);
    if (!isEligible) {
      console.log('   Reasons why user might not be eligible:');
      
      // Check time
      const currentHourUTC = now.getUTCHours();
      const dayOfWeekUTC = now.getUTCDay();
      if (dayOfWeekUTC === 0 || dayOfWeekUTC === 6) {
        console.log('     - It\'s a weekend (emails only sent on weekdays)');
      }
      
      const timePeriod = currentHourUTC >= 8 && currentHourUTC < 12 ? 'morning' :
                        currentHourUTC >= 14 && currentHourUTC < 18 ? 'afternoon' :
                        currentHourUTC >= 18 && currentHourUTC < 22 ? 'evening' : null;
      if (!timePeriod) {
        console.log(`     - Current time (${currentHourUTC}:00 UTC) is outside email windows`);
      }

      // Check frequency
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

      if (lastNotification?.sentAt) {
        const hoursSince = (now.getTime() - new Date(lastNotification.sentAt).getTime()) / (1000 * 60 * 60);
        console.log(`     - Last email sent ${hoursSince.toFixed(1)} hours ago (may not meet frequency requirement)`);
      }
    }

    // 6. Check goals
    const focus = await MyFocusService.getMyFocus(user.id);
    const goals = (focus?.priorityGoals || []).filter((g: any) => g.status !== 'completed').slice(0, 3);

    console.log(`\n🎯 Active Goals: ${goals.length}`);
    if (goals.length === 0) {
      console.log('   ❌ No active goals - emails require at least one active goal');
    } else {
      goals.forEach((g: any, i: number) => {
        console.log(`     ${i + 1}. ${g.title} (${g.progress}% complete)`);
      });
    }

    // 7. Summary
    console.log(`\n📊 Summary:`);
    const issues: string[] = [];
    const currentHourUTC = now.getUTCHours();
    const dayOfWeekUTC = now.getUTCDay();
    const timePeriod = currentHourUTC >= 8 && currentHourUTC < 12 ? 'morning' :
                      currentHourUTC >= 14 && currentHourUTC < 18 ? 'afternoon' :
                      currentHourUTC >= 18 && currentHourUTC < 22 ? 'evening' : null;
    
    if (!profile.notificationEnabled) {
      issues.push('Notifications disabled');
    }
    if (dayOfWeekUTC === 0 || dayOfWeekUTC === 6) {
      issues.push('Weekend (emails only on weekdays)');
    }
    if (!timePeriod) {
      issues.push('Outside time windows');
    }
    if (activeFollowups.length > 0) {
      issues.push(`${activeFollowups.length} active follow-up(s) blocking new emails`);
    }
    if (goals.length === 0) {
      issues.push('No active goals');
    }
    if (failedFollowups.length > 0) {
      issues.push(`${failedFollowups.length} failed email attempt(s) - check server logs`);
    }

    if (issues.length === 0 && isEligible) {
      console.log('✅ User SHOULD receive emails - check server logs for cron job execution');
    } else {
      console.log('❌ Issues preventing emails:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('💡 Next Steps:');
  console.log('   1. Check Railway/Vercel logs for cron job execution');
  console.log('   2. Check logs for "[GoalFollowUpService]" and "[EmailService]" errors');
  console.log('   3. Verify email service configuration (MAILGUN_API_KEY, MAILGUN_DOMAIN)');
  console.log('   4. Check if cron job is running: "15 9,15,19 * * 1-5" (9:15, 15:15, 19:15 UTC weekdays)');
  console.log(`${'='.repeat(60)}\n`);
}

// Get email from command line
const userEmail = process.argv[2];
diagnoseEmailIssues(userEmail).catch(console.error);

