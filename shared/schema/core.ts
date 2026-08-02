import { index, jsonb, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User roles enum - 27 comprehensive user types
export const userRoleEnum = pgEnum("user_role", [
  // Property Owners & Managers (5)
  "homeowner", // 1. Single-family homeowner
  "renter", // 2. Tenant/Renter
  "landlord", // 3. Property owner who rents out
  "property_manager", // 4. Professional property manager
  "hoa_member", // 5. HOA community member

  // Business & Commercial (4)
  "business_owner", // 6. Local business owner
  "commercial_property", // 7. Commercial property owner/manager
  "franchise_owner", // 8. Franchise business owner
  "startup_founder", // 9. Startup/Entrepreneur

  // Service Providers & Contractors (6)
  "contractor", // 10. Licensed contractor
  "handyman", // 11. General handyman/helper
  "service_provider", // 12. Service professional (cleaner, landscaper, etc.)
  "specialty_tradesperson", // 13. Plumber, electrician, HVAC, etc.
  "designer", // 14. Interior designer, architect
  "inspector", // 15. Home inspector, appraiser

  // Real Estate & Finance (4)
  "realtor", // 16. Real estate agent
  "mortgage_broker", // 17. Mortgage/loan specialist
  "insurance_agent", // 18. Insurance professional
  "title_company", // 19. Title/escrow services

  // Automotive (2)
  "car_dealer", // 20. Vehicle dealer/salesperson
  "auto_service", // 21. Auto repair, detailing, etc.

  // Community & Admin (3)
  "hoa_board", // 22. HOA board member/administrator
  "community_builder", // 23. Community builder program participant
  "nonprofit_org", // 24. Non-profit organization

  // Platform & Special (3)
  "affiliate", // 25. Affiliate marketer
  "content_creator", // 26. Blogger, influencer, reviewer
  "admin", // 27. Platform administrator
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",

  // Admin roles (ascending hierarchy)
  "moderator", // Basic moderation powers
  "ops_admin", // Operations and platform management
  "super_admin", // Ultimate platform authority (admin management included)
  "head_admin", // LEGACY: normalized to super_admin at runtime
]);

// Story template categories for professional story generation
export const storyTemplateCategoryEnum = pgEnum("story_template_category", [
  "background",
  "skills",
  "values",
  "approach",
  "innovation",
  "impact",
]);

// Story tone enum for narrative style
export const storyToneEnum = pgEnum("story_tone", [
  "professional",
  "friendly",
  "inspiring",
  "authoritative",
]);

// Story length enum
export const storyLengthEnum = pgEnum("story_length", ["short", "medium", "long"]);

// Trade categories enum for contractor specializations
export const tradeCategoryEnum = pgEnum("trade_category", [
  // Construction & General
  "general_contractor",
  "construction_manager",
  "project_manager",

  // Structural & Foundation
  "concrete_contractor",
  "foundation_specialist",
  "masonry_contractor",
  "structural_engineer",

  // Building Envelope
  "roofing_contractor",
  "siding_contractor",
  "window_installer",
  "door_installer",
  "insulation_contractor",

  // Electrical & Technology
  "electrician",
  "low_voltage_technician",
  "solar_installer",
  "security_system_installer",
  "smart_home_specialist",

  // Plumbing & HVAC
  "plumber",
  "hvac_contractor",
  "refrigeration_technician",
  "water_heater_specialist",
  "septic_contractor",

  // Interior Finishing
  "flooring_contractor",
  "tile_contractor",
  "carpet_installer",
  "painter",
  "drywall_contractor",
  "cabinet_maker",
  "countertop_installer",

  // Kitchen & Bath
  "kitchen_remodeler",
  "bathroom_remodeler",
  "appliance_installer",

  // Outdoor & Landscaping
  "landscaper",
  "hardscape_contractor",
  "pool_contractor",
  "fence_contractor",
  "deck_builder",
  "outdoor_lighting",

  // Specialty Services
  "home_inspector",
  "mold_remediation",
  "water_damage_restoration",
  "pest_control",
  "cleaning_service",
  "handyman",
  "maintenance_contractor",

  // General & Retail Small Business (non-trade)
  "salon_barbershop",
  "spa_wellness",
  "bakery_cafe",
  "restaurant_food_service",
  "retail_shop",
  "boutique_apparel",
  "florist",
  "pet_grooming_services",
  "childcare_provider",
  "tutor_education_services",
  "photographer_videographer",
  "event_planner",
  "auto_repair_service",
  "laundry_dry_cleaning",
  "fitness_instructor",
  "bookkeeping_accounting",
  "marketing_creative_services",
  "general_small_business",
]);

// Permission levels enum
export const permissionLevelEnum = pgEnum("permission_level", [
  "none",
  "read",
  "write",
  "admin",
  "owner",
]);

// Social post types enum
export const postTypeEnum = pgEnum("post_type", [
  "general",
  "announcement",
  "question",
  "recommendation",
  "for_sale",
  "lost_found",
  "safety_alert",
  "event",
  "service_request",
  "neighborhood_news",
]);

// Reaction types enum
export const reactionTypeEnum = pgEnum("reaction_type", [
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "angry",
  "helpful",
  "thanks",
]);

// Privacy levels enum
export const privacyLevelEnum = pgEnum("privacy_level", [
  "public",
  "neighborhood",
  "friends",
  "private",
]);

// Report reasons enum
export const reportReasonEnum = pgEnum("report_reason", [
  "spam",
  "harassment",
  "hate_speech",
  "violence",
  "misinformation",
  "inappropriate_content",
  "scam",
  "other",
]);

// Contact permission status enum
export const contactPermissionStatusEnum = pgEnum("contact_permission_status", [
  "pending",
  "accepted",
  "declined",
  "blocked",
]);

// County-level entity and note categories for geographic storage layer
export const countyNoteCategoryEnum = pgEnum("county_note_category", [
  "affiliate",
  "employee",
  "partner",
  "operations",
  "risk",
  "general",
]);

export const countyEntityTypeEnum = pgEnum("county_entity_type", [
  "affiliate",
  "employee",
  "partner",
  "territory_manager",
  "vendor",
]);

export const countyEntityStatusEnum = pgEnum("county_entity_status", [
  "active",
  "inactive",
  "pending",
]);

// Canonical observation model enums (Phase 0A)
export const observationSubjectTypeEnum = pgEnum("observation_subject_type", [
  "property",
  "business",
  "road",
  "area",
  "org",
  "person_unknown",
  "other",
]);

export const observationSourceTypeEnum = pgEnum("observation_source_type", [
  "permit",
  "inspection",
  "enforcement",
  "agenda",
  "ordinance",
  "sensor",
  "listing",
  "other",
]);

export const observationConfidenceEnum = pgEnum("observation_confidence", ["official", "inferred"]);

export const observationHealthStatusEnum = pgEnum("observation_health_status", [
  "healthy",
  "degraded",
  "failing",
  "idle",
]);

// Mission Control + Scout enums
export const botUiFailureTypeEnum = pgEnum("bot_ui_failure_type", [
  "broken",
  "stub",
  "confusing",
  "misleading",
  "permission_block",
]);

export const scoutInteractionIntentEnum = pgEnum("scout_interaction_intent", [
  "hire",
  "advise",
  "collaborate",
  "unknown",
]);

export const scoutInteractionOutcomeEnum = pgEnum("scout_interaction_outcome", [
  "completed",
  "handed_off",
  "blocked",
  "abandoned",
]);

export const scoutInteractionFailureReasonEnum = pgEnum("scout_interaction_failure_reason", [
  "missing_data",
  "no_route",
  "ui_dead_end",
  "permission",
  "unclear_copy",
]);

export const scoutInteractionUserRoleEnum = pgEnum("scout_interaction_user_role", [
  "homeowner",
  "contractor",
  "admin",
]);

export const scoutMemoryTypeEnum = pgEnum("scout_memory_type", [
  "tool_result",
  "user_preference",
  "conversation_context",
  "learning_point",
  "proactive_suggestion",
]);

export const missionControlSourceEnum = pgEnum("mission_control_source", [
  "bot_ui",
  "scout",
  "error_report",
]);

export const missionControlActionStatusEnum = pgEnum("mission_control_action_status", [
  "open",
  "done",
  "deferred",
]);

export const missionControlDecisionActionEnum = pgEnum("mission_control_decision_action", [
  "done",
  "defer",
]);

// Invitation status enum
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

// Invitation type enum
export const invitationTypeEnum = pgEnum("invitation_type", [
  "email",
  "referral_code",
  "direct_link",
]);

// Address verification status enum
export const addressVerificationStatusEnum = pgEnum("address_verification_status", [
  "pending",
  "submitted",
  "approved",
  "rejected",
  "expired",
]);

export const identityVerificationStatusEnum = pgEnum("identity_verification_status", [
  "pending",
  "submitted",
  "approved",
  "rejected",
  "expired",
]);

export const identityDocumentTypeEnum = pgEnum("identity_document_type", [
  "drivers_license",
  "passport",
  "state_id",
]);

// Professional verification status enum
export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "expired",
  "suspended",
]);

// User intent enum (person or business)
export const userIntentEnum = pgEnum("user_intent", ["person", "business"]);

// Profile business type enum (for business profiles)
export const profileBusinessTypeEnum = pgEnum("profile_business_type", [
  "service_provider",
  "seller",
]);

// Profile visibility enum
export const profileVisibilityEnum = pgEnum("profile_visibility", ["private", "discoverable"]);

// Seller type enum
export const sellerTypeEnum = pgEnum("seller_type", ["physical", "online", "hybrid"]);

// Business entity enums
export const businessTypeEnum = pgEnum("business_type", [
  "contractor",
  "community",
  "vendor",
  "other",
]);

export const businessStatusEnum = pgEnum("business_status", ["draft", "active", "suspended"]);

// Profile website layer enums
export const profileStatusEnum = pgEnum("profile_status", ["draft", "published"]);
