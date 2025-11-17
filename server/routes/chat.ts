import { Router } from "express";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { chatThreads, chatMessages, users, notificationFollowups } from "../../shared/schema";
import { ChatThreadService } from "../services/chatThreadService";
import { streamLifeCoachReply } from "../ai/lifeCoachService";
import { MyFocusService } from "../services/myFocusService";
import { generateShortTitle, generateTitleLLM } from "../ai/utils/journal";

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

// Append a system message to a thread (no streaming)
router.post("/threads/:id/system-message", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const threadId = req.params.id;
    const { content } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'content is required' });
    }

    const [own] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    if (!own || own.userId !== userId) return res.status(404).json({ message: "Thread not found" });

    await ChatThreadService.appendMessage({ threadId, role: 'system', content, status: 'complete' } as any);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('[chat] system-message failed', e);
    res.status(500).json({ message: 'Failed to append system message' });
  }
});

// Create a new chat thread
router.post("/threads", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { title, isTest, privacyScope } = req.body || {};
    console.log('[chat] Creating thread for user:', userId, 'title:', title);
    
    const thread = await ChatThreadService.createThread({
      userId,
      title: typeof title === "string" ? title : null,
      isTest: Boolean(isTest),
      privacyScope: privacyScope ?? null,
      summary: null,
    } as any);
    
    console.log('[chat] Created thread:', { id: thread.id, userId: thread.userId, title: thread.title });
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
    
    console.log('[chat] Fetching messages for thread:', threadId, 'user:', userId);
    
    const [own] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    console.log('[chat] Thread lookup result:', { threadId, found: !!own, userId: own?.userId, matches: own?.userId === userId });
    
    if (!own || own.userId !== userId) {
      console.log('[chat] Thread not found or access denied:', { threadId, userId, found: !!own, threadUserId: own?.userId });
      return res.status(404).json({ message: "Thread not found" });
    }
    
    const limit = Math.min(200, parseInt(String(req.query.limit || "50")) || 50);
    const messages = await ChatThreadService.getMessages(threadId, limit);
    console.log('[chat] Retrieved', messages.length, 'messages for thread:', threadId);
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

    // Attempt EARLY title generation on the user's first substantive message
    try {
      const [threadForTitle] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
      if (threadForTitle && (threadForTitle.title == null || threadForTitle.title === 'Daily Coaching')) {
        const normalized = String(content || '').trim().toLowerCase();
        const genericPatterns = /^(hi|hello|hey|how are you|how's it going|what's up|good (morning|afternoon|evening)|thanks|thank you|bye|goodbye)[!.\s]*$/;
        const hasSubstance = normalized.length > 10 && !genericPatterns.test(normalized);
        if (hasSubstance) {
          let titleCandidate = '';
          try {
            // Prefer LLM title if available, fallback to deterministic short title
            titleCandidate = await generateTitleLLM(content);
          } catch {
            titleCandidate = generateShortTitle(content);
          }

          if (titleCandidate && titleCandidate.trim().length > 0) {
            await db.update(chatThreads)
              .set({ title: titleCandidate.trim(), updatedAt: new Date() })
              .where(eq(chatThreads.id, threadId));
            console.log('[chat] Early thread title set from first user message:', titleCandidate, 'for thread:', threadId);
          }
        }
      }
    } catch (e) {
      console.error('[chat] Early title generation failed (non-fatal):', e);
    }

    // Prepare SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const send = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    send(JSON.stringify({ type: "start" }));
    let finalText = "";
    let structuredPayload: any = null;
    console.log('[chat/respond] Starting response', { 
      requestedAgentType, 
      contentPreview: content.substring(0, 100) 
    });
    
    try {
      const result = await streamLifeCoachReply({
        userId,
        threadId,
        input: content,
        onToken: (delta: string) => {
          finalText += delta;
          send(JSON.stringify({ type: "delta", content: delta }));
        },
        onStructuredData: (data: any) => {
          // Send structured data immediately when available (before streaming completes)
          console.log('[chat/respond] 🎴 SENDING CARD TO FRONTEND (immediate):', data.type);
          send(JSON.stringify({ type: "structured_data", data }));
          structuredPayload = data;
          // Persist agent outputs into My Focus (best-effort)
          try {
            MyFocusService.persistFromAgent(data, { userId, threadId }).catch((e) => {
              console.error('[chat] persist-from-agent failed', e);
            });
          } catch (e) {
            console.error('[chat] persist-from-agent failed', e);
          }
        },
        requestedAgentType,
      });
      finalText = result.finalText || finalText;
      
      console.log('[chat/respond] Response complete', {
        hasCTA: !!result.cta,
        hasStructuredData: !!result.structuredData,
        structuredDataType: result.structuredData?.type
      });
      
      if (result.cta) {
        send(JSON.stringify({ type: "cta", label: result.cta }));
      }
      // Note: structuredData is already sent via onStructuredData callback above
    } catch (e) {
      console.error('[chat] life coach stream failed', e);
      send(JSON.stringify({ type: 'error', message: 'Assistant failed to respond' }));
    }
    send(JSON.stringify({ type: "end" }));

    if (finalText?.trim().length > 0) {
      let saveContent = finalText.trim();
      try {
        if (structuredPayload && typeof structuredPayload === 'object') {
          saveContent += `\n---json---\n${JSON.stringify(structuredPayload)}`;
        }
      } catch {}
      await ChatThreadService.appendMessage({ threadId, role: "assistant", content: saveContent, status: "complete" } as any);
      
      // Generate smart title if this is still the default title
      console.log('[chat] Starting title generation check for thread:', threadId);
      try {
        const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
        console.log('[chat] Thread found for title generation:', { id: thread?.id, title: thread?.title, userId: thread?.userId });
        if (thread && (thread.title === 'Daily Coaching' || thread.title === null)) {
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
          
          console.log('[chat] Analyzing content for title generation:', {
            threadId,
            userMessages: userMessages,
            allText: allText.substring(0, 200),
            hasSubstantialContent
          });
          
          // More specific patterns for better title generation
          if (/job|interview|career|work|company|position|role|employment|hiring|recruiter|application/.test(allText)) {
            title = 'Career & Job Search';
          } else if (/ai|tech|development|app|build|code|project|programming|software|engineering/.test(allText)) {
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
            console.log('[chat] Generated thread title:', title, 'for thread:', threadId);
          } else {
            console.log('[chat] No specific title pattern matched for thread:', threadId, 'content:', allText.substring(0, 100));
          }
        }
      } catch (e) {
        console.error('[chat] Failed to generate thread title:', e);
      }
    }

    try {
      const [userRow] = await db
        .select({
          firstChatSession: users.firstChatSession,
          onboardingStep: users.onboardingStep,
          firstGoalCreated: users.firstGoalCreated,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRow && !userRow.firstChatSession) {
        const updatePayload: Record<string, any> = {
          firstChatSession: true,
          updatedAt: new Date(),
        };

        const currentStep = (userRow.onboardingStep ?? "").toLowerCase();
        if (
          userRow.firstGoalCreated &&
          currentStep !== "completed" &&
          currentStep !== "ready_for_notifications"
        ) {
          updatePayload.onboardingStep = "ready_for_notifications";
        }

        await db
          .update(users)
          .set(updatePayload)
          .where(eq(users.id, userId));
        console.log('[chat/respond] ✅ First chat milestone recorded for user', userId);
      }
    } catch (milestoneError) {
      console.error('[chat/respond] Failed to update chat onboarding milestone', milestoneError);
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

router.post("/followups/redeem", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { token } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "token is required" });
    }

    const [followup] = await db
      .select()
      .from(notificationFollowups)
      .where(eq(notificationFollowups.token, token))
      .limit(1);

    if (!followup || followup.userId !== userId) {
      return res.status(404).json({ message: "Follow-up link not found" });
    }

    const now = new Date();
    if (followup.expiresAt && followup.expiresAt.getTime() < now.getTime()) {
      await db
        .update(notificationFollowups)
        .set({ status: "expired" })
        .where(eq(notificationFollowups.id, followup.id));
      return res.status(410).json({ message: "This check-in link has expired." });
    }

    if (followup.status === "used" && followup.threadId) {
      return res.json({ threadId: followup.threadId, alreadyRedeemed: true });
    }

    const payload = (followup as any).payload || {};
    const goals = Array.isArray(payload.goals) ? payload.goals : [];
    const goalLines = goals.map((g: any) => {
      const progress = typeof g.progress === "number" ? `${g.progress}%` : g.progress || "in progress";
      return `• ${g.title}${progress ? ` — ${progress}` : ""}`;
    });

    const [userRow] = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const firstName = userRow?.firstName || "there";

    const assistantMessageLines = [
      `Hi ${firstName}, thanks for opening this check-in.`,
      goalLines.length > 0
        ? `Here’s what I’m seeing for your focus goals:\n${goalLines.join("\n")}`
        : `I’d love to hear how your focus goals felt this week.`,
      `Share what felt smooth and where you might need backup—I'm ready to help you plan the next step.`,
    ].filter(Boolean);

    const assistantMessage = assistantMessageLines.join("\n\n");
    const title = goals.length > 0 ? `Coach check-in: ${goals[0].title}` : "Coach check-in";

    const thread = await ChatThreadService.createThread({
      userId,
      title,
      isTest: false,
      privacyScope: null,
      summary: null,
    } as any);

    await ChatThreadService.appendMessage({
      threadId: thread.id,
      role: "assistant",
      content: assistantMessage,
      status: "complete",
    } as any);

    await db
      .update(notificationFollowups)
      .set({ status: "used", usedAt: now, threadId: thread.id })
      .where(eq(notificationFollowups.id, followup.id));

    const prefill = goals.length > 0
      ? `Here’s how ${goals[0].title} has been going...`
      : "Here’s how my focus goals felt this week...";

    res.json({ threadId: thread.id, prefill });
  } catch (e) {
    console.error("[chat] redeem follow-up failed", e);
    res.status(500).json({ message: "Failed to redeem follow-up" });
  }
});

