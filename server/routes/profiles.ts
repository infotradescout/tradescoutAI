import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";
import { PRIMARY_TRADE_SLUGS, slugifyCountyName } from "../../shared/tradeSeo";
import { sql } from "drizzle-orm";

const router = Router();

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
  "/trade",
  "/datasets",
  "/datasets/trades",
  "/datasets/counties",
  "/datasets/cities",
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
  // Keep sitemap-core focused on canonical, intent-strong URLs.
  // Variant landing routes remain available, but are intentionally excluded from core sitemap
  // to avoid flooding Search Console with near-duplicate discovery candidates.
  return Array.from(new Set(CORE_STATIC_PATHS));
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

function buildAutoSeoMeta(args: {
  displayName: string;
  roleContext?: string | null;
  headline?: string | null;
  business?: { categories?: string[]; serviceAreas?: string[] } | null;
  servicesDescription?: string | null;
  seoMeta?: { title?: string; description?: string; imageUrl?: string } | null;
}) {
  const displayName = args.displayName.trim();
  const roleContext = String(args.roleContext || "").trim();
  const headline = String(args.headline || "").trim();
  const servicesDescription = String(args.servicesDescription || "").trim();
  const categories = Array.isArray(args.business?.categories)
    ? args.business?.categories
        .filter((c) => typeof c === "string" && c.trim().length > 0)
        .slice(0, 3)
    : [];
  const serviceAreaCount = Array.isArray(args.business?.serviceAreas)
    ? args.business?.serviceAreas.length
    : 0;

  const fallbackTitleParts = [displayName];
  if (roleContext) fallbackTitleParts.push(roleContext.replace(/_/g, " "));
  fallbackTitleParts.push("TradeScout");
  const fallbackTitle = fallbackTitleParts.join(" | ").slice(0, 120);

  const descriptionCandidates = [
    headline,
    servicesDescription,
    categories.length > 0
      ? `${displayName} serves ${categories.join(", ")} needs on TradeScout.`
      : "",
    serviceAreaCount > 0
      ? `${displayName} supports ${serviceAreaCount} service area${serviceAreaCount === 1 ? "" : "s"}.`
      : "",
    `${displayName} profile on TradeScout with protected Direct Connect contact.`,
  ].filter((value) => value && value.trim().length > 0);

  const fallbackDescription = descriptionCandidates.join(" ").slice(0, 320);

  const title =
    typeof args.seoMeta?.title === "string" && args.seoMeta.title.trim().length > 0
      ? args.seoMeta.title.trim().slice(0, 120)
      : fallbackTitle;
  const description =
    typeof args.seoMeta?.description === "string" && args.seoMeta.description.trim().length > 0
      ? args.seoMeta.description.trim().slice(0, 320)
      : fallbackDescription;
  const imageUrl =
    typeof args.seoMeta?.imageUrl === "string" && args.seoMeta.imageUrl.trim().length > 0
      ? args.seoMeta.imageUrl.trim().slice(0, 500)
      : undefined;

  return { title, description, imageUrl };
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
    res
      .status(500)
      .json({ message: "Failed to create profile", requestId: (req as any).requestId || null });
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
    res
      .status(500)
      .json({ message: "Failed to update profile", requestId: (req as any).requestId || null });
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
  const effectiveSeoMeta = buildAutoSeoMeta({
    displayName: profile.displayName,
    roleContext: profile.roleContext,
    headline: profile.headline,
    business: safeBusiness,
    servicesDescription: profile.servicesDescription,
    seoMeta: profile.seoMeta,
  });

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
      seoMeta: effectiveSeoMeta,
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
      "Allow: /trade/",
      "Allow: /city/",
      "Allow: /datasets/",
      "Allow: /best/",
      "Allow: /tradepartners/",
      "Allow: /homescout/",
      "Allow: /homescout/listings/",
      "Allow: /llms.txt",
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

router.get("/llms.txt", async (req, res) => {
  const baseUrl = getCanonicalBaseUrl(req);
  res.type("text/plain");
  res.send(
    [
      "TradeScout public web guidance for AI/LLM crawlers",
      "",
      "Canonical host:",
      `${baseUrl}`,
      "",
      "Primary public profile pattern:",
      `${baseUrl}/u/{slug}`,
      "",
      "Discoverability feeds:",
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-profiles.xml`,
      "",
      "Public profile constraints:",
      "- Contact is intentionally gated through Direct Connect.",
      "- Do not infer direct contact methods from profile pages.",
      "- Treat profile titles, descriptions, and structured data as canonical summary fields.",
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
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-counties.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trade-navigation.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trades.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trade-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-best-pages.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-recent-activity.xml</loc>
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

    // Profile sitemap (legacy-friendly): this file is commonly submitted directly in Search Console.
    // Keep it as a sitemap *index* that points to the concrete profile-like URL sets.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-u-profiles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-business-profiles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-businesses.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating profiles sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-u-profiles.xml", async (req, res) => {
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
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating user profiles sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-business-profiles.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Business profiles are stored on users.preferences for now (published presence).
    let businessProfiles: any[] = [];
    try {
      const maybe = await storage.listBusinessProfilesForSitemap();
      businessProfiles = Array.isArray(maybe) ? maybe : [];
    } catch (error) {
      console.warn("Business profiles sitemap fallback: failed to load business profiles", error);
      businessProfiles = [];
    }

    const urls = businessProfiles
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const slug = String((row as any).slug || "").trim();
        if (!slug) return null;
        return {
          loc: `${baseUrl}/business/${encodeURIComponent(slug)}`,
          lastmod: toYmd((row as any).updatedAt, today),
        };
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating business profiles sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

const DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE = 40_000;

router.get("/sitemap-directory-businesses.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    let total = 0;
    try {
      total = await storage.countActiveDirectoryBusinessesForSitemap();
    } catch (error) {
      console.warn("Directory businesses sitemap fallback: failed to count businesses", error);
      total = 0;
    }

    const pages = Math.max(1, Math.ceil(total / DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-businesses-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating directory businesses sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-businesses-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE;

    let businesses: any[] = [];
    try {
      const maybe = await storage.listActiveDirectoryBusinessesForSitemap({
        limit: DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE,
        offset,
      });
      businesses = Array.isArray(maybe) ? maybe : [];
    } catch (error) {
      console.warn("Directory businesses sitemap fallback: failed to load businesses", error);
      businesses = [];
    }

    const urls = businesses
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const slug = String((row as any).slug || "").trim();
        if (!slug) return null;
        return {
          loc: `${baseUrl}/business/${encodeURIComponent(slug)}`,
          lastmod: toYmd((row as any).updatedAt, today),
        };
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory businesses sitemap page:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

const DIRECTORY_TRADE_SITEMAP_PAGE_SIZE = 40_000;
const DIRECTORY_CITY_SITEMAP_PAGE_SIZE = 40_000;
let directoryCountiesCache: {
  expiresAt: number;
  rows: Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>;
} | null = null;
let directoryCitiesCache: {
  expiresAt: number;
  rows: Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>;
} | null = null;

export function invalidateDirectorySitemapCaches() {
  directoryCountiesCache = null;
  directoryCitiesCache = null;
}

async function getDirectoryCountiesForSitemapCached(): Promise<
  Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>
> {
  const now = Date.now();
  if (directoryCountiesCache && directoryCountiesCache.expiresAt > now) {
    return directoryCountiesCache.rows;
  }
  const rows = await storage.listDirectoryCountiesForSitemap({ limit: 50_000, offset: 0 });
  const normalized = Array.isArray(rows) ? rows : [];
  directoryCountiesCache = {
    expiresAt: now + 30 * 60 * 1000,
    rows: normalized,
  };
  return normalized;
}

async function getDirectoryCitiesForSitemapCached(): Promise<
  Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>
> {
  const now = Date.now();
  if (directoryCitiesCache && directoryCitiesCache.expiresAt > now) {
    return directoryCitiesCache.rows;
  }
  // City slugs are derived from directory businesses; keep a generous cap to avoid memory blow-ups.
  const rows = await storage.listDirectoryCitiesForSitemap({ limit: 100_000, offset: 0 });
  const normalized = Array.isArray(rows) ? rows : [];
  directoryCitiesCache = {
    expiresAt: now + 30 * 60 * 1000,
    rows: normalized,
  };
  return normalized;
}

router.get("/sitemap-directory-counties.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const countiesRows = await getDirectoryCountiesForSitemapCached();

    const urls = countiesRows.map((row) => {
      const stateCode = String(row.stateCode || "").toUpperCase();
      const countySlug = slugifyCountyName(
        String(row.name || "")
          .replace(/\s+County$/i, "")
          .trim()
      );
      return {
        loc: `${baseUrl}/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
          countySlug
        )}`,
        lastmod: toYmd(row.updatedAt, today),
      };
    });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory counties sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-trade-navigation.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const navigationRows = (await db.execute(sql`
      with trade_state_pairs as (
        select distinct trade_slug, state_code
        from ts_seo_trade_county_pages
        where coalesce(trade_slug, '') <> '' and coalesce(state_code, '') <> ''
        union
        select distinct trade_slug, state_code
        from ts_seo_trade_city_pages
        where coalesce(trade_slug, '') <> '' and coalesce(state_code, '') <> ''
      )
      select trade_slug, state_code
      from trade_state_pairs
      order by trade_slug asc, state_code asc;
    `)) as any;

    const tradeStates = Array.isArray(navigationRows?.rows) ? navigationRows.rows : [];
    const activeTradeSlugs = Array.from<string>(
      new Set<string>(
        tradeStates
          .map((row: any) => String(row.trade_slug || "").trim())
          .filter((tradeSlug: string) => tradeSlug.length > 0)
      )
    );

    const urls = [
      { loc: `${baseUrl}/trade`, lastmod: today },
      ...(activeTradeSlugs.length > 0 ? activeTradeSlugs : PRIMARY_TRADE_SLUGS).map(
        (tradeSlug) => ({
          loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}`,
          lastmod: today,
        })
      ),
      ...tradeStates.map((row: any) => ({
        loc: `${baseUrl}/trade/${encodeURIComponent(String(row.trade_slug || "").trim())}/${encodeURIComponent(
          String(row.state_code || "")
            .trim()
            .toLowerCase()
        )}`,
        lastmod: today,
      })),
    ];

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating trade navigation sitemap:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-trades.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Only include trade+county pages that have at least one recent, public business (snapshot job writes these).
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_county_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trades-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating directory trades sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-trades-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;

    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;
    const result = (await db.execute(sql`
      select trade_slug, state_code, county_slug, lastmod
      from ts_seo_trade_county_pages
      order by trade_slug asc, state_code asc, county_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const countySlug = String(row.county_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !countySlug) return null;
        return {
          loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/${encodeURIComponent(countySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory trades sitemap page:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-cities.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let total = 0;
    try {
      total = await storage.countDirectoryCitiesForSitemap();
    } catch (error) {
      console.warn("Directory cities sitemap fallback: failed to count cities", error);
      total = 0;
    }

    const pages = Math.max(1, Math.ceil(total / DIRECTORY_CITY_SITEMAP_PAGE_SIZE));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-cities-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating directory cities sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-cities-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_CITY_SITEMAP_PAGE_SIZE;

    let cities: any[] = [];
    try {
      const maybe = await storage.listDirectoryCitiesForSitemap({
        limit: DIRECTORY_CITY_SITEMAP_PAGE_SIZE,
        offset,
      });
      cities = Array.isArray(maybe) ? maybe : [];
    } catch (error) {
      console.warn("Directory cities sitemap fallback: failed to load cities", error);
      cities = [];
    }

    const urls = cities
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const stateCode = String((row as any).stateCode || "").toUpperCase();
        const citySlug = String((row as any).citySlug || "")
          .trim()
          .toLowerCase();
        if (!stateCode || !citySlug) return null;
        return {
          loc: `${baseUrl}/city/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
            citySlug
          )}`,
          lastmod: toYmd((row as any).updatedAt, today),
        };
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory cities sitemap page:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-trade-cities.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Only include trade+city pages that have at least one recent, public business (snapshot job writes these).
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_city_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trade-cities-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating trade-cities sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-directory-trade-cities-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;

    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;
    const result = (await db.execute(sql`
      select trade_slug, state_code, city_slug, lastmod
      from ts_seo_trade_city_pages
      order by trade_slug asc, state_code asc, city_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const citySlug = String(row.city_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !citySlug) return null;
        return {
          loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/city/${encodeURIComponent(citySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating trade-cities sitemap page:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-best-pages.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-counties.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating best pages sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-best-trade-counties.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_county_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-counties-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating best trade counties sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-best-trade-counties-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;

    const result = (await db.execute(sql`
      select trade_slug, state_code, county_slug, lastmod
      from ts_seo_trade_county_pages
      order by trade_slug asc, state_code asc, county_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const countySlug = String(row.county_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !countySlug) return null;
        return {
          loc: `${baseUrl}/best/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/${encodeURIComponent(countySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating best trade counties sitemap page:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-best-trade-cities.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_city_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-cities-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating best trade cities sitemap index:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-best-trade-cities-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;

    const result = (await db.execute(sql`
      select trade_slug, state_code, city_slug, lastmod
      from ts_seo_trade_city_pages
      order by trade_slug asc, state_code asc, city_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const citySlug = String(row.city_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !citySlug) return null;
        return {
          loc: `${baseUrl}/best/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/city/${encodeURIComponent(citySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating best trade cities sitemap page:", error);
    res.status(500).send("Failed to generate sitemap");
  }
});

router.get("/sitemap-recent-activity.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    const countyRows = (await db.execute(sql`
      select c.name as county_name, c.state_code as state_code, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      join counties c on c.id = pa.county_id
      where pa.active_status = true and pa.expires_at > now()
      group by c.name, c.state_code;
    `)) as any;

    const cityRows = (await db.execute(sql`
      select pa.state_code as state_code, pa.city_slug as city_slug, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      where pa.active_status = true and pa.expires_at > now() and coalesce(pa.city_slug, '') <> ''
      group by pa.state_code, pa.city_slug;
    `)) as any;

    const tradeCountyRows = (await db.execute(sql`
      select pa.trade_slug as trade_slug, c.name as county_name, c.state_code as state_code, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      join counties c on c.id = pa.county_id
      where pa.active_status = true and pa.expires_at > now() and coalesce(pa.trade_slug, '') <> ''
      group by pa.trade_slug, c.name, c.state_code;
    `)) as any;

    const tradeCityRows = (await db.execute(sql`
      select pa.trade_slug as trade_slug, pa.state_code as state_code, pa.city_slug as city_slug, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      where pa.active_status = true and pa.expires_at > now()
        and coalesce(pa.trade_slug, '') <> ''
        and coalesce(pa.city_slug, '') <> ''
      group by pa.trade_slug, pa.state_code, pa.city_slug;
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = [];

    for (const row of countyRows?.rows || []) {
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const countyName = String(row.county_name || "").trim();
      if (!stateCode || !countyName) continue;
      const countySlug = slugifyCountyName(
        countyName.replace(/\s+County$/i, "").trim() || countyName
      );
      urls.push({
        loc: `${baseUrl}/county/${encodeURIComponent(stateCode)}/${encodeURIComponent(countySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    for (const row of cityRows?.rows || []) {
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const citySlug = String(row.city_slug || "")
        .trim()
        .toLowerCase();
      if (!stateCode || !citySlug) continue;
      urls.push({
        loc: `${baseUrl}/city/${encodeURIComponent(stateCode)}/${encodeURIComponent(citySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    for (const row of tradeCountyRows?.rows || []) {
      const tradeSlug = String(row.trade_slug || "").trim();
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const countyName = String(row.county_name || "").trim();
      if (!tradeSlug || !stateCode || !countyName) continue;
      const countySlug = slugifyCountyName(
        countyName.replace(/\s+County$/i, "").trim() || countyName
      );
      urls.push({
        loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
          stateCode
        )}/${encodeURIComponent(countySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    for (const row of tradeCityRows?.rows || []) {
      const tradeSlug = String(row.trade_slug || "").trim();
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const citySlug = String(row.city_slug || "")
        .trim()
        .toLowerCase();
      if (!tradeSlug || !stateCode || !citySlug) continue;
      urls.push({
        loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
          stateCode
        )}/city/${encodeURIComponent(citySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating recent activity sitemap:", error);
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
