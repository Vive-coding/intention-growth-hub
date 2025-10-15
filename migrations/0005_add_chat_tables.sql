CREATE TABLE IF NOT EXISTS "chat_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255),
  "summary" text,
  "is_test" boolean DEFAULT false NOT NULL,
  "privacy_scope" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "chat_threads"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "status" varchar(20) DEFAULT 'complete' NOT NULL,
  "tool_calls" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_context_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "thread_id" uuid REFERENCES "chat_threads"("id") ON DELETE CASCADE,
  "profile_capsule" jsonb,
  "working_set" jsonb,
  "rag_context" jsonb,
  "created_at" timestamp DEFAULT now()
);

