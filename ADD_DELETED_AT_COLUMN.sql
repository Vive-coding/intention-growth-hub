-- Quick fix: Add deleted_at column to chat_threads table
-- Run this in Railway's PostgreSQL console

ALTER TABLE chat_threads 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_threads' 
AND column_name = 'deleted_at';

