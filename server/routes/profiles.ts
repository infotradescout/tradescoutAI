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
      status: "draft" as any,
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
      status: "published" as any,
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
      status: "draft" as any,
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

// Public search for published profiles (used by Scout auto-route).
router.get("/api/profiles/public-search", async (req, res) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const results = await storage.searchProfilesPublic({ query, limit });
    res.json(results);
  } catch (error: any) {
    console.error("Error searching public profiles:", error);
    res.status(500).json({ message: "Failed to search profiles" });
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

    const business = profile.businessId
      ? await storage.getBusinessPublicById(profile.businessId)
      : undefined;
    const safeBusiness = business
      ? {
          id: business.id,
          name: business.name,
          categories: business.categories || [],
          serviceAreas: business.serviceAreas || [],
        }
      : null;

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
        profileSections: profile.profileSections || null,
      },
      business: safeBusiness,
    });
  } catch (error: any) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

router.get("/robots.txt", async (req, res) => {
  const host = req.headers.host || "www.thetradescout.com";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  res.type("text/plain");
  res.send(
    [
      "User-agent: *",
      "Allow: /p/",
      "Disallow: /api/",
      "Disallow: /admin",
      `Sitemap: ${protocol}://${host}/sitemap.xml`,
      "",
    ].join("\n")
  );
});

router.get("/sitemap.xml", async (req, res) => {
  try {
    const host = req.headers.host || "www.thetradescout.com";
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const baseUrl = `${protocol}://${host}`;

    const profiles = await storage.listPublicProfilesForSitemap();

    const urls = profiles.map((profile) => {
      const lastmod = profile.updatedAt
        ? profile.updatedAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      return `
  <url>
    <loc>${baseUrl}/p/${encodeURIComponent(profile.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

export { router as profilesRouter };
