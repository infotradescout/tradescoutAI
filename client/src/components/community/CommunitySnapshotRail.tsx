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
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  icon?: string;
  gradient?: string;
  imageUrl?: string | null;
  href?: string;
  ownerUserId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
  filterValue?: string;
  authorityLabel?: string;
  stats?: {
    membersCount?: number;
    activeToday?: number;
    postsToday?: number;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("county", countyFips);
    sp.set("limit", String(limit));
    sp.set("featured", "true");
    return `/api/daily-deals?${sp.toString()}`;
  }, [countyFips, limit]);

  useEffect(() => {
    setLoading(true);
    fetchJson<any[]>(apiUrl)
      .then((rows) => {
        const dealCards: SnapshotCard[] = (rows || []).map((r) => ({
          id: String(r.id || Math.random()),
          type: "trade_deal",
          title: r.title || "",
          description: r.shortDescription || r.description || "",
          label: r.label || "Featured Deal",
          imageUrl: r.imageUrl || null,
          href: r.href || `/trade-deals/${r.id}`,
          gradient: "from-orange-500/20 to-transparent",
        }));

        const composedCards: SnapshotCard[] = [...dealCards];

        if (composedCards.length === 0) {
          composedCards.push({
            id: "starter-1",
            type: "starter_invitation",
            title: "Start a Conversation",
            description: "Be the first to post in your community.",
            label: "Get Started",
            icon: "message",
            gradient: "from-blue-500/20 to-transparent",
          });
        }

        setCards(composedCards);
      })
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const getCardIcon = (iconName?: string) => {
    switch (iconName) {
      case "users":
        return <Users2 className="w-4 h-4" />;
      case "message":
        return <MessageSquare className="w-4 h-4" />;
      case "sparkles":
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">
          Local Highlights
        </h3>
        <button className="text-xs font-bold text-ts-orange flex items-center gap-1 hover:underline">
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1 snap-x">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-40 h-56 bg-white/5 rounded-2xl animate-pulse shrink-0 border border-white/5"
              />
            ))
          : cards.map((card) => (
              <div
                key={card.id}
                onClick={() => card.href && navigate(card.href)}
                className={cn(
                  "snap-start shrink-0 w-40 h-56 rounded-2xl border border-white/5 bg-[#141414] p-4 flex flex-col justify-between transition-all hover:border-white/20 cursor-pointer group relative overflow-hidden",
                  card.gradient && `bg-gradient-to-br ${card.gradient}`
                )}
              >
                <div className="space-y-2 relative z-10">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 group-hover:text-ts-orange transition-colors">
                    {getCardIcon(card.icon)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ts-orange/80">
                      {card.label}
                    </p>
                    <h4 className="text-sm font-bold text-white leading-tight line-clamp-2">
                      {card.title}
                    </h4>
                  </div>
                </div>

                <p className="text-[11px] text-white/40 line-clamp-3 relative z-10">
                  {card.description}
                </p>

                {/* Decorative background element */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-ts-orange/5 rounded-full blur-2xl group-hover:bg-ts-orange/10 transition-all" />
              </div>
            ))}
      </div>
    </div>
  );
};
