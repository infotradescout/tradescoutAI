import React, { ReactNode, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  MessageCircle,
  Bell,
  Users,
  Home,
  ShoppingBag,
  Trophy,
  Heart,
  Share2,
  Compass,
  Map,
  Menu,
  UserPlus,
  LogIn,
  Download,
  Wrench,
  ClipboardList,
  CircleHelp,
  Sparkles,
  Shield,
  Building,
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

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
};

type AppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

// SITE FEATURES ONLY – this is the scrollable bottom bar
// Direct Connect is the primary coordination hub; contractors/helpers
// are still available as subordinate surfaces but are not top-level nav.
const buildFeatureNav = (isSuperAdmin: boolean, isAuthenticated: boolean): NavItem[] => {
  const baseNav: NavItem[] = [
    {
      label: "Scout",
      href: "/scout",
      icon: <Compass className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Direct Connect",
      href: "/direct-connect",
      icon: <ClipboardList className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Community",
      href: ROUTES.COMMUNITY ?? "/community",
      icon: <Users className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "TradeDeals",
      href: "/trade-deals",
      icon: <Sparkles className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "EXCHANGE",
      href: ROUTES.EXCHANGE ?? "/exchange",
      icon: <ShoppingBag className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "HomeScout",
      href: "/real-estate-marketplace",
      icon: <Building className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Maps",
      href: "/maps",
      icon: <Map className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Commercial",
      href: "/commercial-directory",
      icon: <Wrench className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      icon: <Trophy className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Community Builders",
      href: "/foundation",
      icon: <Heart className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Help",
      href: ROUTES.HELP ?? "/help",
      icon: <CircleHelp className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
    {
      label: "Share",
      href: "/affiliate",
      icon: <Share2 className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
    },
  ];

  // Add Admin link at the FRONT for super admins
  if (isSuperAdmin) {
    return [
      {
        label: "Admin",
        href: "/admin",
        icon: <Shield className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />,
      },
      ...baseNav,
    ];
  }

  return baseNav;
};

export function AppShell({ children, footer }: AppShellProps) {
  const { user, isAuthenticated } = useAuth();
  const isLoggedIn = !!user;
  // Impersonation banner logic
  const isImpersonating = user?.isImpersonating || user?.impersonating;
  const impersonatedUser =
    user?.impersonatedUser ||
    (isImpersonating ? { name: user?.firstName + " " + user?.lastName, email: user?.email } : null);
  const isMobile = useIsMobile();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const handedness = useHandedness();
  const [location, navigate] = useLocation();
  const { canPromptInstall, promptInstall } = useInstallPrompt();
  const isStandalone = useIsStandalone();
  const isScoutSurface = location === "/" || location.startsWith("/scout");
  const showMobileScoutHero = location === "/";
  const isAuthSurface =
    location.startsWith("/create-account") ||
    location.startsWith("/login") ||
    location.startsWith("/register");
  const isSetupSurface =
    location.startsWith("/pre-scout-setup") ||
    location.startsWith("/onboarding/profile") ||
    location.startsWith("/profile-setup");
  const isAuthOrSetupSurface = isAuthSurface || isSetupSurface;
  const role =
    typeof (user as any)?.role === "string"
      ? String((user as any).role)
          .trim()
          .toLowerCase()
      : "";
  const isSuperAdmin =
    (user as any)?.isSuperAdmin === true ||
    role === "super_admin" ||
    role === "head_admin" ||
    role === "owner";
  const incomingRequestsQuery = useQuery<{ requests: any[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    enabled: Boolean(isAuthenticated) && !isAuthSurface && !isSetupSurface,
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
  });
  const contactRequestCount = incomingRequestsQuery.data?.requests?.length || 0;

  const featureNav = buildFeatureNav(isSuperAdmin, isAuthenticated);
  const showFeatureNav = !isAuthOrSetupSurface;
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

  // Mobile hero content for context/messaging/CTAs
  const renderMobileHero = () => (
    <section className="px-3 py-2 md:hidden">
      <h1 className="text-lg font-semibold leading-tight">
        Get help with your <span className="text-accent">next project</span>
      </h1>
      <p className="mt-1 text-xs text-secondary">
        Tell Scout what you need and jump to the right page.
      </p>
      {!isLoggedIn && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] text-secondary">Contact requires an account to prevent spam.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/pre-scout-setup?mode=create")}
              className="inline-flex items-center justify-center rounded-full border border-orange-500/70 bg-orange-500 px-3 py-1 text-[0.85rem] font-semibold text-slate-950 shadow-sm shadow-orange-500/40"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={() => navigate("/pre-scout-setup?mode=signin")}
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
    const bottomNavHeight = isMobile ? "calc(62px + env(safe-area-inset-bottom))" : "68px";

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
      {isImpersonating && impersonatedUser && (
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
          Impersonating {impersonatedUser.name} ({impersonatedUser.email})
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
      {isMobile ? (
        <header
          className="fixed top-0 inset-x-0 z-50 flex items-center px-3 md:hidden"
          style={{
            height: "calc(48px + env(safe-area-inset-top))",
            paddingTop: "env(safe-area-inset-top)",
            background: "var(--surface-frame)",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          <Link href={isSuperAdmin ? "/admin" : "/"} className="flex items-center cursor-pointer">
            <TradeScoutLogo size="sm" />
            <span
              className="ml-2 text-xs font-semibold tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              TradeScout
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {!isLoggedIn && !isAuthOrSetupSurface && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/pre-scout-setup?mode=create")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
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
                  onClick={() => navigate("/pre-scout-setup?mode=signin")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
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
            {showInstallAction && (
              <button
                type="button"
                onClick={handleInstallAction}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80 focus:outline-none"
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
            {!isAuthOrSetupSurface && (
              <button
                type="button"
                onClick={() => setIsToolsOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                aria-label="Open profile & tools panel"
              >
                <Menu className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />
              </button>
            )}
          </div>
        </header>
      ) : (
        <header
          className={`fixed top-0 inset-x-0 z-40 glass-header flex items-center h-[56px] px-3 sm:px-4 border-b ${
            handedness === "left" ? "flex-row-reverse justify-between" : "justify-between"
          }`}
          style={{ backgroundColor: "var(--charcoal-950)", borderColor: "var(--border-primary)" }}
        >
          {/* Brand */}
          <Link
            href="/"
            className={`flex items-center gap-3 cursor-pointer ${
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
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Connection without compromise
              </span>
            </div>
          </Link>

          {/* Right side: auth CTA + icons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isLoggedIn && !isAuthOrSetupSurface && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/pre-scout-setup?mode=create")}
                  className="inline-flex items-center justify-center rounded-full border border-orange-500/70 bg-orange-500 px-3 py-1 text-[0.7rem] font-semibold text-slate-950 shadow-sm shadow-orange-500/40 focus:outline-none"
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/pre-scout-setup?mode=signin")}
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
                {showInstallAction && (
                  <button
                    type="button"
                    onClick={handleInstallAction}
                    className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
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
                  onClick={() => navigate("/messages")}
                  className="relative inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
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
                    className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                  </button>
                )}

                {/* Tools / profile panel (user-specific stuff) */}
                <button
                  type="button"
                  onClick={() => setIsToolsOpen(true)}
                  className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80 focus:outline-none"
                  aria-label="Open profile & tools panel"
                >
                  <Menu className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* Mobile hero/context strip (scrolls with content) */}
      {/* Main content: ONLY scroll container */}
      <main
        id="app-scroll-root"
        className={`
          absolute
          left-0
          right-0
          overflow-y-auto
          overscroll-contain
          touch-pan-y
        `}
        style={{
          top: "var(--top-nav-h)",
          bottom: showFeatureNav ? "var(--bottom-nav-h)" : 0,
          paddingRight: !isMobile && !isScoutSurface ? "var(--right-nav-w)" : undefined,
          // Let the global TradeScoutBackground show through; pages/cards provide surfaces.
          background: "transparent",
          color: "var(--text-primary)",
        }}
      >
        <div className={`app-page ${isAuthSurface ? "app-page--auth" : ""}`}>
          {isMobile && isScoutSurface && showMobileScoutHero && renderMobileHero()}
          {children}
        </div>
      </main>

      {/* USER-SPECIFIC PAGES LIVE HERE (desktop) - FIXED alongside bottom nav */}
      {!isMobile && !isAuthOrSetupSurface && !isScoutSurface && (
        <aside
          className="hidden lg:block fixed z-40"
          style={{
            top: "var(--top-nav-h)",
            bottom: "var(--bottom-nav-h)",
            right: 0,
            width: "var(--right-nav-w)",
            background: "var(--surface-intermediate)",
            color: "var(--text-primary)",
          }}
        >
          <RightToolsPanel />
        </aside>
      )}

      {/* Scout-only: keep the chat surface clean; open the tools panel only on demand. */}
      {!isMobile && isScoutSurface && isToolsOpen && !isAuthOrSetupSurface && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ top: "var(--top-nav-h)", bottom: showFeatureNav ? "var(--bottom-nav-h)" : 0 }}
        >
          <button
            type="button"
            aria-label="Close tools panel"
            className="flex-1 bg-black/40"
            onClick={() => setIsToolsOpen(false)}
          />
          <aside
            className="hidden lg:block h-full"
            style={{
              width: "var(--right-nav-w)",
              background: "var(--surface-intermediate)",
              color: "var(--text-primary)",
            }}
          >
            <RightToolsPanel onNavigate={() => setIsToolsOpen(false)} />
          </aside>
        </div>
      )}

      {/* BOTTOM BAR: SCROLLABLE SITE FEATURE NAV (mobile + desktop) */}
      {showFeatureNav && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
          <MobileAppBar items={featureNav} />
        </div>
      )}

      {/* Desktop-only legal footer sits below the bottom nav so the
          site still feels app-like while keeping legal links visible. */}
      {!isMobile && footer && (
        <div
          className="border-t"
          style={{ borderColor: "var(--border-secondary)", background: "var(--surface-app-bg)" }}
        >
          {footer}
        </div>
      )}

      {/* MOBILE TOOLS DRAWER = PROFILE / DASHBOARD / SETTINGS, etc. */}
      {isMobile && isToolsOpen && !isAuthOrSetupSurface && (
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
            className="w-72 max-w-full flex flex-col"
            style={{ backgroundColor: "var(--surface-intermediate)" }}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span
                className="text-[0.7rem] uppercase tracking-[0.2em]"
                style={{ color: "var(--text-secondary)" }}
              >
                Tools &amp; profile
              </span>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border transition"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                }}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RightToolsPanel onNavigate={() => setIsToolsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppShell;
