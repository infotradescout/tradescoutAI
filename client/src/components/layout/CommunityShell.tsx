import React from "react";
import { useLocation, Link } from "wouter";
import { Users2, Landmark, Target, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { hasCountyContext, useLocationContext } from "@/hooks/useLocationContext";
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
  const locationCtx = useLocationContext();

  const locationLabel: string = React.useMemo(() => {
    return getUserLocationLabel(user as any);
  }, [user]);

  const countyLabel: string = React.useMemo(() => {
    if (hasCountyContext(locationCtx) && locationCtx.countyName && locationCtx.stateCode) {
      return `${locationCtx.countyName}, ${locationCtx.stateCode}`;
    }
    return locationLabel;
  }, [locationCtx, locationLabel]);

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
      href: "/direct-connect",
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
  const membersLabel =
    membersCount > 0 ? `${membersCount.toLocaleString()} members` : "Neighbors are joining";

  React.useEffect(() => {
    const locationSet = hasCountyContext(locationCtx);

    trackShellEvent({
      type: "community_shell_load",
      path: location,
      deviceType: getDeviceType(),
      hasUnreadNotifications: notificationsCount > 0,
      locationSet,
    });
  }, [location, locationCtx, notificationsCount]);

  const activeHighlight = rotatingItems[highlightIndex] ?? rotatingItems[0];
  const mobileNavItems: Array<{ href: string; label: string; testId: string }> = [
    { href: "/community", label: "Community", testId: "nav-community" },
    { href: "/groups", label: "Groups", testId: "nav-groups" },
    { href: "/hoa-management", label: "HOA", testId: "nav-hoa" },
    { href: "/messages", label: "Messages", testId: "nav-messages" },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="border-b border-white/10 bg-tsBg px-3 md:px-4 py-2 md:py-1 space-y-1 md:space-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              data-testid="community-shell-header-location"
              className="text-xs font-semibold uppercase tracking-wide text-white/70 truncate"
            >
              {countyLabel}
            </span>
            <span className="text-white/40">•</span>
            <span
              data-testid="community-shell-header-section"
              className="text-xs font-semibold uppercase tracking-wide text-white truncate"
            >
              {sectionLabel}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-3 text-[11px] text-white/60">
            <Link href="/community-feed" className="hover:text-ts-orange transition-colors">
              Community
            </Link>
            <span className="text-white/60">-</span>
            <Link href="/groups" className="hover:text-ts-orange transition-colors">
              Groups
            </Link>
            <span className="text-white/60">-</span>
            <Link href="/marketplace" className="hover:text-ts-orange transition-colors">
              Marketplace
            </Link>
            <span className="text-white/60">-</span>
            <Link href="/direct-connect" className="hover:text-ts-orange transition-colors">
              Direct Connect
            </Link>
          </nav>
        </div>

        {showSnapshot && (
          <div className="mt-0.5 text-[11px] text-white/60">
            <div className="hidden md:flex items-center gap-3 min-w-0 rounded-full bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-3 py-1 border border-white/10">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <Users2 className="h-3.5 w-3.5 text-white" />
                <span className="truncate text-white">{membersLabel}</span>
              </div>
              <span className="text-white/60">-</span>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <Landmark className="h-3.5 w-3.5 text-ts-orange" />
                <span className="truncate text-white">County snapshot</span>
              </div>
              {activeHighlight && (
                <>
                  <span className="text-white/60">-</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {activeHighlight.icon}
                    <span className="truncate text-white/70">{activeHighlight.label}</span>
                  </div>
                </>
              )}
            </div>

            <div className="md:hidden mt-1 rounded-xl border border-white/10 bg-tsCard/95 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
              <div className="flex items-center gap-2 min-w-0">
                <Users2 className="h-3.5 w-3.5 text-white shrink-0" />
                <span className="truncate text-white">{membersLabel}</span>
                <span className="text-white/60 shrink-0">-</span>
                <Landmark className="h-3.5 w-3.5 text-ts-orange shrink-0" />
                <span className="truncate text-white/70">County snapshot</span>
              </div>
              {activeHighlight && (
                <div className="mt-1 flex items-center gap-1.5 min-w-0">
                  {activeHighlight.icon}
                  <span className="truncate text-white/70">{activeHighlight.label}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-full overflow-x-hidden bg-tsBg">{children}</div>

      <div
        data-testid="community-shell-bottom-nav"
        className="md:hidden sticky bottom-0 z-20 border-t border-white/10 bg-tsCard/95 backdrop-blur"
      >
        <div className="grid grid-cols-4 px-1 pb-[calc(env(safe-area-inset-bottom)*0.35)] pt-1">
          {mobileNavItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/community" && location.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-colors ${
                  isActive ? "text-ts-orange" : "text-white/70"
                }`}
                style={
                  isActive
                    ? {
                        background:
                          "color-mix(in oklab, var(--theme-accent-primary) 10%, transparent)",
                        border:
                          "1px solid color-mix(in oklab, var(--theme-accent-primary) 30%, transparent)",
                      }
                    : undefined
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
