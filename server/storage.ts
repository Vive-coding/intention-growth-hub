import {
  users,
  sessions,
  lifeMetricDefinitions,
  goalDefinitions,
  goalInstances,
  journalEntries,
  insights,
  insightLifeMetrics,
  insightVotes,
  suggestedGoals,
  suggestedHabits,
  habitDefinitions,
  habitInstances,
  habitCompletions,
  progressSnapshots,
  type User,
  type UpsertUser,
  type LifeMetricDefinition,
  type LifeMetricWithProgress,
  type InsertLifeMetricDefinition,
  type GoalDefinition,
  type InsertGoalDefinition,
  type GoalInstance,
  type InsertGoalInstance,
  type JournalEntry,
  type InsertJournalEntry,
  type InsertInsight,
  type Insight,
  type SuggestedGoal,
  type SuggestedHabit,
  type HabitCompletion,
  type InsertHabitCompletion,
  type ProgressSnapshot,
  type InsertProgressSnapshot,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, gte, lte, lt, isNotNull } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: { email: string; password: string; firstName: string; lastName: string; profileImageUrl?: string; onboardingCompleted?: boolean }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  completeOnboarding(userId: string): Promise<void>;
  resetOnboarding(userId: string): Promise<void>;
  
  // Life metrics operations
  getUserLifeMetrics(userId: string): Promise<LifeMetricDefinition[]>;
  getUserLifeMetricsWithProgress(userId: string): Promise<LifeMetricWithProgress[]>;
  getMonthlyGoalCompletions(userId: string, lifeMetricName: string): Promise<{ month: string; completed: number }[]>;
  getGoalCompletionsByDateRange(userId: string, lifeMetricName: string, startDate: Date, endDate: Date): Promise<{ date: string; completed: number }[]>;
  createLifeMetric(metric: InsertLifeMetricDefinition): Promise<LifeMetricDefinition>;
  
  // Goal operations
  getUserGoals(userId: string): Promise<GoalDefinition[]>;
  getUserGoalInstances(userId: string): Promise<GoalInstance[]>;
  updateGoalProgress(goalInstanceId: string, currentValue: number): Promise<GoalInstance>;
  createGoal(goal: InsertGoalDefinition): Promise<GoalDefinition>;
  createGoalInstance(instance: InsertGoalInstance): Promise<GoalInstance>;
  
  // Journal operations
  getUserJournalEntries(userId: string, limit?: number): Promise<JournalEntry[]>;
  getJournalEntry(id: string, userId: string): Promise<JournalEntry | undefined>;
  getLatestJournalEntry(userId: string): Promise<JournalEntry | undefined>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: string, userId: string, entry: Partial<InsertJournalEntry>): Promise<JournalEntry>;
  deleteJournalEntry(id: string, userId: string): Promise<void>;
  getJournalEntriesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<JournalEntry[]>;

  // Insight operations
  getUserInsights(userId: string): Promise<Insight[]>;
  createInsight(data: InsertInsight & { lifeMetricIds: string[] }): Promise<Insight>;
  createSuggestedGoal(data: { insightId: string; lifeMetricId: string; title: string; description?: string }): Promise<SuggestedGoal>;
  createSuggestedHabit(data: { insightId: string; lifeMetricId: string; title: string; description?: string }): Promise<SuggestedHabit>;
  updateInsightConfidence(insightId: string, newConfidence: number): Promise<Insight>;
  
  // Habit completion operations
  getHabitCompletions(habitId: string, userId: string): Promise<HabitCompletion[]>;
  createHabitCompletion(data: InsertHabitCompletion): Promise<HabitCompletion>;
  getHabitStreak(habitId: string, userId: string): Promise<{ currentStreak: number; longestStreak: number }>;
  
  // Progress snapshot operations
  createProgressSnapshot(data: InsertProgressSnapshot): Promise<ProgressSnapshot>;
  getProgressSnapshots(userId: string, lifeMetricName: string, startDate: Date, endDate: Date): Promise<ProgressSnapshot[]>;
  getCurrentMonthProgress(userId: string, lifeMetricName: string): Promise<{ progress: number; goalsCompleted: number; totalGoals: number }>;
  getWeeklyProgress(userId: string, lifeMetricName: string): Promise<{ week: string; progress: number }[]>;
  getProgressForPeriod(userId: string, lifeMetricName: string, period: string): Promise<{ progress: number; goalsCompleted: number; totalGoals: number }>;
}

