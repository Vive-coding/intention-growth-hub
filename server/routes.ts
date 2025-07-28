import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Complete onboarding
  app.post('/api/users/complete-onboarding', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/life-metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const metrics = await storage.getUserLifeMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching life metrics:", error);
      res.status(500).json({ message: "Failed to fetch life metrics" });
    }
  });

  app.get('/api/life-metrics/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const metrics = await storage.getUserLifeMetricsWithProgress(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching life metrics with progress:", error);
      res.status(500).json({ message: "Failed to fetch life metrics with progress" });
    }
  });

  app.post('/api/life-metrics', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getUserGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.get('/api/goal-instances', isAuthenticated, async (req: any, res) => {
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
  app.patch('/api/goals/:instanceId/progress', isAuthenticated, async (req: any, res) => {
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

  // Journal routes
  app.get('/api/journals', isAuthenticated, async (req: any, res) => {
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

  app.get('/api/journals/:id', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/journals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, content, entryDate, mood, tags, isPrivate } = req.body;
      
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
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating journal entry:", error);
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  app.put('/api/journals/:id', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/journals/:id', isAuthenticated, async (req: any, res) => {
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

  app.get('/api/journals/date-range/:startDate/:endDate', isAuthenticated, async (req: any, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
