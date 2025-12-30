import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CommunityCTA } from "./CommunityCTA";
import { Tag, Users2, MessageSquare, Sparkles, TrendingUp, Zap, Star, MapPin, Clock, Eye, Vault } from "lucide-react";

// Card types that can appear in the snapshot
export type SnapshotCardType = "trade_deal" | "community_post" | "local_stats" | "starter_invitation" | "feed_filter";

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
  };
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}> = ({ countyFips, limit = 10, className, communityStats, activeFilter = "forYou", onFilterChange }) => {
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
          id: String(r.id ?? r.promotionId ?? r.dealId ?? crypto?.randomUUID?.() ?? Math.random().toString(36)),
          type: "trade_deal" as const,
          title: String(r.title ?? ""),
          description: String(r.shortDescription ?? r.description ?? ""),
          label: r.label ?? "Featured Local TradeDeal",
          imageUrl: r.imageUrl ?? r.image ?? null,
          href: r.href ?? (r.id ? `/trade-deals/${r.id}` : "/trade-deals"),
          ownerUserId: r.ownerUserId ?? r.providerUserId ?? null,
          canDirectConnect: Boolean(r.canDirectConnect ?? r.supportsDirectConnect ?? false),
          canMessage: Boolean((r.ownerUserId ?? r.providerUserId) && !r.disableMessaging),
        }));feed filters + deals + stats + invitations
        const composedCards: SnapshotCard[] = [];

        // Always add feed filter cards first
        composedCards.push(
          {
            id: "filter-for-you",
            type: "feed_filter",
            title: "For You",
            description: "Personalized content based on your interests",
            label: "Recommended",
            icon: "star",
            gradient: activeFilter === "forYou" ? "from-orange-500 to-orange-600" : "from-slate-800 to-slate-900",
            filterValue: "forYou",
          },
          {
            id: "filter-recent",
            type: "feed_filter",
            title: "Recent",
            description: "Latest posts from your community",
            label: "Latest",
            icon: "clock",
            gradient: activeFilter === "recent" ? "from-orange-500 to-orange-600" : "from-slate-800 to-slate-900",
            filterValue: "recent",
          },
          {
            id: "filter-nearby",
            type: "feed_filter",
            title: "Nearby",
            description: "Posts from neighbors close to you",
            label: "Local",
            icon: "mappin",
            gradient: activeFilter === "nearby" ? "from-orange-500 to-orange-600" : "from-slate-800 to-slate-900",
            filterValue: "nearby",
          },
          {
            id: "filter-trending",
            type: "feed_filter",
            title: "Trending",
            description: "Most popular conversations right now",
            label: "Hot",
            icon: "trending",
            gradient: activeFilter === "trending" ? "from-orange-500 to-orange-600" : "from-slate-800 to-slate-900",
            filterValue: "trending",
          },
          {
            id: "filter-recs",
            type: "feed_filter",
            title: "Recs",
            description: "Recommendations and endorsements",
            label: "Trusted",
            icon: "eye",
            gradient: activeFilter === "recs" ? "from-orange-500 to-orange-600" : "from-slate-800 to-slate-900",
            filterValue: "recs",
          },
          {
            id: "filter-vault",
            type: "feed_filter",
            title: "Vault",
            description: "Saved and bookmarked content",
            label: "Saved",
            icon: "vault",
            gradient: activeFilter === "vault" ? "from-orange-500 to-orange-600" : "from-slate-800 to-slate-900",
            filterValue: "vault",
          }
        );

        // Add TradeDeal cardstCard[] = [];

        // Add TradeDeal cards first
        composedCards.push(...dealCards);

        // If no deals, add placeholder cards indicating deals are coming soon
        if (dealCards.length === 0) {
          composedCards.push(
            {
              id: "deals-coming-soon-1",
              type: "starter_invitation",
              title: "TradeDeals Coming Soon",
              description: "Exclusive offers from verified partners will appear here",
              label: "Coming Soon",
              icon: "sparkles",
              gradient: "from-orange-950 via-slate-900 to-slate-950",
              href: "/trade-deals",
            },
            {
              id: "deals-coming-soon-2",
              type: "starter_invitation",
              title: "Partner Network Growing",
              description: "We're building relationships with local suppliers and manufacturers",
              label: "In Progress",
              icon: "zap",
              gradient: "from-slate-900 via-slate-900 to-slate-950",
              href: "/trade-deals",
            }
          );
        }

        // If we have community stats and few/no deals, add a stats card
        if (communityStats && dealCards.length < 2) {
          const isNewCommunity = communityStats.totalMembers < 10;
          composedCards.push({
            id: "local-stats",
            type: "local_stats",
            title: isNewCommunity ? "You're early in this community" : `${communityStats.totalMembers} neighbors here`,
            description: isNewCommunity 
              ? "Be among the first to shape your local network"
              : `${communityStats.activeToday} active today • ${communityStats.postsToday} posts`,
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
              title: "New county — early access",
              description: "You're among the first neighbors here. Help shape this community",
              label: "Pioneer",
              icon: "sparkles",
              gradient: "from-purple-950 via-slate-900 to-slate-950",
            }
          );
        } else if (composedCards.length > 0 && dealCards.length === 0 && composedCards.filter(c => c.type === 'local_stats').length === 1) {
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
            href: "/trade-deals",
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
      case "users": return <Users2 className="h-5 w-5" />;
      case "zap": return <Zap className="h-5 w-5" />;
      case "message": return <MessageSquare className="h-5 w-5" />;
      case "sparkles": return <Sparkles className="h-5 w-5" />;
      case "trending": return <TrendingUp className="h-5 w-5" />;
      case "star": return <Star className="h-5 w-5" />;
      case "clock": return <Clock className="h-5 w-5" />;
      case "mappin": return <MapPin className="h-5 w-5" />;
      case "eye": return <Eye className="h-5 w-5" />;
      case "vault": return <Vault className="h-5 w-5" />;
      default: return <Tag className="h-5 w-5" />;
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
          w-[260px] sm:w-[280px] md:w-[300px]
          h-[280px] sm:h-[300px]
          rounded-2xl border 
          ${isActive ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-800'}
          ${card.gradient ? `bg-gradient-to-br ${card.gradient}` : 'bg-slate-950/50'}
          hover:bg-slate-900/40 hover:border-slate-700
          transition-all shadow-lg
          flex flex-col justify-between p-5 text-left 
          ${card.href || isFilter ? 'cursor-pointer' : 'cursor-default'}
          relative overflow-hidden
        `}
      >
        {/* Background decoration for visual interest */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        
        {/* Card header */}
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-200">
              {card.icon && (
                <span className="text-orange-400">
                  {getCardIcon(card.icon)}
                </span>
              )}
              <span>{card.label ?? "Snapshot"}</span>
            </div>
            {card.href && (
              <div className="text-sm text-slate-500">›</div>
            )}
          </div>
        </div>

        {/* Card content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center gap-2">
          <div className="text-xl font-bold text-white leading-tight">
            {card.title}
          </div>
          <div className="text-sm text-slate-300 leading-relaxed line-clamp-3">
            {card.description}
          </div>
        </div>

        {/* Card footer - CTAs or stats */}
        <div className="relative z-10 mt-4">
          {isTradeDeal && (
            <CommunityCTA
              layout="inline"
              source="trade_deal"
              contextId={card.id}
              ownerUserId={card.ownerUserId}
              canDirectConnect={card.canDirectConnect}
              canMessage={card.canMessage}
            />
          )}
          
          {isStats && card.stats && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Users2 className="h-3.5 w-3.5 text-emerald-300" />
                <span>{card.stats.totalMembers || 0} neighbors</span>
              </div>
              {card.stats.activeToday > 0 && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-300" />
                  <span>{card.stats.activeToday} active</span>
                </div>
              )}
            </div>
          )}

          {isInvitation && (
            <div className="text-xs text-slate-500 italic">
              Tap to explore
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={["w-full px-3 pt-3 pb-4", className || ""].join(" ")}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-bold text-white">Community Snapshot</div>
        <button
          type="button"
          onClick={() => navigate("/trade-deals")}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          View all deals
        </button>
      </div>

      <div className="relative">
        {loading && (
          <div className="text-sm text-slate-400 py-8 text-center">Loading snapshot…</div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-400 py-8 text-center">{error}</div>
        )}

        {!loading && !error && (
          <div
            className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {cards.map((card) => renderCard(card))}
          </div>
        )}
      </div>

      <div className="mt-4 border-b border-slate-900" />
    </div>
  );
};
