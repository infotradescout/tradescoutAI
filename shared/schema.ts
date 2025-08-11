import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum - Hierarchical structure
export const userRoleEnum = pgEnum('user_role', [
  // Customer roles
  'homeowner',
  'property_manager',
  'business_owner',
  
  // Service provider roles  
  'contractor_user',
  'accelerator_member',
  'realtor',
  'car_salesman',
  'insurance_agent',
  'mortgage_broker',
  
  // Community roles
  'community_member',
  'community_moderator',
  'community_leader',
  
  // Platform staff roles (ascending hierarchy)
  'support_agent',
  'content_moderator',
  'territory_manager',
  'contractor_success',
  'content_seo',
  'analytics_specialist',
  'marketing_specialist',
  
  // Admin roles (ascending hierarchy)
  'moderator',           // Basic moderation powers
  'ops_admin',          // Operations and platform management
  'super_admin',        // Full platform control except user management
  'head_admin'          // Ultimate authority - can manage all users and admins
]);

// Trade categories enum for contractor specializations
export const tradeCategoryEnum = pgEnum('trade_category', [
  // Construction & General
  'general_contractor',
  'construction_manager',
  'project_manager',
  
  // Structural & Foundation
  'concrete_contractor',
  'foundation_specialist',
  'masonry_contractor',
  'structural_engineer',
  
  // Building Envelope
  'roofing_contractor',
  'siding_contractor',
  'window_installer',
  'door_installer',
  'insulation_contractor',
  
  // Electrical & Technology
  'electrician',
  'low_voltage_technician',
  'solar_installer',
  'security_system_installer',
  'smart_home_specialist',
  
  // Plumbing & HVAC
  'plumber',
  'hvac_contractor',
  'refrigeration_technician',
  'water_heater_specialist',
  'septic_contractor',
  
  // Interior Finishing
  'flooring_contractor',
  'tile_contractor',
  'carpet_installer',
  'painter',
  'drywall_contractor',
  'cabinet_maker',
  'countertop_installer',
  
  // Kitchen & Bath
  'kitchen_remodeler',
  'bathroom_remodeler',
  'appliance_installer',
  
  // Outdoor & Landscaping
  'landscaper',
  'hardscape_contractor',
  'pool_contractor',
  'fence_contractor',
  'deck_builder',
  'outdoor_lighting',
  
  // Specialty Services
  'home_inspector',
  'mold_remediation',
  'water_damage_restoration',
  'pest_control',
  'cleaning_service',
  'handyman',
  'maintenance_contractor'
]);

// Permission levels enum
export const permissionLevelEnum = pgEnum('permission_level', [
  'none',
  'read',
  'write', 
  'admin',
  'owner'
]);

// Social post types enum
export const postTypeEnum = pgEnum('post_type', [
  'general',
  'announcement',
  'question',
  'recommendation',
  'for_sale',
  'lost_found',
  'safety_alert',
  'event',
  'service_request',
  'neighborhood_news'
]);

// Reaction types enum
export const reactionTypeEnum = pgEnum('reaction_type', [
  'like',
  'love',
  'laugh',
  'wow',
  'sad',
  'angry',
  'helpful',
  'thanks'
]);

// Privacy levels enum
export const privacyLevelEnum = pgEnum('privacy_level', [
  'public',
  'neighborhood',
  'friends',
  'private'
]);

// Report reasons enum
export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'misinformation',
  'inappropriate_content',
  'scam',
  'other'
]);

// Invitation status enum
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'expired'
]);

// Invitation type enum
export const invitationTypeEnum = pgEnum('invitation_type', [
  'email',
  'referral_code',
  'direct_link'
]);

// Address verification status enum
export const addressVerificationStatusEnum = pgEnum('address_verification_status', [
  'pending',
  'submitted',
  'approved',
  'rejected',
  'expired'
]);

