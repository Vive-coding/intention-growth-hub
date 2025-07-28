import {
  users,
  lifeMetricDefinitions,
  goalDefinitions,
  goalInstances,
  type User,
  type UpsertUser,
  type LifeMetricDefinition,
  type LifeMetricWithProgress,
  type InsertLifeMetricDefinition,
  type GoalDefinition,
  type InsertGoalDefinition,
  type GoalInstance,
  type InsertGoalInstance,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  completeOnboarding(userId: string): Promise<void>;
  
  // Life metrics operations
  getUserLifeMetrics(userId: string): Promise<LifeMetricDefinition[]>;
  getUserLifeMetricsWithProgress(userId: string): Promise<LifeMetricWithProgress[]>;
  createLifeMetric(metric: InsertLifeMetricDefinition): Promise<LifeMetricDefinition>;
  
  // Goal operations
  getUserGoals(userId: string): Promise<GoalDefinition[]>;
  getUserGoalInstances(userId: string): Promise<GoalInstance[]>;
  updateGoalProgress(goalInstanceId: string, currentValue: number): Promise<GoalInstance>;
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

  async getUserLifeMetricsWithProgress(userId: string): Promise<LifeMetricWithProgress[]> {
    // Get life metrics with goal progress calculations
    const metrics = await db
      .select({
        id: lifeMetricDefinitions.id,
        userId: lifeMetricDefinitions.userId,
        name: lifeMetricDefinitions.name,
        description: lifeMetricDefinitions.description,
        color: lifeMetricDefinitions.color,
        isActive: lifeMetricDefinitions.isActive,
        createdAt: lifeMetricDefinitions.createdAt,
        totalGoals: sql<number>`COUNT(DISTINCT ${goalDefinitions.id})`.as('totalGoals'),
        completedGoals: sql<number>`COUNT(DISTINCT CASE WHEN ${goalInstances.status} = 'completed' THEN ${goalInstances.id} END)`.as('completedGoals'),
        averageProgress: sql<number>`COALESCE(AVG(CAST(${goalInstances.currentValue} AS FLOAT) / NULLIF(${goalInstances.targetValue}, 0) * 100), 0)`.as('averageProgress'),
      })
      .from(lifeMetricDefinitions)
      .leftJoin(goalDefinitions, and(
        eq(goalDefinitions.userId, lifeMetricDefinitions.userId),
        eq(goalDefinitions.category, lifeMetricDefinitions.name),
        eq(goalDefinitions.isActive, true)
      ))
      .leftJoin(goalInstances, and(
        eq(goalInstances.goalDefinitionId, goalDefinitions.id),
        eq(goalInstances.status, 'active')
      ))
      .where(and(
        eq(lifeMetricDefinitions.userId, userId),
        eq(lifeMetricDefinitions.isActive, true)
      ))
      .groupBy(lifeMetricDefinitions.id);

    // Transform to LifeMetricWithProgress format
    return metrics.map(metric => ({
      ...metric,
      progress: Math.min(Math.round(metric.averageProgress), 100),
      totalGoals: Number(metric.totalGoals),
      completedGoals: Number(metric.completedGoals),
      averageProgress: Number(metric.averageProgress),
    }));
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

  async updateGoalProgress(goalInstanceId: string, currentValue: number): Promise<GoalInstance> {
    const [updatedInstance] = await db
      .update(goalInstances)
      .set({ 
        currentValue: currentValue,
        status: sql`CASE 
          WHEN ${currentValue} >= target_value THEN 'completed'
          ELSE 'active'
        END`,
      })
      .where(eq(goalInstances.id, goalInstanceId))
      .returning();
    return updatedInstance;
  }
}

export const storage = new DatabaseStorage();
