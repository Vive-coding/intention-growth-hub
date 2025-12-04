/**
 * Analytics Helper Functions
 * 
 * Helper functions for calculating derived metrics and updating user properties
 * for Amplitude analytics tracking.
 */

import { db } from "../db";
import { users, goalInstances, habitCompletions, chatThreads, chatMessages, habitDefinitions } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { backendAnalytics } from "./analyticsService";

/**
 * Calculate turns to first goal
 * Returns the number of chat messages before the first goal was created
 */
export async function calculateTurnsToFirstGoal(userId: string, firstGoalCreatedAt: Date): Promise<number> {
  try {
    // Count user messages before first goal creation
    const messagesBeforeGoal = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
      .where(and(
        eq(chatThreads.userId, userId),
        eq(chatMessages.role, 'user'),
        sql`${chatMessages.createdAt} < ${firstGoalCreatedAt}`
      ));

    return messagesBeforeGoal[0]?.count || 0;
  } catch (error) {
    console.error('[analyticsHelpers] Failed to calculate turns to first goal', error);
    return 0;
  }
}

/**
 * Calculate turns to first habit logged
 * Returns the number of chat messages before the first habit was logged
 */
export async function calculateTurnsToFirstHabit(userId: string, firstHabitLoggedAt: Date): Promise<number> {
  try {
    // Count user messages before first habit log
    const messagesBeforeHabit = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
      .where(and(
        eq(chatThreads.userId, userId),
        eq(chatMessages.role, 'user'),
        sql`${chatMessages.createdAt} < ${firstHabitLoggedAt}`
      ));

    return messagesBeforeHabit[0]?.count || 0;
  } catch (error) {
    console.error('[analyticsHelpers] Failed to calculate turns to first habit', error);
    return 0;
  }
}

/**
 * Calculate turns to first goal completion
 * Returns the number of chat messages before the first goal was completed
 */
export async function calculateTurnsToFirstGoalCompletion(userId: string, firstGoalCompletedAt: Date): Promise<number> {
  try {
    // Count user messages before first goal completion
    const messagesBeforeCompletion = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
      .where(and(
        eq(chatThreads.userId, userId),
        eq(chatMessages.role, 'user'),
        sql`${chatMessages.createdAt} < ${firstGoalCompletedAt}`
      ));

    return messagesBeforeCompletion[0]?.count || 0;
  } catch (error) {
    console.error('[analyticsHelpers] Failed to calculate turns to first goal completion', error);
    return 0;
  }
}

/**
 * Update user properties in Amplitude
 * Called when milestone events occur (first goal, first habit, etc.)
 */
export async function updateUserProperties(userId: string): Promise<void> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return;

    // Get engagement metrics
    const totalGoals = await db
      .select({ count: sql<number>`count(*)` })
      .from(goalInstances)
      .where(eq(goalInstances.userId, userId))
      .then(rows => rows[0]?.count || 0);

    const activeGoals = await db
      .select({ count: sql<number>`count(*)` })
      .from(goalInstances)
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalInstances.status, 'active')
      ))
      .then(rows => rows[0]?.count || 0);

    const completedGoals = await db
      .select({ count: sql<number>`count(*)` })
      .from(goalInstances)
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalInstances.status, 'completed')
      ))
      .then(rows => rows[0]?.count || 0);

    const totalHabits = await db
      .select({ count: sql<number>`count(*)` })
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId))
      .then(rows => rows[0]?.count || 0);

    const totalChatThreads = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatThreads)
      .where(eq(chatThreads.userId, userId))
      .then(rows => rows[0]?.count || 0);

    const totalChatMessages = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
      .where(eq(chatThreads.userId, userId))
      .then(rows => rows[0]?.count || 0);

    // Get longest habit streak
    const longestStreak = await db
      .select({ max: sql<number>`max(${habitDefinitions.globalStreak})` })
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId))
      .then(rows => rows[0]?.max || 0);

    // Get current habit streak (max of all active habits)
    const currentStreak = await db
      .select({ max: sql<number>`max(${habitDefinitions.globalStreak})` })
      .from(habitDefinitions)
      .where(and(
        eq(habitDefinitions.userId, userId),
        eq(habitDefinitions.isActive, true)
      ))
      .then(rows => rows[0]?.max || 0);

    // Calculate days since signup
    const createdAt = user.createdAt || new Date();
    const daysSinceSignup = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Get last active date (most recent chat message or goal/habit activity)
    const lastMessage = await db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
      .where(eq(chatThreads.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)
      .then(rows => rows[0]?.createdAt);

    const lastHabitCompletion = await db
      .select({ completedAt: habitCompletions.completedAt })
      .from(habitCompletions)
      .where(eq(habitCompletions.userId, userId))
      .orderBy(desc(habitCompletions.completedAt))
      .limit(1)
      .then(rows => rows[0]?.completedAt);

    const lastActiveDate = lastMessage && lastHabitCompletion
      ? (lastMessage > lastHabitCompletion ? lastMessage : lastHabitCompletion)
      : (lastMessage || lastHabitCompletion);

    const daysSinceLastActive = lastActiveDate
      ? Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))
      : daysSinceSignup;

    // Get cohort month (signup month)
    const cohortMonth = createdAt.toISOString().substring(0, 7); // YYYY-MM format

    // Calculate turns to milestones if applicable
    let turnsToFirstGoal = 0;
    let turnsToFirstHabit = 0;
    let turnsToFirstGoalCompletion = 0;

    if (user.firstGoalCreated) {
      // We'd need to store firstGoalCreatedAt timestamp - for now, estimate
      // In production, you'd want to store these timestamps in the user record
    }

    // Update Amplitude user properties
    backendAnalytics.setUser(userId, {
      totalGoals,
      totalHabits,
      totalChatThreads,
      totalChatMessages,
      longestHabitStreak: longestStreak,
      currentHabitStreak: currentStreak,
      goalsCompletedCount: completedGoals,
      activeGoalsCount: activeGoals,
      lastActiveDate: lastActiveDate?.toISOString(),
      daysSinceSignup,
      daysSinceLastActive,
      cohortMonth,
      onboardingCompleted: user.onboardingCompleted || false,
      onboardingStep: user.onboardingStep || 'welcome',
      turnsToFirstGoal,
      turnsToFirstHabit,
      turnsToFirstGoalCompletion,
    });
  } catch (error) {
    console.error('[analyticsHelpers] Failed to update user properties', error);
  }
}

