import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table (updated for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"), // For local authentication
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: varchar("onboarding_step", { length: 50 }).default("welcome"),
  firstGoalCreated: boolean("first_goal_created").default(false),
  firstChatSession: boolean("first_chat_session").default(false),
  timezone: varchar("timezone"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userOnboardingProfiles = pgTable("user_onboarding_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  goalSettingAbility: varchar("goal_setting_ability"),
  habitBuildingAbility: varchar("habit_building_ability"),
  coachingStyle: text("coaching_style").array(),
  focusLifeMetrics: text("focus_life_metrics").array(),
  coachPersonality: varchar("coach_personality"),
  notificationEnabled: boolean("notification_enabled").default(false),
  notificationFrequency: varchar("notification_frequency"),
  preferredNotificationTime: varchar("preferred_notification_time"),
  phoneNumber: varchar("phone_number"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  focusGoalLimit: integer("focus_goal_limit"),
}, (table) => ({
  userUnique: uniqueIndex("user_onboarding_profiles_user_id_idx").on(table.userId),
}));

// Life metric definitions
export const lifeMetricDefinitions = pgTable("life_metric_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 50 }).notNull(), // hex color for UI
  // Simple time availability signal for agent budgeting: none | very_little | some | plenty
  timeAvailability: varchar("time_availability", { length: 20 }).default("some"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Goal definitions (templates)
export const goalDefinitions = pgTable("goal_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // Links to life metric areas
  lifeMetricId: uuid("life_metric_id").references(() => lifeMetricDefinitions.id), // Direct reference to life metric
  unit: varchar("unit", { length: 50 }), // minutes, hours, count, etc.
  isActive: boolean("is_active").default(true),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Goal instances (active goals with targets)
export const goalInstances = pgTable("goal_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  goalDefinitionId: uuid("goal_definition_id").notNull().references(() => goalDefinitions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").default(0), // Manual adjustment offset (can be negative)
  startDate: timestamp("start_date").defaultNow(),
  targetDate: timestamp("target_date"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, paused, cancelled, archived
  monthYear: varchar("month_year", { length: 7 }), // "2025-07" format for monthly tracking
  completedAt: timestamp("completed_at"), // when the goal was completed
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Journal entries
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  entryDate: timestamp("entry_date").defaultNow(),
  mood: varchar("mood", { length: 50 }), // optional mood tracking
  tags: text("tags").array(), // array of tags for categorization
  isPrivate: boolean("is_private").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insights table
export const insights = pgTable("insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  explanation: text("explanation").notNull(),
  confidence: integer("confidence").notNull(),
  themes: text("themes").array().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insight to Life Metrics relationship
export const insightLifeMetrics = pgTable("insight_life_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  insightId: uuid("insight_id").notNull().references(() => insights.id),
  lifeMetricId: uuid("life_metric_id").notNull().references(() => lifeMetricDefinitions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insight votes
export const insightVotes = pgTable("insight_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  insightId: uuid("insight_id").notNull().references(() => insights.id),
  userId: varchar("user_id").notNull(),
  isUpvote: boolean("is_upvote").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suggested goals
export const suggestedGoals = pgTable("suggested_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  insightId: uuid("insight_id").notNull().references(() => insights.id),
  lifeMetricId: uuid("life_metric_id").notNull().references(() => lifeMetricDefinitions.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suggested habits
export const suggestedHabits = pgTable("suggested_habits", {
  id: uuid("id").defaultRandom().primaryKey(),
  insightId: uuid("insight_id").notNull().references(() => insights.id),
  lifeMetricId: uuid("life_metric_id").notNull().references(() => lifeMetricDefinitions.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  targetFrequency: varchar("target_frequency", { length: 20 }).default("daily"), // daily, weekly, monthly
  targetCount: integer("target_count").default(1), // how many times per frequency period
  archived: boolean("archived").default(false).notNull(),
  isHighLeverage: boolean("is_high_leverage").default(false), // Can serve multiple goal types
  applicableGoalTypes: text("applicable_goal_types").array(), // ['career', 'health', 'personal']
  noveltyScore: integer("novelty_score"), // 1-10: How unique/creative
  impactScore: integer("impact_score"), // 1-10: Potential for meaningful improvement
  actionabilityScore: integer("actionability_score"), // 1-10: How clear and doable
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suggested goal-habit relationships (links habits to specific goals)
export const suggestedGoalHabits = pgTable("suggested_goal_habits", {
  id: uuid("id").defaultRandom().primaryKey(),
  suggestedGoalId: uuid("suggested_goal_id").notNull().references(() => suggestedGoals.id, { onDelete: "cascade" }),
  suggestedHabitId: uuid("suggested_habit_id").notNull().references(() => suggestedHabits.id, { onDelete: "cascade" }),
  priority: integer("priority").default(1), // 1=essential, 2=helpful, 3=optional
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Feedback events (append-only)
export const feedbackEvents = pgTable("feedback_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 40 }).notNull(), // insight | smart_suggestion | suggested_goal | suggested_habit
  itemId: varchar("item_id", { length: 255 }).notNull(),
  action: varchar("action", { length: 40 }).notNull(), // upvote | downvote | accept | dismiss | ignore
  context: jsonb("context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Aggregated acceptance metrics
export const acceptanceMetrics = pgTable("agent_acceptance_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 40 }).notNull(),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  windowMonth: varchar("window_month", { length: 7 }).notNull(), // YYYY-MM
  impressions: integer("impressions").default(0).notNull(),
  accepts: integer("accepts").default(0).notNull(),
  dismisses: integer("dismisses").default(0).notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  ignores: integer("ignores").default(0).notNull(),
  acceptanceRate: integer("acceptance_rate").default(0).notNull(), // 0-100
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Suggestion memory for cooldowns
export const suggestionMemory = pgTable("suggestion_memory", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conceptHash: varchar("concept_hash", { length: 64 }).notNull(),
  type: varchar("type", { length: 40 }).notNull(), // insight | suggested_goal | suggested_habit
  itemId: varchar("item_id", { length: 255 }),
  lastShownAt: timestamp("last_shown_at").defaultNow().notNull(),
  lastAppliedAt: timestamp("last_applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// My Focus: priority snapshots (immutable history)
export const myFocusPrioritySnapshots = pgTable("my_focus_priority_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull(), // [{ goalInstanceId: string, rank: number, reason?: string }]
  sourceThreadId: uuid("source_thread_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// My Focus: optimization proposals (append-only with status)
export const myFocusOptimizations = pgTable("my_focus_optimizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  summary: text("summary"),
  recommendations: jsonb("recommendations").notNull(), // [{ type: 'archive'|'modify'|'add', title, description, targetId? }]
  status: varchar("status", { length: 20 }).default("open").notNull(), // open | applied | dismissed
  sourceThreadId: uuid("source_thread_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Habit definitions (global habits)
export const habitDefinitions = pgTable("habit_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // "Fitness", "Nutrition", etc.
  globalCompletions: integer("global_completions").default(0),
  globalStreak: integer("global_streak").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Habit instances (habits within goals)
export const habitInstances = pgTable("habit_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  habitDefinitionId: uuid("habit_definition_id").notNull().references(() => habitDefinitions.id, { onDelete: "cascade" }),
  goalInstanceId: uuid("goal_instance_id").notNull().references(() => goalInstances.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetValue: integer("target_value").notNull(), // How many times needed for this goal
  currentValue: integer("current_value").default(0), // How many times completed for this goal
  goalSpecificStreak: integer("goal_specific_streak").default(0), // Streak for this specific goal
  frequencySettings: jsonb("frequency_settings"), // Store frequency breakdown: {frequency, perPeriodTarget, periodsCount}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Habit completions (for tracking completions)
export const habitCompletions = pgTable("habit_completions", {
  id: uuid("id").defaultRandom().primaryKey(),
  habitDefinitionId: uuid("habit_definition_id").references(() => habitDefinitions.id, { onDelete: "cascade" }),
  habitId: uuid("habit_id").references(() => suggestedHabits.id, { onDelete: "cascade" }), // Legacy reference
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"), // Optional notes about the completion
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Progress snapshots for historical tracking
export const progressSnapshots = pgTable("progress_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lifeMetricName: varchar("life_metric_name", { length: 100 }).notNull(),
  monthYear: varchar("month_year", { length: 7 }).notNull(), // "2025-07"
  progressPercentage: integer("progress_percentage").notNull(),
  goalsCompleted: integer("goals_completed").notNull(),
  totalGoals: integer("total_goals").notNull(),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat threads: one row per conversation
export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  summary: text("summary"),
  isTest: boolean("is_test").default(false).notNull(),
  privacyScope: jsonb("privacy_scope"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages: one row per message within a thread
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: uuid("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant | system
  content: text("content").notNull(),
  status: varchar("status", { length: 20 }).default("complete").notNull(), // streaming | complete | error
  toolCalls: jsonb("tool_calls"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cached context snapshots (optional)
export const chatContextSnapshots = pgTable("chat_context_snapshots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id").references(() => chatThreads.id, { onDelete: "cascade" }),
  profileCapsule: jsonb("profile_capsule"),
  workingSet: jsonb("working_set"),
  ragContext: jsonb("rag_context"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification followups
export const notificationFollowups = pgTable("notification_followups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  subject: text("subject"),
  previewText: text("preview_text"),
  payload: jsonb("payload"),
  ctaPath: varchar("cta_path", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  sentAt: timestamp("sent_at"),
  usedAt: timestamp("used_at"),
  threadId: uuid("thread_id").references(() => chatThreads.id),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  lifeMetrics: many(lifeMetricDefinitions),
  goalDefinitions: many(goalDefinitions),
  goalInstances: many(goalInstances),
  journalEntries: many(journalEntries),
  onboardingProfile: one(userOnboardingProfiles, {
    fields: [users.id],
    references: [userOnboardingProfiles.userId],
  }),
  notificationFollowups: many(notificationFollowups),
}));

export const lifeMetricDefinitionsRelations = relations(lifeMetricDefinitions, ({ one }) => ({
  user: one(users, {
    fields: [lifeMetricDefinitions.userId],
    references: [users.id],
  }),
}));

export const goalDefinitionsRelations = relations(goalDefinitions, ({ one, many }) => ({
  user: one(users, {
    fields: [goalDefinitions.userId],
    references: [users.id],
  }),
  instances: many(goalInstances),
}));

export const goalInstancesRelations = relations(goalInstances, ({ one, many }) => ({
  definition: one(goalDefinitions, {
    fields: [goalInstances.goalDefinitionId],
    references: [goalDefinitions.id],
  }),
  user: one(users, {
    fields: [goalInstances.userId],
    references: [users.id],
  }),
  habitInstances: many(habitInstances),
}));

export const userOnboardingProfilesRelations = relations(userOnboardingProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userOnboardingProfiles.userId],
    references: [users.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  user: one(users, {
    fields: [journalEntries.userId],
    references: [users.id],
  }),
}));

export const insightsRelations = relations(insights, ({ many }) => ({
  lifeMetrics: many(insightLifeMetrics),
  votes: many(insightVotes),
  suggestedGoals: many(suggestedGoals),
  suggestedHabits: many(suggestedHabits),
}));

export const insightLifeMetricsRelations = relations(insightLifeMetrics, ({ one }) => ({
  insight: one(insights, {
    fields: [insightLifeMetrics.insightId],
    references: [insights.id],
  }),
  lifeMetric: one(lifeMetricDefinitions, {
    fields: [insightLifeMetrics.lifeMetricId],
    references: [lifeMetricDefinitions.id],
  }),
}));

export const insightVotesRelations = relations(insightVotes, ({ one }) => ({
  insight: one(insights, {
    fields: [insightVotes.insightId],
    references: [insights.id],
  }),
}));

export const suggestedGoalsRelations = relations(suggestedGoals, ({ one, many }) => ({
  insight: one(insights, {
    fields: [suggestedGoals.insightId],
    references: [insights.id],
  }),
  lifeMetric: one(lifeMetricDefinitions, {
    fields: [suggestedGoals.lifeMetricId],
    references: [lifeMetricDefinitions.id],
  }),
  habitLinks: many(suggestedGoalHabits),
}));

export const suggestedHabitsRelations = relations(suggestedHabits, ({ one, many }) => ({
  insight: one(insights, {
    fields: [suggestedHabits.insightId],
    references: [insights.id],
  }),
  lifeMetric: one(lifeMetricDefinitions, {
    fields: [suggestedHabits.lifeMetricId],
    references: [lifeMetricDefinitions.id],
  }),
  completions: many(habitCompletions),
  goalLinks: many(suggestedGoalHabits),
}));

export const suggestedGoalHabitsRelations = relations(suggestedGoalHabits, ({ one }) => ({
  suggestedGoal: one(suggestedGoals, {
    fields: [suggestedGoalHabits.suggestedGoalId],
    references: [suggestedGoals.id],
  }),
  suggestedHabit: one(suggestedHabits, {
    fields: [suggestedGoalHabits.suggestedHabitId],
    references: [suggestedHabits.id],
  }),
}));

export const habitCompletionsRelations = relations(habitCompletions, ({ one }) => ({
  habitDefinition: one(habitDefinitions, {
    fields: [habitCompletions.habitDefinitionId],
    references: [habitDefinitions.id],
  }),
  user: one(users, {
    fields: [habitCompletions.userId],
    references: [users.id],
  }),
}));

export const habitDefinitionsRelations = relations(habitDefinitions, ({ one, many }) => ({
  user: one(users, {
    fields: [habitDefinitions.userId],
    references: [users.id],
  }),
  habitInstances: many(habitInstances),
  completions: many(habitCompletions),
}));

export const habitInstancesRelations = relations(habitInstances, ({ one }) => ({
  habitDefinition: one(habitDefinitions, {
    fields: [habitInstances.habitDefinitionId],
    references: [habitDefinitions.id],
  }),
  goalInstance: one(goalInstances, {
    fields: [habitInstances.goalInstanceId],
    references: [goalInstances.id],
  }),
  user: one(users, {
    fields: [habitInstances.userId],
    references: [users.id],
  }),
}));

// Chat relations
export const chatThreadsRelations = relations(chatThreads, ({ one }) => ({
  user: one(users, {
    fields: [chatThreads.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [chatMessages.threadId],
    references: [chatThreads.id],
  }),
}));

// Types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Life metrics with progress calculation
export interface LifeMetricWithProgress extends LifeMetricDefinition {
  progress: number;
  completedGoals: number;
  totalGoals: number;
  averageProgress: number;
}

// Types for life metrics
export type LifeMetricDefinition = typeof lifeMetricDefinitions.$inferSelect;
export type InsertLifeMetricDefinition = typeof lifeMetricDefinitions.$inferInsert;

// Types for goals
export type GoalDefinition = typeof goalDefinitions.$inferSelect;
export type InsertGoalDefinition = typeof goalDefinitions.$inferInsert;
export type GoalInstance = typeof goalInstances.$inferSelect;
export type InsertGoalInstance = typeof goalInstances.$inferInsert;

// Types for journal entries
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

// Types
export type Insight = typeof insights.$inferSelect;
export type InsertInsight = typeof insights.$inferInsert;
export type InsightVote = typeof insightVotes.$inferSelect;
export type SuggestedGoal = typeof suggestedGoals.$inferSelect;
export type SuggestedHabit = typeof suggestedHabits.$inferSelect;
export type HabitDefinition = typeof habitDefinitions.$inferSelect;
export type InsertHabitDefinition = typeof habitDefinitions.$inferInsert;
export type HabitInstance = typeof habitInstances.$inferSelect;
export type InsertHabitInstance = typeof habitInstances.$inferInsert;
export type HabitCompletion = typeof habitCompletions.$inferSelect;
export type InsertHabitCompletion = typeof habitCompletions.$inferInsert;

export type UserOnboardingProfile = typeof userOnboardingProfiles.$inferSelect;
export type InsertUserOnboardingProfile = typeof userOnboardingProfiles.$inferInsert;

export type ProgressSnapshot = typeof progressSnapshots.$inferSelect;
export type InsertProgressSnapshot = typeof progressSnapshots.$inferInsert;

// Types for chat
export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = typeof chatThreads.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Insert schemas
export const insertLifeMetricDefinitionSchema = createInsertSchema(lifeMetricDefinitions).omit({
  id: true,
  createdAt: true,
});

export const insertGoalDefinitionSchema = createInsertSchema(goalDefinitions).omit({
  id: true,
  createdAt: true,
});

export const insertGoalInstanceSchema = createInsertSchema(goalInstances).omit({
  id: true,
  createdAt: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
