import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const router = Router();

function getAuthedUserId(req: any): string {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || "";
}

function sanitizePublicCtaConfig(ctaConfig: unknown) {
  const safe = (ctaConfig && typeof ctaConfig === "object" ? ctaConfig : {}) as Record<string, any>;

  const sanitizeCta = (cta: unknown) => {
    if (!cta || typeof cta !== "object") return null;
    const source = cta as Record<string, any>;
    const kind = typeof source.kind === "string" ? source.kind : "message";
    const label = typeof source.label === "string" ? source.label : "Contact on TradeScout";

    return {
      label,
      kind,
      // Public pages never expose direct contact values.
      value: null,
      requiresTradeScoutAccount: true,
      route: "/direct-connect",
    };
  };

  return {
    primary: sanitizeCta(safe.primary),
    secondary: sanitizeCta(safe.secondary),
  };
}

function getCanonicalBaseUrl(req: any): string {
  const configured = String(process.env.PUBLIC_WEB_URL || process.env.APP_URL || "").trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      const host = parsed.hostname.toLowerCase();
      const isLocal = host === "localhost" || host === "127.0.0.1";
      if (!isLocal) {
        parsed.protocol = "https:";
        if (host === "thetradescout.com" || host === "tradescoutai.onrender.com") {
          parsed.hostname = "www.thetradescout.com";
        }
        parsed.port = "";
      }
      return parsed.toString().replace(/\/$/, "");
    } catch {
      // ignore malformed env value and fall back to request-based resolution below
    }
  }

  const forwardedHostRaw = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  const host = forwardedHostRaw.split(":")[0].toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal && forwardedHostRaw) {
    return `http://${forwardedHostRaw}`.replace(/\/$/, "");
  }

  return "https://www.thetradescout.com";
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
    customDomain: z
      .string()
      .max(255)
      .regex(/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i, "Invalid domain format")
      .optional(),
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

const sendPublicProfileBySlug = async (slug: string, res: any) => {
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

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res.json({
    profile: {
      id: profile.id,
      slug: profile.slug,
      roleContext: profile.roleContext,
      displayName: profile.displayName,
      headline: profile.headline,
      contentBlocks: profile.contentBlocks,
      ctaConfig: sanitizePublicCtaConfig(profile.ctaConfig),
      seoMeta: profile.seoMeta,
      profileSections: profile.profileSections || null,
      contactPolicy: {
        mode: "direct_connect_only",
        requiresTradeScoutAccount: true,
        reason: "Spam prevention",
      },
    },
    business: safeBusiness,
  });
};

// Public website read (canonical): returns public Profile + public Business subset if linked.
router.get("/api/u/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    return await sendPublicProfileBySlug(slug, res);
  } catch (error: any) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// Legacy alias for backward compatibility.
router.get("/api/p/:slug", async (req, res) => {
  const slug = String(req.params.slug || "");
  return res.redirect(301, `/api/u/${encodeURIComponent(slug)}`);
});

router.get("/robots.txt", async (req, res) => {
  const baseUrl = getCanonicalBaseUrl(req);
  res.type("text/plain");
  res.send(
    [
      "User-agent: *",
      "Allow: /p/",
      "Allow: /u/",
      "Allow: /contractors/",
      "Allow: /profile/",
      "Allow: /business/",
      "Allow: /community/",
      "Allow: /county/",
      "Allow: /homescout/",
      "Allow: /homescout/listings/",
      "Disallow: /api/",
      "Disallow: /admin/",
      "Disallow: /dashboard/",
      "Disallow: /settings/",
      "Disallow: /messages/",
      "Disallow: /scout/",
      "Disallow: /auth/",
      `Sitemap: ${baseUrl}/sitemap.xml`,
      "",
    ].join("\n")
  );
});

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);

    const today = new Date().toISOString().slice(0, 10);

    // Sitemap index: keep /sitemap.xml stable and delegate large URL sets.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-core.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-profiles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-homescout-counties.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-homescout-listings.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-core.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = new Date().toISOString().slice(0, 10);

    const urls = [
      { loc: `${baseUrl}/`, priority: "1.0", changefreq: "daily" },
      { loc: `${baseUrl}/direct-connect`, priority: "0.9", changefreq: "hourly" },
      { loc: `${baseUrl}/community`, priority: "0.8", changefreq: "hourly" },
      { loc: `${baseUrl}/exchange`, priority: "0.6", changefreq: "daily" },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating core sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-profiles.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);

    const profiles = await storage.listPublicProfilesForSitemap();

    const urls = profiles.map((profile) => {
      const lastmod = profile.updatedAt
        ? profile.updatedAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      return `
  <url>
    <loc>${baseUrl}/u/${encodeURIComponent(profile.slug)}</loc>
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
    console.error("Error generating profiles sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-homescout-listings.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);

    const listings = await storage.listActiveHomeScoutListingsForSitemap();

    const urls = listings.map((listing) => {
      const lastmod = listing.updatedAt
        ? listing.updatedAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      return `
  <url>
    <loc>${baseUrl}/homescout/listings/${encodeURIComponent(listing.id)}</loc>
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
    console.error("Error generating HomeScout listings sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-homescout-counties.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);

    const counties = await storage.listHomeScoutCountiesForSitemap();

    const urls = counties.map((row) => {
      const lastmod = row.updatedAt
        ? row.updatedAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const stateCode = String(row.stateCode || "").toUpperCase();
      const countyFips = String(row.countyFips || "");
      return `
  <url>
    <loc>${baseUrl}/homescout/${encodeURIComponent(stateCode)}/${encodeURIComponent(countyFips)}</loc>
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
    console.error("Error generating HomeScout counties sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

export { router as profilesRouter };
