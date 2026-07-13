import React, { Suspense, memo, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, useLocation } from "wouter";
import { X } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { trackShellEvent } from "./lib/analytics";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SessionProvider } from "./contexts/SessionContext";
import { useAuth } from "./hooks/useAuth";
import { resolveDefaultHomeRoute, type DefaultHomePage } from "./lib/homeRoute";
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

// Only load essential components eagerly
import SimpleMobileGestures from "./components/SimpleMobileGestures";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { isSuperAdminLike } from "./lib/roleChecks";

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

function isDefaultHomePage(value: unknown): value is DefaultHomePage {
  return (
    value === "llm" ||
    value === "marketplace" ||
    value === "contractor-board" ||
    value === "dashboard" ||
    value === "profile" ||
    value === "community"
  );
}

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
    pathOnly.startsWith("/onboarding/");
  const isShareRoute = pathOnly.startsWith("/r/");
  const isPortalSurface =
    pathOnly === "/homescout-listings" ||
    pathOnly.startsWith("/homescout/") ||
    pathOnly === "/tradepartners" ||
    pathOnly.startsWith("/tradepartners/") ||
    pathOnly.startsWith("/collections/");
  const isDirectConnectSurface =
    pathOnly === "/direct-connect" || pathOnly.startsWith("/direct-connect/");
  const isPublicProfileRoute =
    (/^\/u\/[^/]+$/.test(pathOnly) ||
      /^\/business\/[^/]+$/.test(pathOnly) ||
      /^\/contractors\/[^/]+$/.test(pathOnly) ||
      /^\/helpers\/[^/]+$/.test(pathOnly) ||
      /^\/profile\/[^/]+$/.test(pathOnly)) &&
    !pathOnly.endsWith("/edit");

  const { user, isAuthenticated, isLoading } = useAuth();
  const isPublicRootLanding = pathOnly === "/" && !isLoading && !isAuthenticated;

  const [showBetaNotice, setShowBetaNotice] = useState(false);

  useEffect(() => {
    const dismissed =
      typeof window !== "undefined"
        ? sessionStorage.getItem("ts_beta_notice_dismissed_session")
        : null;
    if (!dismissed) {
      setShowBetaNotice(true);
    }
  }, []);

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

    const profileVersion: number =
      typeof user?.profileVersion === "number" ? user.profileVersion : 0;
    const isSuperAdminSession = isSuperAdminLike(user?.role);
    const hasCompletedProfileBasics =
      isSuperAdminSession || profileVersion >= CURRENT_PROFILE_VERSION;

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

  // Respect user default home page preference when landing on '/'.
  // Community-first users always land on the community feed.
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const profileVersion: number =
      typeof user.profileVersion === "number" ? user.profileVersion : 0;
    const onboardingCompleted = user.onboardingCompleted === true;
    const needsOnboarding =
      profileVersion < CURRENT_PROFILE_VERSION || onboardingCompleted !== true;
    if (needsOnboarding) return;

    if (user.communityFirst && location === "/") {
      setLocation("/community-feed");
      return;
    }

    if (!user.preferences?.defaultHomePage) return;

    const rawDefaultPage: unknown = user.preferences.defaultHomePage;
    const targetRoute = resolveDefaultHomeRoute(
      isDefaultHomePage(rawDefaultPage) ? rawDefaultPage : null
    );

    if (targetRoute && location === "/") {
      setLocation(targetRoute);
    }
  }, [isAuthenticated, user, location, setLocation]);

  const dismissBetaNotice = () => {
    sessionStorage.setItem("ts_beta_notice_dismissed_session", "true");
    setShowBetaNotice(false);
  };

  const shouldShowBetaNotice =
    showBetaNotice &&
    !isLlmRoute &&
    !isPortalSurface &&
    !isLandingRoute &&
    !isPublicCampaignRoute &&
    !isShareRoute &&
    !isAuthSurface &&
    !isDirectConnectSurface &&
    !isPublicProfileRoute;

  const appBackgroundClass = "";
  const mainClassName = "flex-1 relative w-full";

  return (
    <SimpleMobileGestures>
      <div className={`${appBackgroundClass} text-tsTextMain font-sans flex flex-col`}>
        {shouldShowBetaNotice && (
          <div className="mx-auto w-full max-w-6xl px-2.5 pt-2 sm:px-3 md:px-6">
            <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/82 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
              <div className="flex items-start gap-2.5">
                <div
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  // eslint-disable-next-line no-restricted-syntax -- uses theme CSS variables for dynamic accent glow
                  style={{
                    backgroundColor: "var(--theme-accent-primary,#ff6600)",
                    boxShadow:
                      "0 0 0 3px color-mix(in oklab, var(--theme-accent-primary,#ff6600) 18%, transparent)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                    TradeScout beta
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--text-secondary)]">
                    Requests are actively improving — tell us if anything feels off.
                  </p>
                </div>
                <button
                  aria-label="Dismiss beta notice"
                  onClick={dismissBetaNotice}
                  className="-mr-1 rounded-md p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <main className={mainClassName}>
          <ErrorBoundary fallback={<PageLoader />}>
            <AppRoutes
              isLiteScoutRoute={isLiteScoutRoute}
              isLandingRoute={isLandingRoute}
              isPublicCampaignRoute={isPublicCampaignRoute}
              isPublicRootLanding={isPublicRootLanding}
              isShareRoute={isShareRoute}
            />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global components - CONTENT ONLY, NO NAV (AppShell owns all navigation) */}

      {/* Preferred Source Prompt - earned at 5 completed actions */}
      {isAuthenticated && user?.id && (
        <Suspense fallback={null}>
          <PreferredSourcePrompt userId={user.id} onClose={() => {}} />
        </Suspense>
      )}

      {/* Hold-to-Explain (ships dark behind flag) */}
      {FEATURE_HOLD_TO_EXPLAIN && (
        <Suspense fallback={null}>
          <HoldToExplainProvider />
        </Suspense>
      )}

      {/* One-time Hold explainer (ships dark behind flag) */}
      {FEATURE_HOLD_INTRO_TUTORIAL && (
        <Suspense fallback={null}>
          <HoldIntroTutorial />
        </Suspense>
      )}

      {/* Subtle onboarding hints for new users (hide on Scout landing) */}
      {!isLlmRoute &&
        !isLandingRoute &&
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
      {!isLlmRoute && !isLandingRoute && !isShareRoute && (
        <div className="hidden md:block">
          <Suspense fallback={null}>
            <ProfileCompletionBanner />
          </Suspense>
        </div>
      )}

      {/* Per-page first-visit tutorial popup (user-aware and easy-language). */}
      {!isLandingRoute && !isShareRoute && (
        <Suspense fallback={null}>
          <PageFirstVisitTutorial />
        </Suspense>
      )}

      {isAuthenticated &&
        !isLandingRoute &&
        !isPublicCampaignRoute &&
        !isShareRoute &&
        !isAuthSurface &&
        !isDirectConnectSurface && (
          <Suspense fallback={null}>
            <PWAInstallPrompt enabled />
          </Suspense>
        )}

      {/* Bug report tool - always available */}
      <Suspense fallback={null}>
        <SimpleBugReportTool />
      </Suspense>
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
              </SessionProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </TradeScoutBackground>
    </div>
  );
});

export default App;
