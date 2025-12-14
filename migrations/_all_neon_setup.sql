-- TradeScout: Combined Neon setup (run once)
-- Includes migrations 0000 → 0004 in order
-- Safe to run multiple times (uses IF NOT EXISTS and duplicate guards)

-- =========================
-- 0000_wild_saracen.sql
-- =========================
DO $$ BEGIN CREATE TYPE "public"."address_verification_status" AS ENUM('pending','submitted','approved','rejected','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."content_type" AS ENUM('marketplace_listing','handmade_product','community_post','post_comment','product_review','user_profile','seller_profile','conversation_message'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."donation_status" AS ENUM('pending','processing','completed','failed','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."donation_type" AS ENUM('one_time','roundup','recurring'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."invitation_status" AS ENUM('pending','accepted','declined','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."invitation_type" AS ENUM('email','referral_code','direct_link'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."report_reason" AS ENUM('spam','harassment','inappropriate_content','fraud','fake_listing','wrong_category','duplicate_content','price_manipulation','offensive_language','copyright_violation','privacy_violation','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."transaction_status" AS ENUM('pending','payment_processing','payment_confirmed','in_escrow','shipped','delivered','completed','cancelled','disputed','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."user_role" AS ENUM('homeowner','contractor_user','accelerator_member','realtor','car_salesman','moderator','ops_admin','head_admin','territory_manager','contractor_success','content_seo','analytics_read','support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."verification_status" AS ENUM('pending','under_review','approved','rejected','expired','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."vote_type" AS ENUM('remove','keep','needs_review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NOTE: The original 0000 file contains many CREATE TABLE statements.
-- For brevity, only core dependencies needed by later migrations are included below.
-- Ensure your Neon already has base tables like users, counties, contractors as per 0000.

CREATE TABLE IF NOT EXISTS "counties" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar NOT NULL,
    "fips" varchar(5) NOT NULL,
    "state_code" varchar(2) NOT NULL,
    "population" integer,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "counties_fips_unique" UNIQUE("fips")
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" varchar,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contractors" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" varchar,
    "company_name" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "contractors_slug_unique" UNIQUE("slug")
);

-- =========================
-- 0001_community_builder.sql
-- =========================
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

CREATE TABLE IF NOT EXISTS "community_builder_profiles" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
    "county_id" varchar NOT NULL REFERENCES "counties"("id"),
    "business_name" varchar,
    "description" text,
    "current_rank" "builder_rank" NOT NULL DEFAULT 'prospect',
    "total_contribution_value" numeric(14,2) NOT NULL DEFAULT '0',
    "total_hours_donated" numeric(12,2) NOT NULL DEFAULT '0',
    "status" varchar NOT NULL DEFAULT 'active',
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "builder_profile_user_uidx" ON "community_builder_profiles" ("user_id");

-- =========================
-- 0002_add_user_badges.sql
-- =========================
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "badges" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- =========================
-- 0003_business_profiles.sql
-- =========================
DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('contractor', 'community', 'vendor', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE business_status AS ENUM ('draft', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS businesses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  type business_type NOT NULL DEFAULT 'other',
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_context user_role NOT NULL,
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status business_status NOT NULL DEFAULT 'draft',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_owner_idx ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS business_role_ctx_idx ON businesses(role_context);
CREATE INDEX IF NOT EXISTS business_status_idx ON businesses(status);

CREATE TABLE IF NOT EXISTS business_counties (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  county_id varchar NOT NULL REFERENCES counties(id),
  created_at timestamp DEFAULT now(),
  CONSTRAINT business_county_unique UNIQUE (business_id, county_id)
);

CREATE INDEX IF NOT EXISTS business_counties_business_idx ON business_counties(business_id);
CREATE INDEX IF NOT EXISTS business_counties_county_idx ON business_counties(county_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_business_id varchar;

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS business_id varchar;

-- =========================
-- 0004_profiles.sql (CRITICAL)
-- =========================
DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar REFERENCES businesses(id) ON DELETE SET NULL,
  role_context user_role NOT NULL,
  slug varchar NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  headline varchar,
  content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status profile_status NOT NULL DEFAULT 'draft',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_owner_idx ON profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS profile_business_idx ON profiles(business_id);
CREATE INDEX IF NOT EXISTS profile_role_ctx_idx ON profiles(role_context);
CREATE INDEX IF NOT EXISTS profile_status_idx ON profiles(status);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_profile_id varchar;
