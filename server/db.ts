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
    console.warn("ensureUsersTimezoneColumn failed", e);
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

export async function ensureNotificationTables(): Promise<void> {
  try { await client`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`; } catch {}
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "notification_followups" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" varchar(64) NOT NULL UNIQUE,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "subject" text,
        "preview_text" text,
        "payload" jsonb,
        "cta_path" varchar(255),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp NOT NULL,
        "sent_at" timestamp,
        "used_at" timestamp,
        "thread_id" uuid REFERENCES "chat_threads"("id")
      )
    `;
  } catch (e) {
    console.warn('ensureNotificationTables: failed to create notification_followups', e);
  }
  try {
    await client`CREATE INDEX IF NOT EXISTS notification_followups_user_status_idx ON "notification_followups" ("user_id", "status")`;
  } catch (e) {
    console.warn('ensureNotificationTables: failed to create user_status index', e);
  }
}

export async function ensureOnboardingProfileColumns(): Promise<void> {
  try { await client`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`; } catch {}
  try {
    await client`
      ALTER TABLE "user_onboarding_profiles"
      ADD COLUMN IF NOT EXISTS "focus_goal_limit" integer
    `;
  } catch (e) {
    console.warn('ensureOnboardingProfileColumns: failed to add focus_goal_limit', e);
  }
}