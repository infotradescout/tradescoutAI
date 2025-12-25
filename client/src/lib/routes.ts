// Centralized route configuration to prevent drift
export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FIND_CONTRACTORS: '/contractors',
  CONTRACTORS: '/contractors',
  MARKETPLACE: '/marketplace',
  EXCHANGE: '/exchange',
  COMMUNITY: '/community',
  HELP: '/help',
  NOTES: '/notes',
  PRICING: '/pricing',

  // Protected routes (require auth)
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  CONVERSATIONS: '/conversations',
  SETTINGS: '/settings',

  // Contractor routes
  CONTRACTOR_DASHBOARD: '/contractor-dashboard',
  CONTRACTOR_APPLY: '/contractors/apply',
  CONTRACTOR_BOARD: '/contractor-board',
  CONTRACTORS_LANDING: '/contractors',
    connections: "/connections",

  // Admin routes (require admin role)
  ADMIN_PANEL: '/admin',
  ADMIN_DASHBOARD: '/admin-dashboard',
  ADMIN_USERS: '/admin-users',

  // Legal pages
  TERMS: '/terms',
  PRIVACY: '/privacy',
  COOKIES: '/cookies',

  // Route aliases for backward compatibility
  ALIASES: {
    '/dashboard/messages': '/conversations',
    '/marketplace': '/exchange',
    '/exchange/list': '/exchange',
    '/contractors/dashboard': '/contractor-dashboard'
  }
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
  '/admin/*'  // All admin routes protected
];

export const ADMIN_ROUTES = [
  ROUTES.ADMIN_PANEL,
  ROUTES.ADMIN_DASHBOARD,
  ROUTES.ADMIN_USERS,
  // Added pricing analytics route to admin routes
  '/admin/pricing-analytics'
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