const mockData = {
  lifeMetrics: [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      userId: "dev-user-123",
      name: "Health & Fitness",
      description: "Physical and mental wellbeing",
      color: "#10b981",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      userId: "dev-user-123",
      name: "Career Growth",
      description: "Professional development and skills",
      color: "#3b82f6",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      userId: "dev-user-123",
      name: "Personal Development",
      description: "Learning and self-improvement",
      color: "#8b5cf6",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440004",
      userId: "dev-user-123",
      name: "Relationships",
      description: "Social connections and relationships",
      color: "#f59e0b",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440005",
      userId: "dev-user-123",
      name: "Finance",
      description: "Financial planning and investments",
      color: "#ef4444",
      isActive: true,
      createdAt: new Date(),
    },
          {
        id: "550e8400-e29b-41d4-a716-446655440006",
        userId: "dev-user-123",
        name: "Mental Health",
        description: "Emotional wellbeing and mental clarity",
        color: "#8b5cf6",
        isActive: true,
        createdAt: new Date(),
      },
  ],
  goals: [
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      userId: "dev-user-123",
      title: "Daily Exercise",
      description: "30 minutes of exercise daily",
      category: "Health & Fitness",
      unit: "minutes",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440007",
      userId: "dev-user-123",
      title: "Meditation Practice",
      description: "10 minutes of meditation daily",
      category: "Health & Fitness",
      unit: "minutes",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440008",
      userId: "dev-user-123",
      title: "Social Connections",
      description: "Connect with 3 friends weekly",
      category: "Relationships",
      unit: "connections",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440009",
      userId: "dev-user-123",
      title: "Work Efficiency",
      description: "Complete 5 tasks daily",
              category: "Mental Health",
      unit: "tasks",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440010",
      userId: "dev-user-123",
      title: "Learning Goals",
      description: "Read 2 books this quarter",
      category: "Personal Development",
      unit: "books",
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440011",
      userId: "dev-user-123",
      title: "Investment Review",
      description: "Review portfolio monthly",
      category: "Finance",
      unit: "reviews",
      isActive: true,
      createdAt: new Date(),
    },
  ],
  goalInstances: [
    {
      id: "550e8400-e29b-41d4-a716-446655440004",
      goalDefinitionId: "550e8400-e29b-41d4-a716-446655440003",
      userId: "dev-user-123",
      targetValue: 30,
      currentValue: 25,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
      createdAt: new Date(),
      monthYear: "2025-07",
      completedAt: null,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440012",
      goalDefinitionId: "550e8400-e29b-41d4-a716-446655440007",
      userId: "dev-user-123",
      targetValue: 10,
      currentValue: 8,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
      createdAt: new Date(),
      monthYear: "2025-07",
      completedAt: null,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440013",
      goalDefinitionId: "550e8400-e29b-41d4-a716-446655440008",
      userId: "dev-user-123",
      targetValue: 3,
      currentValue: 2,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
      createdAt: new Date(),
      monthYear: "2025-07",
      completedAt: null,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440014",
      goalDefinitionId: "550e8400-e29b-41d4-a716-446655440009",
      userId: "dev-user-123",
      targetValue: 5,
      currentValue: 4,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
      createdAt: new Date(),
      monthYear: "2025-07",
      completedAt: null,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440015",
      goalDefinitionId: "550e8400-e29b-41d4-a716-446655440010",
      userId: "dev-user-123",
      targetValue: 3,
      currentValue: 2,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
      createdAt: new Date(),
      monthYear: "2025-07",
      completedAt: null,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440016",
      goalDefinitionId: "550e8400-e29b-41d4-a716-446655440011",
      userId: "dev-user-123",
      targetValue: 1,
      currentValue: 0,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
      createdAt: new Date(),
      monthYear: "2025-07",
      completedAt: null,
    },
  ],
  journals: [
    {
      id: "550e8400-e29b-41d4-a716-446655440005",
      userId: "dev-user-123",
      title: "First Development Entry",
      content: "This is a sample journal entry for development.",
      entryDate: new Date(),
      mood: "Happy",
      tags: ["development", "testing"],
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async createUser(userData: { email: string; password: string; firstName: string; lastName: string; profileImageUrl?: string; onboardingCompleted?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=random`,
        onboardingCompleted: userData.onboardingCompleted || false,
        createdAt: new Date(),
        updatedAt: new Date(),
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

  async resetOnboarding(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        onboardingCompleted: false,
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
    // Get life metrics with goal progress calculations (only active goals)
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
        averageProgress: sql<number>`COALESCE(AVG(CASE WHEN ${goalInstances.status} = 'active' THEN CAST(${goalInstances.currentValue} AS FLOAT) / NULLIF(${goalInstances.targetValue}, 0) * 100 ELSE NULL END), 0)`.as('averageProgress'),
      })
      .from(lifeMetricDefinitions)
      .leftJoin(goalDefinitions, and(
        eq(goalDefinitions.userId, lifeMetricDefinitions.userId),
        eq(goalDefinitions.category, lifeMetricDefinitions.name),
        eq(goalDefinitions.isActive, true)
      ))
      .leftJoin(goalInstances, and(
        eq(goalInstances.goalDefinitionId, goalDefinitions.id)
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

  async getMonthlyGoalCompletions(userId: string, lifeMetricName: string, period: string = "Last 6 Months"): Promise<{ month: string; completed: number }[]> {
    // Get monthly completion data from database
    const completions = await db
      .select({
        month: goalInstances.monthYear,
        completed: sql<number>`COUNT(*)`.as('completed')
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalDefinitions.category, lifeMetricName),
        eq(goalInstances.status, 'completed'),
        isNotNull(goalInstances.monthYear)
      ))
      .groupBy(goalInstances.monthYear)
      .orderBy(goalInstances.monthYear);

    // Determine months based on selected period
    const allMonths = [];
    const currentDate = new Date();
    let monthsToShow = 6; // Default to 6 months

    switch (period) {
      case "This Month":
        monthsToShow = 1;
        break;
      case "Last 3 Months":
        monthsToShow = 3;
        break;
      case "Last 6 Months":
        monthsToShow = 6;
        break;
      case "This Year":
        // Show all months from January to current month
        const startMonth = 0; // January
        const endMonth = currentDate.getMonth();
        for (let month = startMonth; month <= endMonth; month++) {
          const monthYear = `${currentDate.getFullYear()}-${String(month + 1).padStart(2, '0')}`;
          allMonths.push(monthYear);
        }
        break;
      case "All Time":
        // Show last 12 months
        monthsToShow = 12;
        break;
    }

    // Generate months for non-year periods
    if (period !== "This Year") {
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        allMonths.push(monthYear);
      }
    }

    // Create a map of existing completions
    const completionMap = new Map(
      completions
        .filter(c => c.month !== null)
        .map(c => [c.month!, Number(c.completed)])
    );

    // Return all months with completions (including zeros)
    return allMonths.map(month => ({
      month,
      completed: completionMap.get(month) || 0
    }));
  }

  async getGoalCompletionsByDateRange(userId: string, lifeMetricName: string, startDate: Date, endDate: Date): Promise<{ date: string; completed: number }[]> {
    // Get daily completion data from database
    const completions = await db
      .select({
        date: sql<string>`DATE(${goalInstances.completedAt})`.as('date'),
        completed: sql<number>`COUNT(*)`.as('completed')
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalDefinitions.category, lifeMetricName),
        eq(goalInstances.status, 'completed'),
        gte(goalInstances.completedAt, startDate),
        lt(goalInstances.completedAt, endDate)
      ))
      .groupBy(sql<string>`DATE(${goalInstances.completedAt})`)
      .orderBy(sql<string>`DATE(${goalInstances.completedAt})`);

    // Generate all dates in range
    const allDates: string[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create a map of existing completions
    const completionMap = new Map(
      completions
        .filter(c => c.date !== null)
        .map(c => [c.date!, Number(c.completed)])
    );

    // Return all dates with completions (including zeros)
    return allDates.map(date => ({
      date,
      completed: completionMap.get(date) || 0
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
      .select({
        id: goalInstances.id,
        goalDefinitionId: goalInstances.goalDefinitionId,
        userId: goalInstances.userId,
        targetValue: goalInstances.targetValue,
        currentValue: goalInstances.currentValue,
        startDate: goalInstances.startDate,
        targetDate: goalInstances.targetDate,
        status: goalInstances.status,
        monthYear: goalInstances.monthYear,
        completedAt: goalInstances.completedAt,
        createdAt: goalInstances.createdAt,
        // Include goal definition data
        goalTitle: goalDefinitions.title,
        goalCategory: goalDefinitions.category,
        goalDescription: goalDefinitions.description,
        goalUnit: goalDefinitions.unit,
        goalIsActive: goalDefinitions.isActive
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
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
    const enriched: InsertGoalInstance = {
      ...instance,
      monthYear: instance.monthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    };
    const [created] = await db
      .insert(goalInstances)
      .values(enriched)
      .returning();
    return created;
  }

  async updateGoalProgress(goalInstanceId: string, desiredTotalProgress: number): Promise<GoalInstance> {
    // First, get current goal with habits to calculate habit-based progress
    const goal = await db
      .select()
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalInstances.id, goalInstanceId))
      .limit(1);

    if (!goal[0]) {
      throw new Error('Goal not found');
    }

    // Get associated habits for this goal
    const associatedHabits = await db
      .select({
        habitDefinition: habitDefinitions,
        habitInstance: habitInstances,
      })
      .from(habitInstances)
      .innerJoin(habitDefinitions, eq(habitInstances.habitDefinitionId, habitDefinitions.id))
      .where(eq(habitInstances.goalInstanceId, goalInstanceId));

    // Calculate current habit-based progress (same logic as in routes)
    let habitBasedProgress = 0;
    if (associatedHabits.length > 0) {
      let totalProgress = 0;
      
      for (const hi of associatedHabits) {
        const habitProgress = hi.habitInstance.targetValue > 0 ? 
          Math.min(((hi.habitInstance.currentValue || 0) / hi.habitInstance.targetValue) * 100, 100) : 0;
        totalProgress += habitProgress;
      }
      
      const averageProgress = totalProgress / associatedHabits.length;
      habitBasedProgress = Math.min(averageProgress, 90);
    }

    // Clamp desired total progress to UI contract: 1%..99% (100% only via manual complete)
    const clampedDesired = Math.max(1, Math.min(99, Math.round(desiredTotalProgress)));

    // Calculate the manual offset needed to achieve desired total progress
    // manualOffset = desiredTotal - habitBased
    const manualOffset = clampedDesired - habitBasedProgress;
    
    console.log('Manual progress update calculation:', {
      goalId: goalInstanceId,
      desiredTotalProgress: clampedDesired,
      habitBasedProgress,
      calculatedManualOffset: manualOffset
    });

    // Update the goal instance with the new manual offset
    const [updatedInstance] = await db
      .update(goalInstances)
      .set({ 
        currentValue: Math.round(manualOffset), // Store the manual offset
        // Do not auto-complete here; completion happens via dedicated endpoint
        status: 'active',
        completedAt: null,
      })
      .where(eq(goalInstances.id, goalInstanceId))
      .returning();
    
    return updatedInstance;
  }

  // Journal operations
  async getUserJournalEntries(userId: string, limit = 50): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.entryDate))
      .limit(limit);
  }

  async getJournalEntry(id: string, userId: string): Promise<JournalEntry | undefined> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
    return entry;
  }

  async getLatestJournalEntry(userId: string): Promise<JournalEntry | undefined> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.createdAt))
      .limit(1);
    return entry;
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const [created] = await db
      .insert(journalEntries)
      .values({
        ...entry,
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateJournalEntry(id: string, userId: string, entry: Partial<InsertJournalEntry>): Promise<JournalEntry> {
    const [updated] = await db
      .update(journalEntries)
      .set({
        ...entry,
        updatedAt: new Date(),
      })
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
      .returning();
    return updated;
  }

  async deleteJournalEntry(id: string, userId: string): Promise<void> {
    await db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
  }

  async getJournalEntriesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate)
        )
      )
      .orderBy(desc(journalEntries.entryDate));
  }

  // Insight operations
  async getUserInsights(userId: string): Promise<Insight[]> {
    return await db
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt));
  }

  async createInsight(data: InsertInsight & { lifeMetricIds: string[] }): Promise<Insight> {
    const { lifeMetricIds, ...insightData } = data;
    
    // Create insight
    const [insight] = await db.insert(insights).values(insightData).returning();

    // Create life metric associations
    if (lifeMetricIds.length > 0) {
      await db.insert(insightLifeMetrics).values(
        lifeMetricIds.map(lifeMetricId => ({
          insightId: insight.id,
          lifeMetricId,
        }))
      );
    }

    return insight;
  }

  async createSuggestedGoal(data: {
    insightId: string;
    lifeMetricId: string;
    title: string;
    description?: string;
  }): Promise<SuggestedGoal> {
    const [goal] = await db.insert(suggestedGoals).values(data).returning();
    return goal;
  }

  async createSuggestedHabit(data: {
    insightId: string;
    lifeMetricId: string;
    title: string;
    description?: string;
  }): Promise<SuggestedHabit> {
    const [habit] = await db.insert(suggestedHabits).values(data).returning();
    return habit;
  }

  async updateInsightConfidence(insightId: string, newConfidence: number): Promise<Insight> {
    const [insight] = await db
      .update(insights)
      .set({ 
        confidence: newConfidence,
        updatedAt: new Date(),
      })
      .where(eq(insights.id, insightId))
      .returning();
    return insight;
  }

  // Habit completion operations
  async getHabitCompletions(habitId: string, userId: string): Promise<HabitCompletion[]> {
    return await db
      .select()
      .from(habitCompletions)
      .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.userId, userId)));
  }

  async createHabitCompletion(data: InsertHabitCompletion): Promise<HabitCompletion> {
    const [completion] = await db
      .insert(habitCompletions)
      .values(data)
      .returning();
    return completion;
  }

  async getHabitStreak(habitId: string, userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
    const completions = await db
      .select()
      .from(habitCompletions)
      .where(and(eq(habitCompletions.habitDefinitionId, habitId), eq(habitCompletions.userId, userId)))
      .orderBy(desc(habitCompletions.completedAt));

    let currentStreak = 0;
    let longestStreak = 0;
    let lastCompletionDate: Date | null = null;

    const normalize = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };

    for (const completion of completions) {
      if (lastCompletionDate === null) {
        currentStreak = 1;
      } else {
        const daysDiff = Math.round((normalize(lastCompletionDate).getTime() - normalize(completion.completedAt).getTime()) / (1000*60*60*24));
        if (daysDiff === 1) {
          currentStreak++;
        } else if (daysDiff === 0) {
          // same calendar day, ignore
        } else {
          currentStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      lastCompletionDate = completion.completedAt;
    }

    return { currentStreak, longestStreak };
  }

  // Progress snapshot operations
  async createProgressSnapshot(data: InsertProgressSnapshot): Promise<ProgressSnapshot> {
    const [snapshot] = await db
      .insert(progressSnapshots)
      .values(data)
      .returning();
    return snapshot;
  }

  async upsertTodayProgressSnapshot(userId: string, lifeMetricName: string): Promise<void> {
    console.log('[snapshot] upsertTodayProgressSnapshot called', { userId, lifeMetricName });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Compute current progress numbers using existing helper
    const current = await this.getCurrentMonthProgress(userId, lifeMetricName);
    console.log('[snapshot] currentMonthProgress', current);
    const monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Check if a snapshot exists for today
    const existing = await db
      .select()
      .from(progressSnapshots)
      .where(and(
        eq(progressSnapshots.userId, userId),
        eq(progressSnapshots.lifeMetricName, lifeMetricName),
        gte(progressSnapshots.snapshotDate, startOfDay),
        lt(progressSnapshots.snapshotDate, endOfDay)
      ))
      .limit(1);

    console.log('[snapshot] upsert summary', {
      userId,
      lifeMetricName,
      monthYear,
      progress: current.progress,
      goalsCompleted: current.goalsCompleted,
      totalGoals: current.totalGoals,
    });

    if (existing.length > 0) {
      console.log('[snapshot] updating existing snapshot', existing[0].id);
      await db
        .update(progressSnapshots)
        .set({
          progressPercentage: current.progress,
          goalsCompleted: current.goalsCompleted,
          totalGoals: current.totalGoals,
          monthYear,
          snapshotDate: new Date(),
        })
        .where(eq(progressSnapshots.id, existing[0].id));
    } else {
      console.log('[snapshot] creating new snapshot for today');
      await this.createProgressSnapshot({
        userId,
        lifeMetricName,
        monthYear,
        progressPercentage: current.progress,
        goalsCompleted: current.goalsCompleted,
        totalGoals: current.totalGoals,
        snapshotDate: new Date(),
      });
    }

    // Prune older snapshots to keep storage lean
    try {
      await this.pruneProgressSnapshots(userId, lifeMetricName, 10);
    } catch (e) {
      console.warn('[snapshot] prune skipped', e);
    }
  }

  /**
   * Keep at most `dailyCap` snapshots for the current month (most recent first),
   * and for prior months keep only the latest snapshot per month.
   */
  async pruneProgressSnapshots(userId: string, lifeMetricName: string, dailyCap: number = 10): Promise<void> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = await db
      .select({ id: progressSnapshots.id, snapshotDate: progressSnapshots.snapshotDate, monthYear: progressSnapshots.monthYear })
      .from(progressSnapshots)
      .where(and(
        eq(progressSnapshots.userId, userId),
        eq(progressSnapshots.lifeMetricName, lifeMetricName)
      ))
      .orderBy(desc(progressSnapshots.snapshotDate));

    const toDelete: string[] = [];

    // Current month: keep most recent `dailyCap`
    let keptThisMonth = 0;
    for (const row of rows) {
      const d = new Date(row.snapshotDate as any);
      if (d >= startOfMonth) {
        keptThisMonth += 1;
        if (keptThisMonth > dailyCap && row.id) {
          toDelete.push(row.id as unknown as string);
        }
      }
    }

    // Prior months: keep only last snapshot per month
    const seenMonth: Record<string, boolean> = {};
    for (const row of rows) {
      const d = new Date(row.snapshotDate as any);
      if (d < startOfMonth) {
        const key = String(row.monthYear);
        if (seenMonth[key]) {
          if (row.id) toDelete.push(row.id as unknown as string);
        } else {
          seenMonth[key] = true; // first (most recent due to ordering) is kept
        }
      }
    }

    if (toDelete.length > 0) {
      await db.delete(progressSnapshots).where(inArray(progressSnapshots.id, toDelete as any));
      console.log('[snapshot] prune deleted', toDelete.length, 'rows for', { userId, lifeMetricName });
    }
  }

  async getProgressSnapshots(userId: string, lifeMetricName: string, startDate: Date, endDate: Date): Promise<ProgressSnapshot[]> {
    return await db
      .select()
      .from(progressSnapshots)
      .where(and(
        eq(progressSnapshots.userId, userId),
        eq(progressSnapshots.lifeMetricName, lifeMetricName),
        gte(progressSnapshots.snapshotDate, startDate),
        lte(progressSnapshots.snapshotDate, endDate)
      ))
      .orderBy(asc(progressSnapshots.snapshotDate));
  }

  async getCurrentMonthProgress(userId: string, lifeMetricName: string): Promise<{ progress: number; goalsCompleted: number; totalGoals: number }> {
    // Get the life metric by name to get its UUID
    const lifeMetric = await db
      .select()
      .from(lifeMetricDefinitions)
      .where(and(
        eq(lifeMetricDefinitions.userId, userId),
        eq(lifeMetricDefinitions.name, lifeMetricName)
      ))
      .limit(1);

    if (lifeMetric.length === 0) {
      return { progress: 0, goalsCompleted: 0, totalGoals: 0 };
    }

    const lifeMetricId = lifeMetric[0].id;

    // Get current month's goals for this metric using lifeMetricId
    const currentMonth = new Date();
    const monthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

    const goals = await db
      .select({
        gi: goalInstances,
        gd: goalDefinitions,
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalDefinitions.lifeMetricId, lifeMetricId),
        eq(goalInstances.monthYear, monthYear)
      ));

    if (goals.length === 0) {
      return { progress: 0, goalsCompleted: 0, totalGoals: 0 };
    }

    const totalGoals = goals.length;
    const goalsCompleted = goals.filter(g => g.gi.status === 'completed').length;

    // Compute per-goal progress consistent with ring: habit avg (<=90) + manual offset
    let summedProgress = 0;
    for (const g of goals) {
      const goalInstanceId = g.gi.id;
      const manualOffset = g.gi.currentValue ?? 0; // stores manual adjustment
      // Load associated habit instances for this goal
      const associatedHabits = await db
        .select({ hi: habitInstances })
        .from(habitInstances)
        .where(eq(habitInstances.goalInstanceId, goalInstanceId));

      let habitBased = 0;
      if (associatedHabits.length > 0) {
        let totalPct = 0;
        for (const row of associatedHabits) {
          const target = row.hi.targetValue ?? 0;
          const cur = row.hi.currentValue ?? 0;
          const pct = target > 0 ? Math.min((cur / target) * 100, 100) : 0;
          totalPct += pct;
        }
        habitBased = Math.min(90, totalPct / associatedHabits.length);
      }

      const combined = g.gi.status === 'completed'
        ? 100
        : Math.max(0, Math.min(100, habitBased + manualOffset));
      summedProgress += combined;
    }

    const averageProgress = summedProgress / totalGoals;

    return {
      progress: Math.round(averageProgress),
      goalsCompleted,
      totalGoals,
    };
  }

    async getWeeklyProgress(userId: string, lifeMetricName: string): Promise<{ week: string; progress: number }[]> {
    // Get current month's active goals for this metric
    const currentDate = new Date();
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const currentGoals = await db
      .select({
        id: goalInstances.id,
        currentValue: goalInstances.currentValue,
        targetValue: goalInstances.targetValue,
        status: goalInstances.status
      })
      .from(goalInstances)
      .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(and(
        eq(goalInstances.userId, userId),
        eq(goalDefinitions.category, lifeMetricName),
        eq(goalInstances.status, 'active'),
        eq(goalInstances.monthYear, currentMonthYear)
      ));

    if (currentGoals.length === 0) {
      return [{ week: "Week 1", progress: 0 }];
    }

    // Calculate current overall progress
    const totalProgress = currentGoals.reduce((sum: number, goal: any) => {
      const currentValue = goal.currentValue ?? 0;
      const progress = (currentValue / goal.targetValue) * 100;
      return sum + Math.min(progress, 100);
    }, 0);
    const averageProgress = Math.round(totalProgress / currentGoals.length);

    // Generate weekly progression leading to current progress
    const weeksInMonth = Math.ceil(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() / 7);
    const weeklyData = [];
    
    for (let week = 1; week <= weeksInMonth; week++) {
      // Progressive increase leading to current average progress
      const weekProgress = Math.round((averageProgress * week) / weeksInMonth);
      weeklyData.push({
        week: `Week ${week}`,
        progress: Math.min(weekProgress, averageProgress)
      });
    }

    return weeklyData;
  }

  async getProgressForPeriod(userId: string, lifeMetricName: string, period: string): Promise<{ progress: number; goalsCompleted: number; totalGoals: number }> {
    if (period === "This Month") {
      return this.getCurrentMonthProgress(userId, lifeMetricName);
    } else {
      // For historical periods, calculate average progress of goals in that period
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
          startDate = new Date(2020, 0, 1); // Arbitrary start date
          break;
        default:
          return this.getCurrentMonthProgress(userId, lifeMetricName);
      }
      
      // Get all goal instances for this metric in the period
      const periodInstances = await db
        .select({
          id: goalInstances.id,
          currentValue: goalInstances.currentValue,
          targetValue: goalInstances.targetValue,
          status: goalInstances.status,
          monthYear: goalInstances.monthYear
        })
        .from(goalInstances)
        .innerJoin(goalDefinitions, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
        .where(and(
          eq(goalInstances.userId, userId),
          eq(goalDefinitions.category, lifeMetricName),
          gte(goalInstances.monthYear, startDate.toISOString().slice(0, 7)),
          lte(goalInstances.monthYear, endDate.toISOString().slice(0, 7))
        ));

      if (periodInstances.length === 0) {
        return { progress: 0, goalsCompleted: 0, totalGoals: 0 };
      }

      // Calculate average progress of all goals in the period
      const totalProgress = periodInstances.reduce((sum: number, instance: any) => {
        const currentValue = instance.currentValue ?? 0;
        const progress = (currentValue / instance.targetValue) * 100;
        return sum + Math.min(progress, 100);
      }, 0);

      const averageProgress = totalProgress / periodInstances.length;
      const completedGoals = periodInstances.filter((gi: any) => gi.status === 'completed').length;
      
      return {
        progress: Math.round(averageProgress),
        goalsCompleted: completedGoals,
        totalGoals: periodInstances.length
      };
    }
  }
}

// Export storage instance
export const storage = new DatabaseStorage();

// Export additional functions
export async function getUserLifeMetricsWithProgress(userId: string): Promise<LifeMetricWithProgress[]> {
  // Get all life metrics for the user
  const metrics = await db.query.lifeMetricDefinitions.findMany({
    where: eq(lifeMetricDefinitions.userId, userId),
  });

  // Get all goal instances for the user with their definitions
  const userGoalInstances: Array<GoalInstance & { definition: GoalDefinition }> = await db.query.goalInstances.findMany({
    where: eq(goalInstances.userId, userId),
    with: {
      definition: true,
    },
  });

  // Calculate progress for each metric using lifeMetricId
  return metrics.map((metric: LifeMetricDefinition) => {
    const metricGoals = userGoalInstances.filter(
      instance => instance.definition.lifeMetricId === metric.id
    );

    const totalGoals = metricGoals.length;
    const completedGoals = metricGoals.filter(
      instance => instance.status === "completed"
    ).length;

    const totalProgress = metricGoals.reduce((sum, instance) => {
      const currentValue = instance.currentValue ?? 0;
      const targetValue = instance.targetValue ?? 1;
      const goalProgress = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
      return sum + Math.min(goalProgress, 100);
    }, 0);

    const averageProgress = totalGoals > 0 ? totalProgress / totalGoals : 0;

    return {
      ...metric,
      progress: Math.min(100, Math.round(averageProgress)),
      completedGoals,
      totalGoals,
      averageProgress: Math.round(averageProgress),
    };
  });
}
