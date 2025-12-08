-- Add badges column to users for manual and automatic recognitions
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "badges" jsonb NOT NULL DEFAULT '[]'::jsonb;
