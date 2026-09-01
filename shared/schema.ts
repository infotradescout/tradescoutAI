import { sql } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  bigint,
  bigserial,
  boolean,
  decimal,
  numeric,
  pgEnum,
  primaryKey,
  check,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import {
  addressVerificationStatusEnum,
  botUiFailureTypeEnum,
  businessStatusEnum,
  businessTypeEnum,
  contactPermissionStatusEnum,
  countyEntityStatusEnum,
  countyEntityTypeEnum,
  countyNoteCategoryEnum,
  identityDocumentTypeEnum,
  identityVerificationStatusEnum,
  invitationStatusEnum,
  invitationTypeEnum,
  missionControlActionStatusEnum,
  missionControlDecisionActionEnum,
  missionControlSourceEnum,
  observationConfidenceEnum,
  observationHealthStatusEnum,
  observationSourceTypeEnum,
  observationSubjectTypeEnum,
  postTypeEnum,
  privacyLevelEnum,
  profileBusinessTypeEnum,
  profileStatusEnum,
  profileVisibilityEnum,
  reactionTypeEnum,
  reportReasonEnum,
  scoutInteractionFailureReasonEnum,
  scoutInteractionIntentEnum,
  scoutInteractionOutcomeEnum,
  scoutInteractionUserRoleEnum,
  scoutMemoryTypeEnum,
  sellerTypeEnum,
  storyLengthEnum,
  storyTemplateCategoryEnum,
  storyToneEnum,
  tradeCategoryEnum,
  userIntentEnum,
  userRoleEnum,
  verificationStatusEnum,
} from "./schema/core";
import { createNotificationSchema } from "./schema/notifications";
import { createProcurementSchema } from "./schema/procurement";

export * from "./schema/core";
export type {
  InsertPartnerWebhookEvent,
  InsertProcurementDeliveryProof,
  InsertProcurementFulfillmentEvent,
  InsertProcurementMessage,
  InsertProcurementOrder,
  InsertProcurementOrderFile,
  InsertProcurementOrderItem,
  InsertProcurementOrderSource,
  InsertProcurementPaymentAuthorization,
  InsertProcurementQuote,
  InsertProcurementQuoteLine,
  InsertProcurementSupplierQuote,
  InsertProcurementWorkspace,
  InsertProcurementWorkspaceBranding,
  InsertProcurementWorkspaceMember,
  PartnerWebhookEvent,
  ProcurementDeliveryProof,
  ProcurementFulfillmentEvent,
  ProcurementMessage,
  ProcurementOrder,
  ProcurementOrderFile,
  ProcurementOrderItem,
  ProcurementOrderSource,
  ProcurementPaymentAuthorization,
  ProcurementQuote,
  ProcurementQuoteLine,
  ProcurementSupplierQuote,
  ProcurementWorkspace,
  ProcurementWorkspaceBranding,
  ProcurementWorkspaceMember,
} from "./schema/procurement";

