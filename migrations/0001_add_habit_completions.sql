CREATE TABLE "habit_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_suggested_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "suggested_habits"("id") ON DELETE CASCADE;
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE; 