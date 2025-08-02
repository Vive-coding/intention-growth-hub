import { Express, Request, Response } from "express";
import { Server } from "http";
import { createServer } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupDevAuth, isDevAuthenticated } from "./devAuth";
import insightsRouter from "./routes/insights";
import goalsRouter from "./routes/goals";
import { securityMiddleware } from "./middleware/security";
import { InsightService } from "./services/insightService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware based on environment
  const isDev = process.env.NODE_ENV === "development";
  const auth = isDev ? await setupDevAuth(app) : await setupAuth(app);
  const authMiddleware = isDev ? isDevAuthenticated : isAuthenticated;

  // Register insights routes
  app.use('/api/insights', insightsRouter);

  // Register goals routes
  app.use('/api/goals', goalsRouter);

  // Auth routes
  app.get('/api/auth/user', authMiddleware, async (req: any, res) => {
    try {
      if (process.env.NODE_ENV === "development") {
        return res.json({
          id: "dev-user-123",
          email: "dev@example.com",
          firstName: "Development",
          lastName: "User",
          profileImageUrl: "https://via.placeholder.com/150",
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
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

  // Life metrics routes
  app.get('/api/life-metrics', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const metrics = await storage.getUserLifeMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching life metrics:", error);
      res.status(500).json({ message: "Failed to fetch life metrics" });
    }
  });

  app.get('/api/life-metrics/progress', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const metrics = await storage.getUserLifeMetricsWithProgress(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching life metrics with progress:", error);
      res.status(500).json({ message: "Failed to fetch life metrics with progress" });
    }
  });

  app.get('/api/life-metrics/:metricName/monthly-completions', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const { metricName } = req.params;
      const { period } = req.query;
      
      // Calculate date range based on period
      const endDate = new Date();
      let startDate = new Date();
      
      switch (period) {
        case "Last 3 Months":
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case "Last 6 Months":
          startDate.setMonth(endDate.getMonth() - 6);
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
      
      const snapshots = await storage.getProgressSnapshots(userId, metricName, startDate, endDate);
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching progress snapshots:", error);
      res.status(500).json({ message: "Failed to fetch progress snapshots" });
    }
  });

  app.post('/api/life-metrics', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      res.json(updatedInstance);
    } catch (error) {
      console.error("Error updating goal progress:", error);
      res.status(500).json({ message: "Failed to update goal progress" });
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
      const { title, content, entryDate, mood, tags, isPrivate } = req.body;
      
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

      console.log('Journal entry created, triggering insight generation...');
      
      try {
        // Generate insights synchronously for debugging
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
  return httpServer;
}