// Professional verification status enum
export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'expired',
  'suspended'
]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  role: userRoleEnum("role").default('homeowner'),
  provider: varchar("provider").default('local'), // 'local', 'facebook', 'google'
  providerId: varchar("provider_id"), // social login ID
  facebookId: varchar("facebook_id"), // Add facebookId field
  googleId: varchar("google_id"), // Add googleId field
  emailVerified: boolean("email_verified").default(false),
  addressVerified: boolean("address_verified").default(false),
  addressVerificationDeadline: timestamp("address_verification_deadline"),
  verificationStatus: verificationStatusEnum("verification_status").default('pending'), // Add verificationStatus
  onboardingCompleted: boolean("onboarding_completed").default(false),
  referralCode: varchar("referral_code"),
  invitedBy: varchar("invited_by"),
  preferences: jsonb("preferences").$type<{
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    marketingEmails?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Realtor profiles
export const realtorProfiles = pgTable("realtor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  verificationStatus: verificationStatusEnum("verification_status").default('pending'),
  verificationDocuments: jsonb("verification_documents").$type<{
    licenseDocument?: string;
    brokerageAffiliation?: string;
    mlsCertificate?: string;
    additionalCertifications?: string[];
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Car salesman profiles
export const carSalesmanProfiles = pgTable("car_salesman_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  verificationStatus: verificationStatusEnum("verification_status").default('pending'),
  verificationDocuments: jsonb("verification_documents").$type<{
    dealerLicense?: string;
    salesmanLicense?: string;
    dealershipAffiliation?: string;
    additionalCertifications?: string[];
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// States table
export const states = pgTable("states", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  code: varchar("code", { length: 2 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Counties table with FIPS codes
export const counties = pgTable("counties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  fips: varchar("fips", { length: 5 }).notNull().unique(),
  stateCode: varchar("state_code", { length: 2 }).notNull(),
  population: integer("population"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trade categories (hierarchical)
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  parentId: varchar("parent_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contractors table
export const contractors = pgTable("contractors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
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
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contractor-Trade relationships (many-to-many)
export const contractorTrades = pgTable("contractor_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  tradeId: varchar("trade_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contractor service areas (many-to-many with counties)
export const contractorCounties = pgTable("contractor_counties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  countyId: varchar("county_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recommendations/Reviews
export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  userId: varchar("user_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  photoUrl: varchar("photo_url"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contractor leaderboard statistics tracking
export const contractorLeaderboardStats = pgTable("contractor_leaderboard_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  monthlyRecommendations: integer("monthly_recommendations").default(0),
  lifetimeRecommendations: integer("lifetime_recommendations").default(0),
  monthlyRating: decimal("monthly_rating", { precision: 3, scale: 2 }), // Average rating for the month
  lifetimeRating: decimal("lifetime_rating", { precision: 3, scale: 2 }), // Overall average rating
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contractor_leaderboard_month_year_idx").on(table.contractorId, table.month, table.year),
  index("leaderboard_monthly_ranking_idx").on(table.month, table.year, table.monthlyRecommendations),
  index("leaderboard_lifetime_ranking_idx").on(table.lifetimeRecommendations),
]);

// Leads management
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // homeowner
  contractorId: varchar("contractor_id"), // assigned contractor
  projectType: varchar("project_type").notNull(),
  description: text("description"),
  countyId: varchar("county_id").notNull(),
  tradeId: varchar("trade_id").notNull(),
  estimatedValue: decimal("estimated_value"),
  urgency: varchar("urgency"), // immediate, week, month, planning
  contactPreference: varchar("contact_preference"), // phone, email, text
  status: varchar("status").default('new'), // new, contacted, qualified, matched, closed
  routingType: varchar("routing_type"), // direct, top3, call_now
  calculatorData: jsonb("calculator_data"),
  utmData: jsonb("utm_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead routing and assignment
export const leadAssignments = pgTable("lead_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  contractorId: varchar("contractor_id").notNull(),
  status: varchar("status").default('pending'), // pending, accepted, declined, expired
  assignedAt: timestamp("assigned_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
});

// Contractor verification documents
export const verificationDocuments = pgTable("verification_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  type: varchar("type").notNull(), // license, insurance, id
  fileName: varchar("file_name").notNull(),
  fileUrl: varchar("file_url").notNull(),
  status: varchar("status").default('pending'), // pending, approved, rejected
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Growth Pack downloads
export const growthPackDownloads = pgTable("growth_pack_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  purchaseAmount: decimal("purchase_amount").notNull(),
  paymentIntentId: varchar("payment_intent_id"),
  status: varchar("status").default('active'), // active, paused, cancelled
  features: jsonb("features").$type<string[]>(),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // if applicable
});

// Pricing data for quote calculators
export const pricingData = pgTable("pricing_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

export const contractorLeaderboardStatsRelations = relations(contractorLeaderboardStats, ({ one }) => ({
  contractor: one(contractors, {
    fields: [contractorLeaderboardStats.contractorId],
    references: [contractors.id],
  }),
}));

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

// Social Posts table
export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  postType: postTypeEnum("post_type").default('general'),
  privacyLevel: privacyLevelEnum("privacy_level").default('neighborhood'),
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

// Post reactions table
export const postReactions = pgTable("post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reactionType: reactionTypeEnum("reaction_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_post_reactions_post").on(table.postId),
  index("idx_post_reactions_user").on(table.userId),
]);

// Post comments table
export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: 'cascade' }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
}, (table) => [
  index("idx_post_comments_post").on(table.postId),
  index("idx_post_comments_parent").on(table.parentCommentId),
]);

// Comment reactions table
export const commentReactions = pgTable("comment_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => postComments.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reactionType: reactionTypeEnum("reaction_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_comment_reactions_comment").on(table.commentId),
  index("idx_comment_reactions_user").on(table.userId),
]);

// Post shares table
export const postShares = pgTable("post_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  shareMessage: text("share_message"),
  privacyLevel: privacyLevelEnum("privacy_level").default('neighborhood'),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_post_shares_post").on(table.postId),
  index("idx_post_shares_user").on(table.userId),
]);

// Following relationships table
export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_follows_follower").on(table.followerId),
  index("idx_user_follows_following").on(table.followingId),
]);

// Content reports table
export const contentReports = pgTable("content_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedUserId: varchar("reported_user_id").references(() => users.id, { onDelete: 'cascade' }),
  postId: varchar("post_id").references(() => socialPosts.id, { onDelete: 'cascade' }),
  commentId: varchar("comment_id").references(() => postComments.id, { onDelete: 'cascade' }),
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  status: varchar("status").default('pending'), // pending, reviewed, resolved, dismissed
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_content_reports_reporter").on(table.reporterId),
  index("idx_content_reports_status").on(table.status),
]);

// Community moderation votes - for upvoting/downvoting posts and comments
export const moderationVotes = pgTable("moderation_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voterId: varchar("voter_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: varchar("target_type").notNull(), // 'post', 'comment', 'report'
  targetId: varchar("target_id").notNull(), // ID of the post, comment, or report
  voteType: varchar("vote_type").notNull(), // 'upvote', 'downvote', 'flag', 'hide'
  reason: varchar("reason"), // optional reason for moderation action
  weight: integer("weight").default(1), // vote weight (based on user reputation)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_moderation_votes_target").on(table.targetType, table.targetId),
  index("idx_moderation_votes_voter").on(table.voterId),
]);

// Community moderation thresholds and scores
export const moderationScores = pgTable("moderation_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
}, (table) => [
  index("idx_moderation_scores_target").on(table.targetType, table.targetId),
  index("idx_moderation_scores_score").on(table.communityScore),
  index("idx_moderation_scores_flagged").on(table.isFlagged),
]);

// User reputation for voting weight
export const userReputation = pgTable("user_reputation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reputationScore: integer("reputation_score").default(100), // starting reputation
  helpfulVotes: integer("helpful_votes").default(0), // votes marked as helpful
  harmfulVotes: integer("harmful_votes").default(0), // votes marked as harmful
  moderationAccuracy: decimal("moderation_accuracy", { precision: 5, scale: 4 }).default("0.5000"), // 50% default
  voteWeight: decimal("vote_weight", { precision: 3, scale: 2 }).default("1.00"), // calculated weight
  isTrustedModerator: boolean("is_trusted_moderator").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_reputation_user").on(table.userId),
  index("idx_user_reputation_score").on(table.reputationScore),
]);

// Neighborhood boundaries table
export const neighborhoods = pgTable("neighborhoods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
}, (table) => [
  index("idx_neighborhoods_county_state").on(table.county, table.state),
]);

// Relations for social features
export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
  author: one(users, { fields: [socialPosts.authorId], references: [users.id] }),
  reactions: many(postReactions),
  comments: many(postComments),
  shares: many(postShares),
  reports: many(contentReports),
}));

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(socialPosts, { fields: [postReactions.postId], references: [socialPosts.id] }),
  user: one(users, { fields: [postReactions.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one, many }) => ({
  post: one(socialPosts, { fields: [postComments.postId], references: [socialPosts.id] }),
  author: one(users, { fields: [postComments.authorId], references: [users.id] }),
  parentComment: one(postComments, { fields: [postComments.parentCommentId], references: [postComments.id] }),
  replies: many(postComments),
  reactions: many(commentReactions),
  reports: many(contentReports),
}));

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
  comment: one(postComments, { fields: [commentReactions.commentId], references: [postComments.id] }),
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