// Users table
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password_hash"), // for local auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  county: varchar("county"), // Add county field
  zipCode: varchar("zip_code"),
  // Canonical machine-readable location fields for hyper-local features
  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips", { length: 5 }),
  countyId: varchar("county_id"),
  countyName: varchar("county_name"),
  latitude: decimal("latitude", { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  role: userRoleEnum("role").default("homeowner"), // Primary role for backward compatibility
  roles: text("roles").array().default([]), // Multi-role support - array of role strings
  activeRole: varchar("active_role").default("homeowner"), // Currently active role for dashboard switching
  activeBusinessId: varchar("active_business_id"), // Currently active business profile for the active role
  businessSlug: varchar("business_slug").unique(), // Public URL slug for business profile
  activeProfileId: varchar("active_profile_id"), // Currently active Profile (public website) for the active role
  capabilityBundles: text("capability_bundles").array().default([]), // Capability bundles derived from onboarding
  participationModes: text("participation_modes").array().default([]), // Self vs business/organization participation
  provider: varchar("provider").default("local"), // 'local', 'facebook', 'google'
  providerId: varchar("provider_id"), // social login ID
  facebookId: varchar("facebook_id"), // Add facebookId field
  googleId: varchar("google_id"), // Add googleId field
  badges: jsonb("badges")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`), // Manual + automatic badges
  emailVerified: boolean("email_verified").default(false),
  addressVerified: boolean("address_verified").default(false),
  addressVerificationDeadline: timestamp("address_verification_deadline"),
  verificationStatus: verificationStatusEnum("verification_status").default("pending"), // Add verificationStatus
  onboardingCompleted: boolean("onboarding_completed").default(false),
  profileVersion: integer("profile_version").default(0),
  referralCode: varchar("referral_code"),
  invitedBy: varchar("invited_by"),
  // Lifetime affiliate attribution (first-touch): persists after signup so commissions are durable.
  // DB has FK to affiliate_accounts; kept as plain varchar here to avoid forward-ref issues.
  referredByAffiliateAccountId: varchar("referred_by_affiliate_account_id"),
  referredAt: timestamp("referred_at"),
  preferences: jsonb("preferences").$type<{
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    marketingEmails?: boolean;
    /** Express Direct Connect / similar explicit opt-in provenance. No ESP sync implied. */
    marketingConsent?: {
      source?: string;
      profileSlug?: string;
      businessId?: string;
      topics?: string[];
      optedInAt?: string;
    };
    completedTours?: string[]; // Track completed onboarding tours
    navigation?: {
      customOrder?: string[]; // Array of navigation items in user's preferred order
      hiddenFromSwipe?: string[]; // Navigation items to hide from swipe navigation
      enableSwipeNavigation?: boolean; // Whether swipe navigation is enabled
    };
    defaultHomePage?:
      | "llm"
      | "marketplace"
      | "contractor-board"
      | "dashboard"
      | "profile"
      | "community"; // User's preferred landing page
    profileVisibility?: "public" | "private"; // Public profiles are crawlable by LLM
    colorScheme?: {
      primary?: string; // Main brand color (hex)
      secondary?: string; // Secondary accent color (hex)
      background?: string; // Background color (hex)
      text?: string; // Text color (hex)
      preset?: "default" | "warm" | "cool" | "vibrant" | "minimal" | "custom"; // Color preset or custom
    };
    badges?: {
      show?: boolean; // Toggle badge visibility
    };
    privacy?: {
      showProfile?: boolean;
      allowMessages?: boolean;
      shareActivity?: boolean;
    };
    dashboard?: {
      enabledWidgets?: string[]; // Which widgets to show on dashboard
      widgetOrder?: string[]; // Order of widgets
      layout?: "single" | "two-column" | "three-column"; // Dashboard layout
    };

    communication?: {
      allowPhoneCalls?: boolean;
    };

    // Hyper-local geo preferences for nearby deals/alerts
    startIntent?: "community" | "services" | "business" | "tools";
    geo?: {
      homeLocation?: {
        lat: number;
        lng: number;
        label?: string; // Optional human-readable label like "Home" or neighborhood name
      };
      // Radius in meters for nearby content (default ~0.5 miles)
      notifyNearbyRadiusMeters?: number;
      // Enable/disable hyper-local alerts at the user level
      enableNearbyDeals?: boolean;
      // Which content types should be considered for nearby alerts
      includeTypes?: Array<"marketplace" | "trade">;
    };

    // Profile site builder settings - which sections appear on the public profile
    profileSections?: {
      about?: boolean;
      rolesAndBadges?: boolean;
      stats?: boolean;
      services?: boolean;
      marketplaceListings?: boolean;
      reviews?: boolean;
      communityActivity?: boolean;
      contactCard?: boolean;
    };

    // Natural-language services description that Scout and routing can use
    // to better match this user with the right jobs and connections.
    servicesDescription?: string;

    // Public profile booking configuration.
    profileBooking?: {
      enabled?: boolean;
      paidBookings?: boolean;
      bookingPriceUsd?: number;
      calendarVisibility?: "public" | "private";
      timezone?: string;
      slots?: Array<{
        id: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        label?: string;
        active?: boolean;
      }>;
      pricingTableEnabled?: boolean;
      pricingRows?: Array<{
        id: string;
        name: string;
        priceLabel: string;
        description?: string;
      }>;
    };

    // Notary-specific verification evidence captured for state-dependent remote services.
    notaryVerification?: {
      commissionActive?: boolean;
      backgroundScreened?: boolean;
      remoteProviderCertified?: boolean;
      reviewedAt?: string;
    };
  }>(),
  themePreference: varchar("theme_preference").default("default"), // Selected theme ID
  customThemeColors: text("custom_theme_colors"), // JSON string of custom colors

  // Preferred Source Prompt: Earned organic Google gravity (5th action moment)
  preferredSourcePromptShownAt: timestamp("preferred_source_prompt_shown_at"),
  preferredSourcePromptAcceptedAt: timestamp("preferred_source_prompt_accepted_at"),

  // Multi-profile support
  profileVisibility: profileVisibilityEnum("profile_visibility").default("private"),
  verifiedBadge: boolean("verified_badge").default(false),
  trustScore: integer("trust_score").default(10),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Profiles (multi-profile support: person, service provider, seller)
// Each user can have multiple profiles with independent verification state
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Profile intent and type
    userIntent: userIntentEnum("user_intent").notNull(), // 'person' or 'business'
    businessType: profileBusinessTypeEnum("profile_business_type"), // 'service_provider' or 'seller' (null if person)

    // Tags/specializations
    serviceTags: text("service_tags").array().default([]), // e.g., ['electrician', 'hvac']
    sellerTags: text("seller_tags").array().default([]), // e.g., ['restaurant', 'salon']
    sellerType: sellerTypeEnum("seller_type"), // 'physical', 'online', 'hybrid' (only for seller profiles)

    // Roles derived from intent + tags
    role: userRoleEnum("role").notNull().default("homeowner"),
    roles: text("roles").array().default([]),

    // Profile visibility and trust
    profileVisibility: profileVisibilityEnum("profile_visibility").default("private"),
    verifiedBadge: boolean("verified_badge").default(false),
    trustScore: integer("trust_score").default(10),

    // Verification requirements and status
    verificationRequirements: jsonb("verification_requirements")
      .$type<{
        email?: boolean;
        address?: boolean;
        license?: boolean;
        insurance?: boolean;
        tax_id?: boolean;
        business_registration?: boolean;
      }>()
      .default(sql`'{}'::jsonb`),

    verificationStatus: verificationStatusEnum("verification_status").default("pending"),
    email_verified: boolean("email_verified").default(false),
    address_verified: boolean("address_verified").default(false),
    license_verified: boolean("license_verified").default(false),
    insurance_verified: boolean("insurance_verified").default(false),
    tax_id_verified: boolean("tax_id_verified").default(false),
    business_registration_verified: boolean("business_registration_verified").default(false),

    // Submitted values/documents awaiting review for the requirements above.
    // Submitting a value does not flip the *_verified flags; an admin review does.
    verificationSubmissions: jsonb("verification_submissions")
      .$type<{
        licenseNumber?: string;
        licenseDocObjectKey?: string;
        taxIdLast4?: string;
        taxDocumentObjectKey?: string;
        insuranceDocObjectKey?: string;
        businessRegistrationDocObjectKey?: string;
        submittedAt?: string;
        fieldReview?: Partial<
          Record<
            "license" | "insurance" | "tax_id" | "business_registration",
            {
              status: "submitted" | "approved" | "rejected";
              submittedAt?: string;
              reviewedAt?: string;
              reviewedBy?: string;
              rejectionReason?: string;
            }
          >
        >;
      }>()
      .default(sql`'{}'::jsonb`),

    // Profile metadata
    isPrimary: boolean("is_primary").default(false), // First profile is primary
    displayName: varchar("display_name"), // Optional custom display name

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("user_profiles_user_idx").on(table.userId),
    index("user_profiles_visibility_idx").on(table.profileVisibility),
    index("user_profiles_primary_idx").on(table.isPrimary),
    index("user_profiles_intent_idx").on(table.userIntent),
  ]
);

// Businesses (first-class public profiles, decoupled from the user)
export const businesses = pgTable(
  "businesses",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    slug: varchar("slug").notNull().unique(),
    type: businessTypeEnum("type").notNull().default("other"),
    // Nullable to support admin-imported, unclaimed directory entries that can be claimed during signup.
    ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    roleContext: userRoleEnum("role_context").notNull(),
    profileData: jsonb("profile_data")
      .$type<{
        tagline?: string;
        description?: string;
        category?: string;
        services?: string[];
        website?: string;
        phone?: string;
        email?: string;
        address?: string;
        city?: string;
        stateCode?: string;
        zipCode?: string;
        contactPreference?: "call" | "email" | "message";
        /** Generic public-record gates; private Direct Connect fields remain stored. */
        publicContactEnabled?: boolean;
        publicLocationEnabled?: boolean;
        publicWebsiteEnabled?: boolean;
        importExtras?: Record<string, string>;
        tradePartner?: boolean;
        brandColors?: {
          primary?: string;
          primaryDark?: string;
          accent?: string;
          secondary?: string;
          background?: string;
          surface?: string;
        };
      }>()
      .default(sql`'{}'::jsonb`),
    claimStatus: varchar("claim_status", { length: 32 }).notNull().default("unclaimed"),
    publicDiscoveryEnabled: boolean("public_discovery_enabled").notNull().default(true),
    sources: jsonb("sources")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: businessStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("business_owner_idx").on(table.ownerUserId),
    index("business_role_ctx_idx").on(table.roleContext),
    index("business_status_idx").on(table.status),
    index("business_claim_status_idx").on(table.claimStatus),
    index("business_public_discovery_idx").on(table.publicDiscoveryEnabled),
  ]
);

export const tsPublicActivityTypeEnum = pgEnum("ts_public_activity_type", [
  "listing_added",
  "listing_updated",
  "claimed",
  "verified",
  "proof_added",
  "request_created_public_summary",
  "connection_made_public_summary",
]);

export const tsSeoPruneActionEnum = pgEnum("ts_seo_prune_action", [
  "noindex",
  "removed_from_sitemap",
  "deactivated",
  "deleted",
]);

export const tsPublicationRules = pgTable("ts_publication_rules", {
  id: varchar("id").primaryKey(),
  listingStaleDaysUnclaimed: integer("listing_stale_days_unclaimed").notNull(),
  listingStaleDaysClaimedUnverified: integer("listing_stale_days_claimed_unverified").notNull(),
  listingStaleDaysVerified: integer("listing_stale_days_verified").notNull(),
  requestPublicSummaryTtlHours: integer("request_public_summary_ttl_hours").notNull(),
  categoryPageRecencyWindowDays: integer("category_page_recency_window_days").notNull(),
  proofMediaTtlDays: integer("proof_media_ttl_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tsSeoPruneLog = pgTable(
  "ts_seo_prune_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: tsSeoPruneActionEnum("action").notNull(),
    reason: text("reason").notNull(),
    happenedAt: timestamp("happened_at").defaultNow().notNull(),
  },
  (table) => [
    index("ts_seo_prune_log_entity_idx").on(table.entityType, table.entityId),
    index("ts_seo_prune_log_happened_at_idx").on(table.happenedAt),
  ]
);

export const tsPublicActivity = pgTable(
  "ts_public_activity",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    countyId: varchar("county_id").references(() => counties.id, { onDelete: "set null" }),
    citySlug: varchar("city_slug", { length: 128 }),
    stateCode: varchar("state_code", { length: 2 }),
    tradeSlug: varchar("trade_slug", { length: 128 }),
    businessId: varchar("business_id").references(() => businesses.id, { onDelete: "set null" }),
    activityType: tsPublicActivityTypeEnum("activity_type").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    publicText: text("public_text"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    activeStatus: boolean("active_status").notNull().default(true),
  },
  (table) => [
    index("ts_public_activity_county_occurred_idx").on(table.countyId, table.occurredAt),
    index("ts_public_activity_city_occurred_idx").on(table.citySlug, table.occurredAt),
    index("ts_public_activity_trade_occurred_idx").on(table.tradeSlug, table.occurredAt),
    index("ts_public_activity_expires_idx").on(table.expiresAt),
  ]
);

// External source references for unclaimed directory imports (dedupe + provenance).
export const businessExternalRefs = pgTable(
  "business_external_refs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessId: varchar("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("business_external_refs_source_external_unique").on(table.source, table.externalId),
    index("business_external_refs_business_idx").on(table.businessId),
  ]
);

export const businessSuggestionKindEnum = pgEnum("business_suggestion_kind", ["edit", "removal"]);
export const businessSuggestionStatusEnum = pgEnum("business_suggestion_status", [
  "open",
  "resolved",
  "rejected",
]);

export const businessSuggestions = pgTable(
  "business_suggestions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessId: varchar("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: businessSuggestionKindEnum("kind").notNull(),
    status: businessSuggestionStatusEnum("status").notNull().default("open"),
    payload: jsonb("payload")
      .$type<Record<string, any>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("business_suggestions_business_idx").on(table.businessId),
    index("business_suggestions_status_idx").on(table.status),
    index("business_suggestions_kind_idx").on(table.kind),
  ]
);

export const businessSeedRunStatusEnum = pgEnum("business_seed_run_status", [
  "running",
  "succeeded",
  "failed",
]);

export const businessSeedRuns = pgTable(
  "business_seed_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    source: varchar("source", { length: 64 }).notNull(),
    locationText: text("location_text"),
    countyFips: varchar("county_fips", { length: 5 }),
    stateCode: varchar("state_code", { length: 2 }),
    terms: jsonb("terms")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    requestedByUserId: varchar("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: businessSeedRunStatusEnum("status").notNull().default("running"),
    insertedCount: integer("inserted_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("business_seed_runs_status_idx").on(table.status),
    index("business_seed_runs_county_idx").on(table.countyFips, table.stateCode),
    index("business_seed_runs_source_idx").on(table.source),
  ]
);

export const businessSeedRunLogs = pgTable(
  "business_seed_run_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    seedRunId: varchar("seed_run_id")
      .notNull()
      .references(() => businessSeedRuns.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 16 }).notNull().default("info"),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("business_seed_run_logs_run_idx").on(table.seedRunId),
    index("business_seed_run_logs_created_idx").on(table.createdAt),
  ]
);

// Staging table for preload/import pipeline before canonical merge.
export const listingImportStaging = pgTable(
  "listing_import_staging",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    batchId: varchar("batch_id", { length: 64 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    externalId: varchar("external_id"),
    name: varchar("name", { length: 255 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 512 }),
    stateCode: varchar("state_code", { length: 2 }),
    countyFips: varchar("county_fips", { length: 5 }),
    countyName: varchar("county_name", { length: 128 }),
    lat: decimal("lat", { precision: 9, scale: 6 }),
    lng: decimal("lng", { precision: 9, scale: 6 }),
    tradeCategories: jsonb("trade_categories")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dedupeKey: varchar("dedupe_key", { length: 255 }).notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    mergedBusinessId: varchar("merged_business_id"),
    mergeNotes: text("merge_notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("listing_import_staging_batch_idx").on(table.batchId),
    index("listing_import_staging_status_idx").on(table.status),
    index("listing_import_staging_dedupe_idx").on(table.dedupeKey),
    uniqueIndex("listing_import_staging_batch_external_idx").on(
      table.batchId,
      table.source,
      table.externalId
    ),
  ]
);

// XP + badges (gamification). These tables are part of the core feature set.
export const userXp = pgTable(
  "user_xp",
  {
    userId: varchar("user_id").primaryKey(),
    xpTotal: bigint("xp_total", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("user_xp_user_id_idx").on(table.userId)]
);

export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    sourceEventId: varchar("source_event_id"),
    dayKeyUtc: text("day_key_utc").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("xp_ledger_user_id_idx").on(table.userId),
    index("xp_ledger_day_idx").on(table.dayKeyUtc),
    index("xp_ledger_reason_idx").on(table.reason),
  ]
);

export const xpDailyCounters = pgTable(
  "xp_daily_counters",
  {
    userId: varchar("user_id").notNull(),
    dayKeyUtc: text("day_key_utc").notNull(),
    capKey: text("cap_key").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.dayKeyUtc, table.capKey] })]
);

export const xpDailyUniques = pgTable(
  "xp_daily_uniques",
  {
    userId: varchar("user_id").notNull(),
    dayKeyUtc: text("day_key_utc").notNull(),
    eventType: text("event_type").notNull(),
    uniqueKey: text("unique_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.dayKeyUtc, table.eventType, table.uniqueKey] }),
  ]
);

export const userBadges = pgTable(
  "user_badges",
  {
    userId: varchar("user_id").notNull(),
    badgeId: text("badge_id").notNull(),
    awardedAt: timestamp("awarded_at").notNull().defaultNow(),
    source: text("source").notNull().default("engine"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.badgeId] }),
    index("user_badges_user_idx").on(table.userId),
  ]
);

export const badgeEvalState = pgTable(
  "badge_eval_state",
  {
    userId: varchar("user_id").notNull(),
    badgeId: text("badge_id").notNull(),
    lastEvaluatedAt: timestamp("last_evaluated_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.badgeId] })]
);

// Tradepartner pages + interest submissions (county-scoped).
export const tradepartnerCountyPages = pgTable("tradepartner_county_pages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  countySlug: text("county_slug").notNull().unique(),
  countyName: text("county_name").notNull(),
  stateCode: text("state_code").notNull(),
  pageTitle: text("page_title").notNull(),
  heroHeadline: text("hero_headline").notNull(),
  heroSubhead: text("hero_subhead").notNull(),
  seatTermMonths: integer("seat_term_months").notNull().default(12),
  givebackSeatRevenuePct: integer("giveback_seat_revenue_pct").notNull().default(50),
  countyVaultAffiliatePct: integer("county_vault_affiliate_pct").notNull().default(10),
  allowedCategories: jsonb("allowed_categories")
    .notNull()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradepartnerInterestSubmissions = pgTable(
  "tradepartner_interest_submissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    countySlug: text("county_slug").notNull(),
    businessName: text("business_name").notNull(),
    serviceCategory: text("service_category").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message"),
    acknowledgesExclusivity: boolean("acknowledges_exclusivity").notNull().default(false),
    acknowledgesTerm: boolean("acknowledges_term").notNull().default(false),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tradepartner_interest_county_slug").on(table.countySlug),
    index("idx_tradepartner_interest_created_at").on(table.createdAt),
  ]
);

export const tradepartnerRsvpSubmissions = pgTable(
  "tradepartner_rsvp_submissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    partnerSlug: text("partner_slug").notNull(),
    countySlug: text("county_slug").notNull(),
    countyLabel: text("county_label").notNull(),
    eventLabel: text("event_label").notNull(),
    meetingDate: date("meeting_date"),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    attendeeCount: integer("attendee_count").notNull().default(1),
    lunchAttendees: integer("lunch_attendees").notNull().default(1),
    notes: text("notes"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tradepartner_rsvp_partner_county").on(table.partnerSlug, table.countySlug),
    index("idx_tradepartner_rsvp_created_at").on(table.createdAt),
  ]
);

export const tradepartnerCountyObservationSnapshots = pgTable(
  "tradepartner_county_observation_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    partnerSlug: text("partner_slug").notNull(),
    window: text("window").notNull(),
    countyFips: varchar("county_fips", { length: 5 }).notNull(),
    countyName: text("county_name").notNull(),
    stateCode: varchar("state_code", { length: 2 }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    okRatePct: integer("ok_rate_pct").notNull().default(0),
    trend: text("trend").notNull().default("flat"),
    changePct: integer("change_pct").notNull().default(0),
    dominantSurface: text("dominant_surface").notNull().default("unknown"),
    surfaceMixJson: jsonb("surface_mix_json")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<
        Array<{
          surface: string;
          requestCount: number;
          sharePct: number;
          okRatePct: number;
          trend: "up" | "down" | "flat";
          changePct: number;
        }>
      >(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tradepartner_county_observation_unique").on(
      table.partnerSlug,
      table.window,
      table.countyFips
    ),
    index("idx_tradepartner_county_observation_partner_window").on(
      table.partnerSlug,
      table.window,
      table.computedAt
    ),
    index("idx_tradepartner_county_observation_state").on(table.stateCode),
    index("idx_tradepartner_county_observation_county").on(table.countyFips),
  ]
);

export const tradepartnerUserEntitlements = pgTable(
  "tradepartner_user_entitlements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    partnerSlug: text("partner_slug").notNull(),
    userId: varchar("user_id").notNull(),
    accessScope: text("access_scope").notNull().default("market_signals"),
    accessLevel: text("access_level").notNull().default("member"),
    status: text("status").notNull().default("active"),
    createdByUserId: varchar("created_by_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tradepartner_user_entitlements_unique").on(
      table.partnerSlug,
      table.userId,
      table.accessScope
    ),
    index("idx_tradepartner_user_entitlements_partner").on(table.partnerSlug, table.status),
    index("idx_tradepartner_user_entitlements_user").on(table.userId, table.status),
  ]
);

// Trusted devices table for master admin persistent sessions
export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceFingerprint: varchar("device_fingerprint").notNull(),
    deviceName: varchar("device_name"), // User-friendly name like "Chrome on Windows"
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address"),
    lastUsed: timestamp("last_used").defaultNow(),
    lastUsedAt: timestamp("last_used_at").defaultNow(), // Alias for lastUsed for backward compatibility
    isActive: boolean("is_active").default(true),
    status: varchar("status").default("pending"), // 'pending', 'approved', 'revoked'
    approvedAt: timestamp("approved_at"),
    sessionToken: varchar("session_token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_trusted_devices_user").on(table.userId),
    index("idx_trusted_devices_fingerprint").on(table.deviceFingerprint),
    index("idx_trusted_devices_session").on(table.sessionToken),
  ]
);

// Affiliate program core tables
export const affiliateAccounts = pgTable(
  "affiliate_accounts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    affiliateId: varchar("affiliate_id")
      .notNull()
      .references(() => users.id),
    status: varchar("status").default("active"),
    lifetimeEarned: decimal("lifetime_earned").default("0"),
    available: decimal("available").default("0"),
    pending: decimal("pending").default("0"),
    lastPayoutAmount: decimal("last_payout_amount").default("0"),
    lastPayoutAt: timestamp("last_payout_at"),
    referralCode: varchar("referral_code"),
    customDomain: varchar("custom_domain"),
    couponCode: varchar("coupon_code"),
    // Optional override for default 5% commission on platform fees
    commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }), // e.g. 0.0500 = 5%
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_affiliate_accounts_affiliate_id").on(table.affiliateId),
    index("idx_affiliate_accounts_affiliate").on(table.affiliateId),
    index("idx_affiliate_accounts_referral_code").on(table.referralCode),
  ]
);

export const affiliatePayouts = pgTable(
  "affiliate_payouts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    affiliateId: varchar("affiliate_id")
      .notNull()
      .references(() => affiliateAccounts.id),
    status: varchar("status").default("pending"),
    payoutAmount: decimal("payout_amount").default("0"),
    method: varchar("method").default("stripe"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_affiliate_payouts_affiliate").on(table.affiliateId)]
);

export const affiliateShareLinks = pgTable(
  "affiliate_share_links",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    affiliateId: varchar("affiliate_id")
      .notNull()
      .references(() => affiliateAccounts.id),
    userId: varchar("user_id").references(() => users.id),
    fullUrl: varchar("full_url").notNull(),
    friendlySlug: varchar("friendly_slug"),
    description: text("description"),
    views: integer("views").default(0),
    shares: integer("shares").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_affiliate_share_links_affiliate").on(table.affiliateId),
    index("idx_affiliate_share_links_user").on(table.userId),
    index("idx_affiliate_share_links_slug").on(table.friendlySlug),
  ]
);

export const affiliateTrafficEvents = pgTable(
  "affiliate_traffic_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    shareLinkId: varchar("share_link_id")
      .notNull()
      .references(() => affiliateShareLinks.id),
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    deviceType: varchar("device_type"),
    conversionSource: varchar("conversion_source"),
    conversionType: varchar("conversion_type"),
    conversionsCount: integer("conversions_count").default(0),
    computedConversion: boolean("computed_conversion").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_affiliate_traffic_share_link").on(table.shareLinkId),
    index("idx_affiliate_traffic_conversion").on(table.conversionType),
  ]
);

export const affiliateAttributionConversions = pgTable(
  "affiliate_attribution_conversions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversionEventId: varchar("conversion_event_id").notNull().unique(),
    affiliateTag: varchar("affiliate_tag").notNull(),
    source: varchar("source").notNull(),
    attributionProofType: varchar("attribution_proof_type").notNull(),
    attributionProof: text("attribution_proof").notNull(),
    conversionType: varchar("conversion_type").notNull(),
    targetPath: varchar("target_path"),
    targetId: varchar("target_id"),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    status: varchar("status").notNull().default("recorded"),
    payoutEligible: boolean("payout_eligible").notNull().default(false),
    payoutCalculated: boolean("payout_calculated").notNull().default(false),
    paymentTriggered: boolean("payment_triggered").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_affiliate_attr_conv_tag").on(table.affiliateTag),
    index("idx_affiliate_attr_conv_type").on(table.conversionType),
    index("idx_affiliate_attr_conv_occurred").on(table.occurredAt),
  ]
);

// Core affiliate referrals table used by the MVP affiliate system
export const affiliateReferrals = pgTable(
  "affiliate_referrals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    affiliateId: varchar("affiliate_id")
      .notNull()
      .references(() => affiliateAccounts.id),
    referredUserId: varchar("referred_user_id").references(() => users.id),
    shareLinkId: varchar("share_link_id").references(() => affiliateShareLinks.id),
    customLink: varchar("custom_link"),
    commissionAmount: decimal("commission_amount").default("0"),
    discountAmount: decimal("discount_amount").default("0"),
    conversionSource: varchar("conversion_source"),
    conversionType: varchar("conversion_type").default("lead"),
    couponCode: varchar("coupon_code"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_affiliate_referrals_affiliate").on(table.affiliateId),
    index("idx_affiliate_referrals_user").on(table.referredUserId),
    index("idx_affiliate_referrals_share_link").on(table.shareLinkId),
  ]
);

// Realtor profiles
export const realtorProfiles = pgTable(
  "realtor_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    licenseNumber: varchar("license_number").notNull(),
    brokerageName: varchar("brokerage_name").notNull(),
    mlsId: varchar("mls_id"),
    specializations: jsonb("specializations").$type<string[]>(), // residential, commercial, luxury, etc.
    yearsExperience: integer("years_experience"),
    transactionsCompleted: integer("transactions_completed").default(0),
    averageTransactionValue: decimal("average_transaction_value"),
    serviceAreas: jsonb("service_areas").$type<{
      counties: string[];
      cities: string[];
      zipCodes: string[];
    }>(),
    licenseState: varchar("license_state").notNull(),
    licenseExpiration: timestamp("license_expiration"),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("pending"),
    verificationDocuments: jsonb("verification_documents").$type<{
      licenseDocument?: string;
      brokerageAffiliation?: string;
      mlsCertificate?: string;
      additionalCertifications?: string[];
    }>(),
    reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("uq_realtor_profiles_user_id").on(table.userId)]
);

// Profiles (public-facing website pages; may link to a Business)
export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: varchar("business_id").references(() => businesses.id, { onDelete: "set null" }),
    roleContext: userRoleEnum("role_context").notNull(),
    slug: varchar("slug").notNull().unique(),
    displayName: varchar("display_name").notNull(),
    headline: varchar("headline"),
    contentBlocks: jsonb("content_blocks")
      .$type<
        Array<{
          type: "hero" | "about" | "services" | "gallery" | "faq" | "reviews" | "cta" | "custom";
          data: Record<string, any>;
        }>
      >()
      .default(sql`'[]'::jsonb`),
    ctaConfig: jsonb("cta_config")
      .$type<{
        primary?: { label: string; kind: "call" | "email" | "message" | "link"; value: string };
        secondary?: { label: string; kind: "call" | "email" | "message" | "link"; value: string };
      }>()
      .default(sql`'{}'::jsonb`),
    seoMeta: jsonb("seo_meta")
      .$type<{
        title?: string;
        description?: string;
        imageUrl?: string;
        imageWidth?: number;
        imageHeight?: number;
        // Separate from imageUrl (the OG/share banner) -- browser tab icons
        // need a square mark, not a wide 1200x630 crop. Falls back to
        // imageUrl when unset. See publicProfileHtml.ts.
        faviconUrl?: string;
        customDomain?: string;
      }>()
      .default(sql`'{}'::jsonb`),
    status: profileStatusEnum("status").notNull().default("draft"),
    publiclyReleased: boolean("publicly_released").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("profile_owner_idx").on(table.ownerUserId),
    index("profile_business_idx").on(table.businessId),
    index("profile_role_ctx_idx").on(table.roleContext),
    index("profile_status_idx").on(table.status),
  ]
);

// Public-profile actions are intentionally separate from CVS, trust snapshots,
// and exposure/ranking inputs. A Like is lightweight appreciation; a Favorite
// is a private save. Neither can buy or manufacture TradeScout trust.
export const publicProfileEngagements = pgTable(
  "public_profile_engagements",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    profileId: varchar("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 24 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("public_profile_engagements_profile_user_action_uidx").on(
      table.profileId,
      table.userId,
      table.action
    ),
    index("public_profile_engagements_profile_action_idx").on(table.profileId, table.action),
    index("public_profile_engagements_user_idx").on(table.userId),
    check("public_profile_engagements_action_check", sql`${table.action} in ('like', 'favorite')`),
  ]
);

// Real page-view events for public profiles. Recorded only on the client-side
// profile data fetch, which real browsers hit after hydrating -- the separate
// server-rendered crawler/SEO HTML path never touches this table, so counts
// reflect human traffic rather than search-engine crawl volume. Deliberately
// separate from CVS, trust snapshots, boosts, and exposure/ranking inputs,
// same as publicProfileEngagements above.
export const profileViewEvents = pgTable(
  "profile_view_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    profileId: varchar("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    viewerUserId: varchar("viewer_user_id").references(() => users.id, { onDelete: "set null" }),
    referrer: varchar("referrer", { length: 512 }),
    userAgent: varchar("user_agent", { length: 512 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("profile_view_events_profile_created_idx").on(table.profileId, table.createdAt)]
);

// Car salesman profiles
export const carSalesmanProfiles = pgTable(
  "car_salesman_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    dealershipName: varchar("dealership_name").notNull(),
    dealerLicense: varchar("dealer_license").notNull(),
    salesmanLicense: varchar("salesman_license"),
    specializations: jsonb("specializations").$type<string[]>(), // new, used, luxury, commercial, etc.
    yearsExperience: integer("years_experience"),
    vehiclesSold: integer("vehicles_sold").default(0),
    averageVehicleValue: decimal("average_vehicle_value"),
    brandsSpecialty: jsonb("brands_specialty").$type<string[]>(), // Ford, Toyota, BMW, etc.
    serviceAreas: jsonb("service_areas").$type<{
      counties: string[];
      cities: string[];
      zipCodes: string[];
    }>(),
    licenseState: varchar("license_state").notNull(),
    licenseExpiration: timestamp("license_expiration"),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("pending"),
    verificationDocuments: jsonb("verification_documents").$type<{
      dealerLicense?: string;
      salesmanLicense?: string;
      dealershipAffiliation?: string;
      additionalCertifications?: string[];
    }>(),
    reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("uq_car_salesman_profiles_user_id").on(table.userId)]
);

// States table
export const states = pgTable("states", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  code: varchar("code", { length: 2 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Counties table with FIPS codes
export const counties = pgTable("counties", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  fips: varchar("fips", { length: 5 }).notNull().unique(),
  stateCode: varchar("state_code", { length: 2 })
    .notNull()
    .references(() => states.code),
  population: integer("population"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// County notes for admin-only operational memory
export const countyNotes = pgTable(
  "county_notes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    countyFips: varchar("county_fips", { length: 5 }).notNull(),
    authorUserId: varchar("author_user_id")
      .notNull()
      .references(() => users.id),
    category: countyNoteCategoryEnum("category").notNull().default("general"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("county_notes_fips_idx").on(table.countyFips),
    index("county_notes_author_idx").on(table.authorUserId),
  ]
);

// County metrics: computed, replaceable numeric aggregates per FIPS
export const countyMetrics = pgTable(
  "county_metrics",
  {
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    metricKey: varchar("metric_key", { length: 64 }).notNull(),
    metricValue: numeric("metric_value", { precision: 20, scale: 4 }).notNull().default("0"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.countyFips, table.metricKey] }),
    index("county_metrics_fips_idx").on(table.countyFips),
  ]
);

// County entities: affiliates, employees, partners and other assets mapped to counties
export const countyEntities = pgTable(
  "county_entities",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    entityType: countyEntityTypeEnum("entity_type").notNull(),
    entityId: varchar("entity_id"),
    label: varchar("label", { length: 255 }),
    status: countyEntityStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("county_entities_fips_idx").on(table.countyFips),
    index("county_entities_type_idx").on(table.entityType),
  ]
);

// Canonical observations: single normalized intake for all local reality signals
export const observations = pgTable(
  "observations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    occurredAt: timestamp("occurred_at").notNull(),
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    stateCode: varchar("state_code", { length: 2 })
      .notNull()
      .references(() => states.code),
    city: varchar("city", { length: 120 }),
    // Optional geo payload (point/shape) in JSON for portability without PostGIS dependency.
    geoJson: jsonb("geo_json").$type<Record<string, unknown> | null>(),
    subjectType: observationSubjectTypeEnum("subject_type").notNull(),
    subjectRef: varchar("subject_ref", { length: 255 }),
    actionType: varchar("action_type", { length: 64 }).notNull(),
    sourceType: observationSourceTypeEnum("source_type").notNull(),
    sourceRef: varchar("source_ref", { length: 255 }).notNull(),
    attributesJson: jsonb("attributes_json").$type<Record<string, unknown>>().notNull().default({}),
    confidence: observationConfidenceEnum("confidence").notNull().default("official"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_observations_county_occurred").on(table.countyFips, table.occurredAt),
    index("idx_observations_source_occurred").on(table.sourceType, table.occurredAt),
    index("idx_observations_action_occurred").on(table.actionType, table.occurredAt),
    uniqueIndex("uq_observations_source_ref").on(table.sourceType, table.sourceRef),
  ]
);

// Adapter health/cursor table for county + source ingestion tracking
export const observationSources = pgTable(
  "observation_sources",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceType: observationSourceTypeEnum("source_type").notNull(),
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    stateCode: varchar("state_code", { length: 2 })
      .notNull()
      .references(() => states.code),
    lastSuccessAt: timestamp("last_success_at"),
    lastRunAt: timestamp("last_run_at"),
    cursorJson: jsonb("cursor_json").$type<Record<string, unknown> | null>(),
    healthStatus: observationHealthStatusEnum("health_status").notNull().default("idle"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_observation_sources_type_county").on(table.sourceType, table.countyFips),
    index("idx_observation_sources_health").on(table.healthStatus),
    index("idx_observation_sources_county").on(table.countyFips),
  ]
);

// Business service areas (many-to-many with counties)
export const businessCounties = pgTable(
  "business_counties",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessId: varchar("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    countyId: varchar("county_id")
      .notNull()
      .references(() => counties.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("business_county_unique").on(table.businessId, table.countyId),
    index("business_counties_business_idx").on(table.businessId),
    index("business_counties_county_idx").on(table.countyId),
  ]
);

// Trade categories (hierarchical)
export const trades = pgTable("trades", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  parentId: varchar("parent_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Trade-level compliance requirements (used for regulated/promoted flows)
export const tradeRequirements = pgTable("trade_requirements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id")
    .notNull()
    .references(() => trades.id),

  // Compliance gates
  requiresLicense: boolean("requires_license").default(false),
  requiresInsurance: boolean("requires_insurance").default(false),
  requiresEin: boolean("requires_ein").default(false),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scout Snapshots — Dynamic user identity inference
// Replaces hard-coded roles with signal-inferred identity snapshots
// B1/B2: Snapshot model implementation
export const snapshots = pgTable(
  "snapshots",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    snapshotId: varchar("snapshot_id").unique().notNull(), // Unique per computation
    computedAt: timestamp("computed_at").notNull().defaultNow(),

    // Inferred identity
    primaryRole: varchar("primary_role").notNull(), // homeowner, contractor, vendor, admin, unknown
    secondaryRoles: text("secondary_roles").array().default([]),

    // Confidence scores
    primaryRoleConfidence: numeric("primary_role_confidence", { precision: 3, scale: 2 }).notNull(), // 0.00-1.00
    secondaryRoleConfidences: jsonb("secondary_role_confidences").$type<Record<string, number>>(),

    // Decision confidence
    decisionConfidence: varchar("decision_confidence").notNull(), // low, medium, high

    // Signals that contributed
    signals: jsonb("signals").$type<any>().notNull(),

    // Validity & decay
    validUntil: timestamp("valid_until").notNull(),
    confidenceDecayRate: numeric("confidence_decay_rate", { precision: 3, scale: 2 }).default(
      "0.05"
    ),

    // Metadata
    version: varchar("version").default("1.0"),
    experimental: boolean("experimental").default(false),
    tags: text("tags").array().default([]),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_snapshots_user_id").on(table.userId),
    index("idx_snapshots_validity").on(table.userId, table.validUntil),
    uniqueIndex("idx_snapshots_unique_per_user").on(table.userId, table.snapshotId),
  ]
);

// Contractors table
export const contractors = pgTable("contractors", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  businessId: varchar("business_id"),
  companyName: varchar("company_name").notNull(),
  slug: varchar("slug").notNull().unique(),
  phone: varchar("phone"),
  email: varchar("email"),
  website: varchar("website"),
  yearsInBusiness: integer("years_in_business"),
  licenseNumber: varchar("license_number"),
  insuranceDocUrl: varchar("insurance_doc_url"),
  about: text("about"),
  photos: jsonb("photos").$type<string[]>(),
  minJobSize: decimal("min_job_size"),
  availabilityWindow: varchar("availability_window"),
  pricingNotes: text("pricing_notes"),
  responseTimeSla: integer("response_time_sla"), // in hours
  isGeneralContractor: boolean("is_general_contractor").default(false),
  isResidentialContractor: boolean("is_residential_contractor").default(false),
  acceptsSubcontractWork: boolean("accepts_subcontract_work").default(false),
  verifiedLicensed: boolean("verified_licensed").default(false),
  verifiedInsured: boolean("verified_insured").default(false),
  lastVerified: timestamp("last_verified"),
  positiveRecommendations: integer("positive_recommendations").default(0),
  negativeRecommendations: integer("negative_recommendations").default(0),
  totalRecommendations: integer("total_recommendations").default(0),
  recommendationScore: decimal("recommendation_score", { precision: 5, scale: 2 }).default("0.00"), // positive minus negative
  recommendationPercentage: decimal("recommendation_percentage", {
    precision: 5,
    scale: 2,
  }).default("0.00"), // (positive/total)*100
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Provider declarations for service areas and categories (eligibility only)
export const providerDeclarations = pgTable("provider_declarations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Provider is always a user; can represent contractors, realtors, marketplace sellers, etc.
  providerUserId: varchar("provider_user_id")
    .notNull()
    .references(() => users.id),

  // Service area and categories are explicit declarations, not ranking signals
  serviceAreas: jsonb("service_areas").$type<
    {
      countyFips: string;
    }[]
  >(),
  tradeIds: jsonb("trade_ids").$type<string[]>(),
  availabilityFlags: jsonb("availability_flags").$type<{
    emergency?: boolean;
    weekends?: boolean;
    evenings?: boolean;
  }>(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Canonical legal envelope for where a provider is allowed to operate.
// This is distinct from serviceAreas, which are opt-in operating choices.
export const providerEligibilities = pgTable(
  "provider_eligibilities",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    providerUserId: varchar("provider_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jurisdictionType: varchar("jurisdiction_type", {
      enum: ["state", "county"],
    }).notNull(),
    eligibilityBasis: varchar("eligibility_basis", {
      enum: ["state_license", "county_license", "verified_exception"],
    }).notNull(),
    verificationStatus: varchar("verification_status", {
      enum: ["pending", "approved", "rejected", "expired"],
    })
      .notNull()
      .default("approved"),
    stateCode: varchar("state_code", { length: 2 }),
    countyFips: varchar("county_fips", { length: 5 }).references(() => counties.fips, {
      onDelete: "cascade",
    }),
    evidenceNote: text("evidence_note"),
    expiresAt: timestamp("expires_at"),
    verifiedAt: timestamp("verified_at").defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_provider_eligibilities_provider").on(table.providerUserId),
    index("idx_provider_eligibilities_county").on(table.countyFips),
    index("idx_provider_eligibilities_state").on(table.stateCode),
    uniqueIndex("uq_provider_eligibility_scope").on(
      table.providerUserId,
      table.jurisdictionType,
      table.stateCode,
      table.countyFips,
      table.eligibilityBasis
    ),
  ]
);

// Per-county behavioral rollup for providers (derived from events)
export const providerLocalStats = pgTable("provider_local_stats", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerUserId: varchar("provider_user_id")
    .notNull()
    .references(() => users.id),
  countyFips: varchar("county_fips", { length: 5 }).notNull(),

  jobsCompleted: integer("jobs_completed").default(0),
  peopleHelped: integer("people_helped").default(0),
  activeWeeks: integer("active_weeks").default(0),
  lastActiveAt: timestamp("last_active_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertCountyNote = typeof countyNotes.$inferInsert;
export type CountyNote = typeof countyNotes.$inferSelect;
export type InsertCountyMetric = typeof countyMetrics.$inferInsert;
export type CountyMetric = typeof countyMetrics.$inferSelect;
export type InsertCountyEntity = typeof countyEntities.$inferInsert;
export type CountyEntity = typeof countyEntities.$inferSelect;
export type InsertObservation = typeof observations.$inferInsert;
export type Observation = typeof observations.$inferSelect;
export type InsertObservationSource = typeof observationSources.$inferInsert;
export type ObservationSource = typeof observationSources.$inferSelect;
export type InsertProviderEligibility = typeof providerEligibilities.$inferInsert;
export type ProviderEligibility = typeof providerEligibilities.$inferSelect;

// Business-level verification records (append-only)
export const businessVerifications = pgTable("business_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerUserId: varchar("provider_user_id")
    .notNull()
    .references(() => users.id),

  // 'license' | 'insurance' | 'ein' | 'other'
  verificationType: varchar("verification_type").notNull(),
  jurisdiction: varchar("jurisdiction"),

  // 'pending' | 'approved' | 'rejected' | 'expired'
  status: varchar("status").notNull(),

  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  source: varchar("source"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),

  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertBusiness = typeof businesses.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type InsertBusinessExternalRef = typeof businessExternalRefs.$inferInsert;
export type BusinessExternalRef = typeof businessExternalRefs.$inferSelect;
export type InsertBusinessSuggestion = typeof businessSuggestions.$inferInsert;
export type BusinessSuggestion = typeof businessSuggestions.$inferSelect;
export type InsertBusinessSeedRun = typeof businessSeedRuns.$inferInsert;
export type BusinessSeedRun = typeof businessSeedRuns.$inferSelect;
export type InsertBusinessSeedRunLog = typeof businessSeedRunLogs.$inferInsert;
export type BusinessSeedRunLog = typeof businessSeedRunLogs.$inferSelect;
export type InsertListingImportStaging = typeof listingImportStaging.$inferInsert;
export type ListingImportStaging = typeof listingImportStaging.$inferSelect;
export type InsertBusinessCounty = typeof businessCounties.$inferInsert;
export type BusinessCounty = typeof businessCounties.$inferSelect;

export type InsertProfile = typeof profiles.$inferInsert;
export type Profile = typeof profiles.$inferSelect;

// Contractor-Trade relationships (many-to-many)
export const contractorTrades = pgTable("contractor_trades", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  tradeId: varchar("trade_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contractor service areas (many-to-many with counties)
export const contractorCounties = pgTable("contractor_counties", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  countyId: varchar("county_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recommendations/Reviews
export const recommendations = pgTable("recommendations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  userId: varchar("user_id").notNull(),
  recommendationType: varchar("recommendation_type").notNull(), // 'positive' or 'negative'
  comment: text("comment").notNull(),
  projectType: varchar("project_type"), // roofing, plumbing, etc.
  projectValue: decimal("project_value"), // dollar amount for context
  workQuality: varchar("work_quality"), // excellent, good, fair, poor
  timeliness: varchar("timeliness"), // on_time, slightly_late, very_late
  communication: varchar("communication"), // excellent, good, fair, poor
  wouldHireAgain: boolean("would_hire_again"),
  photoUrl: varchar("photo_url"),

  // Anti-abuse measures
  customerName: varchar("customer_name").notNull(),
  customerEmail: varchar("customer_email").notNull(),
  customerPhone: varchar("customer_phone"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),

  // Verification and moderation
  isVerified: boolean("is_verified").default(false),
  verificationMethod: varchar("verification_method"), // 'email', 'phone', 'admin'
  verifiedAt: timestamp("verified_at"),
  isPublic: boolean("is_public").default(false), // Default to private until verified
  moderationStatus: varchar("moderation_status").default("pending"), // pending, approved, rejected
  moderatedAt: timestamp("moderated_at"),
  moderatedBy: varchar("moderated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contractor leaderboard statistics tracking
export const contractorLeaderboardStats = pgTable(
  "contractor_leaderboard_stats",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    contractorId: varchar("contractor_id")
      .notNull()
      .references(() => contractors.id),
    month: integer("month").notNull(), // 1-12
    year: integer("year").notNull(),
    monthlyPositiveRecommendations: integer("monthly_positive_recommendations").default(0),
    monthlyNegativeRecommendations: integer("monthly_negative_recommendations").default(0),
    monthlyTotalRecommendations: integer("monthly_total_recommendations").default(0),
    lifetimePositiveRecommendations: integer("lifetime_positive_recommendations").default(0),
    lifetimeNegativeRecommendations: integer("lifetime_negative_recommendations").default(0),
    lifetimeTotalRecommendations: integer("lifetime_total_recommendations").default(0),
    monthlyRecommendationScore: decimal("monthly_recommendation_score", { precision: 5, scale: 2 }), // Monthly (positive - negative)
    lifetimeRecommendationScore: decimal("lifetime_recommendation_score", {
      precision: 5,
      scale: 2,
    }), // Lifetime (positive - negative)
    monthlyRecommendationPercentage: decimal("monthly_recommendation_percentage", {
      precision: 5,
      scale: 2,
    }), // Monthly percentage
    lifetimeRecommendationPercentage: decimal("lifetime_recommendation_percentage", {
      precision: 5,
      scale: 2,
    }), // Lifetime percentage
    lastUpdated: timestamp("last_updated").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("contractor_leaderboard_month_year_idx").on(table.contractorId, table.month, table.year),
    index("leaderboard_monthly_ranking_idx").on(
      table.month,
      table.year,
      table.monthlyTotalRecommendations
    ),
    index("leaderboard_lifetime_ranking_idx").on(table.lifetimeTotalRecommendations),
  ]
);

// Leads management
export const leads = pgTable("leads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // homeowner
  contractorId: varchar("contractor_id"), // assigned contractor
  projectType: varchar("project_type").notNull(),
  description: text("description"),
  countyId: varchar("county_id").notNull(),
  tradeId: varchar("trade_id").notNull(),
  estimatedValue: decimal("estimated_value"),
  urgency: varchar("urgency"), // immediate, week, month, planning
  contactPreference: varchar("contact_preference"), // phone, email, text
  status: varchar("status").default("new"), // new, contacted, qualified, matched, closed
  routingType: varchar("routing_type"), // direct, top3, call_now
  calculatorData: jsonb("calculator_data"),
  utmData: jsonb("utm_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead routing and assignment
export const leadAssignments = pgTable("lead_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  contractorId: varchar("contractor_id").notNull(),
  status: varchar("status").default("pending"), // pending, accepted, declined, expired
  assignedAt: timestamp("assigned_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
});

// Contractor verification documents
export const verificationDocuments = pgTable("verification_documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  type: varchar("type").notNull(), // license, insurance, id
  fileName: varchar("file_name").notNull(),
  fileUrl: varchar("file_url").notNull(),
  status: varchar("status").default("pending"), // pending, approved, rejected
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Growth Pack downloads
export const growthPackDownloads = pgTable("growth_pack_downloads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  companyName: varchar("company_name"),
  primaryTrade: varchar("primary_trade"),
  serviceAreas: text("service_areas"),
  companySize: varchar("company_size"),
  hasConsented: boolean("has_consented").default(false),
  downloadToken: varchar("download_token").notNull().unique(),
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Accelerator memberships (one-time purchase, not subscription)
export const acceleratorMemberships = pgTable("accelerator_memberships", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  purchaseAmount: decimal("purchase_amount").notNull(),
  paymentIntentId: varchar("payment_intent_id"),
  status: varchar("status").default("active"), // active, paused, cancelled
  features: jsonb("features").$type<string[]>(),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // if applicable
});

// Pricing data for quote calculators
export const pricingData = pgTable("pricing_data", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  service: varchar("service").notNull(), // painting, roofing, etc
  fips: varchar("fips").notNull(),
  serviceCode: varchar("service_code"),
  inputs: jsonb("inputs"), // input definitions and units
  baseLow: decimal("base_low"),
  baseHigh: decimal("base_high"),
  adjustmentFactors: jsonb("adjustment_factors"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System events and analytics
export const events = pgTable("events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(),
  userId: varchar("user_id"),
  contractorId: varchar("contractor_id"),
  data: jsonb("data"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team member territories
export const territories = pgTable("territories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  stateIds: jsonb("state_ids").$type<string[]>(),
  countyIds: jsonb("county_ids").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  contractor: one(contractors, {
    fields: [users.id],
    references: [contractors.userId],
  }),
  recommendations: many(recommendations),
  leads: many(leads),
  territory: one(territories),
  errorReports: many(errorReports),
  // Social features
  communityPosts: many(communityPosts),
  postLikes: many(postLikes),
  commentLikes: many(commentLikes),
  postComments: many(postComments),
  followers: many(userFollows, { relationName: "UserFollowers" }),
  following: many(userFollows, { relationName: "UserFollowing" }),
  groupMemberships: many(groupMembers),
  createdGroups: many(communityGroups),
  createdRegions: many(regions),
}));

export const contractorsRelations = relations(contractors, ({ one, many }) => ({
  user: one(users, {
    fields: [contractors.userId],
    references: [users.id],
  }),
  trades: many(contractorTrades),
  counties: many(contractorCounties),
  recommendations: many(recommendations),
  leads: many(leads),
  verificationDocs: many(verificationDocuments),
  acceleratorMembership: one(acceleratorMemberships),
  leaderboardStats: many(contractorLeaderboardStats),
}));

export const contractorLeaderboardStatsRelations = relations(
  contractorLeaderboardStats,
  ({ one }) => ({
    contractor: one(contractors, {
      fields: [contractorLeaderboardStats.contractorId],
      references: [contractors.id],
    }),
  })
);

export const countiesRelations = relations(counties, ({ many }) => ({
  contractors: many(contractorCounties),
  leads: many(leads),
}));

export const tradesRelations = relations(trades, ({ many, one }) => ({
  contractors: many(contractorTrades),
  leads: many(leads),
  parent: one(trades, {
    fields: [trades.parentId],
    references: [trades.id],
  }),
  children: many(trades),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  contractor: one(contractors, {
    fields: [recommendations.contractorId],
    references: [contractors.id],
  }),
  user: one(users, {
    fields: [recommendations.userId],
    references: [users.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, {
    fields: [leads.userId],
    references: [users.id],
  }),
  contractor: one(contractors, {
    fields: [leads.contractorId],
    references: [contractors.id],
  }),
  county: one(counties, {
    fields: [leads.countyId],
    references: [counties.id],
  }),
  trade: one(trades, {
    fields: [leads.tradeId],
    references: [trades.id],
  }),
  assignments: many(leadAssignments),
}));

// Type exports
export type InsertUser = typeof users.$inferInsert;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertTrustedDevice = typeof trustedDevices.$inferInsert;

// Social Posts table
export const socialPosts = pgTable("social_posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  authorId: varchar("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  postType: postTypeEnum("post_type").default("general"),
  privacyLevel: privacyLevelEnum("privacy_level").default("neighborhood"),
  images: jsonb("images").$type<string[]>(),
  location: varchar("location"), // neighborhood/area reference
  county: varchar("county"),
  state: varchar("state"),
  tags: jsonb("tags").$type<string[]>(),
  mentionedUsers: jsonb("mentioned_users").$type<string[]>(),
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  isPinned: boolean("is_pinned").default(false),
  isArchived: boolean("is_archived").default(false),
  viewCount: integer("view_count").default(0),
  shareCount: integer("share_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Saved social posts (bookmarks)
export const socialPostSaves = pgTable(
  "social_post_saves",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("social_post_saves_user_post_uidx").on(table.userId, table.postId),
    index("idx_social_post_saves_user").on(table.userId),
    index("idx_social_post_saves_post").on(table.postId),
  ]
);

// Post reactions table
export const postReactions = pgTable(
  "post_reactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reactionType: reactionTypeEnum("reaction_type").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_post_reactions_post").on(table.postId),
    index("idx_post_reactions_user").on(table.userId),
  ]
);

// Post comments table
export const postComments = pgTable(
  "post_comments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    authorId: varchar("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: varchar("parent_comment_id"), // for reply threads
    content: text("content").notNull(),
    images: jsonb("images").$type<string[]>(),
    mentionedUsers: jsonb("mentioned_users").$type<string[]>(),
    isEdited: boolean("is_edited").default(false),
    editedAt: timestamp("edited_at"),
    likeCount: integer("like_count").default(0),
    replyCount: integer("reply_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_post_comments_post").on(table.postId),
    index("idx_post_comments_parent").on(table.parentCommentId),
  ]
);

// Comment reactions table
export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    commentId: varchar("comment_id")
      .notNull()
      .references(() => postComments.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reactionType: reactionTypeEnum("reaction_type").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_comment_reactions_comment").on(table.commentId),
    index("idx_comment_reactions_user").on(table.userId),
  ]
);

// Post shares table
export const postShares = pgTable(
  "post_shares",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shareMessage: text("share_message"),
    privacyLevel: privacyLevelEnum("privacy_level").default("neighborhood"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_post_shares_post").on(table.postId),
    index("idx_post_shares_user").on(table.userId),
  ]
);

// Following relationships table
export const userFollows = pgTable(
  "user_follows",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    followerId: varchar("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: varchar("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_user_follows_follower").on(table.followerId),
    index("idx_user_follows_following").on(table.followingId),
  ]
);

// Contact permissions (one-time approval for first contact)
export const contactPermissions = pgTable(
  "contact_permissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requesterId: varchar("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: varchar("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: contactPermissionStatusEnum("status").default("pending"),
    lastRequestType: varchar("last_request_type"),
    lastRequestPreview: text("last_request_preview"),
    lastRequestNotificationId: varchar("last_request_notification_id"),
    authorityGate: varchar("authority_gate", { length: 30 }),
    sourceDecisionCardId: varchar("source_decision_card_id"),
    sourceScoutRecommendationId: varchar("source_scout_recommendation_id"),
    intent: varchar("intent"),
    decisionScope: text("decision_scope"),
    confidenceScore: decimal("confidence_score", { precision: 4, scale: 3 }),
    riskFlags: text("risk_flags").array(),
    countyFips: varchar("county_fips", { length: 5 }),
    requesterTrustSnapshotId: varchar("requester_trust_snapshot_id"),
    targetTrustSnapshotId: varchar("target_trust_snapshot_id"),
    respondedAt: timestamp("responded_at"),
    respondedBy: varchar("responded_by").references(() => users.id),
    responseReason: text("response_reason"),
    cooldownUntil: timestamp("cooldown_until"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_contact_permissions_pair").on(table.requesterId, table.targetUserId),
    index("idx_contact_permissions_target").on(table.targetUserId),
    index("idx_contact_permissions_requester").on(table.requesterId),
    index("idx_contact_permissions_status").on(table.status),
    index("idx_contact_permissions_county").on(table.countyFips),
  ]
);

export const decisionCards = pgTable(
  "decision_cards",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status").notNull().default("active"), // active, completed, archived
    intent: varchar("intent").notNull(),
    decisionScope: text("decision_scope"),
    title: varchar("title"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    decidedAt: timestamp("decided_at"),
  },
  (table) => [index("idx_decision_cards_user").on(table.userId)]
);

export const trustSnapshots = pgTable(
  "trust_snapshots",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    countyFips: varchar("county_fips", { length: 5 }).notNull(),
    // Performance is capped at 100; audited policy boosts may make the total exceed 100.
    cvsScore: decimal("cvs_score", { precision: 5, scale: 2 }).notNull(),
    verificationStatus: varchar("verification_status"),
    licenseStatus: varchar("license_status"),
    insuranceStatus: varchar("insurance_status"),
    riskFlags: text("risk_flags").array(),
    computedAt: timestamp("computed_at").defaultNow(),
    version: integer("version").default(1),
  },
  (table) => [index("idx_trust_snapshots_user_county").on(table.userId, table.countyFips)]
);

export const contactPermissionEvents = pgTable(
  "contact_permission_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    contactPermissionId: varchar("contact_permission_id").references(() => contactPermissions.id, {
      onDelete: "cascade",
    }),
    requesterId: varchar("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: varchar("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id").references(() => users.id),
    eventType: varchar("event_type").notNull(),
    fromStatus: contactPermissionStatusEnum("from_status"),
    toStatus: contactPermissionStatusEnum("to_status"),
    reasonCode: varchar("reason_code"),
    metadata: jsonb("metadata"),
    authorityGate: varchar("authority_gate", { length: 30 }),
    sourceDecisionCardId: varchar("source_decision_card_id"),
    sourceScoutRecommendationId: varchar("source_scout_recommendation_id"),
    intent: varchar("intent"),
    decisionScope: text("decision_scope"),
    confidenceScore: decimal("confidence_score", { precision: 4, scale: 3 }),
    riskFlags: text("risk_flags").array(),
    countyFips: varchar("county_fips", { length: 5 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_contact_permission_events_pair").on(table.requesterId, table.targetUserId),
    index("idx_contact_permission_events_contact").on(table.contactPermissionId),
  ]
);

// Content reports table
export const contentReports = pgTable(
  "content_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    reporterId: varchar("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: varchar("reported_user_id").references(() => users.id, { onDelete: "cascade" }),
    postId: varchar("post_id").references(() => socialPosts.id, { onDelete: "cascade" }),
    commentId: varchar("comment_id").references(() => postComments.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    description: text("description"),
    status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
    reviewedBy: varchar("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_content_reports_reporter").on(table.reporterId),
    index("idx_content_reports_status").on(table.status),
  ]
);

// Community moderation votes - for upvoting/downvoting posts and comments
export const moderationVotes = pgTable(
  "moderation_votes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    voterId: varchar("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: varchar("target_type").notNull(), // 'post', 'comment', 'report'
    targetId: varchar("target_id").notNull(), // ID of the post, comment, or report
    voteType: varchar("vote_type").notNull(), // 'upvote', 'downvote', 'flag', 'hide'
    reason: varchar("reason"), // optional reason for moderation action
    weight: integer("weight").default(1), // vote weight (based on user reputation)
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_moderation_votes_target").on(table.targetType, table.targetId),
    index("idx_moderation_votes_voter").on(table.voterId),
  ]
);

// Community moderation thresholds and scores
export const moderationScores = pgTable(
  "moderation_scores",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    targetType: varchar("target_type").notNull(), // 'post', 'comment'
    targetId: varchar("target_id").notNull(),
    upvoteCount: integer("upvote_count").default(0),
    downvoteCount: integer("downvote_count").default(0),
    flagCount: integer("flag_count").default(0),
    hideCount: integer("hide_count").default(0),
    communityScore: integer("community_score").default(0), // calculated score
    isHidden: boolean("is_hidden").default(false), // hidden by community votes
    isFlagged: boolean("is_flagged").default(false), // flagged for review
    lastCalculated: timestamp("last_calculated").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_moderation_scores_target").on(table.targetType, table.targetId),
    index("idx_moderation_scores_score").on(table.communityScore),
    index("idx_moderation_scores_flagged").on(table.isFlagged),
  ]
);

// User reputation for voting weight
export const userReputation = pgTable(
  "user_reputation",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reputationScore: integer("reputation_score").default(100), // starting reputation
    helpfulVotes: integer("helpful_votes").default(0), // votes marked as helpful
    harmfulVotes: integer("harmful_votes").default(0), // votes marked as harmful
    moderationAccuracy: decimal("moderation_accuracy", { precision: 5, scale: 4 }).default(
      "0.5000"
    ), // 50% default
    voteWeight: decimal("vote_weight", { precision: 3, scale: 2 }).default("1.00"), // calculated weight
    isTrustedModerator: boolean("is_trusted_moderator").default(false),
    lastUpdated: timestamp("last_updated").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_user_reputation_user").on(table.userId),
    index("idx_user_reputation_score").on(table.reputationScore),
  ]
);

// Neighborhood boundaries table
export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    county: varchar("county").notNull(),
    state: varchar("state").notNull(),
    zipCodes: jsonb("zip_codes").$type<string[]>(),
    boundaries: jsonb("boundaries"), // GeoJSON polygon data
    centerLat: decimal("center_lat"),
    centerLng: decimal("center_lng"),
    memberCount: integer("member_count").default(0),
    moderatorIds: jsonb("moderator_ids").$type<string[]>(),
    description: text("description"),
    guidelines: text("guidelines"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_neighborhoods_county_state").on(table.county, table.state)]
);

// Relations for social features
export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
  author: one(users, { fields: [socialPosts.authorId], references: [users.id] }),
  reactions: many(postReactions),
  shares: many(postShares),
  reports: many(contentReports),
}));

export const socialPostSavesRelations = relations(socialPostSaves, ({ one }) => ({
  post: one(socialPosts, { fields: [socialPostSaves.postId], references: [socialPosts.id] }),
  user: one(users, { fields: [socialPostSaves.userId], references: [users.id] }),
}));

// Type-only exports for main tables used in routes and db stub
export type AffiliateAccount = typeof affiliateAccounts.$inferSelect;
export type AffiliateReferral = typeof affiliateReferrals.$inferSelect;
export type AffiliatePayout = typeof affiliatePayouts.$inferSelect;

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(socialPosts, { fields: [postReactions.postId], references: [socialPosts.id] }),
  user: one(users, { fields: [postReactions.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one, many }) => ({
  post: one(communityPosts, { fields: [postComments.postId], references: [communityPosts.id] }),
  author: one(users, { fields: [postComments.authorId], references: [users.id] }),
  parentComment: one(postComments, {
    fields: [postComments.parentCommentId],
    references: [postComments.id],
  }),
  replies: many(postComments),
  reactions: many(commentReactions),
  reports: many(contentReports),
}));

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
  comment: one(postComments, {
    fields: [commentReactions.commentId],
    references: [postComments.id],
  }),
  user: one(users, { fields: [commentReactions.userId], references: [users.id] }),
}));

export const postSharesRelations = relations(postShares, ({ one }) => ({
  post: one(socialPosts, { fields: [postShares.postId], references: [socialPosts.id] }),
  user: one(users, { fields: [postShares.userId], references: [users.id] }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, { fields: [userFollows.followerId], references: [users.id] }),
  following: one(users, { fields: [userFollows.followingId], references: [users.id] }),
}));

export const contentReportsRelations = relations(contentReports, ({ one }) => ({
  reporter: one(users, { fields: [contentReports.reporterId], references: [users.id] }),
  reportedUser: one(users, { fields: [contentReports.reportedUserId], references: [users.id] }),
  post: one(socialPosts, { fields: [contentReports.postId], references: [socialPosts.id] }),
  comment: one(postComments, { fields: [contentReports.commentId], references: [postComments.id] }),
  reviewer: one(users, { fields: [contentReports.reviewedBy], references: [users.id] }),
}));

export const neighborhoodsRelations = relations(neighborhoods, ({ many }) => ({
  posts: many(socialPosts),
}));

// Moderation system relations
export const moderationVotesRelations = relations(moderationVotes, ({ one }) => ({
  voter: one(users, { fields: [moderationVotes.voterId], references: [users.id] }),
}));

export const moderationScoresRelations = relations(moderationScores, ({ many }) => ({
  votes: many(moderationVotes),
}));

export const userReputationRelations = relations(userReputation, ({ one }) => ({
  user: one(users, { fields: [userReputation.userId], references: [users.id] }),
}));

// Contractor applications table
export const contractorApplications = pgTable(
  "contractor_applications",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id"),
    companyName: varchar("company_name").notNull(),
    email: varchar("email").notNull(),
    phone: varchar("phone").notNull(),
    website: varchar("website"),
    primaryState: varchar("primary_state").notNull(),
    primaryCounty: varchar("primary_county").notNull(),
    serviceRadius: varchar("service_radius").notNull(),
    yearsInBusiness: integer("years_in_business").notNull(),
    licenseNumber: varchar("license_number").notNull(),
    insuranceProvider: varchar("insurance_provider").notNull(),
    primaryTrade: varchar("primary_trade").notNull(),
    specialties: jsonb("specialties").$type<string[]>().notNull(),
    about: text("about").notNull(),
    preferredContact: varchar("preferred_contact").notNull(), // phone, email, both
    agreeToTerms: boolean("agree_to_terms").notNull(),
    agreeToVerification: boolean("agree_to_verification").notNull(),
    status: varchar("status").default("pending"), // pending, under_review, approved, rejected
    starterPath: boolean("starter_path").default(true).notNull(),
    verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
    reviewNotes: text("review_notes"),
    reviewedBy: varchar("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    contractorId: varchar("contractor_id"), // Set when approved and contractor created
    submittedAt: timestamp("submitted_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_contractor_applications_user").on(table.userId),
    index("idx_contractor_applications_email").on(table.email),
    index("idx_contractor_applications_status").on(table.status),
    index("idx_contractor_applications_submitted").on(table.submittedAt),
  ]
);

// Insert schemas for forms
export const insertContractorApplicationSchema = createInsertSchema(contractorApplications).omit({
  id: true,
  status: true,
  userId: true,
  starterPath: true,
  verificationStatus: true,
  reviewNotes: true,
  reviewedBy: true,
  reviewedAt: true,
  contractorId: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  shareCount: true,
  isEdited: true,
  editedAt: true,
  isPinned: true,
  isArchived: true,
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likeCount: true,
  replyCount: true,
  isEdited: true,
  editedAt: true,
});

export const insertPostReactionSchema = createInsertSchema(postReactions).omit({
  id: true,
  createdAt: true,
});

export const insertPostShareSchema = createInsertSchema(postShares).omit({
  id: true,
  createdAt: true,
});

export const insertContentReportSchema = createInsertSchema(contentReports).omit({
  id: true,
  createdAt: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
});

// Smart Recommendation Generator tables
export const recommendationInsights = pgTable("recommendation_insights", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),

  // Performance metrics
  totalRecommendations: integer("total_recommendations").default(0),
  positiveRecommendations: integer("positive_recommendations").default(0),
  negativeRecommendations: integer("negative_recommendations").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),

  // Analysis insights
  topStrengths: jsonb("top_strengths").$type<string[]>().default([]),
  improvementAreas: jsonb("improvement_areas").$type<string[]>().default([]),
  suggestedActions: jsonb("suggested_actions")
    .$type<
      {
        action: string;
        priority: "high" | "medium" | "low";
        impact: string;
        difficulty: string;
      }[]
    >()
    .default([]),

  // Visibility metrics
  profileViews: integer("profile_views").default(0),
  inquiryRate: decimal("inquiry_rate", { precision: 5, scale: 2 }).default("0"),
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }).default("0"),

  // Competitive analysis
  marketPosition: varchar("market_position"), // 'top_performer', 'above_average', 'average', 'below_average'
  competitorComparison: jsonb("competitor_comparison").$type<{
    totalContractors: number;
    betterThan: number;
    percentile: number;
  }>(),

  // AI recommendations
  aiRecommendations: jsonb("ai_recommendations")
    .$type<
      {
        category: string;
        suggestion: string;
        impact: "high" | "medium" | "low";
        timeframe: string;
      }[]
    >()
    .default([]),

  lastAnalyzedAt: timestamp("last_analyzed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recommendationGoals = pgTable("recommendation_goals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),

  // Goal targets
  targetRecommendations: integer("target_recommendations").notNull(),
  targetRating: decimal("target_rating", { precision: 3, scale: 2 }).notNull(),
  targetTimeframe: varchar("target_timeframe").notNull(), // '30_days', '90_days', '6_months', '1_year'

  // Progress tracking
  startingRecommendations: integer("starting_recommendations").default(0),
  currentProgress: decimal("current_progress", { precision: 5, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),

  // Milestone tracking
  milestones: jsonb("milestones")
    .$type<
      {
        target: number;
        achievedAt?: string;
        reward?: string;
      }[]
    >()
    .default([]),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recommendationCampaigns = pgTable("recommendation_campaigns", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),

  // Campaign details
  name: varchar("name").notNull(),
  description: text("description"),
  campaignType: varchar("campaign_type").notNull(), // 'email_followup', 'text_reminder', 'personal_ask', 'incentive_offer'

  // Target audience
  targetCustomers: jsonb("target_customers")
    .$type<
      {
        projectType?: string;
        projectValue?: number;
        completionDate?: string;
        email?: string;
        phone?: string;
      }[]
    >()
    .default([]),

  // Campaign settings
  isActive: boolean("is_active").default(true),
  sendAt: timestamp("send_at"),
  frequency: varchar("frequency"), // 'once', 'weekly', 'monthly'

  // Templates
  emailTemplate: text("email_template"),
  textTemplate: text("text_template"),
  incentiveOffer: text("incentive_offer"),

  // Results tracking
  totalSent: integer("total_sent").default(0),
  totalOpened: integer("total_opened").default(0),
  totalResponded: integer("total_responded").default(0),
  totalRecommendations: integer("total_recommendations").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for recommendation generator
export const recommendationInsightsRelations = relations(recommendationInsights, ({ one }) => ({
  contractor: one(contractors, {
    fields: [recommendationInsights.contractorId],
    references: [contractors.id],
  }),
}));

export const recommendationGoalsRelations = relations(recommendationGoals, ({ one }) => ({
  contractor: one(contractors, {
    fields: [recommendationGoals.contractorId],
    references: [contractors.id],
  }),
}));

export const recommendationCampaignsRelations = relations(recommendationCampaigns, ({ one }) => ({
  contractor: one(contractors, {
    fields: [recommendationCampaigns.contractorId],
    references: [contractors.id],
  }),
}));

// Insert schemas for recommendation generator
export const insertRecommendationInsightSchema = createInsertSchema(recommendationInsights).omit({
  id: true,
  lastAnalyzedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationGoalSchema = createInsertSchema(recommendationGoals).omit({
  id: true,
  currentProgress: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationCampaignSchema = createInsertSchema(recommendationCampaigns).omit({
  id: true,
  totalSent: true,
  totalOpened: true,
  totalResponded: true,
  totalRecommendations: true,
  createdAt: true,
  updatedAt: true,
});

// Recommendation Generator Types
export type RecommendationInsight = typeof recommendationInsights.$inferSelect;
export type InsertRecommendationInsight = z.infer<typeof insertRecommendationInsightSchema>;
export type RecommendationGoal = typeof recommendationGoals.$inferSelect;
export type InsertRecommendationGoal = z.infer<typeof insertRecommendationGoalSchema>;
export type RecommendationCampaign = typeof recommendationCampaigns.$inferSelect;
export type InsertRecommendationCampaign = z.infer<typeof insertRecommendationCampaignSchema>;

// Types
export type SocialPost = typeof socialPosts.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type PostReaction = typeof postReactions.$inferSelect;
export type PostShare = typeof postShares.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;
export type ContactPermission = typeof contactPermissions.$inferSelect;
export type ContactPermissionEvent = typeof contactPermissionEvents.$inferSelect;
export type DecisionCard = typeof decisionCards.$inferSelect;
export type TrustSnapshot = typeof trustSnapshots.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
export type Neighborhood = typeof neighborhoods.$inferSelect;

export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;

export type SocialPostSave = typeof socialPostSaves.$inferSelect;
export type InsertSocialPostSave = typeof socialPostSaves.$inferInsert;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type InsertPostReaction = z.infer<typeof insertPostReactionSchema>;
export type InsertPostShare = z.infer<typeof insertPostShareSchema>;
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;

// Moderation schemas
export const insertModerationVoteSchema = createInsertSchema(moderationVotes).omit({
  id: true,
  createdAt: true,
  isActive: true,
  weight: true,
});

export const insertModerationScoreSchema = createInsertSchema(moderationScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCalculated: true,
  communityScore: true,
});

export const insertUserReputationSchema = createInsertSchema(userReputation).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
  voteWeight: true,
  moderationAccuracy: true,
});

// Moderation types
export type ModerationVote = typeof moderationVotes.$inferSelect;
export type InsertModerationVote = z.infer<typeof insertModerationVoteSchema>;

export type ModerationScore = typeof moderationScores.$inferSelect;
export type InsertModerationScore = z.infer<typeof insertModerationScoreSchema>;

export type UserReputation = typeof userReputation.$inferSelect;
export type InsertUserReputation = z.infer<typeof insertUserReputationSchema>;

// Marketplace conversation types
export type MarketplaceConversation = typeof marketplaceConversations.$inferSelect;
export type InsertMarketplaceConversation = typeof marketplaceConversations.$inferInsert;
export type MarketplaceMessage = typeof marketplaceMessages.$inferSelect;
export type InsertMarketplaceMessage = typeof marketplaceMessages.$inferInsert;

// Additional social feature types (avoiding duplicates)
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;

export type PostLike = typeof postLikes.$inferSelect;
export type InsertPostLike = typeof postLikes.$inferInsert;

export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = typeof commentLikes.$inferInsert;

export type CommunityGroup = typeof communityGroups.$inferSelect;
export type InsertCommunityGroup = typeof communityGroups.$inferInsert;

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = typeof groupMembers.$inferInsert;

export type GroupCountyLink = typeof groupCountyLinks.$inferSelect;
export type InsertGroupCountyLink = typeof groupCountyLinks.$inferInsert;

export type Region = typeof regions.$inferSelect;
export type InsertRegion = typeof regions.$inferInsert;

// Admin configuration tables for dynamic content management
export const siteSettings = pgTable("site_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'prizes', 'ads', 'features', 'content'
  key: varchar("key").notNull(),
  value: jsonb("value").notNull(),
  description: varchar("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const prizeConfigurations = pgTable("prize_configurations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  prizeType: varchar("prize_type").notNull(), // 'gift_card', 'discount', 'premium_features'
  value: varchar("value").notNull(), // Amount or percentage
  vendor: varchar("vendor"), // Home Depot, Lowes, etc.
  isActive: boolean("is_active").default(true),
  probability: decimal("probability", { precision: 5, scale: 4 }).default("0.0500"), // 5% default
  terms: text("terms"),
  expirationDays: integer("expiration_days").default(30),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const advertisements = pgTable("advertisements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url"),
  linkUrl: varchar("link_url"),
  placement: varchar("placement").notNull(), // 'banner', 'sidebar', 'popup', 'footer', 'site_visit'
  targetAudience: varchar("target_audience").default("all"), // 'homeowners', 'contractors', 'all'
  targetLocation: varchar("target_location").notNull().default("national"), // 'national', 'state:CA', 'county:06001'
  priority: integer("priority").default(0), // Higher priority ads shown first
  isActive: boolean("is_active").default(true),
  isAffiliate: boolean("is_affiliate").default(false),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  clickCount: integer("click_count").default(0),
  viewCount: integer("view_count").default(0),
  impressions: integer("impressions").default(0),
  communityScore: integer("community_score").default(50), // Community Value Score (0-100)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractorSettings = pgTable("contractor_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'verification', 'pricing', 'project_routing'
  setting: varchar("setting").notNull(),
  value: jsonb("value").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;
export type PrizeConfiguration = typeof prizeConfigurations.$inferSelect;
export type InsertPrizeConfiguration = typeof prizeConfigurations.$inferInsert;
export type Advertisement = typeof advertisements.$inferSelect;
export type InsertAdvertisement = typeof advertisements.$inferInsert;
export type ContractorSetting = typeof contractorSettings.$inferSelect;
export type InsertContractorSetting = typeof contractorSettings.$inferInsert;

// Saved ads for users
export const savedAds = pgTable("saved_ads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  adId: varchar("ad_id")
    .notNull()
    .references(() => advertisements.id),
  savedAt: timestamp("saved_at").defaultNow(),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").default(0),
  isActive: boolean("is_active").default(true),
});

export type SavedAd = typeof savedAds.$inferSelect;
export type InsertSavedAd = typeof savedAds.$inferInsert;

// Per-ad feedback to drive Community Value Score (CVS)
export const adFeedback = pgTable(
  "ad_feedback",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    adId: varchar("ad_id")
      .notNull()
      .references(() => advertisements.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    rating: varchar("rating", { length: 32 }).notNull(), // 'helpful' | 'not_relevant' | 'spam'
    source: varchar("source", { length: 32 }).notNull(), // 'scout' | 'site_visit' | 'saved'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // One feedback per user per ad
    index("idx_ad_feedback_ad").on(table.adId),
    index("idx_ad_feedback_user").on(table.userId),
  ]
);

export type AdFeedback = typeof adFeedback.$inferSelect;
export type InsertAdFeedback = typeof adFeedback.$inferInsert;

// Per-user ad event log (surface-level performance tracking)
export const adEvents = pgTable("ad_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adId: varchar("ad_id")
    .notNull()
    .references(() => advertisements.id),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'impression' | 'click'
  source: varchar("source", { length: 50 }).notNull(), // 'site_visit' | 'scout' | 'saved' | 'unknown'
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AdEvent = typeof adEvents.$inferSelect;
export type InsertAdEvent = typeof adEvents.$inferInsert;

// Ad events for surface-level performance tracking
// Note: Notification system moved to comprehensive notification tables below

export type InsertContractor = typeof contractors.$inferInsert;
export type Contractor = typeof contractors.$inferSelect;

export type InsertProviderDeclaration = typeof providerDeclarations.$inferInsert;
export type ProviderDeclaration = typeof providerDeclarations.$inferSelect;

export type InsertProviderLocalStat = typeof providerLocalStats.$inferInsert;
export type ProviderLocalStat = typeof providerLocalStats.$inferSelect;

export type InsertRecommendation = typeof recommendations.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;

export type InsertContractorLeaderboardStats = typeof contractorLeaderboardStats.$inferInsert;
export type ContractorLeaderboardStats = typeof contractorLeaderboardStats.$inferSelect;

export type InsertLead = typeof leads.$inferInsert;
export type Lead = typeof leads.$inferSelect;

export type InsertCounty = typeof counties.$inferInsert;
export type County = typeof counties.$inferSelect;

export type InsertTrade = typeof trades.$inferInsert;
export type Trade = typeof trades.$inferSelect;

export type InsertTradeRequirement = typeof tradeRequirements.$inferInsert;
export type TradeRequirement = typeof tradeRequirements.$inferSelect;

export type InsertBusinessVerification = typeof businessVerifications.$inferInsert;
export type BusinessVerification = typeof businessVerifications.$inferSelect;

export type InsertGrowthPackDownload = typeof growthPackDownloads.$inferInsert;
export type GrowthPackDownload = typeof growthPackDownloads.$inferSelect;

// Worker marketplace system for task-based work
export const workers = pgTable("workers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email").notNull(),
  profileImageUrl: varchar("profile_image_url"),
  bio: text("bio"),
  skills: jsonb("skills").$type<string[]>(),
  hourlyRate: decimal("hourly_rate"),
  availableHours: jsonb("available_hours").$type<{
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  }>(),
  transportationMethod: varchar("transportation_method"),
  maxTravelDistance: integer("max_travel_distance"), // in miles

  // Verification status
  isIdVerified: boolean("is_id_verified").default(false),
  isBackgroundChecked: boolean("is_background_checked").default(false),
  verificationDocuments: jsonb("verification_documents").$type<{
    driversLicense?: string;
    passport?: string;
    backgroundCheck?: string;
    references?: string[];
  }>(),
  verificationStatus: varchar("verification_status", {
    enum: ["pending", "in_review", "approved", "rejected"],
  }).default("pending"),
  verifiedAt: timestamp("verified_at"),

  // Work history and ratings
  totalJobsCompleted: integer("total_jobs_completed").default(0),
  averageRating: decimal("average_rating"),
  totalEarnings: decimal("total_earnings").default("0"),

  // Resume information
  workExperience: jsonb("work_experience").$type<
    Array<{
      jobTitle: string;
      company: string;
      startDate: string;
      endDate?: string;
      description: string;
      isCurrentJob: boolean;
      fromPlatform: boolean; // If this job was obtained through TradeScout
      taskId?: string; // Reference to platform task if applicable
    }>
  >(),
  education: jsonb("education").$type<
    Array<{
      degree: string;
      school: string;
      graduationYear?: number;
      fieldOfStudy?: string;
    }>
  >(),
  certifications: jsonb("certifications").$type<
    Array<{
      name: string;
      issuer: string;
      issueDate: string;
      expirationDate?: string;
      credentialId?: string;
    }>
  >(),
  portfolioItems: jsonb("portfolio_items").$type<
    Array<{
      title: string;
      description: string;
      imageUrl?: string;
      completionDate: string;
      skills: string[];
      fromPlatform: boolean;
      taskId?: string;
    }>
  >(),

  // Account status
  isActive: boolean("is_active").default(true),
  isAvailable: boolean("is_available").default(true),
  lastActiveAt: timestamp("last_active_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskCategories = pgTable("task_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  iconName: varchar("icon_name"), // Lucide icon name
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  posterId: varchar("poster_id").notNull(), // user who posted the task
  posterType: varchar("poster_type", { enum: ["contractor", "homeowner"] }).notNull(),

  title: varchar("title").notNull(),
  description: text("description").notNull(),
  categoryId: varchar("category_id"),

  // Location
  address: varchar("address"),
  city: varchar("city"),
  stateCode: varchar("state_code", { length: 2 }),
  zipCode: varchar("zip_code"),
  countyFips: varchar("county_fips"),

  // Task details
  taskType: varchar("task_type", {
    enum: ["one_time", "recurring", "project_based"],
  }).notNull(),
  estimatedHours: decimal("estimated_hours"),
  payType: varchar("pay_type", {
    enum: ["hourly", "fixed", "per_task"],
  }).notNull(),
  payAmount: decimal("pay_amount").notNull(),
  payMin: decimal("pay_min"),
  payMax: decimal("pay_max"),

  // Requirements
  requiredSkills: jsonb("required_skills").$type<string[]>(),
  requiresTransportation: boolean("requires_transportation").default(false),
  requiresTools: boolean("requires_tools").default(false),
  toolsProvided: boolean("tools_provided").default(false),
  physicalDemands: varchar("physical_demands", {
    enum: ["light", "moderate", "heavy"],
  }),

  // Scheduling
  schedulingType: varchar("scheduling_type", {
    enum: ["asap", "scheduled", "flexible"],
  }).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  preferredTimes: jsonb("preferred_times").$type<{
    weekdays?: boolean;
    weekends?: boolean;
    mornings?: boolean;
    afternoons?: boolean;
    evenings?: boolean;
  }>(),

  // Verification requirements
  requiresIdVerification: boolean("requires_id_verification").default(true),
  requiresBackgroundCheck: boolean("requires_background_check").default(false),
  minimumRating: decimal("minimum_rating"),
  minimumJobsCompleted: integer("minimum_jobs_completed"),

  // Task status
  status: varchar("status", {
    enum: ["open", "assigned", "in_progress", "completed", "cancelled"],
  }).default("open"),
  assignedWorkerId: varchar("assigned_worker_id"),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),

  // Attachments
  attachments: jsonb("attachments").$type<string[]>(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employmentPostTypeEnum = pgEnum("employment_post_type", ["job", "resume"]);
export const employmentPostStatusEnum = pgEnum("employment_post_status", ["open", "closed"]);

export const employmentPosts = pgTable("employment_posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  createdByUserId: varchar("created_by_user_id").notNull(),

  postType: employmentPostTypeEnum("post_type").notNull(),
  status: employmentPostStatusEnum("status").default("open"),

  title: varchar("title", { length: 140 }).notNull(),
  body: text("body").notNull(),

  countyFips: varchar("county_fips", { length: 5 }).notNull(),
  stateCode: varchar("state_code", { length: 2 }),
  city: varchar("city", { length: 80 }),

  tradeId: varchar("trade_id", { length: 80 }),

  payMin: decimal("pay_min"),
  payMax: decimal("pay_max"),
  payUnit: varchar("pay_unit", { length: 16 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Applications to employment posts (job or resume posts)
export const employmentPostApplications = pgTable(
  "employment_post_applications",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => employmentPosts.id, { onDelete: "cascade" }),
    applicantUserId: varchar("applicant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message"),
    // 'pending' | 'shortlisted' | 'rejected' | 'withdrawn'
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_epa_post_applicant").on(table.postId, table.applicantUserId),
    index("idx_epa_post_id").on(table.postId),
    index("idx_epa_applicant").on(table.applicantUserId),
  ]
);

export const taskApplications = pgTable("task_applications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  workerId: varchar("worker_id").notNull(),

  message: text("message"),
  proposedRate: decimal("proposed_rate"),
  estimatedDuration: varchar("estimated_duration"),
  availableStartDate: timestamp("available_start_date"),

  status: varchar("status", {
    enum: ["pending", "accepted", "rejected", "withdrawn"],
  }).default("pending"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workerReviews = pgTable("worker_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  reviewerId: varchar("reviewer_id").notNull(), // poster who hired the worker

  rating: integer("rating").notNull(), // 1-5 stars
  reviewText: text("review_text"),

  // Specific rating categories
  qualityRating: integer("quality_rating"),
  timelinessRating: integer("timeliness_rating"),
  communicationRating: integer("communication_rating"),
  professionalismRating: integer("professionalism_rating"),

  wouldHireAgain: boolean("would_hire_again"),
  isPublic: boolean("is_public").default(true),

  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationRequests = pgTable("verification_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workerId: varchar("worker_id").notNull(),
  requestType: varchar("request_type", {
    enum: ["id_verification", "background_check", "reference_check"],
  }).notNull(),

  status: varchar("status", {
    enum: ["pending", "in_review", "approved", "rejected", "expired"],
  }).default("pending"),

  submittedDocuments: jsonb("submitted_documents").$type<
    {
      documentType: string;
      documentUrl: string;
      uploadedAt: string;
    }[]
  >(),

  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Objectives Layer (Universal Intent Persistence)
// ============================================================================

// Intent classification enum - maps Scout intent + user context to objective type
export const objectiveIntentClassEnum = pgEnum("objective_intent_class", [
  "unknown", // Unclassified or low-confidence intent
  "knowledge", // Research/learning (no object creation)
  "local_advice", // Asking for recommendations or local context
  "work_request", // Hiring/project intent -> promotes to workRequests
  "marketplace_buy", // Shopping intent -> routing to search/browse
  "marketplace_sell", // Selling intent -> promotes to marketplace listing
  "community_post", // Social/community intent -> draft community post
  "event", // Planning/scheduling intent -> draft event (Phase 2)
  "safety_report", // Safety/issue reporting -> routing/draft report
  "account", // Account or profile management
  "admin", // Administrative action
  "other", // Fallback for unspecified intent
]);

// Objective status enum - tracks user's relationship to this objective
export const objectiveStatusEnum = pgEnum("objective_status", [
  "active", // User is currently working on this objective
  "paused", // User has moved on (new topic or browser session)
  "completed", // User finished (successfully hired, bought, found answer, etc.)
  "abandoned", // User gave up or deleted it
]);

// Objectives table - universal intent persistence layer
// One active per user; new topics auto-pause the previous objective
export const objectives = pgTable(
  "objectives",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // User ownership
    userId: varchar("user_id").notNull(),

    // Intent classification (from Scout classifier + mapping)
    intentClass: objectiveIntentClassEnum("intent_class").default("unknown"),

    // User-friendly title and summary
    title: varchar("title").notNull(),
    summary: text("summary"),

    // Confidence (0-1) that classification is correct; used for auto-promotion
    confidence: numeric("confidence", { precision: 3, scale: 2 }).default("0.5"),

    // Extracted context: location, entities, preferences, constraints
    contextJson: jsonb("context_json").$type<Record<string, any>>(),

    // Source surface (always "scout" for Phase 1)
    source: varchar("source", {
      enum: ["scout"],
    }).default("scout"),

    // Link to concrete object (workRequest, listing, post, etc.)
    // If intent gets promoted into a specific object, track it here
    linkedObjectType: varchar("linked_object_type", {
      enum: ["workRequest", "marketplaceListing", "communityPost", "event", "safetyReport", "none"],
    }).default("none"),
    linkedObjectId: varchar("linked_object_id"),

    // Lifecycle status (user perspective)
    status: objectiveStatusEnum("status").default("active"),

    // Scout interaction reference (optional: link back to scout message thread)
    lastScoutMessageId: varchar("last_scout_message_id"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_objectives_user_id").on(table.userId),
    index("idx_objectives_user_status").on(table.userId, table.status),
    index("idx_objectives_intent_class").on(table.intentClass),
    index("idx_objectives_created_at").on(table.createdAt),
    index("idx_objectives_linked_object").on(table.linkedObjectType, table.linkedObjectId),
  ]
);

// Objective events table (append-only audit log)
// Tracks all transitions and state changes for this objective
export const objectiveEvents = pgTable(
  "objective_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    objectiveId: varchar("objective_id").notNull(),

    // Event type: what happened to this objective
    eventType: varchar("event_type", {
      enum: [
        "created", // New objective created by Scout
        "title_updated", // User renamed it
        "summary_updated", // User edited summary
        "intent_reclassified", // Scout reclassified intent
        "promoted", // Promoted to concrete object (work_request, etc.)
        "status_changed", // Status transition (active -> paused, etc.)
        "deleted", // Objective abandoned/deleted
        "topic_shift", // Detected user moved to new topic (auto-pause)
      ],
    }).notNull(),

    // Optional actor (who/what triggered this event)
    actorUserId: varchar("actor_user_id"),
    actorType: varchar("actor_type", {
      enum: ["user", "system"],
    }),

    // Flexible metadata blob (previous state, reason, classifier scores, etc.)
    metadata: jsonb("metadata").$type<Record<string, any>>(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_objective_events_objective_id").on(table.objectiveId),
    index("idx_objective_events_event_type").on(table.eventType),
    index("idx_objective_events_created_at").on(table.createdAt),
  ]
);

// Work Requests spine (single canonical object for homeowner/provider work)
export const workRequests = pgTable("work_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Who created the request
  createdByUserId: varchar("created_by_user_id").notNull(),

  // Core description
  title: varchar("title").notNull(),
  description: text("description").notNull(),

  // High-level category (contractor, helper, insurance, etc.)
  category: varchar("category"),

  // Optional linked trade for routing (Direct Connect)
  tradeId: varchar("trade_id"),

  // Canonical location
  countyFips: varchar("county_fips", { length: 5 }),
  stateCode: varchar("state_code", { length: 2 }),
  addressId: varchar("address_id"),

  // Where this should be visible / routed
  scope: varchar("scope", {
    enum: ["personal", "community", "group", "hoa", "global"],
  }).default("community"),

  // Source surface that originated the request
  source: varchar("source", {
    enum: ["tasks", "community", "scout", "direct_connect"],
  }).default("tasks"),
  sourceRefId: varchar("source_ref_id"), // e.g. community post id, scout thread id

  // Lifecycle status
  status: varchar("status", {
    enum: ["draft", "open", "routed", "in_progress", "pending_outcome", "completed", "cancelled"],
  }).default("draft"),

  visibility: varchar("visibility", {
    enum: ["public", "community", "private"],
  }).default("community"),
  exposureMode: varchar("exposure_mode", {
    enum: ["guided", "open"],
  }).default("guided"),
  competitionMode: varchar("competition_mode", {
    enum: ["none", "compare_responses"],
  }).default("none"),

  // Optional budget band
  budgetMin: decimal("budget_min"),
  budgetMax: decimal("budget_max"),
  attachments: jsonb("attachments").$type<string[]>().notNull().default([]),
  shareToken: varchar("share_token", { length: 64 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const directConnectGiveawayEntries = pgTable(
  "direct_connect_giveaway_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workRequestId: varchar("work_request_id")
      .notNull()
      .references(() => workRequests.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promotionKey: varchar("promotion_key").notNull().default("direct_connect_giveaway_2026_06"),
    entryMethod: varchar("entry_method", {
      enum: ["direct_connect", "alternate_email"],
    })
      .notNull()
      .default("direct_connect"),
    residencyStateCode: varchar("residency_state_code", { length: 2 }),
    isEligible: boolean("is_eligible").notNull().default(false),
    eligibilityReason: varchar("eligibility_reason").notNull(),
    eligibilitySnapshot: jsonb("eligibility_snapshot").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("dc_giveaway_entries_work_request_unique").on(table.workRequestId),
    index("dc_giveaway_entries_promotion_eligible_idx").on(table.promotionKey, table.isEligible),
    index("dc_giveaway_entries_user_idx").on(table.userId),
  ]
);

// Event log for each work request (append-only history)
export const workRequestEvents = pgTable("work_request_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workRequestId: varchar("work_request_id").notNull(),

  type: varchar("type", {
    enum: [
      "created",
      "updated",
      "sent_to_board",
      "routed",
      "status_changed",
      "exposure_mode_changed",
      "provider_suggested",
      "provider_invited",
      "provider_self_selected",
      "provider_accepted",
      "provider_declined",
      "provider_completed",
      "completed",
      "cancelled",
    ],
  }).notNull(),

  actorUserId: varchar("actor_user_id"),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),

  // Flexible metadata blob (routing scores, reasons, etc.)
  metadata: jsonb("metadata").$type<Record<string, any>>(),

  createdAt: timestamp("created_at").defaultNow(),
});

// Provider assignments per work request
export const workRequestAssignments = pgTable("work_request_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workRequestId: varchar("work_request_id").notNull(),

  // Linked provider: contractor profile ID (legacy, kept for backward compat)
  contractorId: varchar("contractor_id"),
  // Universal provider: any user can be a responder (business owner, helper, handyman, etc.)
  responderUserId: varchar("responder_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Helper/worker profile FK — set when a worker profile is the responder
  workerId: varchar("worker_id").references(() => workers.id, {
    onDelete: "set null",
  }),
  status: varchar("status", {
    enum: ["suggested", "invited", "accepted", "declined", "completed", "withdrawn"],
  }).default("suggested"),

  // Snapshot of why this match was suggested (score + reasons)
  scoreSnapshot: jsonb("score_snapshot").$type<{
    score?: number;
    reasons?: string[];
    distanceMiles?: number;
    tradeMatch?: boolean;
    recommendationCount?: number;
    responseRate?: number;
    routingMode?: string;
  }>(),

  // Structured accept response stored at accept time for requester visibility
  responseSummary: jsonb("response_summary").$type<{
    availabilityWindow?: string;
    priceBand?: "budget" | "standard" | "premium" | "custom_quote";
    scopeNote?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Professional Partnerships (Dealer-Contractor connections)
export const professionalPartnerships = pgTable("professional_partnerships", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Partnership members
  initiatorId: varchar("initiator_id").notNull(), // User who sent partnership request
  partnerId: varchar("partner_id").notNull(), // User who received request

  // Partnership type and details
  partnershipType: varchar("partnership_type", {
    enum: ["dealer_contractor", "contractor_realtor", "realtor_dealer"],
  }).notNull(),

  status: varchar("status", {
    enum: ["pending", "active", "paused", "ended"],
  }).default("pending"),

  // Terms and agreements
  commissionRate: decimal("commission_rate").default("10.00"), // 10% default
  referralTerms: text("referral_terms"),
  partnershipDescription: text("partnership_description"),

  // Success metrics
  totalReferrals: integer("total_referrals").default(0),
  successfulReferrals: integer("successful_referrals").default(0),
  totalCommissionEarned: decimal("total_commission_earned").default("0"),

  // Timestamps
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  lastReferralAt: timestamp("last_referral_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnershipReferrals = pgTable("partnership_referrals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  partnershipId: varchar("partnership_id").notNull(),
  referrerId: varchar("referrer_id").notNull(), // Who made the referral
  customerId: varchar("customer_id").notNull(), // Who was referred

  referralType: varchar("referral_type", {
    enum: ["vehicle_purchase", "home_project", "financing", "insurance"],
  }).notNull(),

  status: varchar("status", {
    enum: ["sent", "contacted", "meeting_scheduled", "deal_closed", "no_sale"],
  }).default("sent"),

  // Deal details
  estimatedValue: decimal("estimated_value"),
  actualValue: decimal("actual_value"),
  commissionAmount: decimal("commission_amount"),

  // Notes and communication
  referralNotes: text("referral_notes"),
  customerMessage: text("customer_message"),
  partnerResponse: text("partner_response"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const errorReports = pgTable("error_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // User information
  userId: varchar("user_id"), // nullable for anonymous reports
  userEmail: varchar("user_email"),

  // Error details
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  errorType: varchar("error_type", {
    enum: ["bug", "ui_issue", "performance", "feature_request", "other"],
  }).default("bug"),

  // Technical details
  currentUrl: text("current_url"),
  userAgent: text("user_agent"),
  browserInfo: jsonb("browser_info").$type<{
    name?: string;
    version?: string;
    platform?: string;
    mobile?: boolean;
  }>(),

  // Screenshots/attachments
  attachments: jsonb("attachments").$type<string[]>(),

  // Admin management
  status: varchar("status", {
    enum: ["open", "in_progress", "resolved", "closed", "duplicate"],
  }).default("open"),
  priority: varchar("priority", {
    enum: ["low", "medium", "high", "critical"],
  }).default("medium"),

  assignedTo: varchar("assigned_to"),
  adminNotes: text("admin_notes"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bot Army: UI failure ingestion (real Playwright events only)
export const botUiFindings = pgTable(
  "bot_ui_findings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    botName: varchar("bot_name", { length: 120 }).notNull(),
    route: varchar("route", { length: 512 }).notNull(),
    actionAttempted: text("action_attempted"),
    expectedOutcome: text("expected_outcome"),
    actualOutcome: text("actual_outcome"),
    failureType: botUiFailureTypeEnum("failure_type").notNull(),
    severity: integer("severity").notNull().default(1),
    screenshotUrl: text("screenshot_url"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("bot_ui_findings_route_idx").on(table.route),
    index("bot_ui_findings_created_idx").on(table.createdAt),
  ]
);

export const lisaFindings = pgTable(
  "lisa_findings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    findingKey: varchar("finding_key", { length: 255 }).notNull(),
    sourceKind: varchar("source_kind", { length: 64 }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull(),
    truthStatus: varchar("truth_status", { length: 16 }).notNull().default("current"),
    scopeType: varchar("scope_type", { length: 32 }).default("global"),
    scopeRef: varchar("scope_ref", { length: 255 }),
    headline: text("headline").notNull(),
    narrative: text("narrative").notNull(),
    evidence: jsonb("evidence")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    freshnessMinutes: integer("freshness_minutes"),
    engineVersion: varchar("engine_version", { length: 64 }),
    runtimeMode: varchar("runtime_mode", { length: 32 }).notNull().default("tradescout_local"),
    runtimeSource: text("runtime_source"),
    evidenceHash: varchar("evidence_hash", { length: 64 }),
    supersedesId: varchar("supersedes_id", { length: 255 }),
    supersededById: varchar("superseded_by_id", { length: 255 }),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("lisa_findings_key_idx").on(table.findingKey),
    index("lisa_findings_status_idx").on(table.truthStatus),
    index("lisa_findings_scope_idx").on(table.scopeType, table.scopeRef),
    index("lisa_findings_generated_idx").on(table.generatedAt),
  ]
);

export const crawlerRequestEvents = pgTable(
  "crawler_request_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    botName: varchar("bot_name", { length: 120 }).notNull(),
    method: varchar("method", { length: 12 }).notNull(),
    path: varchar("path", { length: 512 }).notNull(),
    requestType: varchar("request_type", { length: 32 }).notNull(),
    sourceSurface: varchar("source_surface", { length: 64 }),
    stateCode: varchar("state_code", { length: 2 }),
    countySlug: varchar("county_slug", { length: 160 }),
    countyFips: varchar("county_fips", { length: 5 }),
    categorySlug: varchar("category_slug", { length: 160 }),
    statusCode: integer("status_code").notNull(),
    statusClass: varchar("status_class", { length: 8 }).notNull(),
    refererHost: varchar("referer_host", { length: 255 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
  },
  (table) => [
    index("crawler_request_events_bot_idx").on(table.botName),
    index("crawler_request_events_status_idx").on(table.statusClass),
    index("crawler_request_events_type_idx").on(table.requestType),
    index("crawler_request_events_surface_idx").on(table.sourceSurface),
    index("crawler_request_events_state_code_idx").on(table.stateCode),
    index("crawler_request_events_county_slug_idx").on(table.countySlug),
    index("crawler_request_events_county_fips_idx").on(table.countyFips),
    index("crawler_request_events_category_slug_idx").on(table.categorySlug),
    index("crawler_request_events_observed_idx").on(table.observedAt),
    index("crawler_request_events_path_idx").on(table.path),
  ]
);

export const crawlerRequestHourlyRollups = pgTable(
  "crawler_request_hourly_rollups",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bucketStart: timestamp("bucket_start").notNull(),
    botName: varchar("bot_name", { length: 120 }).notNull(),
    requestType: varchar("request_type", { length: 32 }).notNull(),
    sourceSurface: varchar("source_surface", { length: 64 }),
    stateCode: varchar("state_code", { length: 2 }),
    countySlug: varchar("county_slug", { length: 160 }),
    countyFips: varchar("county_fips", { length: 5 }),
    categorySlug: varchar("category_slug", { length: 160 }),
    statusClass: varchar("status_class", { length: 8 }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("crawler_request_hourly_rollups_bucket_unique").on(
      table.bucketStart,
      table.botName,
      table.requestType,
      table.sourceSurface,
      table.stateCode,
      table.countySlug,
      table.countyFips,
      table.categorySlug,
      table.statusClass
    ),
    index("crawler_request_hourly_rollups_bucket_idx").on(table.bucketStart),
    index("crawler_request_hourly_rollups_surface_idx").on(table.sourceSurface),
    index("crawler_request_hourly_rollups_state_idx").on(table.stateCode),
    index("crawler_request_hourly_rollups_county_idx").on(table.countySlug),
    index("crawler_request_hourly_rollups_county_fips_idx").on(table.countyFips),
    index("crawler_request_hourly_rollups_category_idx").on(table.categorySlug),
  ]
);

export const botObservationEvents = pgTable(
  "bot_observation_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
    requestId: varchar("request_id", { length: 128 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    method: varchar("method", { length: 12 }).notNull(),
    host: varchar("host", { length: 255 }),
    path: varchar("path", { length: 512 }).notNull(),
    queryString: text("query_string"),
    statusCode: integer("status_code").notNull(),
    responseTimeMs: integer("response_time_ms"),
    responseBytes: integer("response_bytes"),
    referer: text("referer"),
    acceptLanguage: varchar("accept_language", { length: 255 }),
    cacheStatus: varchar("cache_status", { length: 64 }),
    routeName: varchar("route_name", { length: 128 }),
    routeFamily: varchar("route_family", { length: 64 }).notNull(),
    botFamily: varchar("bot_family", { length: 120 }).notNull(),
    canonicalUrl: text("canonical_url"),
    matchedTemplate: varchar("matched_template", { length: 255 }),
    contentType: varchar("content_type", { length: 255 }),
    isFirstSeenUrl: boolean("is_first_seen_url").notNull().default(false),
    isRecrawl: boolean("is_recrawl").notNull().default(false),
    county: varchar("county", { length: 160 }),
    state: varchar("state", { length: 2 }),
    trade: varchar("trade", { length: 160 }),
    entityType: varchar("entity_type", { length: 64 }),
    entitySlug: varchar("entity_slug", { length: 255 }),
  },
  (table) => [
    index("bot_observation_events_observed_idx").on(table.observedAt),
    index("bot_observation_events_bot_idx").on(table.botFamily),
    index("bot_observation_events_route_idx").on(table.routeFamily),
    index("bot_observation_events_county_idx").on(table.county),
    index("bot_observation_events_state_idx").on(table.state),
    index("bot_observation_events_trade_idx").on(table.trade),
  ]
);

export const botObservationDailyAgg = pgTable(
  "bot_observation_daily_agg",
  {
    date: date("date").notNull(),
    routeFamily: varchar("route_family", { length: 64 }).notNull(),
    county: varchar("county", { length: 160 }),
    state: varchar("state", { length: 2 }),
    trade: varchar("trade", { length: 160 }),
    botFamily: varchar("bot_family", { length: 120 }).notNull(),
    hits: integer("hits").notNull().default(0),
    uniqueUrls: integer("unique_urls").notNull().default(0),
    avgResponseTimeMs: integer("avg_response_time_ms"),
    avgResponseBytes: integer("avg_response_bytes"),
    status200Count: integer("status_200_count").notNull().default(0),
    status404Count: integer("status_404_count").notNull().default(0),
    recrawlUrls: integer("recrawl_urls").notNull().default(0),
    firstSeenUrls: integer("first_seen_urls").notNull().default(0),
    topPath: varchar("top_path", { length: 512 }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bot_observation_daily_agg_unique").on(
      table.date,
      table.routeFamily,
      table.county,
      table.state,
      table.trade,
      table.botFamily
    ),
    index("bot_observation_daily_agg_date_idx").on(table.date),
    index("bot_observation_daily_agg_route_idx").on(table.routeFamily),
    index("bot_observation_daily_agg_county_idx").on(table.county),
  ]
);

// Scout interactions: real user intent/resolution log (bots excluded)
export const scoutInteractions = pgTable(
  "scout_interactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userRole: scoutInteractionUserRoleEnum("user_role").notNull(),
    countyFips: varchar("county_fips", { length: 5 }),
    intent: scoutInteractionIntentEnum("intent").notNull().default("unknown"),
    scoutConfidence: integer("scout_confidence").notNull().default(0),
    outcome: scoutInteractionOutcomeEnum("outcome").notNull(),
    failureReason: scoutInteractionFailureReasonEnum("failure_reason"),
    scoutMessageHash: varchar("scout_message_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("scout_interactions_created_idx").on(table.createdAt),
    index("scout_interactions_intent_idx").on(table.intent),
    index("scout_interactions_role_idx").on(table.userRole),
  ]
);

// Scout memory: persistent conversation and learning storage
// Enables Scout to remember tool results, user preferences, conversation context,
// learning points, and proactive suggestions across sessions
export const scoutMemory = pgTable(
  "scout_memory",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: scoutMemoryTypeEnum("type").notNull(),
    key: varchar("key").notNull(),
    value: jsonb("value").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    ttlSeconds: integer("ttl_seconds"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("scout_memory_user_idx").on(table.userId),
    index("scout_memory_type_idx").on(table.type),
    index("scout_memory_key_idx").on(table.key),
    index("scout_memory_user_type_idx").on(table.userId, table.type),
    index("scout_memory_created_idx").on(table.createdAt),
    uniqueIndex("scout_memory_user_type_key_unique").on(table.userId, table.type, table.key),
  ]
);

// Scout conversations: user-owned saved Scout threads for return visits.
export const scoutConversations = pgTable(
  "scout_conversations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    preview: text("preview"),
    summary: text("summary"),
    intent: varchar("intent", { length: 80 }),
    countyFips: varchar("county_fips", { length: 5 }),
    stateCode: varchar("state_code", { length: 2 }),
    messageCount: integer("message_count").notNull().default(0),
    messages: jsonb("messages")
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("scout_conversations_user_updated_idx").on(table.userId, table.updatedAt),
    index("scout_conversations_user_archived_idx").on(table.userId, table.archivedAt),
    index("scout_conversations_county_idx").on(table.countyFips),
  ]
);

// Admin audit log: persistent record of all admin actions (impersonation, role changes, etc.)
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: varchar("type", { length: 80 }).notNull(),
    adminId: varchar("admin_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_admin_audit_log_admin").on(table.adminId, table.createdAt),
    index("idx_admin_audit_log_target").on(table.targetUserId, table.createdAt),
    index("idx_admin_audit_log_type").on(table.type, table.createdAt),
  ]
);
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

// Mission Control action log: one-fix decisions
export const missionControlActions = pgTable(
  "mission_control_actions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceType: missionControlSourceEnum("source_type").notNull(),
    sourceId: varchar("source_id", { length: 128 }).notNull(),
    status: missionControlActionStatusEnum("status").notNull().default("open"),
    summary: text("summary"),
    suggestedFix: text("suggested_fix"),
    decisionReason: text("decision_reason"),
    decidedByUserId: varchar("decided_by_user_id").references(() => users.id),
    impactScore: integer("impact_score"),
    suggestedAt: timestamp("suggested_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("mission_control_action_source_unique").on(table.sourceType, table.sourceId),
    index("mission_control_action_status_idx").on(table.status),
  ]
);

// Mission Control decision tracking: daily operating loop
export const missionControlDecisions = pgTable(
  "mission_control_decisions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    decisionDate: date("decision_date").notNull(),
    recommendedFixSourceType: missionControlSourceEnum("recommended_fix_source_type").notNull(),
    recommendedFixSourceId: varchar("recommended_fix_source_id", { length: 128 }).notNull(),
    action: missionControlDecisionActionEnum("action").notNull(),
    deferReason: text("defer_reason"),
    actorUserId: varchar("actor_user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("mission_control_decision_unique").on(
      table.decisionDate,
      table.recommendedFixSourceType,
      table.recommendedFixSourceId
    ),
    index("mission_control_decisions_date_idx").on(table.decisionDate),
    index("mission_control_decisions_action_idx").on(table.action),
  ]
);

// User completed actions log: Append-only record of real outcome-based actions
// Used for Preferred Source Prompt (5th action moment) and Mission Control
export const userCompletedActions = pgTable(
  "user_completed_actions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    actionType: varchar("action_type", { length: 120 }).notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("user_completed_actions_user_idx").on(table.userId),
    index("user_completed_actions_created_idx").on(table.createdAt),
  ]
);

// Contractor promotional campaigns
export const contractorPromos = pgTable("contractor_promos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id")
    .notNull()
    .references(() => contractors.id),

  // Promo details
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description").notNull(),
  offerDetails: text("offer_details").notNull(), // "20% off all roofing jobs", "Free estimate + 10% discount"
  imageUrl: varchar("image_url", { length: 2048 }), // Exact image used on profile cards and shared previews

  // Discount structure
  discountType: varchar("discount_type", {
    enum: ["percentage", "fixed_amount", "free_service", "bundle_deal"],
  }).notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }), // 20 for 20%, 500 for $500 off
  minimumJobValue: decimal("minimum_job_value", { precision: 10, scale: 2 }), // Minimum job size to qualify

  // Promo settings
  promoCode: varchar("promo_code", { length: 20 }), // Optional promo code
  isActive: boolean("is_active").default(true),
  maxUses: integer("max_uses"), // null = unlimited
  currentUses: integer("current_uses").default(0),

  // Targeting
  serviceAreas: jsonb("service_areas").$type<string[]>(), // County FIPS codes
  tradeCategories: jsonb("trade_categories").$type<string[]>(), // Trade IDs this promo applies to

  // Timing
  startsAt: timestamp("starts_at").defaultNow(),
  expiresAt: timestamp("expires_at"),

  // Tracking
  slug: varchar("slug").notNull().unique(), // For shareable URLs
  viewCount: integer("view_count").default(0),
  clickCount: integer("click_count").default(0),
  projectRequestCount: integer("project_request_count").default(0), // Project requests from this promo

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Track promo interactions for analytics
export const promoInteractions = pgTable("promo_interactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  promoId: varchar("promo_id")
    .notNull()
    .references(() => contractorPromos.id),

  // Interaction details
  interactionType: varchar("interaction_type", {
    enum: ["view", "click", "share", "project_request", "contact_made"],
  }).notNull(),

  // User/visitor info
  userId: varchar("user_id"), // nullable for anonymous visitors
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),

  // Location data
  county: varchar("county"),
  state: varchar("state"),
  city: varchar("city"),

  // Metadata
  metadata: jsonb("metadata").$type<{
    source?: string; // 'facebook', 'google', 'direct', 'referral'
    campaign?: string;
    medium?: string;
  }>(),

  createdAt: timestamp("created_at").defaultNow(),
});

// Company promotional deals (Harbor Freight, Home Depot, etc.)
export const companyPromotions = pgTable("company_promotions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Company details
  companyName: varchar("company_name", { length: 100 }).notNull(),
  companyLogo: varchar("company_logo"),
  companyWebsite: varchar("company_website"),

  // Promotion details
  title: varchar("title", { length: 150 }).notNull(),
  description: text("description").notNull(),
  dealDetails: text("deal_details").notNull(), // "20% off all power tools", "Buy 2 get 1 free"

  // Deal structure
  dealType: varchar("deal_type", {
    enum: ["percentage_off", "dollar_off", "bogo", "free_shipping", "bundle_deal", "clearance"],
  }).notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }), // 20 for 20%, 50 for $50 off
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),

  // Promotion settings
  promoCode: varchar("promo_code", { length: 30 }), // Coupon code if needed
  minimumPurchase: decimal("minimum_purchase", { precision: 10, scale: 2 }), // Min purchase requirement
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }), // Max discount cap

  // Targeting and categories
  productCategories: jsonb("product_categories").$type<string[]>(), // tools, lumber, hardware, etc.
  targetAudience: jsonb("target_audience").$type<string[]>(), // contractors, homeowners, DIY
  excludedItems: jsonb("excluded_items").$type<string[]>(), // SKUs or categories to exclude

  // Timing and availability
  startsAt: timestamp("starts_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false), // Premium placement

  // Geographic targeting
  availableStates: jsonb("available_states").$type<string[]>(), // State codes
  availableZipCodes: jsonb("available_zip_codes").$type<string[]>(), // Specific zip codes
  storeLocationsOnly: boolean("store_locations_only").default(false), // In-store only deals

  // Tracking and payment
  slug: varchar("slug").notNull().unique(), // For shareable URLs
  paymentStatus: varchar("payment_status", {
    enum: ["pending", "paid", "overdue", "cancelled"],
  }).default("pending"),
  promotionFee: decimal("promotion_fee", { precision: 10, scale: 2 }), // What company pays TradeScout

  // Analytics
  viewCount: integer("view_count").default(0),
  clickCount: integer("click_count").default(0),
  redemptionCount: integer("redemption_count").default(0),

  // Terms and conditions
  terms: text("terms"), // Full terms and conditions
  restrictions: text("restrictions"), // Usage restrictions

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Track company promotion interactions
export const companyPromotionInteractions = pgTable("company_promotion_interactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id")
    .notNull()
    .references(() => companyPromotions.id),

  // Interaction details
  interactionType: varchar("interaction_type", {
    enum: ["view", "click", "share", "coupon_copy", "store_locator", "website_visit"],
  }).notNull(),

  // User/visitor info
  userId: varchar("user_id"), // nullable for anonymous visitors
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),

  // Location data
  county: varchar("county"),
  state: varchar("state"),
  city: varchar("city"),
  zipCode: varchar("zip_code"),

  // Metadata
  metadata: jsonb("metadata").$type<{
    deviceType?: string; // mobile, desktop, tablet
    clickedElement?: string; // which button/link was clicked
    timeSpent?: number; // seconds spent viewing promotion
    source?: string; // how they found this promotion
  }>(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const workerServiceAreas = pgTable("worker_service_areas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workerId: varchar("worker_id").notNull(),
  countyFips: varchar("county_fips").notNull(),
  maxTravelTime: integer("max_travel_time"), // in minutes
  createdAt: timestamp("created_at").defaultNow(),
});

export type Worker = typeof workers.$inferSelect;
export type InsertWorker = typeof workers.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type TaskCategory = typeof taskCategories.$inferSelect;
export type InsertTaskCategory = typeof taskCategories.$inferInsert;
export type TaskApplication = typeof taskApplications.$inferSelect;
export type InsertTaskApplication = typeof taskApplications.$inferInsert;
export type WorkerReview = typeof workerReviews.$inferSelect;
export type InsertWorkerReview = typeof workerReviews.$inferInsert;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type InsertVerificationRequest = typeof verificationRequests.$inferInsert;
export type WorkRequest = typeof workRequests.$inferSelect;
export type InsertWorkRequest = typeof workRequests.$inferInsert;
export type WorkRequestEvent = typeof workRequestEvents.$inferSelect;
export type InsertWorkRequestEvent = typeof workRequestEvents.$inferInsert;
export type WorkRequestAssignment = typeof workRequestAssignments.$inferSelect;
export type InsertWorkRequestAssignment = typeof workRequestAssignments.$inferInsert;
export type EmploymentPost = typeof employmentPosts.$inferSelect;
export type InsertEmploymentPost = typeof employmentPosts.$inferInsert;

// Promotional types
export type ContractorPromo = typeof contractorPromos.$inferSelect;
export type InsertContractorPromo = typeof contractorPromos.$inferInsert;
export type CompanyPromotion = typeof companyPromotions.$inferSelect;
export type InsertCompanyPromotion = typeof companyPromotions.$inferInsert;
export type CompanyPromotionInteraction = typeof companyPromotionInteractions.$inferSelect;
export type InsertCompanyPromotionInteraction = typeof companyPromotionInteractions.$inferInsert;

// Chat system tables
export const conversations = pgTable("conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  homeownerId: varchar("homeowner_id")
    .notNull()
    .references(() => users.id),
  // contractorId is kept as the conversation participant key for backward compat.
  // For contractor-profile providers this is the contractors.id.
  // For business/worker providers this is the provider's userId (no FK to contractors).
  // The FK to contractors was removed in migration 0087 to support universal provider conversations.
  contractorId: varchar("contractor_id").notNull(),
  leadId: varchar("lead_id").references(() => leads.id),
  status: varchar("status", { enum: ["active", "closed", "archived"] }).default("active"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  homeownerRating: integer("homeowner_rating"), // 1-5 stars
  contractorRating: integer("contractor_rating"), // 1-5 stars
  homeownerFeedback: text("homeowner_feedback"),
  contractorFeedback: text("contractor_feedback"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id),
  senderId: varchar("sender_id")
    .notNull()
    .references(() => users.id),
  senderType: varchar("sender_type", { enum: ["homeowner", "contractor"] }).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type", {
    enum: ["text", "quote", "schedule", "materials", "image"],
  }).default("text"),
  metadata: jsonb("metadata"), // For quotes, schedules, material lists
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketplace conversations between buyers and sellers
export const marketplaceConversations = pgTable("marketplace_conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),
  status: varchar("status", { enum: ["active", "closed", "archived"] }).default("active"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  buyerRating: integer("buyer_rating"), // 1-5 stars
  sellerRating: integer("seller_rating"), // 1-5 stars
  buyerFeedback: text("buyer_feedback"),
  sellerFeedback: text("seller_feedback"),
  isReadByBuyer: boolean("is_read_by_buyer").default(false),
  isReadBySeller: boolean("is_read_by_seller").default(false),
  // D1: Messaging Authority Contract metadata (immutable after creation)
  intent: varchar("intent", { enum: ["hire", "advise", "collaborate", "reconnect"] }), // Why contact was made
  authorityGate: varchar("authority_gate", {
    enum: ["decision_card", "scout_recommendation"],
  }), // How contact was authorized
  sourceDecisionCardId: varchar("source_decision_card_id"), // If from Decision Card outcome
  sourceScoutRecommendationId: varchar("source_scout_recommendation_id"), // If from Scout recommendation
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }), // Scout's confidence (0.00-1.00)
  decisionScope: text("decision_scope"), // Context from decision
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages for marketplace conversations
export const marketplaceMessages = pgTable("marketplace_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => marketplaceConversations.id),
  senderId: varchar("sender_id")
    .notNull()
    .references(() => users.id),
  senderType: varchar("sender_type", { enum: ["buyer", "seller"] }).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type", {
    enum: ["text", "offer", "counter_offer", "acceptance", "image", "meeting_request"],
  }).default("text"),
  metadata: jsonb("metadata"), // For offers, meeting details, etc.
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id),
  contractorId: varchar("contractor_id")
    .notNull()
    .references(() => contractors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }),
  materialCost: decimal("material_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  validUntil: timestamp("valid_until"),
  status: varchar("status", { enum: ["draft", "sent", "accepted", "declined", "expired"] }).default(
    "draft"
  ),
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const schedules = pgTable("schedules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id),
  contractorId: varchar("contractor_id")
    .notNull()
    .references(() => contractors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  proposedDate: timestamp("proposed_date").notNull(),
  duration: integer("duration_hours"), // Duration in hours
  status: varchar("status", { enum: ["proposed", "accepted", "declined", "completed"] }).default(
    "proposed"
  ),
  location: varchar("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profileBookingRequests = pgTable(
  "profile_booking_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    profileId: varchar("profile_id").references(() => profiles.id, { onDelete: "restrict" }),
    lineageKind: varchar("lineage_kind", {
      enum: ["legacy_owner", "legacy_business_profile", "exact_profile"],
    })
      .notNull()
      .default("legacy_owner"),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requesterUserId: varchar("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", {
      enum: ["requested", "accepted", "declined", "cancelled", "completed"],
    })
      .notNull()
      .default("requested"),
    requestMessage: text("request_message"),
    serviceLabel: varchar("service_label", { length: 120 }),
    requestedStartAt: timestamp("requested_start_at"),
    requestedEndAt: timestamp("requested_end_at"),
    timezone: varchar("timezone", { length: 80 }),
    deliveryMode: varchar("delivery_mode", { enum: ["mobile", "remote", "onsite"] }).default(
      "onsite"
    ),
    locationNote: text("location_note"),
    depositRequired: boolean("deposit_required").notNull().default(false),
    depositAmountUsd: decimal("deposit_amount_usd", { precision: 10, scale: 2 }),
    paymentStatus: varchar("payment_status", {
      enum: ["none", "requires_payment", "processing", "paid", "failed", "refunded"],
    })
      .notNull()
      .default("none"),
    paymentIntentId: varchar("payment_intent_id", { length: 120 }),
    bookingContext: jsonb("booking_context")
      .$type<{
        category?: "general" | "legal_notary";
        stateCode?: string;
        countyFips?: string | null;
        propertyProgramId?: string;
        serviceType?: string;
        documentType?: string;
        deliveryMode?: "mobile" | "remote" | "onsite";
      }>()
      .default(sql`'{}'::jsonb`),
    verificationSnapshot: jsonb("verification_snapshot")
      .$type<{
        gate?: "none" | "notary_remote_paid_la";
        passed?: boolean;
        missing?: string[];
        checkedAt?: string;
      }>()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "profile_booking_requests_lineage_consistency_check",
      sql`(
        (${table.lineageKind} = 'exact_profile' AND ${table.profileId} IS NOT NULL)
        OR
        (${table.lineageKind} IN ('legacy_owner', 'legacy_business_profile') AND ${table.profileId} IS NULL)
      )`
    ),
    index("idx_profile_booking_requests_profile")
      .on(table.profileId)
      .where(sql`${table.profileId} IS NOT NULL`),
    index("idx_profile_booking_requests_owner").on(table.ownerUserId),
    index("idx_profile_booking_requests_requester").on(table.requesterUserId),
    index("idx_profile_booking_requests_status").on(table.status),
    index("idx_profile_booking_requests_created_at").on(table.createdAt),
  ]
);

export const materialLists = pgTable("material_lists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id),
  contractorId: varchar("contractor_id")
    .notNull()
    .references(() => contractors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  items: jsonb("items")
    .$type<
      Array<{
        id: string;
        name: string;
        quantity: number;
        estimatedCost: number;
        vendor?: string;
        sku?: string;
        suggestedBy: "homeowner" | "contractor";
        status: "pending" | "approved" | "denied";
        denialReason?: string;
        notes?: string;
      }>
    >()
    .notNull()
    .default([]),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 10, scale: 2 }),
  vendorInfo: jsonb("vendor_info"), // Store vendor details like Home Depot cart links
  status: varchar("status", { enum: ["draft", "sent", "approved", "ordered"] }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for chat system
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  homeowner: one(users, {
    fields: [conversations.homeownerId],
    references: [users.id],
  }),
  contractor: one(contractors, {
    fields: [conversations.contractorId],
    references: [contractors.id],
  }),
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id],
  }),
  messages: many(messages),
  quotes: many(quotes),
  schedules: many(schedules),
  materialLists: many(materialLists),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  conversation: one(conversations, {
    fields: [quotes.conversationId],
    references: [conversations.id],
  }),
  contractor: one(contractors, {
    fields: [quotes.contractorId],
    references: [contractors.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  conversation: one(conversations, {
    fields: [schedules.conversationId],
    references: [conversations.id],
  }),
  contractor: one(contractors, {
    fields: [schedules.contractorId],
    references: [contractors.id],
  }),
}));

export const materialListsRelations = relations(materialLists, ({ one }) => ({
  conversation: one(conversations, {
    fields: [materialLists.conversationId],
    references: [conversations.id],
  }),
  contractor: one(contractors, {
    fields: [materialLists.contractorId],
    references: [contractors.id],
  }),
}));

// Export types for chat system
export type InsertConversation = typeof conversations.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type InsertProfileBookingRequest = typeof profileBookingRequests.$inferInsert;
export type ProfileBookingRequest = typeof profileBookingRequests.$inferSelect;
export type InsertMaterialList = typeof materialLists.$inferInsert;
export type MaterialList = typeof materialLists.$inferSelect;

export type InsertAcceleratorMembership = typeof acceleratorMemberships.$inferInsert;
export type AcceleratorMembership = typeof acceleratorMemberships.$inferSelect;

export type InsertPricingData = typeof pricingData.$inferInsert;
export type PricingData = typeof pricingData.$inferSelect;

export type InsertPromoInteraction = typeof promoInteractions.$inferInsert;
export type PromoInteraction = typeof promoInteractions.$inferSelect;

// Relations for promo system
export const contractorPromosRelations = relations(contractorPromos, ({ one, many }) => ({
  contractor: one(contractors, {
    fields: [contractorPromos.contractorId],
    references: [contractors.id],
  }),
  interactions: many(promoInteractions),
}));

export const promoInteractionsRelations = relations(promoInteractions, ({ one }) => ({
  promo: one(contractorPromos, {
    fields: [promoInteractions.promoId],
    references: [contractorPromos.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractorSchema = createInsertSchema(contractors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGrowthPackDownloadSchema = createInsertSchema(growthPackDownloads).omit({
  id: true,
  createdAt: true,
});

export const insertContractorPromoSchema = createInsertSchema(contractorPromos).omit({
  id: true,
  slug: true,
  viewCount: true,
  clickCount: true,
  projectRequestCount: true,
  currentUses: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPromoInteractionSchema = createInsertSchema(promoInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertBotUiFindingSchema = createInsertSchema(botUiFindings).omit({
  id: true,
  createdAt: true,
});

export const insertScoutInteractionSchema = createInsertSchema(scoutInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertMissionControlActionSchema = createInsertSchema(missionControlActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  suggestedAt: true,
  resolvedAt: true,
});

export const insertMissionControlDecisionSchema = createInsertSchema(missionControlDecisions).omit({
  id: true,
  createdAt: true,
});

export const insertUserCompletedActionSchema = createInsertSchema(userCompletedActions).omit({
  id: true,
  createdAt: true,
});

export const insertErrorReportSchema = createInsertSchema(errorReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  priority: true,
  assignedTo: true,
  adminNotes: true,
  resolution: true,
  resolvedAt: true,
});

export type InsertErrorReport = typeof errorReports.$inferInsert;
export type ErrorReport = typeof errorReports.$inferSelect;
export type InsertBotUiFinding = typeof botUiFindings.$inferInsert;
export type BotUiFinding = typeof botUiFindings.$inferSelect;
export type InsertScoutInteraction = typeof scoutInteractions.$inferInsert;
export type ScoutInteraction = typeof scoutInteractions.$inferSelect;
export type InsertScoutConversation = typeof scoutConversations.$inferInsert;
export type ScoutConversation = typeof scoutConversations.$inferSelect;
export type InsertMissionControlAction = typeof missionControlActions.$inferInsert;
export type MissionControlAction = typeof missionControlActions.$inferSelect;
export type InsertMissionControlDecision = typeof missionControlDecisions.$inferInsert;
export type MissionControlDecision = typeof missionControlDecisions.$inferSelect;
export type InsertUserCompletedAction = typeof userCompletedActions.$inferInsert;
export type UserCompletedAction = typeof userCompletedActions.$inferSelect;

// Export types for data privacy and security
export type InsertUserDataRequest = typeof userDataRequests.$inferInsert;
export type UserDataRequest = typeof userDataRequests.$inferSelect;
export type InsertDataAccessLog = typeof dataAccessLogs.$inferInsert;
export type DataAccessLog = typeof dataAccessLogs.$inferSelect;
export type InsertSecurityIncident = typeof securityIncidents.$inferInsert;
export type SecurityIncident = typeof securityIncidents.$inferSelect;
export type InsertUserPrivacySettings = typeof userPrivacySettings.$inferInsert;
export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;

// Buy/Sell Marketplace System for high-value items
export const marketplaceCategories = pgTable("marketplace_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  iconName: varchar("icon_name"), // Lucide icon name
  parentCategoryId: varchar("parent_category_id"), // For subcategories
  requiresVerification: boolean("requires_verification").default(false), // For food/regulated items
  verificationRequirements: jsonb("verification_requirements").$type<{
    identityVerification?: boolean;
    businessLicense?: boolean;
    foodHandlersPermit?: boolean;
    kitchenInspection?: boolean;
    insuranceCertificate?: boolean;
    requiredDocuments?: string[];
  }>(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketplaceListings = pgTable("marketplace_listings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),
  categoryId: varchar("category_id")
    .notNull()
    .references(() => marketplaceCategories.id),

  // Basic listing info
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),

  // Pricing
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  priceType: varchar("price_type", {
    enum: ["fixed", "negotiable", "auction", "best_offer"],
  }).default("fixed"),
  originalPrice: decimal("original_price", { precision: 12, scale: 2 }), // For showing savings

  // Location
  county: varchar("county").notNull(),
  state: varchar("state").notNull(),
  city: varchar("city"),
  zipCode: varchar("zip_code"),
  locationVisibility: varchar("location_visibility", {
    enum: ["exact", "meetup_only"],
  }).default("exact"),
  latitude: decimal("latitude", { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  isLocalPickupOnly: boolean("is_local_pickup_only").default(false),
  willShip: boolean("will_ship").default(false),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  shippingQuote: jsonb("shipping_quote").$type<{
    carrier: "usps" | "ups" | "fedex" | "seller_created";
    serviceName: string;
    estimatedCost: number;
    estimatedDaysMin?: number;
    estimatedDaysMax?: number;
    buyerPays: boolean;
    sellerAbsorbs: boolean;
    labelPurchaseMode: "seller_external" | "platform_label";
  }>(),
  packageDetails: jsonb("package_details").$type<{
    weightOz?: number;
    lengthIn?: number;
    widthIn?: number;
    heightIn?: number;
    fragile?: boolean;
    insuredValue?: number;
  }>(),

  // Native bundle / collection support. Legacy listings may still store setItems
  // inside specifications; readers should support both shapes.
  listingType: varchar("listing_type", {
    enum: ["single", "bundle", "collection"],
  }).default("single"),
  bundlePurchaseMode: varchar("bundle_purchase_mode", {
    enum: ["must_buy_all", "seller_allows_split", "buyer_can_choose_items"],
  }).default("must_buy_all"),
  bundleItems: jsonb("bundle_items").$type<
    Array<{
      id?: string;
      name: string;
      description?: string;
      condition?: "new" | "like_new" | "excellent" | "good" | "fair" | "poor" | "parts_only";
      fallbackValue?: number;
      rarityTags?: string[];
      imageUrl: string;
      weightOz?: number;
    }>
  >(),

  // Fair-value and rarity guidance shown to sellers and buyers as advisory context.
  valueGuidance: jsonb("value_guidance").$type<{
    suggestedRangeLow: number;
    suggestedRangeHigh: number;
    medianCompPrice: number | null;
    confidence: "low" | "medium" | "high";
    sampleSize: number;
    conditionAdjustment: number;
    rarityAdjustment: number;
    undercutWarning?: {
      severity: "soft" | "strong";
      message: string;
      expectedSellTimeImpact: string;
    };
  }>(),
  rarityTags: jsonb("rarity_tags").$type<string[]>().default([]),
  rarityConfidence: varchar("rarity_confidence", {
    enum: ["low", "medium", "high"],
  }),
  raritySampleSize: integer("rarity_sample_size").default(0),
  rarityExplanation: text("rarity_explanation"),

  // Item details
  condition: varchar("condition", {
    enum: ["new", "like_new", "excellent", "good", "fair", "poor", "parts_only"],
  }).notNull(),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  year: integer("year"),
  mileage: integer("mileage"), // For vehicles
  hours: integer("hours"), // For equipment

  // Specifications (flexible JSON for different item types)
  specifications: jsonb("specifications").$type<{
    // Common fields
    color?: string;
    weight?: string;
    dimensions?: string;

    // Vehicle specific
    make?: string;
    engine?: string;
    transmission?: string;
    fuelType?: string;
    vin?: string;

    // Equipment specific
    powerSource?: string;
    capacity?: string;
    attachments?: string[];

    // Real estate specific
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    lotSize?: string;
    propertyType?: string;

    // Animal specific
    breed?: string;
    age?: string;
    gender?: string;
    animalWeight?: string;
    vaccinated?: boolean;
    registered?: boolean;

    // Food & Artisan specific
    ingredients?: string[];
    allergens?: string[];
    nutritionalInfo?: string;
    expirationDate?: string;
    harvestDate?: string;
    organic?: boolean;
    locallySourced?: boolean;
    preparationMethod?: string;
    storageInstructions?: string;
    servingSize?: string;

    // General custom fields
    [key: string]: any;
  }>(),

  // Media
  images: jsonb("images").$type<string[]>().default([]),
  primaryImageIndex: integer("primary_image_index").default(0),
  videoUrl: varchar("video_url"),

  // Verification (for regulated items like food)
  requiresBuyerVerification: boolean("requires_buyer_verification").default(false),
  isSellerVerified: boolean("is_seller_verified").default(false),
  verificationStatus: varchar("verification_status", {
    enum: ["none_required", "pending", "approved", "rejected"],
  }).default("none_required"),
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at"),

  // Listing management
  status: varchar("status", {
    enum: [
      "draft",
      "pending_approval",
      "active",
      "sold",
      "expired",
      "removed",
      "flagged",
      "rejected",
    ],
  }).default("draft"),
  isPromoted: boolean("is_promoted").default(false),
  promotedUntil: timestamp("promoted_until"),

  // Approval workflow
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  moderationNotes: text("moderation_notes"),

  // Interaction tracking
  viewCount: integer("view_count").default(0),
  favoriteCount: integer("favorite_count").default(0),
  contactCount: integer("contact_count").default(0),

  // SEO
  slug: varchar("slug").unique(), // Generated from title
  metaDescription: text("meta_description"),
  tags: jsonb("tags").$type<string[]>().default([]),

  // Timestamps
  expiresAt: timestamp("expires_at"), // Auto-expire after X days
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// HomeScout (Real Estate Portal)
// -----------------------------------------------------------------------------

export const HOME_SCOUT_LISTING_STATUSES = [
  "pending_review",
  "active",
  "sold",
  "rented",
  "removed",
  "inactive",
] as const;

export const HOME_SCOUT_PROPERTY_TYPES = [
  "house",
  "condo",
  "townhouse",
  "land",
  "commercial",
  "multifamily",
] as const;

export const HOME_SCOUT_LISTING_AUTHOR_TYPES = ["owner", "agent"] as const;

export const homeScoutListings = pgTable(
  "home_scout_listings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    sourceKey: varchar("source_key", { length: 64 }).notNull().default("manual"),
    sourceListingId: varchar("source_listing_id", { length: 128 }),
    dedupeKey: varchar("dedupe_key", { length: 160 }),

    status: varchar("status", { length: 32, enum: [...HOME_SCOUT_LISTING_STATUSES] })
      .notNull()
      .default("pending_review"),
    approvedAt: timestamp("approved_at"),
    approvedByUserId: varchar("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),

    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    pricePrevious: numeric("price_previous", { precision: 12, scale: 2 }),
    priceChangedAt: timestamp("price_changed_at"),
    listedAt: timestamp("listed_at"),
    offMarketAt: timestamp("off_market_at"),

    externalUrl: varchar("external_url", { length: 500 }),
    sourceUpdatedAt: timestamp("source_updated_at"),
    observedAt: timestamp("observed_at"),
    lastSeenAt: timestamp("last_seen_at"),
    domDays: integer("dom_days"),

    propertyType: varchar("property_type", {
      length: 32,
      enum: [...HOME_SCOUT_PROPERTY_TYPES],
    })
      .notNull()
      .default("house"),
    beds: integer("beds"),
    baths: numeric("baths", { precision: 4, scale: 1 }),
    sqft: integer("sqft"),
    lotSqft: integer("lot_sqft"),
    yearBuilt: integer("year_built"),
    features: jsonb("features").$type<string[]>(),

    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    stateCode: varchar("state_code", { length: 2 })
      .notNull()
      .references(() => states.code),
    city: varchar("city", { length: 100 }),
    zipCode: varchar("zip_code", { length: 10 }),
    address1: varchar("address_1", { length: 255 }),
    address2: varchar("address_2", { length: 255 }),
    addressVisibility: varchar("address_visibility", { length: 16, enum: ["exact", "approximate"] })
      .notNull()
      .default("exact"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),

    photos: jsonb("photos").$type<string[]>().notNull().default([]),

    sellerUserId: varchar("seller_user_id").references(() => users.id, { onDelete: "set null" }),
    agentUserId: varchar("agent_user_id").references(() => users.id, { onDelete: "set null" }),
    contactUserId: varchar("contact_user_id").references(() => users.id, { onDelete: "set null" }),
    listingAuthorType: varchar("listing_author_type", {
      length: 16,
      enum: [...HOME_SCOUT_LISTING_AUTHOR_TYPES],
    })
      .notNull()
      .default("owner"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_homescout_county_status").on(table.countyFips, table.status),
    index("idx_homescout_county_price").on(table.countyFips, table.status, table.price),
    index("idx_homescout_county_listed_at").on(table.countyFips, table.status, table.listedAt),
    uniqueIndex("uq_homescout_source_listing").on(table.sourceKey, table.sourceListingId),
  ]
);

export type HomeScoutListing = typeof homeScoutListings.$inferSelect;
export type InsertHomeScoutListing = typeof homeScoutListings.$inferInsert;

// ---------------------------------------------------------------------------
// HomeScout ingestion + timeline + market buckets
// ---------------------------------------------------------------------------

export const HOME_SCOUT_SOURCE_TYPES = ["json_file", "json_url", "mls", "idx", "partner"] as const;

export const homeScoutSources = pgTable(
  "home_scout_sources",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceKey: varchar("source_key", { length: 64 }).notNull(),
    sourceType: varchar("source_type", {
      length: 32,
      enum: [...HOME_SCOUT_SOURCE_TYPES],
    }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").notNull().default({}),
    lastRunAt: timestamp("last_run_at"),
    lastSuccessAt: timestamp("last_success_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_homescout_sources_source_key").on(table.sourceKey)]
);

export type HomeScoutSource = typeof homeScoutSources.$inferSelect;
export type InsertHomeScoutSource = typeof homeScoutSources.$inferInsert;

export const HOME_SCOUT_INGEST_RUN_STATUSES = ["running", "success", "error"] as const;

export const homeScoutIngestRuns = pgTable(
  "home_scout_ingest_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceId: varchar("source_id")
      .notNull()
      .references(() => homeScoutSources.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16, enum: [...HOME_SCOUT_INGEST_RUN_STATUSES] })
      .notNull()
      .default("running"),
    stats: jsonb("stats").notNull().default({}),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    error: text("error"),
  },
  (table) => [index("idx_homescout_ingest_runs_source_started").on(table.sourceId, table.startedAt)]
);

export type HomeScoutIngestRun = typeof homeScoutIngestRuns.$inferSelect;
export type InsertHomeScoutIngestRun = typeof homeScoutIngestRuns.$inferInsert;

export const HOME_SCOUT_LISTING_EVENT_TYPES = [
  "created",
  "seen",
  "price_changed",
  "status_changed",
  "updated",
] as const;

export const homeScoutListingEvents = pgTable(
  "home_scout_listing_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => homeScoutListings.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", {
      length: 32,
      enum: [...HOME_SCOUT_LISTING_EVENT_TYPES],
    }).notNull(),
    observedAt: timestamp("observed_at").notNull().defaultNow(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_homescout_listing_events_listing_time").on(table.listingId, table.observedAt),
    index("idx_homescout_listing_events_type_time").on(table.eventType, table.observedAt),
  ]
);

export type HomeScoutListingEvent = typeof homeScoutListingEvents.$inferSelect;
export type InsertHomeScoutListingEvent = typeof homeScoutListingEvents.$inferInsert;

export const homeScoutMarketBuckets = pgTable(
  "home_scout_market_buckets",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    stateCode: varchar("state_code", { length: 2 })
      .notNull()
      .references(() => states.code),
    propertyType: varchar("property_type", { length: 32 }).notNull(),
    bedsBucket: integer("beds_bucket"),
    activeCount: integer("active_count").notNull().default(0),
    medianPrice: numeric("median_price", { precision: 12, scale: 2 }),
    medianPricePerSqft: numeric("median_price_per_sqft", { precision: 12, scale: 2 }),
    medianDomDays: integer("median_dom_days"),
    priceDropCount7d: integer("price_drop_count_7d").notNull().default(0),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_homescout_market_bucket").on(
      table.countyFips,
      table.stateCode,
      table.propertyType,
      table.bedsBucket
    ),
    index("idx_homescout_market_bucket_county_type").on(
      table.countyFips,
      table.stateCode,
      table.propertyType
    ),
  ]
);

export type HomeScoutMarketBucket = typeof homeScoutMarketBuckets.$inferSelect;
export type InsertHomeScoutMarketBucket = typeof homeScoutMarketBuckets.$inferInsert;

// ---------------------------------------------------------------------------
// HomeScout abuse handling (reports)
// ---------------------------------------------------------------------------

export const homeScoutListingReports = pgTable(
  "home_scout_listing_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    listingId: varchar("listing_id")
      .notNull()
      .references(() => homeScoutListings.id, { onDelete: "cascade" }),

    reporterUserId: varchar("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: varchar("reason", { length: 64 }).notNull(),
    message: text("message"),
    status: varchar("status", { length: 16, enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),

    closedAt: timestamp("closed_at"),
    closedByUserId: varchar("closed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("idx_homescout_reports_listing").on(table.listingId),
    index("idx_homescout_reports_status_created").on(table.status, table.createdAt),
  ]
);

export type HomeScoutListingReport = typeof homeScoutListingReports.$inferSelect;
export type InsertHomeScoutListingReport = typeof homeScoutListingReports.$inferInsert;

// ---------------------------------------------------------------------------
// HomeScout inspections + repair follow-up requests
// ---------------------------------------------------------------------------

export const HOME_SCOUT_INSPECTION_REPORT_TYPES = [
  "seller_pre_listing",
  "buyer_independent",
  "municipal",
  "other",
] as const;

export const HOME_SCOUT_INSPECTION_REQUEST_STATUSES = ["open", "fulfilled", "cancelled"] as const;

export const HOME_SCOUT_INSPECTION_SERVICE_REQUEST_STATUSES = [
  "open",
  "routed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const homeScoutInspectionRequests = pgTable(
  "home_scout_inspection_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => homeScoutListings.id, { onDelete: "cascade" }),
    requesterUserId: varchar("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16, enum: [...HOME_SCOUT_INSPECTION_REQUEST_STATUSES] })
      .notNull()
      .default("open"),
    requestMessage: text("request_message").notNull(),
    preferredWindow: varchar("preferred_window", { length: 120 }),
    fulfilledAt: timestamp("fulfilled_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_homescout_inspection_requests_listing_status").on(table.listingId, table.status),
    index("idx_homescout_inspection_requests_requester").on(table.requesterUserId),
  ]
);

export type HomeScoutInspectionRequest = typeof homeScoutInspectionRequests.$inferSelect;
export type InsertHomeScoutInspectionRequest = typeof homeScoutInspectionRequests.$inferInsert;

export const homeScoutInspectionReports = pgTable(
  "home_scout_inspection_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => homeScoutListings.id, { onDelete: "cascade" }),
    submittedByUserId: varchar("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reportType: varchar("report_type", {
      length: 32,
      enum: [...HOME_SCOUT_INSPECTION_REPORT_TYPES],
    })
      .notNull()
      .default("other"),
    inspectionDate: date("inspection_date"),
    inspectorName: varchar("inspector_name", { length: 140 }),
    inspectorCompany: varchar("inspector_company", { length: 140 }),
    inspectorLicense: varchar("inspector_license", { length: 80 }),
    summary: text("summary"),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    reportUrl: varchar("report_url", { length: 500 }).notNull(),
    sourceRequestId: varchar("source_request_id").references(() => homeScoutInspectionRequests.id, {
      onDelete: "set null",
    }),
    visibility: varchar("visibility", { length: 16, enum: ["public", "private"] })
      .notNull()
      .default("public"),
    status: varchar("status", { length: 16, enum: ["published", "pending_review", "removed"] })
      .notNull()
      .default("published"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_homescout_inspection_reports_listing_visibility").on(
      table.listingId,
      table.visibility,
      table.status
    ),
    index("idx_homescout_inspection_reports_submitter").on(table.submittedByUserId),
  ]
);

export type HomeScoutInspectionReport = typeof homeScoutInspectionReports.$inferSelect;
export type InsertHomeScoutInspectionReport = typeof homeScoutInspectionReports.$inferInsert;

export const homeScoutInspectionServiceRequests = pgTable(
  "home_scout_inspection_service_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    reportId: varchar("report_id")
      .notNull()
      .references(() => homeScoutInspectionReports.id, { onDelete: "cascade" }),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => homeScoutListings.id, { onDelete: "cascade" }),
    requesterUserId: varchar("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    stateCode: varchar("state_code", { length: 2 })
      .notNull()
      .references(() => states.code),
    serviceCategory: varchar("service_category", { length: 64 }).notNull(),
    serviceDescription: text("service_description").notNull(),
    status: varchar("status", {
      length: 16,
      enum: [...HOME_SCOUT_INSPECTION_SERVICE_REQUEST_STATUSES],
    })
      .notNull()
      .default("open"),
    workRequestId: varchar("work_request_id").references(() => workRequests.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_homescout_inspection_service_requests_report").on(table.reportId),
    index("idx_homescout_inspection_service_requests_requester").on(table.requesterUserId),
    index("idx_homescout_inspection_service_requests_status").on(table.status),
    index("idx_homescout_inspection_service_requests_county").on(table.countyFips, table.stateCode),
  ]
);

export type HomeScoutInspectionServiceRequest =
  typeof homeScoutInspectionServiceRequests.$inferSelect;
export type InsertHomeScoutInspectionServiceRequest =
  typeof homeScoutInspectionServiceRequests.$inferInsert;

// ---------------------------------------------------------------------------
// Private home vault (account-only): "Carfax for your home"
// ---------------------------------------------------------------------------

export const USER_HOME_RECORD_TYPES = [
  "inspection",
  "upgrade",
  "improvement",
  "maintenance",
  "appliance",
  "warranty",
  "note",
] as const;

export const USER_HOME_DOCUMENT_TYPES = [
  "inspection_report",
  "invoice",
  "receipt",
  "photo",
  "manual",
  "permit",
  "other",
] as const;

export const userHomes = pgTable(
  "user_homes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    nickname: varchar("nickname", { length: 160 }),
    propertyType: varchar("property_type", { length: 64 }),
    yearBuilt: integer("year_built"),

    address1: varchar("address1", { length: 180 }),
    address2: varchar("address2", { length: 180 }),
    city: varchar("city", { length: 120 }),
    stateCode: varchar("state_code", { length: 2 }).references(() => states.code, {
      onDelete: "set null",
    }),
    countyFips: varchar("county_fips", { length: 5 }).references(() => counties.fips, {
      onDelete: "set null",
    }),
    zipCode: varchar("zip_code", { length: 12 }),

    homeScoutListingId: varchar("home_scout_listing_id").references(() => homeScoutListings.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_homes_owner_updated").on(table.ownerUserId, table.updatedAt),
    index("idx_user_homes_listing").on(table.homeScoutListingId),
  ]
);

export type UserHome = typeof userHomes.$inferSelect;
export type InsertUserHome = typeof userHomes.$inferInsert;

export const userHomeRecords = pgTable(
  "user_home_records",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    homeId: varchar("home_id")
      .notNull()
      .references(() => userHomes.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recordType: varchar("record_type", { length: 24, enum: [...USER_HOME_RECORD_TYPES] }).notNull(),
    occurredAt: date("occurred_at"),
    title: varchar("title", { length: 220 }).notNull(),
    details: text("details"),
    cost: numeric("cost", { precision: 14, scale: 2 }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_home_records_home_occurred").on(table.homeId, table.occurredAt),
    index("idx_user_home_records_home_created").on(table.homeId, table.createdAt),
    index("idx_user_home_records_type").on(table.recordType),
  ]
);

export type UserHomeRecord = typeof userHomeRecords.$inferSelect;
export type InsertUserHomeRecord = typeof userHomeRecords.$inferInsert;

export const userHomeAppliances = pgTable(
  "user_home_appliances",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    homeId: varchar("home_id")
      .notNull()
      .references(() => userHomes.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    category: varchar("category", { length: 64 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    model: varchar("model", { length: 160 }),
    serial: varchar("serial", { length: 160 }),
    installedAt: date("installed_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_home_appliances_home").on(table.homeId),
    index("idx_user_home_appliances_category").on(table.category),
  ]
);

export type UserHomeAppliance = typeof userHomeAppliances.$inferSelect;
export type InsertUserHomeAppliance = typeof userHomeAppliances.$inferInsert;

export const userHomeDocuments = pgTable(
  "user_home_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    homeId: varchar("home_id")
      .notNull()
      .references(() => userHomes.id, { onDelete: "cascade" }),
    recordId: varchar("record_id").references(() => userHomeRecords.id, { onDelete: "set null" }),
    uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    documentType: varchar("document_type", {
      length: 32,
      enum: [...USER_HOME_DOCUMENT_TYPES],
    })
      .notNull()
      .default("other"),
    objectKey: varchar("object_key", { length: 600 }).notNull(),
    originalName: varchar("original_name", { length: 260 }),
    contentType: varchar("content_type", { length: 160 }),
    bytes: bigint("bytes", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_home_documents_home_created").on(table.homeId, table.createdAt),
    index("idx_user_home_documents_record").on(table.recordId),
  ]
);

export type UserHomeDocument = typeof userHomeDocuments.$inferSelect;
export type InsertUserHomeDocument = typeof userHomeDocuments.$inferInsert;

// ---------------------------------------------------------------------------
// Home Maintenance Schedules (private Home Vault, optionally shared with a provider)
// ---------------------------------------------------------------------------

export const homeMaintenanceSchedules = pgTable(
  "home_maintenance_schedules",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHomeId: varchar("user_home_id")
      .notNull()
      .references(() => userHomes.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 64 }),

    cadenceDays: integer("cadence_days").notNull().default(30),
    nextDueAt: timestamp("next_due_at").notNull(),
    lastCompletedAt: timestamp("last_completed_at"),

    // active | paused | archived
    status: varchar("status", { length: 24 }).notNull().default("active"),

    assignedBusinessId: varchar("assigned_business_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    shareWithAssignedProvider: boolean("share_with_assigned_provider").notNull().default(false),
    shareAddress: boolean("share_address").notNull().default(false),

    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_home_maint_sched_owner").on(table.ownerUserId),
    index("idx_home_maint_sched_home").on(table.userHomeId),
    index("idx_home_maint_sched_next_due").on(table.nextDueAt),
    index("idx_home_maint_sched_assigned_biz").on(table.assignedBusinessId),
  ]
);

export type HomeMaintenanceSchedule = typeof homeMaintenanceSchedules.$inferSelect;
export type InsertHomeMaintenanceSchedule = typeof homeMaintenanceSchedules.$inferInsert;

// ---------------------------------------------------------------------------
// Home Projects (private Home Vault): project planning + savings/funding plans
// ---------------------------------------------------------------------------

export const homeProjects = pgTable(
  "home_projects",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHomeId: varchar("user_home_id")
      .notNull()
      .references(() => userHomes.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    projectType: varchar("project_type", { length: 80 }),

    status: varchar("status", {
      length: 20,
      enum: ["planning", "saving", "ready", "in_progress", "completed", "paused", "canceled"],
    })
      .notNull()
      .default("planning"),

    estimatedCost: numeric("estimated_cost", { precision: 14, scale: 2 }),
    desiredStartAt: date("desired_start_at"),

    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_home_projects_owner_updated").on(table.ownerUserId, table.updatedAt),
    index("idx_home_projects_home_updated").on(table.userHomeId, table.updatedAt),
    index("idx_home_projects_status_updated").on(table.status, table.updatedAt),
  ]
);

export type HomeProject = typeof homeProjects.$inferSelect;
export type InsertHomeProject = typeof homeProjects.$inferInsert;

export const homeProjectPlans = pgTable(
  "home_project_plans",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    homeProjectId: varchar("home_project_id")
      .notNull()
      .references(() => homeProjects.id, { onDelete: "cascade" }),

    planType: varchar("plan_type", { length: 16, enum: ["savings", "funding"] })
      .notNull()
      .default("savings"),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    currentSaved: numeric("current_saved", { precision: 14, scale: 2 }).notNull().default("0"),
    targetBy: date("target_by"),
    monthlyContribution: numeric("monthly_contribution", { precision: 14, scale: 2 }),
    fundingSources: jsonb("funding_sources").$type<string[]>().notNull().default([]),
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_home_project_plans_owner_updated").on(table.ownerUserId, table.updatedAt),
    index("idx_home_project_plans_project_updated").on(table.homeProjectId, table.updatedAt),
  ]
);

export type HomeProjectPlan = typeof homeProjectPlans.$inferSelect;
export type InsertHomeProjectPlan = typeof homeProjectPlans.$inferInsert;

// ---------------------------------------------------------------------------
// Home Report Shares (intent-gated messaging context)
// ---------------------------------------------------------------------------

export const homeReportShares = pgTable(
  "home_report_shares",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedByUserId: varchar("shared_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    threadId: varchar("thread_id").notNull(),
    threadType: varchar("thread_type", { length: 24, enum: ["marketplace", "legacy"] })
      .notNull()
      .default("marketplace"),

    userHomeId: varchar("user_home_id")
      .notNull()
      .references(() => userHomes.id, { onDelete: "cascade" }),

    includeAddress: boolean("include_address").notNull().default(false),
    includeDocuments: boolean("include_documents").notNull().default(false),

    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),

    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_home_report_shares_thread").on(table.threadId, table.createdAt),
    index("idx_home_report_shares_home").on(table.userHomeId, table.createdAt),
    index("idx_home_report_shares_owner").on(table.ownerUserId, table.updatedAt),
  ]
);

export type HomeReportShare = typeof homeReportShares.$inferSelect;
export type InsertHomeReportShare = typeof homeReportShares.$inferInsert;

// ---------------------------------------------------------------------------
// Property Lifecycle OS (Build / Existing / Upgrades / Maintain / Sell)
// ---------------------------------------------------------------------------

export const propertyPrograms = pgTable(
  "property_programs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    primaryUserId: varchar("primary_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    countyFips: varchar("county_fips", { length: 5 }).notNull(),
    stateCode: varchar("state_code", { length: 2 }).notNull(),
    mode: varchar("mode", { enum: ["build", "existing"] }).notNull(),
    status: varchar("status", { enum: ["draft", "active", "paused", "completed"] })
      .notNull()
      .default("draft"),
    addressJson: jsonb("address_json").$type<Record<string, any>>().notNull().default({}),
    userHomeId: varchar("user_home_id").references(() => userHomes.id, { onDelete: "set null" }),
    parcelId: text("parcel_id"),
    propertyType: varchar("property_type", { length: 64 }),
    yearBuilt: integer("year_built"),
    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_programs_owner").on(table.ownerUserId),
    index("idx_property_programs_primary").on(table.primaryUserId),
    index("idx_property_programs_county_state").on(table.countyFips, table.stateCode),
  ]
);

export type PropertyProgram = typeof propertyPrograms.$inferSelect;
export type InsertPropertyProgram = typeof propertyPrograms.$inferInsert;

export const propertyParticipants = pgTable(
  "property_participants",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantRole: varchar("participant_role", { length: 64 }).notNull(),
    permissions: jsonb("permissions").$type<Record<string, any>>().notNull().default({}),
    status: varchar("status", { enum: ["active", "invited", "removed"] })
      .notNull()
      .default("active"),
    invitedByUserId: varchar("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_participants_property").on(table.propertyProgramId),
    index("idx_property_participants_user").on(table.userId),
  ]
);

export type PropertyParticipant = typeof propertyParticipants.$inferSelect;
export type InsertPropertyParticipant = typeof propertyParticipants.$inferInsert;

export const propertyLifecycleEvents = pgTable(
  "property_lifecycle_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    actionType: varchar("action_type", { length: 80 }).notNull(),
    phase: varchar("phase", { length: 80 }),
    title: text("title").notNull(),
    description: text("description"),
    occurredAt: timestamp("occurred_at").notNull(),
    source: varchar("source", { enum: ["user", "scout", "integration", "system"] })
      .notNull()
      .default("system"),
    status: varchar("status", { enum: ["planned", "in_progress", "done", "blocked"] })
      .notNull()
      .default("planned"),
    costAmount: numeric("cost_amount", { precision: 12, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_lifecycle_events_property").on(table.propertyProgramId),
    index("idx_property_lifecycle_events_occurred").on(table.occurredAt),
  ]
);

export type PropertyLifecycleEvent = typeof propertyLifecycleEvents.$inferSelect;
export type InsertPropertyLifecycleEvent = typeof propertyLifecycleEvents.$inferInsert;

export const propertyDocuments = pgTable(
  "property_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    lifecycleEventId: varchar("lifecycle_event_id").references(() => propertyLifecycleEvents.id, {
      onDelete: "set null",
    }),
    documentType: varchar("document_type", { length: 80 }).notNull(),
    fileUrl: text("file_url").notNull(),
    checksum: varchar("checksum", { length: 120 }),
    verified: boolean("verified").notNull().default(false),
    uploadedByUserId: varchar("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_property_documents_property").on(table.propertyProgramId),
    index("idx_property_documents_event").on(table.lifecycleEventId),
  ]
);

export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type InsertPropertyDocument = typeof propertyDocuments.$inferInsert;

export const propertyParticipantInvites = pgTable(
  "property_participant_invites",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    inviterUserId: varchar("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: varchar("invitee_email").notNull(),
    participantRole: varchar("participant_role", { length: 64 }).notNull(),
    permissions: jsonb("permissions").$type<Record<string, any>>().notNull().default({}),
    invitationCode: varchar("invitation_code").unique().notNull(),
    status: varchar("status", { enum: ["pending", "accepted", "revoked", "expired"] })
      .notNull()
      .default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    acceptedParticipantId: varchar("accepted_participant_id").references(
      () => propertyParticipants.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_participant_invites_property").on(table.propertyProgramId),
    index("idx_property_participant_invites_code").on(table.invitationCode),
    index("idx_property_participant_invites_email").on(table.inviteeEmail),
  ]
);

export type PropertyParticipantInvite = typeof propertyParticipantInvites.$inferSelect;
export type InsertPropertyParticipantInvite = typeof propertyParticipantInvites.$inferInsert;

export const propertyUpgrades = pgTable(
  "property_upgrades",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 80 }).notNull(),
    scope: text("scope").notNull(),
    budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
    status: varchar("status", { enum: ["planned", "active", "done", "cancelled"] })
      .notNull()
      .default("planned"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_upgrades_property").on(table.propertyProgramId),
    index("idx_property_upgrades_status").on(table.propertyProgramId, table.status),
  ]
);

export type PropertyUpgrade = typeof propertyUpgrades.$inferSelect;
export type InsertPropertyUpgrade = typeof propertyUpgrades.$inferInsert;

export const propertyUpgradeEvents = pgTable(
  "property_upgrade_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyUpgradeId: varchar("property_upgrade_id")
      .notNull()
      .references(() => propertyUpgrades.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    title: text("title").notNull(),
    status: varchar("status", { enum: ["planned", "done", "blocked"] })
      .notNull()
      .default("planned"),
    occurredAt: timestamp("occurred_at").notNull(),
    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_property_upgrade_events_upgrade").on(table.propertyUpgradeId),
    index("idx_property_upgrade_events_occurred").on(table.occurredAt),
  ]
);

export type PropertyUpgradeEvent = typeof propertyUpgradeEvents.$inferSelect;
export type InsertPropertyUpgradeEvent = typeof propertyUpgradeEvents.$inferInsert;

export const propertyEventLog = pgTable(
  "property_event_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventId: varchar("event_id", { length: 80 }).notNull(),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    actionType: varchar("action_type", { length: 80 }).notNull(),
    actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: varchar("actor_role", { length: 64 }),
    countyFips: varchar("county_fips", { length: 5 }),
    stateCode: varchar("state_code", { length: 2 }),
    occurredAtUtc: timestamp("occurred_at_utc").notNull(),
    recordedAtUtc: timestamp("recorded_at_utc").notNull().defaultNow(),
    timezone: varchar("timezone", { length: 80 }),
    localDate: date("local_date"),
    statusBefore: varchar("status_before", { length: 64 }),
    statusAfter: varchar("status_after", { length: 64 }),
    costAmount: numeric("cost_amount", { precision: 12, scale: 2 }),
    timeDeltaHours: numeric("time_delta_hours", { precision: 12, scale: 3 }),
    riskDelta: numeric("risk_delta", { precision: 8, scale: 3 }),
    trustSnapshotIds: jsonb("trust_snapshot_ids")
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    verificationSnapshot: jsonb("verification_snapshot")
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    documentRefs: jsonb("document_refs").$type<any[]>().notNull().default([]),
    sourceSurface: varchar("source_surface", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, any>>().notNull().default({}),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_property_event_log_recorded").on(table.recordedAtUtc),
    index("idx_property_event_log_property").on(table.propertyProgramId, table.occurredAtUtc),
    index("idx_property_event_log_idempotency").on(table.idempotencyKey),
  ]
);

export type PropertyEventLogRow = typeof propertyEventLog.$inferSelect;
export type InsertPropertyEventLogRow = typeof propertyEventLog.$inferInsert;

export const propertyEventQuarantine = pgTable(
  "property_event_quarantine",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    rawPayload: jsonb("raw_payload").$type<Record<string, any>>().notNull(),
    reason: varchar("reason", { length: 160 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 180 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_property_event_quarantine_created").on(table.createdAt)]
);

export type PropertyEventQuarantineRow = typeof propertyEventQuarantine.$inferSelect;
export type InsertPropertyEventQuarantineRow = typeof propertyEventQuarantine.$inferInsert;

export const propertyPipelineCheckpoints = pgTable("property_pipeline_checkpoints", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value").$type<Record<string, any>>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PropertyPipelineCheckpoint = typeof propertyPipelineCheckpoints.$inferSelect;
export type InsertPropertyPipelineCheckpoint = typeof propertyPipelineCheckpoints.$inferInsert;

export const propertyReadinessSnapshots = pgTable(
  "property_readiness_snapshots",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    readinessScore: numeric("readiness_score", { precision: 5, scale: 2 }).notNull(),
    hardBlockers: jsonb("hard_blockers").$type<any[]>().notNull().default([]),
    softBlockers: jsonb("soft_blockers").$type<any[]>().notNull().default([]),
    nextBestActions: jsonb("next_best_actions").$type<any[]>().notNull().default([]),
    computedAt: timestamp("computed_at").defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_property_readiness_snapshots_property").on(
      table.propertyProgramId,
      table.computedAt
    ),
  ]
);

export type PropertyReadinessSnapshot = typeof propertyReadinessSnapshots.$inferSelect;
export type InsertPropertyReadinessSnapshot = typeof propertyReadinessSnapshots.$inferInsert;

export const propertySellReadinessSnapshots = pgTable(
  "property_sell_readiness_snapshots",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    readinessScore: numeric("readiness_score", { precision: 5, scale: 2 }).notNull(),
    hardBlockers: jsonb("hard_blockers").$type<any[]>().notNull().default([]),
    softBlockers: jsonb("soft_blockers").$type<any[]>().notNull().default([]),
    packetSummary: jsonb("packet_summary").$type<Record<string, any>>().notNull().default({}),
    computedAt: timestamp("computed_at").defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_property_sell_readiness_snapshots_property").on(
      table.propertyProgramId,
      table.computedAt
    ),
  ]
);

export type PropertySellReadinessSnapshot = typeof propertySellReadinessSnapshots.$inferSelect;
export type InsertPropertySellReadinessSnapshot =
  typeof propertySellReadinessSnapshots.$inferInsert;

export const propertyHomefaxSnapshots = pgTable(
  "property_homefax_snapshots",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    propertyProgramId: varchar("property_program_id")
      .notNull()
      .references(() => propertyPrograms.id, { onDelete: "cascade" }),
    summary: jsonb("summary").$type<Record<string, any>>().notNull().default({}),
    timeline: jsonb("timeline").$type<any[]>().notNull().default([]),
    computedAt: timestamp("computed_at").defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_property_homefax_snapshots_property").on(table.propertyProgramId, table.computedAt),
  ]
);

export type PropertyHomefaxSnapshot = typeof propertyHomefaxSnapshots.$inferSelect;
export type InsertPropertyHomefaxSnapshot = typeof propertyHomefaxSnapshots.$inferInsert;

// ---------------------------------------------------------------------------
// Private vehicle vault (account-only): "Carfax for your vehicle"
// ---------------------------------------------------------------------------

export const USER_VEHICLE_RECORD_TYPES = [
  "service",
  "repair",
  "upgrade",
  "inspection",
  "accident",
  "note",
] as const;

export const USER_VEHICLE_DOCUMENT_TYPES = [
  "service_report",
  "invoice",
  "receipt",
  "photo",
  "title",
  "other",
] as const;

export const userVehicles = pgTable(
  "user_vehicles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    nickname: varchar("nickname", { length: 160 }),
    year: integer("year"),
    make: varchar("make", { length: 80 }),
    model: varchar("model", { length: 120 }),
    trim: varchar("trim", { length: 120 }),
    vin: varchar("vin", { length: 32 }),
    mileage: integer("mileage"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_vehicles_owner_updated").on(table.ownerUserId, table.updatedAt),
    index("idx_user_vehicles_vin").on(table.vin),
  ]
);

export type UserVehicle = typeof userVehicles.$inferSelect;
export type InsertUserVehicle = typeof userVehicles.$inferInsert;

export const userVehicleRecords = pgTable(
  "user_vehicle_records",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vehicleId: varchar("vehicle_id")
      .notNull()
      .references(() => userVehicles.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    recordType: varchar("record_type", {
      length: 24,
      enum: [...USER_VEHICLE_RECORD_TYPES],
    }).notNull(),
    occurredAt: date("occurred_at"),
    title: varchar("title", { length: 220 }).notNull(),
    details: text("details"),
    cost: numeric("cost", { precision: 14, scale: 2 }),
    mileage: integer("mileage"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_vehicle_records_vehicle_occurred").on(table.vehicleId, table.occurredAt),
    index("idx_user_vehicle_records_vehicle_created").on(table.vehicleId, table.createdAt),
    index("idx_user_vehicle_records_type").on(table.recordType),
  ]
);

export type UserVehicleRecord = typeof userVehicleRecords.$inferSelect;
export type InsertUserVehicleRecord = typeof userVehicleRecords.$inferInsert;

export const userVehicleDocuments = pgTable(
  "user_vehicle_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vehicleId: varchar("vehicle_id")
      .notNull()
      .references(() => userVehicles.id, { onDelete: "cascade" }),
    recordId: varchar("record_id").references(() => userVehicleRecords.id, {
      onDelete: "set null",
    }),
    uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    documentType: varchar("document_type", {
      length: 32,
      enum: [...USER_VEHICLE_DOCUMENT_TYPES],
    })
      .notNull()
      .default("other"),
    objectKey: varchar("object_key", { length: 600 }).notNull(),
    originalName: varchar("original_name", { length: 260 }),
    contentType: varchar("content_type", { length: 160 }),
    bytes: bigint("bytes", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_vehicle_documents_vehicle_created").on(table.vehicleId, table.createdAt),
    index("idx_user_vehicle_documents_record").on(table.recordId),
  ]
);

export type UserVehicleDocument = typeof userVehicleDocuments.$inferSelect;
export type InsertUserVehicleDocument = typeof userVehicleDocuments.$inferInsert;

// ---------------------------------------------------------------------------
// Commercial directory projects + bids + campaign landing pages
// ---------------------------------------------------------------------------

export const COMMERCIAL_PROJECT_STATUSES = [
  "draft",
  "open",
  "closed",
  "awarded",
  "archived",
] as const;

export const COMMERCIAL_BID_STATUSES = [
  "submitted",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export const commercialProjects = pgTable(
  "commercial_projects",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => users.id),
    countyFips: varchar("county_fips", { length: 5 })
      .notNull()
      .references(() => counties.fips),
    stateCode: varchar("state_code", { length: 2 })
      .notNull()
      .references(() => states.code),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 260 }).notNull().unique(),
    summary: text("summary").notNull(),
    scopeOfWork: text("scope_of_work").notNull(),
    requirements: text("requirements").notNull(),
    budgetMin: numeric("budget_min", { precision: 14, scale: 2 }),
    budgetMax: numeric("budget_max", { precision: 14, scale: 2 }),
    bidDueAt: timestamp("bid_due_at"),
    projectStartAt: timestamp("project_start_at"),
    status: varchar("status", { length: 24, enum: [...COMMERCIAL_PROJECT_STATUSES] })
      .notNull()
      .default("open"),
    winningBidId: varchar("winning_bid_id"),
    campaignEnabled: boolean("campaign_enabled").notNull().default(false),
    campaignHeadline: varchar("campaign_headline", { length: 220 }),
    campaignBody: text("campaign_body"),
    heroImageUrl: varchar("hero_image_url", { length: 500 }),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_commercial_projects_county_status").on(
      table.countyFips,
      table.status,
      table.createdAt
    ),
    index("idx_commercial_projects_slug").on(table.slug),
  ]
);

export type CommercialProject = typeof commercialProjects.$inferSelect;
export type InsertCommercialProject = typeof commercialProjects.$inferInsert;

export const commercialProjectDocuments = pgTable(
  "commercial_project_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => commercialProjects.id, { onDelete: "cascade" }),
    uploadedByUserId: varchar("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: varchar("file_url", { length: 600 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSizeBytes: integer("file_size_bytes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_commercial_project_documents_project").on(table.projectId, table.createdAt),
  ]
);

export type CommercialProjectDocument = typeof commercialProjectDocuments.$inferSelect;
export type InsertCommercialProjectDocument = typeof commercialProjectDocuments.$inferInsert;

export const commercialProjectBids = pgTable(
  "commercial_project_bids",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => commercialProjects.id, { onDelete: "cascade" }),
    contractorId: varchar("contractor_id")
      .notNull()
      .references(() => contractors.id),
    bidderUserId: varchar("bidder_user_id")
      .notNull()
      .references(() => users.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    timelineDays: integer("timeline_days"),
    proposal: text("proposal").notNull(),
    status: varchar("status", { length: 24, enum: [...COMMERCIAL_BID_STATUSES] })
      .notNull()
      .default("submitted"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_commercial_project_bid_per_contractor").on(table.projectId, table.contractorId),
    index("idx_commercial_project_bids_project_status").on(
      table.projectId,
      table.status,
      table.createdAt
    ),
    index("idx_commercial_project_bids_bidder").on(table.bidderUserId, table.createdAt),
  ]
);

export type CommercialProjectBid = typeof commercialProjectBids.$inferSelect;
export type InsertCommercialProjectBid = typeof commercialProjectBids.$inferInsert;

export type MetalsPriceSnapshot = typeof metalsPriceSnapshots.$inferSelect;
export type InsertMetalsPriceSnapshot = typeof metalsPriceSnapshots.$inferInsert;
export type MetalsPortfolioTransaction = typeof metalsPortfolioTransactions.$inferSelect;
export type InsertMetalsPortfolioTransaction = typeof metalsPortfolioTransactions.$inferInsert;

export const marketplaceInquiries = pgTable("marketplace_inquiries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),

  // Inquiry details
  message: text("message").notNull(),
  offerAmount: decimal("offer_amount", { precision: 12, scale: 2 }),

  // Contact info (from buyer)
  buyerPhone: varchar("buyer_phone"),
  buyerEmail: varchar("buyer_email"),
  preferredContactMethod: varchar("preferred_contact_method", {
    enum: ["phone", "email", "message"],
  }).default("message"),

  // Status tracking
  status: varchar("status", {
    enum: ["pending", "replied", "accepted", "declined", "completed"],
  }).default("pending"),

  sellerResponse: text("seller_response"),
  respondedAt: timestamp("responded_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketplaceFavorites = pgTable("marketplace_favorites", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  listingId: varchar("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketplaceReports = pgTable("marketplace_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  reporterId: varchar("reporter_id").references(() => users.id),

  reason: varchar("reason", {
    enum: [
      "spam",
      "fraud",
      "inappropriate_content",
      "wrong_category",
      "duplicate",
      "overpriced",
      "other",
    ],
  }).notNull(),
  description: text("description"),

  status: varchar("status", {
    enum: ["pending", "investigating", "resolved", "dismissed"],
  }).default("pending"),

  adminNotes: text("admin_notes"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Precious metals exchange (physical only, USD only)
export const metalsPriceSnapshots = pgTable(
  "metals_price_snapshots",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    asOf: timestamp("as_of").notNull().defaultNow(),
    source: varchar("source", { length: 40 }).notNull().default("metals_api"),
    baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("USD"),

    // USD per 1 troy ounce (XAU/XAG/XPT/XPD)
    xauUsdPerOz: decimal("xau_usd_per_oz", { precision: 14, scale: 4 }),
    xagUsdPerOz: decimal("xag_usd_per_oz", { precision: 14, scale: 4 }),
    xptUsdPerOz: decimal("xpt_usd_per_oz", { precision: 14, scale: 4 }),
    xpdUsdPerOz: decimal("xpd_usd_per_oz", { precision: 14, scale: 4 }),

    raw: jsonb("raw").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_metals_price_snapshots_as_of").on(table.asOf)]
);

export const metalsPortfolioTransactions = pgTable(
  "metals_portfolio_transactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    direction: varchar("direction", { enum: ["buy", "sell"] }).notNull(),

    metalCode: varchar("metal_code", { length: 8 }).notNull(), // e.g. XAU, XAG, XPT, XPD, OTHER
    metalName: varchar("metal_name", { length: 64 }), // optional label for non-standard metals

    // Physical only: quantity is tracked in troy ounces (oz)
    quantityOz: decimal("quantity_oz", { precision: 18, scale: 6 }).notNull(),
    totalUsd: decimal("total_usd", { precision: 14, scale: 2 }).notNull(),
    executedAt: timestamp("executed_at").notNull().defaultNow(),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_metals_portfolio_transactions_user_executed_at").on(table.userId, table.executedAt),
  ]
);

// Vendor verification for food marketplace and other regulated categories
export const vendorVerifications = pgTable("vendor_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  categoryId: varchar("category_id")
    .notNull()
    .references(() => marketplaceCategories.id),

  // Identity verification (required for all)
  identityDocumentType: varchar("identity_document_type", {
    enum: ["drivers_license", "passport", "state_id"],
  }),
  identityDocumentUrl: varchar("identity_document_url"),
  identityVerified: boolean("identity_verified").default(false),

  // Business verification (for commercial sellers)
  businessName: varchar("business_name"),
  businessLicenseUrl: varchar("business_license_url"),
  businessLicenseNumber: varchar("business_license_number"),
  businessLicenseExpiry: timestamp("business_license_expiry"),

  // Food-specific certifications
  foodHandlersPermitUrl: varchar("food_handlers_permit_url"),
  foodHandlersPermitExpiry: timestamp("food_handlers_permit_expiry"),
  kitchenInspectionUrl: varchar("kitchen_inspection_url"),
  kitchenInspectionExpiry: timestamp("kitchen_inspection_expiry"),
  insuranceCertificateUrl: varchar("insurance_certificate_url"),
  insuranceExpiry: timestamp("insurance_expiry"),

  // Legal compliance attestation
  legalComplianceAttestation: text("legal_compliance_attestation"),
  hasAttestedCompliance: boolean("has_attested_compliance").default(false),
  attestationDate: timestamp("attestation_date"),

  // Verification status
  status: varchar("status", {
    enum: ["pending", "in_review", "approved", "rejected", "expired"],
  }).default("pending"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes"),

  // Approval tracking
  approvedUntil: timestamp("approved_until"),
  requiresRenewal: boolean("requires_renewal").default(false),
  renewalReminderSent: boolean("renewal_reminder_sent").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Buyer verification for restricted purchases
export const buyerVerifications = pgTable("buyer_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  // Identity verification
  identityDocumentType: varchar("identity_document_type", {
    enum: ["drivers_license", "passport", "state_id"],
  }),
  identityDocumentUrl: varchar("identity_document_url"),
  identityVerified: boolean("identity_verified").default(false),

  // Age verification (for certain purchases)
  isOver18: boolean("is_over_18").default(false),
  isOver21: boolean("is_over_21").default(false),

  // Address verification
  addressVerified: boolean("address_verified").default(false),

  // Verification status
  status: varchar("status", {
    enum: ["pending", "in_review", "approved", "rejected"],
  }).default("pending"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Address verification for all users (similar to Nextdoor)
export const addressVerifications = pgTable("address_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  // Address details to verify
  fullAddress: text("full_address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  zipCode: varchar("zip_code").notNull(),

  // Verification methods
  verificationMethod: varchar("verification_method", {
    enum: [
      "utility_bill",
      "bank_statement",
      "lease_agreement",
      "property_deed",
      "postcard",
      "phone_verification",
    ],
  }),

  // Document uploads for verification
  documentUrl: varchar("document_url"),
  documentType: varchar("document_type"),

  // Postcard verification (like Nextdoor)
  postcardCode: varchar("postcard_code", { length: 6 }),
  postcardSentAt: timestamp("postcard_sent_at"),
  postcardVerifiedAt: timestamp("postcard_verified_at"),

  // Phone verification
  phoneNumber: varchar("phone_number"),
  phoneVerificationCode: varchar("phone_verification_code", { length: 6 }),
  phoneVerifiedAt: timestamp("phone_verified_at"),

  // Verification status and timeline
  status: addressVerificationStatusEnum("status").default("pending"),
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes"),

  // Deadline tracking (14 days from account creation)
  deadline: timestamp("deadline").notNull(),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderSent: timestamp("last_reminder_sent"),

  // Address validation
  addressValidated: boolean("address_validated").default(false),
  addressValidationProvider: varchar("address_validation_provider"), // USPS, Google, etc.
  addressValidationResponse: jsonb("address_validation_response"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const identityVerifications = pgTable("identity_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  documentType: identityDocumentTypeEnum("document_type").notNull(),
  objectKey: varchar("object_key").notNull(),

  status: identityVerificationStatusEnum("status").default("pending"),
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Data Privacy and Security Management Tables
export const userDataRequests = pgTable("user_data_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  requestType: varchar("request_type", {
    enum: ["data_export", "data_deletion", "privacy_report", "account_closure"],
  }).notNull(),
  status: varchar("status", {
    enum: ["pending", "processing", "completed", "failed", "rejected"],
  }).default("pending"),
  requestedBy: varchar("requested_by").notNull(), // Who made the request (user or admin)
  reason: text("reason"),
  adminNotes: text("admin_notes"),
  completedBy: varchar("completed_by"), // Admin who processed
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // For automatic processing
  verificationCode: varchar("verification_code"), // Security verification
  isVerified: boolean("is_verified").default(false),
  downloadUrl: varchar("download_url"), // For data exports
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dataAccessLogs = pgTable("data_access_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // User whose data was accessed
  accessorId: varchar("accessor_id").notNull(), // Who accessed the data
  accessorRole: varchar("accessor_role").notNull(),
  actionType: varchar("action_type", {
    enum: ["view", "edit", "delete", "export", "login_attempt", "password_reset", "profile_update"],
  }).notNull(),
  resourceType: varchar("resource_type", {
    enum: ["profile", "messages", "leads", "recommendations", "payments", "documents", "analytics"],
  }),
  resourceId: varchar("resource_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  location: jsonb("location").$type<{
    country?: string;
    state?: string;
    city?: string;
  }>(),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const securityIncidents = pgTable("security_incidents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Affected user (if applicable)
  incidentType: varchar("incident_type", {
    enum: [
      "unauthorized_access",
      "data_breach",
      "failed_login_attempts",
      "suspicious_activity",
      "phishing_attempt",
      "malware_detection",
    ],
  }).notNull(),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  status: varchar("status", {
    enum: ["open", "investigating", "resolved", "false_positive"],
  }).default("open"),
  description: text("description").notNull(),
  affectedData: jsonb("affected_data").$type<{
    userIds?: string[];
    dataTypes?: string[];
    recordCount?: number;
  }>(),
  sourceIp: varchar("source_ip"),
  detectionMethod: varchar("detection_method"), // 'automated', 'user_report', 'admin_review'
  assignedTo: varchar("assigned_to"), // Admin handling the incident
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at"),
  notificationsSent: boolean("notifications_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPrivacySettings = pgTable("user_privacy_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  profileVisibility: varchar("profile_visibility", {
    enum: ["public", "contractors_only", "private"],
  }).default("public"),
  showContactInfo: boolean("show_contact_info").default(true),
  allowDirectMessages: boolean("allow_direct_messages").default(true),
  shareActivityStatus: boolean("share_activity_status").default(true),
  allowAnalytics: boolean("allow_analytics").default(true),
  allowThirdPartySharing: boolean("allow_third_party_sharing").default(false),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(true),
  marketingEmails: boolean("marketing_emails").default(false),
  dataRetentionConsent: boolean("data_retention_consent").default(true),
  privacyPolicyAccepted: timestamp("privacy_policy_accepted"),
  termsOfServiceAccepted: timestamp("terms_of_service_accepted"),
  cookieConsent: jsonb("cookie_consent").$type<{
    essential?: boolean;
    analytics?: boolean;
    marketing?: boolean;
    functional?: boolean;
  }>(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Social Feed and Community Features
export const communityPosts = pgTable("community_posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  authorId: varchar("author_id")
    .notNull()
    .references(() => users.id),

  // Post content
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  imageUrls: text("image_urls").array(),
  attachmentUrls: text("attachment_urls").array(),

  // Geographic targeting
  scope: varchar("scope", {
    enum: ["national", "state", "region", "county", "city"],
  }).default("county"),
  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips", { length: 5 }),
  cityName: varchar("city_name"),
  regionName: varchar("region_name"), // Custom regions like "Bay Area", "Northeast", etc.

  // Post categorization
  category: varchar("category", {
    enum: [
      "general",
      "projects",
      "recommendations",
      "questions",
      "marketplace",
      "events",
      "announcements",
    ],
  }).default("general"),
  tags: text("tags").array(),

  // Engagement metrics
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  shareCount: integer("share_count").default(0),

  // Moderation
  isPublished: boolean("is_published").default(true),
  isPinned: boolean("is_pinned").default(false),
  isHidden: boolean("is_hidden").default(false),
  moderatorNotes: text("moderator_notes"),
  moderatedBy: varchar("moderated_by"),
  moderatedAt: timestamp("moderated_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  postId: varchar("post_id")
    .notNull()
    .references(() => communityPosts.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved community posts (bookmarks)
export const communityPostSaves = pgTable(
  "community_post_saves",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("community_post_saves_user_post_uidx").on(table.userId, table.postId),
    index("idx_community_post_saves_user").on(table.userId),
    index("idx_community_post_saves_post").on(table.postId),
  ]
);

export const commentLikes = pgTable("comment_likes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id")
    .notNull()
    .references(() => postComments.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invitations table for tracking user invitations
export const invitations = pgTable(
  "invitations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    inviterId: varchar("inviter_id")
      .notNull()
      .references(() => users.id),
    inviteeEmail: varchar("invitee_email").notNull(),
    inviteeId: varchar("invitee_id").references(() => users.id), // Set when invitation is accepted

    // Invitation details
    type: invitationTypeEnum("type").notNull().default("email"),
    status: invitationStatusEnum("status").notNull().default("pending"),
    targetRole: userRoleEnum("target_role").notNull(), // What role the invitee should have

    // Invitation content
    personalMessage: text("personal_message"),
    invitationCode: varchar("invitation_code").unique().notNull(),

    // Tracking
    sentAt: timestamp("sent_at").defaultNow(),
    acceptedAt: timestamp("accepted_at"),
    expiresAt: timestamp("expires_at").notNull(),

    // Location context (for location-based matching)
    inviterCity: varchar("inviter_city"),
    inviterState: varchar("inviter_state"),
    inviterCounty: varchar("inviter_county"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("invitations_inviter_id_idx").on(table.inviterId),
    index("invitations_email_idx").on(table.inviteeEmail),
    index("invitations_code_idx").on(table.invitationCode),
    index("invitations_status_idx").on(table.status),
  ]
);

// Referral tracking and rewards
export const referralStats = pgTable(
  "referral_stats",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),

    // Statistics
    totalInvitationsSent: integer("total_invitations_sent").default(0),
    totalInvitationsAccepted: integer("total_invitations_accepted").default(0),
    homeownersReferred: integer("homeowners_referred").default(0),
    contractorsReferred: integer("contractors_referred").default(0),

    // Rewards tracking
    rewardPointsEarned: integer("reward_points_earned").default(0),
    rewardPointsRedeemed: integer("reward_points_redeemed").default(0),

    // Monthly tracking
    currentMonthInvitations: integer("current_month_invitations").default(0),
    lastMonthReset: timestamp("last_month_reset").defaultNow(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("referral_stats_user_id_idx").on(table.userId)]
);

export const communityGroups = pgTable("community_groups", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  slug: varchar("slug").notNull().unique(),
  imageUrl: varchar("image_url"),
  bannerUrl: varchar("banner_url"),

  // Group type
  groupType: varchar("group_type", {
    enum: ["auto_county", "custom", "trade", "business", "interest", "neighborhood"],
  })
    .default("custom")
    .notNull(),
  autoCreated: boolean("auto_created").default(false), // System-created county groups

  // Geographic scope
  scope: varchar("scope", {
    enum: ["national", "state", "region", "county", "city", "trade_specific"],
  }).default("county"),
  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips", { length: 5 }),
  cityName: varchar("city_name"),
  regionName: varchar("region_name"),

  // Group settings
  isPrivate: boolean("is_private").default(false),
  requiresApproval: boolean("requires_approval").default(false),
  allowPostApproval: boolean("allow_post_approval").default(false),
  allowCrossCounty: boolean("allow_cross_county").default(false), // For custom groups spanning multiple counties

  // Stats
  memberCount: integer("member_count").default(0),
  postCount: integer("post_count").default(0),

  // Management
  createdBy: varchar("created_by").references(() => users.id), // Nullable for auto-created
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupId: varchar("group_id")
    .notNull()
    .references(() => communityGroups.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  role: varchar("role", {
    enum: ["member", "moderator", "admin", "owner"],
  }).default("member"),

  joinedAt: timestamp("joined_at").defaultNow(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),

  isActive: boolean("is_active").default(true),
  isBanned: boolean("is_banned").default(false),
  bannedReason: text("banned_reason"),
  bannedBy: varchar("banned_by"),
  bannedAt: timestamp("banned_at"),
});

// Links custom groups to multiple counties
export const groupCountyLinks = pgTable(
  "group_county_links",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    groupId: varchar("group_id")
      .notNull()
      .references(() => communityGroups.id),
    countyFips: varchar("county_fips", { length: 5 }).notNull(),
    stateCode: varchar("state_code", { length: 2 }).notNull(),

    // For display purposes
    countyName: varchar("county_name"),

    isActive: boolean("is_active").default(true),
    addedBy: varchar("added_by").references(() => users.id),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    index("group_county_links_group_idx").on(table.groupId),
    index("group_county_links_county_idx").on(table.countyFips),
  ]
);

export const regions = pgTable("regions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "Bay Area", "Northeast", "Southern California"
  slug: varchar("slug").notNull().unique(),
  description: text("description"),

  // Geographic bounds
  statesCovered: text("states_covered").array(), // State codes
  countiesCovered: text("counties_covered").array(), // FIPS codes
  citiesCovered: text("cities_covered").array(),

  // Metadata
  population: integer("population"),
  isOfficial: boolean("is_official").default(false), // Admin-created vs user-created
  createdBy: varchar("created_by").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// HOA (Homeowner Association) Management - Phase 4
export const homeownerAssociations = pgTable("homeowner_associations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  countyFips: varchar("county_fips").notNull(),
  zipCode: varchar("zip_code"),

  // HOA Details
  establishedYear: integer("established_year"),
  totalUnits: integer("total_units").notNull(),
  monthlyFees: decimal("monthly_fees", { precision: 10, scale: 2 }),
  reserves: decimal("reserves", { precision: 12, scale: 2 }),
  managementCompany: varchar("management_company"),

  // Board Information
  boardMembers: jsonb("board_members").$type<
    Array<{
      name: string;
      position: string;
      term: string;
    }>
  >(),

  // Amenities and Features
  amenities: text("amenities").array(),
  nextMeeting: timestamp("next_meeting"),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hoaFinancialRecords = pgTable("hoa_financial_records", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  hoaId: varchar("hoa_id")
    .notNull()
    .references(() => homeownerAssociations.id, { onDelete: "cascade" }),

  // Financial Summary
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }),
  totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }),
  netIncome: decimal("net_income", { precision: 12, scale: 2 }),
  reserves: decimal("reserves", { precision: 12, scale: 2 }),
  outstandingFees: decimal("outstanding_fees", { precision: 12, scale: 2 }),

  // Expense Breakdown
  expenseCategories: jsonb("expense_categories").$type<
    Array<{
      category: string;
      amount: string;
      percentage: number;
    }>
  >(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hoaVendors = pgTable("hoa_vendors", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  hoaId: varchar("hoa_id")
    .notNull()
    .references(() => homeownerAssociations.id, { onDelete: "cascade" }),

  // Vendor Details
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // Landscaping, Pool Maintenance, etc.
  contactPerson: varchar("contact_person"),
  phone: varchar("phone"),
  email: varchar("email"),

  // Contract Information
  monthlyContract: decimal("monthly_contract", { precision: 10, scale: 2 }),
  contractStart: timestamp("contract_start"),
  contractEnd: timestamp("contract_end"),

  // Performance
  rating: decimal("rating", { precision: 3, scale: 2 }),
  status: varchar("status").default("active"), // active, inactive, pending
  services: text("services").array(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hoaVotes = pgTable("hoa_votes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  hoaId: varchar("hoa_id")
    .notNull()
    .references(() => homeownerAssociations.id, { onDelete: "cascade" }),

  // Vote Details
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  voteType: varchar("vote_type").notNull(), // capital_improvement, rule_change, board_election, etc.
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),

  // Voting Period
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),

  // Quorum and Results
  requiredQuorum: integer("required_quorum").notNull(),
  currentVotes: integer("current_votes").default(0),
  votesFor: integer("votes_for").default(0),
  votesAgainst: integer("votes_against").default(0),
  votesAbstain: integer("votes_abstain").default(0),

  // Additional Info
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  status: varchar("status").default("active"), // active, passed, failed, cancelled

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hoaVoteResponses = pgTable(
  "hoa_vote_responses",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    voteId: varchar("vote_id")
      .notNull()
      .references(() => hoaVotes.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    decision: varchar("decision").notNull(), // for, against, abstain
    submittedAt: timestamp("submitted_at").defaultNow(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_hoa_vote_responses_vote").on(table.voteId),
    index("idx_hoa_vote_responses_user").on(table.userId),
  ]
);

// Structured metadata for board role transfer votes.
// Keeps transfer targets deterministic without overloading vote description text.
export const hoaVoteBoardTransfers = pgTable(
  "hoa_vote_board_transfers",
  {
    voteId: varchar("vote_id")
      .primaryKey()
      .references(() => hoaVotes.id, { onDelete: "cascade" }),
    hoaId: varchar("hoa_id")
      .notNull()
      .references(() => homeownerAssociations.id, { onDelete: "cascade" }),
    targetRole: varchar("target_role").notNull(),
    nomineeUserId: varchar("nominee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    initiatedByUserId: varchar("initiated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    initiationReason: text("initiation_reason").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_hoa_vote_board_transfers_hoa").on(table.hoaId),
    index("idx_hoa_vote_board_transfers_role").on(table.targetRole),
    index("idx_hoa_vote_board_transfers_nominee").on(table.nomineeUserId),
    index("idx_hoa_vote_board_transfers_initiator").on(table.initiatedByUserId),
    index("idx_hoa_vote_board_transfers_created_at").on(table.createdAt),
  ]
);

export const hoaServiceRequests = pgTable("hoa_service_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  hoaId: varchar("hoa_id")
    .notNull()
    .references(() => homeownerAssociations.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id")
    .notNull()
    .references(() => hoaVendors.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Request Details
  serviceType: varchar("service_type").notNull(),
  description: text("description").notNull(),
  urgency: varchar("urgency").default("normal"), // low, normal, high, emergency
  contactPreference: varchar("contact_preference").default("email"), // email, phone, both

  // Status Tracking
  status: varchar("status").default("submitted"), // submitted, assigned, in_progress, completed, cancelled
  assignedTo: varchar("assigned_to"),
  completedAt: timestamp("completed_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hoaDocuments = pgTable("hoa_documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  hoaId: varchar("hoa_id")
    .notNull()
    .references(() => homeownerAssociations.id, { onDelete: "cascade" }),

  name: varchar("name").notNull(),
  documentType: varchar("document_type").notNull(), // governing, financial, minutes, notice, other
  fileUrl: varchar("file_url").notNull(),
  fileSize: integer("file_size"), // in bytes
  uploadedBy: varchar("uploaded_by")
    .notNull()
    .references(() => users.id),

  isPublic: boolean("is_public").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
});

// HOA Membership and Roles
export const hoaMembers = pgTable(
  "hoa_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hoaId: varchar("hoa_id")
      .notNull()
      .references(() => homeownerAssociations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Membership Details
    unitNumber: varchar("unit_number"),
    role: varchar("role").notNull().default("member"), // member, board_member, president, vice_president, treasurer, secretary
    joinedAt: timestamp("joined_at").defaultNow(),
    termStart: timestamp("term_start"), // For board members
    termEnd: timestamp("term_end"), // For board members

    // Contact & Status
    isPrimary: boolean("is_primary").default(true), // Primary owner of unit
    votingRights: boolean("voting_rights").default(true),
    inGoodStanding: boolean("in_good_standing").default(true),

    // Permissions
    canViewFinances: boolean("can_view_finances").default(false),
    canEditDocuments: boolean("can_edit_documents").default(false),
    canManageVendors: boolean("can_manage_vendors").default(false),
    canCreateVotes: boolean("can_create_votes").default(false),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_hoa_members_hoa").on(table.hoaId),
    index("idx_hoa_members_user").on(table.userId),
    index("idx_hoa_members_role").on(table.role),
  ]
);

// HOA membership departures (self-service leave reasons)
export const hoaMembershipDepartures = pgTable(
  "hoa_membership_departures",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hoaId: varchar("hoa_id")
      .notNull()
      .references(() => homeownerAssociations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: varchar("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipRole: varchar("membership_role"),
    reason: text("reason").notNull(),
    leftAt: timestamp("left_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_hoa_membership_departures_hoa").on(table.hoaId),
    index("idx_hoa_membership_departures_user").on(table.userId),
    index("idx_hoa_membership_departures_actor").on(table.actorUserId),
    index("idx_hoa_membership_departures_left_at").on(table.leftAt),
  ]
);

// HOA Governance Configuration
// Allows each HOA to define its own governance model, roles, and feature toggles
export const hoaGovernance = pgTable("hoa_governance", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  hoaId: varchar("hoa_id")
    .notNull()
    .references(() => homeownerAssociations.id, { onDelete: "cascade" })
    .unique(),

  // Governance Model
  governanceModel: varchar("governance_model").notNull().default("elected_board"), // elected_board, management_company, hybrid, informal

  // Feature Toggles
  votingEnabled: boolean("voting_enabled").default(true),
  financialsEnabled: boolean("financials_enabled").default(true),
  vendorManagementEnabled: boolean("vendor_management_enabled").default(true),
  documentLibraryEnabled: boolean("document_library_enabled").default(true),
  residentsDirectoryEnabled: boolean("residents_directory_enabled").default(true),
  maintenanceRequestsEnabled: boolean("maintenance_requests_enabled").default(true),

  // Custom Roles Definition (JSON)
  // Each HOA can define custom role names and their default permissions
  customRoles: jsonb("custom_roles").$type<{
    [roleSlug: string]: {
      displayName: string;
      defaultPermissions: {
        canViewFinances: boolean;
        canEditDocuments: boolean;
        canManageVendors: boolean;
        canCreateVotes: boolean;
      };
    };
  }>(),

  // Voting Rules
  quorumPercentage: integer("quorum_percentage").default(50), // Percentage of members required for quorum
  votePassThreshold: integer("vote_pass_threshold").default(51), // Percentage required to pass
  allowProxyVoting: boolean("allow_proxy_voting").default(false),

  // Governance Notes
  governanceNotes: text("governance_notes"), // Free-form HOA-specific rules

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for social features
export const communityPostsRelations = relations(communityPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [communityPosts.authorId],
    references: [users.id],
  }),
  likes: many(postLikes),
  comments: many(postComments),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(communityPosts, {
    fields: [postLikes.postId],
    references: [communityPosts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(postComments, {
    fields: [commentLikes.commentId],
    references: [postComments.id],
  }),
  user: one(users, {
    fields: [commentLikes.userId],
    references: [users.id],
  }),
}));

export const communityGroupsRelations = relations(communityGroups, ({ one, many }) => ({
  creator: one(users, {
    fields: [communityGroups.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  countyLinks: many(groupCountyLinks),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(communityGroups, {
    fields: [groupMembers.groupId],
    references: [communityGroups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const groupCountyLinksRelations = relations(groupCountyLinks, ({ one }) => ({
  group: one(communityGroups, {
    fields: [groupCountyLinks.groupId],
    references: [communityGroups.id],
  }),
  addedByUser: one(users, {
    fields: [groupCountyLinks.addedBy],
    references: [users.id],
  }),
}));

export const regionsRelations = relations(regions, ({ one }) => ({
  creator: one(users, {
    fields: [regions.createdBy],
    references: [users.id],
  }),
}));

// Relations for marketplace
export const marketplaceCategoriesRelations = relations(marketplaceCategories, ({ one, many }) => ({
  parentCategory: one(marketplaceCategories, {
    fields: [marketplaceCategories.parentCategoryId],
    references: [marketplaceCategories.id],
  }),
  subcategories: many(marketplaceCategories),
  listings: many(marketplaceListings),
}));

export const marketplaceListingsRelations = relations(marketplaceListings, ({ one, many }) => ({
  seller: one(users, {
    fields: [marketplaceListings.sellerId],
    references: [users.id],
  }),
  category: one(marketplaceCategories, {
    fields: [marketplaceListings.categoryId],
    references: [marketplaceCategories.id],
  }),
  inquiries: many(marketplaceInquiries),
  favorites: many(marketplaceFavorites),
  reports: many(marketplaceReports),
}));

export const marketplaceInquiriesRelations = relations(marketplaceInquiries, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [marketplaceInquiries.listingId],
    references: [marketplaceListings.id],
  }),
  buyer: one(users, {
    fields: [marketplaceInquiries.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [marketplaceInquiries.sellerId],
    references: [users.id],
  }),
}));

export const marketplaceFavoritesRelations = relations(marketplaceFavorites, ({ one }) => ({
  user: one(users, {
    fields: [marketplaceFavorites.userId],
    references: [users.id],
  }),
  listing: one(marketplaceListings, {
    fields: [marketplaceFavorites.listingId],
    references: [marketplaceListings.id],
  }),
}));

export const marketplaceReportsRelations = relations(marketplaceReports, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [marketplaceReports.listingId],
    references: [marketplaceListings.id],
  }),
  reporter: one(users, {
    fields: [marketplaceReports.reporterId],
    references: [users.id],
  }),
}));

// Realtor and car salesman relations
export const realtorProfilesRelations = relations(realtorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [realtorProfiles.userId],
    references: [users.id],
  }),
}));

export const carSalesmanProfilesRelations = relations(carSalesmanProfiles, ({ one }) => ({
  user: one(users, {
    fields: [carSalesmanProfiles.userId],
    references: [users.id],
  }),
}));

// Marketplace schemas for validation
export const insertMarketplaceCategorySchema = createInsertSchema(marketplaceCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({
  id: true,
  viewCount: true,
  favoriteCount: true,
  contactCount: true,
  createdAt: true,
  updatedAt: true,
  slug: true,
});

export const insertMarketplaceInquirySchema = createInsertSchema(marketplaceInquiries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  sellerResponse: true,
  respondedAt: true,
});

export const insertMarketplaceFavoriteSchema = createInsertSchema(marketplaceFavorites).omit({
  id: true,
  createdAt: true,
});

export const insertMarketplaceReportSchema = createInsertSchema(marketplaceReports).omit({
  id: true,
  createdAt: true,
  status: true,
  adminNotes: true,
  resolvedBy: true,
  resolvedAt: true,
});

// Marketplace types
export type MarketplaceCategory = typeof marketplaceCategories.$inferSelect;
export type InsertMarketplaceCategory = z.infer<typeof insertMarketplaceCategorySchema>;

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;

export type MarketplaceInquiry = typeof marketplaceInquiries.$inferSelect;
export type InsertMarketplaceInquiry = z.infer<typeof insertMarketplaceInquirySchema>;

export type MarketplaceFavorite = typeof marketplaceFavorites.$inferSelect;
export type InsertMarketplaceFavorite = z.infer<typeof insertMarketplaceFavoriteSchema>;

export type MarketplaceReport = typeof marketplaceReports.$inferSelect;
export type InsertMarketplaceReport = z.infer<typeof insertMarketplaceReportSchema>;

// Professional profile schemas
const professionalCredentialSchema = z.string().trim().min(1).max(200);
const professionalDocumentReferenceSchema = z.string().trim().min(1).max(2_048);
const professionalLabelSchema = z.string().trim().min(1).max(120);
const professionalLabelArraySchema = z.array(professionalLabelSchema).min(1).max(32);
const optionalProfessionalReferenceSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || undefined);
const professionalServiceAreasSchema = z
  .object({
    counties: z.array(professionalLabelSchema).min(1).max(64),
    cities: z.array(professionalLabelSchema).max(128).default([]),
    zipCodes: z
      .array(
        z
          .string()
          .trim()
          .regex(/^\d{5}(?:-\d{4})?$/)
          .max(10)
      )
      .max(128)
      .default([]),
  })
  .strict();

const realtorVerificationDocumentsSchema = z
  .object({
    licenseDocument: professionalDocumentReferenceSchema.optional(),
    brokerageAffiliation: professionalDocumentReferenceSchema.optional(),
    mlsCertificate: professionalDocumentReferenceSchema.optional(),
    additionalCertifications: z.array(professionalDocumentReferenceSchema).max(16).optional(),
  })
  .strict();

const carSalesmanVerificationDocumentsSchema = z
  .object({
    dealerLicense: professionalDocumentReferenceSchema.optional(),
    salesmanLicense: professionalDocumentReferenceSchema.optional(),
    dealershipAffiliation: professionalDocumentReferenceSchema.optional(),
    additionalCertifications: z.array(professionalDocumentReferenceSchema).max(16).optional(),
  })
  .strict();

export const insertRealtorProfileSchema = z
  .object({
    licenseNumber: professionalCredentialSchema,
    brokerageName: professionalCredentialSchema,
    mlsId: optionalProfessionalReferenceSchema,
    specializations: professionalLabelArraySchema,
    yearsExperience: z.number().int().min(0).max(100),
    serviceAreas: professionalServiceAreasSchema,
    licenseState: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase()),
    licenseExpiration: z.date(),
    verificationDocuments: realtorVerificationDocumentsSchema.optional(),
  })
  .strict();

export const insertCarSalesmanProfileSchema = z
  .object({
    dealershipName: professionalCredentialSchema,
    dealerLicense: professionalCredentialSchema,
    salesmanLicense: optionalProfessionalReferenceSchema,
    specializations: professionalLabelArraySchema,
    brandsSpecialty: professionalLabelArraySchema,
    yearsExperience: z.number().int().min(0).max(100),
    serviceAreas: professionalServiceAreasSchema,
    licenseState: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase()),
    licenseExpiration: z.date(),
    verificationDocuments: carSalesmanVerificationDocumentsSchema.optional(),
  })
  .strict();

// Professional profile types
export type RealtorProfile = typeof realtorProfiles.$inferSelect;
export type RealtorProfileApplication = z.infer<typeof insertRealtorProfileSchema>;
export type InsertRealtorProfile = RealtorProfileApplication & { userId: string };

export type CarSalesmanProfile = typeof carSalesmanProfiles.$inferSelect;
export type CarSalesmanProfileApplication = z.infer<typeof insertCarSalesmanProfileSchema>;
export type InsertCarSalesmanProfile = CarSalesmanProfileApplication & { userId: string };

// Verification schemas
export const insertVendorVerificationSchema = createInsertSchema(vendorVerifications).omit({
  id: true,
  identityVerified: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  adminNotes: true,
  approvedUntil: true,
  requiresRenewal: true,
  renewalReminderSent: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBuyerVerificationSchema = createInsertSchema(buyerVerifications).omit({
  id: true,
  identityVerified: true,
  isOver18: true,
  isOver21: true,
  addressVerified: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
});

export type VendorVerification = typeof vendorVerifications.$inferSelect;
export type InsertVendorVerification = z.infer<typeof insertVendorVerificationSchema>;

export type BuyerVerification = typeof buyerVerifications.$inferSelect;
export type InsertBuyerVerification = z.infer<typeof insertBuyerVerificationSchema>;

// Address verification schema
export const insertAddressVerificationSchema = createInsertSchema(addressVerifications).omit({
  id: true,
  postcardCode: true,
  postcardSentAt: true,
  postcardVerifiedAt: true,
  phoneVerificationCode: true,
  phoneVerifiedAt: true,
  status: true,
  submittedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  approvedAt: true,
  rejectionReason: true,
  adminNotes: true,
  remindersSent: true,
  lastReminderSent: true,
  addressValidated: true,
  addressValidationProvider: true,
  addressValidationResponse: true,
  createdAt: true,
  updatedAt: true,
});

export type AddressVerification = typeof addressVerifications.$inferSelect;
export type InsertAddressVerification = z.infer<typeof insertAddressVerificationSchema>;
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type InsertIdentityVerification = typeof identityVerifications.$inferInsert;

// Handmade Products Marketplace Tables
export const handmadeCategories = pgTable("handmade_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  iconName: varchar("icon_name"), // Lucide icon name
  parentId: varchar("parent_id"), // For subcategories
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const handmadeProducts = pgTable("handmade_products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),

  // Product details
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  categoryId: varchar("category_id")
    .notNull()
    .references(() => handmadeCategories.id),
  tags: jsonb("tags").$type<string[]>(),

  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }), // Original price for discounts
  currency: varchar("currency", { length: 3 }).default("USD"),

  // Product details
  materials: jsonb("materials").$type<string[]>(), // Wood, fabric, metal, etc.
  dimensions: jsonb("dimensions").$type<{
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
    unit?: string;
  }>(),
  colors: jsonb("colors").$type<string[]>(),
  customizable: boolean("customizable").default(false),
  customizationOptions: text("customization_options"),

  // Inventory
  inStock: boolean("in_stock").default(true),
  quantityAvailable: integer("quantity_available").default(1),
  madeToOrder: boolean("made_to_order").default(false),
  processingTime: varchar("processing_time"), // "1-2 weeks", "3-5 business days"

  // Images
  primaryImageUrl: varchar("primary_image_url"),
  images: jsonb("images").$type<string[]>(),

  // Location
  city: varchar("city"),
  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips"),
  shippingFrom: varchar("shipping_from"),

  // Shipping
  freeShipping: boolean("free_shipping").default(false),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  localPickupAvailable: boolean("local_pickup_available").default(false),
  shipsNationwide: boolean("ships_nationwide").default(true),
  shippingRegions: jsonb("shipping_regions").$type<string[]>(), // States/regions they ship to

  // Status and metrics
  status: varchar("status", {
    enum: ["draft", "active", "paused", "sold", "archived"],
  }).default("draft"),
  featured: boolean("featured").default(false),
  viewCount: integer("view_count").default(0),
  favoriteCount: integer("favorite_count").default(0),

  // SEO
  seoTitle: varchar("seo_title"),
  seoDescription: text("seo_description"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productFavorites = pgTable("product_favorites", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  productId: varchar("product_id")
    .notNull()
    .references(() => handmadeProducts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productOrders = pgTable("product_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),
  productId: varchar("product_id")
    .notNull()
    .references(() => handmadeProducts.id),

  // Order details
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  finalTotal: decimal("final_total", { precision: 10, scale: 2 }).notNull(),

  // Customization
  customizationRequest: text("customization_request"),
  customizationNotes: text("customization_notes"),

  // Status tracking
  status: varchar("status", {
    enum: [
      "pending",
      "confirmed",
      "in_progress",
      "ready_to_ship",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "refunded",
    ],
  }).default("pending"),

  // Shipping
  shippingMethod: varchar("shipping_method"),
  trackingNumber: varchar("tracking_number"),
  shippingAddress: jsonb("shipping_address").$type<{
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone?: string;
  }>(),

  // Timeline
  confirmedAt: timestamp("confirmed_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),

  // Payment
  paymentIntentId: varchar("payment_intent_id"),
  paymentStatus: varchar("payment_status", {
    enum: ["pending", "paid", "failed", "refunded"],
  }).default("pending"),

  // Communication
  buyerNotes: text("buyer_notes"),
  sellerNotes: text("seller_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productReviews = pgTable("product_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id")
    .notNull()
    .references(() => handmadeProducts.id),
  orderId: varchar("order_id")
    .notNull()
    .references(() => productOrders.id),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),

  // Review content
  rating: integer("rating").notNull(), // 1-5 stars
  title: varchar("title"),
  reviewText: text("review_text"),
  images: jsonb("images").$type<string[]>(),

  // Detailed ratings
  qualityRating: integer("quality_rating"), // 1-5
  shippingRating: integer("shipping_rating"), // 1-5
  serviceRating: integer("service_rating"), // 1-5

  // Review metadata
  isVerifiedPurchase: boolean("is_verified_purchase").default(true),
  isPublic: boolean("is_public").default(true),
  wouldRecommend: boolean("would_recommend"),

  // Admin moderation
  isModerated: boolean("is_moderated").default(false),
  moderationNotes: text("moderation_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sellerProfiles = pgTable("seller_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  // Business details
  businessName: varchar("business_name"),
  bio: text("bio"),
  specialty: varchar("specialty"), // Woodworking, jewelry, art, etc.
  yearsOfExperience: integer("years_of_experience"),

  // Contact & location
  website: varchar("website"),
  socialMediaLinks: jsonb("social_media_links").$type<{
    instagram?: string;
    facebook?: string;
    etsy?: string;
    website?: string;
  }>(),

  // Seller metrics (calculated)
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").default(0),
  totalSales: integer("total_sales").default(0),

  // Seller settings
  acceptsCustomOrders: boolean("accepts_custom_orders").default(true),
  minimumOrderAmount: decimal("minimum_order_amount", { precision: 10, scale: 2 }),
  returnsPolicy: text("returns_policy"),
  processingTime: varchar("processing_time").default("1-2 weeks"),

  // Verification
  isVerified: boolean("is_verified").default(false),
  verificationBadges: jsonb("verification_badges").$type<string[]>(), // handmade, eco-friendly, local

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for handmade marketplace
export const handmadeCategoriesRelations = relations(handmadeCategories, ({ one, many }) => ({
  parent: one(handmadeCategories, {
    fields: [handmadeCategories.parentId],
    references: [handmadeCategories.id],
  }),
  children: many(handmadeCategories),
  products: many(handmadeProducts),
}));

export const handmadeProductsRelations = relations(handmadeProducts, ({ one, many }) => ({
  seller: one(users, {
    fields: [handmadeProducts.sellerId],
    references: [users.id],
  }),
  category: one(handmadeCategories, {
    fields: [handmadeProducts.categoryId],
    references: [handmadeCategories.id],
  }),
  favorites: many(productFavorites),
  orders: many(productOrders),
  reviews: many(productReviews),
}));

export const productOrdersRelations = relations(productOrders, ({ one }) => ({
  buyer: one(users, {
    fields: [productOrders.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [productOrders.sellerId],
    references: [users.id],
  }),
  product: one(handmadeProducts, {
    fields: [productOrders.productId],
    references: [handmadeProducts.id],
  }),
  review: one(productReviews),
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  product: one(handmadeProducts, {
    fields: [productReviews.productId],
    references: [handmadeProducts.id],
  }),
  order: one(productOrders, {
    fields: [productReviews.orderId],
    references: [productOrders.id],
  }),
  buyer: one(users, {
    fields: [productReviews.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [productReviews.sellerId],
    references: [users.id],
  }),
}));

export const sellerProfilesRelations = relations(sellerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [sellerProfiles.userId],
    references: [users.id],
  }),
}));

// Types for handmade marketplace
export type HandmadeCategory = typeof handmadeCategories.$inferSelect;
export type InsertHandmadeCategory = typeof handmadeCategories.$inferInsert;

export type HandmadeProduct = typeof handmadeProducts.$inferSelect;
export type InsertHandmadeProduct = typeof handmadeProducts.$inferInsert;

export type ProductFavorite = typeof productFavorites.$inferSelect;
export type InsertProductFavorite = typeof productFavorites.$inferInsert;

export type ProductOrder = typeof productOrders.$inferSelect;
export type InsertProductOrder = typeof productOrders.$inferInsert;

export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = typeof productReviews.$inferInsert;

export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type InsertSellerProfile = typeof sellerProfiles.$inferInsert;

// Zod schemas for handmade marketplace
export const insertHandmadeCategorySchema = createInsertSchema(handmadeCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHandmadeProductSchema = createInsertSchema(handmadeProducts).omit({
  id: true,
  viewCount: true,
  favoriteCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductFavoriteSchema = createInsertSchema(productFavorites).omit({
  id: true,
  createdAt: true,
});

export const insertProductOrderSchema = createInsertSchema(productOrders).omit({
  id: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  isVerifiedPurchase: true,
  isModerated: true,
  moderationNotes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSellerProfileSchema = createInsertSchema(sellerProfiles).omit({
  id: true,
  averageRating: true,
  totalReviews: true,
  totalSales: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHandmadeCategoryType = z.infer<typeof insertHandmadeCategorySchema>;
export type InsertHandmadeProductType = z.infer<typeof insertHandmadeProductSchema>;
export type InsertProductFavoriteType = z.infer<typeof insertProductFavoriteSchema>;
export type InsertProductOrderType = z.infer<typeof insertProductOrderSchema>;
export type InsertProductReviewType = z.infer<typeof insertProductReviewSchema>;
export type InsertSellerProfileType = z.infer<typeof insertSellerProfileSchema>;

// CRM System Tables
export const crmContactStatusEnum = pgEnum("crm_contact_status", [
  "new",
  "contacted",
  "qualified",
  "opportunity",
  "customer",
  "inactive",
  "churned",
]);

export const crmLeadSourceEnum = pgEnum("crm_lead_source", [
  "website",
  "direct_message",
  "email",
  "phone",
  "referral",
  "social_media",
  "advertising",
  "event",
  "other",
]);

export const crmActivityTypeEnum = pgEnum("crm_activity_type", [
  "email",
  "call",
  "meeting",
  "note",
  "task",
  "demo",
  "proposal",
  "follow_up",
  "internal_message",
]);

export const crmDealStageEnum = pgEnum("crm_deal_stage", [
  "prospecting",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

// County vault ledger sources (transparent breakdown of inflows/outflows)
export const vaultSourceEnum = pgEnum("vault_source_type", [
  "foundation_donation",
  "marketplace_fee_share",
  "contractor_fee_share",
  "subscription_share",
  "sponsorship",
  "corporate_match",
  "manual_adjustment",
  "other",
]);

// County community vaults (aggregate balances per county)
export const countyVaults = pgTable(
  "county_vaults",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    countyId: varchar("county_id")
      .notNull()
      .references(() => counties.id),
    currentBalance: decimal("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    lifetimeInflow: decimal("lifetime_inflow", { precision: 14, scale: 2 }).notNull().default("0"),
    lifetimeOutflow: decimal("lifetime_outflow", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lastContributionAt: timestamp("last_contribution_at"),
    lastUpdated: timestamp("last_updated").defaultNow(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("county_vaults_county_uidx").on(table.countyId),
    index("county_vaults_county_idx").on(table.countyId),
  ]
);

// Immutable ledger of vault movements
export const vaultLedgerEntries = pgTable(
  "vault_ledger_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vaultId: varchar("vault_id")
      .notNull()
      .references(() => countyVaults.id),
    sourceType: vaultSourceEnum("source_type").notNull(),
    sourceId: varchar("source_id"), // e.g. donation id, transaction id
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(), // positive for inflow, negative for outflow
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("vault_ledger_vault_idx").on(table.vaultId),
    index("vault_ledger_created_idx").on(table.createdAt),
  ]
);

// Admin-controlled, user-scoped vault contribution adjustments
// Used to represent off-platform or manually verified contributions.
export const userCountyVaultContributionAdjustments = pgTable(
  "user_county_vault_contribution_adjustments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    countyId: varchar("county_id").references(() => counties.id, { onDelete: "set null" }),
    directAmount: decimal("direct_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    networkAmount: decimal("network_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    note: text("note"),
    source: varchar("source").notNull().default("manual_adjustment"),
    createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("user_county_vault_adj_user_idx").on(table.userId),
    index("user_county_vault_adj_county_idx").on(table.countyId),
    index("user_county_vault_adj_created_idx").on(table.createdAt),
  ]
);

// ==================== COMMUNITY PROFILE VAULT (MVP) ====================

export const communityVaultSourceEnum = pgEnum("community_vault_source_type", [
  "platform_support_share",
  "direct_donation",
  "manual_adjustment",
  "other",
]);

// Community vaults (aggregate balances per community Profile)
export const communityVaults = pgTable(
  "community_vaults",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    profileId: varchar("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    currentBalance: decimal("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    lifetimeInflow: decimal("lifetime_inflow", { precision: 14, scale: 2 }).notNull().default("0"),
    lifetimeOutflow: decimal("lifetime_outflow", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lastContributionAt: timestamp("last_contribution_at"),
    lastUpdated: timestamp("last_updated").defaultNow(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("community_vaults_profile_uidx").on(table.profileId),
    index("community_vaults_profile_idx").on(table.profileId),
  ]
);

// Immutable ledger of community vault movements
export const communityVaultLedgerEntries = pgTable(
  "community_vault_ledger_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vaultId: varchar("vault_id")
      .notNull()
      .references(() => communityVaults.id, { onDelete: "cascade" }),
    externalKey: varchar("external_key").unique(),
    sourceType: communityVaultSourceEnum("source_type").notNull(),
    sourceId: varchar("source_id"), // e.g. stripe invoice id, checkout session id
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(), // positive for inflow, negative for outflow
    memo: text("memo"),
    causeId: varchar("cause_id"), // optional tag for cause intent (no payouts)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("community_vault_ledger_vault_idx").on(table.vaultId),
    index("community_vault_ledger_created_idx").on(table.createdAt),
  ]
);

// ==================== COMMUNITY CAUSES + VOTING INTENT (MVP) ====================

export const communityCauseStatusEnum = pgEnum("community_cause_status", ["open", "closed"]);

export const communityCauses = pgTable(
  "community_causes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    profileId: varchar("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: varchar("title").notNull(),
    description: text("description"),
    status: communityCauseStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("community_causes_profile_idx").on(table.profileId),
    index("community_causes_status_idx").on(table.status),
  ]
);

export const communityCauseVotes = pgTable(
  "community_cause_votes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    causeId: varchar("cause_id")
      .notNull()
      .references(() => communityCauses.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("community_cause_votes_unique").on(table.causeId, table.userId),
    index("community_cause_votes_cause_idx").on(table.causeId),
    index("community_cause_votes_user_idx").on(table.userId),
  ]
);

// ==================== PLATFORM SUPPORT LEDGER (MVP) ====================

export const platformSupportAllocationEnum = pgEnum("platform_support_allocation", [
  "platform",
  "community",
]);

export const platformSupportModeEnum = pgEnum("platform_support_mode", [
  "one_time",
  "subscription",
]);

// Ledger of platform support payments.
// For community-context support, each payment creates TWO rows: one for platform and one for community.
export const platformSupportLedgerEntries = pgTable(
  "platform_support_ledger_entries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    externalKey: varchar("external_key").notNull().unique(),
    allocation: platformSupportAllocationEnum("allocation").notNull(),
    originatingProfileId: varchar("originating_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    mode: platformSupportModeEnum("mode").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency").notNull().default("USD"),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id"),
    stripeInvoiceId: varchar("stripe_invoice_id"),
    stripeSubscriptionId: varchar("stripe_subscription_id"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    stripeChargeId: varchar("stripe_charge_id"),
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("platform_support_origin_profile_idx").on(table.originatingProfileId),
    index("platform_support_stripe_invoice_idx").on(table.stripeInvoiceId),
    index("platform_support_created_idx").on(table.createdAt),
  ]
);

// TradeDeals: off-site partner offers that pay TradeScout recurring affiliate revenue
export const tradeDeals = pgTable(
  "trade_deals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: varchar("slug", { length: 120 }).unique(),
    name: varchar("name", { length: 255 }).notNull(),
    partnerName: varchar("partner_name", { length: 255 }).notNull(),
    description: text("description"),
    landingUrl: varchar("landing_url", { length: 1024 }).notNull(),
    defaultCommissionRate: decimal("default_commission_rate", { precision: 5, scale: 4 }),
    isRecurring: boolean("is_recurring").default(true),
    isActive: boolean("is_active").default(true),
    category: varchar("category", { length: 100 }),
    createdBy: varchar("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("trade_deals_slug_idx").on(table.slug),
    index("trade_deals_active_idx").on(table.isActive),
  ]
);

// When a user (optionally via an affiliate account) lands on a TradeDeal offer link
export const tradeDealClicks = pgTable(
  "trade_deal_clicks",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tradeDealId: varchar("trade_deal_id")
      .notNull()
      .references(() => tradeDeals.id),
    userId: varchar("user_id").references(() => users.id),
    affiliateAccountId: varchar("affiliate_account_id").references(() => affiliateAccounts.id),
    source: varchar("source", { length: 100 }),
    landingPath: varchar("landing_path", { length: 1024 }),
    externalTrackingId: varchar("external_tracking_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("trade_deal_clicks_deal_idx").on(table.tradeDealId),
    index("trade_deal_clicks_user_idx").on(table.userId),
    index("trade_deal_clicks_affiliate_idx").on(table.affiliateAccountId),
  ]
);

// Earnings that TradeScout attributes to specific users/affiliates from TradeDeals
export const tradeDealEarnings = pgTable(
  "trade_deal_earnings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tradeDealId: varchar("trade_deal_id")
      .notNull()
      .references(() => tradeDeals.id),
    // Either an affiliate account or a direct user can receive the earning
    affiliateAccountId: varchar("affiliate_account_id").references(() => affiliateAccounts.id),
    userId: varchar("user_id").references(() => users.id),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    periodLabel: varchar("period_label", { length: 32 }),
    sourceType: varchar("source_type", { length: 50 }).default("partner_report"),
    externalReference: varchar("external_reference", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("trade_deal_earnings_deal_idx").on(table.tradeDealId),
    index("trade_deal_earnings_affiliate_idx").on(table.affiliateAccountId),
    index("trade_deal_earnings_user_idx").on(table.userId),
    index("trade_deal_earnings_period_idx").on(table.periodLabel),
  ]
);

// Points system for non-monetary rewards (future TradeCoin dividends)
export const userPointsTypeEnum = pgEnum("user_points_type", [
  "site_interaction",
  "affiliate_signup",
  "social_impact",
  "trade_deal_referral",
  "admin_adjustment",
]);

export const userPointsLedger = pgTable(
  "user_points_ledger",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    points: integer("points").notNull(),
    type: userPointsTypeEnum("type").notNull(),
    reason: varchar("reason", { length: 255 }),
    sourceId: varchar("source_id", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("user_points_user_idx").on(table.userId),
    index("user_points_type_idx").on(table.type),
  ]
);

// User wallet accounts for spendable on-platform balance (funded by affiliate earnings etc.)
export const walletAccounts = pgTable(
  "wallet_accounts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    currentBalance: decimal("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 32 }).default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("wallet_accounts_user_idx").on(table.userId),
    uniqueIndex("wallet_accounts_user_unique").on(table.userId),
  ]
);

export const walletTransactionTypeEnum = pgEnum("wallet_tx_type", [
  "affiliate_commission",
  "marketplace_purchase",
  "marketplace_sale",
  "p2p_send",
  "p2p_receive",
  "admin_adjustment",
  "withdrawal",
  "deposit",
]);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    walletAccountId: varchar("wallet_account_id")
      .notNull()
      .references(() => walletAccounts.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    counterpartyUserId: varchar("counterparty_user_id").references(() => users.id),
    transactionType: walletTransactionTypeEnum("transaction_type").notNull(),
    direction: varchar("direction", { length: 10 }).notNull(), // 'credit' or 'debit'
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: varchar("reference_id", { length: 255 }),
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("wallet_tx_wallet_idx").on(table.walletAccountId),
    index("wallet_tx_user_idx").on(table.userId),
    index("wallet_tx_counterparty_idx").on(table.counterpartyUserId),
    index("wallet_tx_type_idx").on(table.transactionType),
  ]
);

export const crmPriorityEnum = pgEnum("crm_priority", ["low", "medium", "high", "urgent"]);

// CRM Contacts table
export const crmContacts = pgTable("crm_contacts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique(),
  phone: varchar("phone"),
  company: varchar("company"),
  jobTitle: varchar("job_title"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  country: varchar("country").default("US"),

  // CRM specific fields
  status: crmContactStatusEnum("status").default("new").notNull(),
  leadSource: crmLeadSourceEnum("lead_source").default("website").notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),

  // Linked to existing user if they are a platform user
  linkedUserId: varchar("linked_user_id").references(() => users.id),

  // Social and web presence
  website: varchar("website"),
  linkedinUrl: varchar("linkedin_url"),
  notes: text("notes"),
  tags: text("tags").array(),

  // Tracking
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Deals/Opportunities table
export const crmDeals = pgTable("crm_deals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  contactId: varchar("contact_id")
    .references(() => crmContacts.id)
    .notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),

  value: decimal("value", { precision: 10, scale: 2 }),
  currency: varchar("currency").default("USD"),
  stage: crmDealStageEnum("stage").default("prospecting").notNull(),
  priority: crmPriorityEnum("priority").default("medium"),

  probability: integer("probability").default(0), // 0-100%
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),

  // Project details
  projectType: varchar("project_type"),
  tradeCategory: tradeCategoryEnum("trade_category"),

  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Activities table (emails, calls, meetings, notes)
export const crmActivities = pgTable("crm_activities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: crmActivityTypeEnum("type").notNull(),
  subject: varchar("subject").notNull(),
  description: text("description"),

  // Relationships
  contactId: varchar("contact_id").references(() => crmContacts.id),
  dealId: varchar("deal_id").references(() => crmDeals.id),
  createdByUserId: varchar("created_by_user_id")
    .references(() => users.id)
    .notNull(),

  // Email specific fields
  fromEmail: varchar("from_email"),
  toEmail: varchar("to_email"),
  ccEmails: text("cc_emails").array(),
  bccEmails: text("bcc_emails").array(),
  emailThreadId: varchar("email_thread_id"),

  // Meeting/Call specific fields
  duration: integer("duration"), // in minutes
  attendees: text("attendees").array(),

  // Task specific fields
  dueDate: timestamp("due_date"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),

  // Internal message specific fields
  isInternal: boolean("is_internal").default(false),
  internalRecipients: text("internal_recipients").array(),

  // File attachments
  attachments: jsonb("attachments"), // Array of file URLs and metadata

  // Tracking
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Email Templates table
export const crmEmailTemplates = pgTable("crm_email_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  subject: varchar("subject").notNull(),
  body: text("body").notNull(),
  category: varchar("category"), // welcome, follow_up, proposal, etc.
  isActive: boolean("is_active").default(true),

  // Template variables for personalization
  variables: jsonb("variables"), // {firstName: "Contact's first name", company: "Contact's company"}

  createdByUserId: varchar("created_by_user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Pipeline Configuration table
export const crmPipelines = pgTable("crm_pipelines", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  stages: jsonb("stages").notNull(), // Array of stage objects with names, colors, and probabilities
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),

  createdByUserId: varchar("created_by_user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Relations
export const crmContactsRelations = relations(crmContacts, ({ one, many }) => ({
  assignedTo: one(users, {
    fields: [crmContacts.assignedToUserId],
    references: [users.id],
  }),
  linkedUser: one(users, {
    fields: [crmContacts.linkedUserId],
    references: [users.id],
  }),
  deals: many(crmDeals),
  activities: many(crmActivities),
}));

export const crmDealsRelations = relations(crmDeals, ({ one, many }) => ({
  contact: one(crmContacts, {
    fields: [crmDeals.contactId],
    references: [crmContacts.id],
  }),
  assignedTo: one(users, {
    fields: [crmDeals.assignedToUserId],
    references: [users.id],
  }),
  activities: many(crmActivities),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmActivities.contactId],
    references: [crmContacts.id],
  }),
  deal: one(crmDeals, {
    fields: [crmActivities.dealId],
    references: [crmDeals.id],
  }),
  createdBy: one(users, {
    fields: [crmActivities.createdByUserId],
    references: [users.id],
  }),
}));

export const crmEmailTemplatesRelations = relations(crmEmailTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [crmEmailTemplates.createdByUserId],
    references: [users.id],
  }),
}));

export const crmPipelinesRelations = relations(crmPipelines, ({ one }) => ({
  createdBy: one(users, {
    fields: [crmPipelines.createdByUserId],
    references: [users.id],
  }),
}));

// CRM Insert schemas
export const insertCrmContactSchema = createInsertSchema(crmContacts);
export const insertCrmDealSchema = createInsertSchema(crmDeals);
export const insertCrmActivitySchema = createInsertSchema(crmActivities);
export const insertCrmEmailTemplateSchema = createInsertSchema(crmEmailTemplates);
export const insertCrmPipelineSchema = createInsertSchema(crmPipelines);

// CRM Types
export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;
export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type InsertCrmEmailTemplate = z.infer<typeof insertCrmEmailTemplateSchema>;
export type CrmPipeline = typeof crmPipelines.$inferSelect;
export type InsertCrmPipeline = z.infer<typeof insertCrmPipelineSchema>;

// ===== COMMUNITY MODERATION SYSTEM =====

// Content types that can be reported
export const contentTypeEnum = pgEnum("content_type", [
  "marketplace_listing",
  "handmade_product",
  "community_post",
  "post_comment",
  "product_review",
  "user_profile",
  "seller_profile",
  "conversation_message",
]);

// Using the reportReasonEnum defined earlier in the file

// Vote types for community moderation
export const voteTypeEnum = pgEnum("vote_type", ["remove", "keep", "needs_review"]);

// Community moderation reports
export const moderationReports = pgTable("moderation_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").references(() => users.id),

  // Content being reported
  contentType: contentTypeEnum("content_type").notNull(),
  contentId: varchar("content_id").notNull(), // ID of the reported content
  contentOwnerId: varchar("content_owner_id").references(() => users.id),

  // Report details
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  additionalContext: jsonb("additional_context").$type<{
    screenshots?: string[];
    relatedUrls?: string[];
    previousReports?: string[];
  }>(),

  // Geographic context for local moderation
  reporterCounty: varchar("reporter_county"),
  reporterState: varchar("reporter_state"),
  contentCounty: varchar("content_county"),
  contentState: varchar("content_state"),

  // Status tracking
  status: varchar("status", {
    enum: ["pending", "under_review", "resolved", "dismissed", "escalated"],
  }).default("pending"),

  // Community voting results
  totalVotes: integer("total_votes").default(0),
  removeVotes: integer("remove_votes").default(0),
  keepVotes: integer("keep_votes").default(0),
  reviewVotes: integer("review_votes").default(0),

  // Voting thresholds (configurable per content type/region)
  votesRequired: integer("votes_required").default(5),
  removalThreshold: decimal("removal_threshold", { precision: 3, scale: 2 }).default("0.60"), // 60% to remove

  // Resolution
  finalAction: varchar("final_action", {
    enum: [
      "content_removed",
      "content_hidden",
      "content_flagged",
      "warning_issued",
      "no_action",
      "user_suspended",
    ],
  }),
  actionTakenBy: varchar("action_taken_by"), // 'community_vote', 'moderator', 'admin'
  actionReason: text("action_reason"),
  resolvedAt: timestamp("resolved_at"),

  // Moderator override
  moderatorId: varchar("moderator_id").references(() => users.id),
  moderatorNotes: text("moderator_notes"),
  isModeratorOverride: boolean("is_moderator_override").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// This duplicate moderationVotes table has been removed - using the one defined earlier in the file

// User voting eligibility and reputation
export const userModerationReputation = pgTable("user_moderation_reputation", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  // Voting eligibility
  canVote: boolean("can_vote").default(true),
  votingPower: decimal("voting_power", { precision: 3, scale: 2 }).default("1.0"),

  // Reputation metrics
  accurateVotes: integer("accurate_votes").default(0),
  totalVotes: integer("total_votes").default(0),
  accuracyRate: decimal("accuracy_rate", { precision: 3, scale: 2 }),

  // Geographic voting areas
  primaryCounty: varchar("primary_county"),
  primaryState: varchar("primary_state"),
  additionalCounties: jsonb("additional_counties").$type<string[]>(),

  // Suspension/penalties
  isSuspended: boolean("is_suspended").default(false),
  suspendedUntil: timestamp("suspended_until"),
  suspensionReason: text("suspension_reason"),

  // Activity tracking
  lastVoteAt: timestamp("last_vote_at"),
  joinedModerationAt: timestamp("joined_moderation_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content moderation actions taken
export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => moderationReports.id),

  // Content being acted upon
  contentType: contentTypeEnum("content_type").notNull(),
  contentId: varchar("content_id").notNull(),
  contentOwnerId: varchar("content_owner_id").references(() => users.id),

  // Action details
  action: varchar("action", {
    enum: ["removed", "hidden", "flagged", "warning", "no_action", "user_suspended", "user_banned"],
  }).notNull(),

  // Who took the action
  actionBy: varchar("action_by", {
    enum: ["community_vote", "moderator", "admin", "automated"],
  }).notNull(),
  actionUserId: varchar("action_user_id").references(() => users.id), // If taken by specific user

  // Action context
  reason: text("reason"),
  isReversible: boolean("is_reversible").default(true),
  expiresAt: timestamp("expires_at"), // For temporary actions

  // Appeal process
  canAppeal: boolean("can_appeal").default(true),
  appealDeadline: timestamp("appeal_deadline"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Trust Ledger v1: immutable trust-impacting event stream
export const trustLedgerEvents = pgTable(
  "trust_ledger_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    sourceSurface: varchar("source_surface", { length: 80 }).notNull(),
    verificationLevel: varchar("verification_level", { length: 40 }).notNull().default("none"),
    confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull().default("0.500"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_trust_ledger_entity").on(table.entityType, table.entityId),
    index("idx_trust_ledger_event").on(table.eventType, table.createdAt),
    index("idx_trust_ledger_actor").on(table.actorUserId, table.createdAt),
  ]
);

// Appeals against moderation actions
export const moderationAppeals = pgTable("moderation_appeals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  actionId: varchar("action_id")
    .notNull()
    .references(() => moderationActions.id),
  reportId: varchar("report_id").references(() => moderationReports.id),
  appellantId: varchar("appellant_id")
    .notNull()
    .references(() => users.id),

  // Appeal details
  reason: text("reason").notNull(),
  additionalEvidence: jsonb("additional_evidence").$type<{
    documents?: string[];
    screenshots?: string[];
    witnessStatements?: string[];
  }>(),

  // Status
  status: varchar("status", {
    enum: ["pending", "under_review", "approved", "denied", "escalated"],
  }).default("pending"),

  // Review
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  decision: varchar("decision", {
    enum: ["appeal_granted", "appeal_denied", "action_modified", "no_change"],
  }),
  newAction: varchar("new_action"),

  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Moderation settings per geographic region
export const moderationSettings = pgTable("moderation_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Geographic scope (null values allow global settings)
  county: varchar("county"),
  state: varchar("state"),
  isStatewide: boolean("is_statewide").default(false),

  // Voting thresholds
  minVotesRequired: integer("min_votes_required").default(5),
  removalThreshold: decimal("removal_threshold", { precision: 3, scale: 2 }).default("0.60"),
  localVoterWeight: decimal("local_voter_weight", { precision: 3, scale: 2 }).default("1.5"),

  // Content-specific settings
  contentTypeSettings: jsonb("content_type_settings").$type<{
    [contentType: string]: {
      minVotes?: number;
      threshold?: number;
      autoRemoveAfterVotes?: number;
      requiresHumanReview?: boolean;
    };
  }>(),

  // User eligibility
  minAccountAge: integer("min_account_age_days").default(30), // Days
  minLocalActivity: integer("min_local_activity_days").default(7), // Days active in area
  requiresAddressVerification: boolean("requires_address_verification").default(true),

  // Active/inactive
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for moderation system
export const moderationReportsRelations = relations(moderationReports, ({ one, many }) => ({
  reporter: one(users, {
    fields: [moderationReports.reporterId],
    references: [users.id],
  }),
  contentOwner: one(users, {
    fields: [moderationReports.contentOwnerId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [moderationReports.moderatorId],
    references: [users.id],
  }),
  votes: many(moderationVotes),
  actions: many(moderationActions),
}));

// Duplicate moderationVotesRelations removed - using the one defined earlier

export const userModerationReputationRelations = relations(userModerationReputation, ({ one }) => ({
  user: one(users, {
    fields: [userModerationReputation.userId],
    references: [users.id],
  }),
}));

export const moderationActionsRelations = relations(moderationActions, ({ one, many }) => ({
  report: one(moderationReports, {
    fields: [moderationActions.reportId],
    references: [moderationReports.id],
  }),
  contentOwner: one(users, {
    fields: [moderationActions.contentOwnerId],
    references: [users.id],
  }),
  actionUser: one(users, {
    fields: [moderationActions.actionUserId],
    references: [users.id],
  }),
  appeals: many(moderationAppeals),
}));

export const moderationAppealsRelations = relations(moderationAppeals, ({ one }) => ({
  action: one(moderationActions, {
    fields: [moderationAppeals.actionId],
    references: [moderationActions.id],
  }),
  report: one(moderationReports, {
    fields: [moderationAppeals.reportId],
    references: [moderationReports.id],
  }),
  appellant: one(users, {
    fields: [moderationAppeals.appellantId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [moderationAppeals.reviewedBy],
    references: [users.id],
  }),
}));

// Types for moderation system
export type ModerationReport = typeof moderationReports.$inferSelect;
export type InsertModerationReport = typeof moderationReports.$inferInsert;

export type UserModerationReputation = typeof userModerationReputation.$inferSelect;
export type InsertUserModerationReputation = typeof userModerationReputation.$inferInsert;

export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = typeof moderationActions.$inferInsert;

export type ModerationAppeal = typeof moderationAppeals.$inferSelect;
export type InsertModerationAppeal = typeof moderationAppeals.$inferInsert;

export type ModerationSettings = typeof moderationSettings.$inferSelect;
export type InsertModerationSettings = typeof moderationSettings.$inferInsert;

// Zod schemas for moderation system
export const insertModerationReportSchema = createInsertSchema(moderationReports).omit({
  id: true,
  totalVotes: true,
  removeVotes: true,
  keepVotes: true,
  reviewVotes: true,
  finalAction: true,
  actionTakenBy: true,
  actionReason: true,
  resolvedAt: true,
  isModeratorOverride: true,
  createdAt: true,
  updatedAt: true,
});

// Duplicate insertModerationVoteSchema removed - using the one defined earlier

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({
  id: true,
  createdAt: true,
});

export const insertModerationAppealSchema = createInsertSchema(moderationAppeals).omit({
  id: true,
  reviewedBy: true,
  reviewNotes: true,
  decision: true,
  newAction: true,
  reviewedAt: true,
  createdAt: true,
});

export type InsertModerationReportType = z.infer<typeof insertModerationReportSchema>;
export type InsertModerationVoteType = z.infer<typeof insertModerationVoteSchema>;
export type InsertModerationActionType = z.infer<typeof insertModerationActionSchema>;
export type InsertModerationAppealType = z.infer<typeof insertModerationAppealSchema>;

// Invitation system types
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;
export type ReferralStats = typeof referralStats.$inferSelect;
export type InsertReferralStats = typeof referralStats.$inferInsert;

// Invitation schemas
export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  acceptedAt: true,
});

export const insertReferralStatsSchema = createInsertSchema(referralStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvitationType = z.infer<typeof insertInvitationSchema>;
export type InsertReferralStatsType = z.infer<typeof insertReferralStatsSchema>;

// Payment system types will be added later after table definitions

// Marketplace transaction tables
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "payment_processing",
  "payment_confirmed",
  "in_escrow",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "refunded",
]);

export const marketplaceOrderStatusEnum = pgEnum("marketplace_order_status", [
  "item_sold",
  "payment_received",
  "label_pending",
  "label_purchased",
  "in_transit",
  "delivered",
  "payout_reconciled",
]);

// Enhanced marketplace transactions with flexible payment options
export const marketplaceTransactions = pgTable("marketplace_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),

  // Payment amounts
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0"),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default("0"),
  buyerFeeShare: decimal("buyer_fee_share", { precision: 10, scale: 2 }).default("0"),
  sellerFeeShare: decimal("seller_fee_share", { precision: 10, scale: 2 }).default("0"),
  sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),

  // Payment method and processing
  paymentMethod: varchar("payment_method", {
    enum: [
      "on_platform_stripe",
      "on_platform_wallet",
      "off_platform_direct",
      "off_platform_cash",
      "off_platform_check",
      "off_platform_venmo",
      "off_platform_other",
    ],
  }).notNull(),
  isOffPlatform: boolean("is_off_platform").default(false),
  offPlatformMethod: varchar("off_platform_method"), // "Venmo", "Cash", "Check", etc.
  offPlatformNotes: text("off_platform_notes"),
  offPlatformConfirmedBy: varchar("off_platform_confirmed_by"),
  offPlatformConfirmedAt: timestamp("off_platform_confirmed_at"),

  // Stripe integration
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeTransferId: varchar("stripe_transfer_id"),

  // Escrow and delivery
  escrowReleaseDate: timestamp("escrow_release_date"),
  trackingNumber: varchar("tracking_number"),
  deliveryConfirmedAt: timestamp("delivery_confirmed_at"),

  // Transaction status and management
  status: transactionStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Admin notes
  marketplaceReference: varchar("marketplace_reference", { length: 240 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),

  // Communication preferences
  buyerPreferredContact: varchar("buyer_preferred_contact", {
    enum: ["platform_messages", "email", "phone", "text"],
  }).default("platform_messages"),
  sellerPreferredContact: varchar("seller_preferred_contact", {
    enum: ["platform_messages", "email", "phone", "text"],
  }).default("platform_messages"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketplaceOrders = pgTable("marketplace_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  transactionId: varchar("transaction_id").references(() => marketplaceTransactions.id),
  buyerId: varchar("buyer_id").references(() => users.id),
  sellerId: varchar("seller_id")
    .notNull()
    .references(() => users.id),
  status: marketplaceOrderStatusEnum("status").notNull().default("item_sold"),
  shippingQuote: jsonb("shipping_quote").$type<{
    carrier: "usps" | "ups" | "fedex" | "seller_created";
    serviceName: string;
    estimatedCost: number;
    estimatedDaysMin?: number;
    estimatedDaysMax?: number;
    buyerPays: boolean;
    sellerAbsorbs: boolean;
    labelPurchaseMode: "seller_external" | "platform_label";
  }>(),
  trackingNumber: varchar("tracking_number"),
  labelUrl: varchar("label_url"),
  payoutDeductionAmount: decimal("payout_deduction_amount", { precision: 10, scale: 2 }).default(
    "0"
  ),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const listingBoosts = pgTable(
  "listing_boosts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    listingId: varchar("listing_id")
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: "cascade" }),
    sellerId: varchar("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: varchar("transaction_id")
      .notNull()
      .references(() => marketplaceTransactions.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", {
      enum: ["pending_payment", "active", "expired", "cancelled"],
    })
      .notNull()
      .default("pending_payment"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("listing_boost_listing_idx").on(table.listingId),
    index("listing_boost_seller_idx").on(table.sellerId),
    uniqueIndex("listing_boost_transaction_unique").on(table.transactionId),
  ]
);

export const transactionDisputes = pgTable("transaction_disputes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id")
    .notNull()
    .references(() => marketplaceTransactions.id),
  initiatorId: varchar("initiator_id")
    .notNull()
    .references(() => users.id),
  reason: varchar("reason").notNull(),
  description: text("description").notNull(),
  status: varchar("status").notNull().default("open"), // open, investigating, resolved, escalated
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User reviews and ratings
export const userReviews = pgTable("user_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").references(() => marketplaceTransactions.id),
  reviewerId: varchar("reviewer_id")
    .notNull()
    .references(() => users.id),
  revieweeId: varchar("reviewee_id")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  title: varchar("title"),
  content: text("content"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Professional verification enhancements - using existing table

// Real-time notifications
export const realTimeNotifications = pgTable("real_time_notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  type: varchar("type").notNull(), // message, transaction, listing, review
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  actionUrl: varchar("action_url"),
  isRead: boolean("is_read").default(false),
  sentViaEmail: boolean("sent_via_email").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Search and discovery
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  searchType: varchar("search_type").notNull(), // marketplace, contractors
  searchQuery: varchar("search_query"),
  filters: jsonb("filters"), // JSON object of search filters
  alertsEnabled: boolean("alerts_enabled").default(true),
  lastNotified: timestamp("last_notified"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchAnalytics = pgTable("search_analytics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id"),
  searchQuery: varchar("search_query"),
  searchType: varchar("search_type").notNull(),
  filters: jsonb("filters"),
  resultsCount: integer("results_count"),
  clickedResultId: varchar("clicked_result_id"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Payment configuration and fee structures
export const paymentConfigurations = pgTable("payment_configurations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Configuration type
  configType: varchar("config_type", {
    enum: ["marketplace_transaction", "contractor_service", "premium_subscription"],
  }).notNull(),

  // Platform fees (TradeScout's revenue)
  platformFeeType: varchar("platform_fee_type", {
    enum: ["percentage", "fixed", "tiered"],
  }).default("fixed"),
  platformFeeValue: decimal("platform_fee_value", { precision: 5, scale: 4 }).default("1.0000"), // Flat $1 TradeScout transaction fee
  platformFeeMin: decimal("platform_fee_min", { precision: 10, scale: 2 }).default("1.00"),
  platformFeeMax: decimal("platform_fee_max", { precision: 10, scale: 2 }).default("1.00"),

  // Processing fee split (how Stripe fees are divided)
  processingFeeSplitType: varchar("processing_fee_split_type", {
    enum: ["50_50", "buyer_pays_all", "seller_pays_all", "platform_absorbs"],
  }).default("50_50"),

  // Transaction limits
  minTransactionAmount: decimal("min_transaction_amount", { precision: 10, scale: 2 }).default(
    "1.00"
  ),
  maxTransactionAmount: decimal("max_transaction_amount", { precision: 10, scale: 2 }).default(
    "50000.00"
  ),

  // Off-platform payment settings
  allowOffPlatformPayments: boolean("allow_off_platform_payments").default(true),
  offPlatformPaymentMethods: jsonb("off_platform_payment_methods")
    .$type<string[]>()
    .default(["cash", "check", "venmo", "zelle", "direct"]),

  // Configuration metadata
  isActive: boolean("is_active").default(true),
  description: text("description"),
  lastModifiedBy: varchar("last_modified_by").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comprehensive contractor payment system
export const contractorPayments = pgTable("contractor_payments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Participants
  homeownerId: varchar("homeowner_id")
    .notNull()
    .references(() => users.id),
  contractorId: varchar("contractor_id")
    .notNull()
    .references(() => contractors.id),
  leadId: varchar("lead_id").references(() => leads.id),
  quoteId: varchar("quote_id"),

  // Payment details
  serviceDescription: text("service_description").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),

  // Payment method and processing
  paymentMethod: varchar("payment_method", {
    enum: [
      "on_platform_stripe",
      "off_platform_cash",
      "off_platform_check",
      "off_platform_bank_transfer",
      "off_platform_other",
    ],
  }).notNull(),
  isOffPlatform: boolean("is_off_platform").default(false),
  offPlatformMethod: varchar("off_platform_method"),
  offPlatformNotes: text("off_platform_notes"),

  // Fee structure (only for on-platform payments)
  platformFeeAmount: decimal("platform_fee_amount", { precision: 10, scale: 2 }).default("0"),
  processingFeeAmount: decimal("processing_fee_amount", { precision: 10, scale: 2 }).default("0"),
  homeownerFeeShare: decimal("homeowner_fee_share", { precision: 10, scale: 2 }).default("0"),
  contractorFeeShare: decimal("contractor_fee_share", { precision: 10, scale: 2 }).default("0"),
  netAmountToContractor: decimal("net_amount_to_contractor", { precision: 10, scale: 2 }),

  // Stripe integration
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeTransferId: varchar("stripe_transfer_id"),

  // Payment status and timeline
  status: varchar("status", {
    enum: ["pending", "processing", "completed", "failed", "refunded", "cancelled", "disputed"],
  }).default("pending"),

  // Milestones and escrow (for larger jobs)
  hasEscrow: boolean("has_escrow").default(false),
  escrowReleaseConditions: text("escrow_release_conditions"),
  milestones: jsonb("milestones").$type<
    {
      description: string;
      amount: number;
      dueDate?: string;
      completed?: boolean;
      completedAt?: string;
    }[]
  >(),

  // Confirmation and verification
  serviceCompletedAt: timestamp("service_completed_at"),
  homeownerConfirmedAt: timestamp("homeowner_confirmed_at"),
  contractorConfirmedAt: timestamp("contractor_confirmed_at"),

  // Documentation
  invoiceNumber: varchar("invoice_number"),
  receiptUrl: varchar("receipt_url"),
  workPhotos: jsonb("work_photos").$type<string[]>(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Business analytics
export const platformAnalytics = pgTable("platform_analytics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  activeUsers: integer("active_users").default(0),
  newUsers: integer("new_users").default(0),
  listingsCreated: integer("listings_created").default(0),
  transactionsCompleted: integer("transactions_completed").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  onPlatformPayments: integer("on_platform_payments").default(0),
  offPlatformPayments: integer("off_platform_payments").default(0),
  onPlatformRevenue: decimal("on_platform_revenue", { precision: 12, scale: 2 }).default("0"),
  topCategories: jsonb("top_categories"),
  topLocations: jsonb("top_locations"),
});

// Additional type exports
export type MarketplaceTransaction = typeof marketplaceTransactions.$inferSelect;
export type InsertMarketplaceTransaction = typeof marketplaceTransactions.$inferInsert;
export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;
export type InsertMarketplaceOrder = typeof marketplaceOrders.$inferInsert;
export type ListingBoost = typeof listingBoosts.$inferSelect;
export type InsertListingBoost = typeof listingBoosts.$inferInsert;
export type TransactionDispute = typeof transactionDisputes.$inferSelect;
export type InsertTransactionDispute = typeof transactionDisputes.$inferInsert;
export type UserReview = typeof userReviews.$inferSelect;
export type InsertUserReview = typeof userReviews.$inferInsert;

export type RealTimeNotification = typeof realTimeNotifications.$inferSelect;
export type InsertRealTimeNotification = typeof realTimeNotifications.$inferInsert;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = typeof savedSearches.$inferInsert;
export type SearchAnalytics = typeof searchAnalytics.$inferSelect;
export type InsertSearchAnalytics = typeof searchAnalytics.$inferInsert;
export type PlatformAnalytics = typeof platformAnalytics.$inferSelect;
export type InsertPlatformAnalytics = typeof platformAnalytics.$inferInsert;

// Relations for new tables
export const marketplaceTransactionsRelations = relations(
  marketplaceTransactions,
  ({ one, many }) => ({
    listing: one(marketplaceListings, {
      fields: [marketplaceTransactions.listingId],
      references: [marketplaceListings.id],
    }),
    buyer: one(users, {
      fields: [marketplaceTransactions.buyerId],
      references: [users.id],
    }),
    seller: one(users, {
      fields: [marketplaceTransactions.sellerId],
      references: [users.id],
    }),
    disputes: many(transactionDisputes),
    reviews: many(userReviews),
  })
);

export const listingBoostsRelations = relations(listingBoosts, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [listingBoosts.listingId],
    references: [marketplaceListings.id],
  }),
  seller: one(users, {
    fields: [listingBoosts.sellerId],
    references: [users.id],
  }),
  transaction: one(marketplaceTransactions, {
    fields: [listingBoosts.transactionId],
    references: [marketplaceTransactions.id],
  }),
}));

export const transactionDisputesRelations = relations(transactionDisputes, ({ one }) => ({
  transaction: one(marketplaceTransactions, {
    fields: [transactionDisputes.transactionId],
    references: [marketplaceTransactions.id],
  }),
  initiator: one(users, {
    fields: [transactionDisputes.initiatorId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [transactionDisputes.resolvedBy],
    references: [users.id],
  }),
}));

export const userReviewsRelations = relations(userReviews, ({ one }) => ({
  transaction: one(marketplaceTransactions, {
    fields: [userReviews.transactionId],
    references: [marketplaceTransactions.id],
  }),
  reviewer: one(users, {
    fields: [userReviews.reviewerId],
    references: [users.id],
  }),
  reviewee: one(users, {
    fields: [userReviews.revieweeId],
    references: [users.id],
  }),
}));

export const realTimeNotificationsRelations = relations(realTimeNotifications, ({ one }) => ({
  user: one(users, {
    fields: [realTimeNotifications.userId],
    references: [users.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));

export const searchAnalyticsRelations = relations(searchAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [searchAnalytics.userId],
    references: [users.id],
  }),
}));

// Zod schemas for new tables (duplicate removed - using earlier definition)

export const insertUserReviewSchema = createInsertSchema(userReviews).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionDisputeSchema = createInsertSchema(transactionDisputes).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
});

export const insertRealTimeNotificationSchema = createInsertSchema(realTimeNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
  lastNotified: true,
});

export const insertSearchAnalyticsSchema = createInsertSchema(searchAnalytics).omit({
  id: true,
  timestamp: true,
});

export const insertPlatformAnalyticsSchema = createInsertSchema(platformAnalytics).omit({
  id: true,
});

// Payment system insert schemas and types
export const insertPaymentConfigurationSchema = createInsertSchema(paymentConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractorPaymentSchema = createInsertSchema(contractorPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Enhanced payment types
export type PaymentConfiguration = typeof paymentConfigurations.$inferSelect;
export type ContractorPayment = typeof contractorPayments.$inferSelect;
export type InsertPaymentConfiguration = z.infer<typeof insertPaymentConfigurationSchema>;
export type InsertContractorPayment = z.infer<typeof insertContractorPaymentSchema>;

// Type exports for schema forms
export type InsertUserReviewType = z.infer<typeof insertUserReviewSchema>;
export type InsertTransactionDisputeType = z.infer<typeof insertTransactionDisputeSchema>;

export type InsertRealTimeNotificationType = z.infer<typeof insertRealTimeNotificationSchema>;
export type InsertSavedSearchType = z.infer<typeof insertSavedSearchSchema>;
export type InsertSearchAnalyticsType = z.infer<typeof insertSearchAnalyticsSchema>;
export type InsertPlatformAnalyticsType = z.infer<typeof insertPlatformAnalyticsSchema>;

// ==================== TRADESCOUT FOUNDATION SYSTEM ====================

// Donation status enum
export const donationStatusEnum = pgEnum("donation_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded",
]);

// Donation type enum
export const donationTypeEnum = pgEnum("donation_type", ["one_time", "roundup", "recurring"]);

// Foundation causes (county-level charitable causes)
export const foundationCauses = pgTable("foundation_causes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // education, environment, health, etc.
  countyId: varchar("county_id").references(() => counties.id),
  isActive: boolean("is_active").default(true),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }),
  raisedAmount: decimal("raised_amount", { precision: 10, scale: 2 }).default("0"),
  imageUrl: varchar("image_url", { length: 500 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  verifiedNonprofit: boolean("verified_nonprofit").default(false),
  taxId: varchar("tax_id", { length: 20 }), // EIN number
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User donations to foundation causes
export const foundationDonations = pgTable("foundation_donations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  causeId: varchar("cause_id")
    .notNull()
    .references(() => foundationCauses.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: donationTypeEnum("type").notNull().default("one_time"),
  status: donationStatusEnum("status").notNull().default("pending"),

  // Payment processing
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }), // card, bank_transfer, etc.

  // Transaction reference (for roundup donations)
  relatedTransactionId: varchar("related_transaction_id"), // contractor payment or marketplace transaction
  relatedTransactionType: varchar("related_transaction_type"), // 'contractor' or 'marketplace'
  isRoundupDonation: boolean("is_roundup_donation").default(false),
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }), // original transaction amount

  // Recurring donations
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }), // monthly, weekly, etc.
  nextDonationDate: timestamp("next_donation_date"),

  // Tax and receipt information
  isAnonymous: boolean("is_anonymous").default(false),
  taxDeductible: boolean("tax_deductible").default(true),
  receiptSent: boolean("receipt_sent").default(false),
  receiptUrl: varchar("receipt_url", { length: 500 }),

  // Processing metadata
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }), // amount after fees
  donorMessage: text("donor_message"), // optional message from donor

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Foundation donation matching (corporate or admin matching programs)
export const donationMatching = pgTable("donation_matching", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  donationId: varchar("donation_id")
    .notNull()
    .references(() => foundationDonations.id),
  matchingAmount: decimal("matching_amount", { precision: 10, scale: 2 }).notNull(),
  matchingRatio: decimal("matching_ratio", { precision: 3, scale: 2 }), // 1.00 = 100% match
  sponsorName: varchar("sponsor_name", { length: 255 }), // company or individual matching
  sponsorMessage: text("sponsor_message"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User donation preferences (for roundup and recurring)
export const userDonationPreferences = pgTable("user_donation_preferences", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),

  // Roundup preferences
  enableRoundupDonations: boolean("enable_roundup_donations").default(false),
  roundupThreshold: decimal("roundup_threshold", { precision: 5, scale: 2 }).default("1.00"), // max roundup amount
  defaultCauseId: varchar("default_cause_id").references(() => foundationCauses.id),

  // Notification preferences
  emailReceipts: boolean("email_receipts").default(true),
  monthlyReports: boolean("monthly_reports").default(true),
  impactUpdates: boolean("impact_updates").default(true),

  // Geographic preferences
  preferLocalCauses: boolean("prefer_local_causes").default(true),
  maxDistanceFromUser: integer("max_distance_from_user").default(50), // miles

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Foundation impact reporting
export const foundationImpactReports = pgTable("foundation_impact_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  causeId: varchar("cause_id")
    .notNull()
    .references(() => foundationCauses.id),
  reportingPeriod: varchar("reporting_period", { length: 50 }), // monthly, quarterly, annual
  totalDonationsReceived: decimal("total_donations_received", { precision: 12, scale: 2 }),
  totalDonorsCount: integer("total_donors_count"),
  totalBeneficiaries: integer("total_beneficiaries"),

  // Impact metrics (flexible JSON for different cause types)
  impactMetrics: jsonb("impact_metrics"), // { "meals_provided": 1000, "trees_planted": 50, etc. }
  storytelling: text("storytelling"), // narrative impact report
  mediaUrls: jsonb("media_urls"), // photos, videos of impact

  // Financial transparency
  adminCosts: decimal("admin_costs", { precision: 10, scale: 2 }),
  programCosts: decimal("program_costs", { precision: 10, scale: 2 }),
  fundraisingCosts: decimal("fundraising_costs", { precision: 10, scale: 2 }),

  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for foundation system
export const foundationCausesRelations = relations(foundationCauses, ({ one, many }) => ({
  county: one(counties, {
    fields: [foundationCauses.countyId],
    references: [counties.id],
  }),
  creator: one(users, {
    fields: [foundationCauses.createdBy],
    references: [users.id],
  }),
  donations: many(foundationDonations),
  impactReports: many(foundationImpactReports),
}));

export const foundationDonationsRelations = relations(foundationDonations, ({ one, many }) => ({
  user: one(users, {
    fields: [foundationDonations.userId],
    references: [users.id],
  }),
  cause: one(foundationCauses, {
    fields: [foundationDonations.causeId],
    references: [foundationCauses.id],
  }),
  matching: many(donationMatching),
}));

export const donationMatchingRelations = relations(donationMatching, ({ one }) => ({
  donation: one(foundationDonations, {
    fields: [donationMatching.donationId],
    references: [foundationDonations.id],
  }),
}));

export const userDonationPreferencesRelations = relations(userDonationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userDonationPreferences.userId],
    references: [users.id],
  }),
  defaultCause: one(foundationCauses, {
    fields: [userDonationPreferences.defaultCauseId],
    references: [foundationCauses.id],
  }),
}));

export const foundationImpactReportsRelations = relations(foundationImpactReports, ({ one }) => ({
  cause: one(foundationCauses, {
    fields: [foundationImpactReports.causeId],
    references: [foundationCauses.id],
  }),
}));

export const countyVaultsRelations = relations(countyVaults, ({ one, many }) => ({
  county: one(counties, {
    fields: [countyVaults.countyId],
    references: [counties.id],
  }),
  ledgerEntries: many(vaultLedgerEntries),
}));

export const vaultLedgerEntriesRelations = relations(vaultLedgerEntries, ({ one }) => ({
  vault: one(countyVaults, {
    fields: [vaultLedgerEntries.vaultId],
    references: [countyVaults.id],
  }),
}));

export const userCountyVaultContributionAdjustmentsRelations = relations(
  userCountyVaultContributionAdjustments,
  ({ one }) => ({
    user: one(users, {
      fields: [userCountyVaultContributionAdjustments.userId],
      references: [users.id],
    }),
    county: one(counties, {
      fields: [userCountyVaultContributionAdjustments.countyId],
      references: [counties.id],
    }),
    creator: one(users, {
      fields: [userCountyVaultContributionAdjustments.createdBy],
      references: [users.id],
      relationName: "county_vault_adjustment_creator",
    }),
  })
);

// Foundation system types
export type FoundationCause = typeof foundationCauses.$inferSelect;
export type InsertFoundationCause = typeof foundationCauses.$inferInsert;

export type FoundationDonation = typeof foundationDonations.$inferSelect;
export type InsertFoundationDonation = typeof foundationDonations.$inferInsert;

export type DonationMatching = typeof donationMatching.$inferSelect;
export type InsertDonationMatching = typeof donationMatching.$inferInsert;

export type UserDonationPreferences = typeof userDonationPreferences.$inferSelect;
export type InsertUserDonationPreferences = typeof userDonationPreferences.$inferInsert;

export type FoundationImpactReport = typeof foundationImpactReports.$inferSelect;
export type InsertFoundationImpactReport = typeof foundationImpactReports.$inferInsert;

export type CountyVault = typeof countyVaults.$inferSelect;
export type InsertCountyVault = typeof countyVaults.$inferInsert;

export type VaultLedgerEntry = typeof vaultLedgerEntries.$inferSelect;
export type InsertVaultLedgerEntry = typeof vaultLedgerEntries.$inferInsert;

export type UserCountyVaultContributionAdjustment =
  typeof userCountyVaultContributionAdjustments.$inferSelect;
export type InsertUserCountyVaultContributionAdjustment =
  typeof userCountyVaultContributionAdjustments.$inferInsert;

// Community Profile Vault (MVP) types
export type CommunityVault = typeof communityVaults.$inferSelect;
export type InsertCommunityVault = typeof communityVaults.$inferInsert;

export type CommunityVaultLedgerEntry = typeof communityVaultLedgerEntries.$inferSelect;
export type InsertCommunityVaultLedgerEntry = typeof communityVaultLedgerEntries.$inferInsert;

export type CommunityCause = typeof communityCauses.$inferSelect;
export type InsertCommunityCause = typeof communityCauses.$inferInsert;

export type CommunityCauseVote = typeof communityCauseVotes.$inferSelect;
export type InsertCommunityCauseVote = typeof communityCauseVotes.$inferInsert;

export type PlatformSupportLedgerEntry = typeof platformSupportLedgerEntries.$inferSelect;
export type InsertPlatformSupportLedgerEntry = typeof platformSupportLedgerEntries.$inferInsert;

export type TradeDeal = typeof tradeDeals.$inferSelect;
export type InsertTradeDeal = typeof tradeDeals.$inferInsert;

export type TradeDealClick = typeof tradeDealClicks.$inferSelect;
export type InsertTradeDealClick = typeof tradeDealClicks.$inferInsert;

export type TradeDealEarning = typeof tradeDealEarnings.$inferSelect;
export type InsertTradeDealEarning = typeof tradeDealEarnings.$inferInsert;

export type UserPointsLedgerEntry = typeof userPointsLedger.$inferSelect;
export type InsertUserPointsLedgerEntry = typeof userPointsLedger.$inferInsert;

export type WalletAccount = typeof walletAccounts.$inferSelect;
export type InsertWalletAccount = typeof walletAccounts.$inferInsert;

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

// Foundation system Zod schemas
export const insertFoundationCauseSchema = createInsertSchema(foundationCauses).omit({
  id: true,
  raisedAmount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFoundationDonationSchema = createInsertSchema(foundationDonations).omit({
  id: true,
  status: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  receiptSent: true,
  receiptUrl: true,
  processingFee: true,
  netAmount: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserDonationPreferencesSchema = createInsertSchema(userDonationPreferences).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  }
);

export const insertFoundationImpactReportSchema = createInsertSchema(foundationImpactReports).omit({
  id: true,
  publishedAt: true,
  createdAt: true,
});

// ==================== ADVANCED AFFILIATE PROGRAM (DISABLED FOR MVP) ====================
// NOTE: A more complex affiliate program schema lives here, but it's
// temporarily disabled for the MVP to avoid conflicting with the
// simpler affiliate account system already in production.
//
// When ready to activate, reintroduce these tables & relations with
// a migration and wire them into services/routes.
//
// export const affiliatePrograms = pgTable("affiliate_programs", { ... });
// export const affiliateReferralsV2 = pgTable("affiliate_referrals_v2", { ... });
// export const affiliateCommissions = pgTable("affiliate_commissions", { ... });
// export const affiliateProgramPayouts = pgTable("affiliate_program_payouts", { ... });
// export const affiliateProgramsRelations = relations(...);
// export const affiliateReferralsV2Relations = relations(...);
// export const affiliateCommissionsRelations = relations(...);
// export const affiliateProgramPayoutsRelations = relations(...);
// export type AffiliateProgram = typeof affiliatePrograms.$inferSelect;
// export type InsertAffiliateProgram = typeof affiliatePrograms.$inferInsert;
// export type AdvancedAffiliateReferral = typeof affiliateReferralsV2.$inferSelect;
// export type InsertAdvancedAffiliateReferral = typeof affiliateReferralsV2.$inferInsert;
// export type AffiliateCommission = typeof affiliateCommissions.$inferSelect;
// export type InsertAffiliateCommission = typeof affiliateCommissions.$inferInsert;
// export type AffiliateProgramPayout = typeof affiliateProgramPayouts.$inferSelect;
// export type InsertAffiliateProgramPayout = typeof affiliateProgramPayouts.$inferInsert;

// Foundation system form types
export type InsertFoundationCauseType = z.infer<typeof insertFoundationCauseSchema>;
export type InsertFoundationDonationType = z.infer<typeof insertFoundationDonationSchema>;
export type InsertUserDonationPreferencesType = z.infer<typeof insertUserDonationPreferencesSchema>;
export type InsertFoundationImpactReportType = z.infer<typeof insertFoundationImpactReportSchema>;

// Tutorial system tables
export * from "./tutorial-schema";

// ===========================================
// NOTIFICATION SYSTEM TABLES
// ===========================================

// Notification types enum
const {
  notificationTypeEnum,
  notificationPriorityEnum,
  deliveryMethodEnum,
  notifications,
  notificationPreferences,
  pushSubscriptions,
  userPersonalEvents,
  notificationDeliveryLog,
  notificationTemplates,
  notificationJobs,
  insertNotificationSchema,
  insertNotificationPreferencesSchema,
  insertUserPersonalEventSchema,
  insertNotificationTemplateSchema,
} = createNotificationSchema(() => users.id);

export {
  notificationTypeEnum,
  notificationPriorityEnum,
  deliveryMethodEnum,
  notifications,
  notificationPreferences,
  pushSubscriptions,
  userPersonalEvents,
  notificationDeliveryLog,
  notificationTemplates,
  notificationJobs,
  insertNotificationSchema,
  insertNotificationPreferencesSchema,
  insertUserPersonalEventSchema,
  insertNotificationTemplateSchema,
};

// Relations for notification system
export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  deliveryLogs: many(notificationDeliveryLog),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const userPersonalEventsRelations = relations(userPersonalEvents, ({ one }) => ({
  user: one(users, {
    fields: [userPersonalEvents.userId],
    references: [users.id],
  }),
}));

export const notificationDeliveryLogRelations = relations(notificationDeliveryLog, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationDeliveryLog.notificationId],
    references: [notifications.id],
  }),
  user: one(users, {
    fields: [notificationDeliveryLog.userId],
    references: [users.id],
  }),
}));

export const notificationJobsRelations = relations(notificationJobs, ({ one }) => ({
  template: one(notificationTemplates, {
    fields: [notificationJobs.templateId],
    references: [notificationTemplates.id],
  }),
}));

// Types for notification system
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

export type UserPersonalEvent = typeof userPersonalEvents.$inferSelect;
export type InsertUserPersonalEvent = z.infer<typeof insertUserPersonalEventSchema>;

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;

export type NotificationDeliveryLog = typeof notificationDeliveryLog.$inferSelect;
export type NotificationJob = typeof notificationJobs.$inferSelect;

// Feature Flags table for admin control over platform features
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 255 }).notNull().unique(), // e.g., 'advanced_calculator'
  description: text("description"),
  enabled: boolean("enabled").default(false),
  category: varchar("category", { length: 100 }).default("general"), // general, admin, contractor, homeowner
  userRoles: text("user_roles")
    .array()
    .default(sql`ARRAY[]::text[]`), // Roles that can see this feature
  config: jsonb("config"), // Additional configuration data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Feature flag types
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFeatureFlagType = z.infer<typeof insertFeatureFlagSchema>;

// Phase 1: Daily Deal Feeds (LuckyBucks 2.0) System
export const dailyDeals = pgTable("daily_deals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  dealType: varchar("deal_type", { length: 50 }).notNull(), // 'service_discount', 'product_sale', 'material_deal'

  // Provider info
  providerId: varchar("provider_id").notNull(),
  providerType: varchar("provider_type", { length: 50 }).notNull(), // 'contractor', 'service_provider', 'business'

  // Deal details
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  discountPrice: decimal("discount_price", { precision: 10, scale: 2 }).notNull(),
  discountPercentage: integer("discount_percentage"),

  // Geographic targeting
  countyFips: varchar("county_fips", { length: 5 }).notNull(),
  serviceArea: text("service_area").array(),

  // Timing and availability
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  maxRedemptions: integer("max_redemptions"),
  currentRedemptions: integer("current_redemptions").default(0),

  // Engagement metrics
  views: integer("views").default(0),
  clicks: integer("clicks").default(0),
  saves: integer("saves").default(0),

  // Metadata
  tags: text("tags")
    .array()
    .default(sql`ARRAY[]::text[]`),
  featured: boolean("featured").default(false),
  priority: integer("priority").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Canonical promotions table for TradeDeals, sponsors, and announcements
export const promotions = pgTable("promotions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Core content
  title: varchar("title", { length: 200 }).notNull(),
  shortDescription: varchar("short_description", { length: 280 }).notNull(),
  imageAttachmentId: varchar("image_attachment_id"),
  ctaLabel: varchar("cta_label", { length: 80 }),
  ctaUrl: text("cta_url"),

  // Semantics
  type: varchar("type", {
    enum: ["trade_deal", "sponsor", "affiliate", "announcement"],
  }).notNull(),
  exclusive: boolean("exclusive").notNull().default(false),

  // Monetization tier: free_directory (no placements) vs paid_campaign (placements allowed)
  tier: varchar("tier", {
    enum: ["free_directory", "paid_campaign"],
  })
    .notNull()
    .default("free_directory"),

  // Lifecycle
  status: varchar("status", {
    enum: ["draft", "active", "paused", "ended"],
  })
    .notNull()
    .default("draft"),

  // Targeting
  countyFips: text("county_fips")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  userTypeTags: text("user_type_tags")
    .array()
    .default(sql`ARRAY[]::text[]`),
  tradeSlugs: text("trade_slugs")
    .array()
    .default(sql`ARRAY[]::text[]`),

  // Placements
  placementCommunitySnapshot: boolean("placement_community_snapshot").notNull().default(false),
  placementCommunityFeed: boolean("placement_community_feed").notNull().default(false),
  placementScout: boolean("placement_scout").notNull().default(false),
  placementMarketplace: boolean("placement_marketplace").notNull().default(false),

  // Timing
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = typeof promotions.$inferInsert;

// User affiliate system (Phase 1 requirement)
export const userAffiliates = pgTable("user_affiliates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  affiliateCode: varchar("affiliate_code", { length: 50 }).notNull().unique(),

  // Commission tracking
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0"),
  pendingEarnings: decimal("pending_earnings", { precision: 10, scale: 2 }).default("0"),
  paidEarnings: decimal("paid_earnings", { precision: 10, scale: 2 }).default("0"),

  // Performance metrics
  totalReferrals: integer("total_referrals").default(0),
  successfulReferrals: integer("successful_referrals").default(0),
  clicksGenerated: integer("clicks_generated").default(0),

  // Tier system
  tierLevel: varchar("tier_level", { length: 20 }).default("standard"), // 'standard', 'scout', 'ambassador'
  commissionRate: decimal("commission_rate", { precision: 4, scale: 2 }).default("10.00"), // 10% default

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Affiliate tracking for clicks and conversions
export const affiliateTracking = pgTable("affiliate_tracking", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  affiliateCode: varchar("affiliate_code", { length: 50 }).notNull(),
  visitingUserId: varchar("visiting_user_id"), // null for anonymous visitors

  // Tracking data
  action: varchar("action", { length: 50 }).notNull(), // 'click', 'signup', 'purchase', 'conversion'
  sourceUrl: text("source_url"),
  targetUrl: text("target_url"),

  // Attribution
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),

  // Revenue tracking
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  commissionEarned: decimal("commission_earned", { precision: 10, scale: 2 }),

  createdAt: timestamp("created_at").defaultNow(),
});

// Daily deal engagement tracking
export const dealEngagements = pgTable("deal_engagements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),

  engagementType: varchar("engagement_type", { length: 50 }).notNull(), // 'view', 'click', 'save', 'redeem'

  // Affiliate attribution
  affiliateCode: varchar("affiliate_code", { length: 50 }),

  // Location context
  countyFips: varchar("county_fips", { length: 5 }),

  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for Phase 1 features
export const dailyDealsRelations = relations(dailyDeals, ({ one, many }) => ({
  provider: one(users, {
    fields: [dailyDeals.providerId],
    references: [users.id],
  }),
  county: one(counties, {
    fields: [dailyDeals.countyFips],
    references: [counties.fips],
  }),
  engagements: many(dealEngagements),
}));

export const userAffiliatesRelations = relations(userAffiliates, ({ one, many }) => ({
  user: one(users, {
    fields: [userAffiliates.userId],
    references: [users.id],
  }),
  tracking: many(affiliateTracking),
}));

export const affiliateTrackingRelations = relations(affiliateTracking, ({ one }) => ({
  affiliate: one(userAffiliates, {
    fields: [affiliateTracking.affiliateCode],
    references: [userAffiliates.affiliateCode],
  }),
}));

export const dealEngagementsRelations = relations(dealEngagements, ({ one }) => ({
  deal: one(dailyDeals, {
    fields: [dealEngagements.dealId],
    references: [dailyDeals.id],
  }),
  user: one(users, {
    fields: [dealEngagements.userId],
    references: [users.id],
  }),
  affiliate: one(userAffiliates, {
    fields: [dealEngagements.affiliateCode],
    references: [userAffiliates.affiliateCode],
  }),
}));

// Type exports for Phase 1 features
export type DailyDeal = typeof dailyDeals.$inferSelect;
export type InsertDailyDeal = typeof dailyDeals.$inferInsert;

export type UserAffiliate = typeof userAffiliates.$inferSelect;
export type InsertUserAffiliate = typeof userAffiliates.$inferInsert;

export type AffiliateTracking = typeof affiliateTracking.$inferSelect;
export type InsertAffiliateTracking = typeof affiliateTracking.$inferInsert;

export type DealEngagement = typeof dealEngagements.$inferSelect;
export type InsertDealEngagement = typeof dealEngagements.$inferInsert;

// Insert schemas for validation
export const insertDailyDealSchema = createInsertSchema(dailyDeals).omit({
  id: true,
  currentRedemptions: true,
  views: true,
  clicks: true,
  saves: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAffiliateSchema = createInsertSchema(userAffiliates).omit({
  id: true,
  totalEarnings: true,
  pendingEarnings: true,
  paidEarnings: true,
  totalReferrals: true,
  successfulReferrals: true,
  clicksGenerated: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAffiliateTrackingSchema = createInsertSchema(affiliateTracking).omit({
  id: true,
  createdAt: true,
});

export const insertDealEngagementSchema = createInsertSchema(dealEngagements).omit({
  id: true,
  createdAt: true,
});

// Professional story generation tables
export const storyTemplates = pgTable("story_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  category: storyTemplateCategoryEnum("category").notNull(),
  description: text("description"),
  prompts: jsonb("prompts").$type<string[]>(),
  tone: storyToneEnum("tone").notNull(),
  length: storyLengthEnum("length").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const generatedStories = pgTable(
  "generated_stories",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: varchar("template_id").references(() => storyTemplates.id, {
      onDelete: "set null",
    }),
    title: varchar("title").notNull(),
    content: text("content").notNull(),
    userInputs: jsonb("user_inputs").$type<Record<string, string>>(),
    isPublic: boolean("is_public").default(false),
    isPinned: boolean("is_pinned").default(false),
    viewCount: integer("view_count").default(0),
    shareCount: integer("share_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_generated_stories_user").on(table.userId),
    index("idx_generated_stories_template").on(table.templateId),
    index("idx_generated_stories_public").on(table.isPublic),
  ]
);

export const storyInteractions = pgTable(
  "story_interactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storyId: varchar("story_id")
      .notNull()
      .references(() => generatedStories.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    interactionType: varchar("interaction_type").notNull(), // 'view', 'like', 'share', 'copy'
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_story_interactions_story").on(table.storyId),
    index("idx_story_interactions_user").on(table.userId),
  ]
);

// Story generation schemas
export const insertStoryTemplateSchema = createInsertSchema(storyTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeneratedStorySchema = createInsertSchema(generatedStories).omit({
  id: true,
  viewCount: true,
  shareCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoryInteractionSchema = createInsertSchema(storyInteractions).omit({
  id: true,
  createdAt: true,
});

// ==================== COMMUNITY BUILDER SYSTEM ====================

// Enum for builder rank/status
export const builderRankEnum = pgEnum("builder_rank", [
  "prospect", // New builders, pre-approved
  "bronze", // <$1k contribution
  "silver", // $1k-$5k contribution
  "gold", // $5k-$25k contribution
  "platinum", // $25k-$100k contribution
  "diamond", // $100k+ contribution
]);

// Enum for contribution types
export const contributionTypeEnum = pgEnum("contribution_type", [
  "service_hours", // Hours donated
  "materials", // Physical materials/goods
  "equipment_rental", // Equipment/machinery
  "financial", // Direct payment/funding
  "expertise", // Professional consulting/skills
  "promotion", // Marketing/visibility assistance
  "administration", // Admin/coordination help
]);

// Enum for contribution status
export const contributionStatusEnum = pgEnum("contribution_status", [
  "proposed", // Builder submitted idea
  "pending_approval", // Under review by admin
  "approved", // Ready to execute
  "in_progress", // Currently happening
  "completed", // Done, pending audit
  "verified", // Audited & locked
  "disputed", // Under dispute resolution
  "cancelled", // Withdrawn or rejected
]);

// Community Builder records
export const communityBuilderProfiles = pgTable(
  "community_builder_profiles",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    countyId: varchar("county_id")
      .notNull()
      .references(() => counties.id),

    // Builder details
    businessName: varchar("business_name"),
    description: text("description"),
    profileImageUrl: varchar("profile_image_url"),
    website: varchar("website"),

    // Contribution Tracking
    currentRank: builderRankEnum("current_rank").notNull().default("prospect"),
    totalContributionValue: decimal("total_contribution_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalHoursDonated: decimal("total_hours_donated", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    activeContributionsCount: integer("active_contributions_count").notNull().default(0),
    completedContributionsCount: integer("completed_contributions_count").notNull().default(0),

    // Reputation & Performance
    ratingScore: decimal("rating_score", { precision: 3, scale: 2 }).default("0"), // 0-5 stars
    ratingCount: integer("rating_count").notNull().default(0),
    verificationRate: decimal("verification_rate", { precision: 5, scale: 2 }).default("100"), // 0-100%

    // Payout Info
    bankAccountId: varchar("bank_account_id"), // Foreign reference to external payout provider
    payoutEmail: varchar("payout_email"),
    payoutFrequency: varchar("payout_frequency").default("monthly"), // weekly, biweekly, monthly
    lastPayoutAt: timestamp("last_payout_at"),

    // Program Participation
    isProgramMember: boolean("is_program_member").default(true),
    programJoinedAt: timestamp("program_joined_at").defaultNow(),
    isVerified: boolean("is_verified").default(false),
    verificationSubmittedAt: timestamp("verification_submitted_at"),
    verificationApprovedAt: timestamp("verification_approved_at"),

    // Status
    status: varchar("status").notNull().default("active"), // active, inactive, suspended, terminated
    suspensionReason: text("suspension_reason"),
    suspendedAt: timestamp("suspended_at"),

    // Metadata & Settings
    preferences: jsonb("preferences").$type<{
      communicationChannel?: "email" | "sms" | "both";
      leaderboardVisibility?: "public" | "private" | "county_only";
      autoAcceptSmallTasks?: boolean;
      notificationPrefs?: Record<string, boolean>;
    }>(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("builder_profile_user_uidx").on(table.userId),
    index("builder_profile_county_idx").on(table.countyId),
    index("builder_profile_rank_idx").on(table.currentRank),
    index("builder_profile_status_idx").on(table.status),
  ]
);

// Proposed Contributions (Tasks/Projects)
export const builderContributions = pgTable(
  "builder_contributions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    builderId: varchar("builder_id")
      .notNull()
      .references(() => communityBuilderProfiles.id, { onDelete: "cascade" }),
    countyId: varchar("county_id")
      .notNull()
      .references(() => counties.id),

    // Contribution Details
    title: varchar("title").notNull(),
    description: text("description").notNull(),
    type: contributionTypeEnum("type").notNull(),
    status: contributionStatusEnum("status").notNull().default("proposed"),

    // Value & Impact
    estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }).notNull(),
    estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }),
    actualValue: decimal("actual_value", { precision: 12, scale: 2 }),
    actualHours: decimal("actual_hours", { precision: 10, scale: 2 }),

    // Timeline
    proposedStartDate: timestamp("proposed_start_date"),
    proposedEndDate: timestamp("proposed_end_date"),
    actualStartDate: timestamp("actual_start_date"),
    actualEndDate: timestamp("actual_end_date"),

    // Approval & Auditing
    approvedBy: varchar("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    verifiedBy: varchar("verified_by").references(() => users.id),
    verifiedAt: timestamp("verified_at"),

    // Evidence & Documentation
    evidence: jsonb("evidence").$type<
      Array<{
        type: "photo" | "video" | "invoice" | "receipt" | "document";
        url: string;
        description?: string;
        uploadedAt: string;
      }>
    >(),

    // Payout Info
    isPaidOut: boolean("is_paid_out").default(false),
    paidOutAmount: decimal("paid_out_amount", { precision: 12, scale: 2 }),
    paidOutAt: timestamp("paid_out_at"),
    paidOutToVault: boolean("paid_out_to_vault").default(true), // vs. directly to builder

    // Dispute Resolution
    isDisputed: boolean("is_disputed").default(false),
    disputeReason: text("dispute_reason"),
    disputeResolvedAt: timestamp("dispute_resolved_at"),
    disputeResolution: text("dispute_resolution"),

    // Metadata
    tags: text("tags").array(),
    impact: text("impact"), // Description of community impact

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("builder_contrib_builder_idx").on(table.builderId),
    index("builder_contrib_county_idx").on(table.countyId),
    index("builder_contrib_status_idx").on(table.status),
    index("builder_contrib_created_idx").on(table.createdAt),
  ]
);

// Contribution Audits (immutable record)
export const builderAuditLogs = pgTable(
  "builder_audit_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    contributionId: varchar("contribution_id")
      .notNull()
      .references(() => builderContributions.id, { onDelete: "cascade" }),

    // Audit Details
    auditorId: varchar("auditor_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action").notNull(), // approved, verified, rejected, disputed, resolved, adjusted

    // Value Adjustments
    originalValue: decimal("original_value", { precision: 12, scale: 2 }),
    adjustedValue: decimal("adjusted_value", { precision: 12, scale: 2 }),
    adjustmentReason: text("adjustment_reason"),

    // Notes & Evidence
    notes: text("notes"),
    supportingDocuments: jsonb("supporting_documents").$type<
      Array<{
        url: string;
        type: string;
        description?: string;
      }>
    >(),

    // Change Tracking
    changedFields: jsonb("changed_fields").$type<Record<string, { old: any; new: any }>>(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("builder_audit_contribution_idx").on(table.contributionId),
    index("builder_audit_auditor_idx").on(table.auditorId),
    index("builder_audit_action_idx").on(table.action),
  ]
);

// Builder Payouts
export const builderPayouts = pgTable(
  "builder_payouts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    builderId: varchar("builder_id")
      .notNull()
      .references(() => communityBuilderProfiles.id, { onDelete: "cascade" }),
    countyId: varchar("county_id")
      .notNull()
      .references(() => counties.id),

    // Payout Details
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency").default("USD"),
    payoutType: varchar("payout_type").notNull(), // contribution_earnings, bonus, penalty_adjustment, referral_bonus

    // Related Contribution(s)
    relatedContributionIds: text("related_contribution_ids").array(), // JSON array of contribution IDs

    // Processing
    status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed, disputed
    processingMethod: varchar("processing_method"), // ach, wire, check, stripe

    // Timing
    scheduledFor: timestamp("scheduled_for"),
    processedAt: timestamp("processed_at"),

    // External Reference
    externalPaymentId: varchar("external_payment_id"), // From payment processor (Stripe Connect, etc.)
    transactionId: varchar("transaction_id"),

    // Dispute/Resolution
    failureReason: text("failure_reason"),
    resolvedAt: timestamp("resolved_at"),

    // Audit Trail
    createdBy: varchar("created_by").references(() => users.id),
    approvedBy: varchar("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("builder_payout_builder_idx").on(table.builderId),
    index("builder_payout_county_idx").on(table.countyId),
    index("builder_payout_status_idx").on(table.status),
    index("builder_payout_created_idx").on(table.createdAt),
  ]
);

// Builder Rankings/Leaderboard (denormalized for performance)
export const builderLeaderboard = pgTable("builder_leaderboard", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  builderId: varchar("builder_id")
    .notNull()
    .unique()
    .references(() => communityBuilderProfiles.id, { onDelete: "cascade" }),
  countyId: varchar("county_id")
    .notNull()
    .references(() => counties.id),

  // Metrics
  totalContributionValue: decimal("total_contribution_value", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  totalHoursDonated: decimal("total_hours_donated", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  completedContributions: integer("completed_contributions").notNull().default(0),

  // Rankings
  valueRank: integer("value_rank"), // 1st, 2nd, 3rd place etc. for total value
  hoursRank: integer("hours_rank"), // 1st, 2nd, 3rd place etc. for hours
  overallRank: integer("overall_rank"), // Combined ranking

  // Monthly/Period Rankings
  monthlyRank: integer("monthly_rank"),
  yearlyRank: integer("yearly_rank"),

  // Performance Score
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }).default("0"), // 0-100
  trustScore: decimal("trust_score", { precision: 5, scale: 2 }).default("100"), // 0-100

  // Last Updated
  lastUpdated: timestamp("last_updated").defaultNow(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
});

// Builder Referrals (for referral bonuses)
export const builderReferrals = pgTable("builder_referrals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id")
    .notNull()
    .references(() => communityBuilderProfiles.id, { onDelete: "cascade" }),
  referredBuilderId: varchar("referred_builder_id")
    .notNull()
    .references(() => communityBuilderProfiles.id, { onDelete: "cascade" }),

  // Referral Details
  referralCode: varchar("referral_code").unique(),
  bonusAmount: decimal("bonus_amount", { precision: 12, scale: 2 }).default("0"),

  // Status
  status: varchar("status").notNull().default("pending"), // pending, earned, paid_out, cancelled
  earnedAt: timestamp("earned_at"),
  paidOutAt: timestamp("paid_out_at"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Builder Notifications & Updates
export const builderNotifications = pgTable(
  "builder_notifications",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    builderId: varchar("builder_id")
      .notNull()
      .references(() => communityBuilderProfiles.id, { onDelete: "cascade" }),

    type: varchar("type").notNull(), // contribution_approved, contribution_verified, payout_processed, rank_updated, etc.
    title: varchar("title").notNull(),
    message: text("message"),

    relatedId: varchar("related_id"), // Link to contribution, payout, etc.

    isRead: boolean("is_read").default(false),
    readAt: timestamp("read_at"),

    actionUrl: varchar("action_url"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("builder_notif_builder_idx").on(table.builderId),
    index("builder_notif_read_idx").on(table.isRead),
  ]
);

// Relations for Community Builder
export const communityBuilderProfilesRelations = relations(
  communityBuilderProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [communityBuilderProfiles.userId],
      references: [users.id],
    }),
    county: one(counties, {
      fields: [communityBuilderProfiles.countyId],
      references: [counties.id],
    }),
    contributions: many(builderContributions),
    payouts: many(builderPayouts),
    leaderboard: one(builderLeaderboard),
    referrals: many(builderReferrals),
    notifications: many(builderNotifications),
  })
);

export const builderContributionsRelations = relations(builderContributions, ({ one, many }) => ({
  builder: one(communityBuilderProfiles, {
    fields: [builderContributions.builderId],
    references: [communityBuilderProfiles.id],
  }),
  county: one(counties, {
    fields: [builderContributions.countyId],
    references: [counties.id],
  }),
  auditLogs: many(builderAuditLogs),
}));

export const builderAuditLogsRelations = relations(builderAuditLogs, ({ one }) => ({
  contribution: one(builderContributions, {
    fields: [builderAuditLogs.contributionId],
    references: [builderContributions.id],
  }),
  auditor: one(users, {
    fields: [builderAuditLogs.auditorId],
    references: [users.id],
  }),
}));

export const builderPayoutsRelations = relations(builderPayouts, ({ one }) => ({
  builder: one(communityBuilderProfiles, {
    fields: [builderPayouts.builderId],
    references: [communityBuilderProfiles.id],
  }),
  county: one(counties, {
    fields: [builderPayouts.countyId],
    references: [counties.id],
  }),
}));

export const builderLeaderboardRelations = relations(builderLeaderboard, ({ one }) => ({
  builder: one(communityBuilderProfiles, {
    fields: [builderLeaderboard.builderId],
    references: [communityBuilderProfiles.id],
  }),
  county: one(counties, {
    fields: [builderLeaderboard.countyId],
    references: [counties.id],
  }),
}));

export const builderReferralsRelations = relations(builderReferrals, ({ one }) => ({
  referrer: one(communityBuilderProfiles, {
    fields: [builderReferrals.referrerId],
    references: [communityBuilderProfiles.id],
  }),
  referredBuilder: one(communityBuilderProfiles, {
    fields: [builderReferrals.referredBuilderId],
    references: [communityBuilderProfiles.id],
  }),
}));

export const builderNotificationsRelations = relations(builderNotifications, ({ one }) => ({
  builder: one(communityBuilderProfiles, {
    fields: [builderNotifications.builderId],
    references: [communityBuilderProfiles.id],
  }),
}));

// Zod schemas for validation
export const insertCommunityBuilderProfileSchema = createInsertSchema(
  communityBuilderProfiles
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBuilderContributionSchema = createInsertSchema(builderContributions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBuilderPayoutSchema = createInsertSchema(builderPayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type CommunityBuilderProfile = typeof communityBuilderProfiles.$inferSelect;
export type InsertCommunityBuilderProfile = typeof communityBuilderProfiles.$inferInsert;
export type BuilderContribution = typeof builderContributions.$inferSelect;
export type InsertBuilderContribution = typeof builderContributions.$inferInsert;
export type BuilderPayout = typeof builderPayouts.$inferSelect;
export type InsertBuilderPayout = typeof builderPayouts.$inferInsert;
export type BuilderAuditLog = typeof builderAuditLogs.$inferSelect;
export type BuilderLeaderboard = typeof builderLeaderboard.$inferSelect;
export type BuilderReferral = typeof builderReferrals.$inferSelect;
export type BuilderNotification = typeof builderNotifications.$inferSelect;

// Story types
export type StoryTemplate = typeof storyTemplates.$inferSelect;
export type InsertStoryTemplate = typeof storyTemplates.$inferInsert;
export type GeneratedStory = typeof generatedStories.$inferSelect;
export type InsertGeneratedStory = typeof generatedStories.$inferInsert;
export type StoryInteraction = typeof storyInteractions.$inferSelect;
export type InsertStoryInteraction = typeof storyInteractions.$inferInsert;

// ============================================================================
// SCOUT INSTITUTIONAL INTELLIGENCE - Tool Discovery System
// ============================================================================

// Tool proposal status enum
export const toolProposalStatusEnum = pgEnum("tool_proposal_status", [
  "proposed",
  "approved",
  "rejected",
  "deferred",
  "merged",
]);

// Evidence source type enum
export const evidenceSourceTypeEnum = pgEnum("evidence_source_type", [
  "conversation",
  "action",
  "regret",
]);

// Tool proposals - emitted when patterns converge
export const toolProposals = pgTable(
  "tool_proposals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    fingerprint: varchar("fingerprint", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    problemStatement: text("problem_statement").notNull(),
    status: toolProposalStatusEnum("status").notNull().default("proposed"),
    riskScore: integer("risk_score").notNull().default(0),
    impactScore: integer("impact_score").notNull().default(0),
    uniqueUserCount: integer("unique_user_count").notNull().default(0),
    totalEventCount: integer("total_event_count").notNull().default(0),
    approvedAt: timestamp("approved_at"), // when institutionalized
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_tool_proposals_status").on(table.status),
    index("idx_tool_proposals_fingerprint").on(table.fingerprint),
    index("idx_tool_proposals_created_at").on(table.createdAt),
  ]
);

// Tool proposal evidence - real user interactions that led to proposal
export const toolProposalEvidence = pgTable(
  "tool_proposal_evidence",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => toolProposals.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // nullable for privacy
    sourceType: evidenceSourceTypeEnum("source_type").notNull(),
    sourceRef: varchar("source_ref", { length: 255 }), // message_id, flow_id, etc.
    snippet: text("snippet").notNull(), // redacted conversation snippet
    metadata: jsonb("metadata"), // additional context (risk level, primitives used, etc.)
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_tool_proposal_evidence_proposal_id").on(table.proposalId),
    index("idx_tool_proposal_evidence_user_id").on(table.userId),
    index("idx_tool_proposal_evidence_created_at").on(table.createdAt),
  ]
);

// Tool proposal decisions - admin review outcomes
export const toolProposalDecisions = pgTable(
  "tool_proposal_decisions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => toolProposals.id, { onDelete: "cascade" }),
    decidedByUserId: varchar("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    decision: toolProposalStatusEnum("decision").notNull(), // approved, rejected, deferred, merged
    notes: text("notes"),
    mergedIntoId: integer("merged_into_id").references(() => toolProposals.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_tool_proposal_decisions_proposal_id").on(table.proposalId),
    index("idx_tool_proposal_decisions_decided_by").on(table.decidedByUserId),
    index("idx_tool_proposal_decisions_created_at").on(table.createdAt),
  ]
);

// Relations
export const toolProposalsRelations = relations(toolProposals, ({ many }) => ({
  evidence: many(toolProposalEvidence),
  decisions: many(toolProposalDecisions),
}));

export const toolProposalEvidenceRelations = relations(toolProposalEvidence, ({ one }) => ({
  proposal: one(toolProposals, {
    fields: [toolProposalEvidence.proposalId],
    references: [toolProposals.id],
  }),
  user: one(users, {
    fields: [toolProposalEvidence.userId],
    references: [users.id],
  }),
}));

export const toolProposalDecisionsRelations = relations(toolProposalDecisions, ({ one }) => ({
  proposal: one(toolProposals, {
    fields: [toolProposalDecisions.proposalId],
    references: [toolProposals.id],
  }),
  decidedBy: one(users, {
    fields: [toolProposalDecisions.decidedByUserId],
    references: [users.id],
  }),
  mergedInto: one(toolProposals, {
    fields: [toolProposalDecisions.mergedIntoId],
    references: [toolProposals.id],
  }),
}));

// ============================================================================
// Scout Outcome Feedback Loop (authority legitimacy)
// ============================================================================

export const scoutOutcomeContextEnum = pgEnum("scout_outcome_context", [
  "direct_connect",
  "community",
  "trade_deal",
  "tool",
  "general",
]);

export const scoutOutcomeActionEnum = pgEnum("scout_outcome_action", [
  "followed_advice",
  "ignored_advice",
  "completed_flow",
  "canceled",
  "dispute",
  "refund",
  "reported_spam",
  "regret_reported",
  "success_reported",
]);

export const scoutOutcomeEvents = pgTable(
  "scout_outcome_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: varchar("conversation_id", { length: 255 }),
    contextType: scoutOutcomeContextEnum("context_type").notNull(),
    contextId: varchar("context_id", { length: 255 }),
    scope: varchar("scope", { length: 64 }).notNull().default("global"),
    action: scoutOutcomeActionEnum("action").notNull(),
    value: numeric("value"),
    confidenceDeltaHint: integer("confidence_delta_hint"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_scout_outcome_user_id").on(table.userId),
    index("idx_scout_outcome_context").on(table.contextType, table.contextId),
    index("idx_scout_outcome_created_at").on(table.createdAt),
    index("idx_scout_outcome_scope").on(table.scope),
  ]
);

export const scoutUserConfidenceState = pgTable(
  "scout_user_confidence_state",
  {
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 64 }).notNull().default("global"),
    baselineConfidence: numeric("baseline_confidence")
      .notNull()
      .default("0.20" as any),
    currentConfidence: numeric("current_confidence")
      .notNull()
      .default("0.20" as any),
    lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.scope] }),
    index("idx_scout_confidence_updated_at").on(table.lastUpdatedAt),
  ]
);

// ─── Scout Onboarding Sessions ───────────────────────────────────────────────
// Replaces the in-memory Map in onboardingService.ts with a persistent table.
// Sessions expire after 2 hours; cleanup runs on each read and on a periodic
// server-side interval.
export const scoutOnboardingSessions = pgTable(
  "scout_onboarding_sessions",
  {
    sessionId: varchar("session_id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "cascade",
    }),
    // Stored as JSON strings for flexibility without extra columns
    snapshot: text("snapshot").notNull().default("{}"),
    answeredQuestions: text("answered_questions").notNull().default("[]"),
    skippedQuestions: text("skipped_questions").notNull().default("[]"),
    expirationReason: varchar("expiration_reason", { length: 64 }),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_scout_onboarding_user_id").on(table.userId),
    index("idx_scout_onboarding_expires_at").on(table.expiresAt),
  ]
);
export type ScoutOnboardingSession = typeof scoutOnboardingSessions.$inferSelect;
export type InsertScoutOnboardingSession = typeof scoutOnboardingSessions.$inferInsert;

const {
  procurementWorkspaces,
  procurementWorkspaceMembers,
  procurementWorkspaceBranding,
  procurementOrderSources,
  procurementOrders,
  procurementOrderItems,
  procurementOrderFiles,
  procurementSupplierQuotes,
  procurementQuotes,
  procurementQuoteLines,
  procurementFulfillmentEvents,
  procurementMessages,
  procurementDeliveryProofs,
  procurementPaymentAuthorizations,
  partnerWebhookEvents,
} = createProcurementSchema(() => users.id);

export {
  procurementWorkspaces,
  procurementWorkspaceMembers,
  procurementWorkspaceBranding,
  procurementOrderSources,
  procurementOrders,
  procurementOrderItems,
  procurementOrderFiles,
  procurementSupplierQuotes,
  procurementQuotes,
  procurementQuoteLines,
  procurementFulfillmentEvents,
  procurementMessages,
  procurementDeliveryProofs,
  procurementPaymentAuthorizations,
  partnerWebhookEvents,
};

// Zod schemas
// export const insertToolProposalSchema = createInsertSchema(toolProposals).omit({
//   id: true,
//   createdAt: true,
//   updatedAt: true,
// });

// export const insertToolProposalEvidenceSchema = createInsertSchema(toolProposalEvidence).omit({
//   id: true,
//   createdAt: true,
// });

// export const insertToolProposalDecisionSchema = createInsertSchema(toolProposalDecisions).omit({
//   id: true,
//   createdAt: true,
// });

// Type exports
export type ToolProposal = typeof toolProposals.$inferSelect;
export type InsertToolProposal = typeof toolProposals.$inferInsert;
export type ToolProposalEvidence = typeof toolProposalEvidence.$inferSelect;
export type InsertToolProposalEvidence = typeof toolProposalEvidence.$inferInsert;
export type ToolProposalDecision = typeof toolProposalDecisions.$inferSelect;
export type InsertToolProposalDecision = typeof toolProposalDecisions.$inferInsert;
