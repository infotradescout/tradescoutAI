-- HomeScout abuse handling: report listings for review/takedown.

CREATE TABLE IF NOT EXISTS "home_scout_listing_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" varchar NOT NULL REFERENCES "home_scout_listings"("id") ON DELETE CASCADE,
  "reporter_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" varchar(64) NOT NULL,
  "message" text,
  "status" varchar(16) NOT NULL DEFAULT 'open',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "closed_at" timestamp,
  "closed_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_homescout_reports_listing"
  ON "home_scout_listing_reports" ("listing_id");

CREATE INDEX IF NOT EXISTS "idx_homescout_reports_status_created"
  ON "home_scout_listing_reports" ("status", "created_at" DESC);
