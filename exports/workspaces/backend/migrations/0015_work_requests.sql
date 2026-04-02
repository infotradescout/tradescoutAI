CREATE TABLE IF NOT EXISTS "work_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_by_user_id" varchar NOT NULL,
  "title" varchar NOT NULL,
  "description" text NOT NULL,
  "category" varchar,
  "county_fips" varchar(5),
  "state_code" varchar(2),
  "address_id" varchar,
  "scope" varchar NOT NULL DEFAULT 'community',
  "source" varchar NOT NULL DEFAULT 'tasks',
  "source_ref_id" varchar,
  "status" varchar NOT NULL DEFAULT 'draft',
  "visibility" varchar NOT NULL DEFAULT 'community',
  "exposure_mode" varchar NOT NULL DEFAULT 'guided',
  "competition_mode" varchar NOT NULL DEFAULT 'none',
  "budget_min" numeric,
  "budget_max" numeric,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_request_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_request_id" varchar NOT NULL,
  "type" varchar NOT NULL,
  "actor_user_id" varchar,
  "from_status" varchar,
  "to_status" varchar,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_request_assignments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "work_request_id" varchar NOT NULL,
  "contractor_id" varchar,
  "status" varchar NOT NULL DEFAULT 'suggested',
  "score_snapshot" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
