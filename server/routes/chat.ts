import { Router } from "express";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { chatThreads, chatMessages } from "../../shared/schema";
import { ChatThreadService } from "../services/chatThreadService";
import { streamLifeCoachReply } from "../ai/lifeCoachService";
import { MyFocusService } from "../services/myFocusService";

const router = Router();

// DEV: Create a test chat thread pre-populated with mock cards
router.post("/threads/test-cards", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Create a new thread that will show up in sidebar
    const thread = await ChatThreadService.createThread({
      userId,
      title: "Cards Test",
      isTest: true,
      privacyScope: null,
      summary: "Thread with mock cards for UI verification",
    } as any);

    const threadId = thread.id;

    // Seed messages that include persisted JSON payloads for the renderer
    const messages = [
      {
        role: "assistant",
        content:
          "Here is a suggested priority goal based on your energy pattern.\n\n---json---\n" +
          JSON.stringify({
            type: "goal_suggestion",
            goal: {
              title: "Increase daily energy levels",
              description:
                "Energy impacts your ability to pursue all other goals effectively. Research shows that consistent energy levels improve decision-making, productivity, and overall well-being.",
              category: "Health & Wellness",
              priority: "Priority 1",
            },
            habits: [
              {
                title: "Morning workout (20 min)",
                description:
                  "Morning exercise boosts endorphins and metabolism, providing sustained energy throughout the day. Even 20 minutes makes a measurable difference.",
                frequency: "daily",
                effortMinutes: 20,
                impact: "high",
              },
              {
                title: "Sleep 7-8 hours",
                description:
                  "Adequate sleep is the foundation of sustained energy. Most adults need 7-8 hours for optimal recovery and cognitive function.",
                frequency: "daily",
                impact: "high",
              },
              {
                title: "Drink 8 glasses of water daily",
                description:
                  "Even mild dehydration can cause fatigue. Proper hydration supports cellular energy production and mental clarity.",
                frequency: "daily",
                effortMinutes: 5,
                impact: "medium",
              },
            ],
          }),
      },
      {
        role: "assistant",
        content:
          "Here is your habit checklist for today.\n\n---json---\n" +
          JSON.stringify({
            type: "habit_review",
            habits: [
              { id: "h1", title: "Morning workout (20 min)", completed: true, streak: 12, points: 1 },
              { id: "h2", title: "Sleep 7-8 hours", completed: false, streak: 8, points: 1 },
              { id: "h3", title: "Read leadership content (15 min/day)", completed: true, streak: 5, points: 1 },
              { id: "h4", title: "One-on-one check-in with team member", completed: false, streak: 3, points: 1 },
            ],
          }),
      },
      {
        role: "assistant",
        content:
          "Some quick optimizations to maximize progress.\n\n---json---\n" +
          JSON.stringify({
            type: "optimization",
            summary:
              "Based on your current goals and habits, here are strategic optimizations to maximize your impact:",
            recommendations: [
              { type: "archive", title: "Archive low-impact habits", description: "Drop 1-2 low ROI habits to focus on essentials." },
              { type: "modify", title: "Consolidate similar goals", description: "Merge overlapping goals into one focus." },
              { type: "add", title: "Add energy check-in", description: "Daily 30-sec energy check to tune your day." },
            ],
          }),
      },
      {
        role: "assistant",
        content:
          "A pattern I notice in your reflections.\n\n---json---\n" +
          JSON.stringify({
            type: "insight",
            title: "You optimize for learning over comfort",
            explanation:
              "Your questions and goals consistently show a pattern of choosing growth over comfort. You're drawn to challenges that teach you something new.",
            confidence: 90,
          }),
      },
    ];

    for (const m of messages) {
      await ChatThreadService.appendMessage({
        threadId,
        role: m.role as any,
        content: m.content,
        status: "complete",
      } as any);
    }

    res.status(201).json({ threadId });
  } catch (e) {
    console.error("[chat] create test-cards thread failed", e);
    res.status(500).json({ message: "Failed to create test cards thread" });
  }
});

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

