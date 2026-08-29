/**
 * Business Profile Routes
 * PHASE 3d-C: Published Presence Surface
 *
 * Endpoints for publishing and managing business profiles.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { affiliateAccounts, profiles, users } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { resolveTxt } from "dns/promises";
import { writeProfileDomainPreferences } from "../profileDomainPreferenceWriter";
import {
  buildPublicBusinessListingCards,
  type PublicBusinessListingCard,
} from "../../shared/publicBusinessListing";
import type {
  PublishProfilePayload,
  UpdateProfilePayload,
  BusinessProfile,
} from "../../shared/businessProfile";
import { normalizeProfileBookingPrefs } from "../services/profileBookingService";
import { resolveCanonicalBusinessProfileRoute } from "../services/canonicalBusinessProfileRoute";
import { notifyIndexNow } from "../services/indexNowService";
import {
  collectBusinessIndexNowUrls,
  combineIndexNowChangeUrls,
} from "../services/indexNowPublicationEvents";

function sanitizePublicCtaConfig(ctaConfig: unknown) {
  const safe = (ctaConfig && typeof ctaConfig === "object" ? ctaConfig : {}) as Record<string, any>;
  const sanitize = (cta: unknown) => {
    if (!cta || typeof cta !== "object") return null;
    const source = cta as Record<string, any>;
    const kind = typeof source.kind === "string" ? source.kind : "direct_connect";
    const label =
      typeof source.label === "string" ? source.label.trim().slice(0, 80) : "Contact on TradeScout";
    return { label, kind, value: null, requiresTradeScoutAccount: true, route: "/direct-connect" };
  };
  return { primary: sanitize(safe.primary), secondary: sanitize(safe.secondary) };
}

function sanitizePublicBookingConfig(raw: unknown) {
  const source = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const calendarVisibility = source.calendarVisibility === "private" ? "private" : "public";
  return {
    enabled: source.enabled === true,
    paidBookings: source.paidBookings === true,
    bookingPriceUsd:
      Number.isFinite(Number(source.bookingPriceUsd)) && Number(source.bookingPriceUsd) >= 0
        ? Number(Number(source.bookingPriceUsd).toFixed(2))
        : 0,
    calendarVisibility,
    timezone:
      typeof source.timezone === "string" && source.timezone.trim().length > 0
        ? source.timezone.trim()
        : "America/Chicago",
    slots:
      calendarVisibility === "public" && Array.isArray(source.slots)
        ? source.slots.map((slot: any) => ({
            id: String(slot?.id || ""),
            dayOfWeek: Number(slot?.dayOfWeek || 0),
            startTime: String(slot?.startTime || "09:00"),
            endTime: String(slot?.endTime || "17:00"),
            label: typeof slot?.label === "string" ? slot.label.slice(0, 80) : "",
            active: slot?.active !== false,
          }))
        : [],
    pricingTableEnabled: source.pricingTableEnabled === true,
    pricingRows: Array.isArray(source.pricingRows)
      ? source.pricingRows
          .map((row: any) => ({
            id: String(row?.id || ""),
            name: String(row?.name || "").slice(0, 80),
            priceLabel: String(row?.priceLabel || "").slice(0, 40),
            description: typeof row?.description === "string" ? row.description.slice(0, 240) : "",
          }))
          .filter((row: any) => row.name && row.priceLabel)
      : [],
  };
}

function sanitizePublicContentBlocks(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((block) => block && typeof block === "object")
    .map((block: any) => ({
      id: String(block?.id || ""),
      type: String(block?.type || "text"),
      title: typeof block?.title === "string" ? block.title.slice(0, 120) : null,
      body: typeof block?.body === "string" ? block.body.slice(0, 4000) : null,
      imageUrl: typeof block?.imageUrl === "string" ? block.imageUrl : null,
    }));
}

function buildDefaultSections() {
  return {
    about: true,
    rolesAndBadges: true,
    stats: true,
    services: true,
    marketplaceListings: true,
    reviews: true,
    communityActivity: false,
    contactCard: true,
  };
}

function buildDefaultTheme() {
  return { preset: "default", customColors: null };
}

function buildDefaultSeoMeta(profile: Partial<BusinessProfile>) {
  const name = String(profile.name || "TradeScout Business").trim();
  const place = [profile.countyName, profile.stateCode].filter(Boolean).join(", ");
  const title = place ? `${name} | ${place} | TradeScout` : `${name} | TradeScout`;
  const description =
    String(profile.description || profile.headline || "").trim() || `View ${name} on TradeScout.`;
  return { title: title.slice(0, 120), description: description.slice(0, 300), imageUrl: null };
}

interface AuthedRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  } & Express.User;
}

const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

function normalizeDomainInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (value.includes("://")) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      value = parsed.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  value = value.split("/")[0].split(":")[0].trim();
  value = value.replace(/^www\./, "").replace(/\.$/, "");

  if (!value || value === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    return null;
  }

  if (!DOMAIN_REGEX.test(value)) {
    return null;
  }

  return value;
}

function createVerificationToken(): string {
  return `tsv-${randomBytes(16).toString("hex")}`;
}

function alternateDomainHost(domain: string): string {
  return domain.startsWith("www.") ? domain.slice(4) : `www.${domain}`;
}

function domainIdentityLockKey(domain: string): string {
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}

async function findDomainConflict(
  domain: string,
  userId: string,
  profileId: string,
  database: any = db
): Promise<boolean> {
  const alternateDomain = alternateDomainHost(domain);
  const profileConflicts = await database
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        sql`${profiles.id} <> ${profileId}`,
        sql`lower(COALESCE((${profiles.seoMeta} ->> 'customDomain'), '')) IN (${domain}, ${alternateDomain})`
      )
    )
    .limit(2);

  if (profileConflicts.length > 0) return true;

  const businessConflicts = await database
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${users.id} <> ${userId}`,
        sql`lower(COALESCE(((${users.preferences} -> 'provisional' -> 'profileDraft' ->> 'customDomain')), '')) IN (${domain}, ${alternateDomain})`,
        sql`COALESCE(((${users.preferences} -> 'provisional' -> 'profileDraft' -> 'customDomainVerification' ->> 'state')), 'unverified') = 'verified'`
      )
    )
    .limit(2);

  if (businessConflicts.length > 0) return true;

  const affiliateConflicts = await database
    .select({ id: affiliateAccounts.id })
    .from(affiliateAccounts)
    .where(
      sql`lower(COALESCE(${affiliateAccounts.customDomain}, '')) IN (${domain}, ${alternateDomain})`
    )
    .limit(2);

  return affiliateConflicts.length > 0;
}

function domainRouteError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function buildPreferencesWithDomainState(args: {
  preferences: unknown;
  customDomain: string | null;
  verification: BusinessProfile["customDomainVerification"];
}) {
  const preferences = {
    ...((args.preferences && typeof args.preferences === "object" ? args.preferences : {}) as any),
  };
  const provisional = {
    ...(preferences.provisional && typeof preferences.provisional === "object"
      ? preferences.provisional
      : {}),
  };
  const profileDraft = {
    ...(provisional.profileDraft && typeof provisional.profileDraft === "object"
      ? provisional.profileDraft
      : {}),
    customDomain: args.customDomain,
    customDomainVerification: args.verification,
    capturedAt: new Date().toISOString(),
  };

  provisional.profileDraft = profileDraft;
  preferences.provisional = provisional;
  return preferences;
}

function readLegacyBusinessDomainDraft(preferences: unknown): {
  candidateDomain: string;
  verification: BusinessProfile["customDomainVerification"] | null;
} {
  const draft = (preferences as any)?.provisional?.profileDraft;
  return {
    candidateDomain: String(draft?.customDomain || "")
      .trim()
      .toLowerCase(),
    verification:
      draft?.customDomainVerification && typeof draft.customDomainVerification === "object"
        ? draft.customDomainVerification
        : null,
  };
}

function readProfileDomainDraft(
  preferences: unknown,
  profileId: string
): {
  candidateDomain: string;
  verification: BusinessProfile["customDomainVerification"] | null;
} {
  const states = (preferences as any)?.profileDomainStates;
  const state = states && typeof states === "object" ? states[profileId] : null;
  if (state && typeof state === "object") {
    return {
      candidateDomain: String(state.candidateDomain || "")
        .trim()
        .toLowerCase(),
      verification:
        state.verification && typeof state.verification === "object" ? state.verification : null,
    };
  }

  const legacy = readLegacyBusinessDomainDraft(preferences);
  return String(legacy.verification?.profileId || "").trim() === profileId
    ? legacy
    : { candidateDomain: "", verification: null };
}

function buildPreferencesWithProfileDomainState(args: {
  preferences: unknown;
  profileId: string;
  candidateDomain: string | null;
  verification: BusinessProfile["customDomainVerification"];
}) {
  const preferences = {
    ...((args.preferences && typeof args.preferences === "object" ? args.preferences : {}) as any),
  };
  const currentStates =
    preferences.profileDomainStates && typeof preferences.profileDomainStates === "object"
      ? preferences.profileDomainStates
      : {};
  const nextStates = { ...currentStates };

  if (args.candidateDomain && args.verification) {
    nextStates[args.profileId] = {
      candidateDomain: args.candidateDomain,
      verification: args.verification,
      capturedAt: new Date().toISOString(),
    };
  } else {
    delete nextStates[args.profileId];
  }

  preferences.profileDomainStates = nextStates;
  return preferences;
}

function activeProfileDomain(profile: { seoMeta?: unknown }): string {
  return String((profile.seoMeta as any)?.customDomain || "")
    .trim()
    .toLowerCase();
}

function profileDomainStatus(
  profileId: string,
  profile: { seoMeta?: unknown },
  preferences: unknown
) {
  const draft = readProfileDomainDraft(preferences, profileId);
  const verificationProfileId = String(draft.verification?.profileId || "").trim();
  const ownsCurrentDraft = verificationProfileId === profileId;
  return {
    profileId,
    activeDomain: activeProfileDomain(profile) || null,
    candidateDomain: ownsCurrentDraft ? draft.candidateDomain || null : null,
    verification: ownsCurrentDraft ? draft.verification : null,
  };
}

/**
 * Slugify helper: businessName || userName → URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces/hyphens
    .replace(/[\s_-]+/g, "-") // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Ensure slug uniqueness by appending random suffix if needed
 */
