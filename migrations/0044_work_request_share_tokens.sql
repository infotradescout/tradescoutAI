-- Add share tokens for public, redacted Direct Connect request previews.
ALTER TABLE "work_requests"
ADD COLUMN IF NOT EXISTS "share_token" varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS "work_requests_share_token_key"
ON "work_requests" ("share_token")
WHERE "share_token" IS NOT NULL;
