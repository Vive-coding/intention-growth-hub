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
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Life metric definitions
export const lifeMetricDefinitions = pgTable("life_metric_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 50 }).notNull(), // hex color for UI
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
  unit: varchar("unit", { length: 50 }), // minutes, hours, count, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Goal instances (active goals with targets)
export const goalInstances = pgTable("goal_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  goalDefinitionId: uuid("goal_definition_id").notNull().references(() => goalDefinitions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").default(0),
  startDate: timestamp("start_date").defaultNow(),
  targetDate: timestamp("target_date"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, paused, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  lifeMetrics: many(lifeMetricDefinitions),
  goalDefinitions: many(goalDefinitions),
  goalInstances: many(goalInstances),
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

export const goalInstancesRelations = relations(goalInstances, ({ one }) => ({
  definition: one(goalDefinitions, {
    fields: [goalInstances.goalDefinitionId],
    references: [goalDefinitions.id],
  }),
  user: one(users, {
    fields: [goalInstances.userId],
    references: [users.id],
  }),
}));

// Types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Types for life metrics
export type LifeMetricDefinition = typeof lifeMetricDefinitions.$inferSelect;
export type InsertLifeMetricDefinition = typeof lifeMetricDefinitions.$inferInsert;

// Types for goals
export type GoalDefinition = typeof goalDefinitions.$inferSelect;
export type InsertGoalDefinition = typeof goalDefinitions.$inferInsert;
export type GoalInstance = typeof goalInstances.$inferSelect;
export type InsertGoalInstance = typeof goalInstances.$inferInsert;

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
