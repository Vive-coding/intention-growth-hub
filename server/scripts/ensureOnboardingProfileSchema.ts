import "dotenv/config";

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || process.argv[2];

if (!connectionString) {
  console.error("❌ DATABASE_URL not provided. Set env or pass as first argument.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function ensureOnboardingSchema() {
  console.log("🔄 Connecting to database...");

  try {
    await sql.begin(async (trx) => {
      console.log("🔧 Ensuring pgcrypto extension...");
      await trx`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

      console.log("🔧 Ensuring onboarding columns on users table...");
      await trx`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "onboarding_step" varchar(50) DEFAULT 'welcome',
        ADD COLUMN IF NOT EXISTS "first_goal_created" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "first_chat_session" boolean DEFAULT false
      `;

      console.log("🔧 Ensuring user_onboarding_profiles table...");
      await trx`
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

      console.log("🔧 Ensuring unique index on user_onboarding_profiles.user_id...");
      await trx`
        CREATE UNIQUE INDEX IF NOT EXISTS "user_onboarding_profiles_user_id_idx"
        ON "user_onboarding_profiles" ("user_id")
      `;
    });

    console.log("✅ Onboarding schema ensured successfully.");
  } catch (error) {
    console.error("❌ Failed to ensure onboarding schema:", error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

ensureOnboardingSchema();

