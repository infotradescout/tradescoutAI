import type { Express } from "express";
import { insertCarSalesmanProfileSchema, insertRealtorProfileSchema } from "../../shared/schema";
import { isAdmin, isAuthenticated } from "../auth";
import { requireAddressVerification } from "../requireAddressVerification";
import { storage } from "../storage";

export function registerProfessionalNetworkRoutes(app: Express): void {
  // Professional Network Applications

  // Realtor application submission
  app.post(
    "/api/realtor/application",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        // Check if user already has a realtor profile
        const existingProfile = await storage.getRealtorProfile(userId);
        if (existingProfile) {
          return res.status(400).json({ message: "You already have a realtor profile" });
        }

        const parsedRealtor = insertRealtorProfileSchema.safeParse(req.body);
        if (!parsedRealtor.success) {
          return res.status(400).json({
            message: "Invalid realtor application payload",
            issues: parsedRealtor.error.issues,
          });
        }

        const realtorProfile = await storage.createRealtorProfile(parsedRealtor.data);

        // Update user role to realtor
        await storage.updateUserRole(userId, "realtor");

        await storage.logEvent("realtor_application_submitted", {
          profileId: realtorProfile.id,
          userId,
        });

        res.json({
          message: "Realtor application submitted successfully",
          profileId: realtorProfile.id,
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
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        // Check if user already has a car salesman profile
        const existingProfile = await storage.getCarSalesmanProfile(userId);
        if (existingProfile) {
          return res.status(400).json({ message: "You already have a car salesman profile" });
        }

        const parsedCarSalesman = insertCarSalesmanProfileSchema.safeParse(req.body);
        if (!parsedCarSalesman.success) {
          return res.status(400).json({
            message: "Invalid car salesman application payload",
            issues: parsedCarSalesman.error.issues,
          });
        }

        const carSalesmanProfile = await storage.createCarSalesmanProfile(parsedCarSalesman.data);

        // Update user role to car_dealer
        await storage.updateUserRole(userId, "car_dealer");

        await storage.logEvent("car_salesman_application_submitted", {
          profileId: carSalesmanProfile.id,
          userId,
        });

        res.json({
          message: "Car salesman application submitted successfully",
          profileId: carSalesmanProfile.id,
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
        const { approved, notes } = req.body;
        const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const result = await storage.updateRealtorVerificationStatus(profileId, {
          approved: !!approved,
          notes: notes || "",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });

        await storage.logEvent("realtor_verification_decision", {
          profileId,
          adminId,
          approved,
          notes,
        });

        res.json(result);
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
        const { approved, notes } = req.body;
        const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const result = await storage.updateCarSalesmanVerificationStatus(profileId, {
          approved: !!approved,
          notes: notes || "",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });

        await storage.logEvent("car_salesman_verification_decision", {
          profileId,
          adminId,
          approved,
          notes,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error updating car salesman verification:", error);
        res.status(500).json({ message: "Failed to update verification status" });
      }
    }
  );
}
