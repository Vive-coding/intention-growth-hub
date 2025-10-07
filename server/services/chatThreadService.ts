import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import {
  chatMessages,
  chatThreads,
  InsertChatMessage,
  InsertChatThread,
} from "../../shared/schema";

export class ChatThreadService {
  static async createThread(params: Omit<InsertChatThread, "id" | "createdAt" | "updatedAt">) {
    const [row] = await db.insert(chatThreads).values(params).returning();
    return row;
  }

  static async listThreads(userId: string, limit = 10, cursor?: string) {
    const rows = await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.userId, userId))
      .orderBy(desc(chatThreads.updatedAt))
      .limit(limit);
    return rows;
  }

  static async appendMessage(params: Omit<InsertChatMessage, "id" | "createdAt">) {
    const [msg] = await db.insert(chatMessages).values(params).returning();
    // Touch thread updatedAt
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, params.threadId));
    return msg;
  }

  static async getMessages(threadId: string, limit = 50) {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    // Return chronological order
    return rows.reverse();
  }
}


