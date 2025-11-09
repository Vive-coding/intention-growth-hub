CREATE TABLE IF NOT EXISTS "user_onboarding_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "goal_setting_ability" varchar,
  "habit_building_ability" varchar,
  "coaching_style" text[],
  "focus_life_metrics" text[],
  "notification_enabled" boolean DEFAULT false,
  "notification_frequency" varchar,
  "preferred_notification_time" varchar,
  "phone_number" varchar,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_onboarding_profiles_user_id_idx"
  ON "user_onboarding_profiles" ("user_id");

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "onboarding_step" varchar DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS "first_goal_created" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "first_chat_session" boolean DEFAULT false;

