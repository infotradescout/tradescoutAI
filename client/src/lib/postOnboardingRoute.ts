/**
 * postOnboardingRoute.ts
 *
 * Single source of truth for where a user lands after completing (or skipping)
 * the onboarding flow.
 *
 * Priority order:
 *  1. Explicit ?next= deep-link preserved across the funnel  (highest)
 *  2. Business / service-provider users → /offer-services (profile + verification)
 *  3. All other users → /direct-connect                     (default)
 *
 * "Business user" is detected from the presenceType captured in pre-scout-setup
 * (stored in preferences.provisional.profileDraft.presenceType) OR from the
 * user's resolved role/capabilityBundles after onboarding completes.
 *
 * SAFE ROUTES: Only paths that belong to TradeScout are allowed as ?next= values.
 * Anything external or suspicious falls back to the default.
 */

/** Routes that are considered "safe" deep-link destinations. */
const SAFE_NEXT_PREFIXES = [
  "/direct-connect",
  "/community",
  "/community-feed",
  "/contractors",
  "/offer-services",
  "/scout",
  "/marketplace",
  "/profile",
  "/directory",
  "/projects",
  "/dashboard",
  "/verification",
  "/admin/professional-verification",
  "/admin/business-provider-settings",
  "/admin/contractors",
  "/admin/contractor-settings",
  "/contractor-verification",
  "/content-moderation",
  "/admin/dashboard",
  "/admin-panel",
  "/admin-dashboard",
  "/admin-users",
  "/admin/workspace",
  "/staff/hardrock-directory",
  "/staff/share-links",
  "/staff/inspection-intelligence",
  "/system-settings",
  "/support-tickets",
  "/platform-analytics",
  "/manage-users",
  "/payment-processing",
  "/file-management",
  "/admin-observability",
  "/address-verification",
  "/identity-verification",
  "/insurance-verification",
  "/license-verification",
  "/settings",
];

import { hasCompletedSetup } from "@/lib/setupState";

export type DirectConnectEntry = "default" | "auth" | "setup" | "onboarding" | "intent";
export type OnboardingState = "needs_profile" | "needs_intent" | "complete";
type BusinessOnboardingModuleId =
  | "identity_profile"
  | "service_catalog"
  | "coverage_availability"
  | "trust_verification"
  | "operations_payout";
type BusinessOnboardingModuleStatus = "not_started" | "in_progress" | "complete";

/** Canonical Direct Connect home surface. */
export const DIRECT_CONNECT_HOME = "/direct-connect";

/** Default landing surface for regular (non-business) users. */
export const SCOUT_HOME = "/scout";
export const DEFAULT_LANDING = DIRECT_CONNECT_HOME;

/** Default landing surface for business / service-provider users. */
export const BUSINESS_LANDING = "/offer-services?onboarding=business";
const BUSINESS_MODULE_ROUTE: Record<BusinessOnboardingModuleId, string> = {
  identity_profile: "/profile",
  service_catalog: "/offer-services#fixed-price-offers",
  coverage_availability: "/settings?tab=profile",
  trust_verification: "/identity-verification",
  operations_payout: "/finances/records",
};
const BUSINESS_MODULE_ALLOWED_PREFIXES: Record<BusinessOnboardingModuleId, string[]> = {
  identity_profile: ["/profile", "/settings"],
  service_catalog: ["/offer-services"],
  coverage_availability: ["/settings", "/profile"],
  trust_verification: [
    "/identity-verification",
    "/address-verification",
    "/license-verification",
    "/insurance-verification",
    "/offer-services",
  ],
  operations_payout: ["/finances", "/offer-services"],
};

