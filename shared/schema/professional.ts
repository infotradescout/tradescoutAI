import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import type { users as UsersTable } from "../schema";
import { verificationStatusEnum } from "./core";

export function createProfessionalSchema(users: typeof UsersTable) {
  const realtorProfiles = pgTable(
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
      verificationStatus: verificationStatusEnum("verification_status")
        .notNull()
        .default("pending"),
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

  const carSalesmanProfiles = pgTable(
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
      verificationStatus: verificationStatusEnum("verification_status")
        .notNull()
        .default("pending"),
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

  const realtorProfilesRelations = relations(realtorProfiles, ({ one }) => ({
    user: one(users, {
      fields: [realtorProfiles.userId],
      references: [users.id],
    }),
  }));

  const carSalesmanProfilesRelations = relations(carSalesmanProfiles, ({ one }) => ({
    user: one(users, {
      fields: [carSalesmanProfiles.userId],
      references: [users.id],
    }),
  }));

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

  const insertRealtorProfileSchema = z
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

  const insertCarSalesmanProfileSchema = z
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

  return {
    realtorProfiles,
    carSalesmanProfiles,
    realtorProfilesRelations,
    carSalesmanProfilesRelations,
    insertRealtorProfileSchema,
    insertCarSalesmanProfileSchema,
  };
}
