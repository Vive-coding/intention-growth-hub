CREATE TABLE "habit_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"target_frequency" varchar(20) NOT NULL,
	"target_count" integer NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"life_metric_name" varchar(100) NOT NULL,
	"month_year" varchar(7) NOT NULL,
	"progress_percentage" integer NOT NULL,
	"goals_completed" integer NOT NULL,
	"total_goals" integer NOT NULL,
	"snapshot_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_habits" ADD COLUMN "completions_needed" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_instances" ADD COLUMN "month_year" varchar(7);--> statement-breakpoint
ALTER TABLE "goal_instances" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "suggested_habits" ADD COLUMN "target_frequency" varchar(20) DEFAULT 'daily';--> statement-breakpoint
ALTER TABLE "suggested_habits" ADD COLUMN "target_count" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "habit_targets" ADD CONSTRAINT "habit_targets_habit_id_suggested_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."suggested_habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_targets" ADD CONSTRAINT "habit_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;