import React, { Suspense, memo, useEffect, useLayoutEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { trackShellEvent } from "./lib/analytics";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SessionProvider } from "./contexts/SessionContext";
import { useAuth } from "./hooks/useAuth";
import { resolveAuthenticatedHomeRedirect } from "./lib/homeRoute";
import {
  FEATURE_HOLD_TO_EXPLAIN,
  FEATURE_HOLD_INTRO_TUTORIAL,
  FEATURE_EDUCATION_REPLACEMENT,
  FEATURE_PROGRESSIVE_EXPOSURE_SHADOW,
} from "@shared/governanceFlags";
import { registerStarterActionDescriptors } from "./lib/actionDescriptorSeeds";
import { getRecentActivity } from "./agent/activity";
import { evaluateProgressiveExposure } from "./lib/progressiveExposure";
import TradeScoutBackground from "./components/TradeScoutBackground";
import { Toaster } from "./components/ui/toaster";
import { ShareCardHost } from "./components/share/ShareCardHost";

// Only load essential components eagerly
import SimpleMobileGestures from "./components/SimpleMobileGestures";
import { isSuperAdminLike } from "./lib/roleChecks";
import { isOnboardingSurfacePath } from "./lib/onboardingSurface";
import { hasCompletedSetup } from "./lib/setupState";

// Loading component for lazy-loaded pages
import { PageLoadingSpinner } from "./components/LoadingSpinner";
import { AppRoutes } from "./AppRoutes";

const PageLoader = memo(function PageLoader() {
  return <PageLoadingSpinner message="Loading TradeScout..." />;
});

const PreferredSourcePrompt = React.lazy(() =>
  import("./components/PreferredSourcePrompt").then((module) => ({
    default: module.PreferredSourcePrompt,
  }))
);
const HoldToExplainProvider = React.lazy(() =>
  import("./components/hold/HoldToExplainProvider").then((module) => ({
    default: module.HoldToExplainProvider,
  }))
);
const HoldIntroTutorial = React.lazy(() =>
  import("./components/onboarding/HoldIntroTutorial").then((module) => ({
    default: module.HoldIntroTutorial,
  }))
);
const SimpleSubtleHints = React.lazy(() => import("./components/onboarding/SimpleSubtleHints"));
const ProfileCompletionBanner = React.lazy(
  () => import("./components/onboarding/ProfileCompletionBanner")
);
const PageFirstVisitTutorial = React.lazy(
  () => import("./components/onboarding/PageFirstVisitTutorial")
);
const PWAInstallPrompt = React.lazy(() =>
  import("./components/PWAInstallPrompt").then((module) => ({
    default: module.PWAInstallPrompt,
  }))
);
const SimpleBugReportTool = React.lazy(() => import("./components/SimpleBugReportTool"));

