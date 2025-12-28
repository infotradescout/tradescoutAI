import React from "react";
import { useLocation, Link } from "wouter";
import { Users2, Landmark, Target, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trackShellEvent, getDeviceType } from "@/lib/analytics";
import { getUserLocationLabel } from "@/lib/copyHelpers";

export type CommunitySnapshotProps = {
  membersCount?: number;
  activeToday?: number;
  postsToday?: number;
  countiesActive?: number;
  trendingTags?: string[];
};

export type CommunityShellProps = {
  sectionLabel: string;
  notificationsCount?: number;
  snapshot?: CommunitySnapshotProps;
  showSnapshot?: boolean;
  children: React.ReactNode;
};

export const CommunityShell: React.FC<CommunityShellProps> = ({
  sectionLabel,
  notificationsCount = 0,
  snapshot,
  showSnapshot = false,
  children,
}) => {
  const [location] = useLocation();
  const { user } = useAuth() as any;

  const locationLabel: string = React.useMemo(() => {
    return getUserLocationLabel(user as any);
  }, [user]);

  const countyLabel: string = React.useMemo(() => {
    const u: any = user;
    if (u?.countyName && u?.stateCode) {
      return `${u.countyName}, ${u.stateCode}`;
    }
    return locationLabel;
  }, [user, locationLabel]);

  const [highlightIndex, setHighlightIndex] = React.useState(0);

  const rotatingItems = React.useMemo(() => {
    const items: { key: string; label: string; href?: string; icon: React.ReactNode }[] = [];

    if (snapshot?.trendingTags && snapshot.trendingTags.length > 0) {
      items.push({
        key: `trending-${snapshot.trendingTags[0]}`,
        label: `Trending: #${snapshot.trendingTags[0]}`,
        href: "/community-feed?tab=trending",
        icon: <Users2 className="h-3.5 w-3.5" />,
      });
    }

    items.push({
      key: "work-request",
      label: "Open Direct Connect",
      href: "/tasks",
      icon: <Target className="h-3.5 w-3.5" />,
    });

    items.push({
      key: "stay-connected",
      label: "Stay connected locally",
      href: "/community-feed?orientation=1",
      icon: <MessageCircle className="h-3.5 w-3.5" />,
    });

    return items;
  }, [snapshot]);

  React.useEffect(() => {
    if (rotatingItems.length <= 1) return;
    const id = window.setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % rotatingItems.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [rotatingItems]);

  const membersCount = snapshot?.membersCount ?? 0;
  const membersLabel = membersCount > 0
    ? `${membersCount.toLocaleString()} members`
    : "Neighbors are joining";

  // Track shell usage for analytics only
  React.useEffect(() => {
    const u: any = user;
    const locationSet = !!(
      u &&
      (u.locationCommitted || (u.stateCode && u.countyFips))
    );

    trackShellEvent({
      type: "community_shell_load",
      path: location,
      deviceType: getDeviceType(),
      hasUnreadNotifications: notificationsCount > 0,
      locationSet,
    });
  }, [location, notificationsCount, user]);

  // CommunityShell owns the CommunityOS header (identity row + snapshot row)
  // but leaves global site navigation to AppShell.
  
  const activeHighlight = rotatingItems[highlightIndex] ?? rotatingItems[0];

  return (
    <div className="flex flex-col w-full">
      {/* CommunityOS header: identity row + snapshot row */}
      <div className="border-b border-slate-800 bg-slate-950 px-3 md:px-4 py-1.5 space-y-0.5">
        {/* Tier 1 – Identity & section nav */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-300 truncate">
              {countyLabel}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-3 text-[11px] text-slate-400">
            <Link href="/community-feed" className="hover:text-orange-400 transition-colors">
              Community
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/groups" className="hover:text-orange-400 transition-colors">
              Groups
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/marketplace" className="hover:text-orange-400 transition-colors">
              Marketplace
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/tasks" className="hover:text-orange-400 transition-colors">
              Direct Connect
            </Link>
          </nav>
        </div>

        {/* Tier 2 – Snapshot row (informational, not buttons) */}
        {showSnapshot && (
        <div className="mt-0.5 text-[11px] text-slate-400">
          {/* Desktop/large: colorful inline snapshot band */}
          <div className="hidden md:flex items-center gap-3 min-w-0 rounded-full bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-3 py-1 border border-slate-800">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Users2 className="h-3.5 w-3.5 text-slate-100" />
              <span className="truncate text-slate-100">{membersLabel}</span>
            </div>
            <span className="text-slate-500">·</span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Landmark className="h-3.5 w-3.5 text-orange-300" />
              <span className="truncate text-slate-100">County Vault snapshot</span>
            </div>
            {activeHighlight && (
              <>
                <span className="text-slate-500">·</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  {activeHighlight.icon}
                  <span className="truncate text-slate-200">{activeHighlight.label}</span>
                </div>
              </>
            )}
          </div>

          {/* Mobile: compact stacked snapshot card */}
          <div className="md:hidden mt-0.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-3 py-2 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Users2 className="h-3.5 w-3.5 text-slate-100" />
                <span className="truncate text-slate-100">{membersLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Landmark className="h-3.5 w-3.5 text-orange-300" />
              <span className="truncate text-slate-200">County Vault snapshot for your area</span>
            </div>
            {activeHighlight && (
              <div className="flex items-center gap-1.5 min-w-0">
                {activeHighlight.icon}
                <span className="truncate text-slate-200">{activeHighlight.label}</span>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Content area - keep community views within viewport on mobile */}
      <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
        {children}
      </div>
    </div>
  );
};
