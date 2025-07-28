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

  const httpServer = createServer(app);
  return httpServer;
}
