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
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { RightToolsPanel } from "@/components/layout/RightToolsPanel";
import MobileAppBar from "@/components/navigation/MobileAppBar";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { AdminPageToolsBar } from "@/components/admin/AdminPageToolsBar";

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
    icon: <Compass className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Community",
    href: ROUTES.COMMUNITY ?? "/community",
    icon: <Users className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Contractors",
    href: ROUTES.CONTRACTORS ?? "/contractors",
    icon: <Home className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: <ClipboardList className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Helpers",
    href: "/worker-marketplace",
    icon: <Wrench className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "MealScout",
    href: "/mealscout",
    icon: <Utensils className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Messages",
    href: "/messages",
    icon: <MessageCircle className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "EXCHANGE",
    href: "/exchange",
    icon: <ShoppingBag className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    icon: <Trophy className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Foundation",
    href: "/foundation",
    icon: <Heart className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Help",
    href: ROUTES.HELP ?? "/help",
    icon: <CircleHelp className="h-5 w-5 text-orange-400" />,
  },
  {
    label: "Share",
    href: "/affiliate",
    icon: <Share2 className="h-5 w-5 text-orange-400" />,
  },
];

export function AppShell({ children, footer }: AppShellProps) {
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const handedness = useHandedness();

  useEffect(() => {
    console.log("AppShell mounted");
  }, []);

  return (
    <div className="app-shell text-slate-50 flex flex-col overflow-hidden">
      {/* TOP APP NAV HEADER */}
      <header
        className={`flex items-center px-3 sm:px-4 py-3 ${
          handedness === "left" ? "flex-row-reverse justify-between" : "justify-between"
        }`}
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
            <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">
              TRADESCOUT
            </span>
            <span className="text-xs text-slate-400">
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
                onClick={() => (window.location.href = "/register")}
                className="inline-flex items-center justify-center rounded-full border border-orange-500/70 bg-orange-500 px-3 py-1 text-[0.7rem] font-semibold text-slate-950 shadow-sm shadow-orange-500/40"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/login")}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[0.7rem] font-medium text-slate-200 hover:border-orange-400 hover:text-white"
              >
                Log in
              </button>
            </>
          )}

          {/* Messages quick icon */}
          <button
            type="button"
            onClick={() => (window.location.href = "/messages")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80 text-slate-300 hover:bg-slate-900"
            aria-label="Messages and helpers"
          >
            <MessageCircle className="h-4 w-4 text-orange-400" />
          </button>

          {/* Notifications */}
          {isAuthenticated ? (
            <NotificationsMenu />
          ) : (
            <button
              type="button"
              onClick={() => (window.location.href = "/notifications")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80 text-slate-300 hover:bg-slate-900"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-orange-400" />
            </button>
          )}

          {/* Tools / profile panel (user-specific stuff) */}
          <button
            type="button"
            onClick={() => setIsToolsOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80 text-slate-200 hover:bg-slate-900"
            aria-label="Open profile & tools panel"
          >
            <Menu className="h-4 w-4 text-orange-400" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 min-w-0 pb-24 lg:pb-0 overflow-y-auto">
          {children}
        </main>

        {/* USER-SPECIFIC PAGES LIVE HERE (desktop) */}
        {!isMobile && (
          <aside className="hidden lg:block w-80 bg-slate-950/90 overflow-y-auto">
            {/* On desktop, keep the global footer only at the bottom of the shell;
               the tools panel shows account tools without duplicating legal copy. */}
            <RightToolsPanel />
          </aside>
        )}
      </div>

      {/* Super admin tools bar appears on every page for high-level roles */}
      <AdminPageToolsBar />

      {/* BOTTOM BAR: SCROLLABLE SITE FEATURE NAV (mobile + desktop) */}
      <MobileAppBar items={featureNav} />

      {/* Desktop-only legal footer sits below the bottom nav so the
          site still feels app-like while keeping legal links visible. */}
      {!isMobile && footer && (
        <div className="border-t border-slate-900/80 bg-slate-950/95">
          {footer}
        </div>
      )}

      {/* MOBILE TOOLS DRAWER = PROFILE / DASHBOARD / SETTINGS, etc. */}
      {isMobile && isToolsOpen && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close tools menu"
            className="flex-1 bg-black/40"
            onClick={() => setIsToolsOpen(false)}
          />
          <div className="w-72 max-w-full bg-slate-950 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500">
                Tools &amp; profile
              </span>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
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