// Insert schemas for forms
export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  viewCount: true,
  shareCount: true,
  isEdited: true,
  editedAt: true,
  isPinned: true,
  isArchived: true
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  likeCount: true,
  replyCount: true,
  isEdited: true,
  editedAt: true
});

export const insertPostReactionSchema = createInsertSchema(postReactions).omit({ 
  id: true, 
  createdAt: true 
});

export const insertPostShareSchema = createInsertSchema(postShares).omit({ 
  id: true, 
  createdAt: true 
});

export const insertContentReportSchema = createInsertSchema(contentReports).omit({ 
  id: true, 
  createdAt: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true
});

// Types
export type SocialPost = typeof socialPosts.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type PostReaction = typeof postReactions.$inferSelect;
export type PostShare = typeof postShares.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
export type Neighborhood = typeof neighborhoods.$inferSelect;

export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type InsertPostReaction = z.infer<typeof insertPostReactionSchema>;
export type InsertPostShare = z.infer<typeof insertPostShareSchema>;
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;

// Moderation schemas
export const insertModerationVoteSchema = createInsertSchema(moderationVotes).omit({ 
  id: true, 
  createdAt: true,
  isActive: true,
  weight: true 
});

export const insertModerationScoreSchema = createInsertSchema(moderationScores).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastCalculated: true,
  communityScore: true 
});