function withDirectConnectEntry(path: string, entry: DirectConnectEntry = "default"): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}entry=${entry}`;
}

/**
 * Returns true if the given path is a safe, trusted internal destination.
 */
export function isSafeNextPath(path: string): boolean {
  if (!path || !path.startsWith("/")) return false;
  // Reject anything that looks like a protocol or double-slash (open redirect)
  if (/^\/\/|:\/\//.test(path)) return false;
  return SAFE_NEXT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")
  );
}

export function userNeedsOnboarding(user: unknown): boolean {
  return resolveOnboardingState(user) !== "complete";
}

function hasLocalArea(user: Record<string, any>): boolean {
  const locationCommitted = user.locationCommitted === true;
  const stateCode = typeof user.stateCode === "string" ? user.stateCode.trim().toUpperCase() : "";
  const countyFips = typeof user.countyFips === "string" ? user.countyFips.trim() : "";
  return locationCommitted && stateCode.length === 2 && /^\d{5}$/.test(countyFips);
}

function hasSelectedIntent(user: Record<string, any>): boolean {
  const lane =
    user?.preferences?.onboarding?.state?.lane ||
    user?.preferences?.onboardingState?.lane ||
    user?.preferences?.unifiedOnboarding?.state?.lane ||
    user?.preferences?.onboarding?.lane;
  return typeof lane === "string" && lane.trim().length > 0;
}

function hasBusinessProfileBasics(user: Record<string, any>): boolean {
  const businessName =
    (typeof user.businessName === "string" && user.businessName.trim()) ||
    (typeof user.companyName === "string" && user.companyName.trim()) ||
    (typeof user?.preferences?.businessProfile?.businessName === "string" &&
      user.preferences.businessProfile.businessName.trim()) ||
    (typeof user?.preferences?.provisional?.profileDraft?.businessName === "string" &&
      user.preferences.provisional.profileDraft.businessName.trim()) ||
    "";

  const businessType =
    (typeof user.businessType === "string" && user.businessType.trim()) ||
    (typeof user?.preferences?.businessProfile?.businessType === "string" &&
      user.preferences.businessProfile.businessType.trim()) ||
    (typeof user?.preferences?.provisional?.profileDraft?.businessType === "string" &&
      user.preferences.provisional.profileDraft.businessType.trim()) ||
    "";

  return businessName.length > 0 && businessType.length > 0;
}

export function resolveOnboardingState(user: unknown): OnboardingState {
  if (!user || typeof user !== "object") return "needs_profile";
  const record = user as Record<string, any>;

  const explicitCompletion = record.onboardingCompleted === true;
  if (explicitCompletion) return "complete";

  if (!hasLocalArea(record)) return "needs_profile";

  const locationCommitted = record.locationCommitted === true;
  const locationShapeComplete = hasCompletedSetup({
    onboardingCompleted: record.onboardingCompleted,
    profileVersion: record.profileVersion,
    locationCommitted,
    stateCode: locationCommitted ? record.stateCode : null,
    countyFips: locationCommitted ? record.countyFips : null,
  });
  if (!locationShapeComplete) return "needs_profile";

  if (!userHasProfileBasics(user)) return "needs_profile";

  if (isBusinessUser(record, null) && !hasBusinessProfileBasics(record)) {
    return "needs_profile";
  }

  return hasSelectedIntent(record) ? "complete" : "needs_intent";
}

export function userHasProfileBasics(user: unknown): boolean {
  const record = user && typeof user === "object" ? (user as Record<string, unknown>) : null;
  if (!record) return false;

  const firstName = typeof record.firstName === "string" ? record.firstName.trim() : "";
  const lastName = typeof record.lastName === "string" ? record.lastName.trim() : "";
  const fullName =
    typeof record.name === "string"
      ? record.name.trim()
      : typeof record.displayName === "string"
        ? record.displayName.trim()
        : "";
  const hasName =
    (firstName.length > 0 && lastName.length > 0) ||
    fullName.split(/\s+/).filter(Boolean).length >= 2 ||
    fullName.length >= 3;
  const phoneRaw = typeof record.phone === "string" ? record.phone.trim() : "";
  const phoneDigits = phoneRaw.replace(/\D+/g, "");
  const stateCode =
    typeof record.stateCode === "string" ? record.stateCode.trim().toUpperCase() : "";
  const countyFips = typeof record.countyFips === "string" ? record.countyFips.trim() : "";

  return (
    hasName && phoneDigits.length >= 10 && stateCode.length === 2 && /^\d{5}$/.test(countyFips)
  );
}

export function getOnboardingEntryRoute(user: unknown): string {
  return resolveOnboardingState(user) === "needs_intent"
    ? "/onboarding/intent"
    : "/onboarding/profile";
}

export function getPostLandingRoute(user: unknown): string {
  const onboardingState = resolveOnboardingState(user);
  if (onboardingState !== "complete") return getOnboardingEntryRoute(user);

  const record = user && typeof user === "object" ? (user as Record<string, unknown>) : null;
  const role: string | undefined = typeof record?.role === "string" ? record.role : undefined;
  const isSuperAdmin = role === "super_admin" || role === "admin" || record?.isSuperAdmin === true;

  const rolesValue = record?.roles;
  const roles: string[] = Array.isArray(rolesValue)
    ? rolesValue.filter((r: unknown): r is string => typeof r === "string")
    : [];
  const isAdmin =
    Boolean(record?.isAdmin) || roles.some((r) => r === "admin" || r === "super_admin");

  if (isSuperAdmin || isAdmin) return "/admin";
  if (isBusinessUser(record as Record<string, any>, null)) {
    const businessRoute = getBusinessOnboardingRoute(record as Record<string, any>);
    if (businessRoute) return businessRoute;
  }
  return resolveDirectConnectLandingRoute({ entry: "auth" });
}

export function isOnboardingExemptPath(path: string): boolean {
  return (
    path.startsWith("/pre-scout-setup") ||
    path.startsWith("/onboarding/profile") ||
    path.startsWith("/onboarding/intent") ||
    path.startsWith("/verify-email") ||
    path.startsWith("/check-email") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/logout") ||
    path.startsWith("/auth/logout")
  );
}

/**
 * Detects whether the user should be treated as a business / service-provider
 * based on the data available at the time of the call.
 *
 * @param user - The user object from useAuth() (may be partially populated)
 * @param presenceType - The presenceType captured during pre-scout-setup
 */
export function isBusinessUser(
  user: Record<string, any> | null | undefined,
  presenceType?: string | null
): boolean {
  // 1. Explicit presenceType from pre-scout-setup form
  if (presenceType === "represent_business") return true;

  if (!user) return false;

  // 2. Provisional draft in preferences (set during pre-scout-setup before commit)
  const provisional = user?.preferences?.provisional;
  const draftPresence = provisional?.profileDraft?.presenceType;
  if (draftPresence === "represent_business") return true;

  // 3. Resolved role after complete-onboarding
  const businessRoles = new Set([
    "contractor",
    "business_owner",
    "property_manager",
    "service_provider",
    "realtor",
    "mortgage_broker",
    "insurance_agent",
    "title_company",
    "car_dealer",
    "auto_service",
    "franchise_owner",
    "startup_founder",
    "commercial_property",
    "affiliate",
  ]);
  if (user.role && businessRoles.has(user.role)) return true;
  if (user.activeRole && businessRoles.has(user.activeRole)) return true;

  // 4. Capability bundles
  const bundles: string[] = Array.isArray(user.capabilityBundles) ? user.capabilityBundles : [];
  if (
    bundles.includes("service_provider") ||
    bundles.includes("property_operator") ||
    bundles.includes("local_seller") ||
    bundles.includes("organization_admin")
  ) {
    return true;
  }

  return false;
}

export function getFirstIncompleteBusinessModule(
  user: Record<string, any> | null | undefined
): BusinessOnboardingModuleId | null {
  if (!user) return null;
  const modules = user?.preferences?.businessOnboarding?.modules as
    | Partial<Record<BusinessOnboardingModuleId, BusinessOnboardingModuleStatus>>
    | undefined;
  if (!modules || typeof modules !== "object") return "identity_profile";
  const moduleOrder: BusinessOnboardingModuleId[] = [
    "identity_profile",
    "service_catalog",
    "coverage_availability",
    "trust_verification",
    "operations_payout",
  ];
  for (const moduleId of moduleOrder) {
    const status = String(modules[moduleId] || "not_started");
    if (status !== "complete") return moduleId;
  }
  return null;
}

export function getBusinessOnboardingRoute(
  user: Record<string, any> | null | undefined
): string | null {
  if (!isBusinessUser(user, null)) return null;
  const moduleId = getFirstIncompleteBusinessModule(user);
  if (!moduleId) return BUSINESS_LANDING;
  let moduleRoute = BUSINESS_MODULE_ROUTE[moduleId];
  if (moduleId === "trust_verification") {
    const identityVerified =
      user?.verifiedBadge === true ||
      String(user?.verificationStatus || "")
        .trim()
        .toLowerCase() === "approved";
    const addressVerified = user?.addressVerified === true;
    const licenseVerified = user?.licenseVerified === true;
    const insuranceVerified = user?.insuranceVerified === true;
    moduleRoute = !identityVerified
      ? "/identity-verification"
      : !addressVerified
        ? "/address-verification"
        : !licenseVerified
          ? "/license-verification"
          : !insuranceVerified
            ? "/insurance-verification"
            : "/offer-services";
  }
  const encoded = encodeURIComponent(moduleId);
  if (moduleRoute.includes("?")) return `${moduleRoute}&onboarding=business&module=${encoded}`;
  if (moduleRoute.includes("#")) {
    const [base, hash] = moduleRoute.split("#", 2);
    return `${base}?onboarding=business&module=${encoded}#${hash}`;
  }
  return `${moduleRoute}?onboarding=business&module=${encoded}`;
}

