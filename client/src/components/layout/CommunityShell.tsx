import React from "react";
import { useLocation, Link } from "wouter";
import { Users2, Landmark, Target, MessageCircle, Bell, Search, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { hasCountyContext, useLocationContext } from "@/hooks/useLocationContext";
import { trackShellEvent, getDeviceType } from "@/lib/analytics";
import { getUserLocationLabel } from "@/lib/copyHelpers";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0A0A0A] text-white">
      {/* Main Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Left: Logo & Location */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-ts-orange rounded-lg flex items-center justify-center font-bold text-black">
                TS
              </div>
              <span className="hidden md:block font-bold text-lg tracking-tight">TradeScout</span>
            </Link>

            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <Landmark className="w-3.5 h-3.5 text-ts-orange" />
              <span className="text-xs font-medium text-white/80">{countyLabel}</span>
            </div>
          </div>

          {/* Center: Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Community", href: "/community-feed" },
              { label: "Groups", href: "/groups" },
              { label: "Marketplace", href: "/marketplace" },
              { label: "Direct Connect", href: "/direct-connect" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location === item.href
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="relative text-white/60 hover:text-white">
              <Bell className="w-5 h-5" />
              {notificationsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-ts-orange rounded-full" />
              )}
            </Button>
            <div className="h-8 w-[1px] bg-white/10 mx-1 hidden md:block" />
            <Avatar className="h-8 w-8 border border-white/10">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-ts-orange text-black text-xs font-bold">
                {user?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="md:hidden text-white/60">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Sub-header: Snapshot & Context */}
      {showSnapshot && (
        <div className="w-full bg-[#0F0F0F] border-b border-white/5 py-2">
          <div className="container mx-auto px-4 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-4 whitespace-nowrap">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Users2 className="w-3.5 h-3.5" />
                <span>{membersLabel}</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              {activeHighlight && (
                <Link
                  href={activeHighlight.href || "#"}
                  className="flex items-center gap-2 text-xs text-ts-orange hover:underline transition-all"
                >
                  {activeHighlight.icon}
                  <span>{activeHighlight.label}</span>
                </Link>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Current Section
              </span>
              <span className="text-xs font-semibold text-ts-orange px-2 py-0.5 bg-ts-orange/10 rounded border border-ts-orange/20">
                {sectionLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>
    </div>
  );
};
