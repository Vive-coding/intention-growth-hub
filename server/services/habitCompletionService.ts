import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { habitDefinitions, habitCompletions, habitInstances, goalInstances, goalDefinitions, lifeMetricDefinitions, users } from "../../shared/schema";
import { storage } from "../storage";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface LogHabitCompletionOptions {
  userId: string;
  habitId: string;
  goalId?: string;
  notes?: string | null;
  completedAt?: Date;
}

interface DayWindow {
  start: Date;
  end: Date;
  offsetMs: number;
}

function normalizeDate(date: Date, offsetMs: number) {
  const shifted = new Date(date.getTime() + offsetMs);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted;
}

async function getUserDayWindow(userId: string, reference: Date): Promise<DayWindow> {
  const [userRow] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  const timezone = userRow?.timezone || process.env.DEFAULT_TZ || "UTC";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(reference);
  const year = parseInt(parts.find(p => p.type === "year")?.value || "0", 10);
  const month = parseInt(parts.find(p => p.type === "month")?.value || "1", 10) - 1;
  const day = parseInt(parts.find(p => p.type === "day")?.value || "1", 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`Invalid localized date for timezone ${timezone}`);
  }

  const startLocal = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endLocal = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  const noonLocal = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  const noonInUserTz = new Date(noonLocal.toLocaleString("en-US", { timeZone: timezone }));
  const noonInUTC = new Date(noonLocal.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = noonInUserTz.getTime() - noonInUTC.getTime();

  const startUTC = new Date(startLocal.getTime() - offsetMs);
  const endUTC = new Date(endLocal.getTime() - offsetMs);

  return { start: startUTC, end: endUTC, offsetMs };
}

function determineFrequencyWindow(
  completedAt: Date,
  offsetMs: number,
  frequencySettings?: { frequency: string; perPeriodTarget: number }
) {
  if (!frequencySettings) {
    return {
      periodStart: normalizeDate(completedAt, offsetMs),
      periodEnd: new Date(normalizeDate(completedAt, offsetMs).getTime() + MS_PER_DAY - 1),
      perPeriodTarget: 1,
      frequency: "daily",
    };
  }

  const { frequency, perPeriodTarget } = frequencySettings;
  const localDate = normalizeDate(completedAt, offsetMs);
  let periodStartLocal = new Date(localDate);
  let periodEndLocal = new Date(localDate.getTime() + MS_PER_DAY - 1);

  switch (frequency) {
    case "weekly": {
      const dayOfWeek = localDate.getUTCDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStartLocal = new Date(localDate.getTime() - daysFromMonday * MS_PER_DAY);
      periodEndLocal = new Date(periodStartLocal.getTime() + 7 * MS_PER_DAY - 1);
      break;
    }
    case "monthly": {
      periodStartLocal = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), 1));
      periodEndLocal = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, 1) - 1);
      break;
    }
    default: {
      periodStartLocal = localDate;
      periodEndLocal = new Date(localDate.getTime() + MS_PER_DAY - 1);
      break;
    }
  }

  const periodStart = new Date(periodStartLocal.getTime() - offsetMs);
  const periodEnd = new Date(periodEndLocal.getTime() - offsetMs);

  return { periodStart, periodEnd, perPeriodTarget, frequency }
}

