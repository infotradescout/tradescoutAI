CREATE TABLE IF NOT EXISTS "trade_requirements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trade_id" varchar NOT NULL,
  "requires_license" boolean DEFAULT false,
  "requires_insurance" boolean DEFAULT false,
  "requires_ein" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "provider_declarations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_user_id" varchar NOT NULL,
  "service_areas" jsonb,
  "trade_ids" jsonb,
  "availability_flags" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "provider_local_stats" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_user_id" varchar NOT NULL,
  "county_fips" varchar(5) NOT NULL,
  "jobs_completed" integer DEFAULT 0,
  "people_helped" integer DEFAULT 0,
  "active_weeks" integer DEFAULT 0,
  "last_active_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "business_verifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_user_id" varchar NOT NULL,
  "verification_type" varchar NOT NULL,
  "jurisdiction" varchar,
  "status" varchar NOT NULL,
  "verified_at" timestamp,
  "expires_at" timestamp,
  "source" varchar,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_trade_requirements_trade" ON "trade_requirements" ("trade_id");
CREATE INDEX IF NOT EXISTS "idx_provider_declarations_user" ON "provider_declarations" ("provider_user_id");
CREATE INDEX IF NOT EXISTS "idx_provider_local_stats_user_county" ON "provider_local_stats" ("provider_user_id", "county_fips");
CREATE INDEX IF NOT EXISTS "idx_business_verifications_user" ON "business_verifications" ("provider_user_id");
CREATE INDEX IF NOT EXISTS "idx_business_verifications_type_status" ON "business_verifications" ("verification_type", "status");
