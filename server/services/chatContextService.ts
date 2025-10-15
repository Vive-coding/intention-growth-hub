import { db } from "../db";
import { desc, eq } from "drizzle-orm";
import {
  users,
  insights,
  goalInstances,
  goalDefinitions,
  habitDefinitions,
  habitInstances,
  ProgressSnapshot,
  chatMessages,
} from "../../shared/schema";

export interface ProfileCapsule {
  firstName?: string | null;
  timezone?: string | null;
}

export interface WorkingSetSnapshot {
  activeGoals: Array<{ title: string; targetDate: string | null; status: string }>;
  activeHabits: Array<{ name: string; streak: number; frequency?: string }>;
  recentInsights: Array<{ title: string; summary: string }>;
}

export class ChatContextService {
  static async getProfileCapsule(userId: string): Promise<ProfileCapsule> {
    const row = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = row[0];
    return { firstName: u?.firstName ?? null, timezone: u?.timezone ?? null };
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
}