export function isBusinessOnboardingAllowedPath(
  path: string,
  user: Record<string, any> | null | undefined
): boolean {
  if (!isBusinessUser(user, null)) return true;
  const moduleId = getFirstIncompleteBusinessModule(user);
  if (!moduleId) return true;
  const normalized =
    String(path || "/")
      .split(/[?#]/, 1)[0]
      .replace(/\/+$/, "") || "/";
  const allowedPrefixes = BUSINESS_MODULE_ALLOWED_PREFIXES[moduleId] || ["/offer-services"];
  return allowedPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

/**
 * Compute the correct post-onboarding destination.
 *
 * @param options.nextParam   - The ?next= query param value (from URL or sessionStorage)
 * @param options.user        - The current user object
 * @param options.presenceType - presenceType from the pre-scout-setup form
 * @param options.chosenIntent - The intent the user clicked (community/services/business/tools)
 */
export function resolvePostOnboardingRoute(options: {
  nextParam?: string | null;
  user?: Record<string, any> | null;
  presenceType?: string | null;
  chosenIntent?: string | null;
  entry?: DirectConnectEntry;
  hasOpenDirectConnectRequests?: boolean;
  hasDirectConnectReplies?: boolean;
}): string {
  const {
    nextParam,
    user,
    presenceType,
    chosenIntent,
    entry = "onboarding",
    hasOpenDirectConnectRequests,
    hasDirectConnectReplies,
  } = options;

  // 1. Honour an explicit, safe deep-link
  const trimmedNext = (nextParam || "").trim();
  if (trimmedNext && isSafeNextPath(trimmedNext)) {
    return trimmedNext;
  }

  // 2. If the user explicitly chose an intent on the intent screen, respect it
  //    (but still override with the business landing if they chose "business")
  const INTENT_ROUTES: Record<string, string> = {
    community: withDirectConnectEntry("/direct-connect/board", entry),
    services: resolveDirectConnectLandingRoute({
      entry,
      hasOpenRequests: hasOpenDirectConnectRequests,
      hasReplies: hasDirectConnectReplies,
    }),
    business: BUSINESS_LANDING,
    tools: withDirectConnectEntry("/direct-connect", entry),
  };
  if (chosenIntent && INTENT_ROUTES[chosenIntent]) {
    return INTENT_ROUTES[chosenIntent];
  }

  // 3. Business users → profile/verification setup
  if (isBusinessUser(user, presenceType)) {
    const businessRoute = getBusinessOnboardingRoute(user);
    return businessRoute || BUSINESS_LANDING;
  }

  // 4. Default: Direct Connect request flow
  return resolveDirectConnectLandingRoute({ entry });
}

export function resolveDirectConnectLandingRoute(
  options: {
    entry?: DirectConnectEntry;
    hasOpenRequests?: boolean | null;
    hasReplies?: boolean | null;
  } = {}
): string {
  const { entry = "default", hasOpenRequests, hasReplies } = options;

  if (hasReplies) {
    return withDirectConnectEntry("/direct-connect/inbox", entry);
  }

  if (hasOpenRequests) {
    return withDirectConnectEntry("/direct-connect/engagements", entry);
  }

  return withDirectConnectEntry(DIRECT_CONNECT_HOME, entry);
}

// ─── Session-storage helpers for deep-link preservation ──────────────────────

const NEXT_STORAGE_KEY = "ts_onboarding_next";

/**
 * Persist the ?next= value before entering the onboarding funnel so it
 * survives page navigations within the funnel.
 */
export function storeOnboardingNext(path: string): void {
  if (isSafeNextPath(path)) {
    try {
      sessionStorage.setItem(NEXT_STORAGE_KEY, path);
    } catch {
      /* SSR / private browsing */
    }
  }
}

/**
 * Retrieve the stored ?next= value and clear it from storage.
 */
export function consumeOnboardingNext(): string | null {
  try {
    const value = sessionStorage.getItem(NEXT_STORAGE_KEY);
    if (value) sessionStorage.removeItem(NEXT_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
