import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useCommunityAuthoritySurfaces } from "@/hooks/useCommunityAuthoritySurfaces";
import {
  Tag,
  Users2,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Zap,
  Star,
  MapPin,
  Clock,
  Eye,
  Vault,
  Info,
} from "lucide-react";

// Card types that can appear in the snapshot
export type SnapshotCardType =
  | "trade_deal"
  | "community_post"
  | "local_stats"
  | "starter_invitation"
  | "feed_filter";

export type SnapshotCard = {
  id: string;
  type: SnapshotCardType;
  title: string;
  description: string;
  label?: string;
  icon?: string; // Icon identifier
  gradient?: string; // Tailwind gradient classes
  imageUrl?: string | null;
  href?: string;
  ownerUserId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
  filterValue?: string; // For feed filter cards
  trustNote?: string;
  stats?: {
    membersCount?: number;
    activeToday?: number;
    postsToday?: number;
  };
};

export type SnapshotDeal = {
  id: number | string;
  title: string;
  shortDescription: string;
  label?: string;
  imageUrl?: string | null;
  href?: string;
  ownerUserId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const CommunitySnapshotRail: React.FC<{
  countyFips: string;
  limit?: number;
  className?: string;
  communityStats?: {
    totalMembers: number;
    activeToday: number;
    postsToday: number;
    helpRequests7d?: number;
    recommendations7d?: number;
    verifiedPros?: number;
  };
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}> = ({
  countyFips,
  limit = 10,
  className,
  communityStats,
  activeFilter = "forYou",
  onFilterChange,
}) => {
  const [, navigate] = useLocation();
  const { data: authoritySurfaces } = useCommunityAuthoritySurfaces();
  const showTrustNotes = authoritySurfaces?.phase2bAuthorityLabelsEnabled === true;
  const [cards, setCards] = useState<SnapshotCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("county", countyFips);
    sp.set("limit", String(clamp(limit, 1, 30)));
    sp.set("featured", "true");
    return `/api/daily-deals?${sp.toString()}`;
  }, [countyFips, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchJson<any[]>(apiUrl)
      .then((rows) => {
        if (cancelled) return;

        const dealCards: SnapshotCard[] = (rows || []).map((r) => ({
          id: String(
            r.id ??
              r.promotionId ??
              r.dealId ??
              crypto?.randomUUID?.() ??
              Math.random().toString(36)
          ),
          type: "trade_deal" as const,
          title: String(r.title ?? ""),
          description: String(r.shortDescription ?? r.description ?? ""),
          label: "Local offer",
          imageUrl: r.imageUrl ?? r.image ?? null,
          href: r.href ?? (r.id ? `/trade-deals/${r.id}` : "/trade-deals"),
          ownerUserId: r.ownerUserId ?? r.providerUserId ?? null,
          canDirectConnect: Boolean(r.canDirectConnect ?? r.supportsDirectConnect ?? false),
          canMessage: Boolean((r.ownerUserId ?? r.providerUserId) && !r.disableMessaging),
          trustNote: r.verified
            ? "Business identity verified"
            : r.isNew
              ? "Newly listed"
              : undefined,
        }));

        // Compose cards: deals + stats + invitations (filters removed)
        const composedCards: SnapshotCard[] = [];

        // Add TradeDeal cards first
        composedCards.push(...dealCards);

        // Keep unfinished areas visible without making the product look broken.
        if (dealCards.length === 0) {
          composedCards.push(
            {
              id: "deals-coming-soon-1",
              type: "starter_invitation",
              title: "Local offers are coming soon",
              description: "Nearby businesses will be able to share useful offers here.",
              label: "Coming soon",
              icon: "sparkles",
              gradient: "from-orange-950 via-slate-900 to-slate-950",
            },
            {
              id: "deals-coming-soon-2",
              type: "starter_invitation",
              title: "Find a local business",
              description: "Browse businesses that serve your area right now.",
              label: "Available now",
              icon: "zap",
              gradient: "from-slate-900 via-slate-900 to-slate-950",
              href: "/commercial-directory",
            }
          );
        }

        const hasRecentCommunityActivity = Boolean(
          communityStats &&
          (communityStats.activeToday > 0 ||
            communityStats.postsToday > 0 ||
            (communityStats.recommendations7d ?? 0) > 0 ||
            (communityStats.helpRequests7d ?? 0) > 0)
        );

        if (communityStats && dealCards.length < 2 && hasRecentCommunityActivity) {
          const recs7d = communityStats.recommendations7d ?? 0;
          const help7d = communityStats.helpRequests7d ?? 0;
          const activeToday = communityStats.activeToday ?? 0;
          composedCards.push({
            id: "local-stats",
            type: "local_stats",
            title: "People are checking in nearby",
            description: `${activeToday} active today • ${recs7d} recommendations • ${help7d} requests this week`,
            label: "This week",
            icon: "users",
            gradient: "from-indigo-950 via-slate-900 to-slate-950",
            stats: communityStats,
          });
        }

        if (!hasRecentCommunityActivity) {
          composedCards.push({
            id: "starter-first-post",
            type: "starter_invitation",
            title: "You're here early",
            description: "Ask the first question or share something useful with your neighbors.",
            label: "Start the conversation",
            icon: "message",
            gradient: "from-emerald-950 via-slate-900 to-slate-950",
            href: "/community-feed?compose=1",
          });
        }

        setCards(composedCards);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load Snapshot");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, communityStats, refreshKey]);

  const onCardClick = (card: SnapshotCard) => {
    if (card.type === "feed_filter" && onFilterChange && card.filterValue) {
      onFilterChange(card.filterValue);
    } else if (card.href) {
      navigate(card.href);
    }
  };

  const getCardIcon = (iconName?: string) => {
    switch (iconName) {
      case "users":
        return <Users2 className="h-3.5 w-3.5" />;
      case "zap":
        return <Zap className="h-3.5 w-3.5" />;
      case "message":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "sparkles":
        return <Sparkles className="h-3.5 w-3.5" />;
      case "trending":
        return <TrendingUp className="h-3.5 w-3.5" />;
      case "star":
        return <Star className="h-3.5 w-3.5" />;
      case "clock":
        return <Clock className="h-3.5 w-3.5" />;
      case "mappin":
        return <MapPin className="h-3.5 w-3.5" />;
      case "eye":
        return <Eye className="h-3.5 w-3.5" />;
      case "vault":
        return <Vault className="h-3.5 w-3.5" />;
      default:
        return <Tag className="h-3.5 w-3.5" />;
    }
  };

  const renderCard = (card: SnapshotCard) => {
    const isTradeDeal = card.type === "trade_deal";
    const isFilter = card.type === "feed_filter";
    const isActive = isFilter && card.filterValue === activeFilter;
    const isInteractive = Boolean(card.href || isFilter);

    return (
      <div
        key={card.id}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={() => onCardClick(card)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardClick(card);
          }
        }}
        className={`
          snap-start shrink-0
          w-[220px] sm:w-[240px] lg:w-full
          min-h-[132px] lg:min-h-[112px]
          rounded-2xl border
          ${isActive ? "border-ts-orange/30 ring-2 ring-ts-orange/70" : "border-white/10"}
          ${card.gradient ? `bg-gradient-to-br ${card.gradient}` : "bg-black/30"}
          hover:bg-tsCard/95 hover:border-white/10
          transition-all shadow-lg
          flex flex-col justify-between p-3 text-left
          ${isInteractive ? "cursor-pointer" : "cursor-default"}
          relative overflow-hidden
        `}
      >
        {/* Background decoration for visual interest */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

        {/* Card header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-tsCard/95 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white/70">
            {card.icon && <span className="text-ts-orange">{getCardIcon(card.icon)}</span>}
            <span className="truncate">{card.label ?? "Nearby"}</span>
          </div>
        </div>

        {/* Card content */}
        <div className="relative z-10 flex-1 flex flex-col justify-end gap-1.5">
          <div className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {card.title}
          </div>
          <div className="text-xs text-white/70 leading-snug line-clamp-3">{card.description}</div>
        </div>

        {/* Minimal footer */}
        {isTradeDeal && card.canDirectConnect && (
          <div className="relative z-10 mt-2">
            <div className="text-[11px] text-ts-orange font-medium">Ask about this offer</div>
          </div>
        )}
        {showTrustNotes && card.trustNote && (
          <div className="relative z-10 mt-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-[9px] text-white/70 leading-tight line-clamp-2">
            <span className="inline-flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0 text-white/60" />
              <span>{card.trustNote}</span>
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={["w-full px-2 pt-2 pb-3", className || ""].join(" ")}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-base font-bold text-white">Around you</div>
        <button
          type="button"
          onClick={() => navigate("/trade-deals")}
          className="text-xs text-white/60 hover:text-white transition-colors"
        >
          See local offers
        </button>
      </div>

      <div className="relative">
        {loading && <div className="text-sm text-white/60 py-8 text-center">Looking nearby...</div>}

        {!loading && error && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-sm font-medium text-white">That didn&apos;t load</p>
            <p className="mt-1 text-xs text-white/60">Let&apos;s check nearby offers again.</p>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="mt-3 text-xs font-semibold text-ts-orange hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory lg:flex-col lg:overflow-visible lg:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.map((card) => renderCard(card))}
          </div>
        )}
      </div>

      <div className="mt-3 border-b border-white/10" />
    </div>
  );
};
