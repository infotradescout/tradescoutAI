import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  MessageCircle,
  Bell,
  Users,
  Settings,
  ShoppingBag,
  Trophy,
  Heart,
  Compass,
  Map,
  Menu,
  UserPlus,
  LogIn,
  Download,
  Wrench,
  ClipboardList,
  Share2,
  CircleHelp,
  Sparkles,
  Shield,
  Building,
  UserCircle,
  BadgeCheck,
  LockKeyhole,
  ArrowRight,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHandedness } from "@/hooks/useHandedness";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ROUTES } from "@/lib/routes";
import { NotificationCenter } from "@/components/ui/notification-center";
import { RightToolsPanel } from "@/components/layout/RightToolsPanel";
import MobileAppBar from "@/components/navigation/MobileAppBar";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useLocation } from "wouter";
import { setSessionLocationOverride } from "@/hooks/useLocationContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useIsStandalone } from "@/hooks/useIsStandalone";
import { useLocationUpgrade } from "@/hooks/useLocationUpgrade";
import { hasAdminUiAccess, isSuperAdminLike } from "@/lib/roleChecks";
import { getRecentActivity } from "@/agent/activity";
import { evaluateFeatureUnlocks, getUnlockedAdvancedHrefs } from "@/lib/progressiveFeatureUnlocks";
import { DEFAULT_LANDING } from "@/lib/postOnboardingRoute";
import { parsePublicProfileContinuation } from "@/lib/publicProfileContinuation";
import { FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING } from "@shared/governanceFlags";
import { isOnboardingSurfacePath } from "@/lib/onboardingSurface";
import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
  description?: string;
};

type AppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

type SurfaceOrientation = {
  title: string;
  summary: string;
  actionLabel?: string;
  actionHref?: string;
};

const START_GUIDE_SEEN_KEY = "ts:start-guide-seen-v1";

const START_GUIDE_ITEMS: NavItem[] = [
  {
    label: "Get help with a project",
    href: "/scout",
    icon: <Compass className="h-5 w-5" />,
    description: "Tell Scout what you need and get a clear next step.",
  },
  {
    label: "Find a local business",
    href: ROUTES.CONTRACTORS ?? "/contractors",
    icon: <Building className="h-5 w-5" />,
    description: "Browse businesses by service and location.",
  },
  {
    label: "Check my requests and replies",
    href: "/direct-connect/active",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "See what you asked for, who replied, and what needs action.",
  },
  {
    label: "Set up or manage my business",
    href: "/business-dashboard",
    icon: <Wrench className="h-5 w-5" />,
    description: "Create a business profile or open its workspace and opportunities.",
  },
  {
    label: "Find work or hire",
    href: "/direct-connect/opportunities",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "Browse jobs and resumes, post an opening, or apply.",
  },
  {
    label: "Commercial Jobs",
    href: "/commercial-directory",
    icon: <ShoppingBag className="h-5 w-5" />,
    description: "Review published commercial projects and bid packages.",
  },
  {
    label: "Ask my community",
    href: ROUTES.COMMUNITY ?? "/community",
    icon: <Users className="h-5 w-5" />,
    description: "See nearby activity, share an update, or ask around.",
  },
];

