import { useEffect, useId, useRef, useState } from "react";
import {
  Bookmark,
  Building2,
  Clock3,
  Gavel,
  GitCompareArrows,
  Landmark,
  PackageCheck,
} from "lucide-react";
import type { BidRockListing } from "@shared/bidrock";
import { formatBidRockMoney } from "@shared/bidrock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BidRockCountdown,
  formatBidRockAssetKind,
  formatBidRockDimensions,
} from "./BidRockListingRow";

type Props = {
  listing: BidRockListing | null;
  verifiedBusiness: boolean;
  compared: boolean;
  saved: boolean;
  submittingBid: boolean;
  onCompare: () => void;
  onSave: () => void;
  onOpenAccount: () => void;
  onPlaceBid: (maximumAmount: string) => Promise<void>;
};

export function BidRockDetailPanel({
  listing,
  verifiedBusiness,
  compared,
  saved,
  submittingBid,
  onCompare,
  onSave,
  onOpenAccount,
  onPlaceBid,
}: Props) {
  const [maximumAmount, setMaximumAmount] = useState("");
  const maximumInputRef = useRef<HTMLInputElement>(null);
  const proxyExplanationId = useId();

  useEffect(() => setMaximumAmount(""), [listing?.id]);

  if (!listing?.auction) {
    return (
      <aside className="flex min-h-64 items-center justify-center border-l border-stone-200 bg-white p-6 text-center text-sm text-stone-500 lg:min-h-0">
        Select a timed lot to inspect its facts and bid activity.
      </aside>
    );
  }

  const auction = listing.auction;
  const confirmed = new Date(listing.lastConfirmedAt);
  const finishSummary = listing.finishQuantities.length
    ? listing.finishQuantities
        .map((finish) => `${finish.slabCount} ${finish.finish.toLowerCase()}`)
        .join(" · ")
    : "Finish confirmation pending";
  const terminal = ["sold", "no_sale", "ended"].includes(auction.status);
  const canSeeBidValues = verifiedBusiness || listing.canManage;
  const bidDisabledReason = terminal
    ? auction.status === "sold"
      ? "This lot is sold."
      : auction.status === "no_sale"
        ? "This auction closed without a sale."
        : "This auction has ended."
    : auction.status === "scheduled"
      ? "Bidding opens at the scheduled start time."
      : listing.canManage
        ? "Sellers and administrators cannot bid on this lot."
        : !verifiedBusiness
          ? "Business verification is required to place a bid."
          : !auction.canBid
            ? "Bidding is not available for this account."
            : null;

  return (
    <aside
      className="border-l border-stone-200 bg-white lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:overflow-y-auto"
      aria-label={`${auction.lotNumber}: ${listing.title} details`}
    >
      <div className="relative aspect-[4/3] bg-stone-200">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={`${listing.title} auction lot`}
            className="h-full w-full object-cover"
          />
        ) : null}
        <Badge className="absolute left-4 top-4 rounded bg-stone-950/90 text-white hover:bg-stone-950/90">
          {auction.lotNumber}
        </Badge>
        <Badge className="absolute right-4 top-4 rounded bg-[var(--bidrock-auction)] text-white hover:bg-[var(--bidrock-auction)]">
          {auction.extended ? "Soft close" : auction.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="p-5 pb-28 lg:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bidrock-auction)]">
              {formatBidRockAssetKind(listing)} · {listing.materialFamily || "Stone"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
              {listing.title}
            </h2>
            <p className="mt-1 text-xs text-stone-500">Offered by {listing.sourceProfileName}</p>
          </div>
          <PackageCheck className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        </div>

        <section
          className="mt-5 rounded-xl bg-stone-950 p-4 text-white"
          aria-label="Auction activity"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                {canSeeBidValues ? "Current bid" : "Bid values"}
              </p>
              <p className="mt-1 text-xl font-bold">
                {auction.currentBid ? formatBidRockMoney(auction.currentBid) : "Private"}
              </p>
            </div>
            <div className="border-l border-stone-700 pl-4">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                <Clock3 className="h-3 w-3" aria-hidden="true" /> Ends in
              </p>
              <BidRockCountdown
                endsAt={auction.endsAt}
                serverTime={auction.serverTime}
                className="mt-1 block text-xl font-bold tabular-nums"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-700 pt-3 text-xs text-stone-300">
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
            {auction.extended ? (
              <span className="font-semibold text-amber-300">Soft close extended</span>
            ) : null}
          </div>
        </section>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-stone-200 py-4 text-sm">
          <div>
            <dt className="text-xs text-stone-500">Dimensions</dt>
            <dd className="mt-1 font-semibold text-stone-900">
              {formatBidRockDimensions(listing)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Lot quantity</dt>
            <dd className="mt-1 font-semibold text-stone-900">
              {listing.quantity} {listing.unit}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-stone-500">Finish</dt>
            <dd className="mt-1 font-semibold text-stone-900">{finishSummary}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-stone-500">Stock confirmation</dt>
            <dd className="mt-1 text-stone-700">
              {Number.isNaN(confirmed.getTime())
                ? "Seller-confirmed current stock"
                : confirmed.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-stone-500">Pickup</dt>
            <dd className="mt-1 text-stone-700">{auction.pickupTerms}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-stone-500">Freight</dt>
            <dd className="mt-1 text-stone-700">{auction.freightTerms}</dd>
          </div>
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onCompare} aria-pressed={compared}>
            <GitCompareArrows aria-hidden="true" />
            {compared ? "Compared" : "Compare"}
          </Button>
          <Button type="button" variant="outline" onClick={onSave} aria-pressed={saved}>
            <Bookmark
              className={cn(saved && "fill-current text-[var(--bidrock-auction)]")}
              aria-hidden="true"
            />
            {saved ? "Watching" : "Watch lot"}
          </Button>
        </div>

        {!canSeeBidValues ? (
          <section
            className="mt-5 rounded-xl bg-[var(--bidrock-auction-soft)] p-4"
            aria-label="Bid privacy"
          >
            <Building2
              className="h-5 w-5 text-[var(--bidrock-auction-verification-icon)]"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-semibold text-[var(--bidrock-auction-verification-ink)]">
              Business verification required to view bids
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Guests can review lot facts, time remaining, reserve state, and activity. Dollar
              values stay private.
            </p>
            <Button
              type="button"
              onClick={onOpenAccount}
              className="mt-3 w-full bg-[var(--bidrock-auction)] text-white hover:bg-[var(--bidrock-auction-hover)]"
            >
              Verify a business to bid
            </Button>
          </section>
        ) : (
          <section className="mt-5" aria-label="Place bid">
            {auction.bidderStatus !== "none" ? (
              <p className="mb-3 rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-800">
                Your status: {auction.bidderStatus}
                {auction.ownMaximumBid
                  ? ` · Your private maximum ${formatBidRockMoney(auction.ownMaximumBid)}`
                  : ""}
              </p>
            ) : null}
            {auction.canBid ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void (async () => {
                    try {
                      await onPlaceBid(maximumAmount);
                      setMaximumAmount("");
                    } catch {
                      // Keep the typed maximum available for a corrected retry.
                    }
                  })();
                }}
              >
                <label className="block text-xs font-semibold text-stone-700">
                  Your maximum bid
                  <Input
                    ref={maximumInputRef}
                    value={maximumAmount}
                    onChange={(event) => setMaximumAmount(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={
                      auction.minimumNextBid
                        ? `Minimum ${formatBidRockMoney(auction.minimumNextBid)}`
                        : "Enter maximum"
                    }
                    className="mt-1 border-stone-300 bg-white text-base text-stone-950"
                    aria-label="Your maximum bid"
                    aria-describedby={proxyExplanationId}
                  />
                </label>
                <Button
                  type="submit"
                  disabled={submittingBid || !maximumAmount || Number(maximumAmount) <= 0}
                  className="mt-3 w-full bg-[var(--bidrock-auction)] text-white hover:bg-[var(--bidrock-auction-hover)]"
                >
                  <Gavel aria-hidden="true" />
                  {submittingBid ? "Placing bid…" : "Place bid"}
                </Button>
                <p id={proxyExplanationId} className="mt-2 text-[11px] leading-4 text-stone-500">
                  Your maximum stays private. Proxy bidding advances only as needed. Exact maximum
                  ties favor the earlier bid.
                </p>
              </form>
            ) : (
              <p className="rounded-lg bg-stone-100 px-3 py-3 text-sm text-stone-700">
                {bidDisabledReason}
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-500">
              <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
              Winning orders continue through ACH and logistics handoff.
            </p>
          </section>
        )}
      </div>

      {auction.canBid ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden">
          <Button
            type="button"
            className="w-full bg-[var(--bidrock-auction)] text-white hover:bg-[var(--bidrock-auction-hover)]"
            onClick={() => {
              maximumInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              maximumInputRef.current?.focus({ preventScroll: true });
            }}
          >
            <Gavel aria-hidden="true" /> Enter maximum bid
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