async function ensureUniqueSlug(baseSlug: string, userId: string): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const existing = await storage.getBusinessProfileBySlug(slug);
    if (!existing || existing.userId === userId) {
      return slug;
    }
    // Append random 4-char suffix
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${baseSlug}-${suffix}`;
    attempt++;
  }

  // Fallback: timestamp-based suffix
  return `${baseSlug}-${Date.now()}`;
}

export function registerBusinessProfileRoutes(app: Express) {
  const isBusinessDiscoverable = (user: any): boolean => {
    if (!user) return false;
    const verificationStatus = String(user.verificationStatus || "")
      .trim()
      .toLowerCase();
    return user.verifiedBadge === true || verificationStatus === "approved";
  };

  /**
   * POST /api/business-profile/publish
   * Publish profileDraft → BusinessProfile (creates or updates)
   */
  app.post(
    "/api/business-profile/publish",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const payload = req.body as PublishProfilePayload;

        if (!payload.name || !payload.countyFips || !payload.stateCode) {
          return res.status(400).json({
            message: "name, countyFips, and stateCode are required",
          });
        }

        // Generate slug
        const baseSlug = slugify(payload.name);
        const slug = await ensureUniqueSlug(baseSlug, userId);

        const [ownerUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const discoveryUnlocked = isBusinessDiscoverable(ownerUser);

        // Check if user already has a published profile
        const existing = await storage.getBusinessProfileByUserId(userId);
        const beforeUrls = collectBusinessIndexNowUrls(existing, discoveryUnlocked);
        const requestedBookingConfig = payload.bookingConfig ?? existing?.bookingConfig ?? null;
        const normalizedBookingConfig = requestedBookingConfig
          ? normalizeProfileBookingPrefs(requestedBookingConfig)
          : null;
        if (normalizedBookingConfig?.paidBookings && normalizedBookingConfig.bookingPriceUsd <= 0) {
          return res.status(400).json({ message: "A booking deposit must be greater than zero" });
        }

        const now = new Date().toISOString();

        const profileData: BusinessProfile = {
          id: existing?.id || crypto.randomUUID(),
          userId,
          slug,
          name: payload.name,
          description: payload.description || null,
          countyFips: payload.countyFips,
          countyName: payload.countyName || null,
          city: payload.city || null,
          address: payload.address || null,
          zipCode: payload.zipCode || null,
          stateCode: payload.stateCode,
          serviceAreas: payload.serviceAreas || [payload.countyFips],
          website: payload.website || null,
          seoMeta:
            payload.seoMeta ||
            existing?.seoMeta ||
            buildDefaultSeoMeta({
              name: payload.name,
              description: payload.description || null,
              countyName: payload.countyName || null,
              stateCode: payload.stateCode,
            }),
          ctaConfig: payload.ctaConfig || existing?.ctaConfig || null,
          contentBlocks: payload.contentBlocks || existing?.contentBlocks || [],
          profileSections:
            payload.profileSections || existing?.profileSections || buildDefaultSections(),
          theme: payload.theme || existing?.theme || buildDefaultTheme(),
          bookingConfig: normalizedBookingConfig,
          visibility:
            payload.visibility === "public" && discoveryUnlocked
              ? "public"
              : existing?.visibility || "private",
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          publishedAt: existing?.publishedAt || now,
        };

        const savedProfile = await storage.saveBusinessProfile(profileData);
        const afterUrls = collectBusinessIndexNowUrls(savedProfile, discoveryUnlocked);
        notifyIndexNow(combineIndexNowChangeUrls(beforeUrls, afterUrls));

        // Update user record with slug for easy reference
        await db.update(users).set({ businessSlug: slug }).where(eq(users.id, userId));

        res.json({
          success: true,
          profile: savedProfile,
          slug,
          discoverabilityLocked: !discoveryUnlocked,
          discoverabilityReason: !discoveryUnlocked
            ? "Complete verification to make your business discoverable in public search and browsing."
            : null,
        });
      } catch (error: any) {
        console.error("Error publishing business profile:", error);
        res.status(500).json({
          message: "Failed to publish profile",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  /**
   * GET /api/business-profile/slug/:slug
   * Fetch a published business profile by slug (public endpoint)
   */
  app.get("/api/business-profile/slug/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const profile = await storage.getBusinessProfileBySlug(slug);

      if (!profile || profile.visibility !== "public") {
        return res.status(404).json({ message: "Profile not found" });
      }
      const [ownerUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, profile.userId))
        .limit(1);
      if (!isBusinessDiscoverable(ownerUser)) {
        return res.status(404).json({ message: "Profile not found" });
      }
      let canonicalProfile: Awaited<ReturnType<typeof resolveCanonicalBusinessProfileRoute>> = null;
      try {
        canonicalProfile = await resolveCanonicalBusinessProfileRoute(slug);
      } catch (canonicalRouteError) {
        console.error("Error resolving canonical public profile route:", canonicalRouteError);
      }

      // Resolve the owner's active Exchange catalog without exposing the
      // private owner/account ID to the browser. Listing detail pages retain
      // their existing approval, trust, and protected-contact behavior.
      let marketplaceListings: PublicBusinessListingCard[] = [];
      try {
        const [ownerListings, marketplaceCategories] = await Promise.all([
          storage.getMarketplaceListings({
            sellerId: profile.userId,
            status: "active",
            sortBy: "date_desc",
            limit: 6,
            offset: 0,
          }),
          storage.getMarketplaceCategories(),
        ]);
        marketplaceListings = buildPublicBusinessListingCards({
          listings: ownerListings,
          categories: marketplaceCategories,
        });
      } catch (listingError) {
        console.error("Error loading public business profile listings:", listingError);
      }

      // Public-safe view: do not expose internal userId or direct-contact vectors.
      // All contact must remain intent-gated through Scout.
      res.json({
        id: profile.id,
        slug: profile.slug,
        name: profile.name,
        headline: profile.headline || null,
        description: profile.description,
        services: profile.services || [],
        countyFips: profile.countyFips,
        countyName: profile.countyName,
        city: profile.city,
        stateCode: profile.stateCode,
        serviceAreas: profile.serviceAreas,
        seoMeta: profile.seoMeta || buildDefaultSeoMeta(profile),
        ctaConfig: sanitizePublicCtaConfig(profile.ctaConfig),
        contentBlocks: sanitizePublicContentBlocks(profile.contentBlocks),
        profileSections: profile.profileSections || buildDefaultSections(),
        theme: profile.theme || buildDefaultTheme(),
        bookingConfig: sanitizePublicBookingConfig(profile.bookingConfig),
        marketplaceListings,
        canonicalProfilePath: canonicalProfile?.path || null,
        visibility: profile.visibility,
        verificationStatus: profile.verificationStatus || null,
        addressVerified: profile.addressVerified ?? false,
        cvsScore: profile.cvsScore ?? null,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        publishedAt: profile.publishedAt,
      });
    } catch (error: any) {
      console.error("Error fetching business profile by slug:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch profile", requestId: (req as any).requestId || null });
    }
  });

  /**
   * GET /api/business-profile/me
   * Fetch the authenticated user's published business profile
   */
  app.get("/api/business-profile/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthedRequest).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const profile = await storage.getBusinessProfileByUserId(userId);

      if (!profile) {
        return res.status(404).json({ message: "No published profile found" });
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching user business profile:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch profile", requestId: (req as any).requestId || null });
    }
  });

  /**
   * PATCH /api/business-profile/me
   * Update the authenticated user's published business profile
   */
  app.patch("/api/business-profile/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthedRequest).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const existing = await storage.getBusinessProfileByUserId(userId);
      const [ownerUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const discoveryUnlocked = isBusinessDiscoverable(ownerUser);

      if (!existing) {
        return res.status(404).json({ message: "No published profile to update" });
      }
      const beforeUrls = collectBusinessIndexNowUrls(existing, discoveryUnlocked);

      const updates = req.body as UpdateProfilePayload;
      const nextStateCode =
        typeof updates.stateCode === "string" && updates.stateCode.trim().length > 0
          ? updates.stateCode.trim().toUpperCase()
          : existing.stateCode;
      const nextCountyFips =
        typeof updates.countyFips === "string" && updates.countyFips.trim().length > 0
          ? updates.countyFips.trim()
          : existing.countyFips;

      if (nextStateCode && !/^[A-Z]{2}$/.test(nextStateCode)) {
        return res.status(400).json({ message: "stateCode must be a 2-letter code" });
      }
      if (nextCountyFips && !/^\d{5}$/.test(nextCountyFips)) {
        return res.status(400).json({ message: "countyFips must be a 5-digit FIPS value" });
      }
      const requestedBookingConfig =
        updates.bookingConfig !== undefined ? updates.bookingConfig : existing.bookingConfig;
      const normalizedBookingConfig = requestedBookingConfig
        ? normalizeProfileBookingPrefs(requestedBookingConfig)
        : null;
      if (normalizedBookingConfig?.paidBookings && normalizedBookingConfig.bookingPriceUsd <= 0) {
        return res.status(400).json({ message: "A booking deposit must be greater than zero" });
      }

      const updatedProfile: BusinessProfile = {
        ...existing,
        name: updates.name ?? existing.name,
        headline:
          updates.headline !== undefined
            ? String(updates.headline || "").trim() || null
            : existing.headline || null,
        description: updates.description !== undefined ? updates.description : existing.description,
        services:
          updates.services !== undefined
            ? Array.isArray(updates.services)
              ? updates.services
                  .map((service) => String(service).trim())
                  .filter(Boolean)
                  .slice(0, 24)
              : []
            : existing.services || [],
        countyFips: nextCountyFips,
        countyName: updates.countyName !== undefined ? updates.countyName : existing.countyName,
        city: updates.city !== undefined ? updates.city : existing.city,
        stateCode: nextStateCode,
        address: updates.address !== undefined ? updates.address : existing.address || null,
        zipCode: updates.zipCode !== undefined ? updates.zipCode : existing.zipCode || null,
        serviceAreas: updates.serviceAreas ?? existing.serviceAreas,
        website: updates.website !== undefined ? updates.website : existing.website,
        seoMeta:
          updates.seoMeta !== undefined
            ? updates.seoMeta
            : existing.seoMeta || buildDefaultSeoMeta(existing),
        ctaConfig: updates.ctaConfig !== undefined ? updates.ctaConfig : existing.ctaConfig || null,
        contentBlocks:
          updates.contentBlocks !== undefined
            ? Array.isArray(updates.contentBlocks)
              ? updates.contentBlocks
              : []
            : existing.contentBlocks || [],
        profileSections:
          updates.profileSections !== undefined
            ? { ...buildDefaultSections(), ...(updates.profileSections || {}) }
            : existing.profileSections || buildDefaultSections(),
        theme:
          updates.theme !== undefined
            ? updates.theme || buildDefaultTheme()
            : existing.theme || buildDefaultTheme(),
        bookingConfig: normalizedBookingConfig,
        visibility:
          updates.visibility !== undefined
            ? updates.visibility === "public"
              ? discoveryUnlocked
                ? "public"
                : "private"
              : "private"
            : existing.visibility || "private",
        updatedAt: new Date().toISOString(),
      };

      const saved = await storage.saveBusinessProfile(updatedProfile);
      const afterUrls = collectBusinessIndexNowUrls(saved, discoveryUnlocked);
      notifyIndexNow(combineIndexNowChangeUrls(beforeUrls, afterUrls));

      res.json({
        success: true,
        profile: saved,
        discoverabilityLocked:
          !discoveryUnlocked && saved.visibility !== "private" ? true : !discoveryUnlocked,
        discoverabilityReason: !discoveryUnlocked
          ? "Verification is still pending, so your business stays hidden from public discovery until it is complete."
          : null,
      });
    } catch (error: any) {
      console.error("Error updating business profile:", error);
      res
        .status(500)
        .json({ message: "Failed to update profile", requestId: (req as any).requestId || null });
    }
  });

  /**
   * GET /api/business-profile/domain/status
   * Returns only the selected owned profile's active and provisional state.
   */
  app.get(
    "/api/business-profile/domain/status",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const profileId = String(req.query.profileId || "").trim();
        if (!profileId) return res.status(400).json({ message: "profileId is required" });
        const targetProfile = await storage.getProfileByIdForOwner(userId, profileId);
        if (!targetProfile) return res.status(404).json({ message: "Profile not found" });

        const [ownerUser] = await db
          .select({ preferences: users.preferences })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!ownerUser) return res.status(404).json({ message: "User not found" });

        return res.json({
          success: true,
          domainStatus: profileDomainStatus(profileId, targetProfile, ownerUser.preferences),
        });
      } catch (error) {
        console.error("Error loading custom domain status:", error);
        return res.status(500).json({
          message: "Failed to load domain status",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  /**
   * POST /api/business-profile/domain/start
   * Starts DNS TXT verification for custom domain ownership.
   */
  app.post(
    "/api/business-profile/domain/start",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const profileId = String((req.body as any)?.profileId || "").trim();
        if (!profileId) {
          return res.status(400).json({ message: "profileId is required" });
        }
        const targetProfile = await storage.getProfileByIdForOwner(userId, profileId);
        if (!targetProfile) {
          return res.status(404).json({ message: "Profile not found" });
        }

        const domain = normalizeDomainInput((req.body as any)?.domain);
        if (!domain) {
          return res.status(400).json({ message: "Enter a valid domain (example.com)" });
        }

        const token = createVerificationToken();
        const verification: NonNullable<BusinessProfile["customDomainVerification"]> = {
          state: "pending",
          profileId,
          token,
          verifiedAt: null,
          lastCheckedAt: null,
          error: null,
        };
        const preferences = await db.transaction(async (tx: any) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
          if (await findDomainConflict(domain, userId, profileId, tx)) {
            throw domainRouteError(409, "This domain is already in use");
          }
          const [ownerUser] = await tx
            .select({ preferences: users.preferences })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          if (!ownerUser) throw domainRouteError(404, "User not found");

          const nextPreferences = buildPreferencesWithProfileDomainState({
            preferences: ownerUser.preferences,
            profileId,
            candidateDomain: domain,
            verification,
          });
          await writeProfileDomainPreferences({
            database: tx,
            userId,
            preferences: nextPreferences,
          });
          return nextPreferences;
        });

        return res.json({
          success: true,
          domainStatus: profileDomainStatus(profileId, targetProfile, preferences),
          verification: {
            state: "pending",
            profileId,
            domain,
            txtHost: `_tradescout-verify.${domain}`,
            txtValue: token,
          },
        });
      } catch (error: any) {
        if (Number.isInteger(error?.statusCode)) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Error starting custom domain verification:", error);
        return res.status(500).json({
          message: "Failed to start verification",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  /**
   * POST /api/business-profile/domain/verify
   * Verifies domain ownership without making an unprovisioned host canonical.
   * Hosting and TLS activation remain an operator-controlled infrastructure step.
   */
  app.post(
    "/api/business-profile/domain/verify",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const profileId = String((req.body as any)?.profileId || "").trim();
        if (!profileId) {
          return res.status(400).json({ message: "profileId is required" });
        }
        const targetProfile = await storage.getProfileByIdForOwner(userId, profileId);
        if (!targetProfile) {
          return res.status(404).json({ message: "Profile not found" });
        }

        const [ownerUser] = await db
          .select({ preferences: users.preferences })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!ownerUser) return res.status(404).json({ message: "User not found" });
        const currentDraft = readProfileDomainDraft(ownerUser.preferences, profileId);
        const domain = currentDraft.candidateDomain;
        const token = currentDraft.verification?.token?.trim();
        const verificationProfileId = String(currentDraft.verification?.profileId || "").trim();
        if (!domain || !token || verificationProfileId !== profileId) {
          return res.status(400).json({ message: "Start domain verification first" });
        }

        const txtHost = `_tradescout-verify.${domain}`;
        const domainLockKey = domainIdentityLockKey(domain);
        const now = new Date().toISOString();

        let ownershipVerified = false;
        let verificationError: string | null = null;

        try {
          const records = await resolveTxt(txtHost);
          const values = records.map((parts) => parts.join("").trim());
          ownershipVerified = values.includes(token);
          if (!ownershipVerified) {
            verificationError = "TXT record found, but token does not match";
          }
        } catch {
          verificationError = "TXT record not found yet";
        }

        if (ownershipVerified) {
          verificationError =
            "Ownership is verified. TradeScout hosting and TLS setup must be completed before this domain can go live. Your TradeScout profile remains canonical until then.";
        }

        const verification: NonNullable<BusinessProfile["customDomainVerification"]> = {
          state: ownershipVerified ? "pending" : "failed",
          profileId,
          token,
          // Reserved for the final hosting/TLS activation state. TXT ownership
          // alone is recorded by pending + lastCheckedAt.
          verifiedAt: null,
          lastCheckedAt: now,
          error: verificationError,
        };

        // Re-read before recording the result so a slow DNS lookup cannot
        // overwrite a newer verification attempt for this account. This route
        // deliberately never writes profiles.seoMeta.customDomain: TXT proof
        // establishes ownership, not edge routing or certificate readiness.
        const savedStatus = await db.transaction(async (tx: any) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${domainLockKey}))`);
          const [freshOwner] = await tx
            .select({ preferences: users.preferences })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          if (!freshOwner) throw domainRouteError(404, "User not found");
          const freshDraft = readProfileDomainDraft(freshOwner.preferences, profileId);
          const freshProfileId = String(freshDraft.verification?.profileId || "").trim();
          if (
            freshDraft.candidateDomain !== domain ||
            freshDraft.verification?.token?.trim() !== token ||
            freshProfileId !== profileId
          ) {
            throw domainRouteError(409, "Domain verification changed; try again");
          }

          const preferences = buildPreferencesWithProfileDomainState({
            preferences: freshOwner.preferences,
            profileId,
            candidateDomain: domain,
            verification,
          });
          await writeProfileDomainPreferences({ database: tx, userId, preferences });
          return profileDomainStatus(profileId, targetProfile, preferences);
        });

        return res.json({
          success: false,
          domainStatus: savedStatus,
          verification: {
            state: savedStatus.verification?.state,
            profileId,
            domain,
            txtHost,
            txtValue: token,
            ownershipVerified,
            activationPending: ownershipVerified,
            error: verificationError,
          },
        });
      } catch (error: any) {
        if (Number.isInteger(error?.statusCode)) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Error verifying custom domain:", error);
        return res.status(500).json({
          message: "Failed to verify domain",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  /**
   * DELETE /api/business-profile/domain
   * Disconnects the selected public profile without deleting any profile data.
   */
  app.delete(
    "/api/business-profile/domain",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const profileId = String((req.body as any)?.profileId || "").trim();
        if (!profileId) return res.status(400).json({ message: "profileId is required" });

        const result = await db.transaction(async (tx: any) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
          const [ownedProfile] = await tx
            .select({ id: profiles.id, seoMeta: profiles.seoMeta })
            .from(profiles)
            .where(and(eq(profiles.id, profileId), eq(profiles.ownerUserId, userId)))
            .limit(1);
          if (!ownedProfile) throw domainRouteError(404, "Profile not found");

          const currentSeoMeta =
            ownedProfile.seoMeta && typeof ownedProfile.seoMeta === "object"
              ? ({ ...ownedProfile.seoMeta } as Record<string, unknown>)
              : {};
          const activeDomain = String(currentSeoMeta.customDomain || "")
            .trim()
            .toLowerCase();
          if (activeDomain) {
            const domainLockKey = domainIdentityLockKey(activeDomain);
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${domainLockKey}))`);
          }
          delete currentSeoMeta.customDomain;

          const [ownerUser] = await tx
            .select({ preferences: users.preferences })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          if (!ownerUser) throw domainRouteError(404, "User not found");

          const profileDomainStates = (ownerUser.preferences as any)?.profileDomainStates;
          const hasProfileDomainState = Boolean(
            profileDomainStates &&
            typeof profileDomainStates === "object" &&
            Object.prototype.hasOwnProperty.call(profileDomainStates, profileId)
          );
          const currentDraft = (ownerUser.preferences as any)?.provisional?.profileDraft;
          const verificationProfileId = String(
            currentDraft?.customDomainVerification?.profileId || ""
          ).trim();
          const provisionalDomain = String(currentDraft?.customDomain || "")
            .trim()
            .toLowerCase();
          const clearsLegacyMatchingState =
            !verificationProfileId && Boolean(activeDomain) && provisionalDomain === activeDomain;
          const clearsProfileState = verificationProfileId === profileId;

          if (hasProfileDomainState || clearsLegacyMatchingState || clearsProfileState) {
            let preferences = buildPreferencesWithProfileDomainState({
              preferences: ownerUser.preferences,
              profileId,
              candidateDomain: null,
              verification: null,
            });
            if (clearsLegacyMatchingState || clearsProfileState) {
              preferences = buildPreferencesWithDomainState({
                preferences,
                customDomain: null,
                verification: null,
              });
            }
            await writeProfileDomainPreferences({ database: tx, userId, preferences });
          }

          await tx
            .update(profiles)
            .set({ seoMeta: currentSeoMeta as any, updatedAt: new Date() })
            .where(and(eq(profiles.id, profileId), eq(profiles.ownerUserId, userId)));

          return { activeDomain, seoMeta: currentSeoMeta };
        });

        return res.json({
          success: true,
          profileId,
          disconnectedDomain: result.activeDomain || null,
          seoMeta: result.seoMeta,
        });
      } catch (error: any) {
        if (Number.isInteger(error?.statusCode)) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Error disconnecting custom domain:", error);
        return res.status(500).json({
          message: "Failed to disconnect domain",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  /**
   * POST /api/scout/copy-assist
   * Scout generates 2 variants for description, headline, or services
   * PHASE 3e-A: Copy Assist v1.0 (description)
   * PHASE 3e-A.1: Copy Assist v1.1 (headline + services)
   */
  app.post("/api/scout/copy-assist", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const {
        businessName,
        countyName,
        stateCode,
        serviceAreas = [],
        field = "description",
        existingDescription = "",
        existingHeadline = "",
        existingServices = [],
        userType = "business_owner",
      } = req.body;

      if (!businessName || !countyName || !stateCode) {
        return res.status(400).json({
          message: "businessName, countyName, and stateCode are required",
        });
      }

      // Validate field
      if (!["description", "headline", "services"].includes(field)) {
        return res.status(400).json({
          message: "field must be one of: description, headline, services",
        });
      }

      // Build prompt context
      const serviceAreaText = serviceAreas.length > 0 ? `, serving ${serviceAreas.join(", ")}` : "";
      const currentDescContext = existingDescription
        ? `\nCurrent description: "${existingDescription}"`
        : "";
      const currentHeadlineContext = existingHeadline
        ? `\nCurrent headline: "${existingHeadline}"`
        : "";
      const currentServicesContext =
        existingServices && existingServices.length > 0
          ? `\nCurrent services:\n${(existingServices as string[]).map((s) => `- ${s}`).join("\n")}`
          : "";

      // Field-specific prompt contracts
      let systemPrompt: string;
      let userPrompt: string;
      let charLimit: number;

      if (field === "headline") {
        systemPrompt = `You are Scout, TradeScout's local search and summary surface. Your job is to improve business headlines.

Generate exactly 2 headline variants for a business:

1. Variant A (Safe): Factual, locality-forward, clarity-first. States what they do and where. Optimized for: readability, trust, SEO. Target length: 60–80 characters.

2. Variant B (Growth): Slightly more compelling, emphasizes outcomes or differentiation. Benefit-led but factual. Optimized for: discoverability, conversion. Target length: 60–80 characters.

Constraints:
- No fake statistics, unverified claims, or hype
- No ALL CAPS, emoji, or clickbait
- Character count must be 60–80 (count carefully)
- Always include county + service type when possible
- Both must be immediately usable

Output exactly this JSON (no markdown):
{
  "variants": [
    {"id": "safe", "text": "...", "rationale": "..."},
    {"id": "growth", "text": "...", "rationale": "..."}
  ]
}`;
        userPrompt = `Business: ${businessName} in ${countyName}, ${stateCode}${serviceAreaText}
User type: ${userType}${currentHeadlineContext}

Generate 2 headline variants (60–80 chars each).`;
        charLimit = 80;
      } else if (field === "services") {
        systemPrompt = `You are Scout, TradeScout's local search and summary surface. Your job is to improve business service listings.

Generate exactly 2 service-list variants for a business:

1. Variant A (Safe): Core services, clear language, general audience. Capability-focused. Lists 3–5 services, each 40–80 characters.

2. Variant B (Growth): Services with light outcome focus (what this enables or solves). Benefit-led but factual. Lists 3–5 services, each 40–80 characters.

Constraints:
- No fake claims or exaggeration
- Each bullet must be 40–80 characters (count carefully)
- Format as one service per line, no bullet markers
- Total 3–5 services
- Both must be immediately usable

Output exactly this JSON (no markdown):
{
  "variants": [
    {"id": "safe", "text": "service1\\nservice2\\nservice3", "rationale": "..."},
    {"id": "growth", "text": "service1\\nservice2\\nservice3", "rationale": "..."}
  ]
}`;
        userPrompt = `Business: ${businessName} in ${countyName}, ${stateCode}${serviceAreaText}
User type: ${userType}${currentServicesContext}

Generate 2 service-list variants (3–5 services each, 40–80 chars per service).`;
        charLimit = 500; // Higher limit for multi-line services
      } else {
        // description (v1.0)
        systemPrompt = `You are Scout, TradeScout's local search and summary surface for business profile optimization. Your job is to improve business descriptions for both SEO clarity and user confidence-never hype, never spam, always authentic.

Generate exactly 2 description variants for a business:

1. Variant A (Safe): Factual, locality-forward, clarity-first. Preserves user's voice if description exists. Includes business name + service area context. Optimized for: readability, trust, SEO. Target length: 120–160 characters. Tone: professional, straightforward.

2. Variant B (Growth): Differentiated, benefits-led, competitive. Emphasizes what makes this business stand out. Highlights service quality or specialization. Optimized for: discoverability, conversion, confidence. Target length: 140–180 characters. Tone: assertive, outcome-focused.

Constraints:
- No fake statistics, unverified claims, or hype
- No ALL CAPS, emoji, or clickbait phrasing
- No character limits exceeded (count carefully)
- No generic boilerplate
- Always include county + service area(s) if provided
- Always anchor to actual user type
- Both variants must be immediately usable; user should never need to edit for legality

Output exactly this JSON (no markdown, no extra text):
{
  "variants": [
    {"id": "safe", "text": "...", "rationale": "..."},
    {"id": "growth", "text": "...", "rationale": "..."}
  ]
}`;
        userPrompt = `Business: ${businessName} in ${countyName}, ${stateCode}${serviceAreaText}
User type: ${userType}${currentDescContext}

Generate 2 variants for this business description.`;
        charLimit = 200;
      }

      // Call Claude API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Claude API error:", error);
        return res.status(500).json({ message: "Failed to generate variants" });
      }

      const data = (await response.json()) as any;
      const content = data.content?.[0]?.text || "";

      // Parse JSON from response (Claude may wrap in markdown code blocks)
      let jsonStr = content;
      const jsonMatch =
        content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate response shape
      if (!parsed.variants || !Array.isArray(parsed.variants) || parsed.variants.length !== 2) {
        return res.status(500).json({ message: "Invalid response from Claude" });
      }

      // Validate each variant
      for (const variant of parsed.variants) {
        if (!variant.id || !variant.text || !variant.rationale) {
          return res.status(500).json({ message: "Invalid variant structure" });
        }
        // Character limit check
        if (variant.text.length > charLimit) {
          return res
            .status(500)
            .json({ message: `Variant ${variant.id} exceeds ${charLimit} character limit` });
        }
      }

      res.json({
        variants: parsed.variants,
      });
    } catch (error: any) {
      console.error("Error in copy assist:", error);
      res.status(500).json({
        message: "Failed to generate variants",
        requestId: (req as any).requestId || null,
      });
    }
  });
}
