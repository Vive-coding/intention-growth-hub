import { Express, Request, Response } from "express";
import { Server } from "http";
import { createServer } from "http";
import { storage } from "./storage";
import { setupDevAuth, isDevAuthenticated } from "./devAuth";
import { createUser, authenticateUser, generateToken, verifyToken } from "./auth";
import insightsRouter from "./routes/insights";
import chatRouter from "./routes/chat";
import goalsRouter from "./routes/goals";
import testCardsRouter from "./routes/testCards";
import myFocusRouter from "./routes/myFocus";
import { securityMiddleware } from "./middleware/security";
import { InsightService } from "./services/insightService";
import { GoalFollowUpService } from "./services/goalFollowUpService";
import { db, ensureUsersTimezoneColumn } from "./db";
import { and, eq, gte, lt, lte, sql as dsql, inArray, desc } from "drizzle-orm";
import {
  habitInstances,
  habitDefinitions,
  goalInstances,
  goalDefinitions,
  lifeMetricDefinitions,
  habitCompletions,
  userOnboardingProfiles,
  users,
  suggestedGoals,
  suggestedHabits,
} from "../shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware based on environment
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    await setupDevAuth(app);
  }
  const authMiddleware = isDev ? isDevAuthenticated : (req: any, res: any, next: any) => {
    // Production JWT authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    
    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid token" });
      }
      
      // Add the user to the request with proper ID
      req.user = {
        id: decoded.userId,
        claims: {
          sub: decoded.userId,
        }
      };
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: "Invalid token" });
    }
  };

  // Register insights routes with auth middleware
  app.use('/api/insights', authMiddleware, insightsRouter);

  // Register goals routes with auth middleware
  console.log('=== REGISTERING GOALS ROUTES ===');
  app.use('/api/goals', authMiddleware, goalsRouter);
  console.log('=== GOALS ROUTES REGISTERED ===');

  // Register chat routes (feature-flagged)
  const CHAT_API_ENABLED = (process.env.CHAT_API_ENABLED || '').toLowerCase() === 'true';
  const enableChatInDev = process.env.NODE_ENV === 'development';
  if (CHAT_API_ENABLED || enableChatInDev) {
    app.use('/api/chat', authMiddleware, chatRouter);
    // Only expose test-cards in development
    if (enableChatInDev) {
      app.use('/api/test-cards', authMiddleware, testCardsRouter);
    }
    app.use('/api/my-focus', authMiddleware, myFocusRouter);
  }

  // TEST ENDPOINT: Manually trigger a follow-up email for testing (always available)
  // Register early to avoid conflicts
  console.log("[routes] ✅ Registering /api/test-followup-email endpoint (early)");
  
  // Add request logging middleware for debugging (before route handlers)
  app.use("/api/test-followup-email", (req: any, res: any, next: any) => {
    console.log(`[test-followup-email] ${req.method} request received`, {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      headers: {
        authorization: req.headers.authorization ? "present" : "missing",
        "content-type": req.headers["content-type"],
      },
    });
    next();
  });
  
  // Handle OPTIONS for CORS preflight (must be before other methods)
  app.options("/api/test-followup-email", (req: any, res: any) => {
    console.log("[test-followup-email] OPTIONS handler executing");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
  });
  
  // Add GET route for testing
  app.get("/api/test-followup-email", authMiddleware, async (req: any, res: any) => {
    console.log("[test-followup-email] GET handler executing");
    res.json({ message: "Test endpoint is working! Use POST to send email.", method: "GET" });
  });
  
  // Add POST route
  app.post("/api/test-followup-email", authMiddleware, async (req: any, res: any) => {
    console.log("[test-followup-email] POST handler executing");
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { NotificationService } = await import("./services/notificationService");
      const { MyFocusService } = await import("./services/myFocusService");
      const { sendEmail } = await import("./services/emailService");
      const { randomBytes } = await import("node:crypto");
      const { notificationFollowups } = await import("../shared/schema");

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

      // Generate email content
      const goalSummaryLines = goals.map((goal: any) => {
        const progress = typeof goal.progress === "number" ? `${goal.progress}%` : "in progress";
        return `• ${goal.title}${progress ? ` — ${progress}` : ""}`;
      });

      const bodyParagraphs = [
        "I just reviewed your focus goals and wanted to check in.",
        `Here's how things look right now:\n${goalSummaryLines.join("\n")}`,
        "When you have a minute, reply so we can celebrate the wins and tackle anything that feels stuck.",
      ];

      // Generate unique token
      const token = randomBytes(24).toString("hex");
      const appOrigin = process.env.APP_BASE_URL || process.env.APP_ORIGIN || "https://goodhabit.ai";
      const ctaPath = `/?followup=${token}`;
      const ctaUrl = `${appOrigin}${ctaPath}`;
      const previewText = `Quick check-in on your focus goals${goals.length > 1 ? "" : `: ${goals[0].title}`}`;

      const envelope = NotificationService.generateEmailEnvelope(
        { 
          userId: userRow.userId,
          email: userRow.email,
          firstName: userRow.firstName, 
          lastName: userRow.lastName,
          notificationEnabled: true,
          notificationFrequency: null,
          preferredNotificationTime: null,
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

  // Debug: Log all registered routes for test-followup-email
  console.log("[routes] Route stack for /api/test-followup-email:", 
    app._router.stack
      .filter((r: any) => r.route?.path === '/api/test-followup-email')
      .map((r: any) => ({ path: r.route?.path, methods: Object.keys(r.route?.methods || {}) }))
  );

  // Feedback capture endpoint (append-only)
  app.post('/api/feedback', authMiddleware, async (req: any, res) => {
    try {
      // Ensure feedback tables exist if migrations haven't run
      try { await (await import('./db')).ensureFeedbackTables(); } catch {}
      const userId = req.user.id || req.user.claims.sub;
      const { type, itemId, action, context } = req.body || {};
      if (!type || !itemId || !action) {
        return res.status(400).json({ message: 'type, itemId and action are required' });
      }
      const [row] = await db.insert((await import('../shared/schema')).feedbackEvents).values({
        userId,
        type,
        itemId: String(itemId),
        action,
        context: context ?? null,
      }).returning();
      res.json(row);
    } catch (e) {
      console.error('Feedback insert failed', e);
      res.status(500).json({ message: 'Failed to record feedback' });
    }
  });

  // Feedback status lookup for a set of ids (persistent voted indicator)
  app.get('/api/feedback/status', authMiddleware, async (req: any, res) => {
    // Ensure clients do not cache this endpoint; it drives UI state
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      try { await (await import('./db')).ensureFeedbackTables(); } catch {}
      const userId = req.user.id || req.user.claims.sub;
      const { type, ids } = req.query as { type?: string; ids?: string };
      if (!type || !ids) {
        return res.status(400).json({ message: 'type and ids are required' });
      }
      const list = ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length === 0) {
        return res.json({ voted: {}, lastAction: {} });
      }
      const { feedbackEvents } = await import('../shared/schema');
      // Fetch feedback events for these ids and determine last base vote action per item
      const rows = await db
        .select({ itemId: feedbackEvents.itemId, action: feedbackEvents.action, createdAt: feedbackEvents.createdAt })
        .from(feedbackEvents)
        .where(and(
          eq(feedbackEvents.userId, userId),
          eq(feedbackEvents.type, String(type)),
          inArray(feedbackEvents.itemId, list as any)
        ))
        .orderBy(desc(feedbackEvents.createdAt)) as any[];

      const voted: Record<string, boolean> = {};
      const lastAction: Record<string, string | null> = {};
      for (const id of list) {
        voted[id] = false;
        lastAction[id] = null;
      }
      for (const r of rows) {
        const id = String(r.itemId);
        voted[id] = true;
        if (!lastAction[id] && (r.action === 'upvote' || r.action === 'downvote')) {
          lastAction[id] = r.action;
        }
      }
      console.log('[feedback/status] user', userId, 'type', type, 'ids', list);
      console.log('[feedback/status] rows', rows?.length);
      console.log('[feedback/status] voted map', voted);
      console.log('[feedback/status] lastAction map', lastAction);
      res.json({ voted, lastAction });
    } catch (e) {
      console.error('Feedback status lookup failed', e);
      res.status(500).json({ message: 'Failed to fetch feedback status' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Always require token - no dev auth
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid token" });
      }
      
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Signup route
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create new user
      const user = await createUser(email, password, firstName, lastName);
      
      // Generate token
      const token = generateToken(user.id);
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          onboardingCompleted: user.onboardingCompleted,
        },
        token
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Authenticate user
      const user = await authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate token
      const token = generateToken(user.id);
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          onboardingCompleted: user.onboardingCompleted,
          timezone: (user as any).timezone || null,
        },
        token
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in" });
    }
  });
  // Save/update user timezone
  app.post('/api/users/timezone', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { timezone } = req.body;
      if (!timezone || typeof timezone !== 'string') {
        return res.status(400).json({ message: 'Invalid timezone' });
      }
      let updated: any[] | undefined;
      try {
        updated = await db
          .update((await import("../shared/schema")).users)
          .set({ timezone, updatedAt: new Date() })
          .where(eq((await import("../shared/schema")).users.id, userId))
          .returning();
      } catch (e: any) {
        if (e?.code === '42703' || /column\s+"?timezone"?\s+does not exist/i.test(String(e?.message || e))) {
          await ensureUsersTimezoneColumn();
          updated = await db
            .update((await import("../shared/schema")).users)
            .set({ timezone, updatedAt: new Date() })
            .where(eq((await import("../shared/schema")).users.id, userId))
            .returning();
        } else {
          throw e;
        }
      }
      res.json({ success: true, timezone: (updated as any)?.[0]?.timezone || timezone });
    } catch (e) {
      console.error('Failed to save timezone', e);
      res.status(500).json({ message: 'Failed to save timezone' });
    }
  });

  // Update basic account info (name only for now)
  app.put('/api/users/me', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { firstName, lastName } = req.body || {};
      if (!firstName && !lastName) {
        return res.status(400).json({ message: 'Nothing to update' });
      }
      const usersTbl = (await import('../shared/schema')).users;
      const [updated] = await db
        .update(usersTbl)
        .set({
          firstName: typeof firstName === 'string' ? firstName : undefined,
          lastName: typeof lastName === 'string' ? lastName : undefined,
          updatedAt: new Date(),
        })
        .where(eq(usersTbl.id, userId))
        .returning();
      res.json({ id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName });
    } catch (e) {
      console.error('Failed to update user', e);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });



  // Redirect /api/login to /api/auth/login for compatibility
  app.get('/api/login', (req, res) => {
    res.redirect('/api/auth/login');
  });

  // Complete onboarding
  app.post('/api/users/complete-onboarding', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.completeOnboarding(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  app.get('/api/users/onboarding-profile', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const [profile] = await db
        .select()
        .from(userOnboardingProfiles)
        .where(eq(userOnboardingProfiles.userId, userId))
        .limit(1);

      res.json(profile ?? {});
    } catch (error) {
      console.error('Error fetching onboarding profile:', error);
      res.status(500).json({ message: 'Failed to fetch onboarding profile' });
    }
  });

  app.post('/api/users/onboarding-profile', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const {
        goalSettingAbility,
        habitBuildingAbility,
        coachingStyle,
        focusLifeMetrics,
        coachPersonality,
        notificationEnabled,
        notificationFrequency,
        preferredNotificationTime,
      } = req.body ?? {};

      const sanitizedGoalSettingAbility = typeof goalSettingAbility === 'string' ? goalSettingAbility : null;
      const sanitizedHabitBuildingAbility = typeof habitBuildingAbility === 'string' ? habitBuildingAbility : null;
      const sanitizedCoachingStyle = Array.isArray(coachingStyle)
        ? (coachingStyle as any[]).map((value) => String(value)).filter(Boolean)
        : null;
      const sanitizedFocusMetrics = Array.isArray(focusLifeMetrics)
        ? (focusLifeMetrics as any[]).map((value) => String(value)).filter(Boolean)
        : null;
      const coachPersonalityArray = Array.isArray(coachPersonality)
        ? (coachPersonality as any[]).map((value) => String(value)).filter(Boolean)
        : undefined;
      const sanitizedCoachPersonality = coachPersonalityArray
        ? coachPersonalityArray.join(',')
        : typeof coachPersonality === 'string'
          ? coachPersonality
          : coachPersonality === null
            ? null
            : undefined;
      const sanitizedNotificationEnabled = typeof notificationEnabled === 'boolean' ? notificationEnabled : notificationEnabled === null ? null : undefined;
      const sanitizedNotificationFrequency = typeof notificationFrequency === 'string' ? notificationFrequency : notificationFrequency === null ? null : undefined;
      const notificationTimeArray = Array.isArray(preferredNotificationTime)
        ? (preferredNotificationTime as any[]).map((value) => String(value)).filter(Boolean)
        : undefined;
      const sanitizedPreferredNotificationTime = notificationTimeArray
        ? notificationTimeArray.join(',')
        : typeof preferredNotificationTime === 'string'
          ? preferredNotificationTime
          : preferredNotificationTime === null
            ? null
            : undefined;

      const insertValues: Record<string, any> = {
        userId,
        goalSettingAbility: sanitizedGoalSettingAbility,
        habitBuildingAbility: sanitizedHabitBuildingAbility,
        coachingStyle: sanitizedCoachingStyle,
        focusLifeMetrics: sanitizedFocusMetrics,
        coachPersonality: sanitizedCoachPersonality,
      };

      if (sanitizedNotificationEnabled !== undefined) {
        insertValues.notificationEnabled = sanitizedNotificationEnabled;
      }
      if (sanitizedNotificationFrequency !== undefined) {
        insertValues.notificationFrequency = sanitizedNotificationFrequency;
      }
      if (sanitizedPreferredNotificationTime !== undefined) {
        insertValues.preferredNotificationTime = sanitizedPreferredNotificationTime;
      }

      const updateValues: Record<string, any> = {
        goalSettingAbility: sanitizedGoalSettingAbility,
        habitBuildingAbility: sanitizedHabitBuildingAbility,
        coachingStyle: sanitizedCoachingStyle,
        focusLifeMetrics: sanitizedFocusMetrics,
        coachPersonality: sanitizedCoachPersonality,
        updatedAt: new Date(),
      };

      if (sanitizedNotificationEnabled !== undefined) {
        updateValues.notificationEnabled = sanitizedNotificationEnabled;
      }
      if (sanitizedNotificationFrequency !== undefined) {
        updateValues.notificationFrequency = sanitizedNotificationFrequency;
      }
      if (sanitizedPreferredNotificationTime !== undefined) {
        updateValues.preferredNotificationTime = sanitizedPreferredNotificationTime;
      }

      const [profile] = await db
        .insert(userOnboardingProfiles)
        .values(insertValues as any)
        .onConflictDoUpdate({
          target: userOnboardingProfiles.userId,
          set: updateValues,
        })
        .returning();

      const [userRow] = await db
        .select({ onboardingStep: users.onboardingStep })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userRow?.onboardingStep || userRow.onboardingStep === 'welcome') {
        await db
          .update(users)
          .set({ onboardingStep: 'profile_completed', updatedAt: new Date() })
          .where(eq(users.id, userId));
      }

      res.json(profile ?? {});
    } catch (error) {
      console.error('Error saving onboarding profile:', error);
      res.status(500).json({ message: 'Failed to save onboarding profile' });
    }
  });

  app.post('/api/users/notification-preferences', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { enabled, frequency, preferredTime, phoneNumber } = req.body ?? {};

      const isEnabled = Boolean(enabled);
      const sanitizedFrequency = typeof frequency === 'string' ? frequency : null;
      const sanitizedPreferredTime = typeof preferredTime === 'string' ? preferredTime : null;
      const sanitizedPhone = typeof phoneNumber === 'string' ? phoneNumber : null;

      const timestamp = new Date();
      const updateValues = {
        notificationEnabled: isEnabled,
        notificationFrequency: isEnabled ? sanitizedFrequency : null,
        preferredNotificationTime: isEnabled ? sanitizedPreferredTime : null,
        phoneNumber: sanitizedPhone,
        completedAt: timestamp,
        updatedAt: timestamp,
      };

      const [profile] = await db
        .insert(userOnboardingProfiles)
        .values({
          userId,
          ...updateValues,
        })
        .onConflictDoUpdate({
          target: userOnboardingProfiles.userId,
          set: updateValues,
        })
        .returning();

      await db
        .update(users)
        .set({
          onboardingCompleted: true,
          onboardingStep: 'completed',
          updatedAt: timestamp,
        })
        .where(eq(users.id, userId));

      res.json({ success: true, profile });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      res.status(500).json({ message: 'Failed to save notification preferences' });
    }
  });

  // Get all users (admin only - for now, we'll make it public for demo purposes)
  app.get('/api/users/all', async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json({ 
        totalUsers: allUsers.length,
        users: allUsers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          onboardingCompleted: user.onboardingCompleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          timezone: user.timezone || 'Not set'
        }))
      });
    } catch (error) {
      console.error("Error getting all users:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Check specific user's timezone (for debugging)
  app.get('/api/users/:userId/timezone', async (req, res) => {
    try {
      const { userId } = req.params;
      const { users } = await import('../shared/schema');
      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const user = userRows[0];
      res.json({
        userId: user.id,
        timezone: user.timezone || 'Not set',
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      console.error("Error getting user timezone:", error);
      res.status(500).json({ message: "Failed to get user timezone" });
    }
  });



  // Life metrics routes
  app.get('/api/life-metrics', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const metrics = await storage.getUserLifeMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching life metrics:", error);
      res.status(500).json({ message: "Failed to fetch life metrics" });
    }
  });

  // Update life metric time availability
  app.patch('/api/life-metrics/:id/time-availability', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { id } = req.params;
      const { timeAvailability } = req.body as { timeAvailability?: 'none' | 'very_little' | 'some' | 'plenty' };
      if (!timeAvailability || !['none','very_little','some','plenty'].includes(timeAvailability)) {
        return res.status(400).json({ message: 'Invalid timeAvailability' });
      }
      const updated = await db
        .update(lifeMetricDefinitions)
        .set({ timeAvailability })
        .where(and(eq(lifeMetricDefinitions.id, id), eq(lifeMetricDefinitions.userId, userId)))
        .returning();
      if (!updated || updated.length === 0) {
        return res.status(404).json({ message: 'Life metric not found' });
      }
      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating time availability:', error);
      res.status(500).json({ message: 'Failed to update time availability' });
    }
  });

  app.get('/api/life-metrics/progress', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const metrics = await storage.getUserLifeMetricsWithProgress(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching life metrics with progress:", error);
      res.status(500).json({ message: "Failed to fetch life metrics with progress" });
    }
  });

  app.get('/api/life-metrics/:metricName/monthly-completions', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { metricName } = req.params;
      const { period } = req.query;
      const completions = await storage.getMonthlyGoalCompletions(userId, metricName, period as string);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching monthly completions:", error);
      res.status(500).json({ message: "Failed to fetch monthly completions" });
    }
  });

  app.get('/api/life-metrics/:metricName/weekly-progress', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { metricName } = req.params;
      const weeklyProgress = await storage.getWeeklyProgress(userId, metricName);
      res.json(weeklyProgress);
    } catch (error) {
      console.error("Error fetching weekly progress:", error);
      res.status(500).json({ message: "Failed to fetch weekly progress" });
    }
  });

  app.get('/api/life-metrics/:metricName/progress/:period', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { metricName, period } = req.params;
      const progress = await storage.getProgressForPeriod(userId, metricName, period);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress for period:", error);
      res.status(500).json({ message: "Failed to fetch progress for period" });
    }
  });

  app.get('/api/life-metrics/:metricName/progress-snapshots', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { metricName } = req.params;
      const { period } = req.query;
      
      // Snapshot request for metric: ${metricName}, period: ${period}
      
      // Calculate date range based on period
      let endDate = new Date();
      let startDate: Date;
      
      switch (period) {
        case "Last 3 Months":
          startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
          break;
        case "Last 6 Months":
          startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 6, 1);
          break;
        case "This Year":
          startDate = new Date(endDate.getFullYear(), 0, 1);
          break;
        case "All Time":
          startDate = new Date(2020, 0, 1);
          break;
        default:
          // This Month - get current month only
          startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      }
      
      // Date range: ${startDate.toISOString()} to ${endDate.toISOString()}
      
      let snapshots = await storage.getProgressSnapshots(userId, metricName, startDate, endDate);
      
      // Always attempt to create today's snapshot for This Month to ensure daily snapshots
      if (!period || period === 'This Month') {
        try {
          await storage.upsertTodayProgressSnapshot(userId, metricName);
          // Update endDate to current time to ensure we include the just-created snapshot
          endDate = new Date();
          // Re-fetch snapshots to get the latest data
          snapshots = await storage.getProgressSnapshots(userId, metricName, startDate, endDate);
        } catch (e) {
          console.error('Failed to ensure today\'s snapshot:', e);
        }
      }
      
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching progress snapshots:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to fetch progress snapshots" });
    }
  });

  app.post('/api/life-metrics', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const metric = await storage.createLifeMetric({
        ...req.body,
        userId,
      });
      res.json(metric);
    } catch (error) {
      console.error("Error creating life metric:", error);
      res.status(500).json({ message: "Failed to create life metric" });
    }
  });

  // Goals routes
  app.get('/api/goals', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getUserGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  // Smart Suggestions (computed on the fly)
  app.get('/api/smart-suggestions', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;

      // Helper function to determine if a habit should be shown for completion
      const shouldShowHabitForCompletion = async (habitDefinitionId: string, habitInstance: any, userId: string, today: Date) => {
        // Get the habit's frequency settings
        const frequencySettings = habitInstance.frequencySettings;
        
        if (!frequencySettings) {
          // Fallback: if no frequency settings, treat as daily
          const alreadyToday = await db
            .select()
            .from(habitCompletions)
            .where(and(
              eq(habitCompletions.habitDefinitionId, habitDefinitionId),
              eq(habitCompletions.userId, userId),
              gte(habitCompletions.completedAt, today),
              lt(habitCompletions.completedAt, new Date(today.getTime() + 24 * 60 * 60 * 1000))
            ))
            .limit(1);
          return alreadyToday.length === 0;
        }

        const { frequency, perPeriodTarget, periodsCount } = frequencySettings;
        const totalTarget = perPeriodTarget * periodsCount;

        // Calculate the start of the current period based on frequency
        let periodStart: Date;
        let periodEnd: Date;
        
        switch (frequency) {
          case 'daily':
            // Daily: check if completed today
            periodStart = new Date(today);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(today);
            periodEnd.setHours(23, 59, 59, 999);
            break;
            
          case 'weekly':
            // Weekly: check if completed this week (Monday to Sunday)
            const dayOfWeek = today.getDay();
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
            periodStart = new Date(today);
            periodStart.setDate(today.getDate() - daysFromMonday);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodStart.getDate() + 6);
            periodEnd.setHours(23, 59, 59, 999);
            break;
            
          case 'monthly':
            // Monthly: check if completed this month
            periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
            periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
            
          default:
            // Fallback to daily
            periodStart = new Date(today);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(today);
            periodEnd.setHours(23, 59, 59, 999);
        }

        // Count completions in the current period
        const completionsInPeriod = await db
          .select()
          .from(habitCompletions)
          .where(and(
            eq(habitCompletions.habitDefinitionId, habitDefinitionId),
            eq(habitCompletions.userId, userId),
            gte(habitCompletions.completedAt, periodStart),
            lte(habitCompletions.completedAt, periodEnd)
          ));

        // Show habit if not completed enough times for the current period
        return completionsInPeriod.length < totalTarget;
      };

      // 1) Load active goals
      const goals = await storage.getUserGoals(userId);

      // 2) Load habits that are linked to active goals and not completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const habitsForActiveGoals = await db
        .select({
          habitInstance: habitInstances,
          habitDefinition: habitDefinitions,
          goalInstance: goalInstances,
          goalDefinition: goalDefinitions,
          lifeMetric: lifeMetricDefinitions,
        })
        .from(habitInstances)
        .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
        .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .innerJoin(lifeMetricDefinitions, eq(goalDefinitions.lifeMetricId, lifeMetricDefinitions.id))
        .where(and(
          eq(habitInstances.userId, userId),
          eq(goalInstances.status, 'active'),
          eq(goalInstances.archived, false)
        ));

      const uniqueHabits: any[] = [];
      const seenHabitDef = new Set<string>();
      for (const { habitDefinition, habitInstance, goalInstance, lifeMetric } of habitsForActiveGoals as any[]) {
        if (seenHabitDef.has(habitDefinition.id)) continue;
        
        // Check if habit should be shown based on its frequency and completion status
        const shouldShowHabit = await shouldShowHabitForCompletion(
          habitDefinition.id, 
          habitInstance, 
          userId, 
          today
        );
        
        if (shouldShowHabit) {
          uniqueHabits.push({
            id: habitDefinition.id,
            title: habitDefinition.name,
            description: habitDefinition.description,
            goalInstanceId: goalInstance.id,
            metric: { id: lifeMetric.id, name: lifeMetric.name, color: lifeMetric.color },
          });
          seenHabitDef.add(habitDefinition.id);
        }
      }

      // Build candidate suggestions
      type Suggestion = {
        id: string;
        title: string;
        reason: string;
        impact: number;
        effortMinutes: number;
        confidence: number;
        urgency: number;
        metric: { id: string; name: string; color: string };
        goalId?: string;
        habitId?: string;
        priorityScore: number;
      };

      const suggestions: Suggestion[] = [];

      // (A) Complete remaining habits today
      for (const h of uniqueHabits) {
        const effort = Math.min(30, (h.title?.toLowerCase().includes('reflection') ? 10 : 20));
        const confidence = 85;
        const impact = 75;
        const urgency = 80; // today only
        const score = 0.45*impact + 0.25*urgency + 0.20*confidence - 0.10*(effort/60*100);
        suggestions.push({
          id: `habit-${h.id}`,
          title: `Complete ${h.title} today`,
          reason: `Improves ${h.metric.name} by maintaining momentum`,
          impact,
          effortMinutes: effort,
          confidence,
          urgency,
          metric: h.metric,
          goalId: h.goalInstanceId,
          habitId: h.id,
          priorityScore: score,
        });
      }

      // (B) Goals with upcoming targets or large remaining gap
      for (const g of goals as any[]) {
        if (g.status !== 'active') continue;
        const progress = Number(g.progress || 0);
        const remaining = Math.max(0, 100 - progress);
        const targetDate = g.targetDate ? new Date(g.targetDate) : undefined;
        const daysToTarget = targetDate ? Math.ceil((targetDate.getTime() - Date.now())/ (1000*60*60*24)) : 999;
        const urgency = targetDate ? Math.max(0, 100 - Math.min(90, daysToTarget*5)) : 40;
        const impact = remaining >= 60 ? 85 : remaining >= 30 ? 70 : 50;
        const effort = 25;
        const confidence = 70;
        const score = 0.45*impact + 0.25*urgency + 0.20*confidence - 0.10*(effort/60*100);
        suggestions.push({
          id: `goal-${g.id}`,
          title: `Plan a 25m step for “${g.title}”`,
          reason: `Remaining ${remaining}% and target ${targetDate ? `in ${Math.max(0, daysToTarget)} days` : 'date TBD'}`,
          impact,
          effortMinutes: effort,
          confidence,
          urgency,
          metric: { id: g.lifeMetric?.id, name: g.lifeMetric?.name, color: g.lifeMetric?.color },
          goalId: g.id,
          priorityScore: score,
        });
      }

      // Sort and return top 3
      suggestions.sort((a,b)=> b.priorityScore - a.priorityScore);
      res.json(suggestions.slice(0,3));
    } catch (error) {
      console.error('Error building smart suggestions:', error);
      res.status(500).json({ error: 'Failed to compute smart suggestions' });
    }
  });

  // Insights routes
  app.get('/api/insights', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insights = await storage.getUserInsights(userId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  // Metrics endpoint for agent conditioning
  app.get('/api/agent/acceptance-metrics', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      const { month } = req.query;
      const windowMonth = typeof month === 'string' && month.length === 7 ? month : new Date().toISOString().slice(0,7);
      const { acceptanceMetrics } = await import('../shared/schema');
      const rows = await db.query.acceptanceMetrics.findMany({
        where: and(eq(acceptanceMetrics.userId, userId), eq(acceptanceMetrics.windowMonth, windowMonth)),
      });
      res.json({ month: windowMonth, metrics: rows });
    } catch (e) {
      console.error('Failed to fetch acceptance metrics', e);
      res.status(500).json({ message: 'Failed to fetch acceptance metrics' });
    }
  });

  app.get('/api/goal-instances', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const instances = await storage.getUserGoalInstances(userId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching goal instances:", error);
      res.status(500).json({ message: "Failed to fetch goal instances" });
    }
  });

  // Update goal progress
  app.patch('/api/goals/:instanceId/progress', authMiddleware, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { currentValue } = req.body;
      
      if (typeof currentValue !== 'number' || currentValue < 0) {
        return res.status(400).json({ message: "Invalid progress value" });
      }

      const updatedInstance = await storage.updateGoalProgress(instanceId, currentValue);

      // Snapshot all metrics for the user (first snapshot of the day)
      try {
        const userId = req.user.id || req.user.claims.sub;
        const metrics = await storage.getUserLifeMetrics(userId);
        for (const m of metrics) {
          await storage.upsertTodayProgressSnapshot(userId, m.name);
        }
      } catch (e) {
        console.warn('Snapshot upsert (all metrics) failed after manual progress update', e);
      }
      res.json(updatedInstance);
    } catch (error) {
      console.error("Error updating goal progress:", error);
      res.status(500).json({ message: "Failed to update goal progress" });
    }
  });

  // Toggle goal completion status
  app.post('/api/goals/:instanceId/toggle-completion', authMiddleware, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user.id || req.user.claims.sub;

      // Get the current goal state
      const currentGoal = await db
        .select()
        .from(goalInstances)
        .where(and(eq(goalInstances.id, instanceId), eq(goalInstances.userId, userId)))
        .limit(1)
        .then(rows => rows[0]);

      if (!currentGoal) {
        return res.status(404).json({ message: "Goal not found" });
      }

      // Toggle completion status
      const isCompleted = currentGoal.status === 'completed';
      const newStatus = isCompleted ? 'active' : 'completed';
      const completedAt = isCompleted ? null : new Date();
      const currentValue = isCompleted ? (currentGoal.currentValue || 0) : 100;

      const [updatedInstance] = await db
        .update(goalInstances)
        .set({
          status: newStatus,
          completedAt,
          currentValue,
        })
        .where(eq(goalInstances.id, instanceId))
        .returning();

      res.json(updatedInstance);
    } catch (error) {
      console.error("Error toggling goal completion:", error);
      res.status(500).json({ message: "Failed to toggle goal completion" });
    }
  });

  // Get goal completion counts by date range for chart
  app.get('/api/goals/completions/:metricName', authMiddleware, async (req: any, res) => {
    try {
      const { metricName } = req.params;
      const userId = req.user.id || req.user.claims.sub;
      const { period = 'Last 6 Months' } = req.query;

      // Calculate date range based on period
      let endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'This Month':
          startDate.setDate(1);
          break;
        case 'Last 3 Months':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'Last 6 Months':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case 'This Year':
          startDate.setMonth(0, 1);
          break;
        case 'All Time':
          startDate.setFullYear(2020); // Reasonable start date
          break;
        default:
          startDate.setMonth(startDate.getMonth() - 6);
      }

      const completions = await storage.getGoalCompletionsByDateRange(userId, metricName, startDate, endDate);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching goal completions:", error);
      res.status(500).json({ message: "Failed to fetch goal completions" });
    }
  });

  // Get habit associations with goals for editing
  app.get('/api/habits/:habitId/associations', authMiddleware, async (req: any, res) => {
    try {
      const { habitId } = req.params;
      const userId = req.user.id || req.user.claims.sub;

      // Get all habit instances for this habit across all goals
      const associations = await db
        .select({
          id: habitInstances.id,
          goalId: goalInstances.id,
          goalTitle: goalDefinitions.title,
          goalTargetDate: goalInstances.targetDate,
          targetValue: habitInstances.targetValue,
          frequencySettings: habitInstances.frequencySettings,
        })
        .from(habitInstances)
        .innerJoin(goalInstances, eq(habitInstances.goalInstanceId, goalInstances.id))
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .where(and(
          eq(habitInstances.habitDefinitionId, habitId),
          eq(goalInstances.userId, userId)
        ));

      res.json(associations);
    } catch (error) {
      console.error("Error fetching habit associations:", error);
      res.status(500).json({ message: "Failed to fetch habit associations" });
    }
  });

  // Get today's habit completions count (for header)
  app.get('/api/habits/today-completions', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims.sub;
      
      // Get today's date in UTC (to match habitCompletions date filter)
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get My Focus high-leverage habits (priority habits only)
      // Match the UI display limit of 6 habits
      const { MyFocusService } = await import('./services/myFocusService');
      const myFocus = await MyFocusService.getMyFocus(userId);
      const focusHabitIds = (myFocus.highLeverageHabits || []).map((h: any) => h.id).filter(Boolean);
 
      if (focusHabitIds.length === 0) {
        return res.json({ completed: 0, total: 0 });
      }
 
      // Count total focus habits
      const total = focusHabitIds.length;
      
      // Count completed habits today
      const completedRows = await db
        .select({ habitDefinitionId: habitCompletions.habitDefinitionId })
        .from(habitCompletions)
        .where(and(
          eq(habitCompletions.userId, userId),
          inArray(habitCompletions.habitDefinitionId, focusHabitIds as any),
          eq(dsql`to_char(${habitCompletions.completedAt}, 'YYYY-MM-DD')`, dateStr as any)
        ));
      
      // Use a Set to count unique habits completed (in case of duplicates)
      const uniqueCompleted = new Set(completedRows.map(r => r.habitDefinitionId).filter(Boolean));
      const completed = uniqueCompleted.size;
      
      res.json({ completed, total });
    } catch (error) {
      console.error("Error fetching today's habit completions:", error);
      res.status(500).json({ message: "Failed to fetch habit completions" });
    }
  });





  // Journal routes with security middleware
  app.get('/api/journals', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit) || 50;
      const entries = await storage.getUserJournalEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });


   app.get('/api/journals/:id', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const entry = await storage.getJournalEntry(id, userId);
      
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  app.post('/api/journals', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let { title, content, entryDate, mood, tags, isPrivate } = req.body;
      // Auto title + mood
      try {
        const { looksGenericTitle, generateTitleLLM, classifyMoodLLM, generateTagsLLM } = await import('./ai/utils/journal.ts');
        if (!title || looksGenericTitle(title)) {
          title = await generateTitleLLM(String(content || ''));
        }
        if (!mood || String(mood).trim().length === 0) {
          console.log('[MOOD] Attempting AI mood analysis for content:', content.substring(0, 100) + '...');
          mood = await classifyMoodLLM(String(content || ''));
          console.log('[MOOD] AI mood analysis result:', mood);
        }
        if ((!tags || !Array.isArray(tags) || tags.length === 0) && content) {
          tags = await generateTagsLLM(String(content));
        }
        res.set('X-Journal-Autofill', JSON.stringify({ title: !req.body.title, mood: !req.body.mood }));
      } catch (error) {
        console.error('[MOOD] Error in AI autofill:', error);
        // Fallback to neutral mood if AI fails
        if (!mood || String(mood).trim().length === 0) {
          mood = 'neutral';
          console.log('[MOOD] Fallback to neutral mood due to AI error');
        }
      }
      
      console.log('Creating journal entry:', {
        userId,
        title,
        content: content.substring(0, 50) + '...',
        entryDate,
        mood,
        tags,
        isPrivate,
      });
      
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      const entry = await storage.createJournalEntry({
        userId,
        title,
        content,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        mood,
        tags,
        isPrivate: isPrivate ?? true,
      });

      // Optional: generate insights on create (disabled by default)
      const AUTO_INSIGHTS = String(process.env.INSIGHTS_AUTOGEN || '').toLowerCase() === 'true';
      if (AUTO_INSIGHTS) {
        console.log('Journal entry created, triggering insight generation...');
        try {
          console.log('Starting insight generation...');
          const insight = await InsightService.generateInsightsForJournal(entry);
          console.log('Insight generated successfully:', insight);
        } catch (error: any) {
          console.error('Error in insight generation:', error?.message || error);
          if (error?.stack) {
            console.error('Error stack:', error.stack);
          }
          // Don't rethrow - we still want to return the journal entry
        }
      } else {
        console.log('[insights] Skipping auto-generation for journal create (INSIGHTS_AUTOGEN disabled)');
      }

      // After journal entry, snapshot all life metrics for this user
      try {
        const metrics = await storage.getUserLifeMetrics(userId);
        for (const m of metrics) {
          await storage.upsertTodayProgressSnapshot(userId, m.name);
        }
      } catch (e) {
        console.warn('Snapshot upsert after journal entry failed', e);
      }
      
      console.log('Journal entry created:', entry);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating journal entry:", error);
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  app.put('/api/journals/:id', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { title, content, entryDate, mood, tags, isPrivate } = req.body;
      
      const entry = await storage.updateJournalEntry(id, userId, {
        title,
        content,
        entryDate: entryDate ? new Date(entryDate) : undefined,
        mood,
        tags,
        isPrivate,
      });
      
      res.json(entry);
    } catch (error) {
      console.error("Error updating journal entry:", error);
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  app.delete('/api/journals/:id', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      await storage.deleteJournalEntry(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  app.get('/api/journals/date-range/:startDate/:endDate', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.params;
      
      const entries = await storage.getJournalEntriesByDateRange(
        userId,
        new Date(startDate),
        new Date(endDate)
      );
      
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries by date range:", error);
      res.status(500).json({ message: "Failed to fetch journal entries by date range" });
    }
  });

  // External journal creation endpoint with API key validation
  app.post('/api/external/journals', securityMiddleware, async (req, res) => {
    try {
      const { userId, title, content, entryDate, mood, tags, isPrivate, apiKey } = req.body;

      // Debug logging
      console.log('Received API Key:', apiKey);
      console.log('Expected API Key:', process.env.EXTERNAL_API_KEY);
      console.log('API Keys match?:', apiKey === process.env.EXTERNAL_API_KEY);

      // Basic API key validation
      if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
        return res.status(401).json({ 
          message: "Invalid API key",
          debug: {
            received: apiKey,
            expected: process.env.EXTERNAL_API_KEY
          }
        });
      }

      // Validate required fields
      if (!userId || !title || !content) {
        return res.status(400).json({ 
          message: "Missing required fields",
          required: ["userId", "title", "content"],
        });
      }

      // Validate that the user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const entry = await storage.createJournalEntry({
        userId,
        title,
        content,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        mood,
        tags,
        isPrivate: isPrivate ?? true,
      });
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating external journal entry:", error);
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  // Manual trigger for insight generation on latest journal entry
  app.post('/api/insights/trigger-latest', authMiddleware, securityMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      console.log('Manually triggering insight generation for latest journal entry...');
      
      // Get the latest journal entry for this user
      const latestEntry = await storage.getLatestJournalEntry(userId);
      
      if (!latestEntry) {
        return res.status(404).json({ message: "No journal entries found for this user" });
      }
      
      console.log('Latest journal entry found:', {
        id: latestEntry.id,
        title: latestEntry.title,
        contentLength: latestEntry.content.length
      });
      
      // Generate insights for the latest entry
      console.log('Starting insight generation...');
      const insight = await InsightService.generateInsightsForJournal(latestEntry);
      
      if (insight) {
        console.log('Insight generated successfully:', insight);
        res.json({ 
          success: true, 
          message: "Insight generated successfully",
          insight: insight 
        });
      } else {
        console.log('No novel insight found for this entry');
        res.json({ 
          success: true, 
          message: "No novel insight found for this entry",
          insight: null 
        });
      }
    } catch (error: any) {
      console.error('Error in manual insight generation:', error?.message || error);
      if (error?.stack) {
        console.error('Error stack:', error.stack);
      }
      res.status(500).json({ 
        message: "Failed to generate insights",
        error: error?.message || error
      });
    }
  });

  const httpServer = createServer(app);
  // Simple in-process scheduler for nightly snapshots per user timezone
  // Assumes user timezone stored in users.profile or defaults to process.env.DEFAULT_TZ
  try {
    const cronModule = await import('node-cron');
    const cron = cronModule.default || cronModule;
    console.log('[cron] node-cron successfully imported, setting up daily snapshots');
    const DEFAULT_TZ = process.env.DEFAULT_TZ || 'UTC';
    const tzMap = (() => { try { return process.env.USER_TZ_MAP ? JSON.parse(process.env.USER_TZ_MAP) : {}; } catch { return {}; } })();
    // Run once daily at 23:58 UTC to create daily snapshots for all users
    cron.schedule('58 23 * * *', async () => {
      try {
        // Load users with timezone if available
        const distinctUsers = await db.query.users.findMany({ columns: { id: true, timezone: true } });
        
        let processedUsers = 0;
        for (const u of distinctUsers as Array<{ id: string; timezone?: string | null }>) {
          try {
            // Snapshot all life metrics for user
            const metrics = await storage.getUserLifeMetrics(u.id);
            for (const m of metrics) {
              await storage.upsertTodayProgressSnapshot(u.id, m.name);
            }
            processedUsers++;
          } catch (userError) {
            console.error(`[cron] Error processing user ${u.id}:`, userError);
          }
        }
        console.log(`[cron] Nightly snapshots completed for ${processedUsers}/${distinctUsers.length} users`);
      } catch (e) {
        console.error('[cron] ❌ Nightly snapshot scheduler error', e);
      }
    });

    // Nightly simple aggregation (00:30 UTC)
    cron.schedule('30 0 * * *', async () => {
      try {
        const { feedbackEvents, acceptanceMetrics, insightLifeMetrics, insights, lifeMetricDefinitions, suggestedGoals, suggestedHabits } = await import('../shared/schema');
        const thisMonth = new Date().toISOString().slice(0,7);
        // Compute per user/type/metricName using insights->lifeMetric join for insight items; default metricName='All'
        // Support multiple types: insight, suggested_goal, suggested_habit
        const rows = await db.execute(dsql`
          WITH fb AS (
            SELECT fe.user_id, fe.type, fe.item_id, fe.action
            FROM ${feedbackEvents} AS fe
            WHERE to_char(fe.created_at, 'YYYY-MM') = ${thisMonth}
          ),
          enriched AS (
            SELECT fb.user_id,
                   fb.type,
                   COALESCE(
                     CASE
                       WHEN fb.type = 'insight' THEN lmd.name
                       WHEN fb.type = 'suggested_goal' THEN sg_lmd.name  
                       WHEN fb.type = 'suggested_habit' THEN sh_lmd.name
                       ELSE 'All'
                     END, 
                     'All'
                   ) AS metric_name,
                   fb.action
            FROM fb
            -- Join for insights
            LEFT JOIN ${insights} i ON (fb.type = 'insight' AND i.id::text = fb.item_id)
            LEFT JOIN ${insightLifeMetrics} ilm ON (fb.type = 'insight' AND ilm.insight_id = i.id)
            LEFT JOIN ${lifeMetricDefinitions} lmd ON (ilm.life_metric_id = lmd.id)
            -- Join for suggested goals
            LEFT JOIN ${suggestedGoals} sg ON (fb.type = 'suggested_goal' AND sg.id::text = fb.item_id)
            LEFT JOIN ${lifeMetricDefinitions} sg_lmd ON (sg.life_metric_id = sg_lmd.id)
            -- Join for suggested habits  
            LEFT JOIN ${suggestedHabits} sh ON (fb.type = 'suggested_habit' AND sh.id::text = fb.item_id)
            LEFT JOIN ${lifeMetricDefinitions} sh_lmd ON (sh.life_metric_id = sh_lmd.id)
          )
          SELECT user_id, type, COALESCE(metric_name,'All') AS metric_name,
                 COUNT(*) FILTER (WHERE action IN ('view','impression')) AS impressions,
                 COUNT(*) FILTER (WHERE action = 'accept') AS accepts,
                 COUNT(*) FILTER (WHERE action = 'dismiss') AS dismisses,
                 COUNT(*) FILTER (WHERE action = 'upvote') AS upvotes,
                 COUNT(*) FILTER (WHERE action = 'downvote') AS downvotes,
                 COUNT(*) FILTER (WHERE action = 'ignore') AS ignores
          FROM enriched
          GROUP BY user_id, type, metric_name
        `);

        // Upsert into metrics
        for (const r of rows as any[]) {
          const acceptanceNumerator = Number(r.accepts || 0) + Number(r.upvotes || 0);
          const acceptanceDenominator =
            Number(r.impressions || 0) + Number(r.accepts || 0) + Number(r.dismisses || 0) + Number(r.upvotes || 0) + Number(r.downvotes || 0) + Number(r.ignores || 0);
          const rate = acceptanceDenominator > 0 ? Math.round((acceptanceNumerator / acceptanceDenominator) * 100) : 0;
          await db
            .insert(acceptanceMetrics)
            .values({
              userId: r.user_id,
              type: r.type,
              metricName: r.metric_name || 'All',
              windowMonth: thisMonth,
              impressions: Number(r.impressions || 0),
              accepts: Number(r.accepts || 0),
              dismisses: Number(r.dismisses || 0),
              upvotes: Number(r.upvotes || 0),
              downvotes: Number(r.downvotes || 0),
              ignores: Number(r.ignores || 0),
              acceptanceRate: rate,
            })
            .onConflictDoUpdate({
              target: [acceptanceMetrics.userId, acceptanceMetrics.type, acceptanceMetrics.metricName, acceptanceMetrics.windowMonth] as any,
              set: {
                impressions: dsql`${acceptanceMetrics.impressions} + ${Number(r.impressions || 0)}`,
                accepts: dsql`${acceptanceMetrics.accepts} + ${Number(r.accepts || 0)}`,
                dismisses: dsql`${acceptanceMetrics.dismisses} + ${Number(r.dismisses || 0)}`,
                upvotes: dsql`${acceptanceMetrics.upvotes} + ${Number(r.upvotes || 0)}`,
                downvotes: dsql`${acceptanceMetrics.downvotes} + ${Number(r.downvotes || 0)}`,
                ignores: dsql`${acceptanceMetrics.ignores} + ${Number(r.ignores || 0)}`,
                acceptanceRate: rate,
                updatedAt: new Date(),
              },
            });
        }
      } catch (e) {
        console.warn('Acceptance metrics aggregation failed', e);
      }
    });

    cron.schedule('15 * * * *', async () => {
      try {
        await GoalFollowUpService.runScheduledCheckIns();
      } catch (e) {
        console.error('[cron] goal follow-up job failed', e);
      }
    });
  } catch (e) {
    console.warn('node-cron not installed; nightly snapshots disabled');
  }

  // Admin endpoint to run snapshot immediately (for testing)
  app.post('/api/admin/snapshots/run', authMiddleware, async (req: any, res) => {
    try {
      const runForAll = req.query.all === 'true';
      const userId = runForAll ? undefined : (req.user.id || req.user.claims.sub);
      const usersToRun = runForAll
        ? await db.query.users.findMany({ columns: { id: true } })
        : [{ id: userId }];
      for (const u of usersToRun) {
        const metrics = await storage.getUserLifeMetrics(u.id as string);
        for (const m of metrics) {
          await storage.upsertTodayProgressSnapshot(u.id as string, m.name);
        }
      }
      res.json({ success: true, users: usersToRun.length });
    } catch (e: any) {
      console.error('Admin snapshot run failed', e);
      res.status(500).json({ message: e?.message || 'Failed to run snapshots' });
    }
  });

  // Admin: purge progress snapshots
  app.delete('/api/admin/snapshots', authMiddleware, async (req: any, res) => {
    try {
      const all = String(req.query.all || '').toLowerCase() === 'true';
      if (all) {
        const { progressSnapshots } = await import('../shared/schema');
        const rows = await db.delete(progressSnapshots).returning({ id: progressSnapshots.id });
        console.warn('[admin] purged ALL progress snapshots', { deleted: rows.length });
        return res.json({ success: true, deleted: rows.length, scope: 'all' });
      }
      const userId = req.user.id || req.user.claims.sub;
      const { progressSnapshots } = await import('../shared/schema');
      const rows = await db
        .delete(progressSnapshots)
        .where(eq(progressSnapshots.userId, userId))
        .returning({ id: progressSnapshots.id });
      console.warn('[admin] purged user progress snapshots', { userId, deleted: rows.length });
      res.json({ success: true, deleted: rows.length, scope: 'user' });
    } catch (e: any) {
      console.error('Admin snapshot purge failed', e);
      res.status(500).json({ message: e?.message || 'Failed to purge snapshots' });
    }
  });

  return httpServer;
}