// TEST ENDPOINT: Manually trigger a follow-up email for testing
router.post("/test-followup-email", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Import services
    const { GoalFollowUpService } = await import("../services/goalFollowUpService");
    const { NotificationService } = await import("../services/notificationService");

    // Get user profile with notification settings
    const [userRow] = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow || !userRow.email) {
      return res.status(400).json({ message: "User email not found" });
    }

    // Get user's focus goals
    const focus = await MyFocusService.getMyFocus(userId);
    const goals = (focus?.priorityGoals || []).filter((goal: any) => goal.status !== "completed").slice(0, 3);

    if (!goals.length) {
      return res.status(400).json({ 
        message: "No active focus goals found. Create some goals first to test the follow-up email." 
      });
    }

    // Get high-leverage habits for email personalization
    const habits = (focus?.highLeverageHabits || []).slice(0, 5);

    // Generate AI-powered personalized email content
    const bodyParagraphs = await GoalFollowUpService.generateEmailContent(
      userId,
      goals,
      habits,
      userRow.firstName
    );

    // Generate unique token
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");
    const appOrigin = process.env.APP_BASE_URL || process.env.APP_ORIGIN || "http://localhost:5000";
    const ctaPath = `/?followup=${token}`;
    const ctaUrl = `${appOrigin}${ctaPath}`;
    const previewText = `Quick check-in on your focus goals${goals.length > 1 ? "" : `: ${goals[0].title}`}`;

    const envelope = NotificationService.generateEmailEnvelope(
      { 
        firstName: userRow.firstName, 
        lastName: userRow.lastName,
        coachingStyle: null 
      },
      {
        subject: "🎯 How are your focus goals coming along?",
        previewText,
        bodyParagraphs,
        ctaLabel: "Continue this check-in",
        ctaUrl,
      }
    );

    // Store follow-up record
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    const payload = {
      goals: goals.map((goal: any) => ({
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
        status: goal.status,
      })),
      generatedAt: new Date().toISOString(),
    };

    const [record] = await db
      .insert(notificationFollowups)
      .values({
        userId,
        token,
        status: "pending",
        subject: envelope.subject,
        previewText: envelope.previewText,
        payload,
        ctaPath,
        expiresAt,
      })
      .returning({ id: notificationFollowups.id });

    // Send the email
    const { sendEmail } = await import("../services/emailService");
    await sendEmail({
      to: userRow.email,
      subject: envelope.subject,
      html: envelope.html,
      text: envelope.text,
      headers: { "X-Entity-Preview": envelope.previewText },
    });

    // Mark as sent
    await db
      .update(notificationFollowups)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(notificationFollowups.id, record.id));

    res.json({
      success: true,
      message: `Test email sent to ${userRow.email}`,
      details: {
        to: userRow.email,
        subject: envelope.subject,
        goals: goals.map((g: any) => g.title),
        followupToken: token,
        ctaUrl,
      }
    });
  } catch (error) {
    console.error("[test-followup-email] Error:", error);
    res.status(500).json({ 
      message: "Failed to send test email",
      error: (error as any)?.message 
    });
  }
});

export default router;


