// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.ts";

console.log("Current DATABASE_URL:", process.env.DATABASE_URL);
console.log("All env variables:", process.env);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection
const client = postgres(process.env.DATABASE_URL);

// Create the database instance with schema
export const db = drizzle(client, { schema });

// Idempotently ensure optional columns that newer code paths rely on
export async function ensureUsersTimezoneColumn(): Promise<void> {
  try {
    // Safe on Postgres: adds the column only if it's missing
    await client`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" varchar`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add timezone', e);
  }
  try {
    await client`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_step" varchar(50) DEFAULT 'welcome'`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add onboarding_step', e);
  }
  try {
    await client`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_goal_created" boolean DEFAULT false`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add first_goal_created', e);
  }
  try {
    await client`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_chat_session" boolean DEFAULT false`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add first_chat_session', e);
  }
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "user_onboarding_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "goal_setting_ability" varchar,
        "habit_building_ability" varchar,
        "coaching_style" text[],
        "focus_life_metrics" text[],
        "coach_personality" varchar,
        "notification_enabled" boolean DEFAULT false,
        "notification_frequency" varchar,
        "preferred_notification_time" varchar,
        "phone_number" varchar,
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    await client`CREATE UNIQUE INDEX IF NOT EXISTS "user_onboarding_profiles_user_id_idx" ON "user_onboarding_profiles" ("user_id")`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed ensuring user_onboarding_profiles table', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "coach_personality" varchar`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add coach_personality', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "notification_enabled" boolean DEFAULT false`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add notification_enabled', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "notification_frequency" varchar`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add notification_frequency', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "preferred_notification_time" varchar`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add preferred_notification_time', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "phone_number" varchar`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add phone_number', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "completed_at" timestamp`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add completed_at', e);
  }
  try {
    await client`ALTER TABLE "user_onboarding_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`;
  } catch (e) {
    console.warn('ensureUsersTimezoneColumn failed to add updated_at', e);
  }
}

// Idempotently ensure feedback-related tables exist (when migrations haven't been applied)
export async function ensureFeedbackTables(): Promise<void> {
  try {
    await client`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
  } catch {}
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "feedback_events" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" varchar NOT NULL,
        "type" varchar(40) NOT NULL,
        "item_id" varchar(255) NOT NULL,
        "action" varchar(40) NOT NULL,
        "context" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
  } catch (e) {
    console.warn('ensureFeedbackTables: failed to create feedback_events', e);
  }

  // Suggestion memory for cooldowns
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "suggestion_memory" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" varchar NOT NULL,
        "concept_hash" varchar(64) NOT NULL,
        "type" varchar(40) NOT NULL,
        "item_id" varchar(255),
        "last_shown_at" timestamp DEFAULT now() NOT NULL,
        "last_applied_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
  } catch (e) {
    console.warn('ensureFeedbackTables: failed to create suggestion_memory', e);
  }
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "agent_acceptance_metrics" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" varchar NOT NULL,
        "type" varchar(40) NOT NULL,
        "metric_name" varchar(100) NOT NULL,
        "window_month" varchar(7) NOT NULL,
        "impressions" integer DEFAULT 0 NOT NULL,
        "accepts" integer DEFAULT 0 NOT NULL,
        "dismisses" integer DEFAULT 0 NOT NULL,
        "upvotes" integer DEFAULT 0 NOT NULL,
        "downvotes" integer DEFAULT 0 NOT NULL,
        "ignores" integer DEFAULT 0 NOT NULL,
        "acceptance_rate" integer DEFAULT 0 NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
  } catch (e) {
    console.warn('ensureFeedbackTables: failed to create agent_acceptance_metrics', e);
  }

  // Idempotently add time_availability to life_metric_definitions
  try {
    await client`ALTER TABLE "life_metric_definitions" ADD COLUMN IF NOT EXISTS "time_availability" varchar(20) DEFAULT 'some'`;
  } catch (e) {
    console.warn('ensureFeedbackTables: failed to add time_availability', e);
  }
}

// Idempotently ensure chat tables exist (safe additive bootstrap)
export async function ensureChatTables(): Promise<void> {
  try { await client`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`; } catch {}
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "chat_threads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(255),
        "summary" text,
        "is_test" boolean DEFAULT false NOT NULL,
        "privacy_scope" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
  } catch (e) {
    console.warn('ensureChatTables: failed to create chat_threads', e);
  }
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "thread_id" uuid NOT NULL REFERENCES "chat_threads"("id") ON DELETE CASCADE,
        "role" varchar(20) NOT NULL,
        "content" text NOT NULL,
        "status" varchar(20) DEFAULT 'complete' NOT NULL,
        "tool_calls" jsonb,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
      )
    `;
  } catch (e) {
    console.warn('ensureChatTables: failed to create chat_messages', e);
  }
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "chat_context_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "thread_id" uuid REFERENCES "chat_threads"("id") ON DELETE CASCADE,
        "profile_capsule" jsonb,
        "working_set" jsonb,
        "rag_context" jsonb,
        "created_at" timestamp DEFAULT now()
      )
    `;
  } catch (e) {
    console.warn('ensureChatTables: failed to create chat_context_snapshots', e);
  }
}