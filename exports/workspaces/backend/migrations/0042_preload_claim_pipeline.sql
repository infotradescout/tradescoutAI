-- Preload + claim pipeline foundation
-- Adds explicit claim status/sources on businesses and a staging table for safe CSV imports.

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "claim_status" varchar(32) NOT NULL DEFAULT 'unclaimed';

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "sources" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "businesses"
SET "claim_status" = CASE
  WHEN "owner_user_id" IS NULL THEN 'unclaimed'
  ELSE 'claimed'
END
WHERE "claim_status" IS NULL OR "claim_status" = '';

CREATE INDEX IF NOT EXISTS "business_claim_status_idx" ON "businesses" ("claim_status");
CREATE INDEX IF NOT EXISTS "business_sources_gin_idx" ON "businesses" USING gin ("sources");

CREATE TABLE IF NOT EXISTS "listing_import_staging" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" varchar(64) NOT NULL,
  "source" varchar(64) NOT NULL,
  "external_id" varchar,
  "name" varchar(255) NOT NULL,
  "normalized_name" varchar(255) NOT NULL,
  "phone" varchar(64),
  "email" varchar(255),
  "website" varchar(512),
  "state_code" varchar(2),
  "county_fips" varchar(5),
  "county_name" varchar(128),
  "lat" numeric(9, 6),
  "lng" numeric(9, 6),
  "trade_categories" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "dedupe_key" varchar(255) NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "merged_business_id" varchar,
  "merge_notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "listing_import_staging_batch_idx"
  ON "listing_import_staging" ("batch_id");

CREATE INDEX IF NOT EXISTS "listing_import_staging_status_idx"
  ON "listing_import_staging" ("status");

CREATE INDEX IF NOT EXISTS "listing_import_staging_dedupe_idx"
  ON "listing_import_staging" ("dedupe_key");

CREATE UNIQUE INDEX IF NOT EXISTS "listing_import_staging_batch_external_idx"
  ON "listing_import_staging" ("batch_id", "source", "external_id");
