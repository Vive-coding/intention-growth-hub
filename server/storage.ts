import {
  users,
  lifeMetricDefinitions,
  goalDefinitions,
  goalInstances,
  type User,
  type UpsertUser,
  type LifeMetricDefinition,
  type InsertLifeMetricDefinition,
  type GoalDefinition,
  type InsertGoalDefinition,
  type GoalInstance,
  type InsertGoalInstance,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  completeOnboarding(userId: string): Promise<void>;
  
  // Life metrics operations
  getUserLifeMetrics(userId: string): Promise<LifeMetricDefinition[]>;
  createLifeMetric(metric: InsertLifeMetricDefinition): Promise<LifeMetricDefinition>;
  
  // Goal operations
  getUserGoals(userId: string): Promise<GoalDefinition[]>;
  getUserGoalInstances(userId: string): Promise<GoalInstance[]>;
  createGoal(goal: InsertGoalDefinition): Promise<GoalDefinition>;
  createGoalInstance(instance: InsertGoalInstance): Promise<GoalInstance>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async completeOnboarding(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Life metrics operations
  async getUserLifeMetrics(userId: string): Promise<LifeMetricDefinition[]> {
    return await db
      .select()
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.userId, userId));
  }

  async createLifeMetric(metric: InsertLifeMetricDefinition): Promise<LifeMetricDefinition> {
    const [created] = await db
      .insert(lifeMetricDefinitions)
      .values(metric)
      .returning();
    return created;
  }

  // Goal operations
  async getUserGoals(userId: string): Promise<GoalDefinition[]> {
    return await db
      .select()
      .from(goalDefinitions)
      .where(eq(goalDefinitions.userId, userId));
  }

  async getUserGoalInstances(userId: string): Promise<GoalInstance[]> {
    return await db
      .select()
      .from(goalInstances)
      .where(eq(goalInstances.userId, userId));
  }

  async createGoal(goal: InsertGoalDefinition): Promise<GoalDefinition> {
    const [created] = await db
      .insert(goalDefinitions)
      .values(goal)
      .returning();
    return created;
  }

  async createGoalInstance(instance: InsertGoalInstance): Promise<GoalInstance> {
    const [created] = await db
      .insert(goalInstances)
      .values(instance)
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
