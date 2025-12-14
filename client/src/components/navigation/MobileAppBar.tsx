import { memo, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  Users,
  ShoppingCart,
  Wrench,
  MessageCircle,
  LogIn,
  Layout,
  MessageSquare,
  Bell,
  User,
  Settings,
  Calculator,
  Trophy,
  Heart,
} from 'lucide-react';

const MobileAppBar = memo(function MobileAppBar() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  const { data: navigationPrefs } = useQuery<{
    customOrder?: string[];
    hiddenFromSwipe?: string[];
    enableSwipeNavigation?: boolean;
  }>({
    queryKey: ['/api/user/navigation-preferences'],
    enabled: isAuthenticated,
    retry: false,
  });

  const normalizePath = (pathOrId: string): string | null => {
    // Prefer hrefs (paths) when they're provided.
    if (pathOrId.startsWith('/')) {
      // Legacy/alias normalization
      if (pathOrId === '/worker-marketplace') return '/helpers';
      if (pathOrId === '/chat' || pathOrId === '/conversations') return '/messages';
      if (pathOrId === '/calculator') return '/quote-calculator';
      return pathOrId;
    }

    // Back-compat: some users have prefs stored as item IDs.
    const idToPath: Record<string, string> = {
      // LLM/Scout entrypoint
      assistant: '/scout',
      scout: '/scout',
      home: '/',
      dashboard: '/dashboard',
      'homeowner-dashboard': '/homeowner-dashboard',
      'contractor-dashboard': '/contractor-dashboard',

      contractors: '/contractors',
      workers: '/helpers',
      marketplace: '/marketplace',
      community: '/community',
      foundation: '/foundation',
      leaderboard: '/leaderboard',
      'quote-calculator': '/quote-calculator',

      conversations: '/messages',
      notifications: '/notifications',
      profile: '/profile',
      settings: '/settings',
    };

    return idToPath[pathOrId] ?? null;
  };

  const isActivePath = (current: string, target: string) => {
    if (target === '/') return current === '/';
    return current === target || current.startsWith(`${target}/`);
  };

  const authedCarouselPaths = useMemo(() => {
    const defaultPaths = [
      '/scout',
      '/dashboard',
      '/community',
      '/contractors',
      '/helpers',
      '/marketplace',
      '/quote-calculator',
      '/leaderboard',
      '/foundation',
      '/profile',
      '/settings',
    ];

    const rawCustomOrder = navigationPrefs?.customOrder ?? [];
    const rawHidden = navigationPrefs?.hiddenFromSwipe ?? [];

    const customPaths = rawCustomOrder
      .map(normalizePath)
      .filter((p): p is string => Boolean(p));

    const hiddenPaths = new Set(
      rawHidden
        .map(normalizePath)
        .filter((p): p is string => Boolean(p))
    );

    // Build: custom first, then defaults, then filter hidden.
    const merged = [...customPaths, ...defaultPaths.filter((p) => !customPaths.includes(p))]
      .filter((p) => !hiddenPaths.has(p));

    // Guarantee a sane minimum.
    return merged.length > 0 ? merged : defaultPaths;
  }, [navigationPrefs]);

  const navMeta: Record<
    string,
    { icon: any; label: string; testId: string; key: string; path: string }
  > = {
    '/': { icon: Home, label: 'Home', path: '/', testId: 'mobile-nav-home', key: 'home' },
    '/scout': { icon: Home, label: 'Scout', path: '/scout', testId: 'mobile-nav-scout', key: 'scout' },
    '/dashboard': { icon: Layout, label: 'Dashboard', path: '/dashboard', testId: 'mobile-nav-dashboard', key: 'dashboard' },
    '/homeowner-dashboard': { icon: Layout, label: 'Dashboard', path: '/homeowner-dashboard', testId: 'mobile-nav-dashboard', key: 'homeowner-dashboard' },
    '/contractor-dashboard': { icon: Layout, label: 'Dashboard', path: '/contractor-dashboard', testId: 'mobile-nav-dashboard', key: 'contractor-dashboard' },
    '/community': { icon: Users, label: 'Community', path: '/community', testId: 'mobile-nav-community', key: 'community' },
    '/contractors': { icon: Wrench, label: 'Contractors', path: '/contractors', testId: 'mobile-nav-contractors', key: 'contractors' },
    '/helpers': { icon: MessageCircle, label: 'Helpers', path: '/helpers', testId: 'mobile-nav-helpers', key: 'helpers' },
    '/marketplace': { icon: ShoppingCart, label: 'Marketplace', path: '/marketplace', testId: 'mobile-nav-marketplace', key: 'marketplace' },
    '/quote-calculator': { icon: Calculator, label: 'Calculator', path: '/quote-calculator', testId: 'mobile-nav-calculator', key: 'calculator' },
    '/leaderboard': { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', testId: 'mobile-nav-leaderboard', key: 'leaderboard' },
    '/foundation': { icon: Heart, label: 'Foundation', path: '/foundation', testId: 'mobile-nav-foundation', key: 'foundation' },
    '/profile': { icon: User, label: 'Profile', path: '/profile', testId: 'mobile-nav-profile', key: 'profile' },
    '/settings': { icon: Settings, label: 'Settings', path: '/settings?tab=navigation', testId: 'mobile-nav-settings', key: 'settings' },
    '/login': { icon: LogIn, label: 'Log in', path: '/login', testId: 'mobile-nav-login', key: 'login' },
  };

  const guestNav = [
    { icon: Home, label: 'Scout', path: '/scout', testId: 'mobile-nav-scout', key: 'scout' },
    { icon: Users, label: 'Community', path: '/community', testId: 'mobile-nav-community', key: 'community' },
    { icon: Wrench, label: 'Contractors', path: '/contractors', testId: 'mobile-nav-contractors', key: 'contractors' },
    { icon: ShoppingCart, label: 'Marketplace', path: '/marketplace', testId: 'mobile-nav-marketplace', key: 'marketplace' },
    { icon: LogIn, label: 'Log in', path: '/login', testId: 'mobile-nav-login', key: 'login' },
  ];

  const navItems = isAuthenticated
    ? authedCarouselPaths
        .map((p) => navMeta[p])
        .filter(Boolean)
    : guestNav;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg">
      {isAuthenticated ? (
        <div
          className="h-14 flex items-center gap-2 px-2 overflow-x-auto overscroll-x-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(location, item.path.split('?')[0]);

            return (
              <Link
                key={item.key || item.path}
                href={item.path}
                data-testid={item.testId}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors shrink-0 min-w-[72px] px-2 py-1 rounded-md ${
                  isActive
                    ? 'text-orange-600 dark:text-orange-500'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-5 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Link
                key={item.key || item.path}
                href={item.path}
                data-testid={item.testId}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive
                    ? 'text-orange-600 dark:text-orange-500'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default MobileAppBar;
