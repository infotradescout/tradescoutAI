import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Building2,
  ChevronDown,
  GitCompareArrows,
  Layers3,
  Search,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import type { BidRockListing } from "@shared/bidrock";
import { formatBidRockPrice } from "@shared/bidrock";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PublicProfileAccountDialog } from "@/components/profile/PublicProfileAccountDialog";
import {
  loadProfileAccountState,
  profileAccountActionLabel,
  type ProfileAccountResponse,
} from "@/components/profile/profileAccountClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { cn } from "@/lib/utils";
import {
  acceptBidRockOffer,
  cancelBidRockOrder,
  clearBidRockPrice,
  completeBidRockOrder,
  counterBidRockOffer,
  linkBidRockOrderSystems,
  loadBidRockCatalog,
  loadBidRockOffers,
  loadBidRockOrder,
  loadBidRockOrders,
  loadBidRockProviderAssignments,
  loadBidRockSellerInventory,
  markBidRockPaymentReady,
  expireBidRockHolds,
  importBidRockConfirmedStock,
  projectBidRockInventory,
  recordBidRockHandoff,
  rejectBidRockOffer,
  saveBidRockPrice,
  setBidRockPublication,
  setBidRockSaved,
  settleBidRockAch,
  setBidRockDelegation,
  submitBidRockOffer,
  type BidRockOffer,
  type BidRockOrder,
  type BidRockProviderAssignment,
} from "./bidrockClient";
import { BidRockDetailPanel } from "./BidRockDetailPanel";
import { BidRockListingRow, formatBidRockDimensions } from "./BidRockListingRow";
import {
  BidRockActivityPanel,
  BidRockAdminPanel,
  BidRockSellerPanel,
} from "./BidRockOperationsPanels";
import { BidRockOrderSheet } from "./BidRockOrderSheet";
import "./bidrock-theme.css";

const GUEST_SAVES_KEY = "bidrock:saved:v1";
const MAX_COMPARE = 3;

type WorkspaceTab = "market" | "seller" | "activity" | "provider" | "admin";

