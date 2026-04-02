-- Shared rate limiting buckets (multi-instance safe).
-- Used by express-rate-limit Postgres store implementation.

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "bucket_key" text PRIMARY KEY,
  "hits" integer NOT NULL DEFAULT 0,
  "reset_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_rate_limit_buckets_reset_at"
  ON "rate_limit_buckets" ("reset_at");

