import { db } from "../db";
import { desc, eq } from "drizzle-orm";
import {
  users,
  insights,
  goalInstances,
  goalDefinitions,
  habitDefinitions,
  habitInstances,
  userOnboardingProfiles,
  chatMessages,
} from "../../shared/schema";

export interface ProfileCapsule {
  firstName?: string | null;
  timezone?: string | null;
  onboarding?: {
    onboardingStep?: string | null;
    firstGoalCreated?: boolean | null;
    firstChatSession?: boolean | null;
    goalSettingAbility?: string | null;
    habitBuildingAbility?: string | null;
    coachingStyle?: string[] | null;
    focusLifeMetrics?: string[] | null;
    coachPersonality?: string | null;
    notificationEnabled?: boolean | null;
    notificationFrequency?: string | null;
    preferredNotificationTime?: string | null;
  } | null;
}

export interface WorkingSetSnapshot {
  activeGoals: Array<{ title: string; targetDate: string | null; status: string }>;
  activeHabits: Array<{ name: string; streak: number; frequency?: string }>;
  recentInsights: Array<{ title: string; summary: string }>;
}

export class ChatContextService {
  static async getProfileCapsule(userId: string): Promise<ProfileCapsule> {
    const [row] = await db
      .select({
        firstName: users.firstName,
        timezone: users.timezone,
        onboardingStep: users.onboardingStep,
        firstGoalCreated: users.firstGoalCreated,
        firstChatSession: users.firstChatSession,
        goalSettingAbility: userOnboardingProfiles.goalSettingAbility,
        habitBuildingAbility: userOnboardingProfiles.habitBuildingAbility,
        coachingStyle: userOnboardingProfiles.coachingStyle,
        focusLifeMetrics: userOnboardingProfiles.focusLifeMetrics,
        coachPersonality: userOnboardingProfiles.coachPersonality,
        notificationEnabled: userOnboardingProfiles.notificationEnabled,
        notificationFrequency: userOnboardingProfiles.notificationFrequency,
        preferredNotificationTime: userOnboardingProfiles.preferredNotificationTime,
      })
      .from(users)
      .leftJoin(userOnboardingProfiles, eq(userOnboardingProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      return { firstName: null, timezone: null, onboarding: null };
    }

    const onboarding =
      row.goalSettingAbility ||
      row.habitBuildingAbility ||
      (row.coachingStyle && row.coachingStyle.length > 0) ||
      (row.focusLifeMetrics && row.focusLifeMetrics.length > 0) ||
      row.notificationEnabled !== null
        ? {
            onboardingStep: row.onboardingStep ?? null,
            firstGoalCreated: row.firstGoalCreated ?? false,
            firstChatSession: row.firstChatSession ?? false,
            goalSettingAbility: row.goalSettingAbility ?? null,
            habitBuildingAbility: row.habitBuildingAbility ?? null,
            coachingStyle: row.coachingStyle ?? null,
            focusLifeMetrics: row.focusLifeMetrics ?? null,
            coachPersonality: row.coachPersonality ?? null,
            notificationEnabled: row.notificationEnabled ?? null,
            notificationFrequency: row.notificationFrequency ?? null,
            preferredNotificationTime: row.preferredNotificationTime ?? null,
          }
        : null;

    return {
      firstName: row.firstName ?? null,
      timezone: row.timezone ?? null,
      onboarding,
    };
  }

  static async getWorkingSet(userId: string): Promise<WorkingSetSnapshot> {
    const goals = await db
      .select({ title: goalDefinitions.title, targetDate: goalInstances.targetDate, status: goalInstances.status })
      .from(goalInstances)
      .leftJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalInstances.userId, userId));

    const habits = await db
      .select({ name: habitDefinitions.name })
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId));

    const recent = await db
      .select({ title: insights.title, explanation: insights.explanation, createdAt: insights.createdAt })
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt))
      .limit(5);

    return {
      activeGoals: goals.map((g) => ({ title: g.title ?? "Untitled goal", targetDate: g.targetDate ? new Date(g.targetDate).toISOString() : null, status: g.status ?? "active" })),
      activeHabits: habits.map((h) => ({ name: h.name, streak: 0 })),
      recentInsights: recent.map((i) => ({ title: i.title, summary: (i.explanation || '').slice(0, 140) })),
    };
  }

  static async getRecentMessages(threadId: string, limit = 2) {
    const rows = await db
      .select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  static async getOnboardingProfile(userId: string) {
    const [row] = await db
      .select({
        goalSettingAbility: userOnboardingProfiles.goalSettingAbility,
        habitBuildingAbility: userOnboardingProfiles.habitBuildingAbility,
        coachingStyle: userOnboardingProfiles.coachingStyle,
        focusLifeMetrics: userOnboardingProfiles.focusLifeMetrics,
        coachPersonality: userOnboardingProfiles.coachPersonality,
        notificationEnabled: userOnboardingProfiles.notificationEnabled,
        notificationFrequency: userOnboardingProfiles.notificationFrequency,
        preferredNotificationTime: userOnboardingProfiles.preferredNotificationTime,
        completedAt: userOnboardingProfiles.completedAt,
        onboardingStep: users.onboardingStep,
        firstGoalCreated: users.firstGoalCreated,
        firstChatSession: users.firstChatSession,
      })
      .from(users)
      .leftJoin(userOnboardingProfiles, eq(userOnboardingProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      return null;
    }

    return row;
  }
}


