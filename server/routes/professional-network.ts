import type { Express } from "express";
import { z } from "zod";
import { insertCarSalesmanProfileSchema, insertRealtorProfileSchema } from "../../shared/schema";
import { isAdmin, isAuthenticated } from "../auth";
import { requireAddressVerification } from "../requireAddressVerification";
import { storage } from "../storage";

const yearsExperienceSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return /^\d{1,3}$/.test(normalized) ? Number(normalized) : value;
}, z.number().int().min(0).max(100));

const licenseExpirationSchema = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? parsed
    : value;
}, z.date());

const realtorApplicationIngressSchema = insertRealtorProfileSchema
  .extend({
    yearsExperience: yearsExperienceSchema,
    licenseExpiration: licenseExpirationSchema,
  })
  .strict();

const carSalesmanApplicationIngressSchema = insertCarSalesmanProfileSchema
  .extend({
    yearsExperience: yearsExperienceSchema,
    licenseExpiration: licenseExpirationSchema,
  })
  .strict();

const professionalVerificationDecisionSchema = z
  .object({
    approved: z.boolean(),
    notes: z.string().trim().max(4_000).optional().default(""),
  })
  .strict();

function authenticatedUserId(req: { user?: { claims?: { sub?: unknown }; id?: unknown } }): string {
  return String(req.user?.claims?.sub || req.user?.id || "").trim();
}

function rejectsClientOwnedUserId(body: unknown): boolean {
  return Boolean(
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "userId")
  );
}

export function registerProfessionalNetworkRoutes(app: Express): void {
  // Professional Network Applications

  // Realtor application submission
  app.post(
    "/api/realtor/application",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = authenticatedUserId(req);
        if (!userId) return res.status(401).json({ message: "User not authenticated" });
        if (rejectsClientOwnedUserId(req.body)) {
          return res.status(400).json({ message: "Application userId is server-controlled" });
        }

        const parsedRealtor = realtorApplicationIngressSchema.safeParse(req.body);
        if (!parsedRealtor.success) {
          return res.status(400).json({
            message: "Invalid realtor application payload",
            issues: parsedRealtor.error.issues,
          });
        }

        const submission = await storage.submitRealtorApplication({
          ...parsedRealtor.data,
          userId,
        });
        if (submission.outcome === "duplicate") {
          return res.status(409).json({
            message: "You already have a realtor profile",
            profileId: submission.profile.id,
          });
        }

        res.json({
          message: "Realtor application submitted successfully",
          profileId: submission.profile.id,
        });
      } catch (error: any) {
        console.error("Error submitting realtor application:", error);
        res.status(500).json({ message: "Failed to submit realtor application" });
      }
    }
  );

  // Car salesman application submission
  app.post(
    "/api/car-salesman/application",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = authenticatedUserId(req);
        if (!userId) return res.status(401).json({ message: "User not authenticated" });
        if (rejectsClientOwnedUserId(req.body)) {
          return res.status(400).json({ message: "Application userId is server-controlled" });
        }

        const parsedCarSalesman = carSalesmanApplicationIngressSchema.safeParse(req.body);
        if (!parsedCarSalesman.success) {
          return res.status(400).json({
            message: "Invalid car salesman application payload",
            issues: parsedCarSalesman.error.issues,
          });
        }

        const submission = await storage.submitCarSalesmanApplication({
          ...parsedCarSalesman.data,
          userId,
        });
        if (submission.outcome === "duplicate") {
          return res.status(409).json({
            message: "You already have a car salesman profile",
            profileId: submission.profile.id,
          });
        }

        res.json({
          message: "Car salesman application submitted successfully",
          profileId: submission.profile.id,
        });
      } catch (error: any) {
        console.error("Error submitting car salesman application:", error);
        res.status(500).json({ message: "Failed to submit car salesman application" });
      }
    }
  );

  // Professional verification endpoints for admins
  app.get(
    "/api/admin/professional/pending",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const pendingRealtors = await storage.getPendingRealtorApplications();
        const pendingCarSalesmen = await storage.getPendingCarSalesmanApplications();

        res.json({
          realtors: pendingRealtors,
          carSalesmen: pendingCarSalesmen,
        });
      } catch (error: any) {
        console.error("Error fetching pending applications:", error);
        res.status(500).json({ message: "Failed to fetch pending applications" });
      }
    }
  );

  app.post(
    "/api/admin/realtor/verify/:profileId",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { profileId } = req.params;
        const decision = professionalVerificationDecisionSchema.safeParse(req.body);
        if (!decision.success) {
          return res.status(400).json({
            message: "Invalid professional verification decision",
            issues: decision.error.issues,
          });
        }
        const adminId = authenticatedUserId(req);
        if (!adminId) return res.status(401).json({ message: "Admin not authenticated" });
        const reviewedAt = new Date();

        const result = await storage.decideRealtorApplication({
          profileId,
          approved: decision.data.approved,
          reviewedBy: adminId,
          reviewedAt,
          reviewNotes: decision.data.notes,
        });
        if (result.outcome === "not_found") {
          return res.status(404).json({ message: "Pending realtor application not found" });
        }
        if (result.outcome === "already_decided") {
          return res.status(409).json({
            message: "Realtor application has already been decided",
            verificationStatus: result.profile.verificationStatus,
          });
        }

        res.json(result.profile);
      } catch (error: any) {
        console.error("Error updating realtor verification:", error);
        res.status(500).json({ message: "Failed to update verification status" });
      }
    }
  );

  app.post(
    "/api/admin/car-salesman/verify/:profileId",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { profileId } = req.params;
        const decision = professionalVerificationDecisionSchema.safeParse(req.body);
        if (!decision.success) {
          return res.status(400).json({
            message: "Invalid professional verification decision",
            issues: decision.error.issues,
          });
        }
        const adminId = authenticatedUserId(req);
        if (!adminId) return res.status(401).json({ message: "Admin not authenticated" });
        const reviewedAt = new Date();

        const result = await storage.decideCarSalesmanApplication({
          profileId,
          approved: decision.data.approved,
          reviewedBy: adminId,
          reviewedAt,
          reviewNotes: decision.data.notes,
        });
        if (result.outcome === "not_found") {
          return res.status(404).json({ message: "Pending car salesman application not found" });
        }
        if (result.outcome === "already_decided") {
          return res.status(409).json({
            message: "Car salesman application has already been decided",
            verificationStatus: result.profile.verificationStatus,
          });
        }

        res.json(result.profile);
      } catch (error: any) {
        console.error("Error updating car salesman verification:", error);
        res.status(500).json({ message: "Failed to update verification status" });
      }
    }
  );
}