async function computeStreaks(userId: string, habitId: string, offsetMs: number) {
  const completions = await db
    .select({ completedAt: habitCompletions.completedAt })
    .from(habitCompletions)
    .where(and(eq(habitCompletions.habitDefinitionId, habitId), eq(habitCompletions.userId, userId)))
    .orderBy(desc(habitCompletions.completedAt));

  const uniqueDayTimestamps: number[] = [];
  const seen = new Set<number>();
  for (const row of completions) {
    const ts = normalizeDate(row.completedAt, offsetMs).getTime();
    if (seen.has(ts)) continue;
    seen.add(ts);
    uniqueDayTimestamps.push(ts);
  }

  let currentStreak = 0;
  if (uniqueDayTimestamps.length > 0) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDayTimestamps.length; i++) {
      const diff = Math.round((uniqueDayTimestamps[i - 1] - uniqueDayTimestamps[i]) / MS_PER_DAY);
      if (diff === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  let longestStreak = uniqueDayTimestamps.length > 0 ? 1 : 0;
  if (uniqueDayTimestamps.length > 0) {
    let run = 1;
    for (let i = 1; i < uniqueDayTimestamps.length; i++) {
      const diff = Math.round((uniqueDayTimestamps[i - 1] - uniqueDayTimestamps[i]) / MS_PER_DAY);
      if (diff === 1) {
        run += 1;
      } else if (diff > 1) {
        run = 1;
      }
      if (run > longestStreak) {
        longestStreak = run;
      }
    }
  }

  return { currentStreak, longestStreak };
}

export async function logHabitCompletion(options: LogHabitCompletionOptions) {
  const { userId, habitId, goalId, notes, completedAt } = options;
  const completionDate = completedAt ? new Date(completedAt) : new Date();

  const habitRows = await db
    .select()
    .from(habitDefinitions)
    .where(and(eq(habitDefinitions.id, habitId), eq(habitDefinitions.userId, userId)))
    .limit(1);

  const habit = habitRows[0];
  if (!habit) {
    throw Object.assign(new Error("Habit not found"), { status: 404 });
  }

  const { start: dayStart, end: dayEnd, offsetMs } = await getUserDayWindow(userId, completionDate);

  const primaryInstance = await db
    .select({ id: habitInstances.id, frequencySettings: habitInstances.frequencySettings })
    .from(habitInstances)
    .where(eq(habitInstances.habitDefinitionId, habitId))
    .limit(1);

  const frequencySettings = primaryInstance[0]?.frequencySettings as { frequency: string; perPeriodTarget: number } | undefined;
  const { periodStart, periodEnd, perPeriodTarget, frequency } = determineFrequencyWindow(completionDate, offsetMs, frequencySettings);

  const completionsInPeriod = await db
    .select()
    .from(habitCompletions)
    .where(and(
      eq(habitCompletions.habitDefinitionId, habitId),
      eq(habitCompletions.userId, userId),
      gte(habitCompletions.completedAt, periodStart),
      lte(habitCompletions.completedAt, periodEnd)
    ));

  if (frequency !== "daily" && frequencySettings && completionsInPeriod.length >= perPeriodTarget) {
    const error: any = new Error(`Habit already completed ${completionsInPeriod.length}/${perPeriodTarget} times for this ${frequency} period`);
    error.status = 409;
    throw error;
  }

  if (!frequencySettings && completionsInPeriod.some((comp) => comp.completedAt >= dayStart && comp.completedAt <= dayEnd)) {
    const error: any = new Error("Habit already completed today");
    error.status = 409;
    throw error;
  }

  const [completion] = await db
    .insert(habitCompletions)
    .values({
      habitDefinitionId: habitId,
      userId,
      notes: notes || null,
      completedAt: completionDate,
    })
    .returning();

  const { currentStreak, longestStreak } = await computeStreaks(userId, habitId, offsetMs);

  const habitInstanceRows = goalId
    ? await db
        .select()
        .from(habitInstances)
        .where(and(eq(habitInstances.habitDefinitionId, habitId), eq(habitInstances.goalInstanceId, goalId)))
    : await db
        .select()
        .from(habitInstances)
        .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
        .where(and(eq(habitInstances.habitDefinitionId, habitId), eq(goalInstances.userId, userId), eq(goalInstances.status, 'active')));

  for (const hiRow of habitInstanceRows as any[]) {
    const hi = hiRow.habit_instances || hiRow;
    const newCurrentValue = (hi.currentValue || 0) + 1;
    await db
      .update(habitInstances)
      .set({ currentValue: newCurrentValue, goalSpecificStreak: currentStreak })
      .where(eq(habitInstances.id, hi.id));

    try {
      const goalJoin = await db
        .select({ def: goalDefinitions, inst: goalInstances, metric: lifeMetricDefinitions })
        .from(goalInstances)
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .innerJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
        .where(and(eq(goalInstances.id, hi.goalInstanceId), eq(goalInstances.userId, userId)))
        .limit(1);

      if (goalJoin[0]) {
        const lifeMetricName = goalJoin[0].metric.name;
        await storage.upsertTodayProgressSnapshot(userId, lifeMetricName);
      }
    } catch (error) {
      console.error('[habitCompletionService] Snapshot update failed', error);
    }
  }

  await db
    .update(habitDefinitions)
    .set({ globalCompletions: sql`COALESCE(${habitDefinitions.globalCompletions}, 0) + 1`, globalStreak: longestStreak })
    .where(eq(habitDefinitions.id, habitId));

  // Track habit completion with analytics
  try {
    const { backendAnalytics } = await import("./analyticsService");
    
    // Check if this is user's first habit log
    const allCompletions = await db
      .select()
      .from(habitCompletions)
      .where(eq(habitCompletions.userId, userId))
      .then(rows => rows.length);
    
    const isFirstHabitLog = allCompletions === 1;
    
    // Calculate days since habit creation
    const habitCreatedAt = habit.createdAt || new Date();
    const daysSinceCreation = Math.floor((completionDate.getTime() - habitCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    backendAnalytics.setUser(userId);
    backendAnalytics.trackEvent('habit_completed', {
      habit_id: habitId,
      user_id: userId,
      streak_length: currentStreak,
      longest_streak: longestStreak,
      days_since_creation: daysSinceCreation,
      is_first_log: isFirstHabitLog,
      has_goal: !!goalId,
      frequency: frequency || 'daily',
    });

    if (isFirstHabitLog) {
      backendAnalytics.trackEvent('first_habit_logged', {
        habit_id: habitId,
        user_id: userId,
        frequency: frequency || 'daily',
      });
      
      // Update user properties
      const { updateUserProperties } = await import("./analyticsHelpers");
      await updateUserProperties(userId).catch(err => {
        console.error('[habitCompletionService] Failed to update user properties', err);
      });
    }

    // Track streak milestones
    const milestoneDays = [7, 14, 30, 60, 90];
    if (milestoneDays.includes(currentStreak)) {
      backendAnalytics.trackEvent('habit_streak_milestone', {
        habit_id: habitId,
        user_id: userId,
        streak_days: currentStreak,
      });
    }
  } catch (analyticsError) {
    console.error('[habitCompletionService] Failed to track habit completion analytics', analyticsError);
  }

  // Return completion with streak info for card display
  return {
    ...completion,
    currentStreak,
    longestStreak,
  };
}
