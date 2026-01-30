-- Add model selection fields to users and chat_threads tables

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "preferred_model" varchar(50),
  ADD COLUMN IF NOT EXISTS "is_premium" boolean DEFAULT false NOT NULL;

ALTER TABLE "chat_threads"
  ADD COLUMN IF NOT EXISTS "model" varchar(50);

-- Set existing threads to 'gpt-5-mini' for backward compatibility
UPDATE "chat_threads"
SET "model" = 'gpt-5-mini'
WHERE "model" IS NULL;
