// Centralized route configuration to prevent drift
export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  CONTRACTORS: '/contractors',
  MARKETPLACE: '/marketplace',
  COMMUNITY: '/community',
  HELP: '/help',

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
    '/exchange/list': '/marketplace',
    '/contractors/dashboard': '/contractor-dashboard'
  }
} as const;

export type RouteKey = keyof typeof ROUTES;

// Route guards - Only essential pages available
export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.CONTRACTOR_BOARD,
  '/quote-calculator', // Calculator route
  ROUTES.TERMS,
  ROUTES.PRIVACY
];

export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.CONTRACTOR_BOARD,
  '/quote-calculator'
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