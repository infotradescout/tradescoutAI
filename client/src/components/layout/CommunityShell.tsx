import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { trackShellEvent, getDeviceType } from "@/lib/analytics";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { Home, Users, MessageCircle, ShoppingBag } from "lucide-react";

type CommunityShellProps = {
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

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold uppercase text-slate-100"
            aria-label="Open profile"
            data-testid="community-shell-avatar"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={(user as any)?.name || (user as any)?.email || "User avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              initials || "U"
            )}
          </button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
          {children}
        </div>
      </main>

      <nav
        className="sticky bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-2 py-1.5 backdrop-blur md:hidden"
        aria-label="Primary"
        data-testid="community-shell-bottom-nav"
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] font-medium transition",
                  active
                    ? "bg-slate-900 text-orange-400"
                    : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-100"
                )}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("mb-0.5 h-5 w-5", active && "scale-105")} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
