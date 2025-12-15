// Feature flags for controlling public access during pre-launch
export const FEATURE_FLAGS = {
  // Public features (available without authentication)
  PUBLIC_CONTRACTOR_BOARD: true,
  PUBLIC_QUOTE_CALCULATOR: true,
  PUBLIC_CONTRACTOR_SIGNUP: true,
  PUBLIC_CONTRACTOR_PROFILES: true,
  
  // Private features (require authentication or admin access)
  PUBLIC_LANDING_PAGE: false, // Redirect to contractor board instead
  PUBLIC_COMMUNITY: false,
  PUBLIC_HELPERS: false,
  PUBLIC_EXCHANGE: false,
  PUBLIC_ACCELERATOR: false,
  PUBLIC_FOUNDATION: false,
  PUBLIC_MARKETPLACE: false,
  
  // Admin-only features (always require authentication)
  ADMIN_PANEL: true,
  USER_DASHBOARDS: true,
  MESSAGING_SYSTEM: true,
  PAYMENT_SYSTEM: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURE_FLAGS[feature];
}

export function getPublicRoutes(): string[] {
  const routes: string[] = [];
  
  if (FEATURE_FLAGS.PUBLIC_CONTRACTOR_BOARD) {
    routes.push('/contractors/board', '/');
  }
  
  if (FEATURE_FLAGS.PUBLIC_QUOTE_CALCULATOR) {
    routes.push('/quote-calculator', '/quote');
  }
  
  if (FEATURE_FLAGS.PUBLIC_CONTRACTOR_SIGNUP) {
    routes.push('/contractors/signup');
  }
  
  if (FEATURE_FLAGS.PUBLIC_CONTRACTOR_PROFILES) {
    routes.push('/contractors/:slug');
  }
  
  return routes;
}

export function getRestrictedFeatures(): string[] {
  const restricted: string[] = [];
  
  if (!FEATURE_FLAGS.PUBLIC_COMMUNITY) restricted.push('Community');
  if (!FEATURE_FLAGS.PUBLIC_HELPERS) restricted.push('Helpers');
  if (!FEATURE_FLAGS.PUBLIC_EXCHANGE) restricted.push('Exchange'); 
  if (!FEATURE_FLAGS.PUBLIC_ACCELERATOR) restricted.push('Accelerator');
  if (!FEATURE_FLAGS.PUBLIC_FOUNDATION) restricted.push('Foundation');
  if (!FEATURE_FLAGS.PUBLIC_MARKETPLACE) restricted.push('Marketplace');
  
  return restricted;
}