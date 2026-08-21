import { Bookmark, ChevronRight, GitCompareArrows, ImageOff } from "lucide-react";
import type { BidRockListing } from "@shared/bidrock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function formatBidRockDimensions(listing: BidRockListing): string {
  const { length, height, unit } = listing.dimensions;
  if (!length || !height) return "Dimensions pending";
  return `${length} × ${height} ${unit || "in"}`;
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
  return (
    <article
      className={cn(
        "grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-200 px-3 py-3 transition",
        selected
          ? "bg-white shadow-[inset_3px_0_0_var(--bidrock-accent)]"
          : "bg-[var(--bidrock-workspace)] hover:bg-white"
      )}
      data-testid={`bidrock-listing-${listing.id}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="contents text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bidrock-accent)]"
        aria-label={`Open ${listing.title} details`}
      >
        <span className="flex h-16 w-[76px] items-center justify-center overflow-hidden rounded-md bg-stone-200">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageOff className="h-5 w-5 text-stone-500" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-bold text-[var(--bidrock-ink)]">
              {listing.title}
            </span>
            {sellerMode ? (
              <Badge
                variant="outline"
                className={cn(
                  "border-stone-300 bg-transparent px-2 py-0 text-[10px] uppercase tracking-wide text-stone-600",
                  listing.saleReady && "border-emerald-300 text-emerald-700"
                )}
              >
                {listing.status === "draft" ? "Awaiting publication" : listing.status}
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block truncate text-xs text-stone-600">
            {formatBidRockDimensions(listing)} · {listing.quantity} {listing.unit}
          </span>
          <span className="mt-1 block truncate text-[11px] uppercase tracking-[0.12em] text-stone-500">
            {listing.materialFamily || "Classification pending"} · {listing.sourceProfileName}
          </span>
        </span>
      </button>
      <span className="flex items-center gap-1">
        {sellerMode ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-950"
            onClick={onSelect}
            aria-label={`Manage ${listing.title}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                "h-9 w-9 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-950",
                compared && "bg-stone-900 text-white hover:bg-stone-800 hover:text-white"
              )}
              onClick={onCompare}
              aria-label={
                compared ? `Remove ${listing.title} from comparison` : `Compare ${listing.title}`
              }
              aria-pressed={compared}
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                "h-9 w-9 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-950",
                saved && "text-[var(--bidrock-accent)]"
              )}
              onClick={onSave}
              aria-label={
                saved ? `Remove ${listing.title} from saved selections` : `Save ${listing.title}`
              }
              aria-pressed={saved}
            >
              <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
            </Button>
          </>
        )}
      </span>
    </article>
  );
}
