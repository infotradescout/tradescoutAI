import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { trackShellEvent, getDeviceType } from "@/lib/analytics";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { Home, Users, MessageCircle, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { RightToolsPanel } from "@/components/layout/RightToolsPanel";

export type CommunityShellProps = {
  sectionLabel: string;
  notificationsCount?: number;
  children: React.ReactNode;
};

export const CommunityShell: React.FC<CommunityShellProps> = ({
  sectionLabel,
  notificationsCount = 0,
  children,
}) => {
  const [location, navigate] = useLocation();
  const { user } = useAuth() as any;
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);

  const locationLabel: string = React.useMemo(() => {
    if (!user) return "Set your location";
    if ((user as any).location) return (user as any).location as string;
    if ((user as any).county) return String((user as any).county);
    return "Your area";
  }, [user]);

  const avatarUrl: string | null = (user as any)?.profileImageUrl ?? null;

  const initials: string = React.useMemo(() => {
    const raw =
      ((user as any)?.name as string | undefined) ||
      ((user as any)?.email as string | undefined) ||
      "";
    if (!raw) return "";
    const parts = raw.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user]);

  type NavItem = {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    testId: string;
  };

  const navItems: NavItem[] = [
    { label: "Home", path: "/", icon: Home, testId: "nav-home" },
    { label: "Community", path: "/community", icon: Users, testId: "nav-community" },
    { label: "For Sale", path: "/marketplace", icon: ShoppingBag, testId: "nav-marketplace" },
    { label: "Groups", path: "/groups", icon: Users, testId: "nav-groups" },
    { label: "Messages", path: "/messages", icon: MessageCircle, testId: "nav-messages" },
  ];

  const isActive = (path: string): boolean => {
    if (path === "/") {
      return location === "/";
    }
    return location === path || location.startsWith(path + "/");
  };

  const handleNavClick = (path: string) => {
    if (location === path) return;
    trackShellEvent({
      type: "community_shell_nav_click",
      fromPath: location,
      toPath: path,
      deviceType: getDeviceType(),
      hasUnreadNotifications: notificationsCount > 0,
    });
    navigate(path);
  };

  React.useEffect(() => {
    trackShellEvent({
      type: "community_shell_load",
      path: location,
      deviceType: getDeviceType(),
      hasUnreadNotifications: notificationsCount > 0,
      locationSet: !!(user && ((user as any).location || (user as any).county)),
    });
  }, [location, notificationsCount, user]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur"
        data-testid="community-shell-header"
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="text-xs uppercase tracking-[0.16em] text-slate-400 text-left hover:text-slate-200"
            data-testid="community-shell-header-location"
          >
            {locationLabel}
          </button>
          <span
            className="text-sm font-semibold text-slate-50"
            data-testid="community-shell-header-section"
          >
            {sectionLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationsMenu />

          {/* Mobile tools toggle (replaces avatar as primary control) */}
          <button
            type="button"
            onClick={() => setIsToolsOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 lg:hidden"
            aria-label="Open tools and personalization menu"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              {children}
            </div>
            {/* Desktop / large screens: persistent right tools panel */}
            <div className="hidden lg:block">
              <RightToolsPanel />
            </div>
          </div>
        </div>
      </main>

      {/* Mobile overlay for tools panel */}
      {isToolsOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="flex-1 bg-black/50"
            aria-label="Close tools menu"
            onClick={() => setIsToolsOpen(false)}
          />
          <div className="w-4/5 max-w-xs bg-slate-950 border-l border-slate-800 p-4 shadow-xl shadow-black/50 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Tools & Personalization</span>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                aria-label="Close tools menu"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <RightToolsPanel />
          </div>
        </div>
      )}
    </div>
  );
};

// Alias for architectural clarity: this is the unified app shell
export const AppShell: React.FC<CommunityShellProps> = CommunityShell;
