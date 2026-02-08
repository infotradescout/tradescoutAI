import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { counties } from "@shared/schema";
import { inArray } from "drizzle-orm";

const router = Router();

function getAuthedUserId(req: any): string {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || "";
}

const businessTypeSchema = z.enum(["contractor", "community", "vendor", "other"]);
const businessStatusSchema = z.enum(["draft", "active", "suspended"]);

const businessProfileDataSchema = z
  .object({
    tagline: z.string().max(120).optional(),
    description: z.string().max(5000).optional(),
    category: z.string().max(120).optional(),
    services: z.array(z.string().max(120)).optional(),
    website: z.string().max(500).optional(),
    phone: z.string().max(60).optional(),
    email: z.string().email().optional(),
    contactPreference: z.enum(["call", "email", "message"]).optional(),
  })
  .strict();

const createBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).optional(),
  type: businessTypeSchema.default("other"),
  roleContext: z.string().min(2).max(64),
  profileData: businessProfileDataSchema.optional(),
  countyIds: z.array(z.string().min(1)).optional(),
  setActive: z.boolean().optional(),
});

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(120).optional(),
  type: businessTypeSchema.optional(),
  roleContext: z.string().min(2).max(64).optional(),
  profileData: businessProfileDataSchema.optional(),
  status: businessStatusSchema.optional(),
  countyIds: z.array(z.string().min(1)).optional(),
});

router.get("/api/businesses", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const list = await storage.listBusinessesByOwner(userId);
    res.json(list);
  } catch (error: any) {
    console.error("Error listing businesses:", error);
    res.status(500).json({ message: "Failed to list businesses" });
  }
});

router.post("/api/businesses", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const data = createBusinessSchema.parse(req.body);

    const created = await storage.createBusinessForOwner(userId, {
      name: data.name,
      slug: data.slug || data.name,
      type: data.type as any,
      roleContext: data.roleContext as any,
      profileData: data.profileData as any,
      status: "draft" as any,
      countyIds: data.countyIds,
    });

    if (data.setActive) {
      await storage.setUserActiveBusiness(userId, created.id);
    }

    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error creating business:", error);
    res.status(500).json({ message: error?.message || "Failed to create business" });
  }
});

router.get("/api/businesses/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const businessId = String(req.params.id);
    const business = await storage.getBusinessByIdForOwner(userId, businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const countyIds = await storage.getBusinessCountyIds(businessId);

    res.json({ ...business, countyIds });
  } catch (error: any) {
    console.error("Error getting business:", error);
    res.status(500).json({ message: "Failed to get business" });
  }
});

router.put("/api/businesses/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const businessId = String(req.params.id);
    const updates = updateBusinessSchema.parse(req.body);

    const updated = await storage.updateBusinessForOwner(userId, businessId, {
      ...updates,
      type: updates.type as any,
      roleContext: updates.roleContext as any,
      status: updates.status as any,
      profileData: updates.profileData as any,
    });

    const countyIds = await storage.getBusinessCountyIds(businessId);

    res.json({ ...updated, countyIds });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error updating business:", error);
    res.status(500).json({ message: error?.message || "Failed to update business" });
  }
});

router.delete("/api/businesses/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const businessId = String(req.params.id);

    const deleted = await storage.softDeleteBusinessForOwner(userId, businessId);

    // Unset active business if it was pointing to the deleted business
    const user = await storage.getUser(userId);
    if (user?.activeBusinessId === businessId) {
      await storage.setUserActiveBusiness(userId, null);
    }

    res.json({ success: true, business: deleted });
  } catch (error: any) {
    console.error("Error deleting business:", error);
    res.status(500).json({ message: error?.message || "Failed to delete business" });
  }
});

router.post("/api/businesses/:id/set-active", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const businessId = String(req.params.id);
    const business = await storage.getBusinessByIdForOwner(userId, businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    await storage.setUserActiveBusiness(userId, businessId);

    res.json({ success: true, activeBusinessId: businessId });
  } catch (error: any) {
    console.error("Error setting active business:", error);
    res.status(500).json({ message: "Failed to set active business" });
  }
});

// Public profile read (no auth, indexable)
router.get("/api/public/businesses/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const business = await storage.getBusinessBySlugPublic(slug);

    if (!business || business.status !== ("active" as any)) {
      return res.status(404).json({ message: "Business not found" });
    }

    const countyIdRows = await storage.getBusinessCountyIds(business.id);
    const countyRows = countyIdRows.length
      ? await db
          .select({ id: counties.id, name: counties.name, stateCode: counties.stateCode, fips: counties.fips })
          .from(counties)
          .where(inArray(counties.id, countyIdRows))
      : [];

    // Public-safe profile payload (do not expose ownerUserId)
    const profileData: any = business.profileData || {};
    const publicProfile = {
      tagline: profileData.tagline,
      description: profileData.description,
      category: profileData.category,
      services: profileData.services,
      website: profileData.website,
      contactPreference: profileData.contactPreference,
    };

    res.json({
      id: business.id,
      name: business.name,
      slug: business.slug,
      type: business.type,
      roleContext: business.roleContext,
      status: business.status,
      profile: publicProfile,
      counties: countyRows,
    });
  } catch (error: any) {
    console.error("Error fetching public business:", error);
    res.status(500).json({ message: "Failed to fetch business" });
  }
});

export { router as businessesRouter };