function resolveSurfaceOrientation(pathname: string): SurfaceOrientation | null {
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin controls",
      summary: "See activity, snapshots, and admin tools in one place.",
      actionLabel: "Go to Admin Home",
      actionHref: "/admin/live-stream",
    };
  }
  if (pathname.startsWith("/scout") || pathname === "/") {
    return {
      title: "Start here",
      summary: "Tell Scout what you want to get done and receive a clear next step.",
      actionLabel: "See my requests",
      actionHref: "/direct-connect/active",
    };
  }
  if (pathname.startsWith("/direct-connect/active")) {
    return {
      title: "My requests",
      summary: "Review what you asked for, read replies, and see what needs your attention.",
      actionLabel: "Start a new request",
      actionHref: "/direct-connect",
    };
  }
  if (pathname.startsWith("/direct-connect/inbox")) {
    return {
      title: "Inbox",
      summary: "Review incoming opportunities, replies, and conversations that need action.",
      actionLabel: "Open my requests",
      actionHref: "/direct-connect/active",
    };
  }
  if (
    pathname.startsWith("/direct-connect/opportunities") ||
    pathname.startsWith("/direct-connect/employment")
  ) {
    return {
      title: "Jobs",
      summary: "Find employment, post a job or resume, apply, and review applicants.",
    };
  }
  if (pathname.startsWith("/direct-connect")) {
    return {
      title: "Make a request",
      summary: "Describe what you need, review it, and choose where it goes.",
      actionLabel: "Open my requests",
      actionHref: "/direct-connect/active",
    };
  }
  if (pathname.startsWith("/contractors") || pathname.startsWith("/find-local-businesses")) {
    return {
      title: "Find businesses",
      summary: "Browse local businesses by the work you need and the area they serve.",
      actionLabel: "Tell Scout what I need",
      actionHref: "/scout",
    };
  }
  if (pathname.startsWith("/commercial-directory")) {
    return {
      title: "Commercial work",
      summary: "Review published projects and open the work that fits your business.",
      actionLabel: "Open my business",
      actionHref: "/business-dashboard",
    };
  }
  if (pathname.startsWith("/business-dashboard") || pathname.startsWith("/contractor-dashboard")) {
    return {
      title: "My business",
      summary: "Manage your profile, requests, work, and business activity from one place.",
      actionLabel: "View incoming requests",
      actionHref: "/direct-connect/inbox",
    };
  }
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings")) {
    return {
      title: "My account",
      summary: "Manage your profile, preferences, permissions, privacy, and security.",
      actionLabel: "Open my profile",
      actionHref: "/profile",
    };
  }
  if (pathname.startsWith("/exchange")) {
    return {
      title: "Exchange",
      summary: "Buy and sell listings. Switch scope to near me, state, or nationwide.",
      actionLabel: "List an item",
      actionHref: "/marketplace-listing",
    };
  }
  if (
    pathname.startsWith("/homescout-listings") ||
    pathname.startsWith("/homescout/listings") ||
    pathname.startsWith("/homescout/")
  ) {
    return {
      title: "Exchange Real Estate",
      summary: "Home listings live inside Exchange and follow Exchange discovery flow.",
      actionLabel: "Open Exchange",
      actionHref: "/exchange",
    };
  }
  if (
    pathname === "/homes" ||
    pathname.startsWith("/homes/") ||
    pathname === "/vehicles" ||
    pathname.startsWith("/vehicles/") ||
    pathname.startsWith("/homescout/new")
  ) {
    return {
      title: "Asset Management",
      summary:
        "Track inspections, maintenance, upgrades, and project history across assets with a home-first focus.",
      actionLabel: "Open Asset Management",
      actionHref: "/homes",
    };
  }
  if (pathname.startsWith("/community")) {
    return {
      title: "Community",
      summary: "See what's happening nearby, post updates, and stay connected locally.",
      actionLabel: "Create a post",
      actionHref: "/community",
    };
  }
  if (pathname.startsWith("/trade-deals")) {
    return {
      title: "TradeDeals",
      summary: "Browse partner offers and active campaigns in your market.",
      actionLabel: "View Cumulus campaign",
      actionHref: "/tradepartners/cumulus-media",
    };
  }
  if (pathname.startsWith("/maps")) {
    return {
      title: "Maps",
      summary: "See businesses, coverage, and local activity on the map.",
      actionLabel: "View local directory",
      actionHref: "/county-directory",
    };
  }
  if (pathname.startsWith("/leaderboard")) {
    return {
      title: "Leaderboard",
      summary: "See who's active and who's earning trust in your area.",
      actionLabel: "View community activity",
      actionHref: "/community",
    };
  }
  if (pathname.startsWith("/foundation")) {
    return {
      title: "Local vaults",
      summary: "See local contributions and what community builders are funding nearby.",
      actionLabel: "View contribution dashboard",
      actionHref: "/community-builder/dashboard",
    };
  }
  if (pathname.startsWith("/share") || pathname.startsWith("/affiliate")) {
    return {
      title: "Share Hub",
      summary: "Copy your best links and share them without losing attribution.",
      actionLabel: "View best links",
      actionHref: "/share",
    };
  }
  return null;
}

// SITE FEATURES ONLY.
// Direct Connect is the primary coordination hub; contractors/helpers
// are still available as subordinate surfaces but are not top-level nav.
const buildFeatureNav = (opts?: { includeAdvancedHrefs?: Set<string> | null }): NavItem[] => {
  const coreNav: NavItem[] = [
    {
      label: "Scout",
      href: "/scout",
      icon: <Compass className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Open Scout to review what to do next.",
    },
    {
      label: "Direct Connect",
      href: "/direct-connect",
      icon: <ClipboardList className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Post requests and track replies.",
    },
    {
      label: "Businesses",
      href: ROUTES.CONTRACTORS ?? "/contractors",
      icon: <Building className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Find businesses that serve your area.",
    },
    {
      label: "Jobs",
      href: "/direct-connect/opportunities",
      icon: <Wrench className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Find work, post jobs or resumes, and manage applicants.",
    },
    {
      label: "Community",
      href: ROUTES.COMMUNITY ?? "/community",
      icon: <Users className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "See nearby posts and updates.",
    },
  ];

  const advancedNav: NavItem[] = [
    {
      label: "Share",
      href: "/share",
      icon: <Share2 className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Copy and publish your best links.",
    },
    {
      label: "TradeDeals",
      href: "/trade-deals",
      icon: <Sparkles className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Check partner offers and campaigns.",
    },
    {
      label: "Exchange",
      href: ROUTES.EXCHANGE ?? "/exchange",
      icon: <ShoppingBag className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Browse and post marketplace listings.",
    },
    {
      label: "Asset Management",
      href: "/homes",
      icon: <Building className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Home-first inspections, maintenance, and upgrade history.",
    },
    {
      label: "Maps",
      href: "/maps",
      icon: <Map className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Explore local and service coverage.",
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      icon: <Trophy className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "Track local trust momentum.",
    },
    {
      label: "Community Builders",
      href: "/foundation",
      icon: <Heart className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      description: "See local funding and impact.",
    },
  ];

  const includedAdvanced =
    opts?.includeAdvancedHrefs == null
      ? advancedNav
      : advancedNav.filter((item) => opts.includeAdvancedHrefs?.has(item.href));

  const baseNav: NavItem[] = [...coreNav, ...includedAdvanced];

  baseNav.push({
    label: "Help",
    href: ROUTES.HELP ?? "/help",
    icon: <CircleHelp className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    description: "Get support and how-to guidance.",
  });

  return baseNav;
};

