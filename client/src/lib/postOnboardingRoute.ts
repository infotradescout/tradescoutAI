/**
 * Canonical auth and onboarding routing.
 *
 * Onboarding has one state transition: an authenticated account either still
 * needs an outcome or it has completed onboarding. Personal profile fields,
 * location, business role, verification, and finance modules do not create
 * separate onboarding lanes.
 */

export type DirectConnectEntry = "default" | "auth" | "setup" | "onboarding" | "intent";
export type OnboardingState = "needs_outcome" | "complete";
export type AuthEntryMode = "create" | "signin";

export const DIRECT_CONNECT_HOME = "/direct-connect";
export const SCOUT_HOME = "/scout";
export const DEFAULT_AUTH_COMPLETION_ROUTE = "/onboarding";

export const DEFAULT_LANDING = DIRECT_CONNECT_HOME;
export const BUSINESS_LANDING = "/offer-services";

function withDirectConnectEntry(path: string, entry: DirectConnectEntry = "default"): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}entry=${entry}`;
}

export function isSafeNextPath(path: string): boolean {
  if (!path || path.length > 2_048 || !path.startsWith("/") || path.startsWith("//")) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;

  let parsed: URL;
  try {
    parsed = new URL(path, "https://tradescout.internal");
  } catch {
    return false;
  }
  if (parsed.origin !== "https://tradescout.internal") return false;

  let decodedPathname = parsed.pathname;
  try {
    decodedPathname = decodeURIComponent(decodeURIComponent(decodedPathname));
  } catch {
    return false;
  }
  if (
    decodedPathname.startsWith("//") ||
    decodedPathname.includes("\\") ||
    /[?#]/.test(decodedPathname) ||
    /[\u0000-\u001f\u007f]/.test(decodedPathname) ||
    /^\/(?:https?:|javascript:|data:|file:)/i.test(decodedPathname)
  ) {
    return false;
  }

  let canonicalPathname: string;
  try {
    const canonical = new URL(decodedPathname, "https://tradescout.internal");
    if (canonical.origin !== "https://tradescout.internal") return false;
    canonicalPathname = canonical.pathname;
  } catch {
    return false;
  }

  const normalizedPath = canonicalPathname.replace(/\/+$/, "") || "/";
  const normalizedLower = normalizedPath.toLocaleLowerCase();
  const isNonPageNamespace =
    normalizedLower.startsWith("/_") ||
    ["/api", "/.well-known", "/assets", "/static", "/src", "/node_modules"].some(
      (prefix) => normalizedLower === prefix || normalizedLower.startsWith(`${prefix}/`)
    );
  if (isNonPageNamespace) return false;
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
  return !createsAuthLoop;
}

export function buildAuthEntryRoute(options: {
  mode: AuthEntryMode;
  next?: string | null;
  email?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("mode", options.mode);

  const next = String(options.next || "").trim();
  params.set(
    "next",
    next && isSafeNextPath(next) && !next.startsWith("/pre-scout-setup")
      ? next
      : DEFAULT_AUTH_COMPLETION_ROUTE
  );

  const email = String(options.email || "").trim();
  if (email) params.set("email", email);
  return `/pre-scout-setup?${params.toString()}`;
}

export function resolveOnboardingState(user: unknown): OnboardingState {
  if (!user || typeof user !== "object") return "needs_outcome";
  return (user as Record<string, unknown>).onboardingCompleted === true
    ? "complete"
    : "needs_outcome";
}

export function userNeedsOnboarding(user: unknown): boolean {
  return resolveOnboardingState(user) !== "complete";
}

export function getCurrentInternalPath(pathname: unknown): string {
  const raw = String(pathname || "/");
  if (/[?#]/.test(raw)) return raw.startsWith("/") ? raw : `/${raw}`;
  const pathOnly = raw.startsWith("/") ? raw : `/${raw}`;
  if (typeof window === "undefined" || window.location.pathname !== pathOnly) return pathOnly;
  return `${pathOnly}${window.location.search}${window.location.hash}`;
}

export function userHasProfileBasics(user: unknown): boolean {
  return Boolean(user && typeof user === "object");
}

export function getOnboardingEntryRoute(_user: unknown): string {
  return DEFAULT_AUTH_COMPLETION_ROUTE;
}

export function getPostLandingRoute(user: unknown): string {
  if (userNeedsOnboarding(user)) return DEFAULT_AUTH_COMPLETION_ROUTE;

  const record = user as Record<string, unknown>;
  const role = typeof record?.role === "string" ? record.role : undefined;
  const roles = Array.isArray(record?.roles)
    ? record.roles.filter((value): value is string => typeof value === "string")
    : [];
  const isAdmin =
    role === "super_admin" ||
    role === "admin" ||
    record?.isSuperAdmin === true ||
    record?.isAdmin === true ||
    roles.some((value) => value === "admin" || value === "super_admin");

  if (isAdmin) return "/admin";
  return resolveDirectConnectLandingRoute({ entry: "auth" });
}

function isPublicProfileAccountPath(path: string): boolean {
  const normalized =
    String(path || "/")
      .trim()
      .toLowerCase()
      .replace(/\/+$/, "") || "/";
  if (normalized === "/jw-stone") return true;
  return /^\/u\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized);
}

export function isOnboardingExemptPath(path: string): boolean {
  const normalized = String(path || "/").replace(/\/+$/, "") || "/";
  return (
    isPublicProfileAccountPath(normalized) ||
    normalized === "/pre-scout-setup" ||
    normalized === "/onboarding" ||
    normalized === "/onboarding/profile" ||
    normalized === "/onboarding/intent" ||
    normalized === "/profile-setup" ||
    normalized === "/verify-email" ||
    normalized === "/check-email" ||
    normalized === "/reset-password" ||
    normalized === "/logout" ||
    normalized === "/auth/logout"
  );
}

export function isBusinessUser(
  user: Record<string, any> | null | undefined,
  presenceType?: string | null
): boolean {
  if (presenceType === "represent_business") return true;
  if (!user) return false;

  if (user?.preferences?.provisional?.profileDraft?.presenceType === "represent_business") {
    return true;
  }

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
  if (businessRoles.has(String(user.role || ""))) return true;
  if (businessRoles.has(String(user.activeRole || ""))) return true;

  const bundles = Array.isArray(user.capabilityBundles) ? user.capabilityBundles : [];
  return ["service_provider", "property_operator", "local_seller", "organization_admin"].some(
    (bundle) => bundles.includes(bundle)
  );
}

export function getBusinessOnboardingRoute(_user: Record<string, any> | null | undefined): null {
  return null;
}

export function isBusinessOnboardingAllowedPath(
  _path: string,
  _user: Record<string, any> | null | undefined
): boolean {
  return true;
}

export function resolvePostOnboardingRoute(options: {
  nextParam?: string | null;
  user?: Record<string, any> | null;
  presenceType?: string | null;
  chosenIntent?: string | null;
  entry?: DirectConnectEntry;
  hasOpenDirectConnectRequests?: boolean;
  hasDirectConnectReplies?: boolean;
}): string {
  const next = String(options.nextParam || "").trim();
  return next && isSafeNextPath(next) ? next : SCOUT_HOME;
}

export function resolveDirectConnectLandingRoute(
  options: {
    entry?: DirectConnectEntry;
    hasOpenRequests?: boolean | null;
    hasReplies?: boolean | null;
  } = {}
): string {
  const { entry = "default", hasOpenRequests, hasReplies } = options;
  if (hasReplies) return withDirectConnectEntry("/direct-connect/inbox", entry);
  if (hasOpenRequests) return withDirectConnectEntry("/direct-connect/engagements", entry);
  return withDirectConnectEntry(DIRECT_CONNECT_HOME, entry);
}

const NEXT_STORAGE_KEY = "ts_onboarding_next";

export function storeOnboardingNext(path: string): void {
  if (!isSafeNextPath(path)) return;
  try {
    sessionStorage.setItem(NEXT_STORAGE_KEY, path);
  } catch {
    // SSR/private browsing
  }
}

export function consumeOnboardingNext(): string | null {
  try {
    const value = sessionStorage.getItem(NEXT_STORAGE_KEY);
    if (value) sessionStorage.removeItem(NEXT_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
