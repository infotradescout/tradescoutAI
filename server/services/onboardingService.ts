import { ClaimSource, ClaimType, isValidCountyFips } from "./claimEventSchema";
import { writeClaimEvent } from "./claimEventService";
import { createHash } from "node:crypto";
import { CURRENT_PROFILE_VERSION } from "../../shared/profile";
import { sanitizePublicDiscoveryText } from "../../shared/publicListingSafety";
import {
  createConfiguredBusinessProfileAnalyzer,
  enrichBusinessProfileFromEvidence,
  normalizeBusinessProfileEnrichment,
  type BusinessProfileEnrichment,
  type BusinessProfileEnrichmentAnalyzer,
} from "./businessProfileEnrichmentService";

export type StorageLike = {
  getUser: (id: string) => Promise<any>;
  updateUser: (id: string, updates: Record<string, unknown>) => Promise<any>;
  getActiveBusinessForUser?: (userId: string) => Promise<any | undefined>;
  listBusinessesByOwner?: (ownerUserId: string) => Promise<any[]>;
  listUnclaimedOutcomeBusinesses?: () => Promise<any[]>;
  listProfilesByOwner?: (ownerUserId: string) => Promise<any[]>;
  createBusinessForOwner?: (ownerUserId: string, data: Record<string, unknown>) => Promise<any>;
  updateBusinessForOwner?: (
    ownerUserId: string,
    businessId: string,
    updates: Record<string, unknown>
  ) => Promise<any>;
  createProfileForOwner?: (ownerUserId: string, data: Record<string, unknown>) => Promise<any>;
  updateProfileForOwner?: (
    ownerUserId: string,
    profileId: string,
    updates: Record<string, unknown>
  ) => Promise<any>;
  completeOutcomeBusinessProfile?: (args: AtomicBusinessOutcomeArgs) => Promise<{
    business: any;
    profile: any;
  }>;
  preflightOutcomeBusinessProfile?: (args: {
    userId: string;
    evidence: NormalizedOutcomeBusinessEvidence;
  }) => Promise<void>;
  completeOutcomeExpressResult?: (args: AtomicExpressOutcomeArgs) => Promise<void>;
  logEvent?: (eventType: string, payload: Record<string, unknown>) => Promise<any>;
};

export type OutcomeOnboardingKind = "business_profile" | "express_result";

export type OutcomeBusinessEvidence = {
  targetBusinessId?: string;
  targetProfileId?: string;
  name?: string;
  notes?: string;
  services?: string[];
  links?: string[];
  photoUrls?: string[];
};

export type NormalizedOutcomeBusinessEvidence = {
  targetBusinessId: string;
  targetProfileId: string;
  name: string;
  notes: string;
  services: string[];
  links: string[];
  photoUrls: string[];
};

export type AtomicBusinessOutcomeArgs = {
  userId: string;
  goal: string;
  evidence: NormalizedOutcomeBusinessEvidence;
  enrichment?: BusinessProfileEnrichment;
  completedAt: string;
};

export type OutcomeOnboardingDependencies = {
  businessProfileAnalyzer?: BusinessProfileEnrichmentAnalyzer | null;
};

export type AtomicExpressOutcomeArgs = {
  userId: string;
  goal: string;
  resultRoute: string;
  completedAt: string;
};

export type OutcomeOnboardingResult =
  | {
      kind: "business_profile";
      resultRoute: string;
      outcomeTitle: string;
      profile: {
        id: string;
        slug: string;
        businessId: string;
        saved: true;
        published: true;
        discovery: "verification_gated";
      };
    }
  | {
      kind: "express_result";
      resultRoute: string;
      resultPrompt?: string;
      outcomeTitle: string;
    }
  | {
      kind: "business_claim_required";
      resultRoute: string;
      outcomeTitle: string;
      claim: {
        businessId?: string;
        name: string;
        slug?: string;
      };
    };

export class BusinessIdentityRequiredError extends Error {
  readonly code = "BUSINESS_IDENTITY_REQUIRED" as const;
  readonly missing = ["business.name"] as const;

  constructor() {
    super("Add a business name or a business website so we know which profile to build.");
    this.name = "BusinessIdentityRequiredError";
  }
}

export class BusinessSelectionRequiredError extends Error {
  readonly code = "BUSINESS_SELECTION_REQUIRED" as const;
  readonly missing = ["business.targetBusinessId", "business.name"] as const;
  readonly candidates: Array<{ id: string; name: string; slug: string }>;

  constructor(candidates: any[] = []) {
    super("Choose the business to update, or enter its exact business name.");
    this.name = "BusinessSelectionRequiredError";
    this.candidates = candidates.flatMap((candidate) => {
      const id = cleanText(candidate?.id, 200);
      const name = cleanText(candidate?.name, 180);
      const slug = cleanText(candidate?.slug, 200);
      return id && name ? [{ id, name, slug }] : [];
    });
  }
}

export class BusinessClaimRequiredError extends Error {
  readonly code = "BUSINESS_CLAIM_REQUIRED" as const;
  readonly businessId?: string;
  readonly businessName: string;
  readonly businessSlug?: string;

  constructor(business: { id?: unknown; name?: unknown; slug?: unknown }) {
    const name = cleanText(business.name, 180) || "this business";
    super(
      `TradeScout already has an unclaimed listing for ${name}. Claim it before building its profile.`
    );
    this.name = "BusinessClaimRequiredError";
    this.businessId = cleanText(business.id, 200) || undefined;
    this.businessName = name;
    this.businessSlug = cleanText(business.slug, 200) || undefined;
  }

  get resultRoute(): string {
    const params = new URLSearchParams({ source: "outcome_onboarding_match" });
    if (this.businessId) params.set("businessId", this.businessId);
    else params.set("q", this.businessName);
    return `/claim-my-business?${params.toString()}`;
  }
}

export class BusinessOwnershipConflictError extends Error {
  readonly code = "BUSINESS_OWNERSHIP_CONFLICT" as const;

  constructor() {
    super(
      "TradeScout already has a claimed listing with this exact business identity. Use the business claim flow to resolve ownership."
    );
    this.name = "BusinessOwnershipConflictError";
  }
}

export class BusinessSuspendedError extends Error {
  readonly code = "BUSINESS_SUSPENDED" as const;

  constructor() {
    super("This business is suspended and cannot be re-created or updated through onboarding.");
    this.name = "BusinessSuspendedError";
  }
}

export class BusinessProfileSelectionRequiredError extends Error {
  readonly code = "BUSINESS_PROFILE_SELECTION_REQUIRED" as const;
  readonly missing = ["business.targetProfileId"] as const;
  readonly candidates: Array<{ id: string; displayName: string; slug: string }>;

  constructor(candidates: any[] = []) {
    super("Multiple unlinked business profiles match this business. Choose the profile to reuse.");
    this.name = "BusinessProfileSelectionRequiredError";
    this.candidates = candidates.flatMap((candidate) => {
      const id = cleanText(candidate?.id, 200);
      const displayName = cleanText(candidate?.displayName, 180);
      const slug = cleanText(candidate?.slug, 200);
      return id && displayName ? [{ id, displayName, slug }] : [];
    });
  }
}

export type OnboardingLane =
  | "find_help"
  | "manage_projects"
  | "offer_services"
  | "sell_items"
  | "real_estate"
  | "business"
  | "community"
  | "browse_only";

export type OnboardingAsset = "home" | "vehicle" | "project" | "business" | "saved_search";

