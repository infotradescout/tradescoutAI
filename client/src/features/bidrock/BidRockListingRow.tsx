import { useEffect, useMemo, useState } from "react";
import { Bookmark, ChevronRight, Clock3, Gavel, GitCompareArrows, ImageOff } from "lucide-react";
import type { BidRockListing } from "@shared/bidrock";
import { formatBidRockMoney } from "@shared/bidrock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function formatBidRockDimensions(listing: BidRockListing): string {
  const { length, height, unit } = listing.dimensions;
  if (!length || !height) return "Dimensions pending";
  return `${length} × ${height} ${unit || "in"}`;
}

export function formatBidRockCountdown(remainingMilliseconds: number): string {
  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) return "Ended";
  const remainingSeconds = Math.ceil(remainingMilliseconds / 1_000);
  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function BidRockCountdown({
  endsAt,
  serverTime,
  className,
}: {
  endsAt: string;
  serverTime: string;
  className?: string;
}) {
  const offset = useMemo(() => {
    const server = Date.parse(serverTime);
    return Number.isFinite(server) ? server - Date.now() : 0;
  }, [serverTime]);
  const [remaining, setRemaining] = useState(() => Date.parse(endsAt) - (Date.now() + offset));

  useEffect(() => {
    const update = () => setRemaining(Date.parse(endsAt) - (Date.now() + offset));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [endsAt, offset]);

  return (
    <time dateTime={endsAt} className={className} aria-label={`Auction ends ${endsAt}`}>
      {formatBidRockCountdown(remaining)}
    </time>
  );
}

type Props = {
  listing: BidRockListing;
  selected: boolean;
  compared: boolean;
  saved: boolean;
  sellerMode?: boolean;
  onSelect: () => void;
  onCompare: () => void;
  onSave: () => void;
};

export function BidRockListingRow({
  listing,
  selected,
  compared,
  saved,
  sellerMode = false,
  onSelect,
  onCompare,
  onSave,
}: Props) {
  const auction = listing.auction;

  if (sellerMode) {
    return (
      <article
        className={cn(
          "grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-200 px-3 py-3 transition",
          selected
            ? "bg-white shadow-[inset_3px_0_0_var(--bidrock-auction)]"
            : "bg-stone-50 hover:bg-white"
        )}
        data-testid={`bidrock-listing-${listing.id}`}
      >
        <button type="button" onClick={onSelect} className="contents text-left">
          <span className="flex h-16 w-[76px] items-center justify-center overflow-hidden rounded-md bg-stone-200">
            {listing.imageUrl ? (
              <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-5 w-5 text-stone-500" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold text-stone-950">{listing.title}</span>
              <Badge
                variant="outline"
                className="border-stone-300 bg-transparent text-[10px] uppercase"
              >
                {auction?.status ||
                  (listing.status === "draft" ? "Awaiting publication" : listing.status)}
              </Badge>
            </span>
            <span className="mt-1 block truncate text-xs text-stone-600">
              {auction?.lotNumber ? `${auction.lotNumber} · ` : ""}
              {formatBidRockDimensions(listing)} · {listing.quantity} {listing.unit}
            </span>
          </span>
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onSelect}
          aria-label={`Manage ${listing.title}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </article>
    );
  }

  if (!auction) return null;

  const ended =
    auction.status === "sold" || auction.status === "no_sale" || auction.status === "ended";
  const statusLabel = auction.extended
    ? "Soft close extended"
    : auction.status === "no_sale"
      ? "No sale"
      : auction.status;

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg",
        selected
          ? "border-[var(--bidrock-auction-ring)] ring-2 ring-[var(--bidrock-auction-ring)]/20"
          : "border-stone-200"
      )}
      data-testid={`bidrock-listing-${listing.id}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--bidrock-auction-ring)]"
        aria-label={`Open ${auction.lotNumber}: ${listing.title}`}
      >
        <span className="relative block aspect-[5/4] overflow-hidden bg-stone-200">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={`${listing.title} auction lot`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="flex h-full items-center justify-center">
              <ImageOff className="h-8 w-8 text-stone-500" aria-hidden="true" />
            </span>
          )}
          <span className="absolute left-3 top-3 rounded bg-stone-950/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            {auction.lotNumber}
          </span>
          <span
            className={cn(
              "absolute right-3 top-3 rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
              ended ? "bg-stone-100 text-stone-700" : "bg-[var(--bidrock-auction-ring)] text-white"
            )}
          >
            {statusLabel}
          </span>
        </span>
        <span className="block p-4">
          <span className="block truncate text-lg font-bold tracking-tight text-stone-950">
            {listing.title}
          </span>
          <span className="mt-1 block truncate text-xs text-stone-600">
            {formatBidRockDimensions(listing)} · {listing.quantity} {listing.unit}
          </span>
          <span className="mt-1 block truncate text-[11px] uppercase tracking-[0.12em] text-stone-500">
            {listing.finishQuantities
              .map((item) => `${item.slabCount} ${item.finish}`)
              .join(" · ") ||
              listing.materialFamily ||
              "Finish pending"}
          </span>

          <span className="mt-4 grid grid-cols-2 border-t border-stone-200 pt-3">
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
                {auction.currentBid ? "Current bid" : "Bid values"}
              </span>
              <span className="mt-1 block text-base font-bold text-stone-950">
                {auction.currentBid ? formatBidRockMoney(auction.currentBid) : "Private"}
              </span>
            </span>
            <span className="border-l border-stone-200 pl-3">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
                <Clock3 className="h-3 w-3" aria-hidden="true" /> Ends in
              </span>
              <BidRockCountdown
                endsAt={auction.endsAt}
                serverTime={auction.serverTime}
                className="mt-1 block text-base font-bold tabular-nums text-stone-950"
              />
            </span>
          </span>
          <span className="mt-3 flex items-center justify-between text-xs text-stone-600">
            <span className="flex items-center gap-1.5">
              <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
              {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
            </span>
            <span>
              {auction.reserveState === "none"
                ? "No reserve"
                : auction.reserveState === "met"
                  ? "Reserve met"
                  : "Reserve not met"}
            </span>
          </span>
        </span>
      </button>
      <div className="grid grid-cols-2 border-t border-stone-200">
        <Button
          type="button"
          variant="ghost"
          className={cn("rounded-none border-r border-stone-200", compared && "bg-stone-100")}
          onClick={onCompare}
          aria-pressed={compared}
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
          {compared ? "Compared" : "Compare"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn("rounded-none", saved && "text-[var(--bidrock-auction)]")}
          onClick={onSave}
          aria-pressed={saved}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
          {saved ? "Saved" : "Save lot"}
        </Button>
      </div>
    </article>
  );
}