export const insertUserReputationSchema = createInsertSchema(userReputation).omit({ 
  id: true, 
  createdAt: true,
  lastUpdated: true,
  voteWeight: true,
  moderationAccuracy: true 
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

export type Region = typeof regions.$inferSelect;
export type InsertRegion = typeof regions.$inferInsert;

// Admin configuration tables for dynamic content management
export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'prizes', 'ads', 'features', 'content'
  key: varchar("key").notNull(),
  value: jsonb("value").notNull(),
  description: varchar("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const prizeConfigurations = pgTable("prize_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractorSettings = pgTable("contractor_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'verification', 'pricing', 'lead_routing'
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  adId: varchar("ad_id").notNull().references(() => advertisements.id),
  savedAt: timestamp("saved_at").defaultNow(),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").default(0),
  isActive: boolean("is_active").default(true),
});

export type SavedAd = typeof savedAds.$inferSelect;
export type InsertSavedAd = typeof savedAds.$inferInsert;

// Notification system for saved ad reminders
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // 'saved_ad_reminder', 'system', etc.
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  relatedId: varchar("related_id"), // savedAd ID, ad ID, etc.
  isRead: boolean("is_read").default(false),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type InsertContractor = typeof contractors.$inferInsert;
export type Contractor = typeof contractors.$inferSelect;

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

export type InsertGrowthPackDownload = typeof growthPackDownloads.$inferInsert;
export type GrowthPackDownload = typeof growthPackDownloads.$inferSelect;

// Worker marketplace system for task-based work
export const workers = pgTable("workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
    enum: ['pending', 'in_review', 'approved', 'rejected'] 
  }).default('pending'),
  verifiedAt: timestamp("verified_at"),
  
  // Work history and ratings
  totalJobsCompleted: integer("total_jobs_completed").default(0),
  averageRating: decimal("average_rating"),
  totalEarnings: decimal("total_earnings").default("0"),
  
  // Resume information
  workExperience: jsonb("work_experience").$type<Array<{
    jobTitle: string;
    company: string;
    startDate: string;
    endDate?: string;
    description: string;
    isCurrentJob: boolean;
    fromPlatform: boolean; // If this job was obtained through TradeScout
    taskId?: string; // Reference to platform task if applicable
  }>>(),
  education: jsonb("education").$type<Array<{
    degree: string;
    school: string;
    graduationYear?: number;
    fieldOfStudy?: string;
  }>>(),
  certifications: jsonb("certifications").$type<Array<{
    name: string;
    issuer: string;
    issueDate: string;
    expirationDate?: string;
    credentialId?: string;
  }>>(),
  portfolioItems: jsonb("portfolio_items").$type<Array<{
    title: string;
    description: string;
    imageUrl?: string;
    completionDate: string;
    skills: string[];
    fromPlatform: boolean;
    taskId?: string;
  }>>(),
  
  // Account status
  isActive: boolean("is_active").default(true),
  isAvailable: boolean("is_available").default(true),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskCategories = pgTable("task_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  iconName: varchar("icon_name"), // Lucide icon name
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  posterId: varchar("poster_id").notNull(), // user who posted the task
  posterType: varchar("poster_type", { enum: ['contractor', 'homeowner'] }).notNull(),
  
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
    enum: ['one_time', 'recurring', 'project_based'] 
  }).notNull(),
  estimatedHours: decimal("estimated_hours"),
  payType: varchar("pay_type", { 
    enum: ['hourly', 'fixed', 'per_task'] 
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
    enum: ['light', 'moderate', 'heavy'] 
  }),
  
  // Scheduling
  schedulingType: varchar("scheduling_type", { 
    enum: ['asap', 'scheduled', 'flexible'] 
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
    enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'] 
  }).default('open'),
  assignedWorkerId: varchar("assigned_worker_id"),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),
  
  // Attachments
  attachments: jsonb("attachments").$type<string[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskApplications = pgTable("task_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  
  message: text("message"),
  proposedRate: decimal("proposed_rate"),
  estimatedDuration: varchar("estimated_duration"),
  availableStartDate: timestamp("available_start_date"),
  
  status: varchar("status", { 
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'] 
  }).default('pending'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workerReviews = pgTable("worker_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workerId: varchar("worker_id").notNull(),
  requestType: varchar("request_type", { 
    enum: ['id_verification', 'background_check', 'reference_check'] 
  }).notNull(),
  
  status: varchar("status", { 
    enum: ['pending', 'in_review', 'approved', 'rejected', 'expired'] 
  }).default('pending'),
  
  submittedDocuments: jsonb("submitted_documents").$type<{
    documentType: string;
    documentUrl: string;
    uploadedAt: string;
  }[]>(),
  
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const errorReports = pgTable("error_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User information
  userId: varchar("user_id"), // nullable for anonymous reports
  userEmail: varchar("user_email"),
  
  // Error details
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  errorType: varchar("error_type", {
    enum: ['bug', 'ui_issue', 'performance', 'feature_request', 'other']
  }).default('bug'),
  
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
    enum: ['open', 'in_progress', 'resolved', 'closed', 'duplicate']
  }).default('open'),
  priority: varchar("priority", {
    enum: ['low', 'medium', 'high', 'critical']
  }).default('medium'),
  
  assignedTo: varchar("assigned_to"),
  adminNotes: text("admin_notes"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contractor promotional campaigns
export const contractorPromos = pgTable("contractor_promos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
  
  // Promo details
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description").notNull(),
  offerDetails: text("offer_details").notNull(), // "20% off all roofing jobs", "Free estimate + 10% discount"
  
  // Discount structure
  discountType: varchar("discount_type", {
    enum: ['percentage', 'fixed_amount', 'free_service', 'bundle_deal']
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
  leadCount: integer("lead_count").default(0), // Leads generated from this promo
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Track promo interactions for analytics
export const promoInteractions = pgTable("promo_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoId: varchar("promo_id").notNull().references(() => contractorPromos.id),
  
  // Interaction details
  interactionType: varchar("interaction_type", {
    enum: ['view', 'click', 'share', 'lead_generated', 'contact_made']
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

export const workerServiceAreas = pgTable("worker_service_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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


// Chat system tables
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homeownerId: varchar("homeowner_id").notNull().references(() => users.id),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderType: varchar("sender_type", { enum: ["homeowner", "contractor"] }).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type", { enum: ["text", "quote", "schedule", "materials", "image"] }).default("text"),
  metadata: jsonb("metadata"), // For quotes, schedules, material lists
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketplace conversations between buyers and sellers
export const marketplaceConversations = pgTable("marketplace_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  status: varchar("status", { enum: ["active", "closed", "archived"] }).default("active"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  buyerRating: integer("buyer_rating"), // 1-5 stars
  sellerRating: integer("seller_rating"), // 1-5 stars
  buyerFeedback: text("buyer_feedback"),
  sellerFeedback: text("seller_feedback"),
  isReadByBuyer: boolean("is_read_by_buyer").default(false),
  isReadBySeller: boolean("is_read_by_seller").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages for marketplace conversations
export const marketplaceMessages = pgTable("marketplace_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => marketplaceConversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderType: varchar("sender_type", { enum: ["buyer", "seller"] }).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type", { enum: ["text", "offer", "counter_offer", "acceptance", "image", "meeting_request"] }).default("text"),
  metadata: jsonb("metadata"), // For offers, meeting details, etc.
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }),
  materialCost: decimal("material_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  validUntil: timestamp("valid_until"),
  status: varchar("status", { enum: ["draft", "sent", "accepted", "declined", "expired"] }).default("draft"),
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  proposedDate: timestamp("proposed_date").notNull(),
  duration: integer("duration_hours"), // Duration in hours
  status: varchar("status", { enum: ["proposed", "accepted", "declined", "completed"] }).default("proposed"),
  location: varchar("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const materialLists = pgTable("material_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  items: jsonb("items").$type<Array<{
    id: string;
    name: string;
    quantity: number;
    estimatedCost: number;
    vendor?: string;
    sku?: string;
    suggestedBy: 'homeowner' | 'contractor';
    status: 'pending' | 'approved' | 'denied';
    denialReason?: string;
    notes?: string;
  }>>().notNull().default([]),
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
export type InsertMaterialList = typeof materialLists.$inferInsert;
export type MaterialList = typeof materialLists.$inferSelect;

export type InsertAcceleratorMembership = typeof acceleratorMemberships.$inferInsert;
export type AcceleratorMembership = typeof acceleratorMemberships.$inferSelect;

export type InsertPricingData = typeof pricingData.$inferInsert;
export type PricingData = typeof pricingData.$inferSelect;

export type InsertContractorPromo = typeof contractorPromos.$inferInsert;
export type ContractorPromo = typeof contractorPromos.$inferSelect;
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
  leadCount: true,
  currentUses: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPromoInteractionSchema = createInsertSchema(promoInteractions).omit({
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  categoryId: varchar("category_id").notNull().references(() => marketplaceCategories.id),
  
  // Basic listing info
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  
  // Pricing
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  priceType: varchar("price_type", {
    enum: ['fixed', 'negotiable', 'auction', 'best_offer']
  }).default('fixed'),
  originalPrice: decimal("original_price", { precision: 12, scale: 2 }), // For showing savings
  
  // Location
  county: varchar("county").notNull(),
  state: varchar("state").notNull(),
  city: varchar("city"),
  zipCode: varchar("zip_code"),
  isLocalPickupOnly: boolean("is_local_pickup_only").default(false),
  willShip: boolean("will_ship").default(false),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  
  // Item details
  condition: varchar("condition", {
    enum: ['new', 'like_new', 'excellent', 'good', 'fair', 'poor', 'parts_only']
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
    enum: ['none_required', 'pending', 'approved', 'rejected']
  }).default('none_required'),
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at"),
  
  // Listing management
  status: varchar("status", {
    enum: ['draft', 'pending_approval', 'active', 'sold', 'expired', 'removed', 'flagged', 'rejected']
  }).default('draft'),
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

export const marketplaceInquiries = pgTable("marketplace_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  
  // Inquiry details
  message: text("message").notNull(),
  offerAmount: decimal("offer_amount", { precision: 12, scale: 2 }),
  
  // Contact info (from buyer)
  buyerPhone: varchar("buyer_phone"),
  buyerEmail: varchar("buyer_email"),
  preferredContactMethod: varchar("preferred_contact_method", {
    enum: ['phone', 'email', 'message']
  }).default('message'),
  
  // Status tracking
  status: varchar("status", {
    enum: ['pending', 'replied', 'accepted', 'declined', 'completed']
  }).default('pending'),
  
  sellerResponse: text("seller_response"),
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketplaceFavorites = pgTable("marketplace_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketplaceReports = pgTable("marketplace_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id),
  reporterId: varchar("reporter_id").references(() => users.id),
  
  reason: varchar("reason", {
    enum: ['spam', 'fraud', 'inappropriate_content', 'wrong_category', 'duplicate', 'overpriced', 'other']
  }).notNull(),
  description: text("description"),
  
  status: varchar("status", {
    enum: ['pending', 'investigating', 'resolved', 'dismissed']
  }).default('pending'),
  
  adminNotes: text("admin_notes"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendor verification for food marketplace and other regulated categories
export const vendorVerifications = pgTable("vendor_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  categoryId: varchar("category_id").notNull().references(() => marketplaceCategories.id),
  
  // Identity verification (required for all)
  identityDocumentType: varchar("identity_document_type", {
    enum: ['drivers_license', 'passport', 'state_id']
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
    enum: ['pending', 'in_review', 'approved', 'rejected', 'expired']
  }).default('pending'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Identity verification
  identityDocumentType: varchar("identity_document_type", {
    enum: ['drivers_license', 'passport', 'state_id']
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
    enum: ['pending', 'in_review', 'approved', 'rejected']
  }).default('pending'),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Address verification for all users (similar to Nextdoor)
export const addressVerifications = pgTable("address_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Address details to verify
  fullAddress: text("full_address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  zipCode: varchar("zip_code").notNull(),
  
  // Verification methods
  verificationMethod: varchar("verification_method", {
    enum: ['utility_bill', 'bank_statement', 'lease_agreement', 'property_deed', 'postcard', 'phone_verification']
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
  status: addressVerificationStatusEnum("status").default('pending'),
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

// Data Privacy and Security Management Tables
export const userDataRequests = pgTable("user_data_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  requestType: varchar("request_type", { 
    enum: ['data_export', 'data_deletion', 'privacy_report', 'account_closure'] 
  }).notNull(),
  status: varchar("status", { 
    enum: ['pending', 'processing', 'completed', 'failed', 'rejected'] 
  }).default('pending'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // User whose data was accessed
  accessorId: varchar("accessor_id").notNull(), // Who accessed the data
  accessorRole: varchar("accessor_role").notNull(),
  actionType: varchar("action_type", {
    enum: ['view', 'edit', 'delete', 'export', 'login_attempt', 'password_reset', 'profile_update']
  }).notNull(),
  resourceType: varchar("resource_type", {
    enum: ['profile', 'messages', 'leads', 'recommendations', 'payments', 'documents', 'analytics']
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Affected user (if applicable)
  incidentType: varchar("incident_type", {
    enum: ['unauthorized_access', 'data_breach', 'failed_login_attempts', 'suspicious_activity', 'phishing_attempt', 'malware_detection']
  }).notNull(),
  severity: varchar("severity", { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
  status: varchar("status", { enum: ['open', 'investigating', 'resolved', 'false_positive'] }).default('open'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  profileVisibility: varchar("profile_visibility", { 
    enum: ['public', 'contractors_only', 'private'] 
  }).default('public'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id),
  
  // Post content
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  imageUrls: text("image_urls").array(),
  attachmentUrls: text("attachment_urls").array(),
  
  // Geographic targeting
  scope: varchar("scope", {
    enum: ['national', 'state', 'region', 'county', 'city']
  }).default('county'),
  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips", { length: 5 }),
  cityName: varchar("city_name"),
  regionName: varchar("region_name"), // Custom regions like "Bay Area", "Northeast", etc.
  
  // Post categorization
  category: varchar("category", {
    enum: ['general', 'projects', 'recommendations', 'questions', 'marketplace', 'events', 'announcements']
  }).default('general'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});



export const commentLikes = pgTable("comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => postComments.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});



// Invitations table for tracking user invitations
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviterId: varchar("inviter_id").notNull().references(() => users.id),
  inviteeEmail: varchar("invitee_email").notNull(),
  inviteeId: varchar("invitee_id").references(() => users.id), // Set when invitation is accepted
  
  // Invitation details
  type: invitationTypeEnum("type").notNull().default('email'),
  status: invitationStatusEnum("status").notNull().default('pending'),
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
}, (table) => [
  index("invitations_inviter_id_idx").on(table.inviterId),
  index("invitations_email_idx").on(table.inviteeEmail),
  index("invitations_code_idx").on(table.invitationCode),
  index("invitations_status_idx").on(table.status),
]);

// Referral tracking and rewards
export const referralStats = pgTable("referral_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
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
}, (table) => [
  index("referral_stats_user_id_idx").on(table.userId),
]);

export const communityGroups = pgTable("community_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  slug: varchar("slug").notNull().unique(),
  imageUrl: varchar("image_url"),
  bannerUrl: varchar("banner_url"),
  
  // Geographic scope
  scope: varchar("scope", {
    enum: ['national', 'state', 'region', 'county', 'city', 'trade_specific']
  }).default('county'),
  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips", { length: 5 }),
  cityName: varchar("city_name"),
  regionName: varchar("region_name"),
  
  // Group settings
  isPrivate: boolean("is_private").default(false),
  requiresApproval: boolean("requires_approval").default(false),
  allowPostApproval: boolean("allow_post_approval").default(false),
  
  // Stats
  memberCount: integer("member_count").default(0),
  postCount: integer("post_count").default(0),
  
  // Management
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => communityGroups.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  role: varchar("role", {
    enum: ['member', 'moderator', 'admin', 'owner']
  }).default('member'),
  
  joinedAt: timestamp("joined_at").defaultNow(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  isActive: boolean("is_active").default(true),
  isBanned: boolean("is_banned").default(false),
  bannedReason: text("banned_reason"),
  bannedBy: varchar("banned_by"),
  bannedAt: timestamp("banned_at"),
});

export const regions = pgTable("regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
export const insertRealtorProfileSchema = createInsertSchema(realtorProfiles).omit({
  id: true,
  verificationStatus: true,
  transactionsCompleted: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCarSalesmanProfileSchema = createInsertSchema(carSalesmanProfiles).omit({
  id: true,
  verificationStatus: true,
  vehiclesSold: true,
  createdAt: true,
  updatedAt: true,
});

// Professional profile types
export type RealtorProfile = typeof realtorProfiles.$inferSelect;
export type InsertRealtorProfile = z.infer<typeof insertRealtorProfileSchema>;

export type CarSalesmanProfile = typeof carSalesmanProfiles.$inferSelect;
export type InsertCarSalesmanProfile = z.infer<typeof insertCarSalesmanProfileSchema>;

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

// Handmade Products Marketplace Tables
export const handmadeCategories = pgTable("handmade_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  
  // Product details
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  categoryId: varchar("category_id").notNull().references(() => handmadeCategories.id),
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
    enum: ['draft', 'active', 'paused', 'sold', 'archived'] 
  }).default('draft'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => handmadeProducts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productOrders = pgTable("product_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => handmadeProducts.id),
  
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
    enum: ['pending', 'confirmed', 'in_progress', 'ready_to_ship', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded']
  }).default('pending'),
  
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
    enum: ['pending', 'paid', 'failed', 'refunded']
  }).default('pending'),
  
  // Communication
  buyerNotes: text("buyer_notes"),
  sellerNotes: text("seller_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => handmadeProducts.id),
  orderId: varchar("order_id").notNull().references(() => productOrders.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
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

// ===== COMMUNITY MODERATION SYSTEM =====

// Content types that can be reported
export const contentTypeEnum = pgEnum('content_type', [
  'marketplace_listing',
  'handmade_product', 
  'community_post',
  'post_comment',
  'product_review',
  'user_profile',
  'seller_profile',
  'conversation_message'
]);

// Using the reportReasonEnum defined earlier in the file

// Vote types for community moderation
export const voteTypeEnum = pgEnum('vote_type', [
  'remove',
  'keep',
  'needs_review'
]);

// Community moderation reports
export const moderationReports = pgTable("moderation_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated']
  }).default('pending'),
  
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
    enum: ['content_removed', 'content_hidden', 'content_flagged', 'warning_issued', 'no_action', 'user_suspended']
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => moderationReports.id),
  
  // Content being acted upon
  contentType: contentTypeEnum("content_type").notNull(),
  contentId: varchar("content_id").notNull(),
  contentOwnerId: varchar("content_owner_id").references(() => users.id),
  
  // Action details
  action: varchar("action", {
    enum: ['removed', 'hidden', 'flagged', 'warning', 'no_action', 'user_suspended', 'user_banned']
  }).notNull(),
  
  // Who took the action
  actionBy: varchar("action_by", {
    enum: ['community_vote', 'moderator', 'admin', 'automated']
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

// Appeals against moderation actions
export const moderationAppeals = pgTable("moderation_appeals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actionId: varchar("action_id").notNull().references(() => moderationActions.id),
  reportId: varchar("report_id").references(() => moderationReports.id),
  appellantId: varchar("appellant_id").notNull().references(() => users.id),
  
  // Appeal details
  reason: text("reason").notNull(),
  additionalEvidence: jsonb("additional_evidence").$type<{
    documents?: string[];
    screenshots?: string[];
    witnessStatements?: string[];
  }>(),
  
  // Status
  status: varchar("status", {
    enum: ['pending', 'under_review', 'approved', 'denied', 'escalated']
  }).default('pending'),
  
  // Review
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  decision: varchar("decision", {
    enum: ['appeal_granted', 'appeal_denied', 'action_modified', 'no_change']
  }),
  newAction: varchar("new_action"),
  
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Moderation settings per geographic region
export const moderationSettings = pgTable("moderation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
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
export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'payment_processing', 
  'payment_confirmed',
  'in_escrow',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
  'refunded'
]);

// Enhanced marketplace transactions with flexible payment options
export const marketplaceTransactions = pgTable("marketplace_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull().references(() => marketplaceListings.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  
  // Payment amounts
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default('0'),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default('0'),
  buyerFeeShare: decimal("buyer_fee_share", { precision: 10, scale: 2 }).default('0'),
  sellerFeeShare: decimal("seller_fee_share", { precision: 10, scale: 2 }).default('0'),
  sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),
  
  // Payment method and processing
  paymentMethod: varchar("payment_method", { 
    enum: ['on_platform_stripe', 'off_platform_direct', 'off_platform_cash', 'off_platform_check', 'off_platform_venmo', 'off_platform_other'] 
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
  status: transactionStatusEnum("status").notNull().default('pending'),
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Admin notes
  
  // Communication preferences
  buyerPreferredContact: varchar("buyer_preferred_contact", {
    enum: ['platform_messages', 'email', 'phone', 'text']
  }).default('platform_messages'),
  sellerPreferredContact: varchar("seller_preferred_contact", {
    enum: ['platform_messages', 'email', 'phone', 'text']
  }).default('platform_messages'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactionDisputes = pgTable("transaction_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull().references(() => marketplaceTransactions.id),
  initiatorId: varchar("initiator_id").notNull().references(() => users.id),
  reason: varchar("reason").notNull(),
  description: text("description").notNull(),
  status: varchar("status").notNull().default('open'), // open, investigating, resolved, escalated
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User reviews and ratings
export const userReviews = pgTable("user_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").references(() => marketplaceTransactions.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  revieweeId: varchar("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  title: varchar("title"),
  content: text("content"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Professional verification enhancements - using existing table

// Real-time notifications
export const realTimeNotifications = pgTable("real_time_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  searchType: varchar("search_type").notNull(), // marketplace, contractors
  searchQuery: varchar("search_query"),
  filters: jsonb("filters"), // JSON object of search filters
  alertsEnabled: boolean("alerts_enabled").default(true),
  lastNotified: timestamp("last_notified"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchAnalytics = pgTable("search_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Configuration type
  configType: varchar("config_type", { 
    enum: ['marketplace_transaction', 'contractor_service', 'premium_subscription'] 
  }).notNull(),
  
  // Platform fees (TradeScout's revenue)
  platformFeeType: varchar("platform_fee_type", { 
    enum: ['percentage', 'fixed', 'tiered'] 
  }).default('percentage'),
  platformFeeValue: decimal("platform_fee_value", { precision: 5, scale: 4 }).default('0.025'), // 2.5% default
  platformFeeMin: decimal("platform_fee_min", { precision: 10, scale: 2 }).default('0.50'),
  platformFeeMax: decimal("platform_fee_max", { precision: 10, scale: 2 }).default('25.00'),
  
  // Processing fee split (how Stripe fees are divided)
  processingFeeSplitType: varchar("processing_fee_split_type", { 
    enum: ['50_50', 'buyer_pays_all', 'seller_pays_all', 'platform_absorbs'] 
  }).default('50_50'),
  
  // Transaction limits
  minTransactionAmount: decimal("min_transaction_amount", { precision: 10, scale: 2 }).default('1.00'),
  maxTransactionAmount: decimal("max_transaction_amount", { precision: 10, scale: 2 }).default('50000.00'),
  
  // Off-platform payment settings
  allowOffPlatformPayments: boolean("allow_off_platform_payments").default(true),
  offPlatformPaymentMethods: jsonb("off_platform_payment_methods").$type<string[]>().default(['cash', 'check', 'venmo', 'zelle', 'direct']),
  
  // Configuration metadata
  isActive: boolean("is_active").default(true),
  description: text("description"),
  lastModifiedBy: varchar("last_modified_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comprehensive contractor payment system
export const contractorPayments = pgTable("contractor_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Participants
  homeownerId: varchar("homeowner_id").notNull().references(() => users.id),
  contractorId: varchar("contractor_id").notNull().references(() => contractors.id),
  leadId: varchar("lead_id").references(() => leads.id),
  quoteId: varchar("quote_id"),
  
  // Payment details
  serviceDescription: text("service_description").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default('USD'),
  
  // Payment method and processing
  paymentMethod: varchar("payment_method", { 
    enum: ['on_platform_stripe', 'off_platform_cash', 'off_platform_check', 'off_platform_bank_transfer', 'off_platform_other'] 
  }).notNull(),
  isOffPlatform: boolean("is_off_platform").default(false),
  offPlatformMethod: varchar("off_platform_method"),
  offPlatformNotes: text("off_platform_notes"),
  
  // Fee structure (only for on-platform payments)
  platformFeeAmount: decimal("platform_fee_amount", { precision: 10, scale: 2 }).default('0'),
  processingFeeAmount: decimal("processing_fee_amount", { precision: 10, scale: 2 }).default('0'),
  homeownerFeeShare: decimal("homeowner_fee_share", { precision: 10, scale: 2 }).default('0'),
  contractorFeeShare: decimal("contractor_fee_share", { precision: 10, scale: 2 }).default('0'),
  netAmountToContractor: decimal("net_amount_to_contractor", { precision: 10, scale: 2 }),
  
  // Stripe integration
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeTransferId: varchar("stripe_transfer_id"),
  
  // Payment status and timeline
  status: varchar("status", { 
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'disputed'] 
  }).default('pending'),
  
  // Milestones and escrow (for larger jobs)
  hasEscrow: boolean("has_escrow").default(false),
  escrowReleaseConditions: text("escrow_release_conditions"),
  milestones: jsonb("milestones").$type<{
    description: string;
    amount: number;
    dueDate?: string;
    completed?: boolean;
    completedAt?: string;
  }[]>(),
  
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  activeUsers: integer("active_users").default(0),
  newUsers: integer("new_users").default(0),
  listingsCreated: integer("listings_created").default(0),
  transactionsCompleted: integer("transactions_completed").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default('0'),
  onPlatformPayments: integer("on_platform_payments").default(0),
  offPlatformPayments: integer("off_platform_payments").default(0),
  onPlatformRevenue: decimal("on_platform_revenue", { precision: 12, scale: 2 }).default('0'),
  topCategories: jsonb("top_categories"),
  topLocations: jsonb("top_locations"),
});

// Additional type exports
export type MarketplaceTransaction = typeof marketplaceTransactions.$inferSelect;
export type InsertMarketplaceTransaction = typeof marketplaceTransactions.$inferInsert;
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
export const marketplaceTransactionsRelations = relations(marketplaceTransactions, ({ one, many }) => ({
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
export const donationStatusEnum = pgEnum('donation_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded'
]);

// Donation type enum
export const donationTypeEnum = pgEnum('donation_type', [
  'one_time',
  'roundup',
  'recurring'
]);

// Foundation causes (county-level charitable causes)
export const foundationCauses = pgTable("foundation_causes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // education, environment, health, etc.
  countyId: varchar("county_id").references(() => counties.id),
  isActive: boolean("is_active").default(true),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }),
  raisedAmount: decimal("raised_amount", { precision: 10, scale: 2 }).default('0'),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  causeId: varchar("cause_id").notNull().references(() => foundationCauses.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: donationTypeEnum("type").notNull().default('one_time'),
  status: donationStatusEnum("status").notNull().default('pending'),
  
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
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default('0'),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }), // amount after fees
  donorMessage: text("donor_message"), // optional message from donor
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Foundation donation matching (corporate or admin matching programs)
export const donationMatching = pgTable("donation_matching", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  donationId: varchar("donation_id").notNull().references(() => foundationDonations.id),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Roundup preferences
  enableRoundupDonations: boolean("enable_roundup_donations").default(false),
  roundupThreshold: decimal("roundup_threshold", { precision: 5, scale: 2 }).default('1.00'), // max roundup amount
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  causeId: varchar("cause_id").notNull().references(() => foundationCauses.id),
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

export const insertUserDonationPreferencesSchema = createInsertSchema(userDonationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFoundationImpactReportSchema = createInsertSchema(foundationImpactReports).omit({
  id: true,
  publishedAt: true,
  createdAt: true,
});

// ==================== AFFILIATE SYSTEM ====================

// Affiliate program participation
export const affiliatePrograms = pgTable("affiliate_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Affiliate tracking
  affiliateCode: varchar("affiliate_code", { length: 20 }).unique().notNull(), // e.g., "JOHN2024ABC"
  referralUrl: varchar("referral_url", { length: 500 }).notNull(), // https://tradescout.com/?ref=JOHN2024ABC
  
  // Commission settings
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default('25.00'), // 25% default
  isActive: boolean("is_active").default(true),
  
  // Performance tracking
  totalReferrals: integer("total_referrals").default(0),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 12, scale: 2 }).default('0'),
  totalCommissionPaid: decimal("total_commission_paid", { precision: 12, scale: 2 }).default('0'),
  
  // Payment info
  paymentMethod: varchar("payment_method", { length: 50 }), // paypal, bank_transfer, crypto, etc.
  paymentDetails: jsonb("payment_details"), // encrypted payment info
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral tracking - tracks when someone clicks an affiliate link
export const affiliateReferrals = pgTable("affiliate_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateProgramId: varchar("affiliate_program_id").notNull().references(() => affiliatePrograms.id),
  referredUserId: varchar("referred_user_id").references(() => users.id), // null until they sign up
  
  // Tracking data
  affiliateCode: varchar("affiliate_code", { length: 20 }).notNull(),
  clickedAt: timestamp("clicked_at").defaultNow(),
  convertedAt: timestamp("converted_at"), // when they signed up
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  
  // Status tracking
  status: varchar("status", { length: 20 }).default('clicked'), // clicked, converted, churned
  firstPurchaseAt: timestamp("first_purchase_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Commission tracking - tracks earnings from each referred user
export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateProgramId: varchar("affiliate_program_id").notNull().references(() => affiliatePrograms.id),
  referralId: varchar("referral_id").notNull().references(() => affiliateReferrals.id),
  
  // Revenue source tracking
  revenueSource: varchar("revenue_source", { length: 50 }).notNull(), // contractor_fee, marketplace_transaction, foundation_donation, subscription
  sourceTransactionId: varchar("source_transaction_id", { length: 255 }), // link to original transaction
  
  // Commission calculation
  originalAmount: decimal("original_amount", { precision: 12, scale: 2 }).notNull(), // TradeScout's revenue
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Payment tracking
  status: varchar("status", { length: 20 }).default('pending'), // pending, approved, paid, disputed
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentReference: varchar("payment_reference", { length: 255 }),
  
  // Metadata
  description: text("description"), // "Commission from contractor listing fee"
  isRecurring: boolean("is_recurring").default(false), // for subscription-based commissions
  recurringPeriod: varchar("recurring_period", { length: 20 }), // monthly, yearly
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Commission payouts - batch payments to affiliates  
export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateProgramId: varchar("affiliate_program_id").notNull().references(() => affiliatePrograms.id),
  
  // Payout details
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  commissionCount: integer("commission_count").notNull(), // number of commissions included
  payoutPeriodStart: timestamp("payout_period_start").notNull(),
  payoutPeriodEnd: timestamp("payout_period_end").notNull(),
  
  // Payment processing
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentReference: varchar("payment_reference", { length: 255 }),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default('0'),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Status
  status: varchar("status", { length: 20 }).default('pending'), // pending, processing, completed, failed
  processedAt: timestamp("processed_at"),
  failureReason: text("failure_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for affiliate system
export const affiliateProgramsRelations = relations(affiliatePrograms, ({ one, many }) => ({
  user: one(users, {
    fields: [affiliatePrograms.userId],
    references: [users.id],
  }),
  referrals: many(affiliateReferrals),
  commissions: many(affiliateCommissions),
  payouts: many(affiliatePayouts),
}));

export const affiliateReferralsRelations = relations(affiliateReferrals, ({ one, many }) => ({
  affiliateProgram: one(affiliatePrograms, {
    fields: [affiliateReferrals.affiliateProgramId],
    references: [affiliatePrograms.id],
  }),
  referredUser: one(users, {
    fields: [affiliateReferrals.referredUserId],
    references: [users.id],
  }),
  commissions: many(affiliateCommissions),
}));

export const affiliateCommissionsRelations = relations(affiliateCommissions, ({ one }) => ({
  affiliateProgram: one(affiliatePrograms, {
    fields: [affiliateCommissions.affiliateProgramId],
    references: [affiliatePrograms.id],
  }),
  referral: one(affiliateReferrals, {
    fields: [affiliateCommissions.referralId],
    references: [affiliateReferrals.id],
  }),
}));

export const affiliatePayoutsRelations = relations(affiliatePayouts, ({ one }) => ({
  affiliateProgram: one(affiliatePrograms, {
    fields: [affiliatePayouts.affiliateProgramId],
    references: [affiliatePrograms.id],
  }),
}));

// Affiliate system types
export type AffiliateProgram = typeof affiliatePrograms.$inferSelect;
export type InsertAffiliateProgram = typeof affiliatePrograms.$inferInsert;
export type AffiliateReferral = typeof affiliateReferrals.$inferSelect;
export type InsertAffiliateReferral = typeof affiliateReferrals.$inferInsert;
export type AffiliateCommission = typeof affiliateCommissions.$inferSelect;
export type InsertAffiliateCommission = typeof affiliateCommissions.$inferInsert;
export type AffiliatePayout = typeof affiliatePayouts.$inferSelect;
export type InsertAffiliatePayout = typeof affiliatePayouts.$inferInsert;

// Foundation system form types
export type InsertFoundationCauseType = z.infer<typeof insertFoundationCauseSchema>;
export type InsertFoundationDonationType = z.infer<typeof insertFoundationDonationSchema>;
export type InsertUserDonationPreferencesType = z.infer<typeof insertUserDonationPreferencesSchema>;
export type InsertFoundationImpactReportType = z.infer<typeof insertFoundationImpactReportSchema>;
