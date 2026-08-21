import { useState } from "react";
import { Banknote, Check, PackageCheck, X } from "lucide-react";
import type { BidRockHandoffType, BidRockListing, BidRockPriceUnit } from "@shared/bidrock";
import { formatBidRockPrice } from "@shared/bidrock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { BidRockOffer, BidRockOrder } from "./bidrockClient";
import { BidRockListingRow, formatBidRockDimensions } from "./BidRockListingRow";

type SellerProps = {
  listings: readonly BidRockListing[];
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onSavePrice: (args: {
    listingId: string;
    amount: string;
    unit: BidRockPriceUnit;
  }) => Promise<void>;
  onClearPrice: (listingId: string) => Promise<void>;
  onPublication: (listingId: string, saleReady: boolean) => Promise<void>;
};

export function BidRockSellerPanel({
  listings,
  selectedId,
  busy,
  onSelect,
  onSavePrice,
  onClearPrice,
  onPublication,
}: SellerProps) {
  const selected = listings.find((listing) => listing.id === selectedId) ?? listings[0] ?? null;
  return (
    <div className="grid min-h-[calc(100vh-170px)] border-t border-stone-200 bg-[var(--bidrock-workspace)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label="Seller inventory">
        <div className="border-b border-stone-200 bg-[var(--bidrock-soft)] px-4 py-3 text-xs leading-5 text-[var(--bidrock-soft-ink)]">
          Confirmed physical stock appears here before buyer publication. Set private business
          terms, then explicitly mark a fresh lot sale-ready.
        </div>
        {listings.length ? (
          <div className="[content-visibility:auto]">
            {listings.map((listing) => (
              <BidRockListingRow
                key={listing.id}
                listing={listing}
                selected={selected?.id === listing.id}
                compared={false}
                saved={listing.saved}
                sellerMode
                onSelect={() => onSelect(listing.id)}
                onCompare={() => onSelect(listing.id)}
                onSave={() => onSelect(listing.id)}
              />
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <PackageCheck className="mx-auto h-7 w-7 text-stone-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-stone-800">No physical stock is projected yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              The canonical JW Stone import supplies the seven confirmed lots without re-entry.
            </p>
          </div>
        )}
      </section>
      <div className="hidden lg:block">
        {selected ? (
          <SellerListingEditor
            key={selected.id}
            listing={selected}
            busy={busy}
            onSavePrice={onSavePrice}
            onClearPrice={onClearPrice}
            onPublication={onPublication}
          />
        ) : (
          <aside className="border-l border-stone-200 bg-white p-6 text-sm text-stone-500">
            Select seller inventory to manage it.
          </aside>
        )}
      </div>
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && onSelect(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto border-stone-200 bg-white p-0 text-stone-950 lg:hidden"
          data-testid="bidrock-mobile-seller-editor"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selected?.title || "Seller inventory"}</SheetTitle>
            <SheetDescription>Private seller price and publication controls.</SheetDescription>
          </SheetHeader>
          {selected ? (
            <SellerListingEditor
              key={`mobile-${selected.id}`}
              listing={selected}
              busy={busy}
              onSavePrice={onSavePrice}
              onClearPrice={onClearPrice}
              onPublication={onPublication}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SellerListingEditor({
  listing,
  busy,
  onSavePrice,
  onClearPrice,
  onPublication,
}: {
  listing: BidRockListing;
  busy: boolean;
  onSavePrice: SellerProps["onSavePrice"];
  onClearPrice: SellerProps["onClearPrice"];
  onPublication: SellerProps["onPublication"];
}) {
  const [amount, setAmount] = useState(
    listing.privatePrice ? (listing.privatePrice.amountCents / 100).toFixed(2) : ""
  );
  const [unit, setUnit] = useState<BidRockPriceUnit>(listing.privatePrice?.unit ?? "slab");
  const canWrite = listing.sellerCapabilities?.write ?? listing.canManage;
  const canPublish = listing.sellerCapabilities?.publish ?? listing.canManage;
  return (
    <aside className="border-l border-stone-200 bg-white p-5 lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bidrock-accent-dark)]">
        Seller control
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-stone-950">{listing.title}</h2>
      <p className="mt-1 text-xs text-stone-500">
        {formatBidRockDimensions(listing)} · {listing.quantity} {listing.unit}
      </p>

      {canWrite ? (
        <div className="mt-6 border-y border-stone-200 py-5">
          <label className="text-xs font-bold text-stone-700">
            Verified-business price
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="border-stone-300 bg-white text-stone-950"
              />
              <Select value={unit} onValueChange={(value) => setUnit(value as BidRockPriceUnit)}>
                <SelectTrigger className="border-stone-300 bg-white text-stone-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slab">Per slab</SelectItem>
                  <SelectItem value="sqft">Per sq ft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </label>
          {listing.privatePrice ? (
            <p className="mt-2 text-xs text-stone-500">
              Current: {formatBidRockPrice(listing.privatePrice)}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={busy || !amount}
              onClick={() => void onSavePrice({ listingId: listing.id, amount, unit })}
              className="rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
            >
              Save price
            </Button>
            {listing.privatePrice ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void onClearPrice(listing.id)}
                className="border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-950"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canPublish ? (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-stone-200 p-4">
          <div>
            <p className="text-sm font-bold text-stone-900">Sale-ready publication</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Buyer visibility requires current physical confirmation and a seller-set business
              price.
            </p>
          </div>
          <Switch
            checked={listing.saleReady}
            disabled={busy || !listing.fresh || (!listing.privatePrice && !listing.saleReady)}
            onCheckedChange={(checked) => void onPublication(listing.id, checked)}
            aria-label={`Mark ${listing.title} sale-ready`}
          />
        </div>
      ) : null}
      {!canWrite && !canPublish ? (
        <p className="mt-5 border border-stone-200 p-4 text-sm text-stone-500">
          This delegation is read-only. Ask the holder business for an exact write or publish scope.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className={cn(
            "border-stone-300 bg-transparent text-stone-600",
            listing.fresh && "border-emerald-300 text-emerald-700"
          )}
        >
          {listing.fresh ? "Confirmation current" : "Re-confirmation required"}
        </Badge>
        <Badge variant="outline" className="border-stone-300 bg-transparent text-stone-600">
          {listing.status}
        </Badge>
      </div>
    </aside>
  );
}

type AdminProps = {
  orders: readonly BidRockOrder[];
  busy: boolean;
  onProjectInventory: () => Promise<boolean>;
  onExpireHolds: () => Promise<boolean>;
  onCloseAuctions: () => Promise<boolean>;
  onImportConfirmedStock: () => Promise<boolean>;
  onDelegation: (args: {
    orderId: string;
    providerUserId?: string;
    providerBusinessId?: string;
    handoffTypes: readonly [BidRockHandoffType];
    status: "active" | "revoked";
  }) => Promise<boolean>;
};

const ADMIN_HANDOFF_LABELS: Readonly<Record<BidRockHandoffType, string>> = {
  freight: "Freight",
  custody: "Custody",
  fabrication: "Fabrication",
  installation_homeid: "Installation / HomeID",
};

export function BidRockAdminPanel({
  orders,
  busy,
  onProjectInventory,
  onExpireHolds,
  onCloseAuctions,
  onImportConfirmedStock,
  onDelegation,
}: AdminProps) {
  const [outcome, setOutcome] = useState("No maintenance action has run in this session.");
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [providerKind, setProviderKind] = useState<"user" | "business">("user");
  const [providerId, setProviderId] = useState("");
  const [handoffType, setHandoffType] = useState<BidRockHandoffType>("freight");
  const [delegationStatus, setDelegationStatus] = useState<"active" | "revoked">("active");

  const runAdmin = async (label: string, action: () => Promise<boolean>) => {
    setOutcome(`${label} in progress…`);
    const succeeded = await action();
    setOutcome(succeeded ? `${label} completed.` : `${label} failed. Review the error message.`);
  };

  return (
    <div className="border-t border-stone-200 bg-[var(--bidrock-workspace)] p-4 lg:p-6">
      <section className="mx-auto max-w-4xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold text-stone-950">BidRock operations</h2>
        <p className="mt-1 text-sm text-stone-500">
          Explicit mutation boundaries for inventory projection, expiry, canonical import, and
          provider delegation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => void runAdmin("Inventory projection", onProjectInventory)}
          >
            Sync Stone Core projection
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void runAdmin("Hold expiry", onExpireHolds)}
          >
            Expire due holds
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void runAdmin("Auction closure", onCloseAuctions)}
          >
            Close ended auctions
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void runAdmin("Confirmed-stock import", onImportConfirmedStock)}
          >
            Import seven confirmed lots
          </Button>
        </div>
        <p className="mt-3 text-xs text-stone-600" role="status">
          {outcome}
        </p>

        <div className="mt-6 border-t border-stone-200 pt-5">
          <h3 className="text-sm font-bold text-stone-900">Delegated handoff capability</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger aria-label="Delegation order">
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Delegated provider identity"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              placeholder={providerKind === "user" ? "Provider user ID" : "Provider business ID"}
            />
            <Select
              value={providerKind}
              onValueChange={(value) => setProviderKind(value as typeof providerKind)}
            >
              <SelectTrigger aria-label="Provider identity type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={handoffType}
              onValueChange={(value) => setHandoffType(value as BidRockHandoffType)}
            >
              <SelectTrigger aria-label="Delegated handoff type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ADMIN_HANDOFF_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={delegationStatus}
              onValueChange={(value) => setDelegationStatus(value as typeof delegationStatus)}
            >
              <SelectTrigger aria-label="Delegation state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={busy || !orderId || providerId.trim().length === 0}
              onClick={() =>
                void runAdmin("Delegation update", () =>
                  onDelegation({
                    orderId,
                    ...(providerKind === "user"
                      ? { providerUserId: providerId.trim() }
                      : { providerBusinessId: providerId.trim() }),
                    handoffTypes: [handoffType],
                    status: delegationStatus,
                  })
                )
              }
            >
              Save delegation
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

type ActivityProps = {
  offers: readonly BidRockOffer[];
  orders: readonly BidRockOrder[];
  busy: boolean;
  onAccept: (offerId: string) => Promise<void>;
  onCounter: (offerId: string, totalAmount: string, message?: string) => Promise<void>;
  onReject: (offerId: string) => Promise<void>;
  onPaymentReady: (orderId: string) => Promise<void>;
  onCancel: (orderId: string) => Promise<void>;
  onOpenOrder: (orderId: string) => void;
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  reservation_active: "Reserved",
  payment_ready: "ACH ready",
  payment_processing: "ACH processing",
  paid: "Paid",
  freight: "Freight",
  custody_transferred: "Custody transferred",
  fabrication: "Fabrication",
  installation_handoff: "Installation / HomeID",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function BidRockActivityPanel({
  offers,
  orders,
  busy,
  onAccept,
  onCounter,
  onReject,
  onPaymentReady,
  onCancel,
  onOpenOrder,
}: ActivityProps) {
  return (
    <div className="grid gap-5 border-t border-stone-200 bg-[var(--bidrock-workspace)] p-4 lg:grid-cols-2 lg:p-6">
      <section
        className="border border-stone-200 bg-white"
        aria-labelledby="bidrock-offers-heading"
      >
        <header className="border-b border-stone-200 px-4 py-3">
          <h2 id="bidrock-offers-heading" className="font-bold text-stone-950">
            Offers
          </h2>
          <p className="mt-1 text-xs text-stone-500">Private business negotiation state.</p>
        </header>
        {offers.length ? (
          <ul className="divide-y divide-stone-200">
            {offers.map((offer) => {
              return (
                <li key={offer.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-stone-900">
                        {offer.quantity} units ·{" "}
                        {(offer.totalAmountCents / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">{offer.message || "No note"}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-stone-300 bg-transparent text-stone-600"
                    >
                      {offer.status}
                    </Badge>
                  </div>
                  {offer.actions.accept || offer.actions.counter || offer.actions.reject ? (
                    <div className="mt-3 flex gap-2">
                      {offer.actions.accept ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onAccept(offer.id)}
                          className="rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
                        >
                          <Check aria-hidden="true" /> Accept
                        </Button>
                      ) : null}
                      {offer.actions.counter ? (
                        <CounterOfferControl offerId={offer.id} busy={busy} onCounter={onCounter} />
                      ) : null}
                      {offer.actions.reject ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void onReject(offer.id)}
                          className="border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                        >
                          <X aria-hidden="true" /> Reject
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-6 text-sm text-stone-500">No active offers.</p>
        )}
      </section>

      <section
        className="border border-stone-200 bg-white"
        aria-labelledby="bidrock-orders-heading"
      >
        <header className="border-b border-stone-200 px-4 py-3">
          <h2 id="bidrock-orders-heading" className="font-bold text-stone-950">
            Orders and handoffs
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            ACH readiness, custody, freight, fabrication, and installation state.
          </p>
        </header>
        {orders.length ? (
          <ul className="divide-y divide-stone-200">
            {orders.map((order) => (
              <li key={order.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-stone-900">
                      {(order.subtotalCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-stone-500">
                      {order.paymentMethod} · {order.quantity} units
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-stone-300 bg-transparent text-stone-600"
                  >
                    {STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.actions.prepareAch ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onPaymentReady(order.id)}
                      className="rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
                    >
                      <Banknote aria-hidden="true" /> Prepare ACH
                    </Button>
                  ) : null}
                  {order.actions.cancel ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void onCancel(order.id)}
                    >
                      <X aria-hidden="true" /> Cancel
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenOrder(order.id)}
                  >
                    View order
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-stone-500">No reservations or orders.</p>
        )}
      </section>
    </div>
  );
}

function CounterOfferControl({
  offerId,
  busy,
  onCounter,
}: {
  offerId: string;
  busy: boolean;
  onCounter: ActivityProps["onCounter"];
}) {
  const [open, setOpen] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [message, setMessage] = useState("");
  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Counter
      </Button>
    );
  }
  return (
    <div className="flex min-w-[15rem] flex-1 gap-2">
      <Input
        aria-label="Counteroffer total"
        value={totalAmount}
        onChange={(event) => setTotalAmount(event.target.value)}
        inputMode="decimal"
        placeholder="Total"
      />
      <Input
        aria-label="Counteroffer note"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Note"
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || !totalAmount}
        onClick={() => void onCounter(offerId, totalAmount, message)}
      >
        Send
      </Button>
    </div>
  );
}
