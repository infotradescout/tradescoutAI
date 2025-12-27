-- XP total per user (fast reads)
CREATE TABLE IF NOT EXISTS "user_xp" (
  "user_id" varchar PRIMARY KEY,
  "xp_total" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Append-only ledger (auditable)
CREATE TABLE IF NOT EXISTS "xp_ledger" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "delta" int NOT NULL CHECK ("delta" >= 0),
  "reason" text NOT NULL,
  "source_event_id" varchar,
  "day_key_utc" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "xp_ledger_user_id_idx" ON "xp_ledger"("user_id");
CREATE INDEX IF NOT EXISTS "xp_ledger_day_idx" ON "xp_ledger"("day_key_utc");
CREATE INDEX IF NOT EXISTS "xp_ledger_reason_idx" ON "xp_ledger"("reason");

-- Daily counters for caps (per cap_key)
CREATE TABLE IF NOT EXISTS "xp_daily_counters" (
  "user_id" varchar NOT NULL,
  "day_key_utc" text NOT NULL,
  "cap_key" text NOT NULL,
  "count" int NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "day_key_utc", "cap_key")
);

-- Daily unique constraints for "unique per day" awards
CREATE TABLE IF NOT EXISTS "xp_daily_uniques" (
  "user_id" varchar NOT NULL,
  "day_key_utc" text NOT NULL,
  "event_type" text NOT NULL,
  "unique_key" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "day_key_utc", "event_type", "unique_key")
);

-- updated_at trigger for user_xp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_xp_set_updated_at ON "user_xp";
CREATE TRIGGER user_xp_set_updated_at
BEFORE UPDATE ON "user_xp"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
