import { buildAuthEntryRoute } from "@/lib/postOnboardingRoute";
import { COMPATIBILITY_REDIRECT_ALIASES } from "@/routing/compatibilityRedirects";

// Centralized route configuration to prevent drift
export const ROUTES = {
  // Public routes
  HOME: "/",
  LOGIN: buildAuthEntryRoute({ mode: "signin" }),
  REGISTER: buildAuthEntryRoute({ mode: "create" }),
  FIND_CONTRACTORS: "/contractors",
  CONTRACTORS: "/contractors",
  MARKETPLACE: "/marketplace",
  EXCHANGE: "/exchange",
  COMMUNITY: "/community",
  FOR_BUSINESSES: "/for-businesses",
  FIND_LOCAL_BUSINESSES: "/find-local-businesses",
  HELP: "/help",
  NOTES: "/notes",
  PRICING: "/pricing",

  // Protected routes (require auth)
  DASHBOARD: "/direct-connect",
  PROFILE: "/profile",
  CONVERSATIONS: "/messages",
  SETTINGS: "/settings",

  // Contractor routes
  BUSINESS_DASHBOARD: "/business-dashboard",
  BUSINESS_APPLY: "/claim-my-business",
  BUSINESS_REQUESTS: "/direct-connect/inbox",
  CONTRACTOR_DASHBOARD: "/business-dashboard",
  CONTRACTOR_APPLY: "/claim-my-business",
  CONTRACTOR_BOARD: "/contractor-board",
  CONTRACTORS_LANDING: "/contractors",
  connections: "/connections",

  // Admin routes (require admin role)
  ADMIN_PANEL: "/admin/panel",
  ADMIN_DASHBOARD: "/admin",
  ADMIN_USERS: "/admin/users",

  // Legal pages
  TERMS: "/terms",
  PRIVACY: "/privacy",
  COOKIES: "/cookies",

  // Route aliases for backward compatibility
  ALIASES: COMPATIBILITY_REDIRECT_ALIASES,
} as const;

export type RouteKey = keyof typeof ROUTES;

// Route guards - Full platform access restored
export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FIND_CONTRACTORS,
  ROUTES.CONTRACTORS,
  ROUTES.EXCHANGE,
  ROUTES.COMMUNITY,
  ROUTES.FOR_BUSINESSES,
  ROUTES.FIND_LOCAL_BUSINESSES,
  ROUTES.HELP,
  ROUTES.PRICING,
  ROUTES.NOTES,
  ROUTES.TERMS,
  ROUTES.PRIVACY,
  ROUTES.COOKIES,
  ROUTES.CONTRACTOR_BOARD,
];

export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.PROFILE,
  ROUTES.CONVERSATIONS,
  ROUTES.SETTINGS,
  ROUTES.CONTRACTOR_DASHBOARD,
  ROUTES.ADMIN_PANEL,
  "/admin/*", // All admin routes protected
];

export const ADMIN_ROUTES = [
  ROUTES.ADMIN_PANEL,
  ROUTES.ADMIN_DASHBOARD,
  ROUTES.ADMIN_USERS,
  // Added pricing analytics route to admin routes
  "/admin/pricing",
];

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.includes(path as any);
}

export function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTES.includes(path as any);
}

export function isAdminRoute(path: string): boolean {
  return ADMIN_ROUTES.includes(path as any);
}
