-- Add trade_id to work_requests for Direct Connect routing

ALTER TABLE "work_requests"
ADD COLUMN IF NOT EXISTS "trade_id" varchar NULL;

CREATE INDEX IF NOT EXISTS "work_requests_trade_id_idx" ON "work_requests" ("trade_id");
