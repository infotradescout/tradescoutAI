-- Commercial directory projects + bidding + campaign landing pages
-- Admin creates projects with scope docs; verified contractors can bid.

CREATE TABLE IF NOT EXISTS "commercial_projects" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_by_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,

  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "state_code" varchar(2) NOT NULL REFERENCES "states"("code") ON DELETE RESTRICT,

  "title" varchar(220) NOT NULL,
  "slug" varchar(260) NOT NULL UNIQUE,
  "summary" text NOT NULL,
  "scope_of_work" text NOT NULL,
  "requirements" text NOT NULL,

  "budget_min" numeric(14, 2),
  "budget_max" numeric(14, 2),
  "bid_due_at" timestamptz,
  "project_start_at" timestamptz,

  "status" varchar(24) NOT NULL DEFAULT 'open', -- draft | open | closed | awarded | archived
  "winning_bid_id" varchar,

  -- Campaign/landing metadata (read-only to public)
  "campaign_enabled" boolean NOT NULL DEFAULT false,
  "campaign_headline" varchar(220),
  "campaign_body" text,
  "hero_image_url" varchar(500),
  "published_at" timestamptz,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_commercial_projects_county_status"
  ON "commercial_projects" ("county_fips", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_commercial_projects_slug"
  ON "commercial_projects" ("slug");

CREATE TABLE IF NOT EXISTS "commercial_project_documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar NOT NULL REFERENCES "commercial_projects"("id") ON DELETE CASCADE,
  "uploaded_by_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "file_name" varchar(255) NOT NULL,
  "file_url" varchar(600) NOT NULL,
  "mime_type" varchar(120),
  "file_size_bytes" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_commercial_project_documents_project"
  ON "commercial_project_documents" ("project_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "commercial_project_bids" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar NOT NULL REFERENCES "commercial_projects"("id") ON DELETE CASCADE,
  "contractor_id" varchar NOT NULL REFERENCES "contractors"("id") ON DELETE RESTRICT,
  "bidder_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,

  "amount" numeric(14, 2) NOT NULL,
  "timeline_days" integer,
  "proposal" text NOT NULL,

  "status" varchar(24) NOT NULL DEFAULT 'submitted', -- submitted | shortlisted | accepted | rejected | withdrawn
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_commercial_project_bid_per_contractor"
  ON "commercial_project_bids" ("project_id", "contractor_id");

CREATE INDEX IF NOT EXISTS "idx_commercial_project_bids_project_status"
  ON "commercial_project_bids" ("project_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_commercial_project_bids_bidder"
  ON "commercial_project_bids" ("bidder_user_id", "created_at" DESC);

-- Back-reference once bids table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_commercial_projects_winning_bid'
  ) THEN
    ALTER TABLE "commercial_projects"
      ADD CONSTRAINT "fk_commercial_projects_winning_bid"
      FOREIGN KEY ("winning_bid_id") REFERENCES "commercial_project_bids"("id") ON DELETE SET NULL;
  END IF;
END $$;
