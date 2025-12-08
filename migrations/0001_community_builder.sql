-- Community Builder + County Vault schema migration
-- Applies enums, vault tables, and Community Builder tables

-- Enums
DO $$ BEGIN
    CREATE TYPE "builder_rank" AS ENUM ('prospect','bronze','silver','gold','platinum','diamond');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "contribution_type" AS ENUM ('service_hours','materials','equipment_rental','financial','expertise','promotion','administration');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "contribution_status" AS ENUM ('proposed','pending_approval','approved','in_progress','completed','verified','disputed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "vault_source_type" AS ENUM ('foundation_donation','marketplace_fee_share','contractor_fee_share','subscription_share','sponsorship','corporate_match','manual_adjustment','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- County vaults
CREATE TABLE IF NOT EXISTS "county_vaults" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "county_id" varchar NOT NULL REFERENCES "counties"("id"),
    "current_balance" numeric(14,2) NOT NULL DEFAULT '0',
    "lifetime_inflow" numeric(14,2) NOT NULL DEFAULT '0',
    "lifetime_outflow" numeric(14,2) NOT NULL DEFAULT '0',
    "last_contribution_at" timestamp,
    "last_updated" timestamp DEFAULT now(),
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "county_vaults_county_uidx" ON "county_vaults" ("county_id");
CREATE INDEX IF NOT EXISTS "county_vaults_county_idx" ON "county_vaults" ("county_id");

-- Vault ledger entries (immutable)
CREATE TABLE IF NOT EXISTS "vault_ledger_entries" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "vault_id" varchar NOT NULL REFERENCES "county_vaults"("id"),
    "source_type" "vault_source_type" NOT NULL,
    "source_id" varchar,
    "amount" numeric(14,2) NOT NULL,
    "memo" text,
    "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "vault_ledger_vault_idx" ON "vault_ledger_entries" ("vault_id");
CREATE INDEX IF NOT EXISTS "vault_ledger_created_idx" ON "vault_ledger_entries" ("created_at");

-- Community Builder profiles
CREATE TABLE IF NOT EXISTS "community_builder_profiles" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
    "county_id" varchar NOT NULL REFERENCES "counties"("id"),
    "business_name" varchar,
    "description" text,
    "profile_image_url" varchar,
    "website" varchar,
    "current_rank" "builder_rank" NOT NULL DEFAULT 'prospect',
    "total_contribution_value" numeric(14,2) NOT NULL DEFAULT '0',
    "total_hours_donated" numeric(12,2) NOT NULL DEFAULT '0',
    "active_contributions_count" integer NOT NULL DEFAULT 0,
    "completed_contributions_count" integer NOT NULL DEFAULT 0,
    "rating_score" numeric(3,2) DEFAULT '0',
    "rating_count" integer NOT NULL DEFAULT 0,
    "verification_rate" numeric(5,2) DEFAULT '100',
    "bank_account_id" varchar,
    "payout_email" varchar,
    "payout_frequency" varchar DEFAULT 'monthly',
    "last_payout_at" timestamp,
    "is_program_member" boolean DEFAULT true,
    "program_joined_at" timestamp DEFAULT now(),
    "is_verified" boolean DEFAULT false,
    "verification_submitted_at" timestamp,
    "verification_approved_at" timestamp,
    "status" varchar NOT NULL DEFAULT 'active',
    "suspension_reason" text,
    "suspended_at" timestamp,
    "preferences" jsonb,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "builder_profile_user_uidx" ON "community_builder_profiles" ("user_id");
CREATE INDEX IF NOT EXISTS "builder_profile_county_idx" ON "community_builder_profiles" ("county_id");
CREATE INDEX IF NOT EXISTS "builder_profile_rank_idx" ON "community_builder_profiles" ("current_rank");
CREATE INDEX IF NOT EXISTS "builder_profile_status_idx" ON "community_builder_profiles" ("status");

-- Builder contributions
CREATE TABLE IF NOT EXISTS "builder_contributions" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "builder_id" varchar NOT NULL REFERENCES "community_builder_profiles"("id") ON DELETE CASCADE,
    "county_id" varchar NOT NULL REFERENCES "counties"("id"),
    "title" varchar NOT NULL,
    "description" text NOT NULL,
    "type" "contribution_type" NOT NULL,
    "status" "contribution_status" NOT NULL DEFAULT 'proposed',
    "estimated_value" numeric(12,2) NOT NULL,
    "estimated_hours" numeric(10,2),
    "actual_value" numeric(12,2),
    "actual_hours" numeric(10,2),
    "proposed_start_date" timestamp,
    "proposed_end_date" timestamp,
    "actual_start_date" timestamp,
    "actual_end_date" timestamp,
    "approved_by" varchar REFERENCES "users"("id"),
    "approved_at" timestamp,
    "verified_by" varchar REFERENCES "users"("id"),
    "verified_at" timestamp,
    "evidence" jsonb,
    "is_paid_out" boolean DEFAULT false,
    "paid_out_amount" numeric(12,2),
    "paid_out_at" timestamp,
    "paid_out_to_vault" boolean DEFAULT true,
    "is_disputed" boolean DEFAULT false,
    "dispute_reason" text,
    "dispute_resolved_at" timestamp,
    "dispute_resolution" text,
    "tags" text[],
    "impact" text,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "builder_contrib_builder_idx" ON "builder_contributions" ("builder_id");
CREATE INDEX IF NOT EXISTS "builder_contrib_county_idx" ON "builder_contributions" ("county_id");
CREATE INDEX IF NOT EXISTS "builder_contrib_status_idx" ON "builder_contributions" ("status");
CREATE INDEX IF NOT EXISTS "builder_contrib_created_idx" ON "builder_contributions" ("created_at");

-- Builder audit logs (immutable trail)
CREATE TABLE IF NOT EXISTS "builder_audit_logs" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "contribution_id" varchar NOT NULL REFERENCES "builder_contributions"("id") ON DELETE CASCADE,
    "auditor_id" varchar NOT NULL REFERENCES "users"("id"),
    "action" varchar NOT NULL,
    "original_value" numeric(12,2),
    "adjusted_value" numeric(12,2),
    "adjustment_reason" text,
    "notes" text,
    "supporting_documents" jsonb,
    "changed_fields" jsonb,
    "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "builder_audit_contribution_idx" ON "builder_audit_logs" ("contribution_id");
CREATE INDEX IF NOT EXISTS "builder_audit_auditor_idx" ON "builder_audit_logs" ("auditor_id");
CREATE INDEX IF NOT EXISTS "builder_audit_action_idx" ON "builder_audit_logs" ("action");

-- Builder payouts
CREATE TABLE IF NOT EXISTS "builder_payouts" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "builder_id" varchar NOT NULL REFERENCES "community_builder_profiles"("id") ON DELETE CASCADE,
    "county_id" varchar NOT NULL REFERENCES "counties"("id"),
    "amount" numeric(14,2) NOT NULL,
    "currency" varchar DEFAULT 'USD',
    "payout_type" varchar NOT NULL,
    "related_contribution_ids" text[],
    "status" varchar NOT NULL DEFAULT 'pending',
    "processing_method" varchar,
    "scheduled_for" timestamp,
    "processed_at" timestamp,
    "external_payment_id" varchar,
    "transaction_id" varchar,
    "failure_reason" text,
    "resolved_at" timestamp,
    "created_by" varchar REFERENCES "users"("id"),
    "approved_by" varchar REFERENCES "users"("id"),
    "approved_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "builder_payout_builder_idx" ON "builder_payouts" ("builder_id");
CREATE INDEX IF NOT EXISTS "builder_payout_county_idx" ON "builder_payouts" ("county_id");
CREATE INDEX IF NOT EXISTS "builder_payout_status_idx" ON "builder_payouts" ("status");
CREATE INDEX IF NOT EXISTS "builder_payout_created_idx" ON "builder_payouts" ("created_at");

-- Builder leaderboard (denormalized)
CREATE TABLE IF NOT EXISTS "builder_leaderboard" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "builder_id" varchar NOT NULL UNIQUE REFERENCES "community_builder_profiles"("id") ON DELETE CASCADE,
    "county_id" varchar NOT NULL REFERENCES "counties"("id"),
    "total_contribution_value" numeric(14,2) NOT NULL DEFAULT '0',
    "total_hours_donated" numeric(12,2) NOT NULL DEFAULT '0',
    "completed_contributions" integer NOT NULL DEFAULT 0,
    "value_rank" integer,
    "hours_rank" integer,
    "overall_rank" integer,
    "monthly_rank" integer,
    "yearly_rank" integer,
    "performance_score" numeric(5,2) DEFAULT '0',
    "trust_score" numeric(5,2) DEFAULT '100',
    "last_updated" timestamp DEFAULT now(),
    "period_start" timestamp,
    "period_end" timestamp
);

-- Builder referrals
CREATE TABLE IF NOT EXISTS "builder_referrals" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "referrer_id" varchar NOT NULL REFERENCES "community_builder_profiles"("id") ON DELETE CASCADE,
    "referred_builder_id" varchar NOT NULL REFERENCES "community_builder_profiles"("id") ON DELETE CASCADE,
    "referral_code" varchar UNIQUE,
    "bonus_amount" numeric(12,2) DEFAULT '0',
    "status" varchar NOT NULL DEFAULT 'pending',
    "earned_at" timestamp,
    "paid_out_at" timestamp,
    "created_at" timestamp DEFAULT now()
);

-- Builder notifications
CREATE TABLE IF NOT EXISTS "builder_notifications" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "builder_id" varchar NOT NULL REFERENCES "community_builder_profiles"("id") ON DELETE CASCADE,
    "type" varchar NOT NULL,
    "title" varchar NOT NULL,
    "message" text,
    "related_id" varchar,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp,
    "action_url" varchar,
    "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "builder_notif_builder_idx" ON "builder_notifications" ("builder_id");
CREATE INDEX IF NOT EXISTS "builder_notif_read_idx" ON "builder_notifications" ("is_read");