function readGuestSaves(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(GUEST_SAVES_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function listingMatches(
  listing: BidRockListing,
  query: string,
  material: string,
  source: string,
  savedOnly: boolean,
  saved: boolean
): boolean {
  if (savedOnly && !saved) return false;
  if (material && listing.materialFamily !== material) return false;
  if (source && listing.sourceProfileSlug !== source) return false;
  if (!query) return true;
  return [listing.title, listing.materialFamily, listing.sourceProfileName, listing.materialSlug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export default function BidRockWorkspace() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WorkspaceTab>("market");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [material, setMaterial] = useState("");
  const [source, setSource] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [guestSaved, setGuestSaved] = useState(readGuestSaves);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const retryKeys = useRef(new Map<string, string>());

  const withStableRetryKey = async (
    semanticKey: string,
    mutation: (idempotencyKey: string) => Promise<void>
  ) => {
    const idempotencyKey = retryKeys.current.get(semanticKey) ?? crypto.randomUUID();
    retryKeys.current.set(semanticKey, idempotencyKey);
    await mutation(idempotencyKey);
    retryKeys.current.delete(semanticKey);
  };

  const catalogQuery = useQuery({
    queryKey: ["bidrock", "catalog"],
    queryFn: loadBidRockCatalog,
    staleTime: 30_000,
  });
  const accountQuery = useQuery({
    queryKey: ["profile-account", "jw-stone", isAuthenticated],
    queryFn: () => loadProfileAccountState("jw-stone", isAuthenticated),
    staleTime: 30_000,
  });
  const catalog = catalogQuery.data;
  const canSell = catalog?.viewer.canSell === true;
  const canUseActivity = catalog?.viewer.verifiedBusiness === true;
  const canAdmin = catalog?.viewer.admin === true;
  const providerQuery = useQuery({
    queryKey: ["bidrock", "provider-assignments"],
    queryFn: loadBidRockProviderAssignments,
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
  const providerAssignments = providerQuery.data ?? [];
  const canUseProvider = providerAssignments.length > 0;

  const sellerQuery = useQuery({
    queryKey: ["bidrock", "seller-inventory"],
    queryFn: loadBidRockSellerInventory,
    enabled: tab === "seller" && canSell,
    staleTime: 10_000,
  });
  const activityQuery = useQuery({
    queryKey: ["bidrock", "activity"],
    queryFn: async (): Promise<{
      offers: readonly BidRockOffer[];
      orders: readonly BidRockOrder[];
    }> => {
      const [offers, orders] = await Promise.all([loadBidRockOffers(), loadBidRockOrders()]);
      return { offers, orders };
    },
    enabled: (tab === "activity" && canUseActivity) || (tab === "admin" && canAdmin),
    staleTime: 10_000,
  });
  const orderQuery = useQuery({
    queryKey: ["bidrock", "order", selectedOrderId],
    queryFn: () => loadBidRockOrder(selectedOrderId as string),
    enabled: Boolean(selectedOrderId),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUEST_SAVES_KEY, JSON.stringify([...guestSaved]));
  }, [guestSaved]);

  const listings = catalog?.listings ?? [];
  const materials = useMemo(
    () => [...new Set(listings.map((listing) => listing.materialFamily).filter(Boolean))].sort(),
    [listings]
  );
  const sources = useMemo(
    () =>
      [
        ...new Map(
          listings.map((listing) => [listing.sourceProfileSlug, listing.sourceProfileName])
        ).entries(),
      ].sort((left, right) => left[1].localeCompare(right[1])),
    [listings]
  );
  const isSaved = (listing: BidRockListing) =>
    isAuthenticated ? listing.saved : guestSaved.has(listing.id);
  const filteredListings = useMemo(
    () =>
      listings.filter((listing) =>
        listingMatches(
          listing,
          deferredSearch,
          material,
          source,
          savedOnly,
          isAuthenticated ? listing.saved : guestSaved.has(listing.id)
        )
      ),
    [deferredSearch, guestSaved, isAuthenticated, listings, material, savedOnly, source]
  );
  const selectedListing =
    listings.find((listing) => listing.id === selectedMarketId) ?? filteredListings[0] ?? null;
  const comparedListings = compareIds
    .map((id) => listings.find((listing) => listing.id === id))
    .filter((listing): listing is BidRockListing => Boolean(listing));

  const reportFailure = (error: unknown, title: string) => {
    toast({
      title,
      description: formatUserFacingErrorMessage(error, "Please try again."),
      variant: "destructive",
    });
  };

  const refreshMarketplace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bidrock", "catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "seller-inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "activity"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "order"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "provider-assignments"] }),
    ]);
  };

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    setBusy(true);
    try {
      await action();
      await refreshMarketplace();
      toast({ title: success });
      return true;
    } catch (error) {
      reportFailure(error, failure);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleCompare = (listingId: string) => {
    setCompareIds((current) => {
      if (current.includes(listingId)) return current.filter((id) => id !== listingId);
      if (current.length >= MAX_COMPARE) {
        toast({ title: "Compare up to three lots" });
        return current;
      }
      return [...current, listingId];
    });
  };

  const toggleSaved = async (listing: BidRockListing) => {
    const nextSaved = !isSaved(listing);
    if (!isAuthenticated) {
      setGuestSaved((current) => {
        const next = new Set(current);
        if (nextSaved) next.add(listing.id);
        else next.delete(listing.id);
        return next;
      });
      return;
    }
    await run(
      () => setBidRockSaved(listing.id, nextSaved),
      nextSaved ? "Selection saved" : "Selection removed",
      "Saved selection could not be updated"
    );
  };

  const selectMarketListing = (listingId: string) => {
    setSelectedMarketId(listingId);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  };

  const sellerListings = sellerQuery.data ?? [];
  const activity = activityQuery.data ?? { offers: [], orders: [] };

  return (
    <div
      className="bidrock-theme min-h-screen bg-[var(--bidrock-canvas)] text-[var(--bidrock-ink)]"
      data-testid="bidrock-workspace"
    >
      <SEOHelmet
        title="BidRock | Business Stone Marketplace"
        description="A business-only stone marketplace powered by TradeScout."
        canonical="https://www.thetradescout.com/bidrock"
      />
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-black/15 bg-[var(--bidrock-deep)] px-4 text-white sm:px-6">
        <a href="/bidrock" className="flex min-w-0 items-center gap-3" aria-label="BidRock home">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--bidrock-accent)]">
            <Layers3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-black tracking-tight">BidRock</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Powered by TradeScout
            </span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {catalog?.viewer.verifiedBusiness ? (
            <Badge className="hidden border-emerald-400/20 bg-emerald-400/10 text-emerald-100 sm:inline-flex">
              <Building2 className="mr-1 h-3 w-3" aria-hidden="true" /> Verified business
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setAccountOpen(true)}
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            {profileAccountActionLabel(accountQuery.data)}
          </Button>
          <Button
            asChild
            variant="ghost"
            className="hidden text-white/70 hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <a href="/">TradeScout</a>
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as WorkspaceTab)}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--bidrock-accent-dark)]">
              Business stone market
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-stone-950">
              Inventory workspace
            </h1>
          </div>
          <TabsList className="border-stone-200 bg-stone-100 text-stone-600">
            <TabsTrigger
              value="market"
              className="text-stone-600 data-[state=active]:bg-white data-[state=active]:text-stone-950"
            >
              Market
            </TabsTrigger>
            {canSell ? (
              <TabsTrigger
                value="seller"
                className="text-stone-600 data-[state=active]:bg-white data-[state=active]:text-stone-950"
              >
                Seller inventory
              </TabsTrigger>
            ) : null}
            {canUseActivity ? (
              <TabsTrigger
                value="activity"
                className="text-stone-600 data-[state=active]:bg-white data-[state=active]:text-stone-950"
              >
                Transactions
              </TabsTrigger>
            ) : null}
            {canUseProvider ? (
              <TabsTrigger
                value="provider"
                className="text-stone-600 data-[state=active]:bg-white data-[state=active]:text-stone-950"
              >
                Assigned handoffs
              </TabsTrigger>
            ) : null}
            {canAdmin ? (
              <TabsTrigger
                value="admin"
                className="text-stone-600 data-[state=active]:bg-white data-[state=active]:text-stone-950"
              >
                Operations
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="market" className="m-0">
          <MobileFilters
            search={search}
            material={material}
            source={source}
            savedOnly={savedOnly}
            materials={materials as string[]}
            sources={sources}
            onSearch={setSearch}
            onMaterial={setMaterial}
            onSource={setSource}
            onSavedOnly={setSavedOnly}
          />
          <div className="grid min-h-[calc(100vh-133px)] lg:grid-cols-[220px_minmax(0,1fr)_350px]">
            <FilterRail
              search={search}
              material={material}
              source={source}
              savedOnly={savedOnly}
              materials={materials as string[]}
              sources={sources}
              onSearch={setSearch}
              onMaterial={setMaterial}
              onSource={setSource}
              onSavedOnly={setSavedOnly}
            />
            <main className="min-w-0 border-r border-stone-200 bg-[var(--bidrock-workspace)]">
              <div className="flex min-h-11 items-center justify-between gap-3 border-b border-stone-200 px-4 text-xs text-stone-500">
                <span>{filteredListings.length} sale-ready lots</span>
                {compareIds.length ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setCompareOpen(true)}
                    className="h-8 rounded-md text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                  >
                    <GitCompareArrows aria-hidden="true" /> Compare {compareIds.length}
                  </Button>
                ) : null}
              </div>
              {catalogQuery.isLoading ? (
                <div className="space-y-px" aria-label="Loading BidRock inventory">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-[89px] animate-pulse border-b border-stone-200 bg-white/70"
                    />
                  ))}
                </div>
              ) : catalogQuery.isError ? (
                <div className="p-10 text-center">
                  <p className="font-semibold text-stone-900">
                    BidRock inventory could not be loaded.
                  </p>
                  <Button
                    type="button"
                    onClick={() => void catalogQuery.refetch()}
                    className="mt-4 rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
                  >
                    Try again
                  </Button>
                </div>
              ) : filteredListings.length ? (
                <div className="[content-visibility:auto]">
                  {filteredListings.map((listing) => (
                    <BidRockListingRow
                      key={listing.id}
                      listing={listing}
                      selected={selectedListing?.id === listing.id}
                      compared={compareIds.includes(listing.id)}
                      saved={isSaved(listing)}
                      onSelect={() => selectMarketListing(listing.id)}
                      onCompare={() => toggleCompare(listing.id)}
                      onSave={() => void toggleSaved(listing)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mx-auto max-w-xl px-6 py-16 text-center">
                  <Layers3 className="mx-auto h-8 w-8 text-stone-400" aria-hidden="true" />
                  <h2 className="mt-4 text-xl font-semibold text-stone-900">
                    No lots match the buyer workspace.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Only current physical stock explicitly published by its seller appears here.
                    Confirmed inventory can remain private in the seller workspace until it is
                    ready.
                  </p>
                  {canSell ? (
                    <Button
                      type="button"
                      onClick={() => setTab("seller")}
                      className="mt-5 rounded-md bg-[var(--bidrock-action)] text-white hover:bg-[var(--bidrock-action-hover)]"
                    >
                      Open seller inventory
                    </Button>
                  ) : null}
                </div>
              )}
            </main>
            <div className="hidden lg:block">
              <BidRockDetailPanel
                key={selectedListing?.id || "empty"}
                listing={selectedListing}
                verifiedBusiness={catalog?.viewer.verifiedBusiness === true}
                compared={selectedListing ? compareIds.includes(selectedListing.id) : false}
                saved={selectedListing ? isSaved(selectedListing) : false}
                submittingOffer={busy}
                onCompare={() => selectedListing && toggleCompare(selectedListing.id)}
                onSave={() => selectedListing && void toggleSaved(selectedListing)}
                onOpenAccount={() => setAccountOpen(true)}
                onSubmitOffer={async (offer) => {
                  if (!selectedListing) return;
                  await run(
                    () =>
                      withStableRetryKey(
                        `offer:${selectedListing.id}:${offer.quantity}:${offer.totalAmount}:${offer.message || ""}`,
                        (idempotencyKey) =>
                          submitBidRockOffer({
                            listingId: selectedListing.id,
                            ...offer,
                            idempotencyKey,
                          }).then(() => undefined)
                      ),
                    "Offer submitted",
                    "Offer could not be submitted"
                  );
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seller" className="m-0">
          {sellerQuery.isLoading ? (
            <div className="p-10 text-sm text-stone-500">Loading seller inventory…</div>
          ) : sellerQuery.isError ? (
            <div className="p-10 text-sm text-stone-500">Seller inventory is unavailable.</div>
          ) : (
            <BidRockSellerPanel
              listings={sellerListings}
              selectedId={selectedSellerId}
              busy={busy}
              onSelect={setSelectedSellerId}
              onSavePrice={async (args) => {
                await run(
                  () => saveBidRockPrice(args),
                  "Business price saved",
                  "Price could not be saved"
                );
              }}
              onClearPrice={async (listingId) => {
                await run(
                  () => clearBidRockPrice(listingId),
                  "Business price cleared",
                  "Price could not be cleared"
                );
              }}
              onPublication={async (listingId, saleReady) => {
                await run(
                  () => setBidRockPublication(listingId, saleReady),
                  saleReady ? "Lot published" : "Lot returned to seller inventory",
                  "Publication state could not be saved"
                );
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="activity" className="m-0">
          {activityQuery.isLoading ? (
            <div className="p-10 text-sm text-stone-500">Loading transaction state…</div>
          ) : activityQuery.isError ? (
            <div className="p-10 text-sm text-stone-500">Transaction state is unavailable.</div>
          ) : (
            <BidRockActivityPanel
              offers={activity.offers}
              orders={activity.orders}
              busy={busy}
              onAccept={async (offerId) => {
                await run(
                  () => acceptBidRockOffer(offerId).then(() => undefined),
                  "Offer accepted",
                  "Offer could not be accepted"
                );
              }}
              onReject={async (offerId) => {
                await run(
                  () => rejectBidRockOffer(offerId).then(() => undefined),
                  "Offer rejected",
                  "Offer could not be rejected"
                );
              }}
              onCounter={async (offerId, totalAmount, message) => {
                await run(
                  () =>
                    withStableRetryKey(
                      `counter:${offerId}:${totalAmount}:${message || ""}`,
                      (idempotencyKey) =>
                        counterBidRockOffer({
                          offerId,
                          totalAmount,
                          message,
                          idempotencyKey,
                        }).then(() => undefined)
                    ),
                  "Counteroffer sent",
                  "Counteroffer could not be sent"
                );
              }}
              onPaymentReady={async (orderId) => {
                await run(
                  () => markBidRockPaymentReady(orderId),
                  "ACH readiness recorded",
                  "Payment readiness could not be recorded"
                );
              }}
              onCancel={async (orderId) => {
                await run(
                  () => cancelBidRockOrder(orderId),
                  "Order cancelled",
                  "Order could not be cancelled"
                );
              }}
              onOpenOrder={setSelectedOrderId}
            />
          )}
        </TabsContent>

        <TabsContent value="provider" className="m-0">
          <ProviderAssignmentQueue
            assignments={providerAssignments}
            loading={providerQuery.isLoading}
            onOpenOrder={setSelectedOrderId}
          />
        </TabsContent>

        <TabsContent value="admin" className="m-0">
          {canAdmin ? (
            <BidRockAdminPanel
              orders={activity.orders}
              busy={busy}
              onProjectInventory={() =>
                run(
                  () => projectBidRockInventory().then(() => undefined),
                  "Inventory projection completed",
                  "Inventory projection failed"
                )
              }
              onExpireHolds={() =>
                run(
                  () => expireBidRockHolds().then(() => undefined),
                  "Due holds expired",
                  "Hold expiry failed"
                )
              }
              onImportConfirmedStock={() =>
                run(
                  () => importBidRockConfirmedStock().then(() => undefined),
                  "Confirmed stock imported idempotently",
                  "Confirmed-stock import failed"
                )
              }
              onDelegation={(args) =>
                run(
                  () => setBidRockDelegation(args).then(() => undefined),
                  "Delegation updated",
                  "Delegation update failed"
                )
              }
            />
          ) : null}
        </TabsContent>
      </Tabs>

      <BidRockCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        listings={comparedListings}
        verifiedBusiness={catalog?.viewer.verifiedBusiness === true}
      />
      <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto border-stone-200 bg-white p-0 text-stone-950 lg:hidden"
          data-testid="bidrock-mobile-lot-detail"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedListing?.title || "BidRock lot"}</SheetTitle>
            <SheetDescription>
              Selected sale-ready stone lot details and transaction controls.
            </SheetDescription>
          </SheetHeader>
          <BidRockDetailPanel
            key={`mobile-${selectedListing?.id || "empty"}`}
            listing={selectedListing}
            verifiedBusiness={catalog?.viewer.verifiedBusiness === true}
            compared={selectedListing ? compareIds.includes(selectedListing.id) : false}
            saved={selectedListing ? isSaved(selectedListing) : false}
            submittingOffer={busy}
            onCompare={() => selectedListing && toggleCompare(selectedListing.id)}
            onSave={() => selectedListing && void toggleSaved(selectedListing)}
            onOpenAccount={() => setAccountOpen(true)}
            onSubmitOffer={async (offer) => {
              if (!selectedListing) return;
              await run(
                () =>
                  withStableRetryKey(
                    `offer:${selectedListing.id}:${offer.quantity}:${offer.totalAmount}:${offer.message || ""}`,
                    (idempotencyKey) =>
                      submitBidRockOffer({
                        listingId: selectedListing.id,
                        ...offer,
                        idempotencyKey,
                      }).then(() => undefined)
                  ),
                "Offer submitted",
                "Offer could not be submitted"
              );
            }}
          />
        </SheetContent>
      </Sheet>
      <BidRockOrderSheet
        open={Boolean(selectedOrderId)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null);
        }}
        workspace={orderQuery.data ?? null}
        loading={orderQuery.isLoading}
        busy={busy}
        onPaymentReady={async (orderId) => {
          await run(
            () => markBidRockPaymentReady(orderId),
            "ACH readiness recorded",
            "Payment readiness could not be recorded"
          );
        }}
        onCancel={async (orderId) => {
          await run(
            () => cancelBidRockOrder(orderId),
            "Order cancelled",
            "Order could not be cancelled"
          );
        }}
        onLink={async (args) => {
          await run(
            () => linkBidRockOrderSystems(args),
            "Canonical records linked",
            "Canonical records could not be linked"
          );
        }}
        onSettle={async (orderId) => {
          await run(
            () => settleBidRockAch(orderId),
            "ACH settlement reconciled",
            "ACH settlement could not be reconciled"
          );
        }}
        onComplete={async (orderId) => {
          await run(
            () => completeBidRockOrder(orderId),
            "Order completed",
            "Order could not be completed"
          );
        }}
        onHandoff={async (args) => {
          await run(
            () =>
              withStableRetryKey(
                `handoff:${args.orderId}:${args.handoffType}:${args.status}:${args.providerName || ""}:${args.reference || ""}:${JSON.stringify(args.evidence || {})}`,
                (idempotencyKey) => recordBidRockHandoff({ ...args, idempotencyKey })
              ),
            "Handoff state recorded",
            "Handoff state could not be recorded"
          );
        }}
      />
      <PublicProfileAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        profileSlug="jw-stone"
        profileName="JW Stone"
        tone="light"
        initialState={accountQuery.data ?? null}
        onStateChange={(next: ProfileAccountResponse) => {
          queryClient.setQueryData(["profile-account", "jw-stone", isAuthenticated], next);
          void catalogQuery.refetch();
        }}
      />
    </div>
  );
}

function ProviderAssignmentQueue({
  assignments,
  loading,
  onOpenOrder,
}: {
  assignments: readonly BidRockProviderAssignment[];
  loading: boolean;
  onOpenOrder: (orderId: string) => void;
}) {
  if (loading) return <div className="p-10 text-sm text-stone-500">Loading assigned handoffs…</div>;
  return (
    <section className="mx-auto max-w-4xl p-4 sm:p-6" aria-label="Assigned provider handoffs">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--bidrock-accent-dark)]">
          Provider queue
        </p>
        <h2 className="mt-1 text-xl font-semibold text-stone-950">Assigned handoffs</h2>
        <p className="mt-1 text-sm text-stone-500">
          Only the lot reference and handoff scope assigned to you are shown.
        </p>
      </div>
      <div className="divide-y divide-stone-200 border-y border-stone-200 bg-white">
        {assignments.map((assignment) => (
          <div
            key={assignment.orderReference}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-stone-950">{assignment.listing.title}</p>
              <p className="mt-1 text-xs text-stone-500">
                {assignment.orderReference} · lot {assignment.lotReference}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {assignment.handoffActions.map((action) => (
                  <Badge
                    key={action.handoffType}
                    variant="outline"
                    className="border-stone-300 text-stone-600"
                    aria-disabled={!action.enabled}
                    title={action.disabledReason ?? undefined}
                  >
                    {action.handoffType.replace(/_/g, " ")} · {action.nextStatus.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
              {assignment.handoffActions
                .filter((action) => !action.enabled && action.disabledReason)
                .map((action) => (
                  <p key={`${action.handoffType}:reason`} className="mt-2 text-xs text-stone-500">
                    {action.disabledReason}
                  </p>
                ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenOrder(assignment.orderReference)}
              className="border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-950"
            >
              <Truck aria-hidden="true" /> Open handoff
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

type FilterProps = {
  search: string;
  material: string;
  source: string;
  savedOnly: boolean;
  materials: readonly string[];
  sources: readonly (readonly [string, string])[];
  onSearch: (value: string) => void;
  onMaterial: (value: string) => void;
  onSource: (value: string) => void;
  onSavedOnly: (value: boolean) => void;
};

function FilterControls(props: FilterProps) {
  return (
    <div className="space-y-5">
      <label className="block text-xs font-bold text-stone-700">
        Search inventory
        <span className="relative mt-2 block">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Stone or seller"
            className="border-stone-300 bg-white pl-9 text-stone-950"
          />
        </span>
      </label>
      <fieldset>
        <legend className="text-xs font-bold text-stone-700">Material</legend>
        <div className="mt-2 space-y-1">
          <FilterChoice
            active={!props.material}
            label="All materials"
            onClick={() => props.onMaterial("")}
          />
          {props.materials.map((value) => (
            <FilterChoice
              key={value}
              active={props.material === value}
              label={value.replace(/-/g, " ")}
              onClick={() => props.onMaterial(value)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold text-stone-700">Seller</legend>
        <div className="mt-2 space-y-1">
          <FilterChoice
            active={!props.source}
            label="All sellers"
            onClick={() => props.onSource("")}
          />
          {props.sources.map(([slug, name]) => (
            <FilterChoice
              key={slug}
              active={props.source === slug}
              label={name}
              onClick={() => props.onSource(slug)}
            />
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={() => props.onSavedOnly(!props.savedOnly)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold text-stone-600",
          props.savedOnly && "bg-stone-900 text-white"
        )}
        aria-pressed={props.savedOnly}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" /> Saved selections
      </button>
    </div>
  );
}

function FilterRail(props: FilterProps) {
  return (
    <aside
      className="hidden border-r border-stone-200 bg-[var(--bidrock-rail)] p-4 lg:block"
      aria-label="Market filters"
    >
      <div className="sticky top-20">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters
        </div>
        <FilterControls {...props} />
      </div>
    </aside>
  );
}

function MobileFilters(props: FilterProps) {
  return (
    <details className="border-b border-stone-200 bg-[var(--bidrock-rail)] lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-stone-800">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Search and filters
        </span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="border-t border-stone-200 p-4">
        <FilterControls {...props} />
      </div>
    </details>
  );
}

function FilterChoice({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full rounded-md px-2 py-1.5 text-left text-xs capitalize text-stone-600 hover:bg-white hover:text-stone-950",
        active && "bg-white font-bold text-stone-950"
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function BidRockCompareDialog({
  open,
  onOpenChange,
  listings,
  verifiedBusiness,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: readonly BidRockListing[];
  verifiedBusiness: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto border-stone-200 bg-white text-stone-950">
        <DialogHeader>
          <DialogTitle>Compare physical lots</DialogTitle>
          <DialogDescription className="text-stone-500">
            Compare confirmed dimensions, quantity, finish evidence, and seller source.
          </DialogDescription>
        </DialogHeader>
        {listings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="p-3 text-xs text-stone-500">Field</th>
                  {listings.map((listing) => (
                    <th key={listing.id} className="p-3 font-bold text-stone-900">
                      {listing.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                <CompareRow label="Dimensions" values={listings.map(formatBidRockDimensions)} />
                <CompareRow
                  label="Quantity"
                  values={listings.map((listing) => `${listing.quantity} ${listing.unit}`)}
                />
                <CompareRow
                  label="Seller"
                  values={listings.map((listing) => listing.sourceProfileName)}
                />
                <CompareRow
                  label="Known finish"
                  values={listings.map((listing) =>
                    listing.finishQuantities.length
                      ? listing.finishQuantities
                          .map((finish) => `${finish.slabCount} ${finish.finish}`)
                          .join(", ")
                      : "Pending"
                  )}
                />
                {verifiedBusiness ? (
                  <CompareRow
                    label="Seller price"
                    values={listings.map((listing) =>
                      listing.privatePrice ? formatBidRockPrice(listing.privatePrice) : "Not set"
                    )}
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-sm text-stone-500">Choose up to three lots from the market.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompareRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <tr>
      <th className="p-3 text-left text-xs font-semibold text-stone-500">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="p-3 text-stone-800">
          {value}
        </td>
      ))}
    </tr>
  );
}