// Main app layout component
const AppLayout = memo(function AppLayout() {
  const [location, setLocation] = useLocation();
  const rawPath = String(location || "").split("?")[0];
  const pathOnly = rawPath.replace(/\/+$/, "") || "/";
  // Lite / experimental Scout surfaces can still run outside AppShell,
  // but the main Scout experience lives at /scout inside the app frame.
  const isLiteScoutRoute = pathOnly === "/_scout-lite";
  const isLlmRoute = location.startsWith("/scout");
  const isLandingRoute =
    pathOnly === "/landing" ||
    pathOnly.startsWith("/landing/") ||
    pathOnly === "/lp" ||
    pathOnly.startsWith("/lp/");
  const isPublicCampaignRoute = pathOnly === "/trade-up-for-trade-schools";
  const isAuthSurface =
    pathOnly.startsWith("/create-account") ||
    pathOnly.startsWith("/login") ||
    pathOnly.startsWith("/register") ||
    pathOnly.startsWith("/pre-scout-setup") ||
    isOnboardingSurfacePath(pathOnly);
  const isShareRoute = pathOnly.startsWith("/r/");
  const isDirectConnectSurface =
    pathOnly === "/direct-connect" || pathOnly.startsWith("/direct-connect/");
  // Set server-side only when this page is being served at a business's own
  // custom domain root -- the URL path itself gives no clue which profile to
  // render (there's no /u/:slug in it), so this is the only way the client
  // router knows. Takes priority over everything else: a visitor on a
  // business's own domain should always see that business, regardless of
  // path or auth state.
  const customDomainProfileSlug =
    typeof window !== "undefined"
      ? (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
          .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__
      : undefined;
  // JW's public profile lives at /jw-stone and should follow standard profile flow.
  const isJwStoneProfileRoute = pathOnly === "/jw-stone" || pathOnly.startsWith("/jw-stone/");
  const isCustomDomainProfileRoute = Boolean(customDomainProfileSlug);
  const isPublicProfileRoute =
    isJwStoneProfileRoute ||
    ((/^\/u\/[^/]+(?:\/[^/]+\/[^/]+)?$/.test(pathOnly) ||
      /^\/p\/[^/]+(?:\/[^/]+\/[^/]+)?$/.test(pathOnly) ||
      /^\/business\/[^/]+$/.test(pathOnly) ||
      /^\/contractors\/[^/]+$/.test(pathOnly) ||
      /^\/helpers\/[^/]+$/.test(pathOnly) ||
      /^\/profile\/[^/]+$/.test(pathOnly)) &&
      !pathOnly.endsWith("/edit"));

  const isStandaloneProfileRoute =
    (/^\/u\/[^/]+(?:\/[^/]+\/[^/]+)?$/.test(pathOnly) ||
      /^\/p\/[^/]+(?:\/[^/]+\/[^/]+)?$/.test(pathOnly)) &&
    !pathOnly.endsWith("/edit");

  const { user, isAuthenticated, isLoading } = useAuth();
  const isPublicRootLanding = pathOnly === "/" && !isLoading && !isAuthenticated;

  // JW is now rendered as a standard profile surface.

  // Identity funnel telemetry: emit once per browser session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoading) return;

    const flagKey = "ts_identity_session_logged";
    if (sessionStorage.getItem(flagKey) === "1") return;

    const currentPath = location || window.location.pathname + window.location.search;

    let entryRoute: "login" | "register" | "oauth" | "other" = "other";
    if (currentPath.startsWith("/login")) {
      entryRoute = "login";
    } else if (
      currentPath.startsWith("/register") ||
      currentPath.startsWith("/signup") ||
      currentPath.startsWith("/create-account")
    ) {
      entryRoute = "register";
    } else if (
      currentPath.startsWith("/profile-settings") &&
      window.location.search.includes("onboarding=1")
    ) {
      entryRoute = "oauth";
    }

    const roles: string[] = (() => {
      if (!user) return [];
      if (Array.isArray(user.roles) && user.roles.length > 0) {
        return user.roles.filter((r): r is string => typeof r === "string");
      }
      if (typeof user.role === "string" && user.role.length > 0) {
        return [user.role];
      }
      return [];
    })();

    const isSuperAdminSession = isSuperAdminLike(user?.role);
    const hasCompletedProfileBasics = isSuperAdminSession || hasCompletedSetup(user);

    trackShellEvent({
      type: "identity_session",
      isAuthenticated: !!user,
      entryRoute,
      userTypesCount: roles.length,
      userTypes: roles,
      hasCompletedProfileBasics,
    });

    sessionStorage.setItem(flagKey, "1");
  }, [location, isLoading, user, isAuthenticated]);

  // Shadow-mode progressive exposure evaluation. Observe readiness only.
  useEffect(() => {
    if (!FEATURE_PROGRESSIVE_EXPOSURE_SHADOW) return;
    if (typeof window === "undefined") return;
    if (isLoading) return;

    const userKey = user?.id ? String(user.id) : "guest";
    const sessionKey = `ts_progressive_exposure_shadow_logged:${userKey}`;
    if (sessionStorage.getItem(sessionKey) === "1") return;

    const snapshot = evaluateProgressiveExposure({
      user,
      recentActivity: getRecentActivity(),
    });

    trackShellEvent({
      type: "progressive_exposure_shadow",
      tier: snapshot.tier,
      reasons: snapshot.reasons,
      accountAgeDays: snapshot.signals.accountAgeDays,
      meaningfulActivityCount: snapshot.signals.meaningfulActivityCount,
      hasCompletedSetup: snapshot.signals.hasCompletedSetup,
      hasVerifiedContact: snapshot.signals.hasVerifiedContact,
      path: location || window.location.pathname,
      ts: new Date().toISOString(),
    });

    sessionStorage.setItem(sessionKey, "1");
  }, [isLoading, user, location]);

  // Do not hard-redirect users into pre-scout setup from normal navigation.
  // Setup is still available explicitly and can be enforced per-action server-side.
  useEffect(() => {
    return;
  }, [isAuthenticated, user, location, setLocation]);

  // Back-compat: older Scout links were encoded as '/?prompt=...'
  useEffect(() => {
    if (location.startsWith("/?")) {
      const query = location.slice(2).split("#", 1)[0] || "";
      const params = new URLSearchParams(query);
      if (params.has("prompt") || params.has("intent")) {
        setLocation(`/scout${location.substring(1)}`);
      }
    }
  }, [location, setLocation]);

  // Respect user default home page preference when landing on the TradeScout
  // app root. A profile custom domain owns its root regardless of auth state.
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (!hasCompletedSetup(user)) return;

    const targetRoute = resolveAuthenticatedHomeRedirect({
      location,
      isCustomDomainProfileRoute,
      communityFirst: Boolean(user.communityFirst),
      defaultHomePage: user.preferences?.defaultHomePage,
    });

    if (targetRoute) setLocation(targetRoute);
  }, [isAuthenticated, user, location, setLocation, isCustomDomainProfileRoute]);

  const appBackgroundClass = "";
  const mainClassName = "flex-1 relative w-full";

  return (
    <SimpleMobileGestures>
      <div className={`${appBackgroundClass} text-tsTextMain font-sans flex flex-col`}>
        <main className={mainClassName}>
          <ErrorBoundary fallback={<PageLoader />}>
            <AppRoutes
              isLiteScoutRoute={isLiteScoutRoute}
              isLandingRoute={isLandingRoute}
              isPublicCampaignRoute={isPublicCampaignRoute}
              isPublicRootLanding={isPublicRootLanding}
              isShareRoute={isShareRoute}
              isStandaloneProfileRoute={isStandaloneProfileRoute}
              isCustomDomainProfileRoute={isCustomDomainProfileRoute}
            />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global components - CONTENT ONLY, NO NAV (AppShell owns all navigation) */}

      {/* Preferred Source Prompt - earned at 5 completed actions */}
      {!isPublicProfileRoute && !isCustomDomainProfileRoute && isAuthenticated && user?.id && (
        <Suspense fallback={null}>
          <PreferredSourcePrompt userId={user.id} onClose={() => {}} />
        </Suspense>
      )}

      {/* Hold-to-Explain (ships dark behind flag) */}
      {!isPublicProfileRoute && !isCustomDomainProfileRoute && FEATURE_HOLD_TO_EXPLAIN && (
        <Suspense fallback={null}>
          <HoldToExplainProvider />
        </Suspense>
      )}

      {/* One-time Hold explainer (ships dark behind flag) */}
      {!isPublicProfileRoute && !isCustomDomainProfileRoute && FEATURE_HOLD_INTRO_TUTORIAL && (
        <Suspense fallback={null}>
          <HoldIntroTutorial />
        </Suspense>
      )}

      {/* Subtle onboarding hints for new users (hide on Scout landing) */}
      {!isLlmRoute &&
        !isLandingRoute &&
        !isPublicProfileRoute &&
        !isCustomDomainProfileRoute &&
        !isPublicCampaignRoute &&
        !isShareRoute &&
        !FEATURE_EDUCATION_REPLACEMENT && (
          <div className="hidden md:block">
            <Suspense fallback={null}>
              <SimpleSubtleHints />
            </Suspense>
          </div>
        )}

      {/* Deterministic setup prompt (avoid re-running pre-scout/onboarding loops) */}
      {!isLlmRoute &&
        !isLandingRoute &&
        !isShareRoute &&
        !isPublicProfileRoute &&
        !isCustomDomainProfileRoute && (
          <div className="hidden md:block">
            <Suspense fallback={null}>
              <ProfileCompletionBanner />
            </Suspense>
          </div>
        )}

      {/* Per-page first-visit tutorial popup (user-aware and easy-language). */}
      {!isLandingRoute && !isShareRoute && !isPublicProfileRoute && !isCustomDomainProfileRoute && (
        <Suspense fallback={null}>
          <PageFirstVisitTutorial />
        </Suspense>
      )}

      {isAuthenticated &&
        !isLandingRoute &&
        !isPublicCampaignRoute &&
        !isShareRoute &&
        !isAuthSurface &&
        !isDirectConnectSurface &&
        !isPublicProfileRoute &&
        !isCustomDomainProfileRoute && (
          <Suspense fallback={null}>
            <PWAInstallPrompt enabled />
          </Suspense>
        )}

      {/* Keep the flagship JW experience free of platform overlays. */}
      {!isPublicProfileRoute && !isCustomDomainProfileRoute && (
        <Suspense fallback={null}>
          <SimpleBugReportTool />
        </Suspense>
      )}
    </SimpleMobileGestures>
  );
});
const App = memo(function App() {
  // Thumb-zone UX toggle: wrap the entire app in a root class that
  // can be flipped off or gated to pilots without touching layout
  // structure. For now this is a simple constant; reversing the
  // behavior is a one-line change.
  const enableThumbUX = true;
  const enableDarkDepth = true;

  useEffect(() => {
    registerStarterActionDescriptors();
  }, []);

  return (
    <div
      className={`app-root ${enableThumbUX ? "thumb-ux" : ""} ${enableDarkDepth ? "dark-depth" : ""}`}
    >
      <TradeScoutBackground>
        <ErrorBoundary fallback={<PageLoader />}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <SessionProvider>
                <Router>
                  <AppLayout />
                </Router>
                <ShareCardHost />
                <Toaster />
              </SessionProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </TradeScoutBackground>
    </div>
  );
});

export default App;
