import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { chatThreads } from "../../shared/schema";
import { ChatThreadService } from "../services/chatThreadService";
import { streamLifeCoachReply } from "../ai/lifeCoachService";

const router = Router();

// Create a new chat thread
router.post("/threads", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { title, isTest, privacyScope } = req.body || {};
    const thread = await ChatThreadService.createThread({
      userId,
      title: typeof title === "string" ? title : null,
      isTest: Boolean(isTest),
      privacyScope: privacyScope ?? null,
      summary: null,
    } as any);
    res.status(201).json({ threadId: thread.id, title: thread.title });
  } catch (e) {
    console.error("[chat] create thread failed", e);
    res.status(500).json({ message: "Failed to create thread" });
  }
});

// List recent chat threads
router.get("/threads", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const limit = Math.min(50, parseInt(String(req.query.limit || "5")) || 5);
    const rows = await ChatThreadService.listThreads(userId, limit);
    res.json(rows);
  } catch (e) {
    console.error("[chat] list threads failed", e);
    res.status(500).json({ message: "Failed to list threads" });
  }
});

// List recent messages in a thread
router.get("/threads/:id/messages", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const threadId = req.params.id;
    const [own] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!own || own.userId !== userId) return res.status(404).json({ message: "Thread not found" });
    const limit = Math.min(200, parseInt(String(req.query.limit || "50")) || 50);
    const messages = await ChatThreadService.getMessages(threadId, limit);
    res.json(messages);
  } catch (e) {
    console.error("[chat] list messages failed", e);
    res.status(500).json({ message: "Failed to list messages" });
  }
});

// SSE respond - streams model output
router.post("/respond", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { threadId, content } = req.body || {};
    if (!threadId || typeof content !== "string") {
      return res.status(400).json({ message: "threadId and content are required" });
    }

    const [own] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!own || own.userId !== userId) return res.status(404).json({ message: "Thread not found" });

    // Persist user message
    await ChatThreadService.appendMessage({ threadId, role: "user", content, status: "complete" } as any);

    // Prepare SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const send = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    send(JSON.stringify({ type: "start" }));
    let finalText = "";
    try {
      const result = await streamLifeCoachReply({
        userId,
        threadId,
        input: content,
        onToken: (delta: string) => {
          finalText += delta;
          send(JSON.stringify({ type: "delta", content: delta }));
        },
      });
      finalText = result.finalText || finalText;
    } catch (e) {
      console.error('[chat] life coach stream failed', e);
      send(JSON.stringify({ type: 'error', message: 'Assistant failed to respond' }));
    }
    send(JSON.stringify({ type: "end" }));

    if (finalText?.trim().length > 0) {
      await ChatThreadService.appendMessage({ threadId, role: "assistant", content: finalText.trim(), status: "complete" } as any);
    }
    res.end();
  } catch (e) {
    console.error("[chat] respond failed", e);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to respond' })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;