export type OnboardingClaimType =
  | "find_local_help"
  | "manage_local_projects"
  | "offer_local_services"
  | "sell_or_list_items"
  | "real_estate_property_work"
  | "run_local_business"
  | "see_local_activity"
  | "browse_search_only";

export type UnifiedOnboardingState = {
  startedAt: string;
  updatedAt: string;
  lane: OnboardingLane;
  claimType: OnboardingClaimType;
  legacySource?: string;
  assets: OnboardingAsset[];
  completedSteps: string[];
  verificationStartedAt?: string;
  completedAt?: string;
  minimumProfileComplete: boolean;
};

const DEFAULT_CLAIM_BY_LANE: Record<OnboardingLane, OnboardingClaimType> = {
  find_help: "find_local_help",
  manage_projects: "manage_local_projects",
  offer_services: "offer_local_services",
  sell_items: "sell_or_list_items",
  real_estate: "real_estate_property_work",
  business: "run_local_business",
  community: "see_local_activity",
  browse_only: "browse_search_only",
};

const CLAIM_EVENT_TYPE_BY_ONBOARDING_CLAIM: Record<OnboardingClaimType, ClaimType> = {
  find_local_help: ClaimType.WANTS_TO_HIRE,
  manage_local_projects: ClaimType.WANTS_TO_HIRE,
  offer_local_services: ClaimType.PROVIDES_SERVICES,
  sell_or_list_items: ClaimType.POSTS_DEALS,
  real_estate_property_work: ClaimType.REPRESENTS_BUSINESS,
  run_local_business: ClaimType.REPRESENTS_BUSINESS,
  see_local_activity: ClaimType.COMMUNITY_BUILDER,
  browse_search_only: ClaimType.EXPLORING,
};

const LEGACY_LANE_MAP: Record<
  string,
  { lane: OnboardingLane; asset?: OnboardingAsset; claimType?: OnboardingClaimType }
> = {
  homeowner: {
    lane: "manage_projects",
    asset: "home",
    claimType: "manage_local_projects",
  },
  vehicle_owner: {
    lane: "manage_projects",
    asset: "vehicle",
    claimType: "manage_local_projects",
  },
  service_provider: {
    lane: "offer_services",
    claimType: "offer_local_services",
  },
  seller: {
    lane: "sell_items",
    claimType: "sell_or_list_items",
  },
  realtor: {
    lane: "real_estate",
    claimType: "real_estate_property_work",
  },
  business_owner: {
    lane: "business",
    claimType: "run_local_business",
  },
  community_member: {
    lane: "community",
    claimType: "see_local_activity",
  },
};

function nowIso(): string {
  return new Date().toISOString();
}

async function safeLogEvent(
  storage: StorageLike,
  eventType:
    | "onboarding_started"
    | "role_selected"
    | "claim_submitted"
    | "profile_started"
    | "setup_step_completed"
    | "onboarding_completed",
  payload: Record<string, unknown>
) {
  try {
    if (typeof storage.logEvent === "function") {
      await storage.logEvent(eventType, payload);
    }
  } catch (error) {
    console.warn(`[onboarding] event logging skipped for ${eventType}`, { error });
  }
}

function isMinimumProfileComplete(profile: {
  fullName?: string | null;
  phone?: string | null;
  location?: { state?: string | null; county?: string | null; city?: string | null } | null;
}) {
  const hasName = Boolean(String(profile.fullName || "").trim());
  const hasPhone = Boolean(String(profile.phone || "").trim());
  const hasLocation = Boolean(
    String(profile.location?.state || "").trim() || String(profile.location?.county || "").trim()
  );
  return hasName && hasPhone && hasLocation;
}

function getOnboardingState(user: any): UnifiedOnboardingState | null {
  const preferences = (user?.preferences ?? {}) as Record<string, any>;
  const onboarding = preferences?.onboardingUnified;
  if (!onboarding || typeof onboarding !== "object") return null;
  return onboarding as UnifiedOnboardingState;
}

async function persistOnboardingState(
  storage: StorageLike,
  userId: string,
  state: UnifiedOnboardingState
) {
  const user = await storage.getUser(userId);
  const existingPreferences = ((user?.preferences ?? {}) as Record<string, unknown>) || {};
  const nextPreferences = {
    ...existingPreferences,
    onboardingUnified: state,
  };
  await storage.updateUser(userId, {
    preferences: nextPreferences,
  });
  return state;
}

export async function startUnifiedOnboarding(
  storage: StorageLike,
  args: {
    userId: string;
    lane: OnboardingLane;
    claimType?: OnboardingClaimType;
    assets?: OnboardingAsset[];
    legacySource?: string;
    profile?: {
      fullName?: string | null;
      phone?: string | null;
      location?: { state?: string | null; county?: string | null; city?: string | null } | null;
    };
  }
) {
  const startedAt = nowIso();
  const claimType = args.claimType || DEFAULT_CLAIM_BY_LANE[args.lane];
  const assets = Array.from(new Set(args.assets ?? []));
  const minimumProfileComplete = isMinimumProfileComplete(args.profile ?? {});
  const state: UnifiedOnboardingState = {
    startedAt,
    updatedAt: startedAt,
    lane: args.lane,
    claimType,
    legacySource: args.legacySource,
    assets,
    completedSteps: [],
    minimumProfileComplete,
  };

  await persistOnboardingState(storage, args.userId, state);

  await safeLogEvent(storage, "onboarding_started", {
    userId: args.userId,
    lane: args.lane,
    claimType,
    legacySource: args.legacySource || null,
  });
  await safeLogEvent(storage, "role_selected", {
    userId: args.userId,
    lane: args.lane,
  });
  await safeLogEvent(storage, "profile_started", {
    userId: args.userId,
    minimumProfileComplete,
  });

  return state;
}

export async function submitUnifiedOnboardingClaim(
  storage: StorageLike,
  args: {
    userId: string;
    lane: OnboardingLane;
    claimType: OnboardingClaimType;
    assets?: OnboardingAsset[];
    countyFips?: string | null;
    countyName?: string | null;
    legacySource?: string;
  }
) {
  const user = await storage.getUser(args.userId);
  const existing = getOnboardingState(user);
  const started = existing
    ? existing
    : await startUnifiedOnboarding(storage, {
        userId: args.userId,
        lane: args.lane,
        claimType: args.claimType,
        legacySource: args.legacySource,
      });

  const next: UnifiedOnboardingState = {
    ...started,
    lane: args.lane,
    claimType: args.claimType,
    legacySource: args.legacySource ?? started.legacySource,
    assets: Array.from(new Set([...(started.assets || []), ...(args.assets || [])])),
    updatedAt: nowIso(),
  };
  await persistOnboardingState(storage, args.userId, next);

  const countyFips = String(args.countyFips || "").trim();
  const countyName = String(args.countyName || "").trim();
  if (countyFips && countyName && isValidCountyFips(countyFips)) {
    try {
      await writeClaimEvent({
        userId: args.userId,
        claimType: CLAIM_EVENT_TYPE_BY_ONBOARDING_CLAIM[args.claimType],
        countyFips,
        countyName,
        source: ClaimSource.SIGNUP,
        claimTimestamp: new Date(),
        metadata: {
          lane: args.lane,
          onboardingClaimType: args.claimType,
          legacySource: args.legacySource || null,
        },
      });
    } catch (error) {
      console.warn("[onboarding] claim event write skipped", { error });
    }
  }

  await safeLogEvent(storage, "claim_submitted", {
    userId: args.userId,
    lane: args.lane,
    claimType: args.claimType,
    legacySource: args.legacySource || null,
  });

  return next;
}

