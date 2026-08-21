import { useState } from "react";
import { Bookmark, Building2, GitCompareArrows, PackageCheck, Send } from "lucide-react";
import type { BidRockListing } from "@shared/bidrock";
import { formatBidRockPrice } from "@shared/bidrock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatBidRockDimensions } from "./BidRockListingRow";

type Props = {
  listing: BidRockListing | null;
  verifiedBusiness: boolean;
  compared: boolean;
  saved: boolean;
  submittingOffer: boolean;
  onCompare: () => void;
  onSave: () => void;
  onOpenAccount: () => void;
  onSubmitOffer: (args: {
    quantity: number;
    totalAmount: string;
    message?: string;
  }) => Promise<void>;
};

export function BidRockDetailPanel({
  listing,
  verifiedBusiness,
  compared,
  saved,
  submittingOffer,
  onCompare,
  onSave,
  onOpenAccount,
  onSubmitOffer,
}: Props) {
  const [quantity, setQuantity] = useState("1");
  const [totalAmount, setTotalAmount] = useState("");
  const [message, setMessage] = useState("");

  if (!listing) {
    return (
      <aside className="flex min-h-64 items-center justify-center border-l border-stone-200 bg-white p-6 text-center text-sm text-stone-500 lg:min-h-0">
        Select a sale-ready lot to inspect its physical details.
      </aside>
    );
  }

  const confirmed = new Date(listing.lastConfirmedAt);
  const finishSummary = listing.finishQuantities.length
    ? listing.finishQuantities
        .map((finish) => `${finish.slabCount} ${finish.finish.toLowerCase()}`)
        .join(" · ")
    : "Finish confirmation pending";

  return (
    <aside
      className="border-l border-stone-200 bg-white lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:overflow-y-auto"
      aria-label={`${listing.title} details`}
    >
      <div className="aspect-[4/3] bg-stone-200">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bidrock-accent-dark)]">
              {listing.materialFamily || "Stone"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bidrock-ink)]">
              {listing.title}
            </h2>
            <p className="mt-1 text-xs text-stone-500">Listed by {listing.sourceProfileName}</p>
          </div>
          <PackageCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-stone-200 py-4 text-sm">
          <div>
            <dt className="text-xs text-stone-500">Dimensions</dt>
            <dd className="mt-1 font-semibold text-stone-900">
              {formatBidRockDimensions(listing)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Confirmed quantity</dt>
            <dd className="mt-1 font-semibold text-stone-900">
              {listing.quantity} {listing.unit}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-stone-500">Known finish evidence</dt>
            <dd className="mt-1 font-semibold text-stone-900">{finishSummary}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-stone-500">Physical confirmation</dt>
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
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-stone-300 text-stone-800 hover:bg-stone-100 hover:text-stone-950"
            onClick={onCompare}
          >
            <GitCompareArrows aria-hidden="true" />
            {compared ? "Compared" : "Compare"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-stone-300 text-stone-800 hover:bg-stone-100 hover:text-stone-950"
            onClick={onSave}
          >
            <Bookmark
              className={cn(saved && "fill-current text-[var(--bidrock-accent)]")}
              aria-hidden="true"
            />
            {saved ? "Saved" : "Save"}
          </Button>
        </div>

        {verifiedBusiness ? (
          <section
            className="mt-5 border-t border-stone-200 pt-5"
            aria-label="Business transaction"
          >
            {listing.privatePrice ? (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                  Seller price
                </span>
                <strong className="text-xl text-stone-950">
                  {formatBidRockPrice(listing.privatePrice)}
                </strong>
              </div>
            ) : null}
            {listing.canOffer ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSubmitOffer({
                    quantity: Number(quantity),
                    totalAmount,
                    message: message.trim() || undefined,
                  });
                }}
              >
                <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                  <label className="text-xs font-semibold text-stone-700">
                    Quantity
                    <Input
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      inputMode="decimal"
                      className="mt-1 border-stone-300 bg-white text-stone-950"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-700">
                    Offer total
                    <Input
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="mt-1 border-stone-300 bg-white text-stone-950"
                    />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-stone-700">
                  Transaction note
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Timing, quantity, or delivery constraints"
                    className="mt-1 min-h-20 border-stone-300 bg-white text-stone-950"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={submittingOffer || !totalAmount || Number(quantity) <= 0}
                  className="w-full rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
                >
                  <Send aria-hidden="true" />
                  {submittingOffer ? "Submitting…" : "Submit offer"}
                </Button>
                <p className="text-[11px] leading-4 text-stone-500">
                  Business orders use ACH. Accepting an offer creates a time-limited reservation.
                </p>
              </form>
            ) : null}
          </section>
        ) : (
          <section className="mt-5 border-t border-stone-200 pt-5">
            <div className="rounded-lg bg-[var(--bidrock-soft)] p-4">
              <Building2
                className="h-5 w-5 text-[var(--bidrock-verification-icon)]"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold text-[var(--bidrock-verification-ink)]">
                Business verification required
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                BidRock verifies the businesses on both sides before transaction tools are enabled.
              </p>
              <Button
                type="button"
                onClick={onOpenAccount}
                className="mt-3 w-full rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
              >
                Create business account
              </Button>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
