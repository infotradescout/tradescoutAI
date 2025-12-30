import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CommunityCTA } from "./CommunityCTA";

export type SnapshotDeal = {
  id: number | string;
  title: string;
  shortDescription: string;
  label?: string; // e.g. "Exclusive TradeDeal"
  imageUrl?: string | null;
  href?: string; // optional deep link
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
  limit?: number; // default 10 (UI can show fewer)
  className?: string;
  onItemsLoaded?: (count: number) => void;
}> = ({ countyFips, limit = 10, className, onItemsLoaded }) => {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<SnapshotDeal[]>([]);
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

        const normalized: SnapshotDeal[] = (rows || []).map((r) => ({
          id: r.id ?? r.promotionId ?? r.dealId ?? (crypto?.randomUUID?.() ?? Math.random().toString(36)),
          title: String(r.title ?? ""),
          shortDescription: String(r.shortDescription ?? r.description ?? ""),
          label: r.label ?? r.badge ?? "Community Snapshot",
          imageUrl: r.imageUrl ?? r.image ?? null,
          href: r.href ?? (r.id ? `/trade-deals/${r.id}` : "/trade-deals"),
          ownerUserId: r.ownerUserId ?? r.providerUserId ?? null,
          canDirectConnect: Boolean(r.canDirectConnect ?? r.supportsDirectConnect ?? false),
          canMessage: Boolean((r.ownerUserId ?? r.providerUserId) && !r.disableMessaging),
        }));

        setItems(normalized);
        if (onItemsLoaded) {
          onItemsLoaded(normalized.length);
        }
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
  }, [apiUrl]);

  const onCardClick = (it: SnapshotDeal) => {
    const href = it.href || "/trade-deals";
    navigate(href);
  };

  return (
    <div className={["w-full px-3 pt-3", className || ""].join(" ")}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Community Snapshot</div>
        <button
          type="button"
          onClick={() => navigate("/trade-deals")}
          className="text-xs text-neutral-300 hover:text-white"
        >
          View all
        </button>
      </div>

      <div className="mt-2">
        {loading && (
          <div className="text-sm text-neutral-400 py-2">Loading…</div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-400 py-2">{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-sm text-neutral-400 py-2">No Snapshot items yet.</div>
        )}

        {!loading && !error && items.length > 0 && (
          <div
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((it) => (
              <div
                key={String(it.id)}
                role="button"
                tabIndex={0}
                onClick={() => onCardClick(it)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCardClick(it);
                  }
                }}
                className="snap-start shrink-0 w-[220px] h-[140px] rounded-2xl border border-neutral-800 bg-neutral-950/50 hover:bg-neutral-900/40 transition-all shadow-sm flex flex-col justify-between p-3 text-left cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-neutral-300">{it.label ?? "Snapshot"}</div>
                  <div className="text-[11px] text-neutral-500">›</div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-white line-clamp-1">{it.title}</div>
                  <div className="text-xs text-neutral-300 line-clamp-2 mt-1">{it.shortDescription}</div>
                </div>
                <CommunityCTA
                  layout="inline"
                  source="trade_deal"
                  contextId={it.id}
                  ownerUserId={it.ownerUserId}
                  canDirectConnect={it.canDirectConnect}
                  canMessage={it.canMessage}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 border-b border-neutral-900" />
    </div>
  );
};
