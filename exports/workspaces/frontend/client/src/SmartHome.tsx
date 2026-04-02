import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './hooks/useAuth';
import { resolveDefaultHomeRoute } from './lib/homeRoute';

/**
 * Smart Home Route Component
 * Redirects users to their preferred default home page (or Scout).
 */
export default function SmartHome() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const defaultPage = (user?.preferences?.defaultHomePage ?? 'llm') as any;
    const targetRoute = resolveDefaultHomeRoute(defaultPage);

    if (targetRoute && location !== targetRoute) {
      setLocation(targetRoute);
    }
  }, [user, isAuthenticated, location, setLocation]);

  // SmartHome only performs a redirect; it does not render its own UI.
  return null;
}
