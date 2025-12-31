import { memo, lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { trackShellEvent } from '@/lib/analytics';
import { OrientationCard } from '@/components/orientation/OrientationCard';

// Import all role-specific dashboards
const SimpleHome = lazy(() => import('@/pages/SimpleHome'));
const ContractorDashboard = lazy(() => import('@/pages/contractor-dashboard'));
const RealtorDashboard = lazy(() => import('@/pages/realtor-dashboard'));
const DealerDashboard = lazy(() => import('@/pages/dealer-dashboard'));
const CarSalesmanDashboard = lazy(() => import('@/pages/car-salesman-dashboard'));
const InsuranceAgentDashboard = lazy(() => import('@/pages/insurance-agent-dashboard'));
const MortgageBrokerDashboard = lazy(() => import('@/pages/mortgage-broker-dashboard'));
const PropertyManagerDashboard = lazy(() => import('@/pages/property-manager-dashboard'));
const HOADashboard = lazy(() => import('@/pages/hoa-dashboard'));
const BusinessOwnerDashboard = lazy(() => import('@/pages/business-owner-dashboard'));
const AdminDashboard = lazy(() => import('@/pages/admin-dashboard'));
const StaffDashboard = lazy(() => import('@/pages/staff-dashboard'));
const HelperDashboard = lazy(() => import('@/pages/helper-dashboard'));

const RoleDashboardRouter = memo(function RoleDashboardRouter() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const [showFirstSessionBanner, setShowFirstSessionBanner] = useState(false);
  const [showOrientation, setShowOrientation] = useState(false);

  const isCommunityFirst = Boolean((user as any)?.communityFirst);

  // First-session dashboard banner (non-blocking, session-scoped).
  // For community-first users, skip this banner entirely so the
  // dashboard feels like an optional tools surface, not required setup.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user || isCommunityFirst) return;

    const countKey = 'ts_dashboard_session_count';
    const dismissedKey = 'ts_dashboard_first_banner_dismissed';

    if (sessionStorage.getItem(dismissedKey) === '1') {
      return;
    }

    const raw = sessionStorage.getItem(countKey);
    const previous = raw ? parseInt(raw, 10) || 0 : 0;
    const next = previous + 1;
    sessionStorage.setItem(countKey, String(next));

    if (next === 1) {
      setShowFirstSessionBanner(true);

      const roles: string[] = Array.isArray((user as any)?.roles)
        ? (user as any).roles
        : (user as any)?.role
        ? [(user as any).role]
        : [];

      trackShellEvent({
        type: 'dashboard_banner_shown',
        sessionCount: next,
        userTypes: roles,
        route: '/dashboard',
      });
    }
  }, [user, isCommunityFirst]);

  // One-time post-onboarding orientation card via ?orientation=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;

    try {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search || '');
      const shouldShow = params.get('orientation') === '1';

      if (shouldShow) {
        setShowOrientation(true);

        trackShellEvent({
          type: 'scout_query',
          payload: {
            event: 'orientation_shown_post_onboarding',
            capabilityBundles: (user as any)?.capabilityBundles ?? [],
            ts: new Date().toISOString(),
          },
        }).catch(() => {
          // ignore analytics failures
        });

        params.delete('orientation');
        const nextSearch = params.toString();
        const nextPath = nextSearch ? `/dashboard?${nextSearch}` : '/dashboard';
        setLocation(nextPath, { replace: true } as any);
      }
    } catch {
      // ignore URL parse errors
    }
  }, [setLocation, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!user) {
    setLocation('/login');
    return null;
  }

  // Everyone gets the unified activity/interest-based Dashboard
  // Role-based routing removed per user request
  const getDashboardComponent = () => {
    // Legacy admin roles still get their specific dashboards
    if (user.role === 'super_admin' || user.role === 'head_admin') {
      return AdminDashboard;
    }
    
    if (user.role === 'ops_admin' || user.role === 'territory_manager') {
      return StaffDashboard;
    }
    
    // Everyone else (homeowners, contractors, realtors, etc.) gets the unified Dashboard
    // This Dashboard shows content based on user activity and interests, not role
    return lazy(() => import('@/pages/Dashboard'));
  };

  const DashboardComponent = getDashboardComponent();

  return (
    <>
      {showOrientation && (
        <div className="max-w-5xl mx-auto mt-4 px-3">
          <OrientationCard
            roleLabel={String(user?.role || 'participant')}
            sendToScout={(prompt, options) => {
              try {
                window.localStorage.setItem('scout:prefill:scout-main', prompt);
                window.localStorage.setItem(
                  'scout:help-intent',
                  JSON.stringify({
                    prompt,
                    source: options?.source || 'dashboard-orientation',
                    ts: new Date().toISOString(),
                  })
                );
              } catch {
                // ignore
              }
              setLocation('/scout');
            }}
            contextSource="post-onboarding"
          />
        </div>
      )}

      {showFirstSessionBanner && (
        <div className="fixed bottom-20 right-4 z-40 max-w-sm rounded-2xl border border-orange-400/60 bg-slate-950/95 px-4 py-3 text-xs text-slate-100 shadow-lg shadow-orange-500/20">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.35)]" />
            <div className="space-y-0.5">
              <p className="font-semibold text-orange-200">Your profile is flexible</p>
              <p className="text-slate-200">
                You can add roles, sections, and layout anytime in Profile Settings.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss profile tip"
              onClick={() => {
                setShowFirstSessionBanner(false);
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('ts_dashboard_first_banner_dismissed', '1');
                }

                const roles: string[] = Array.isArray((user as any)?.roles)
                  ? (user as any).roles
                  : (user as any)?.role
                  ? [(user as any).role]
                  : [];

                trackShellEvent({
                  type: 'dashboard_banner_dismissed',
                  sessionCount:
                    typeof window !== 'undefined'
                      ? parseInt(sessionStorage.getItem('ts_dashboard_session_count') || '1', 10) || 1
                      : 1,
                  userTypes: roles,
                  route: '/dashboard',
                });
              }}
              className="ml-2 text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      }
    >
      <DashboardComponent />
    </Suspense>
    </>
  );
});

export default RoleDashboardRouter;
