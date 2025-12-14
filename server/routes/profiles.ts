import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const router = Router();

function getAuthedUserId(req: any): string {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || "";
}

const contentBlockSchema = z
  .object({
    type: z.enum(["hero", "about", "services", "gallery", "faq", "reviews", "cta", "custom"]),
    data: z.record(z.any()),
  })
  .strict();

const ctaSchema = z
  .object({
    label: z.string().min(1).max(60),
    kind: z.enum(["call", "email", "message", "link"]),
    value: z.string().min(1).max(500),
  })
  .strict();

const profileSeoSchema = z
  .object({
    title: z.string().max(120).optional(),
    description: z.string().max(500).optional(),
    imageUrl: z.string().max(500).optional(),
  })
  .strict();

const createProfileSchema = z.object({
  roleContext: z.string().min(2).max(64),
  businessId: z.string().optional(),
  slug: z.string().min(2).max(120).optional(),
  displayName: z.string().min(2).max(120),
  headline: z.string().max(160).optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  ctaConfig: z
    .object({
      primary: ctaSchema.optional(),
      secondary: ctaSchema.optional(),
    })
    .optional(),
  seoMeta: profileSeoSchema.optional(),
  setActive: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  businessId: z.string().nullable().optional(),
  roleContext: z.string().min(2).max(64).optional(),
  slug: z.string().min(2).max(120).optional(),
  displayName: z.string().min(2).max(120).optional(),
  headline: z.string().max(160).nullable().optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  ctaConfig: z
    .object({
      primary: ctaSchema.optional(),
      secondary: ctaSchema.optional(),
    })
    .optional(),
  seoMeta: profileSeoSchema.optional(),
});

router.get("/api/profiles", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const list = await storage.listProfilesByOwner(userId);
    res.json(list);
  } catch (error: any) {
    console.error("Error listing profiles:", error);
    res.status(500).json({ message: "Failed to list profiles" });
  }
});

router.post("/api/profiles", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const data = createProfileSchema.parse(req.body);

    const created = await storage.createProfileForOwner(userId, {
      ownerUserId: userId as any,
      businessId: data.businessId,
      roleContext: data.roleContext as any,
      slug: data.slug || data.displayName,
      displayName: data.displayName,
      headline: data.headline || null,
      contentBlocks: data.contentBlocks || [],
      ctaConfig: data.ctaConfig || {},
      seoMeta: data.seoMeta || {},
      status: ("draft" as any),
    } as any);

    if (data.setActive) {
      await storage.setUserActiveProfile(userId, created.id);
    }

    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error creating profile:", error);
    res.status(500).json({ message: error?.message || "Failed to create profile" });
  }
});

router.get("/api/profiles/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const profile = await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.json(profile);
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

router.put("/api/profiles/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const updates = updateProfileSchema.parse(req.body);

    const updated = await storage.updateProfileForOwner(userId, profileId, {
      ...updates,
      roleContext: updates.roleContext as any,
    } as any);

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error updating profile:", error);
    res.status(500).json({ message: error?.message || "Failed to update profile" });
  }
});

// Explicit publish (draft -> published)
router.put("/api/profiles/:id/publish", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const existing = await storage.getProfileByIdForOwner(userId, profileId);
    if (!existing) return res.status(404).json({ message: "Profile not found" });

    const updated = await storage.updateProfileForOwner(userId, profileId, {
      status: ("published" as any),
    } as any);
    res.json(updated);
  } catch (error: any) {
    console.error("Error publishing profile:", error);
    res.status(500).json({ message: "Failed to publish profile" });
  }
});

// Explicit unpublish (published -> draft)
router.put("/api/profiles/:id/unpublish", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const existing = await storage.getProfileByIdForOwner(userId, profileId);
    if (!existing) return res.status(404).json({ message: "Profile not found" });

    const updated = await storage.updateProfileForOwner(userId, profileId, {
      status: ("draft" as any),
    } as any);
    res.json(updated);
  } catch (error: any) {
    console.error("Error unpublishing profile:", error);
    res.status(500).json({ message: "Failed to unpublish profile" });
  }
});

router.put("/api/users/active-profile", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = z.object({ profileId: z.string().nullable() }).parse(req.body).profileId;

    if (profileId) {
      const profile = await storage.getProfileByIdForOwner(userId, profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
    }

    const updatedUser = await storage.setUserActiveProfile(userId, profileId);
    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error setting active profile:", error);
    res.status(500).json({ message: "Failed to set active profile" });
  }
});

// Public website read: returns public Profile + public Business subset if linked.
router.get("/api/p/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const profile = await storage.getProfileBySlugPublic(slug);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const business = profile.businessId ? await storage.getBusinessPublicById(profile.businessId) : undefined;

    res.json({
      profile: {
        id: profile.id,
        slug: profile.slug,
        roleContext: profile.roleContext,
        displayName: profile.displayName,
        headline: profile.headline,
        contentBlocks: profile.contentBlocks,
        ctaConfig: profile.ctaConfig,
        seoMeta: profile.seoMeta,
      },
      business: business || null,
    });
  } catch (error: any) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

export { router as profilesRouter };
