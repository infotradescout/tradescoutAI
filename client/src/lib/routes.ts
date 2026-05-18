// Centralized route configuration to prevent drift
export const ROUTES = {
  // Public routes
  HOME: "/",
  LOGIN: "/pre-scout-setup?mode=signin",
  REGISTER: "/pre-scout-setup?mode=create",
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
  CONVERSATIONS: "/conversations",
  SETTINGS: "/settings",

  // Contractor routes
  BUSINESS_DASHBOARD: "/business-dashboard",
  BUSINESS_APPLY: "/businesses/apply",
  BUSINESS_REQUESTS: "/business/requests",
  CONTRACTOR_DASHBOARD: "/business-dashboard",
  CONTRACTOR_APPLY: "/businesses/apply",
  CONTRACTOR_BOARD: "/contractor-board",
  CONTRACTORS_LANDING: "/contractors",
  connections: "/connections",

  // Admin routes (require admin role)
  ADMIN_PANEL: "/admin",
  ADMIN_DASHBOARD: "/admin",
  ADMIN_USERS: "/admin/users",

  // Legal pages
  TERMS: "/terms",
  PRIVACY: "/privacy",
  COOKIES: "/cookies",

  // Route aliases for backward compatibility
  ALIASES: {
    "/dashboard/messages": "/conversations",
    "/marketplace": "/exchange",
    "/exchange/list": "/exchange",
    "/business-owner-dashboard": "/business-dashboard",
    "/contractor-dashboard": "/business-dashboard",
    "/contractor/dashboard": "/business-dashboard",
    "/contractors/dashboard": "/business-dashboard",
    "/contractor-leads": "/business/requests",
    "/contractor/leads": "/business/requests",
    "/contractors/apply": "/businesses/apply",
    "/contractor-apply": "/businesses/apply",
    "/admin-observability": "/admin/live-stream",
    "/staff/hardrock-directory": "/admin/commercial-directory",
    "/staff/share-links": "/admin/share-links",
    "/staff/inspection-intelligence": "/admin/inspection-intelligence",
    "/contractor-verification": "/admin/professional-verification",
    "/content-moderation": "/admin/moderation",
    "/system-settings": "/admin/site-settings",
    "/admin/contractors": "/admin/business-provider-settings",
    "/admin/contractor-settings": "/admin/business-provider-settings",
    "/support-tickets": "/admin/errors",
    "/platform-analytics": "/admin/platform-analytics",
    "/manage-users": "/admin/users",
    "/payment-processing": "/admin/payment-model",
    "/file-management": "/admin/attachments",
    "/admin-dashboard": "/admin",
    "/admin/dashboard": "/admin",
    "/admin-users": "/admin/users",
    "/admin-panel": "/admin/panel",
  },
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
