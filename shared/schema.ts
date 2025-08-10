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

// User roles enum
export const userRoleEnum = pgEnum('user_role', [
  'homeowner',
  'contractor_user', 
  'accelerator_member',
  'owner',
  'ops_admin',
  'territory_manager',
  'contractor_success',
  'content_seo',
  'analytics_read',
  'support'
]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash"), // for local auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  role: userRoleEnum("role").default('homeowner'),
  provider: varchar("provider").default('local'), // 'local', 'facebook', 'google'
  providerId: varchar("provider_id"), // social login ID
  emailVerified: boolean("email_verified").default(false),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  preferences: jsonb("preferences").$type<{
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    marketingEmails?: boolean;
  }>(),
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

export type InsertContractor = typeof contractors.$inferInsert;
export type Contractor = typeof contractors.$inferSelect;

export type InsertRecommendation = typeof recommendations.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;

export type InsertLead = typeof leads.$inferInsert;
export type Lead = typeof leads.$inferSelect;

export type InsertCounty = typeof counties.$inferInsert;
export type County = typeof counties.$inferSelect;

export type InsertTrade = typeof trades.$inferInsert;
export type Trade = typeof trades.$inferSelect;

export type InsertGrowthPackDownload = typeof growthPackDownloads.$inferInsert;
export type GrowthPackDownload = typeof growthPackDownloads.$inferSelect;

export type InsertAcceleratorMembership = typeof acceleratorMemberships.$inferInsert;
export type AcceleratorMembership = typeof acceleratorMemberships.$inferSelect;

export type InsertPricingData = typeof pricingData.$inferInsert;
export type PricingData = typeof pricingData.$inferSelect;

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
