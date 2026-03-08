DO $$ BEGIN CREATE TYPE "public"."address_verification_status" AS ENUM('pending', 'submitted', 'approved', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."content_type" AS ENUM('marketplace_listing', 'handmade_product', 'community_post', 'post_comment', 'product_review', 'user_profile', 'seller_profile', 'conversation_message'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."donation_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."donation_type" AS ENUM('one_time', 'roundup', 'recurring'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invitation_type" AS ENUM('email', 'referral_code', 'direct_link'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'inappropriate_content', 'fraud', 'fake_listing', 'wrong_category', 'duplicate_content', 'price_manipulation', 'offensive_language', 'copyright_violation', 'privacy_violation', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'payment_processing', 'payment_confirmed', 'in_escrow', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."user_role" AS ENUM('homeowner', 'contractor_user', 'accelerator_member', 'realtor', 'car_salesman', 'moderator', 'ops_admin', 'head_admin', 'territory_manager', 'contractor_success', 'content_seo', 'analytics_read', 'support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."verification_status" AS ENUM('pending', 'under_review', 'approved', 'rejected', 'expired', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."vote_type" AS ENUM('remove', 'keep', 'needs_review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE "accelerator_memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"purchase_amount" numeric NOT NULL,
	"payment_intent_id" varchar,
	"status" varchar DEFAULT 'active',
	"features" jsonb,
	"purchased_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "address_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"full_address" text NOT NULL,
	"city" varchar NOT NULL,
	"state" varchar NOT NULL,
	"zip_code" varchar NOT NULL,
	"verification_method" varchar,
	"document_url" varchar,
	"document_type" varchar,
	"postcard_code" varchar(6),
	"postcard_sent_at" timestamp,
	"postcard_verified_at" timestamp,
	"phone_number" varchar,
	"phone_verification_code" varchar(6),
	"phone_verified_at" timestamp,
	"status" "address_verification_status" DEFAULT 'pending',
	"submitted_at" timestamp,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"approved_at" timestamp,
	"rejection_reason" text,
	"admin_notes" text,
	"deadline" timestamp NOT NULL,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_sent" timestamp,
	"address_validated" boolean DEFAULT false,
	"address_validation_provider" varchar,
	"address_validation_response" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advertisements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"image_url" varchar,
	"link_url" varchar,
	"placement" varchar NOT NULL,
	"target_audience" varchar DEFAULT 'all',
	"target_location" varchar DEFAULT 'national' NOT NULL,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_affiliate" boolean DEFAULT false,
	"start_date" timestamp,
	"end_date" timestamp,
	"click_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "buyer_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"identity_document_type" varchar,
	"identity_document_url" varchar,
	"identity_verified" boolean DEFAULT false,
	"is_over_18" boolean DEFAULT false,
	"is_over_21" boolean DEFAULT false,
	"address_verified" boolean DEFAULT false,
	"status" varchar DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "car_salesman_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"dealership_name" varchar NOT NULL,
	"dealer_license" varchar NOT NULL,
	"salesman_license" varchar,
	"specializations" jsonb,
	"years_experience" integer,
	"vehicles_sold" integer DEFAULT 0,
	"average_vehicle_value" numeric,
	"brands_specialty" jsonb,
	"service_areas" jsonb,
	"license_state" varchar NOT NULL,
	"license_expiration" timestamp,
	"verification_status" "verification_status" DEFAULT 'pending',
	"verification_documents" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"slug" varchar NOT NULL,
	"image_url" varchar,
	"banner_url" varchar,
	"scope" varchar DEFAULT 'county',
	"state_code" varchar(2),
	"county_fips" varchar(5),
	"city_name" varchar,
	"region_name" varchar,
	"is_private" boolean DEFAULT false,
	"requires_approval" boolean DEFAULT false,
	"allow_post_approval" boolean DEFAULT false,
	"member_count" integer DEFAULT 0,
	"post_count" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "community_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" varchar NOT NULL,
	"title" varchar(200),
	"content" text NOT NULL,
	"image_urls" text[],
	"attachment_urls" text[],
	"scope" varchar DEFAULT 'county',
	"state_code" varchar(2),
	"county_fips" varchar(5),
	"city_name" varchar,
	"region_name" varchar,
	"category" varchar DEFAULT 'general',
	"tags" text[],
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"is_published" boolean DEFAULT true,
	"is_pinned" boolean DEFAULT false,
	"is_hidden" boolean DEFAULT false,
	"moderator_notes" text,
	"moderated_by" varchar,
	"moderated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractor_counties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"county_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractor_leaderboard_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"monthly_recommendations" integer DEFAULT 0,
	"lifetime_recommendations" integer DEFAULT 0,
	"monthly_rating" numeric(3, 2),
	"lifetime_rating" numeric(3, 2),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractor_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homeowner_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"lead_id" varchar,
	"quote_id" varchar,
	"service_description" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"payment_method" varchar NOT NULL,
	"is_off_platform" boolean DEFAULT false,
	"off_platform_method" varchar,
	"off_platform_notes" text,
	"platform_fee_amount" numeric(10, 2) DEFAULT '0',
	"processing_fee_amount" numeric(10, 2) DEFAULT '0',
	"homeowner_fee_share" numeric(10, 2) DEFAULT '0',
	"contractor_fee_share" numeric(10, 2) DEFAULT '0',
	"net_amount_to_contractor" numeric(10, 2),
	"stripe_payment_intent_id" varchar,
	"stripe_transfer_id" varchar,
	"status" varchar DEFAULT 'pending',
	"has_escrow" boolean DEFAULT false,
	"escrow_release_conditions" text,
	"milestones" jsonb,
	"service_completed_at" timestamp,
	"homeowner_confirmed_at" timestamp,
	"contractor_confirmed_at" timestamp,
	"invoice_number" varchar,
	"receipt_url" varchar,
	"work_photos" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contractor_promos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"offer_details" text NOT NULL,
	"discount_type" varchar NOT NULL,
	"discount_value" numeric(10, 2),
	"minimum_job_value" numeric(10, 2),
	"promo_code" varchar(20),
	"is_active" boolean DEFAULT true,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0,
	"service_areas" jsonb,
	"trade_categories" jsonb,
	"starts_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"slug" varchar NOT NULL,
	"view_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"lead_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_promos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contractor_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"setting" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractor_trades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"trade_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"company_name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"phone" varchar,
	"email" varchar,
	"website" varchar,
	"years_in_business" integer,
	"license_number" varchar,
	"insurance_doc_url" varchar,
	"about" text,
	"photos" jsonb,
	"min_job_size" numeric,
	"availability_window" varchar,
	"pricing_notes" text,
	"response_time_sla" integer,
	"is_general_contractor" boolean DEFAULT false,
	"is_residential_contractor" boolean DEFAULT false,
	"accepts_subcontract_work" boolean DEFAULT false,
	"verified_licensed" boolean DEFAULT false,
	"verified_insured" boolean DEFAULT false,
	"last_verified" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homeowner_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"lead_id" varchar,
	"status" varchar DEFAULT 'active',
	"last_message_at" timestamp DEFAULT now(),
	"homeowner_rating" integer,
	"contractor_rating" integer,
	"homeowner_feedback" text,
	"contractor_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "counties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"fips" varchar(5) NOT NULL,
	"state_code" varchar(2) NOT NULL,
	"population" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "counties_fips_unique" UNIQUE("fips")
);
--> statement-breakpoint
CREATE TABLE "donation_matching" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donation_id" varchar NOT NULL,
	"matching_amount" numeric(10, 2) NOT NULL,
	"matching_ratio" numeric(3, 2),
	"sponsor_name" varchar(255),
	"sponsor_message" text,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"error_type" varchar DEFAULT 'bug',
	"current_url" text,
	"user_agent" text,
	"browser_info" jsonb,
	"attachments" jsonb,
	"status" varchar DEFAULT 'open',
	"priority" varchar DEFAULT 'medium',
	"assigned_to" varchar,
	"admin_notes" text,
	"resolution" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar NOT NULL,
	"user_id" varchar,
	"contractor_id" varchar,
	"data" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "foundation_causes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"county_id" varchar,
	"is_active" boolean DEFAULT true,
	"target_amount" numeric(10, 2),
	"raised_amount" numeric(10, 2) DEFAULT '0',
	"image_url" varchar(500),
	"website_url" varchar(500),
	"contact_email" varchar(255),
	"verified_nonprofit" boolean DEFAULT false,
	"tax_id" varchar(20),
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "foundation_donations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"cause_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" "donation_type" DEFAULT 'one_time' NOT NULL,
	"status" "donation_status" DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"payment_method" varchar(50),
	"related_transaction_id" varchar,
	"related_transaction_type" varchar,
	"is_roundup_donation" boolean DEFAULT false,
	"original_amount" numeric(10, 2),
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar(20),
	"next_donation_date" timestamp,
	"is_anonymous" boolean DEFAULT false,
	"tax_deductible" boolean DEFAULT true,
	"receipt_sent" boolean DEFAULT false,
	"receipt_url" varchar(500),
	"processing_fee" numeric(10, 2) DEFAULT '0',
	"net_amount" numeric(10, 2),
	"donor_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "foundation_impact_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cause_id" varchar NOT NULL,
	"reporting_period" varchar(50),
	"total_donations_received" numeric(12, 2),
	"total_donors_count" integer,
	"total_beneficiaries" integer,
	"impact_metrics" jsonb,
	"storytelling" text,
	"media_urls" jsonb,
	"admin_costs" numeric(10, 2),
	"program_costs" numeric(10, 2),
	"fundraising_costs" numeric(10, 2),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member',
	"joined_at" timestamp DEFAULT now(),
	"approved_by" varchar,
	"approved_at" timestamp,
	"is_active" boolean DEFAULT true,
	"is_banned" boolean DEFAULT false,
	"banned_reason" text,
	"banned_by" varchar,
	"banned_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "growth_pack_downloads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"company_name" varchar,
	"primary_trade" varchar,
	"service_areas" text,
	"company_size" varchar,
	"has_consented" boolean DEFAULT false,
	"download_token" varchar NOT NULL,
	"downloaded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "growth_pack_downloads_download_token_unique" UNIQUE("download_token")
);
--> statement-breakpoint
CREATE TABLE "handmade_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"icon_name" varchar,
	"parent_id" varchar,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "handmade_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "handmade_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category_id" varchar NOT NULL,
	"tags" jsonb,
	"price" numeric(10, 2) NOT NULL,
	"compare_at_price" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"materials" jsonb,
	"dimensions" jsonb,
	"colors" jsonb,
	"customizable" boolean DEFAULT false,
	"customization_options" text,
	"in_stock" boolean DEFAULT true,
	"quantity_available" integer DEFAULT 1,
	"made_to_order" boolean DEFAULT false,
	"processing_time" varchar,
	"primary_image_url" varchar,
	"images" jsonb,
	"city" varchar,
	"state_code" varchar(2),
	"county_fips" varchar,
	"shipping_from" varchar,
	"free_shipping" boolean DEFAULT false,
	"shipping_cost" numeric(10, 2),
	"local_pickup_available" boolean DEFAULT false,
	"ships_nationwide" boolean DEFAULT true,
	"shipping_regions" jsonb,
	"status" varchar DEFAULT 'draft',
	"featured" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"favorite_count" integer DEFAULT 0,
	"seo_title" varchar,
	"seo_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" varchar NOT NULL,
	"invitee_email" varchar NOT NULL,
	"invitee_id" varchar,
	"type" "invitation_type" DEFAULT 'email' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"target_role" "user_role" NOT NULL,
	"personal_message" text,
	"invitation_code" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"inviter_city" varchar,
	"inviter_state" varchar,
	"inviter_county" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_invitation_code_unique" UNIQUE("invitation_code")
);
--> statement-breakpoint
CREATE TABLE "lead_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"assigned_at" timestamp DEFAULT now(),
	"responded_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"contractor_id" varchar,
	"project_type" varchar NOT NULL,
	"description" text,
	"county_id" varchar NOT NULL,
	"trade_id" varchar NOT NULL,
	"estimated_value" numeric,
	"urgency" varchar,
	"contact_preference" varchar,
	"status" varchar DEFAULT 'new',
	"routing_type" varchar,
	"calculator_data" jsonb,
	"utm_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon_name" varchar,
	"parent_category_id" varchar,
	"requires_verification" boolean DEFAULT false,
	"verification_requirements" jsonb,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "marketplace_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "marketplace_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"status" varchar DEFAULT 'active',
	"last_message_at" timestamp DEFAULT now(),
	"buyer_rating" integer,
	"seller_rating" integer,
	"buyer_feedback" text,
	"seller_feedback" text,
	"is_read_by_buyer" boolean DEFAULT false,
	"is_read_by_seller" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"listing_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_inquiries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"message" text NOT NULL,
	"offer_amount" numeric(12, 2),
	"buyer_phone" varchar,
	"buyer_email" varchar,
	"preferred_contact_method" varchar DEFAULT 'message',
	"status" varchar DEFAULT 'pending',
	"seller_response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"price_type" varchar DEFAULT 'fixed',
	"original_price" numeric(12, 2),
	"county" varchar NOT NULL,
	"state" varchar NOT NULL,
	"city" varchar,
	"zip_code" varchar,
	"is_local_pickup_only" boolean DEFAULT false,
	"will_ship" boolean DEFAULT false,
	"shipping_cost" numeric(10, 2),
	"condition" varchar NOT NULL,
	"brand" varchar(100),
	"model" varchar(100),
	"year" integer,
	"mileage" integer,
	"hours" integer,
	"specifications" jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"primary_image_index" integer DEFAULT 0,
	"video_url" varchar,
	"requires_buyer_verification" boolean DEFAULT false,
	"is_seller_verified" boolean DEFAULT false,
	"verification_status" varchar DEFAULT 'none_required',
	"verification_notes" text,
	"verified_at" timestamp,
	"status" varchar DEFAULT 'draft',
	"is_promoted" boolean DEFAULT false,
	"promoted_until" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"moderation_notes" text,
	"view_count" integer DEFAULT 0,
	"favorite_count" integer DEFAULT 0,
	"contact_count" integer DEFAULT 0,
	"slug" varchar,
	"meta_description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "marketplace_listings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marketplace_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_type" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"reporter_id" varchar,
	"reason" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'pending',
	"admin_notes" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) DEFAULT '0',
	"processing_fee" numeric(10, 2) DEFAULT '0',
	"buyer_fee_share" numeric(10, 2) DEFAULT '0',
	"seller_fee_share" numeric(10, 2) DEFAULT '0',
	"seller_amount" numeric(10, 2) NOT NULL,
	"payment_method" varchar NOT NULL,
	"is_off_platform" boolean DEFAULT false,
	"off_platform_method" varchar,
	"off_platform_notes" text,
	"off_platform_confirmed_by" varchar,
	"off_platform_confirmed_at" timestamp,
	"stripe_payment_intent_id" varchar,
	"stripe_transfer_id" varchar,
	"escrow_release_date" timestamp,
	"tracking_number" varchar,
	"delivery_confirmed_at" timestamp,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"internal_notes" text,
	"buyer_preferred_contact" varchar DEFAULT 'platform_messages',
	"seller_preferred_contact" varchar DEFAULT 'platform_messages',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_estimated_cost" numeric(10, 2),
	"vendor_info" jsonb,
	"status" varchar DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_type" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar,
	"content_type" "content_type" NOT NULL,
	"content_id" varchar NOT NULL,
	"content_owner_id" varchar,
	"action" varchar NOT NULL,
	"action_by" varchar NOT NULL,
	"action_user_id" varchar,
	"reason" text,
	"is_reversible" boolean DEFAULT true,
	"expires_at" timestamp,
	"can_appeal" boolean DEFAULT true,
	"appeal_deadline" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_appeals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" varchar NOT NULL,
	"report_id" varchar,
	"appellant_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"additional_evidence" jsonb,
	"status" varchar DEFAULT 'pending',
	"reviewed_by" varchar,
	"review_notes" text,
	"decision" varchar,
	"new_action" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar,
	"content_type" "content_type" NOT NULL,
	"content_id" varchar NOT NULL,
	"content_owner_id" varchar,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"additional_context" jsonb,
	"reporter_county" varchar,
	"reporter_state" varchar,
	"content_county" varchar,
	"content_state" varchar,
	"status" varchar DEFAULT 'pending',
	"total_votes" integer DEFAULT 0,
	"remove_votes" integer DEFAULT 0,
	"keep_votes" integer DEFAULT 0,
	"review_votes" integer DEFAULT 0,
	"votes_required" integer DEFAULT 5,
	"removal_threshold" numeric(3, 2) DEFAULT '0.60',
	"final_action" varchar,
	"action_taken_by" varchar,
	"action_reason" text,
	"resolved_at" timestamp,
	"moderator_id" varchar,
	"moderator_notes" text,
	"is_moderator_override" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"county" varchar,
	"state" varchar,
	"is_statewide" boolean DEFAULT false,
	"min_votes_required" integer DEFAULT 5,
	"removal_threshold" numeric(3, 2) DEFAULT '0.60',
	"local_voter_weight" numeric(3, 2) DEFAULT '1.5',
	"content_type_settings" jsonb,
	"min_account_age_days" integer DEFAULT 30,
	"min_local_activity_days" integer DEFAULT 7,
	"requires_address_verification" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"voter_id" varchar NOT NULL,
	"vote" "vote_type" NOT NULL,
	"comment" text,
	"voter_county" varchar,
	"voter_state" varchar,
	"vote_weight" numeric(3, 2) DEFAULT '1.0',
	"is_local_voter" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"related_id" varchar,
	"is_read" boolean DEFAULT false,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_type" varchar NOT NULL,
	"platform_fee_type" varchar DEFAULT 'percentage',
	"platform_fee_value" numeric(5, 4) DEFAULT '0.025',
	"platform_fee_min" numeric(10, 2) DEFAULT '0.50',
	"platform_fee_max" numeric(10, 2) DEFAULT '25.00',
	"processing_fee_split_type" varchar DEFAULT '50_50',
	"min_transaction_amount" numeric(10, 2) DEFAULT '1.00',
	"max_transaction_amount" numeric(10, 2) DEFAULT '50000.00',
	"allow_off_platform_payments" boolean DEFAULT true,
	"off_platform_payment_methods" jsonb DEFAULT '["cash","check","venmo","zelle","direct"]'::jsonb,
	"is_active" boolean DEFAULT true,
	"description" text,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"active_users" integer DEFAULT 0,
	"new_users" integer DEFAULT 0,
	"listings_created" integer DEFAULT 0,
	"transactions_completed" integer DEFAULT 0,
	"revenue" numeric(12, 2) DEFAULT '0',
	"on_platform_payments" integer DEFAULT 0,
	"off_platform_payments" integer DEFAULT 0,
	"on_platform_revenue" numeric(12, 2) DEFAULT '0',
	"top_categories" jsonb,
	"top_locations" jsonb
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"parent_comment_id" varchar,
	"content" text NOT NULL,
	"image_urls" text[],
	"like_count" integer DEFAULT 0,
	"is_hidden" boolean DEFAULT false,
	"moderator_notes" text,
	"moderated_by" varchar,
	"moderated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar NOT NULL,
	"fips" varchar NOT NULL,
	"service_code" varchar,
	"inputs" jsonb,
	"base_low" numeric,
	"base_high" numeric,
	"adjustment_factors" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prize_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"prize_type" varchar NOT NULL,
	"value" varchar NOT NULL,
	"vendor" varchar,
	"is_active" boolean DEFAULT true,
	"probability" numeric(5, 4) DEFAULT '0.0500',
	"terms" text,
	"expiration_days" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"shipping_cost" numeric(10, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"final_total" numeric(10, 2) NOT NULL,
	"customization_request" text,
	"customization_notes" text,
	"status" varchar DEFAULT 'pending',
	"shipping_method" varchar,
	"tracking_number" varchar,
	"shipping_address" jsonb,
	"confirmed_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"completed_at" timestamp,
	"payment_intent_id" varchar,
	"payment_status" varchar DEFAULT 'pending',
	"buyer_notes" text,
	"seller_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar,
	"review_text" text,
	"images" jsonb,
	"quality_rating" integer,
	"shipping_rating" integer,
	"service_rating" integer,
	"is_verified_purchase" boolean DEFAULT true,
	"is_public" boolean DEFAULT true,
	"would_recommend" boolean,
	"is_moderated" boolean DEFAULT false,
	"moderation_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_id" varchar NOT NULL,
	"interaction_type" varchar NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"referrer" text,
	"county" varchar,
	"state" varchar,
	"city" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"labor_cost" numeric(10, 2),
	"material_cost" numeric(10, 2),
	"total_cost" numeric(10, 2) NOT NULL,
	"valid_until" timestamp,
	"status" varchar DEFAULT 'draft',
	"terms" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "real_time_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"action_url" varchar,
	"is_read" boolean DEFAULT false,
	"sent_via_email" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "realtor_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"license_number" varchar NOT NULL,
	"brokerage_name" varchar NOT NULL,
	"mls_id" varchar,
	"specializations" jsonb,
	"years_experience" integer,
	"transactions_completed" integer DEFAULT 0,
	"average_transaction_value" numeric,
	"service_areas" jsonb,
	"license_state" varchar NOT NULL,
	"license_expiration" timestamp,
	"verification_status" "verification_status" DEFAULT 'pending',
	"verification_documents" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"photo_url" varchar,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"total_invitations_sent" integer DEFAULT 0,
	"total_invitations_accepted" integer DEFAULT 0,
	"homeowners_referred" integer DEFAULT 0,
	"contractors_referred" integer DEFAULT 0,
	"reward_points_earned" integer DEFAULT 0,
	"reward_points_redeemed" integer DEFAULT 0,
	"current_month_invitations" integer DEFAULT 0,
	"last_month_reset" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"states_covered" text[],
	"counties_covered" text[],
	"cities_covered" text[],
	"population" integer,
	"is_official" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "regions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "saved_ads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"ad_id" varchar NOT NULL,
	"saved_at" timestamp DEFAULT now(),
	"last_reminder_sent" timestamp,
	"reminder_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"search_type" varchar NOT NULL,
	"search_query" varchar,
	"filters" jsonb,
	"alerts_enabled" boolean DEFAULT true,
	"last_notified" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"proposed_date" timestamp NOT NULL,
	"duration_hours" integer,
	"status" varchar DEFAULT 'proposed',
	"location" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"search_query" varchar,
	"search_type" varchar NOT NULL,
	"filters" jsonb,
	"results_count" integer,
	"clicked_result_id" varchar,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_name" varchar,
	"bio" text,
	"specialty" varchar,
	"years_of_experience" integer,
	"website" varchar,
	"social_media_links" jsonb,
	"average_rating" numeric(3, 2),
	"total_reviews" integer DEFAULT 0,
	"total_sales" integer DEFAULT 0,
	"accepts_custom_orders" boolean DEFAULT true,
	"minimum_order_amount" numeric(10, 2),
	"returns_policy" text,
	"processing_time" varchar DEFAULT '1-2 weeks',
	"is_verified" boolean DEFAULT false,
	"verification_badges" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"key" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"description" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar(2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "states_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "task_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"message" text,
	"proposed_rate" numeric,
	"estimated_duration" varchar,
	"available_start_date" timestamp,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"icon_name" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "task_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poster_id" varchar NOT NULL,
	"poster_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"category_id" varchar,
	"address" varchar,
	"city" varchar,
	"state_code" varchar(2),
	"zip_code" varchar,
	"county_fips" varchar,
	"task_type" varchar NOT NULL,
	"estimated_hours" numeric,
	"pay_type" varchar NOT NULL,
	"pay_amount" numeric NOT NULL,
	"pay_min" numeric,
	"pay_max" numeric,
	"required_skills" jsonb,
	"requires_transportation" boolean DEFAULT false,
	"requires_tools" boolean DEFAULT false,
	"tools_provided" boolean DEFAULT false,
	"physical_demands" varchar,
	"scheduling_type" varchar NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"preferred_times" jsonb,
	"requires_id_verification" boolean DEFAULT true,
	"requires_background_check" boolean DEFAULT false,
	"minimum_rating" numeric,
	"minimum_jobs_completed" integer,
	"status" varchar DEFAULT 'open',
	"assigned_worker_id" varchar,
	"assigned_at" timestamp,
	"completed_at" timestamp,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"state_ids" jsonb,
	"county_ids" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"parent_id" varchar,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "trades_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "transaction_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"initiator_id" varchar NOT NULL,
	"reason" varchar NOT NULL,
	"description" text NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_donation_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"enable_roundup_donations" boolean DEFAULT false,
	"roundup_threshold" numeric(5, 2) DEFAULT '1.00',
	"default_cause_id" varchar,
	"email_receipts" boolean DEFAULT true,
	"monthly_reports" boolean DEFAULT true,
	"impact_updates" boolean DEFAULT true,
	"prefer_local_causes" boolean DEFAULT true,
	"max_distance_from_user" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_moderation_reputation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"can_vote" boolean DEFAULT true,
	"voting_power" numeric(3, 2) DEFAULT '1.0',
	"accurate_votes" integer DEFAULT 0,
	"total_votes" integer DEFAULT 0,
	"accuracy_rate" numeric(3, 2),
	"primary_county" varchar,
	"primary_state" varchar,
	"additional_counties" jsonb,
	"is_suspended" boolean DEFAULT false,
	"suspended_until" timestamp,
	"suspension_reason" text,
	"last_vote_at" timestamp,
	"joined_moderation_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar,
	"reviewer_id" varchar NOT NULL,
	"reviewee_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar,
	"content" text,
	"is_verified_purchase" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"phone" varchar,
	"address" text,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"role" "user_role" DEFAULT 'homeowner',
	"provider" varchar DEFAULT 'local',
	"provider_id" varchar,
	"email_verified" boolean DEFAULT false,
	"address_verified" boolean DEFAULT false,
	"address_verification_deadline" timestamp,
	"onboarding_completed" boolean DEFAULT false,
	"referral_code" varchar,
	"invited_by" varchar,
	"preferences" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	"identity_document_type" varchar,
	"identity_document_url" varchar,
	"identity_verified" boolean DEFAULT false,
	"business_name" varchar,
	"business_license_url" varchar,
	"business_license_number" varchar,
	"business_license_expiry" timestamp,
	"food_handlers_permit_url" varchar,
	"food_handlers_permit_expiry" timestamp,
	"kitchen_inspection_url" varchar,
	"kitchen_inspection_expiry" timestamp,
	"insurance_certificate_url" varchar,
	"insurance_expiry" timestamp,
	"legal_compliance_attestation" text,
	"has_attested_compliance" boolean DEFAULT false,
	"attestation_date" timestamp,
	"status" varchar DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"admin_notes" text,
	"approved_until" timestamp,
	"requires_renewal" boolean DEFAULT false,
	"renewal_reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"review_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" varchar NOT NULL,
	"request_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"submitted_documents" jsonb,
	"review_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worker_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"quality_rating" integer,
	"timeliness_rating" integer,
	"communication_rating" integer,
	"professionalism_rating" integer,
	"would_hire_again" boolean,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worker_service_areas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" varchar NOT NULL,
	"county_fips" varchar NOT NULL,
	"max_travel_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"email" varchar NOT NULL,
	"profile_image_url" varchar,
	"bio" text,
	"skills" jsonb,
	"hourly_rate" numeric,
	"available_hours" jsonb,
	"transportation_method" varchar,
	"max_travel_distance" integer,
	"is_id_verified" boolean DEFAULT false,
	"is_background_checked" boolean DEFAULT false,
	"verification_documents" jsonb,
	"verification_status" varchar DEFAULT 'pending',
	"verified_at" timestamp,
	"total_jobs_completed" integer DEFAULT 0,
	"average_rating" numeric,
	"total_earnings" numeric DEFAULT '0',
	"work_experience" jsonb,
	"education" jsonb,
	"certifications" jsonb,
	"portfolio_items" jsonb,
	"is_active" boolean DEFAULT true,
	"is_available" boolean DEFAULT true,
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "address_verifications" ADD CONSTRAINT "address_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_verifications" ADD CONSTRAINT "buyer_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_salesman_profiles" ADD CONSTRAINT "car_salesman_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_post_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_groups" ADD CONSTRAINT "community_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_leaderboard_stats" ADD CONSTRAINT "contractor_leaderboard_stats_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_homeowner_id_users_id_fk" FOREIGN KEY ("homeowner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_promos" ADD CONSTRAINT "contractor_promos_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_homeowner_id_users_id_fk" FOREIGN KEY ("homeowner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_matching" ADD CONSTRAINT "donation_matching_donation_id_foundation_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."foundation_donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_causes" ADD CONSTRAINT "foundation_causes_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_causes" ADD CONSTRAINT "foundation_causes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_donations" ADD CONSTRAINT "foundation_donations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_donations" ADD CONSTRAINT "foundation_donations_cause_id_foundation_causes_id_fk" FOREIGN KEY ("cause_id") REFERENCES "public"."foundation_causes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundation_impact_reports" ADD CONSTRAINT "foundation_impact_reports_cause_id_foundation_causes_id_fk" FOREIGN KEY ("cause_id") REFERENCES "public"."foundation_causes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_community_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handmade_products" ADD CONSTRAINT "handmade_products_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handmade_products" ADD CONSTRAINT "handmade_products_category_id_handmade_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."handmade_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_conversations" ADD CONSTRAINT "marketplace_conversations_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_conversations" ADD CONSTRAINT "marketplace_conversations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_conversations" ADD CONSTRAINT "marketplace_conversations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_favorites" ADD CONSTRAINT "marketplace_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_favorites" ADD CONSTRAINT "marketplace_favorites_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_inquiries" ADD CONSTRAINT "marketplace_inquiries_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_inquiries" ADD CONSTRAINT "marketplace_inquiries_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_inquiries" ADD CONSTRAINT "marketplace_inquiries_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_category_id_marketplace_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_conversation_id_marketplace_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."marketplace_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_reports" ADD CONSTRAINT "marketplace_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_lists" ADD CONSTRAINT "material_lists_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_lists" ADD CONSTRAINT "material_lists_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_content_owner_id_users_id_fk" FOREIGN KEY ("content_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_action_user_id_users_id_fk" FOREIGN KEY ("action_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_action_id_moderation_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_appellant_id_users_id_fk" FOREIGN KEY ("appellant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_content_owner_id_users_id_fk" FOREIGN KEY ("content_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_votes" ADD CONSTRAINT "moderation_votes_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_votes" ADD CONSTRAINT "moderation_votes_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_configurations" ADD CONSTRAINT "payment_configurations_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_product_id_handmade_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."handmade_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_product_id_handmade_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."handmade_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_handmade_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."handmade_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_product_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_interactions" ADD CONSTRAINT "promo_interactions_promo_id_contractor_promos_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."contractor_promos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_time_notifications" ADD CONSTRAINT "real_time_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtor_profiles" ADD CONSTRAINT "realtor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_stats" ADD CONSTRAINT "referral_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_ads" ADD CONSTRAINT "saved_ads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_ads" ADD CONSTRAINT "saved_ads_ad_id_advertisements_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."advertisements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_disputes" ADD CONSTRAINT "transaction_disputes_transaction_id_marketplace_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."marketplace_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_disputes" ADD CONSTRAINT "transaction_disputes_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_disputes" ADD CONSTRAINT "transaction_disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_donation_preferences" ADD CONSTRAINT "user_donation_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_donation_preferences" ADD CONSTRAINT "user_donation_preferences_default_cause_id_foundation_causes_id_fk" FOREIGN KEY ("default_cause_id") REFERENCES "public"."foundation_causes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_moderation_reputation" ADD CONSTRAINT "user_moderation_reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_transaction_id_marketplace_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."marketplace_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_verifications" ADD CONSTRAINT "vendor_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_verifications" ADD CONSTRAINT "vendor_verifications_category_id_marketplace_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contractor_leaderboard_month_year_idx" ON "contractor_leaderboard_stats" USING btree ("contractor_id","month","year");--> statement-breakpoint
CREATE INDEX "leaderboard_monthly_ranking_idx" ON "contractor_leaderboard_stats" USING btree ("month","year","monthly_recommendations");--> statement-breakpoint
CREATE INDEX "leaderboard_lifetime_ranking_idx" ON "contractor_leaderboard_stats" USING btree ("lifetime_recommendations");--> statement-breakpoint
CREATE INDEX "invitations_inviter_id_idx" ON "invitations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("invitee_email");--> statement-breakpoint
CREATE INDEX "invitations_code_idx" ON "invitations" USING btree ("invitation_code");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_votes_report_id_idx" ON "moderation_votes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "moderation_votes_voter_id_idx" ON "moderation_votes" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "referral_stats_user_id_idx" ON "referral_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");