export const MOBILE_TASKBAR_PRIMARY_LABELS = [
  "Scout",
  "Direct Connect",
  "Businesses",
  "Jobs",
  "Community",
] as const;

export function buildMobileAppTaskbarNav(items: NavItem[]): NavItem[] {
  const byLabel = new globalThis.Map(items.map((item) => [item.label, item]));
  const primary = MOBILE_TASKBAR_PRIMARY_LABELS.map((label) => byLabel.get(label)).filter(
    (item): item is NavItem => Boolean(item)
  );

  const stablePrimary = primary.map((item) =>
    item.label === "Direct Connect" ? { ...item, href: DIRECT_CONNECT_TASKBAR_RESUME_HREF } : item
  );
  const primaryLabels = new Set(MOBILE_TASKBAR_PRIMARY_LABELS);
  const secondaryApps = items.filter(
    (item) => !primaryLabels.has(item.label as (typeof MOBILE_TASKBAR_PRIMARY_LABELS)[number])
  );

  return [...stablePrimary, ...secondaryApps];
}

export function AppShell({ children, footer }: AppShellProps) {
  const { user, isAuthenticated } = useAuth();
  const isLoggedIn = !!user;
  // Impersonation banner logic
  const isImpersonating = user?.isImpersonating || user?.impersonating;
  const isMobile = useIsMobile();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isStartGuideOpen, setIsStartGuideOpen] = useState(false);
  const handedness = useHandedness();
  const [location, navigate] = useLocation();
  const { canPromptInstall, promptInstall } = useInstallPrompt();
  const isStandalone = useIsStandalone();

  // Auto-upgrade legacy location data for existing users
  useLocationUpgrade();

  const isScoutSurface = location === "/" || location.startsWith("/scout");
  const showMobileScoutHero = location === "/";
  const isAuthSurface =
    location.startsWith("/create-account") ||
    location.startsWith("/login") ||
    location.startsWith("/register");
  const isSetupSurface =
    location.startsWith("/pre-scout-setup") || isOnboardingSurfacePath(location);
  const isAdminSurface = location.startsWith("/admin");
  const isAuthOrSetupSurface = isAuthSurface || isSetupSurface;
  const role =
    typeof (user as any)?.role === "string"
      ? String((user as any).role)
          .trim()
          .toLowerCase()
      : "";
  const isSuperAdmin = (user as any)?.isSuperAdmin === true || isSuperAdminLike(role);
  const mobileBrandHref = isSuperAdmin ? "/admin" : isLoggedIn ? DEFAULT_LANDING : "/";
  const hasAdminAccess = hasAdminUiAccess(user);
  const verificationBypass = user?.verificationBypass;
  const hasAdminAliasBypass =
    verificationBypass?.active === true && verificationBypass?.reason === "email_alias";
  const shouldShowAdminNav = hasAdminAccess || isSuperAdmin || hasAdminAliasBypass;
  const unlockSnapshot = useMemo(
    () =>
      evaluateFeatureUnlocks({
        user,
        recentActivity: getRecentActivity(),
      }),
    [user, location]
  );
  const unlockedAdvancedHrefs = useMemo(
    () => getUnlockedAdvancedHrefs(unlockSnapshot),
    [unlockSnapshot]
  );
  const shouldGateAdvancedNav =
    FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING && !shouldShowAdminNav && !isAuthOrSetupSurface;
  const incomingRequestsQuery = useQuery<{ requests: any[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    enabled: Boolean(isAuthenticated) && !isAuthSurface && !isSetupSurface,
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
  });
  const contactRequestCount = incomingRequestsQuery.data?.requests?.length || 0;

  const mobileSimplificationEnabled =
    String(import.meta.env.VITE_MOBILE_SIMPLIFICATION_V1 ?? "true") === "true";
  const minimalUiEnabled = String(import.meta.env.VITE_UI_MINIMAL_V1 ?? "true") === "true";
  const isMobileSimplified =
    mobileSimplificationEnabled && isMobile && !isAuthOrSetupSurface && !isAdminSurface;

  const featureNav = buildFeatureNav({
    includeAdvancedHrefs: shouldGateAdvancedNav ? unlockedAdvancedHrefs : null,
  });
  const mobileTaskbarNav = buildMobileAppTaskbarNav(featureNav);

  const mobileSurfaceCardStyle = {
    border: "1px solid color-mix(in oklab, var(--border-primary) 82%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
    boxShadow: "inset 0 1px 0 color-mix(in oklab, white 4%, transparent)",
  } as const;

  const mobileActionButtonStyle = {
    borderColor: "color-mix(in oklab, var(--border-primary) 85%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
    color: "var(--text-primary)",
  } as const;

  const mobilePrimaryActionButtonStyle = {
    borderColor: "color-mix(in oklab, var(--theme-accent-primary) 50%, transparent)",
    backgroundColor:
      "color-mix(in oklab, var(--theme-accent-primary) 16%, var(--surface-intermediate))",
    color: "var(--theme-accent-primary)",
  } as const;

  const mobileDrawerIconStyle = { color: "var(--theme-accent-primary)" } as const;

  const navigateFromMobileTools = (href: string) => {
    setIsToolsOpen(false);
    navigate(href);
  };

  const renderMobileDrawerAction = ({
    href,
    icon,
    label,
    badge,
  }: {
    href: string;
    icon: ReactNode;
    label: string;
    badge?: string | number;
  }) => (
    <button
      key={href}
      type="button"
      onClick={() => navigateFromMobileTools(href)}
      className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium"
      style={mobileActionButtonStyle}
    >
      <span className="inline-flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {badge != null ? (
        <span
          className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            border: "1px solid color-mix(in oklab, var(--theme-accent-primary) 45%, transparent)",
            backgroundColor: "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
            color: "var(--theme-text-primary)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );

  const currentPath = location.split("?")[0].split("#")[0];
  const showFeatureNav = !isAuthOrSetupSurface && !isAdminSurface;
  const appOwnsSurfaceOrientation =
    currentPath === "/scout" ||
    currentPath.startsWith("/scout/") ||
    currentPath === "/community" ||
    currentPath.startsWith("/community/") ||
    currentPath === "/community-feed" ||
    currentPath.startsWith("/community-feed/") ||
    currentPath.startsWith("/community-post/") ||
    currentPath.startsWith("/direct-connect/opportunities") ||
    currentPath.startsWith("/direct-connect/employment");
  const showSurfaceOrientation = !appOwnsSurfaceOrientation;
  const surfaceOrientation = isAdminSurface ? null : resolveSurfaceOrientation(location);
  const publicProfileContinuation = useMemo(
    () => parsePublicProfileContinuation(location),
    [location]
  );
  const showInstallAction = !isStandalone && !isAuthOrSetupSurface;
  const handleInstallAction = async () => {
    if (canPromptInstall) {
      await promptInstall();
      return;
    }
    navigate("/install");
  };

  // Mobile density layer: applies global spacing/typography tweaks for small screens.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobile) document.body.classList.add("ts-mobile-density");
    else document.body.classList.remove("ts-mobile-density");

    return () => {
      document.body.classList.remove("ts-mobile-density");
    };
  }, [isMobile]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobileSimplified) document.body.classList.add("ts-mobile-simplified");
    else document.body.classList.remove("ts-mobile-simplified");

    return () => {
      document.body.classList.remove("ts-mobile-simplified");
    };
  }, [isMobileSimplified]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (minimalUiEnabled) {
      document.body.classList.add("ts-ui-minimal");
    } else {
      document.body.classList.remove("ts-ui-minimal");
    }

    return () => {
      document.body.classList.remove("ts-ui-minimal");
    };
  }, [minimalUiEnabled]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldScopeAuthenticatedApp = Boolean(isAuthenticated) && !isAuthOrSetupSurface;
    const shouldScopeAppWorkshop = !isAuthOrSetupSurface;

    if (shouldScopeAuthenticatedApp) {
      document.body.classList.add("ts-authenticated-app");
    } else {
      document.body.classList.remove("ts-authenticated-app");
    }

    if (shouldScopeAppWorkshop) {
      document.body.classList.add("ts-app-workshop");
    } else {
      document.body.classList.remove("ts-app-workshop");
    }

    return () => {
      document.body.classList.remove("ts-authenticated-app");
      document.body.classList.remove("ts-app-workshop");
    };
  }, [isAuthenticated, isAuthOrSetupSurface]);

  // Never keep stale tool overlays open across navigation changes.
  // This prevents transparent/full-height drawers from blocking clicks
  // when the user moves between settings/profile surfaces.
  useEffect(() => {
    setIsToolsOpen(false);
  }, [location]);

  useEffect(() => {
    if (!isLoggedIn || isAuthOrSetupSurface || isAdminSurface) return;
    try {
      if (window.localStorage.getItem(START_GUIDE_SEEN_KEY) !== "1") {
        setIsStartGuideOpen(true);
      }
    } catch {
      setIsStartGuideOpen(true);
    }
  }, [isLoggedIn, isAuthOrSetupSurface, isAdminSurface]);

  useEffect(() => {
    if (!isStartGuideOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsStartGuideOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isStartGuideOpen]);

  const closeStartGuide = () => {
    setIsStartGuideOpen(false);
    try {
      window.localStorage.setItem(START_GUIDE_SEEN_KEY, "1");
    } catch {
      // ignore
    }
  };

  const navigateFromStartGuide = (href: string) => {
    closeStartGuide();
    navigate(href);
  };

  // Mobile hero content for context/messaging/CTAs
  const renderMobileHero = () => (
    <section className="px-3 py-2 md:hidden">
      <h1 className="text-lg font-semibold leading-tight">
        Get help with your <span className="text-accent">next project</span>
      </h1>
      <p className="mt-1 text-xs text-secondary">
        Describe what you need and jump to the right page.
      </p>
      {!isLoggedIn && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] text-secondary">
            Create an account to save requests and keep replies together.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(ROUTES.REGISTER)}
              className="inline-flex items-center justify-center rounded-full border border-ts-orange/30 bg-ts-orange px-3 py-1 text-[0.85rem] font-semibold text-black shadow-sm shadow-orange-500/40"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.85rem] font-medium hover:text-white transition"
              style={{
                borderColor: "var(--border-primary)",
                backgroundColor: "var(--charcoal-900)",
                color: "var(--text-secondary)",
              }}
            >
              Sign in
            </button>
          </div>
        </div>
      )}
    </section>
  );

  // Set CSS variables for nav sizing (Step 2)
  useEffect(() => {
    const root = document.documentElement;
    const topNavHeight = isMobile ? "calc(48px + env(safe-area-inset-top))" : "56px";
    const bottomNavHeight = isMobile ? "calc(62px + env(safe-area-inset-bottom))" : "0px";

    root.style.setProperty("--top-nav-h", topNavHeight);
    root.style.setProperty("--bottom-nav-h", bottomNavHeight);
    root.style.setProperty("--right-nav-w", "256px");
  }, [isMobile]);

  // Rehydrate canonical location into the session layer on boot so that
  // useLocationContext can resolve a single authoritative source. Server
  // profile remains primary; this only helps anonymous/offline flows.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("userLocation");
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        stateCode?: string;
        countyFips?: string;
        countyName?: string;
      } | null;

      if (!parsed || !parsed.stateCode || !parsed.countyFips) return;

      setSessionLocationOverride({
        stateCode: parsed.stateCode,
        countyFips: parsed.countyFips,
        countyName: parsed.countyName,
        label: undefined,
        lat: undefined,
        lng: undefined,
      });
    } catch {
      // Ignore malformed payloads or storage issues.
    }
  }, []);

  return (
    <div
      className="app-shell relative h-full w-full overflow-hidden"
      style={{
        color: "var(--text-primary)",
      }}
    >
      {/* Impersonation banner (always visible, not dismissible) */}
      {isImpersonating && (
        <div
          style={{
            backgroundColor: "var(--surface-intermediate)",
            color: "var(--text-primary)",
            borderBottom: "1px solid var(--border-active)",
            padding: "10px 0",
            textAlign: "center",
            zIndex: 9999,
            fontWeight: 600,
          }}
        >
          Impersonation active
          <button
            style={{
              marginLeft: 24,
              backgroundColor: "var(--theme-accent-primary)",
              color: "var(--text-primary)",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={async () => {
              await fetch("/api/admin/impersonate/exit", {
                method: "POST",
                credentials: "include",
              });
              window.location.reload();
            }}
          >
            Exit impersonation
          </button>
        </div>
      )}
      {/* TOP APP NAV HEADER (MOBILE/COMPACT) */}
      {!isAdminSurface && isMobile ? (
        <header
          className="ts-shell-header-mobile fixed top-0 inset-x-0 z-50 flex items-center px-3 md:hidden"
          style={{
            height: "calc(48px + env(safe-area-inset-top))",
            paddingTop: "env(safe-area-inset-top)",
            background: "var(--surface-frame)",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          <Link href={mobileBrandHref} className="flex items-center cursor-pointer">
            <TradeScoutLogo size="sm" />
            <span
              className="ml-2 text-xs font-semibold tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              TradeScout
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {!isAuthOrSetupSurface && (
              <button
                type="button"
                onClick={() => setIsStartGuideOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
                style={{
                  borderColor: "color-mix(in oklab, var(--theme-accent-primary) 45%, transparent)",
                  backgroundColor:
                    "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
                  color: "var(--theme-accent-primary)",
                }}
                aria-label="Open Start here guide"
                title="Start here"
              >
                <Compass className="h-4 w-4" />
              </button>
            )}
            {!isMobileSimplified && !isLoggedIn && !isAuthOrSetupSurface && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor: "var(--charcoal-900)",
                  }}
                  aria-label="Create account"
                >
                  <UserPlus className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.LOGIN)}
                  className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor: "var(--charcoal-900)",
                  }}
                  aria-label="Log in"
                >
                  <LogIn className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                </button>
              </>
            )}
            {!isMobileSimplified && showInstallAction && (
              <button
                type="button"
                onClick={handleInstallAction}
                className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
                style={{
                  borderColor: "var(--border-primary)",
                  backgroundColor: "var(--charcoal-900)",
                }}
                aria-label={canPromptInstall ? "Install TradeScout app" : "Install TradeScout"}
                title="Install TradeScout"
              >
                <Download className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
              </button>
            )}
            {!isAuthOrSetupSurface && isAuthenticated && <NotificationCenter />}
            {!isMobileSimplified &&
              !isAuthOrSetupSurface &&
              isAuthenticated &&
              shouldShowAdminNav && (
                <button
                  type="button"
                  onClick={() => navigate("/admin")}
                  className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor: "var(--charcoal-900)",
                  }}
                  aria-label="Open admin controls"
                  title="Admin"
                >
                  <Shield className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                </button>
              )}
            {!isAuthOrSetupSurface && (
              <button
                type="button"
                onClick={() => setIsToolsOpen(true)}
                className="ts-shell-icon-btn inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:opacity-90 focus:outline-none"
                style={{
                  borderColor: "color-mix(in oklab, var(--border-primary) 85%, transparent)",
                  backgroundColor:
                    "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
                }}
                aria-label="Open account and tools"
              >
                <UserCircle className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />
              </button>
            )}
          </div>
        </header>
      ) : !isAdminSurface ? (
        <header
          className={`ts-shell-header fixed top-0 inset-x-0 z-40 glass-header flex items-center h-[56px] px-3 sm:px-4 border-b ${
            handedness === "left" ? "flex-row-reverse justify-between" : "justify-between"
          }`}
          style={{ backgroundColor: "var(--charcoal-950)", borderColor: "var(--border-primary)" }}
        >
          {/* Brand */}
          <Link
            href={mobileBrandHref}
            className={`flex shrink-0 items-center gap-3 cursor-pointer ${
              handedness === "left" ? "justify-end" : ""
            }`}
          >
            <TradeScoutLogo size="sm" className="" />
            <div className="flex flex-col leading-tight">
              <span
                className="text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--text-secondary)" }}
              >
                TRADESCOUT
              </span>
              {!minimalUiEnabled ? (
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Connection without compromise
                </span>
              ) : null}
            </div>
          </Link>

          {/* Right side: auth CTA + icons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isLoggedIn && !isAuthOrSetupSurface && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.REGISTER)}
                  className="inline-flex items-center justify-center rounded-full border border-ts-orange/30 bg-ts-orange px-3 py-1 text-[0.7rem] font-semibold text-black shadow-sm shadow-orange-500/40 focus:outline-none"
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.LOGIN)}
                  className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.7rem] font-medium hover:text-white transition focus:outline-none"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor: "var(--charcoal-900)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Sign in
                </button>
              </>
            )}

            {!isAuthOrSetupSurface && (
              <>
                <button
                  type="button"
                  onClick={() => setIsStartGuideOpen(true)}
                  className="hidden h-8 w-8 items-center justify-center rounded-full border transition-colors lg:inline-flex"
                  style={{
                    borderColor:
                      "color-mix(in oklab, var(--theme-accent-primary) 45%, transparent)",
                    backgroundColor:
                      "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
                    color: "var(--theme-accent-primary)",
                  }}
                  aria-label="Open Start here guide"
                  title="Start here"
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
                {showInstallAction && (
                  <button
                    type="button"
                    onClick={handleInstallAction}
                    className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                    aria-label={canPromptInstall ? "Install TradeScout app" : "Install TradeScout"}
                    title="Install TradeScout"
                  >
                    <Download
                      className="h-4 w-4"
                      style={{ color: "var(--theme-accent-primary)" }}
                    />
                  </button>
                )}
                {/* Messages quick icon */}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      contactRequestCount > 0
                        ? "/direct-connect/inbox?filter=requests"
                        : "/direct-connect/inbox"
                    )
                  }
                  className="ts-shell-icon-btn relative inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                  aria-label="Messages and helpers"
                >
                  <MessageCircle
                    className="h-4 w-4"
                    style={{ color: "var(--theme-accent-primary)" }}
                  />
                  {contactRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white px-1">
                      {contactRequestCount > 9 ? "9+" : contactRequestCount}
                    </span>
                  )}
                </button>

                {/* Notifications: full activity center (tags, comments, likes, jobs, etc.) */}
                {isAuthenticated ? (
                  <NotificationCenter />
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/notifications")}
                    className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                  </button>
                )}

                {isAuthenticated && shouldShowAdminNav ? (
                  <button
                    type="button"
                    onClick={() => navigate("/admin")}
                    className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                    aria-label="Open admin controls"
                    title="Admin"
                  >
                    <Shield className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                  </button>
                ) : null}

                {/* Tools / profile panel (user-specific stuff) */}
                <button
                  type="button"
                  onClick={() => setIsToolsOpen(true)}
                  className="ts-shell-icon-btn inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                  aria-label="Open profile & tools panel"
                >
                  <Menu className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                </button>
              </>
            )}
          </div>
        </header>
      ) : null}

      {/* Mobile hero/context strip (scrolls with content) */}
      {/* Main content: ONLY scroll container */}
      <main
        id="app-scroll-root"
        className={`
          ts-shell-main
          absolute
          left-0
          right-0
          overflow-y-auto
          overscroll-contain
          touch-pan-y
        `}
        style={{
          top: isAdminSurface ? 0 : "var(--top-nav-h)",
          bottom: showFeatureNav && isMobile ? "var(--bottom-nav-h)" : 0,
          // Let the global TradeScoutBackground show through; pages/cards provide surfaces.
          background: "transparent",
          color: "var(--text-primary)",
        }}
      >
        <div className={`app-page ${isAuthSurface ? "app-page--auth" : ""}`}>
          {publicProfileContinuation && !isAuthOrSetupSurface ? (
            <section
              className="mx-auto w-full max-w-6xl px-3 pt-2 sm:px-4 md:px-6 md:pt-3"
              data-testid="public-profile-continuation"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-500">
                    Continuing from a public profile
                  </p>
                  <p className="truncate text-xs font-semibold sm:text-sm">
                    {publicProfileContinuation.itemName || publicProfileContinuation.profileName}
                    {publicProfileContinuation.itemName ? (
                      <span className="font-normal text-[color:var(--text-secondary)]">
                        {" "}
                        · {publicProfileContinuation.profileName}
                      </span>
                    ) : null}
                  </p>
                </div>
                <Link
                  href={`/u/${encodeURIComponent(publicProfileContinuation.profileSlug)}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-subtle)] px-3 text-[11px] font-bold"
                >
                  Back to profile
                </Link>
              </div>
            </section>
          ) : null}
          {showSurfaceOrientation && !isAuthOrSetupSurface && surfaceOrientation && !isMobile && (
            <section className="mx-auto mb-3 max-w-6xl px-3 pt-3 sm:px-4 md:px-6">
              <div className="ts-shell-orientation rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {surfaceOrientation.title}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {surfaceOrientation.summary}
                    </p>
                  </div>
                  {surfaceOrientation.actionLabel && surfaceOrientation.actionHref ? (
                    <Link
                      href={surfaceOrientation.actionHref}
                      className="inline-flex shrink-0 items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        borderColor: "var(--theme-accent-primary)",
                        color: "var(--theme-accent-primary)",
                      }}
                    >
                      {surfaceOrientation.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          )}
          {showSurfaceOrientation &&
            !isAuthOrSetupSurface &&
            surfaceOrientation &&
            isMobile &&
            !isScoutSurface &&
            !isMobileSimplified && (
              <section className="px-3 pt-2">
                <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {surfaceOrientation.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {surfaceOrientation.summary}
                  </p>
                </div>
              </section>
            )}
          {isMobile && isScoutSurface && showMobileScoutHero && renderMobileHero()}
          {children}
        </div>
      </main>

      {/* Desktop tools stay on demand so pages keep their full working width. */}
      {!isMobile && isToolsOpen && !isAuthOrSetupSurface && (
        <div className="fixed inset-0 z-50 flex" style={{ top: "var(--top-nav-h)", bottom: 0 }}>
          <button
            type="button"
            aria-label="Close tools panel"
            className="flex-1 bg-black/40"
            onClick={() => setIsToolsOpen(false)}
          />
          <aside
            className="h-full"
            style={{
              width: "var(--right-nav-w)",
              background: "var(--surface-intermediate)",
              color: "var(--text-primary)",
            }}
          >
            <RightToolsPanel
              contactRequestCount={contactRequestCount}
              onNavigate={() => setIsToolsOpen(false)}
            />
          </aside>
        </div>
      )}

      {isStartGuideOpen && !isAuthOrSetupSurface && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close Start here guide"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeStartGuide}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-guide-title"
            className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border p-5 shadow-2xl sm:p-8"
            style={{
              borderColor: "color-mix(in oklab, var(--theme-accent-primary) 35%, transparent)",
              background:
                "radial-gradient(circle at 90% 5%, color-mix(in oklab, var(--theme-accent-primary) 14%, transparent), transparent 32%), var(--surface-card)",
              color: "var(--text-primary)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: "var(--theme-accent-primary)" }}
                >
                  Start here
                </p>
                <h2 id="start-guide-title" className="mt-2 text-2xl font-bold sm:text-3xl">
                  What do you want to get done?
                </h2>
                <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-secondary)" }}>
                  Choose one goal. TradeScout will take you to the right place.
                </p>
              </div>
              <button
                type="button"
                onClick={closeStartGuide}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
                aria-label="Close Start here guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {START_GUIDE_ITEMS.map((item) => (
                <button
                  key={`start-guide-${item.href}`}
                  type="button"
                  onClick={() => navigateFromStartGuide(item.href)}
                  className="group flex min-h-[142px] flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor:
                      "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                  }}
                >
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor:
                        "color-mix(in oklab, var(--theme-accent-primary) 14%, transparent)",
                      color: "var(--theme-accent-primary)",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="mt-4 flex w-full items-start justify-between gap-3">
                    <span className="font-semibold">{item.label}</span>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
                      style={{ color: "var(--theme-accent-primary)" }}
                    />
                  </span>
                  <span
                    className="mt-1 text-xs leading-5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.description}
                  </span>
                </button>
              ))}
            </div>

            <div
              className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                You can reopen this guide anytime from the top navigation.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigateFromStartGuide("/profile")}
                  className="rounded-full border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  My profile
                </button>
                <button
                  type="button"
                  onClick={() => navigateFromStartGuide(ROUTES.HELP ?? "/help")}
                  className="rounded-full border px-3 py-2 text-xs font-semibold"
                  style={{
                    borderColor: "var(--theme-accent-primary)",
                    color: "var(--theme-accent-primary)",
                  }}
                >
                  Help center
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MOBILE FEATURE NAV */}
      {showFeatureNav && isMobile && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
          <MobileAppBar items={mobileTaskbarNav} primaryLimit={5} stablePrimary />
        </div>
      )}

      {/* Desktop-only legal footer, used by standalone content pages when supplied. */}
      {!isMobile && footer && (
        <div
          className="border-t"
          style={{ borderColor: "var(--border-secondary)", background: "var(--surface-app-bg)" }}
        >
          {footer}
        </div>
      )}

      {/* MOBILE TOOLS DRAWER = PROFILE / DASHBOARD / SETTINGS, etc. */}
      {isMobile && isToolsOpen && !isAuthOrSetupSurface && !isMobileSimplified && (
        <div
          className="fixed inset-x-0 top-0 z-40 flex"
          style={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            aria-label="Close tools menu"
            className="flex-1 bg-black/40"
            onClick={() => setIsToolsOpen(false)}
          />
          <div
            className="w-72 max-w-full flex flex-col border-l"
            style={{
              backgroundColor: "var(--surface-card)",
              borderColor: "color-mix(in oklab, var(--border-primary) 82%, transparent)",
              boxShadow: "-10px 0 28px color-mix(in oklab, black 20%, transparent)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "color-mix(in oklab, var(--border-primary) 70%, transparent)" }}
            >
              <span
                className="text-[0.7rem] uppercase tracking-[0.2em]"
                style={{ color: "var(--text-secondary)" }}
              >
                Tools &amp; profile
              </span>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition"
                style={{
                  borderColor: "color-mix(in oklab, var(--border-primary) 85%, transparent)",
                  color: "var(--text-secondary)",
                  backgroundColor:
                    "color-mix(in oklab, var(--surface-intermediate) 85%, var(--surface-card))",
                }}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RightToolsPanel
                contactRequestCount={contactRequestCount}
                onNavigate={() => setIsToolsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* MOBILE ACCOUNT/SYSTEM DRAWER */}
      {isMobile && isToolsOpen && !isAuthOrSetupSurface && isMobileSimplified && (
        <div
          className="fixed inset-x-0 top-0 z-50"
          style={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            aria-label="Close mobile tools"
            className="h-full w-full bg-black/45"
            onClick={() => setIsToolsOpen(false)}
          />

          <div
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t p-4"
            style={{
              backgroundColor: "var(--surface-card)",
              borderColor: "color-mix(in oklab, var(--border-primary) 80%, transparent)",
              boxShadow: "0 -16px 40px color-mix(in oklab, black 24%, transparent)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Account
              </h2>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg border px-3 text-xs"
                style={{
                  borderColor: "color-mix(in oklab, var(--border-primary) 85%, transparent)",
                  backgroundColor:
                    "color-mix(in oklab, var(--surface-intermediate) 84%, var(--surface-card))",
                  color: "var(--text-secondary)",
                }}
              >
                Close
              </button>
            </div>

            {!isLoggedIn ? (
              <div
                className="grid grid-cols-1 gap-2 rounded-2xl p-3"
                style={mobileSurfaceCardStyle}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsToolsOpen(false);
                    navigate(ROUTES.REGISTER);
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold"
                  style={mobilePrimaryActionButtonStyle}
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsToolsOpen(false);
                    navigate(ROUTES.LOGIN);
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium"
                  style={mobileActionButtonStyle}
                >
                  Sign in
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="grid grid-cols-1 gap-2 rounded-lg p-3"
                  style={mobileSurfaceCardStyle}
                >
                  {renderMobileDrawerAction({
                    href: "/profile",
                    icon: <UserCircle className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Profile",
                  })}
                  {renderMobileDrawerAction({
                    href: "/profile-settings",
                    icon: <UserCircle className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Profile settings",
                  })}
                  {renderMobileDrawerAction({
                    href: "/settings",
                    icon: <Settings className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Settings",
                  })}
                </div>

                <div
                  className="grid grid-cols-1 gap-2 rounded-lg p-3"
                  style={mobileSurfaceCardStyle}
                >
                  {renderMobileDrawerAction({
                    href: "/settings?tab=roles",
                    icon: <Users className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Permissions & roles",
                  })}
                  {renderMobileDrawerAction({
                    href: "/verification",
                    icon: <BadgeCheck className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Verification",
                  })}
                  {renderMobileDrawerAction({
                    href: "/notifications",
                    icon: <Bell className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Notifications",
                  })}
                  {renderMobileDrawerAction({
                    href: "/settings?tab=privacy",
                    icon: <Shield className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Privacy",
                  })}
                  {renderMobileDrawerAction({
                    href: "/settings?tab=security",
                    icon: <LockKeyhole className="h-4 w-4" style={mobileDrawerIconStyle} />,
                    label: "Security",
                  })}
                </div>
              </div>
            )}

            <div
              className="mt-5 grid grid-cols-1 gap-2 rounded-2xl p-3"
              style={mobileSurfaceCardStyle}
            >
              {showInstallAction && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsToolsOpen(false);
                    await handleInstallAction();
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium"
                  style={mobileActionButtonStyle}
                >
                  Install app
                </button>
              )}
              {isAuthenticated && shouldShowAdminNav && (
                <button
                  type="button"
                  onClick={() => {
                    setIsToolsOpen(false);
                    navigate("/admin");
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium"
                  style={mobileActionButtonStyle}
                >
                  Admin controls
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppShell;