export async function completeUnifiedOnboardingStep(
  storage: StorageLike,
  args: {
    userId: string;
    stepKey: string;
    completeOnboarding?: boolean;
    assets?: OnboardingAsset[];
  }
) {
  const user = await storage.getUser(args.userId);
  const current = getOnboardingState(user);
  if (!current) return null;

  const completedSteps = Array.from(new Set([...current.completedSteps, args.stepKey]));
  const next: UnifiedOnboardingState = {
    ...current,
    assets: Array.from(new Set([...(current.assets || []), ...(args.assets || [])])),
    completedSteps,
    updatedAt: nowIso(),
  };

  if (args.completeOnboarding) {
    next.completedAt = nowIso();
  }

  await persistOnboardingState(storage, args.userId, next);
  await safeLogEvent(storage, "setup_step_completed", {
    userId: args.userId,
    stepKey: args.stepKey,
    lane: next.lane,
  });

  if (args.completeOnboarding) {
    await safeLogEvent(storage, "onboarding_completed", {
      userId: args.userId,
      lane: next.lane,
      claimType: next.claimType,
    });
  }

  return next;
}

const SOCIAL_HOST_SUFFIXES = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
] as const;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanPublicText(value: unknown, maxLength: number): string {
  return sanitizePublicDiscoveryText(cleanText(value, maxLength), maxLength);
}

function uniqueStrings(values: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= maxItems) break;
  }
  return result;
}

function normalizeHttpUrl(value: unknown): string {
  const raw = cleanText(value, 2_000);
  if (!raw) return "";
  try {
    const bareDomain =
      /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i.test(
        raw
      );
    const parsed = new URL(bareDomain ? `https://${raw}` : raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.toString().slice(0, 2_000);
  } catch {
    return "";
  }
}

function normalizePhotoUrl(value: unknown): string {
  const raw = cleanText(value, 2_000);
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return "";
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return raw;
  return normalizeHttpUrl(raw);
}

export function normalizeOutcomeBusinessEvidence(
  evidence: OutcomeBusinessEvidence | null | undefined
): NormalizedOutcomeBusinessEvidence {
  const raw = evidence ?? {};
  return {
    targetBusinessId: cleanText(raw.targetBusinessId, 200),
    targetProfileId: cleanText(raw.targetProfileId, 200),
    name: cleanPublicText(raw.name, 180),
    // Keep the bounded original note privately as provenance. It is sanitized
    // separately before any part of it is placed on a public profile.
    notes: cleanText(raw.notes, 4_000),
    services: uniqueStrings(
      (Array.isArray(raw.services) ? raw.services : [])
        .map((service) => cleanPublicText(service, 180))
        .filter(Boolean),
      50
    ),
    links: uniqueStrings(
      (Array.isArray(raw.links) ? raw.links : []).map(normalizeHttpUrl).filter(Boolean),
      20
    ),
    photoUrls: uniqueStrings(
      (Array.isArray(raw.photoUrls) ? raw.photoUrls : []).map(normalizePhotoUrl).filter(Boolean),
      12
    ),
  };
}

function isSocialHostname(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase().replace(/^www\./, "");
  return SOCIAL_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)
  );
}

const ATTRIBUTABLE_SINGLE_SUFFIXES = new Set([
  "ai",
  "app",
  "biz",
  "co",
  "com",
  "dev",
  "info",
  "io",
  "net",
  "org",
  "shop",
  "store",
  "us",
]);

const ATTRIBUTABLE_COMPOUND_SUFFIXES = new Set([
  "co.jp",
  "co.nz",
  "co.uk",
  "co.za",
  "com.au",
  "com.br",
  "com.mx",
]);

const HOSTED_SITE_DOMAINS = [
  "blogspot.com",
  "godaddysites.com",
  "linktr.ee",
  "myshopify.com",
  "sites.google.com",
  "square.site",
  "weebly.com",
  "wixsite.com",
  "wordpress.com",
] as const;

