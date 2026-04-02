-- HomeScout canonical property listings (separate from Exchange marketplace_listings).
-- Contact remains gated elsewhere (Intent -> Decision Card -> Contact).

CREATE TABLE IF NOT EXISTS "home_scout_listings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source attribution / dedupe (for ingestion pipelines)
  "source_key" varchar(64) NOT NULL DEFAULT 'manual',
  "source_listing_id" varchar(128),
  "dedupe_key" varchar(160),

  -- Lifecycle / moderation
  "status" varchar(32) NOT NULL DEFAULT 'pending_review', -- pending_review | active | sold | rented | removed | inactive
  "approved_at" timestamptz,
  "approved_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,

  -- Core listing fields
  "title" varchar(200) NOT NULL,
  "description" text,
  "price" numeric(12, 2) NOT NULL,
  "price_previous" numeric(12, 2),
  "price_changed_at" timestamptz,
  "listed_at" timestamptz,
  "off_market_at" timestamptz,

  -- Property facts
  "property_type" varchar(32) NOT NULL DEFAULT 'house', -- house | condo | townhouse | land | commercial | multifamily
  "beds" integer,
  "baths" numeric(4, 1),
  "sqft" integer,
  "lot_sqft" integer,
  "year_built" integer,
  "features" jsonb,

  -- Location (county is the operational container)
  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "state_code" varchar(2) NOT NULL REFERENCES "states"("code") ON DELETE RESTRICT,
  "city" varchar(100),
  "zip_code" varchar(10),
  "address_1" varchar(255),
  "address_2" varchar(255),
  "address_visibility" varchar(16) NOT NULL DEFAULT 'exact', -- exact | approximate
  "latitude" numeric(9, 6),
  "longitude" numeric(9, 6),

  -- Media
  "photos" jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Ownership/contact mapping (used for gated messaging)
  "seller_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "agent_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "contact_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_homescout_source_listing"
  ON "home_scout_listings" ("source_key", "source_listing_id")
  WHERE "source_listing_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_homescout_county_status"
  ON "home_scout_listings" ("county_fips", "status");

CREATE INDEX IF NOT EXISTS "idx_homescout_county_price"
  ON "home_scout_listings" ("county_fips", "status", "price");

CREATE INDEX IF NOT EXISTS "idx_homescout_county_listed_at"
  ON "home_scout_listings" ("county_fips", "status", "listed_at");

