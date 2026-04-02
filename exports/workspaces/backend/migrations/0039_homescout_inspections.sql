-- HomeScout inspections + service follow-up (P1 foundation)
-- Enables:
-- - Seller inspection report uploads
-- - Buyer inspection requests and buyer-uploaded reports
-- - Service requests from report findings (routed via work requests)

CREATE TABLE IF NOT EXISTS "home_scout_inspection_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" varchar NOT NULL REFERENCES "home_scout_listings"("id") ON DELETE CASCADE,
  "requester_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" varchar(16) NOT NULL DEFAULT 'open', -- open | fulfilled | cancelled
  "request_message" text NOT NULL,
  "preferred_window" varchar(120),
  "fulfilled_at" timestamptz,
  "cancelled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_requests_listing_status"
  ON "home_scout_inspection_requests" ("listing_id", "status");

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_requests_requester"
  ON "home_scout_inspection_requests" ("requester_user_id");

CREATE TABLE IF NOT EXISTS "home_scout_inspection_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" varchar NOT NULL REFERENCES "home_scout_listings"("id") ON DELETE CASCADE,
  "submitted_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "report_type" varchar(32) NOT NULL DEFAULT 'other', -- seller_pre_listing | buyer_independent | municipal | other
  "inspection_date" date,
  "inspector_name" varchar(140),
  "inspector_company" varchar(140),
  "inspector_license" varchar(80),
  "summary" text,
  "highlights" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "report_url" varchar(500) NOT NULL,
  "source_request_id" varchar REFERENCES "home_scout_inspection_requests"("id") ON DELETE SET NULL,
  "visibility" varchar(16) NOT NULL DEFAULT 'public', -- public | private
  "status" varchar(16) NOT NULL DEFAULT 'published', -- published | removed
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_reports_listing_visibility"
  ON "home_scout_inspection_reports" ("listing_id", "visibility", "status");

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_reports_submitter"
  ON "home_scout_inspection_reports" ("submitted_by_user_id");

CREATE TABLE IF NOT EXISTS "home_scout_inspection_service_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" varchar NOT NULL REFERENCES "home_scout_inspection_reports"("id") ON DELETE CASCADE,
  "listing_id" varchar NOT NULL REFERENCES "home_scout_listings"("id") ON DELETE CASCADE,
  "requester_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "state_code" varchar(2) NOT NULL REFERENCES "states"("code") ON DELETE RESTRICT,
  "service_category" varchar(64) NOT NULL,
  "service_description" text NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'open', -- open | routed | in_progress | completed | cancelled
  "work_request_id" varchar REFERENCES "work_requests"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_service_requests_report"
  ON "home_scout_inspection_service_requests" ("report_id");

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_service_requests_requester"
  ON "home_scout_inspection_service_requests" ("requester_user_id");

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_service_requests_status"
  ON "home_scout_inspection_service_requests" ("status");

CREATE INDEX IF NOT EXISTS "idx_homescout_inspection_service_requests_county"
  ON "home_scout_inspection_service_requests" ("county_fips", "state_code");

