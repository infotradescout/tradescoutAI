import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './hooks/useAuth';
import ScoutLanding from './scout-landing-v2-millionaire';

/**
 * Smart Home Route Component
 * Redirects users to their preferred default home page
 * Falls back to ScoutLanding (LLM) if no preference is set
 */
export default function SmartHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Only redirect if user is authenticated and has a preference
    if (user?.preferences?.defaultHomePage) {
      const defaultPage = user.preferences.defaultHomePage;
      
      const routeMap: Record<string, string> = {
        'llm': '/', // Stay on current page
        'marketplace': '/marketplace',
        'contractor-board': '/contractor-board',
        'dashboard': '/dashboard',
        'profile': '/profile',
        'community': '/community-feed',
      };

      const targetRoute = routeMap[defaultPage];
      
      // Only redirect if not already on the target route and not the LLM page
      if (targetRoute && targetRoute !== '/' && window.location.pathname === '/') {
        setLocation(targetRoute);
      }
    }
  }, [user, setLocation]);

  // Show the ScoutLanding (LLM) by default
  return <ScoutLanding />;
}
