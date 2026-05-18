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

export type DirectConnectEntry = "default" | "auth" | "setup" | "onboarding" | "intent";

/** Canonical Direct Connect home surface. */
export const DIRECT_CONNECT_HOME = "/direct-connect";

/** Default landing surface for regular (non-business) users. */
export const DEFAULT_LANDING = `${DIRECT_CONNECT_HOME}?entry=default`;

/** Default landing surface for business / service-provider users. */
export const BUSINESS_LANDING = "/offer-services";

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
    return BUSINESS_LANDING;
  }

  // 4. Default: Direct Connect
  return resolveDirectConnectLandingRoute({
    entry,
    hasOpenRequests: hasOpenDirectConnectRequests,
    hasReplies: hasDirectConnectReplies,
  });
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
