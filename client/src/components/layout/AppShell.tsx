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
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const handedness = useHandedness();
  const [location, navigate] = useLocation();

  useEffect(() => {
    console.log("AppShell mounted");
  }, []);

  return (
    <div
      className="app-shell flex flex-col min-h-screen"
      style={{ 
        color: 'var(--text-primary)',
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* TOP APP NAV HEADER */}
      {location.startsWith("/scout") ? (
        // Cleaner, chat-focused header for Scout: now left-aligned brand with tagline
        <header className="fixed top-0 inset-x-0 z-40 flex items-center h-[56px] px-2 sm:px-4 justify-between border-b" style={{ backgroundColor: 'var(--surface-frame)', borderColor: 'var(--surface-frame-border)' }}>
          <Link
            href="/"
            className="flex items-center gap-3 cursor-pointer"
          >
            <TradeScoutLogo size="sm" className="" />
            <div className="flex flex-col leading-tight">
              <span className="text-[0.65rem] uppercase tracking-[0.32em]" style={{ color: 'var(--text-secondary)' }}>
                TRADESCOUT
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Connection without compromise
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 justify-end">
            {/* Messages quick icon */}
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
              </button>
            )}

            {/* Tools / profile panel (user-specific stuff) */}
            <button
              type="button"
              onClick={() => setIsToolsOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
              aria-label="Open profile & tools panel"
            >
              <Menu className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
            </button>
          </div>
        </header>
      ) : (
        <header
          className={`fixed top-0 inset-x-0 z-40 backdrop-blur flex items-center h-[56px] px-3 sm:px-4 border-b ${
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
            {!isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/register")}
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
              </button>
            )}

            {/* Tools / profile panel (user-specific stuff) */}
            <button
              type="button"
              onClick={() => setIsToolsOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
              aria-label="Open profile & tools panel"
            >
              <Menu className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
            </button>
          </div>
        </header>
      )}

      <div className="flex flex-1 min-h-0">
        <main
          className={`flex flex-col flex-1 min-w-0 overflow-y-auto ${
            // Reserve space for fixed header on mobile (uniform height)
            isMobile ? "pt-[56px]" : ""
          } pb-[84px]`}
        >
          {children}
        </main>
      </div>

      {/* USER-SPECIFIC PAGES LIVE HERE (desktop) - FIXED alongside bottom nav */}
      {!isMobile && (
        <aside className="hidden lg:block fixed right-0 bottom-0 w-80 overflow-y-auto z-40" style={{ background: 'var(--surface-intermediate)', height: 'calc(100vh - 56px - 68px)', top: '56px' }}>
          {/* On desktop, keep the global footer only at the bottom of the shell;
             the tools panel shows account tools without duplicating legal copy. */}
          <RightToolsPanel />
        </aside>
      )}

      {/* Super admin tools bar appears on every page for high-level roles */}
      <AdminPageToolsBar />

      {/* BOTTOM BAR: SCROLLABLE SITE FEATURE NAV (mobile + desktop) */}
      <MobileAppBar items={featureNav} />

      {/* Desktop-only legal footer sits below the bottom nav so the
          site still feels app-like while keeping legal links visible. */}
      {!isMobile && footer && (
        <div className="border-t" style={{ borderColor: 'var(--border-secondary)', background: 'var(--charcoal-900)' }}>
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
