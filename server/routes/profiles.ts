import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { COMPREHENSIVE_TRADES } from "../../shared/trades-data";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";

const router = Router();

const LANDING_AUDIENCE_KEYS = [
  "contractor",
  "homeowner",
  "realtor",
  "hoa",
  "property-manager",
  "lender",
  "insurance-agent",
  "supplier",
  "affiliate",
] as const;

const CORE_STATIC_PATHS = [
  "/",
  "/landing",
  "/direct-connect",
  "/community",
  "/community-feed",
  "/exchange",
  "/trade-deals",
  "/contractors/apply",
  "/groups",
  "/county-directory",
  "/county-hub",
  "/maps",
  "/help",
  "/help/how-tradescout-works",
  "/how-it-works",
  "/trust-model",
  "/direct-connect-info",
  "/compare/angi",
  "/compare/homeadvisor",
  "/pricing",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/privacy-request",
  "/compliance",
  "/leaderboard",
  "/foundation",
  "/resource-center",
  "/membership-portal",
  "/training-center",
  "/affiliate",
  "/vehicle-marketplace",
  "/real-estate-marketplace",
  "/handmade-marketplace",
];

const COUNTY_SLUG_PATTERN = /^[a-z0-9-]+$/;

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function toYmd(value: unknown, fallback = getTodayYmd()): string {
  if (!value) return fallback;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return value.toISOString().slice(0, 10);
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

function isValidCountySlug(value: unknown): value is string {
  return typeof value === "string" && COUNTY_SLUG_PATTERN.test(value) && value.length <= 80;
}

function slugifyCategory(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildUrlSet(
  urlEntries: Array<{ loc: string; lastmod: string; changefreq?: string; priority?: string }>
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries
  .map((entry) => {
    const optionalChangefreq = entry.changefreq
      ? `
    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`
      : "";
    const optionalPriority = entry.priority
      ? `
    <priority>${xmlEscape(entry.priority)}</priority>`
      : "";

    return `
  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>${optionalChangefreq}${optionalPriority}
  </url>`;
  })
  .join("\n")}
</urlset>`;
}

function buildRuntimeCorePaths(): string[] {
  const slugs = Array.from(
    new Set(
      (COMPREHENSIVE_TRADES || [])
        .map((trade) => String((trade as any)?.slug || "").trim())
        .filter((slug) => slug.length > 0)
    )
  );
  const all = [...CORE_STATIC_PATHS];

  for (const slug of slugs) {
    all.push(`/landing/${slug}`);
  }
  for (const audience of LANDING_AUDIENCE_KEYS) {
    all.push(`/landing/${audience}`);
    for (const slug of slugs) {
      all.push(`/landing/${audience}-${slug}`);
    }
  }

  return Array.from(new Set(all));
}

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

function sanitizePublicProfileBookingConfig(raw: unknown) {
  const source = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const enabled = source.enabled === true;
  const paidBookings = source.paidBookings === true;
  const calendarVisibility = source.calendarVisibility === "private" ? "private" : "public";
  const bookingPriceUsd = Number(source.bookingPriceUsd);
  const safeBookingPriceUsd =
    Number.isFinite(bookingPriceUsd) && bookingPriceUsd >= 0
      ? Number(bookingPriceUsd.toFixed(2))
      : 0;
  const timezone =
    typeof source.timezone === "string" && source.timezone.trim().length > 0
      ? source.timezone.trim()
      : "America/Chicago";
  const pricingTableEnabled = source.pricingTableEnabled === true;

  const slots = Array.isArray(source.slots)
    ? source.slots
        .filter((slot) => slot && typeof slot === "object")
        .map((slot: any) => ({
          id:
            typeof slot.id === "string" && slot.id.trim().length > 0
              ? slot.id.trim()
              : Math.random().toString(36).slice(2),
          dayOfWeek:
            typeof slot.dayOfWeek === "number" && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6
              ? slot.dayOfWeek
              : 0,
          startTime:
            typeof slot.startTime === "string" && /^\d{2}:\d{2}$/.test(slot.startTime)
              ? slot.startTime
              : "09:00",
          endTime:
            typeof slot.endTime === "string" && /^\d{2}:\d{2}$/.test(slot.endTime)
              ? slot.endTime
              : "17:00",
          label: typeof slot.label === "string" ? slot.label.trim().slice(0, 80) : "",
          active: slot.active !== false,
        }))
    : [];

  const pricingRows = Array.isArray(source.pricingRows)
    ? source.pricingRows
        .filter((row) => row && typeof row === "object")
        .map((row: any) => ({
          id:
            typeof row.id === "string" && row.id.trim().length > 0
              ? row.id.trim()
              : Math.random().toString(36).slice(2),
          name: typeof row.name === "string" ? row.name.trim().slice(0, 80) : "",
          priceLabel: typeof row.priceLabel === "string" ? row.priceLabel.trim().slice(0, 40) : "",
          description:
            typeof row.description === "string" ? row.description.trim().slice(0, 240) : "",
        }))
        .filter((row) => row.name.length > 0 && row.priceLabel.length > 0)
    : [];

  return {
    enabled,
    paidBookings,
    bookingPriceUsd: safeBookingPriceUsd,
    calendarVisibility,
    timezone,
    slots: calendarVisibility === "public" ? slots : [],
    pricingTableEnabled,
    pricingRows,
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

// Public search for published profiles (used by Scout auto-route).
// NOTE: This MUST appear before "/api/profiles/:id" or it will be captured
// by the param route and incorrectly require auth.
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
      profileBooking: sanitizePublicProfileBookingConfig(profile.profileBooking),
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
      "Allow: /tradepartners/",
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
    const today = getTodayYmd();

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
  <sitemap>
    <loc>${baseUrl}/sitemap-tradepartners.xml</loc>
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
    const today = getTodayYmd();
    const urls = buildRuntimeCorePaths().map((path) => {
      if (path === "/") {
        return { loc: `${baseUrl}/`, lastmod: today, priority: "1.0", changefreq: "daily" };
      }
      const isLanding = path.startsWith("/landing/");
      const isPrimaryRoute =
        path === "/landing" || path === "/direct-connect" || path === "/community";
      return {
        loc: `${baseUrl}${path}`,
        lastmod: today,
        priority: isPrimaryRoute ? "0.9" : isLanding ? "0.8" : "0.7",
        changefreq: isLanding ? "weekly" : "daily",
      };
    });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating core sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-profiles.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let profiles: any[] = [];
    try {
      const maybeProfiles = await storage.listPublicProfilesForSitemap();
      profiles = Array.isArray(maybeProfiles) ? maybeProfiles : [];
    } catch (error) {
      console.warn("Profiles sitemap fallback: failed to load profiles", error);
      profiles = [];
    }

    const urls = profiles
      .filter((profile) => profile && typeof profile === "object")
      .map((profile) => {
        const slug = String(profile.slug || "").trim();
        if (!slug) return null;
        return {
          loc: `${baseUrl}/u/${encodeURIComponent(slug)}`,
          lastmod: toYmd(profile.updatedAt, today),
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(urls.filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry)))
    );
  } catch (error: any) {
    console.error("Error generating profiles sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-homescout-listings.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let listings: any[] = [];
    try {
      const maybeListings = await storage.listActiveHomeScoutListingsForSitemap();
      listings = Array.isArray(maybeListings) ? maybeListings : [];
    } catch (error) {
      console.warn("HomeScout listings sitemap fallback: failed to load listings", error);
      listings = [];
    }

    const urls = listings
      .filter((listing) => listing && typeof listing === "object")
      .map((listing) => {
        const id = String(listing.id || "").trim();
        if (!id) return null;
        return {
          loc: `${baseUrl}/homescout/listings/${encodeURIComponent(id)}`,
          lastmod: toYmd(listing.updatedAt, today),
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(urls.filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry)))
    );
  } catch (error: any) {
    console.error("Error generating HomeScout listings sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-homescout-counties.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let counties: any[] = [];
    try {
      const maybeCounties = await storage.listHomeScoutCountiesForSitemap();
      counties = Array.isArray(maybeCounties) ? maybeCounties : [];
    } catch (error) {
      console.warn("HomeScout counties sitemap fallback: failed to load counties", error);
      counties = [];
    }

    const urls = counties
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const stateCode = String(row.stateCode || "").toUpperCase();
        const countyFips = String(row.countyFips || "").trim();
        if (!stateCode || !countyFips) return null;
        return {
          loc: `${baseUrl}/homescout/${encodeURIComponent(stateCode)}/${encodeURIComponent(countyFips)}`,
          lastmod: toYmd(row.updatedAt, today),
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(urls.filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry)))
    );
  } catch (error: any) {
    console.error("Error generating HomeScout counties sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-tradepartners.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    let counties: Array<{
      countySlug: string;
      updatedAt: Date | string | null;
      allowedCategories: string[];
    }> = [];
    try {
      await ensureTradePartnerTables();
      const maybeCounties = await storage.listTradePartnerCountiesForSitemap();
      counties = Array.isArray(maybeCounties) ? maybeCounties : [];
    } catch (error) {
      console.warn("Trade Partner sitemap fallback: failed to load county pages", error);
      counties = [];
    }

    const urls = counties
      .map((row) => ({
        countySlug: String(row?.countySlug || "")
          .trim()
          .toLowerCase(),
        updatedAt: row?.updatedAt ?? null,
        allowedCategories: Array.isArray(row?.allowedCategories) ? row.allowedCategories : [],
      }))
      .filter((row) => isValidCountySlug(row.countySlug))
      .flatMap((row) => {
        const countyUrl = {
          loc: `${baseUrl}/tradepartners/${encodeURIComponent(row.countySlug)}`,
          lastmod: toYmd(row.updatedAt, today),
        };

        const categoryUrls = row.allowedCategories
          .map((category) => slugifyCategory(category))
          .filter((categorySlug) => categorySlug.length > 0)
          .map((categorySlug) => ({
            loc: `${baseUrl}/tradepartners/${encodeURIComponent(row.countySlug)}/${encodeURIComponent(categorySlug)}`,
            lastmod: toYmd(row.updatedAt, today),
          }));

        return [countyUrl, ...categoryUrls];
      });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating Trade Partner sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

export { router as profilesRouter };