// Delete a thread
router.delete("/threads/:id", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const threadId = req.params.id;
    
    await ChatThreadService.deleteThread(threadId, userId);
    res.json({ success: true });
  } catch (e) {
    console.error("[chat] delete thread failed", e);
    res.status(500).json({ message: "Failed to delete thread" });
  }
});

// SSE respond - streams model output
router.post("/respond", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { threadId, content, requestedAgentType } = req.body || {};
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
        requestedAgentType,
      });
      finalText = result.finalText || finalText;
      if (result.cta) {
        send(JSON.stringify({ type: "cta", label: result.cta }));
      }
      if (result.structuredData) {
        send(JSON.stringify({ type: "structured_data", data: result.structuredData }));
        // Persist agent outputs into My Focus (best-effort)
        try {
          await MyFocusService.persistFromAgent(result.structuredData, { userId, threadId });
        } catch (e) {
          console.error('[chat] persist-from-agent failed', e);
        }
      }
    } catch (e) {
      console.error('[chat] life coach stream failed', e);
      send(JSON.stringify({ type: 'error', message: 'Assistant failed to respond' }));
    }
    send(JSON.stringify({ type: "end" }));

    if (finalText?.trim().length > 0) {
      await ChatThreadService.appendMessage({ threadId, role: "assistant", content: finalText.trim(), status: "complete" } as any);
      
      // Generate smart title if this is still the default title
      try {
        const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
        if (thread && thread.title === 'Daily Coaching') {
          // Get recent messages to understand conversation theme
          const recentMessages = await db
            .select({ content: chatMessages.content, role: chatMessages.role })
            .from(chatMessages)
            .where(eq(chatMessages.threadId, threadId))
            .orderBy(desc(chatMessages.createdAt))
            .limit(6);
          
          // Skip title generation if messages are just generic greetings
          const userMessages = recentMessages.filter(m => m.role === 'user').map(m => m.content.toLowerCase().trim());
          const hasSubstantialContent = userMessages.some(msg => {
            // Skip generic greetings and small talk
            const genericPatterns = /^(hi|hello|hey|how are you|how's it going|what's up|good morning|good afternoon|good evening|thanks|thank you|bye|goodbye)$/;
            return !genericPatterns.test(msg) && msg.length > 10;
          });
          
          if (!hasSubstantialContent) {
            console.log('[chat] Skipping title generation - only generic greetings detected');
            return;
          }
          
          // Generate title based on conversation content
          const allText = recentMessages.map(m => m.content).join(' ').toLowerCase();
          let title = 'Daily Coaching';
          
          if (/ai|tech|development|app|build|code|project|programming|software/.test(allText)) {
            title = 'AI Development Focus';
          } else if (/work.*life|balance|stress|overwhelm|busy|schedule|time management/.test(allText)) {
            title = 'Work-Life Balance';
          } else if (/focus|distraction|procrastination|deadline|overwhelm|productivity|efficiency/.test(allText)) {
            title = 'Focus & Productivity';
          } else if (/goal|achieve|progress|growth|ambition|career|success/.test(allText)) {
            title = 'Goal Setting';
          } else if (/habit|routine|daily|consistency|behavior|change|improve/.test(allText)) {
            title = 'Building Habits';
          } else if (/health|fitness|exercise|wellness|mental health|anxiety|depression/.test(allText)) {
            title = 'Health & Wellness';
          } else if (/relationship|family|friends|social|communication/.test(allText)) {
            title = 'Relationships';
          } else if (/finance|money|budget|investment|financial|saving/.test(allText)) {
            title = 'Financial Planning';
          }
          
          if (title !== 'Daily Coaching') {
            await db.update(chatThreads)
              .set({ title, updatedAt: new Date() })
              .where(eq(chatThreads.id, threadId));
            console.log('[chat] Generated thread title:', title);
          }
        }
      } catch (e) {
        console.error('[chat] Failed to generate thread title:', e);
      }
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


