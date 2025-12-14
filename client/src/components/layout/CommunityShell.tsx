import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { trackShellEvent, getDeviceType } from "@/lib/analytics";
import { Home, Users, MessageCircle, ShoppingBag } from "lucide-react";
import { getUserLocationLabel } from "@/lib/copyHelpers";

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

  const locationLabel: string = React.useMemo(() => {
    if (!user) return "Set your location";
    return getUserLocationLabel(user as any);
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

  // ARCHITECTURAL RULE: Only AppShell renders navigation
  // CommunityShell is CONTENT-ONLY wrapper with section label
  return (
    <div className="flex min-h-screen flex-col">
      {/* Section label only - no duplicate header/nav */}
      <div className="border-b border-slate-800 bg-slate-950/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-semibold text-slate-300"
            data-testid="community-shell-section-label"
          >
            {sectionLabel}
          </span>
          {locationLabel && (
            <span className="text-xs text-slate-500">{locationLabel}</span>
          )}
        </div>
      </div>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-24">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </main>
    </div>
  );
};
