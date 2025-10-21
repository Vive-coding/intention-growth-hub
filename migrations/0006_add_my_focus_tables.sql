-- Safe migration: add My Focus tables only; no alterations to existing columns

CREATE TABLE IF NOT EXISTS my_focus_priority_snapshots (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	items jsonb NOT NULL,
	source_thread_id uuid,
	created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS my_focus_optimizations (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	summary text,
	recommendations jsonb NOT NULL,
	status varchar(20) DEFAULT 'open' NOT NULL,
	source_thread_id uuid,
	created_at timestamp DEFAULT now() NOT NULL
);
