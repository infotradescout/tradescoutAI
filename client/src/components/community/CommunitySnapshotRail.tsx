import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CommunityCTA } from "./CommunityCTA";
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

// NOTE: Authority labels intentionally disabled (Phase 2B).
// These signals imply validated judgment before outcomes exist.
// REASONING:
// - CTA gating (Phase 2A) is now the primary authority seam.
// - Labels should only render after we observe override + outcome data.
// - Premature labels pollute learning data and bias user expectations.
// ENABLE WHEN:
// - >= 100 gated CTAs have executed
// - >= 20 overrides recorded
// - Clear override/regret correlation visible in admin diagnostics
// See: COMMUNITY_AUTHORITY_INTEGRATION_COMPLETE.md
const ENABLE_AUTHORITY_LABELS = false;

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
  authorityLabel?: string; // Scout authority interpretive label
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
  const [cards, setCards] = useState<SnapshotCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          label: r.label ?? "Featured Local TradeDeal",
          imageUrl: r.imageUrl ?? r.image ?? null,
          href: r.href ?? (r.id ? `/trade-deals/${r.id}` : "/trade-deals"),
          ownerUserId: r.ownerUserId ?? r.providerUserId ?? null,
          canDirectConnect: Boolean(r.canDirectConnect ?? r.supportsDirectConnect ?? false),
          canMessage: Boolean((r.ownerUserId ?? r.providerUserId) && !r.disableMessaging),
          // Simple authority label based on engagement patterns
          authorityLabel: r.verified
            ? "Verified provider in your area"
            : r.isNew
              ? "New listing - gather context before contact"
              : undefined,
        }));

        // Compose cards: deals + stats + invitations (filters removed)
        const composedCards: SnapshotCard[] = [];

        // Add TradeDeal cards first
        composedCards.push(...dealCards);

        // If no deals, add fallback cards that reflect the real current state.
        if (dealCards.length === 0) {
          composedCards.push(
            {
              id: "deals-coming-soon-1",
              type: "starter_invitation",
              title: "No active TradeDeals yet",
              description: "This county has no active verified TradeDeals right now",
              label: "No Active Deals",
              icon: "sparkles",
              gradient: "from-orange-950 via-slate-900 to-slate-950",
              href: "/trade-deals",
            },
            {
              id: "deals-coming-soon-2",
              type: "starter_invitation",
              title: "Invite local suppliers",
              description: "Use Scout to nominate verified suppliers you want to see here",
              label: "Take Action",
              icon: "zap",
              gradient: "from-slate-900 via-slate-900 to-slate-950",
              href: "/trade-deals",
            }
          );
        }

        // If we have community stats and few/no deals, add a stats card
        if (communityStats && dealCards.length < 2) {
          const isNewCommunity = communityStats.totalMembers < 10;
          const recs7d = communityStats.recommendations7d ?? 0;
          const help7d = communityStats.helpRequests7d ?? 0;
          const activeToday = communityStats.activeToday ?? 0;
          composedCards.push({
            id: "local-stats",
            type: "local_stats",
            title: isNewCommunity
              ? "You're early in this community"
              : `${communityStats.totalMembers} neighbors here`,
            description: isNewCommunity
              ? "Be among the first to shape your local network"
              : `${activeToday} active today • ${recs7d} recs • ${help7d} help requests (7d)`,
            label: "Community Pulse",
            icon: "users",
            gradient: "from-indigo-950 via-slate-900 to-slate-950",
            stats: communityStats,
          });
        }

        // Add starter/invitation cards if empty or very sparse
        if (composedCards.length === 0 || (composedCards.length === 2 && dealCards.length === 0)) {
          // Only filter cards exist, or filter cards + deal placeholders
          composedCards.push(
            {
              id: "starter-conversation",
              type: "starter_invitation",
              title: "Start the first conversation",
              description: "Ask a question, share a project, or introduce yourself",
              label: "Be First",
              icon: "message",
              gradient: "from-emerald-950 via-slate-900 to-slate-950",
            },
            {
              id: "starter-community",
              type: "starter_invitation",
              title: "New county - early access",
              description: "You're among the first neighbors here. Help shape this community",
              label: "Pioneer",
              icon: "sparkles",
              gradient: "from-purple-950 via-slate-900 to-slate-950",
            }
          );
        } else if (
          composedCards.length > 0 &&
          dealCards.length === 0 &&
          composedCards.filter((c) => c.type === "local_stats").length === 1
        ) {
          // Only stats card exists (no deals), add one community invitation
          composedCards.push({
            id: "starter-first-post",
            type: "starter_invitation",
            title: "Share what's happening",
            description: "Post a project update, ask for recommendations, or start a discussion",
            label: "Get Started",
            icon: "message",
            gradient: "from-emerald-950 via-slate-900 to-slate-950",
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
  }, [apiUrl, communityStats]);

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
    const isInvitation = card.type === "starter_invitation";
    const isStats = card.type === "local_stats";
    const isTradeDeal = card.type === "trade_deal";
    const isFilter = card.type === "feed_filter";
    const isActive = isFilter && card.filterValue === activeFilter;

    return (
      <div
        key={card.id}
        role="button"
        tabIndex={0}
        onClick={() => onCardClick(card)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardClick(card);
          }
        }}
        className={`
          snap-start shrink-0 
          w-[104px] sm:w-[120px]
          h-[156px] sm:h-[168px]
          rounded-2xl border 
          ${isActive ? "border-ts-orange/30 ring-2 ring-ts-orange/70" : "border-white/10"}
          ${card.gradient ? `bg-gradient-to-br ${card.gradient}` : "bg-black/30"}
          hover:bg-tsCard/95 hover:border-white/10
          transition-all shadow-lg
          flex flex-col justify-between p-2 text-left 
          ${card.href || isFilter ? "cursor-pointer" : "cursor-default"}
          relative overflow-hidden
        `}
      >
        {/* Background decoration for visual interest */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

        {/* Card header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-tsCard/95 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white/70">
            {card.icon && <span className="text-ts-orange">{getCardIcon(card.icon)}</span>}
            <span className="truncate">{card.label ?? "Snapshot"}</span>
          </div>
        </div>

        {/* Card content */}
        <div className="relative z-10 flex-1 flex flex-col justify-end gap-1.5">
          <div className="text-[11px] sm:text-[12px] font-bold text-white leading-snug line-clamp-2">
            {card.title}
          </div>
          <div className="text-[9px] sm:text-[10px] text-white/70 leading-tight line-clamp-2">
            {card.description}
          </div>
        </div>

        {/* Minimal footer */}
        {isTradeDeal && card.canDirectConnect && (
          <div className="relative z-10 mt-2">
            <div className="text-[10px] text-ts-orange font-medium">Quick Connect</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={["w-full px-2 pt-2 pb-3", className || ""].join(" ")}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-base font-bold text-white">Community Snapshot</div>
        <button
          type="button"
          onClick={() => navigate("/trade-deals")}
          className="text-xs text-white/60 hover:text-white transition-colors"
        >
          View all deals
        </button>
      </div>

      <div className="relative">
        {loading && (
          <div className="text-sm text-white/60 py-8 text-center">Loading snapshot...</div>
        )}

        {!loading && error && <div className="text-sm text-red-400 py-8 text-center">{error}</div>}

        {!loading && !error && (
          <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.map((card) => renderCard(card))}
          </div>
        )}
      </div>

      <div className="mt-3 border-b border-white/10" />
    </div>
  );
};