function isHostedSiteDomain(hostname: string): boolean {
  return HOSTED_SITE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

/**
 * Returns a conservative registrable-domain identity only when the suffix is
 * one we can parse without guessing. Hosted-site domains are intentionally
 * excluded because their hostname identifies the platform, not the business.
 */
export function outcomeWebsiteIdentityDomain(value: unknown): string {
  const raw = cleanText(value, 2_000);
  if (!raw) return "";
  try {
    const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
    const hostname = new URL(withProtocol).hostname
      .toLocaleLowerCase()
      .replace(/^www\./, "")
      .replace(/\.$/, "");
    if (!hostname || isSocialHostname(hostname) || isHostedSiteDomain(hostname)) return "";
    const labels = hostname.split(".").filter(Boolean);
    if (labels.length < 2) return "";
    const compoundSuffix = labels.slice(-2).join(".");
    if (ATTRIBUTABLE_COMPOUND_SUFFIXES.has(compoundSuffix)) {
      return labels.length >= 3 ? labels.slice(-3).join(".") : "";
    }
    const suffix = labels.at(-1) || "";
    if (!ATTRIBUTABLE_SINGLE_SUFFIXES.has(suffix)) return "";
    return labels.slice(-2).join(".");
  } catch {
    return "";
  }
}

export function normalizeBusinessIdentityName(value: unknown): string {
  return cleanText(value, 180)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function firstNonSocialBusinessUrl(links: string[]): string {
  for (const link of links) {
    try {
      const hostname = new URL(link).hostname;
      if (hostname && !isSocialHostname(hostname)) return link;
    } catch {
      // Inputs are normalized before this helper, but malformed values stay inert.
    }
  }
  return "";
}

export function deriveBusinessNameFromLinks(links: string[]): string {
  const url = firstNonSocialBusinessUrl(links.map(normalizeHttpUrl).filter(Boolean));
  if (!url) return "";
  const identityDomain = outcomeWebsiteIdentityDomain(url);
  if (!identityDomain) return "";
  const label = identityDomain.split(".")[0];
  return cleanPublicText(
    label.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase()),
    180
  );
}

export function businessWebsiteIdentityDomain(business: any): string {
  const profileData =
    business?.profileData && typeof business.profileData === "object" ? business.profileData : {};
  const extras =
    profileData?.importExtras && typeof profileData.importExtras === "object"
      ? profileData.importExtras
      : {};
  for (const candidate of [
    profileData.website,
    extras.google_place_website,
    extras.googlePlaceWebsite,
    extras.website,
  ]) {
    const domain = outcomeWebsiteIdentityDomain(candidate);
    if (domain) return domain;
  }
  return "";
}

export function findDefensibleCanonicalBusinessMatches(
  candidates: any[],
  args: { displayName: string; links: string[] }
): any[] {
  const normalizedName = normalizeBusinessIdentityName(args.displayName);
  if (!normalizedName) return [];
  const evidenceDomain = firstNonSocialBusinessUrl(args.links)
    ? outcomeWebsiteIdentityDomain(firstNonSocialBusinessUrl(args.links))
    : "";
  return candidates.filter((candidate) => {
    const candidateDomain = businessWebsiteIdentityDomain(candidate);
    // An exact attributable registrable domain is independently strong
    // identity evidence, even when the directory name is abbreviated or old.
    if (evidenceDomain && candidateDomain) return evidenceDomain === candidateDomain;
    return Boolean(
      normalizedName && normalizeBusinessIdentityName(candidate?.name) === normalizedName
    );
  });
}

export function findDefensibleUnclaimedBusinessMatches(
  candidates: any[],
  args: { displayName: string; links: string[] }
): any[] {
  return findDefensibleCanonicalBusinessMatches(candidates, args).filter(
    (candidate) =>
      !candidate?.ownerUserId &&
      String(candidate?.claimStatus || "").toLocaleLowerCase() === "unclaimed" &&
      String(candidate?.status || "").toLocaleLowerCase() !== "suspended"
  );
}

export function enforceCanonicalBusinessIdentityResolution(
  identityMatches: any[],
  args: { userId: string }
): void {
  if (
    identityMatches.some(
      (candidate) => String(candidate?.status || "").toLocaleLowerCase() === "suspended"
    )
  ) {
    throw new BusinessSuspendedError();
  }

  // A claimed record owned by another account is the strongest conflict. It
  // must win over any duplicate unclaimed row so onboarding never offers a
  // misleading claim handoff for an already-owned identity.
  if (
    identityMatches.some(
      (candidate) => candidate?.ownerUserId && String(candidate.ownerUserId) !== String(args.userId)
    )
  ) {
    throw new BusinessOwnershipConflictError();
  }

  const sameOwnerMatches = identityMatches.filter(
    (candidate) => String(candidate?.ownerUserId || "") === String(args.userId)
  );
  if (sameOwnerMatches.length > 0) throw new BusinessSelectionRequiredError(sameOwnerMatches);

  const claimableMatches = identityMatches.filter(
    (candidate) =>
      !candidate?.ownerUserId &&
      String(candidate?.claimStatus || "").toLocaleLowerCase() === "unclaimed"
  );
  if (claimableMatches.length > 1) {
    throw new BusinessClaimRequiredError({ name: claimableMatches[0]?.name });
  }
  if (claimableMatches.length === 1) throw new BusinessClaimRequiredError(claimableMatches[0]);
}

export function resolveOwnedBusinessOutcomeTarget(
  ownedBusinesses: any[],
  args: {
    activeBusinessId?: unknown;
    evidence: NormalizedOutcomeBusinessEvidence;
    fallbackIdentityName?: string;
  }
): { business?: any; displayName: string } {
  const suspended = ownedBusinesses.filter(
    (business) => String(business?.status || "").toLocaleLowerCase() === "suspended"
  );
  const eligible = ownedBusinesses.filter(
    (business) => String(business?.status || "").toLocaleLowerCase() !== "suspended"
  );
  const targetBusinessId = args.evidence.targetBusinessId;
  const evidenceName = args.evidence.name;
  const normalizedEvidenceName = normalizeBusinessIdentityName(evidenceName);
  const evidenceDomain = outcomeWebsiteIdentityDomain(
    firstNonSocialBusinessUrl(args.evidence.links)
  );

  if (targetBusinessId) {
    const anySelected = ownedBusinesses.find(
      (business) => String(business?.id || "") === String(targetBusinessId)
    );
    if (anySelected && String(anySelected.status || "").toLocaleLowerCase() === "suspended") {
      throw new BusinessSuspendedError();
    }
    const selected = anySelected && eligible.includes(anySelected) ? anySelected : undefined;
    if (!selected) throw new BusinessSelectionRequiredError(eligible);
    if (
      normalizedEvidenceName &&
      normalizeBusinessIdentityName(selected.name) !== normalizedEvidenceName &&
      (!evidenceDomain || businessWebsiteIdentityDomain(selected) !== evidenceDomain)
    ) {
      throw new BusinessSelectionRequiredError(eligible);
    }
    return { business: selected, displayName: cleanPublicText(selected.name, 180) };
  }

  if (evidenceDomain) {
    const suspendedDomainMatches = suspended.filter(
      (business) => businessWebsiteIdentityDomain(business) === evidenceDomain
    );
    if (suspendedDomainMatches.length > 0) throw new BusinessSuspendedError();
    const domainMatches = eligible.filter(
      (business) => businessWebsiteIdentityDomain(business) === evidenceDomain
    );
    if (domainMatches.length === 1) {
      return {
        business: domainMatches[0],
        displayName: cleanPublicText(domainMatches[0].name, 180),
      };
    }
    if (domainMatches.length > 1) {
      const activeDomain = domainMatches.filter(
        (business) => String(business?.id || "") === String(args.activeBusinessId || "")
      );
      if (activeDomain.length === 1) {
        return {
          business: activeDomain[0],
          displayName: cleanPublicText(activeDomain[0].name, 180),
        };
      }
      throw new BusinessSelectionRequiredError(domainMatches);
    }
    // A strong new domain is affirmative evidence for a different business.
    // Do not fall back to the sole owned business or an unrelated active draft.
    return {
      displayName: evidenceName || deriveBusinessNameFromLinks(args.evidence.links),
    };
  }

  if (normalizedEvidenceName) {
    const suspendedNameMatches = suspended.filter(
      (business) => normalizeBusinessIdentityName(business?.name) === normalizedEvidenceName
    );
    if (suspendedNameMatches.length > 0) throw new BusinessSuspendedError();
    const exactMatches = eligible.filter(
      (business) => normalizeBusinessIdentityName(business?.name) === normalizedEvidenceName
    );
    if (exactMatches.length === 1) {
      return { business: exactMatches[0], displayName: cleanPublicText(exactMatches[0].name, 180) };
    }
    if (exactMatches.length > 1) {
      const activeExact = exactMatches.filter(
        (business) => String(business?.id || "") === String(args.activeBusinessId || "")
      );
      if (activeExact.length === 1) {
        return { business: activeExact[0], displayName: cleanPublicText(activeExact[0].name, 180) };
      }
      throw new BusinessSelectionRequiredError(exactMatches);
    }
    return { displayName: evidenceName };
  }

  if (eligible.length === 1) {
    return { business: eligible[0], displayName: cleanPublicText(eligible[0].name, 180) };
  }
  if (eligible.length > 1) throw new BusinessSelectionRequiredError(eligible);

  const fallbackIdentityName = cleanPublicText(args.fallbackIdentityName, 180);
  if (fallbackIdentityName) return { displayName: fallbackIdentityName };
  throw new BusinessIdentityRequiredError();
}

export function mergeOutcomeBusinessProfileData(
  current: unknown,
  evidence: NormalizedOutcomeBusinessEvidence,
  options: { isNew: boolean; enrichment?: BusinessProfileEnrichment }
): Record<string, unknown> {
  const previous = current && typeof current === "object" ? (current as Record<string, any>) : {};
  const next: Record<string, unknown> = { ...previous };
  const publicNotes = cleanPublicText(evidence.notes, 4_000);
  const enrichedDescription = cleanPublicText(
    options.enrichment?.description?.text || options.enrichment?.about?.text,
    4_000
  );
  const publicDescription = publicNotes || enrichedDescription;

  if (!cleanText(previous.description, 4_000) && publicDescription) {
    next.description = publicDescription;
  }

  const existingServices = Array.isArray(previous.services) ? [...previous.services] : [];
  const seenServices = new Set(
    existingServices
      .map((service: unknown) => cleanText(service, 180).toLocaleLowerCase())
      .filter(Boolean)
  );
  const candidateServices = uniqueStrings(
    [
      ...evidence.services,
      ...(options.enrichment?.services.map((service) => cleanPublicText(service.name, 180)) || []),
    ].filter(Boolean),
    50
  );
  const addedServices = candidateServices.filter((service) => {
    const key = service.toLocaleLowerCase();
    if (seenServices.has(key)) return false;
    seenServices.add(key);
    return true;
  });
  if (addedServices.length > 0 || (!Array.isArray(previous.services) && candidateServices.length)) {
    next.services = [...existingServices, ...addedServices];
  }

  // Links are intake evidence, not contact authority. A new business may retain
  // its first explicit website in business data only while the public gate is
  // explicitly disabled. Existing visibility/contact choices are never changed.
  if (options.isNew) {
    const website = firstNonSocialBusinessUrl(evidence.links);
    if (website) next.website = website;
    next.publicWebsiteEnabled = false;
  }

  return next;
}

function blockData(block: any): Record<string, any> {
  return block?.data && typeof block.data === "object" ? block.data : {};
}

function serviceItemLabel(value: unknown): string {
  if (typeof value === "string") return cleanPublicText(value, 180);
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  return cleanPublicText(
    item.title ?? item.name ?? item.label ?? item.description ?? item.text,
    180
  );
}

function galleryItemUrl(value: unknown): string {
  if (typeof value === "string") return normalizePhotoUrl(value);
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  return normalizePhotoUrl(item.imageUrl ?? item.url ?? item.src);
}

export function buildOutcomeProfileContentBlocks(
  existingBlocks: unknown,
  args: {
    displayName: string;
    evidence: NormalizedOutcomeBusinessEvidence;
    enrichment?: BusinessProfileEnrichment;
    isNew: boolean;
  }
): Array<Record<string, any>> {
  let blocks = Array.isArray(existingBlocks)
    ? existingBlocks.filter((block) => block && typeof block === "object")
    : [];
  const publicNotes = cleanPublicText(args.evidence.notes, 4_000);
  const enrichedAbout = cleanPublicText(
    args.enrichment?.about?.text || args.enrichment?.description?.text,
    4_000
  );
  const publicAbout = publicNotes || enrichedAbout;
  const publicServices = uniqueStrings(
    [
      ...args.evidence.services,
      ...(args.enrichment?.services.map((service) => cleanPublicText(service.name, 180)) || []),
    ].filter(Boolean),
    50
  );

  if (args.isNew) {
    blocks = [
      { type: "siteTemplate", data: { id: "default" } },
      {
        type: "hero",
        data: {
          title: args.displayName,
          ...(args.evidence.photoUrls[0] ? { imageUrl: args.evidence.photoUrls[0] } : {}),
        },
      },
    ];
  } else {
    const heroIndex = blocks.findIndex((block: any) => block.type === "hero");
    if (heroIndex >= 0) {
      const hero = blocks[heroIndex] as any;
      const data = blockData(hero);
      const patch: Record<string, unknown> = {};
      if (!cleanText(data.title ?? data.headerLabel, 400)) patch.title = args.displayName;
      if (!normalizePhotoUrl(data.imageUrl ?? data.heroImageUrl) && args.evidence.photoUrls[0]) {
        patch.imageUrl = args.evidence.photoUrls[0];
      }
      if (Object.keys(patch).length > 0) {
        blocks = blocks.map((block: any, index: number) =>
          index === heroIndex ? { ...block, data: { ...data, ...patch } } : block
        );
      }
    } else {
      blocks = [
        ...blocks,
        {
          type: "hero",
          data: {
            title: args.displayName,
            ...(args.evidence.photoUrls[0] ? { imageUrl: args.evidence.photoUrls[0] } : {}),
          },
        },
      ];
    }
  }

  if (publicAbout) {
    const aboutIndex = blocks.findIndex((block: any) => block.type === "about");
    if (aboutIndex >= 0) {
      const about = blocks[aboutIndex] as any;
      const data = blockData(about);
      const existingText = cleanText(data.text ?? data.body ?? data.description, 4_000);
      if (!existingText) {
        blocks = blocks.map((block: any, index: number) =>
          index === aboutIndex ? { ...block, data: { ...data, body: publicAbout } } : block
        );
      }
    } else {
      blocks = [...blocks, { type: "about", data: { body: publicAbout } }];
    }
  }

  if (publicServices.length > 0) {
    const servicesIndex = blocks.findIndex((block: any) => block.type === "services");
    if (servicesIndex >= 0) {
      const servicesBlock = blocks[servicesIndex] as any;
      const data = blockData(servicesBlock);
      const existingItems = Array.isArray(data.items) ? data.items : [];
      const seen = new Set(
        existingItems
          .map(serviceItemLabel)
          .filter(Boolean)
          .map((v) => v.toLowerCase())
      );
      const additions = publicServices.filter((service) => {
        const key = service.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (additions.length > 0) {
        blocks = blocks.map((block: any, index: number) =>
          index === servicesIndex
            ? { ...block, data: { ...data, items: [...existingItems, ...additions] } }
            : block
        );
      }
    } else {
      blocks = [...blocks, { type: "services", data: { items: publicServices } }];
    }
  }

  if (args.evidence.photoUrls.length > 0) {
    const galleryIndex = blocks.findIndex((block: any) => block.type === "gallery");
    if (galleryIndex >= 0) {
      const gallery = blocks[galleryIndex] as any;
      const data = blockData(gallery);
      const existingImages = Array.isArray(data.images) ? data.images : [];
      const seen = new Set(existingImages.map(galleryItemUrl).filter(Boolean));
      const additions = args.evidence.photoUrls
        .filter((photoUrl) => {
          if (seen.has(photoUrl)) return false;
          seen.add(photoUrl);
          return true;
        })
        .map((imageUrl) => ({ imageUrl }));
      if (additions.length > 0) {
        blocks = blocks.map((block: any, index: number) =>
          index === galleryIndex
            ? {
                ...block,
                data: { ...data, images: [...existingImages, ...additions] },
              }
            : block
        );
      }
    } else {
      blocks = [
        ...blocks,
        {
          type: "gallery",
          data: { images: args.evidence.photoUrls.map((imageUrl) => ({ imageUrl })) },
        },
      ];
    }
  }

  return blocks as Array<Record<string, any>>;
}

export function safeOutcomeNextPath(value: unknown): string {
  const path = cleanText(value, 2_048);
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path)) {
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(path, "https://tradescout.internal");
  } catch {
    return "";
  }
  if (parsed.origin !== "https://tradescout.internal") return "";

  let decodedPathname = parsed.pathname;
  try {
    decodedPathname = decodeURIComponent(decodeURIComponent(decodedPathname));
  } catch {
    return "";
  }
  if (
    decodedPathname.startsWith("//") ||
    decodedPathname.includes("\\") ||
    /[?#]/.test(decodedPathname) ||
    /[\u0000-\u001f\u007f]/.test(decodedPathname) ||
    /^\/(?:https?:|javascript:|data:|file:)/i.test(decodedPathname)
  ) {
    return "";
  }

  let canonicalPathname: string;
  try {
    const canonical = new URL(decodedPathname, "https://tradescout.internal");
    if (canonical.origin !== "https://tradescout.internal") return "";
    canonicalPathname = canonical.pathname;
  } catch {
    return "";
  }

  const normalizedPath = canonicalPathname.replace(/\/+$/, "") || "/";
  const normalizedLower = normalizedPath.toLocaleLowerCase();
  const isNonPageNamespace =
    normalizedLower.startsWith("/_") ||
    ["/api", "/.well-known", "/assets", "/static", "/src", "/node_modules"].some(
      (prefix) => normalizedLower === prefix || normalizedLower.startsWith(`${prefix}/`)
    );
  if (isNonPageNamespace) return "";
  const createsAuthLoop = [
    "/pre-scout-setup",
    "/login",
    "/register",
    "/signup",
    "/create-account",
    "/onboarding",
    "/profile-setup",
    "/logout",
    "/auth",
    "/signin",
    "/sign-in",
  ].some((prefix) => normalizedLower === prefix || normalizedLower.startsWith(`${prefix}/`));
  return createsAuthLoop ? "" : path;
}

export function buildOutcomePreferences(
  current: unknown,
  args:
    | (AtomicBusinessOutcomeArgs & {
        kind: "business_profile";
        businessId: string;
        profileId: string;
        resultRoute?: string;
      })
    | (AtomicExpressOutcomeArgs & { kind: "express_result" })
): Record<string, unknown> {
  const preferences =
    current && typeof current === "object" ? (current as Record<string, unknown>) : {};

  if (args.kind === "express_result") {
    return {
      ...preferences,
      onboardingOutcome: {
        version: CURRENT_PROFILE_VERSION,
        kind: args.kind,
        goal: args.goal,
        resultRoute: args.resultRoute,
        completedAt: args.completedAt,
        provenance: { source: "selective_intelligence_onboarding" },
      },
    };
  }

  const existingPublicProfileIds = Array.isArray(preferences.publicProfileIds)
    ? preferences.publicProfileIds
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim().slice(0, 200))
    : [];
  const publicProfileIds = Array.from(
    new Set([...existingPublicProfileIds, String(args.profileId)])
  ).slice(-250);

  return {
    ...preferences,
    // Visibility belongs to this canonical profile. Never flip the legacy
    // user-wide profileVisibility switch, which could expose other profiles.
    publicProfileIds,
    onboardingOutcome: {
      version: CURRENT_PROFILE_VERSION,
      kind: args.kind,
      goal: args.goal,
      businessId: args.businessId,
      profileId: args.profileId,
      ...(args.resultRoute ? { resultRoute: args.resultRoute } : {}),
      completedAt: args.completedAt,
      provenance: {
        source: "selective_intelligence_onboarding",
        evidence: {
          targetBusinessId: args.evidence.targetBusinessId || null,
          targetProfileId: args.evidence.targetProfileId || null,
          name: args.evidence.name || null,
          notes: args.evidence.notes || null,
          services: args.evidence.services,
          links: args.evidence.links,
          photoUrls: args.evidence.photoUrls,
        },
        ...(args.enrichment
          ? {
              enrichment: {
                source: args.enrichment.source,
                analyzer: args.enrichment.analyzer,
                // Persist only the post-policy, cited output. Raw analyzer
                // responses (including unsupported fields) are never stored.
                output: {
                  ...(args.enrichment.description
                    ? { description: args.enrichment.description }
                    : {}),
                  ...(args.enrichment.about ? { about: args.enrichment.about } : {}),
                  services: args.enrichment.services,
                },
              },
            }
          : {}),
      },
    },
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function storedOutcomeBusinessEvidenceMatches(
  stored: unknown,
  evidence: NormalizedOutcomeBusinessEvidence
): boolean {
  if (!stored || typeof stored !== "object") return false;
  const value = stored as Record<string, unknown>;
  return sameJson(
    {
      targetBusinessId: cleanText(value.targetBusinessId, 200) || null,
      targetProfileId: cleanText(value.targetProfileId, 200) || null,
      name: cleanText(value.name, 180) || null,
      notes: cleanText(value.notes, 4_000) || null,
      services: Array.isArray(value.services) ? value.services : [],
      links: Array.isArray(value.links) ? value.links : [],
      photoUrls: Array.isArray(value.photoUrls) ? value.photoUrls : [],
    },
    {
      targetBusinessId: evidence.targetBusinessId || null,
      targetProfileId: evidence.targetProfileId || null,
      name: evidence.name || null,
      notes: evidence.notes || null,
      services: evidence.services,
      links: evidence.links,
      photoUrls: evidence.photoUrls,
    }
  );
}

export function getStoredOutcomeBusinessEnrichment(
  preferences: unknown,
  evidence: NormalizedOutcomeBusinessEvidence
): BusinessProfileEnrichment | undefined {
  const previousOutcome = (preferences as any)?.onboardingOutcome;
  const previousProvenance = previousOutcome?.provenance;
  const previousEnrichment = previousProvenance?.enrichment;
  if (
    previousOutcome?.kind !== "business_profile" ||
    !storedOutcomeBusinessEvidenceMatches(previousProvenance?.evidence, evidence) ||
    !previousEnrichment?.output
  ) {
    return undefined;
  }
  return (
    normalizeBusinessProfileEnrichment(
      previousEnrichment.output,
      {
        businessName: evidence.name || deriveBusinessNameFromLinks(evidence.links),
        links: evidence.links,
        photoUrls: evidence.photoUrls,
      },
      previousEnrichment.analyzer
    ) || undefined
  );
}

const outcomeBusinessEnrichmentFlights = new Map<
  string,
  Promise<BusinessProfileEnrichment | null>
>();

async function resolveOutcomeBusinessEnrichment(
  storage: StorageLike,
  userId: string,
  evidence: NormalizedOutcomeBusinessEvidence,
  dependencies: OutcomeOnboardingDependencies
): Promise<BusinessProfileEnrichment | undefined> {
  const enrichmentInput = {
    businessName: evidence.name || deriveBusinessNameFromLinks(evidence.links),
    links: evidence.links,
    photoUrls: evidence.photoUrls,
  };
  const user = await storage.getUser(userId);
  if (!user) return undefined;
  const reused = getStoredOutcomeBusinessEnrichment(user.preferences, evidence);
  if (reused) return reused;

  const analyzer =
    dependencies.businessProfileAnalyzer === undefined
      ? createConfiguredBusinessProfileAnalyzer()
      : dependencies.businessProfileAnalyzer;
  const flightKey = `${userId}:${createHash("sha256")
    .update(JSON.stringify(evidence))
    .digest("hex")}`;
  const inFlight = outcomeBusinessEnrichmentFlights.get(flightKey);
  if (inFlight) return (await inFlight) || undefined;

  const pending = enrichBusinessProfileFromEvidence(enrichmentInput, analyzer ?? null);
  outcomeBusinessEnrichmentFlights.set(flightKey, pending);
  try {
    return (await pending) || undefined;
  } finally {
    if (outcomeBusinessEnrichmentFlights.get(flightKey) === pending) {
      outcomeBusinessEnrichmentFlights.delete(flightKey);
    }
  }
}

export function isClearlyBusinessProfile(profile: any, business: any): boolean {
  const roleContext = String(profile?.roleContext || "")
    .trim()
    .toLocaleLowerCase();
  const hasBusinessContext =
    [
      "business_owner",
      "contractor",
      "service_provider",
      "specialty_tradesperson",
      "franchise_owner",
      "startup_founder",
      "commercial_property",
      "car_dealer",
      "auto_service",
    ].includes(roleContext) ||
    (Array.isArray(profile?.contentBlocks) &&
      profile.contentBlocks.some((block: any) => block?.type === "businessDraft"));
  const blocks = Array.isArray(profile?.contentBlocks) ? profile.contentBlocks : [];
  const hasBusinessDraft = blocks.some((block: any) => block?.type === "businessDraft");
  const profileName = normalizeBusinessIdentityName(profile?.displayName);
  const businessName = normalizeBusinessIdentityName(business?.name);
  return Boolean(
    (hasBusinessContext || hasBusinessDraft) && profileName && profileName === businessName
  );
}

export function getIdentifiableUnlinkedBusinessProfileName(profile: any): string {
  if (!profile || profile.businessId) return "";
  const roleContext = String(profile?.roleContext || "")
    .trim()
    .toLocaleLowerCase();
  const blocks = Array.isArray(profile?.contentBlocks) ? profile.contentBlocks : [];
  const hasBusinessContext =
    [
      "business_owner",
      "contractor",
      "service_provider",
      "specialty_tradesperson",
      "franchise_owner",
      "startup_founder",
      "commercial_property",
      "car_dealer",
      "auto_service",
    ].includes(roleContext) || blocks.some((block: any) => block?.type === "businessDraft");
  return hasBusinessContext ? cleanPublicText(profile?.displayName, 180) : "";
}

export function resolveUnlinkedBusinessProfileTarget(
  ownerProfiles: any[],
  args: { business: any; activeProfileId?: unknown; targetProfileId?: unknown }
): any | undefined {
  const businessName = normalizeBusinessIdentityName(args.business?.name);
  if (!businessName) return undefined;
  const matches = ownerProfiles.filter(
    (profile) =>
      !profile?.businessId &&
      normalizeBusinessIdentityName(getIdentifiableUnlinkedBusinessProfileName(profile)) ===
        businessName
  );
  const targetProfileId = cleanText(args.targetProfileId, 200);
  if (targetProfileId) {
    const selected = ownerProfiles.find(
      (profile) => String(profile?.id || "") === String(targetProfileId)
    );
    if (
      !selected ||
      selected.businessId ||
      !matches.some((profile) => String(profile.id) === String(selected.id))
    ) {
      throw new BusinessProfileSelectionRequiredError(matches);
    }
    return selected;
  }
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  const activeMatches = matches.filter(
    (profile) => String(profile?.id || "") === String(args.activeProfileId || "")
  );
  if (activeMatches.length === 1) return activeMatches[0];
  throw new BusinessProfileSelectionRequiredError(matches);
}

function requireBusinessStorage(storage: StorageLike) {
  const required = [
    "getActiveBusinessForUser",
    "listBusinessesByOwner",
    "listUnclaimedOutcomeBusinesses",
    "listProfilesByOwner",
    "createBusinessForOwner",
    "updateBusinessForOwner",
    "createProfileForOwner",
    "updateProfileForOwner",
  ] as const;
  for (const method of required) {
    if (typeof storage[method] !== "function") {
      throw new Error(`Outcome onboarding storage is missing ${method}`);
    }
  }
}

async function completeBusinessOutcomeFallback(
  storage: StorageLike,
  args: AtomicBusinessOutcomeArgs
): Promise<{ business: any; profile: any }> {
  requireBusinessStorage(storage);
  const user = await storage.getUser(args.userId);
  if (!user) throw new Error("User not found");
  const enrichment =
    getStoredOutcomeBusinessEnrichment(user.preferences, args.evidence) || args.enrichment;

  const ownerProfiles = await storage.listProfilesByOwner!(args.userId);
  const activeProfile = user.activeProfileId
    ? ownerProfiles.find((candidate: any) => String(candidate.id) === String(user.activeProfileId))
    : undefined;
  const target = resolveOwnedBusinessOutcomeTarget(
    await storage.listBusinessesByOwner!(args.userId),
    {
      activeBusinessId: user.activeBusinessId,
      evidence: args.evidence,
      fallbackIdentityName:
        getIdentifiableUnlinkedBusinessProfileName(activeProfile) ||
        deriveBusinessNameFromLinks(args.evidence.links),
    }
  );
  let business = target.business;
  const displayName = target.displayName;

  // Resolve profile identity before any fallback mutation. Production uses a
  // transaction, but test/adapter storage must also fail without partial writes.
  const preflightBusiness = business || { name: displayName };
  const linkedProfiles = business
    ? ownerProfiles.filter(
        (profile: any) => String(profile.businessId || "") === String(business.id)
      )
    : [];
  if (linkedProfiles.length > 1) {
    throw new Error("Business has multiple linked canonical profiles");
  }
  let profile = linkedProfiles[0];
  if (
    profile &&
    args.evidence.targetProfileId &&
    String(profile.id) !== String(args.evidence.targetProfileId)
  ) {
    throw new BusinessProfileSelectionRequiredError([profile]);
  }
  if (!profile) {
    profile = resolveUnlinkedBusinessProfileTarget(ownerProfiles, {
      business: preflightBusiness,
      activeProfileId: user.activeProfileId,
      targetProfileId: args.evidence.targetProfileId,
    });
  }

  if (business) {
    const nextProfileData = mergeOutcomeBusinessProfileData(business.profileData, args.evidence, {
      isNew: false,
      enrichment,
    });
    if (!sameJson(nextProfileData, business.profileData) || business.status !== "active") {
      business = await storage.updateBusinessForOwner!(args.userId, business.id, {
        profileData: nextProfileData,
        status: "active",
      });
    }
  } else {
    const claimableMatches = findDefensibleUnclaimedBusinessMatches(
      await storage.listUnclaimedOutcomeBusinesses!(),
      { displayName, links: args.evidence.links }
    );
    if (claimableMatches.length > 1) {
      throw new BusinessClaimRequiredError({ name: displayName });
    }
    if (claimableMatches.length > 0) {
      throw new BusinessClaimRequiredError(claimableMatches[0]);
    }
    business = await storage.createBusinessForOwner!(args.userId, {
      name: displayName,
      slug: displayName,
      type: "other",
      roleContext: "business_owner",
      profileData: mergeOutcomeBusinessProfileData({}, args.evidence, {
        isNew: true,
        enrichment,
      }),
      status: "active",
      publicDiscoveryEnabled: true,
      sources: ["selective_intelligence_onboarding"],
    });
  }

  const contentBlocks = buildOutcomeProfileContentBlocks(profile?.contentBlocks, {
    displayName: cleanPublicText(profile?.displayName, 180) || displayName,
    evidence: args.evidence,
    enrichment,
    isNew: !profile,
  });

  if (profile) {
    if (
      !sameJson(profile.contentBlocks, contentBlocks) ||
      profile.status !== "published" ||
      String(profile.businessId || "") !== String(business.id)
    ) {
      profile = await storage.updateProfileForOwner!(args.userId, profile.id, {
        businessId: business.id,
        roleContext: business.roleContext || profile.roleContext || "business_owner",
        contentBlocks,
        status: "published",
      });
    }
  } else {
    const seoDescription = cleanPublicText((business.profileData as any)?.description, 320);
    profile = await storage.createProfileForOwner!(args.userId, {
      businessId: business.id,
      roleContext: business.roleContext || "business_owner",
      slug: business.slug || displayName,
      displayName,
      headline: null,
      contentBlocks,
      ctaConfig: {},
      seoMeta: {
        title: displayName,
        ...(seoDescription ? { description: seoDescription } : {}),
      },
      status: "published",
    });
  }

  const latestUser = await storage.getUser(args.userId);
  await storage.updateUser(args.userId, {
    activeBusinessId: business.id,
    activeProfileId: profile.id,
    onboardingCompleted: true,
    profileVersion: CURRENT_PROFILE_VERSION,
    preferences: buildOutcomePreferences(latestUser?.preferences, {
      ...args,
      ...(enrichment ? { enrichment } : {}),
      kind: "business_profile",
      businessId: business.id,
      profileId: profile.id,
      resultRoute: `/u/${encodeURIComponent(String(profile.slug))}?edit=1`,
    }),
  });
  return { business, profile };
}

async function preflightBusinessOutcome(
  storage: StorageLike,
  userId: string,
  evidence: NormalizedOutcomeBusinessEvidence
): Promise<void> {
  if (typeof storage.preflightOutcomeBusinessProfile === "function") {
    await storage.preflightOutcomeBusinessProfile({ userId, evidence });
    return;
  }
  if (
    typeof storage.listBusinessesByOwner !== "function" ||
    typeof storage.listProfilesByOwner !== "function" ||
    typeof storage.listUnclaimedOutcomeBusinesses !== "function"
  ) {
    return;
  }

  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const ownerProfiles = await storage.listProfilesByOwner(userId);
  const activeProfile = user.activeProfileId
    ? ownerProfiles.find((profile: any) => String(profile.id) === String(user.activeProfileId))
    : undefined;
  const target = resolveOwnedBusinessOutcomeTarget(await storage.listBusinessesByOwner(userId), {
    activeBusinessId: user.activeBusinessId,
    evidence,
    fallbackIdentityName:
      getIdentifiableUnlinkedBusinessProfileName(activeProfile) ||
      deriveBusinessNameFromLinks(evidence.links),
  });
  const business = target.business;
  const linkedProfiles = business
    ? ownerProfiles.filter(
        (profile: any) => String(profile.businessId || "") === String(business.id)
      )
    : [];
  if (linkedProfiles.length > 1) {
    throw new Error("Business has multiple linked canonical profiles");
  }
  const linkedProfile = linkedProfiles[0];
  if (
    linkedProfile &&
    evidence.targetProfileId &&
    String(linkedProfile.id) !== String(evidence.targetProfileId)
  ) {
    throw new BusinessProfileSelectionRequiredError([linkedProfile]);
  }
  if (!linkedProfile) {
    resolveUnlinkedBusinessProfileTarget(ownerProfiles, {
      business: business || { name: target.displayName },
      activeProfileId: user.activeProfileId,
      targetProfileId: evidence.targetProfileId,
    });
  }
  if (!business) {
    const claimableMatches = findDefensibleUnclaimedBusinessMatches(
      await storage.listUnclaimedOutcomeBusinesses(),
      { displayName: target.displayName, links: evidence.links }
    );
    if (claimableMatches.length > 1) {
      throw new BusinessClaimRequiredError({ name: target.displayName });
    }
    if (claimableMatches.length === 1) {
      throw new BusinessClaimRequiredError(claimableMatches[0]);
    }
  }
}

export async function completeOutcomeOnboarding(
  storage: StorageLike,
  args: {
    userId: string;
    kind: OutcomeOnboardingKind;
    goal: string;
    next?: string;
    business?: OutcomeBusinessEvidence;
  },
  dependencies: OutcomeOnboardingDependencies = {}
): Promise<OutcomeOnboardingResult> {
  const goal = cleanText(args.goal, 2_000);
  if (!goal) throw new Error("Onboarding goal is required");
  const completedAt = nowIso();

  if (args.kind === "express_result") {
    const safeNext = safeOutcomeNextPath(args.next);
    const resultRoute = safeNext || "/scout?source=onboarding_result";
    const atomicArgs: AtomicExpressOutcomeArgs = {
      userId: args.userId,
      goal,
      resultRoute,
      completedAt,
    };
    if (typeof storage.completeOutcomeExpressResult === "function") {
      await storage.completeOutcomeExpressResult(atomicArgs);
    } else {
      const user = await storage.getUser(args.userId);
      if (!user) throw new Error("User not found");
      await storage.updateUser(args.userId, {
        onboardingCompleted: true,
        profileVersion: CURRENT_PROFILE_VERSION,
        preferences: buildOutcomePreferences(user.preferences, {
          ...atomicArgs,
          kind: "express_result",
        }),
      });
    }
    await safeLogEvent(storage, "onboarding_completed", {
      userId: args.userId,
      outcomeKind: "express_result",
    });
    return {
      kind: "express_result",
      resultRoute,
      ...(safeNext ? {} : { resultPrompt: goal }),
      outcomeTitle: "Your TradeScout result is ready",
    };
  }

  const evidence = normalizeOutcomeBusinessEvidence(args.business);
  try {
    await preflightBusinessOutcome(storage, args.userId, evidence);
  } catch (error) {
    if (error instanceof BusinessClaimRequiredError) {
      return {
        kind: "business_claim_required",
        resultRoute: error.resultRoute,
        outcomeTitle: "Claim this existing business before we build its profile",
        claim: {
          ...(error.businessId ? { businessId: error.businessId } : {}),
          name: error.businessName,
          ...(error.businessSlug ? { slug: error.businessSlug } : {}),
        },
      };
    }
    throw error;
  }
  const enrichment = await resolveOutcomeBusinessEnrichment(
    storage,
    args.userId,
    evidence,
    dependencies
  );
  const atomicArgs: AtomicBusinessOutcomeArgs = {
    userId: args.userId,
    goal,
    evidence,
    ...(enrichment ? { enrichment } : {}),
    completedAt,
  };
  let completed: { business: any; profile: any };
  try {
    completed =
      typeof storage.completeOutcomeBusinessProfile === "function"
        ? await storage.completeOutcomeBusinessProfile(atomicArgs)
        : await completeBusinessOutcomeFallback(storage, atomicArgs);
  } catch (error) {
    if (error instanceof BusinessClaimRequiredError) {
      return {
        kind: "business_claim_required",
        resultRoute: error.resultRoute,
        outcomeTitle: "Claim this existing business before we build its profile",
        claim: {
          ...(error.businessId ? { businessId: error.businessId } : {}),
          name: error.businessName,
          ...(error.businessSlug ? { slug: error.businessSlug } : {}),
        },
      };
    }
    throw error;
  }
  const businessId = String(completed.business?.id || "").trim();
  const profileId = String(completed.profile?.id || "").trim();
  const slug = String(completed.profile?.slug || "").trim();
  if (!businessId || !profileId || !slug) {
    throw new Error("Outcome onboarding did not produce a canonical business profile");
  }

  await safeLogEvent(storage, "onboarding_completed", {
    userId: args.userId,
    outcomeKind: "business_profile",
    businessId,
    profileId,
  });
  return {
    kind: "business_profile",
    resultRoute: `/u/${encodeURIComponent(slug)}?edit=1`,
    outcomeTitle: "Your public profile is ready",
    profile: {
      id: profileId,
      slug,
      businessId,
      saved: true,
      published: true,
      discovery: "verification_gated",
    },
  };
}

export function mapLegacyLaneToUnified(legacyLane?: string | null): {
  lane?: OnboardingLane;
  asset?: OnboardingAsset;
  claimType?: OnboardingClaimType;
} {
  const key = String(legacyLane || "")
    .trim()
    .toLowerCase();
  return LEGACY_LANE_MAP[key] || {};
}

export async function getUnifiedOnboardingStatus(storage: StorageLike, userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  return getOnboardingState(user);
}
