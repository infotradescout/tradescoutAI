import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trackShellEvent, getDeviceType } from "@/lib/analytics";
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
  const [location] = useLocation();
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

  // Track shell usage for analytics only
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
  // CommunityShell is CONTENT-ONLY context wrapper - NO nav, NO layout
  // This component exists for:
  // 1. Providing section context (label, location, analytics)
  // 2. Consistent padding/spacing for section content
  // 3. Passing unread count for analytics
  
  return (
    <div className="flex flex-col w-full">
      {/* Minimal section header - visual context only, NO navigation */}
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

      {/* Content area - keep community views within viewport on mobile */}
      <div className="w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};
