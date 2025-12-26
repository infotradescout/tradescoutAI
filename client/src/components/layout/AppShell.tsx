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
  Menu,
  Wrench,
  ClipboardList,
  Utensils,
  CircleHelp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHandedness } from "@/hooks/useHandedness";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ROUTES } from "@/lib/routes";
import { NotificationCenter } from "@/components/ui/notification-center";
import { RightToolsPanel } from "@/components/layout/RightToolsPanel";
import MobileAppBar from "@/components/navigation/MobileAppBar";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { AdminPageToolsBar } from "@/components/admin/AdminPageToolsBar";
import { useLocation } from "wouter";

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
const featureNav: NavItem[] = [
  {
    label: "Scout",
    href: "/scout",
    icon: <Compass className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Community",
    href: ROUTES.COMMUNITY ?? "/community",
    icon: <Users className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Contractors",
    href: ROUTES.CONTRACTORS ?? "/contractors",
    icon: <Home className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: <ClipboardList className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Helpers",
    href: "/worker-marketplace",
    icon: <Wrench className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "MealScout",
    href: "/mealscout",
    icon: <Utensils className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "EXCHANGE",
    href: ROUTES.EXCHANGE ?? "/exchange",
    icon: <ShoppingBag className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    icon: <Trophy className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Foundation",
    href: "/foundation",
    icon: <Heart className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Help",
    href: ROUTES.HELP ?? "/help",
    icon: <CircleHelp className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
  {
    label: "Share",
    href: "/affiliate",
    icon: <Share2 className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />,
  },
];

export function AppShell({ children, footer }: AppShellProps) {
  const { user, isAuthenticated } = useAuth();
  const isLoggedIn = !!user;
  const isOnboarded = user?.onboardingCompleted === true;
  // Impersonation banner logic
  const isImpersonating = user?.isImpersonating || user?.impersonating;
  const impersonatedUser = user?.impersonatedUser || (isImpersonating ? { name: user?.firstName + ' ' + user?.lastName, email: user?.email } : null);
  const isMobile = useIsMobile();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const handedness = useHandedness();
  const [location, navigate] = useLocation();

  // Mobile hero content for context/messaging/CTAs
  const renderMobileHero = () => (
    <section className="pt-[52px] px-4 py-6 md:hidden">
      <h1 className="text-xl font-semibold">
        Empowering <span className="text-accent">Your Community</span>
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Scout local projects, pros, and updates in your area.
      </p>
      {(!isLoggedIn || !isOnboarded) && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => navigate("/create-account")}
            className="inline-flex items-center justify-center rounded-full border border-orange-500/70 bg-orange-500 px-3 py-1 text-[0.85rem] font-semibold text-slate-950 shadow-sm shadow-orange-500/40"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.85rem] font-medium hover:text-white transition"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--charcoal-900)', color: 'var(--text-secondary)' }}
          >
            Log in
          </button>
        </div>
      )}
    </section>
  );

  // Set CSS variables for nav sizing (Step 2)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--top-nav-h', '56px');
    root.style.setProperty('--bottom-nav-h', '68px');
    root.style.setProperty('--right-nav-w', '256px');
  }, []);

  return (
    <div
      className="app-shell relative h-full w-full overflow-hidden"
      style={{ 
        color: 'var(--text-primary)',
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Impersonation banner (always visible, not dismissible) */}
      {isImpersonating && impersonatedUser && (
        <div style={{ background: '#fffbe6', color: '#ad7b00', borderBottom: '2px solid #ffe58f', padding: '10px 0', textAlign: 'center', zIndex: 9999, fontWeight: 600 }}>
          Impersonating {impersonatedUser.name} ({impersonatedUser.email})
          <button
            style={{ marginLeft: 24, background: '#ffe58f', color: '#ad7b00', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}
            onClick={async () => {
              await fetch('/api/admin/impersonate/exit', { method: 'POST', credentials: 'include' });
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
          className="fixed top-0 inset-x-0 z-50 flex items-center h-[52px] px-3 md:hidden"
          style={{ background: 'var(--surface-frame)', borderBottom: '1px solid var(--border-primary)' }}
        >
          <Link href="/" className="flex items-center cursor-pointer">
            <TradeScoutLogo size="xs" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <NotificationCenter />
            <button
              type="button"
              onClick={() => setIsToolsOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80"
              aria-label="Open profile & tools panel"
            >
              <Menu className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />
            </button>
          </div>
        </header>
      ) : (
        <header
          className={`fixed top-0 inset-x-0 z-40 glass-header flex items-center h-[56px] px-3 sm:px-4 border-b ${
            handedness === "left" ? "flex-row-reverse justify-between" : "justify-between"
          }`}
          style={{ backgroundColor: 'var(--charcoal-950)', borderColor: 'var(--border-primary)' }}
        >
          {/* Brand */}
          <Link
            href="/"
            className={`flex items-center gap-3 cursor-pointer ${
              handedness === "left" ? "justify-end" : ""
            }`}
          >
            <TradeScoutLogo
              size="sm"
              className=""
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[0.65rem] uppercase tracking-[0.35em]" style={{ color: 'var(--text-secondary)' }}>
                TRADESCOUT
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Connection without compromise
              </span>
            </div>
          </Link>

          {/* Right side: auth CTA + icons */}
          <div className="flex items-center gap-2 shrink-0">
            {(!isLoggedIn || !isOnboarded) && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/create-account")}
                  className="inline-flex items-center justify-center rounded-full border border-orange-500/70 bg-orange-500 px-3 py-1 text-[0.7rem] font-semibold text-slate-950 shadow-sm shadow-orange-500/40"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.7rem] font-medium hover:text-white transition"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--charcoal-900)', color: 'var(--text-secondary)' }}
                >
                  Log in
                </button>
              </>
            )}

            {/* Messages quick icon */}
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80"
              aria-label="Messages and helpers"
            >
              <MessageCircle className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
            </button>

            {/* Notifications: full activity center (tags, comments, likes, jobs, etc.) */}
            {isAuthenticated ? (
              <NotificationCenter />
            ) : (
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
              </button>
            )}

            {/* Tools / profile panel (user-specific stuff) */}
            <button
              type="button"
              onClick={() => setIsToolsOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center transition hover:opacity-80"
              aria-label="Open profile & tools panel"
            >
              <Menu className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
            </button>
          </div>
        </header>
      )}

      {/* Mobile hero/context strip (scrolls with content) */}
      {isMobile && renderMobileHero()}

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
          top: 'var(--top-nav-h)',
          bottom: 'var(--bottom-nav-h)',
          paddingRight: !isMobile ? 'var(--right-nav-w)' : undefined,
          background: 'var(--surface-app-bg)',
          color: 'var(--text-primary)'
        }}
      >
        {children}
      </main>

      {/* USER-SPECIFIC PAGES LIVE HERE (desktop) - FIXED alongside bottom nav */}
      {!isMobile && (
        <aside
          className="hidden lg:block fixed z-40"
          style={{
            top: 'var(--top-nav-h)',
            bottom: 'var(--bottom-nav-h)',
            right: 0,
            width: 'var(--right-nav-w)',
            background: 'var(--surface-intermediate)',
            color: 'var(--text-primary)'
          }}
        >
          <RightToolsPanel />
        </aside>
      )}

      {/* Super admin tools bar appears on every page for high-level roles */}
      <AdminPageToolsBar />

      {/* BOTTOM BAR: SCROLLABLE SITE FEATURE NAV (mobile + desktop) */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
        <MobileAppBar items={featureNav} />
      </div>

      {/* Desktop-only legal footer sits below the bottom nav so the
          site still feels app-like while keeping legal links visible. */}
      {!isMobile && footer && (
        <div className="border-t" style={{ borderColor: 'var(--border-secondary)', background: 'var(--surface-app-bg)' }}>
          {footer}
        </div>
      )}

      {/* MOBILE TOOLS DRAWER = PROFILE / DASHBOARD / SETTINGS, etc. */}
      {isMobile && isToolsOpen && (
        <div className="fixed inset-x-0 top-0 z-40 flex" style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            aria-label="Close tools menu"
            className="flex-1 bg-black/40"
            onClick={() => setIsToolsOpen(false)}
          />
          <div className="w-72 max-w-full flex flex-col" style={{ backgroundColor: 'var(--surface-intermediate)' }}>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[0.7rem] uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
                Tools &amp; profile
              </span>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border transition"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
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
