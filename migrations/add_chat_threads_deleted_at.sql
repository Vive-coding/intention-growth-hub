-- Add deleted_at column to chat_threads table for soft delete functionality
-- This migration adds the column that was added to the schema but not to existing databases

ALTER TABLE "chat_threads"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_threads'
AND column_name = 'deleted_at';

