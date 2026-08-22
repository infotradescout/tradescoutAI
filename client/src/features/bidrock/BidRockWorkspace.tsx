import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Building2,
  ChevronDown,
  Clock3,
  Gavel,
  GitCompareArrows,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import type { BidRockListing } from "@shared/bidrock";
import { BIDROCK_DEFAULT_PROFILE_SLUG, formatBidRockMoney } from "@shared/bidrock";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { cn } from "@/lib/utils";
import {
  cancelBidRockOrder,
  closeExpiredBidRockAuctions,
  completeBidRockOrder,
  configureBidRockAuction,
  expireBidRockHolds,
  importBidRockConfirmedStock,
  linkBidRockOrderSystems,
  loadBidRockCatalog,
  loadBidRockOrder,
  loadBidRockOrders,
  loadBidRockProviderAssignments,
  loadBidRockSellerInventory,
  markBidRockPaymentReady,
  placeBidRockMaximum,
  projectBidRockInventory,
  recordBidRockHandoff,
  setBidRockDelegation,
  setBidRockPublication,
  setBidRockSaved,
  settleBidRockAch,
  type BidRockOrder,
  type BidRockProviderAssignment,
} from "./bidrockClient";
import { BidRockDetailPanel } from "./BidRockDetailPanel";
import {
  BidRockListingRow,
  formatBidRockAssetKind,
  formatBidRockDimensions,
} from "./BidRockListingRow";
import { BidRockAdminPanel } from "./BidRockOperationsPanels";
import { BidRockOrderSheet } from "./BidRockOrderSheet";
import "./bidrock-theme.css";

const GUEST_SAVES_KEY = "bidrock:saved:v1";
const MAX_COMPARE = 3;
const CLOSING_SOON_MILLISECONDS = 24 * 60 * 60 * 1_000;

type WorkspaceTab = "market" | "seller" | "orders" | "provider" | "admin";

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
  return [
    listing.auction?.lotNumber,
    listing.title,
    listing.materialFamily,
    listing.sourceProfileName,
    listing.materialSlug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function nextIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `bidrock-${Date.now()}-${Math.random()}`;
}

export default function BidRockWorkspace() {
  const { user, isAuthenticated } = useAuth();
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
  const viewerCacheScope = isAuthenticated ? `user:${user?.id || "pending"}` : "guest";

  const withStableRetryKey = async (
    semanticKey: string,
    mutation: (idempotencyKey: string) => Promise<void>
  ) => {
    const idempotencyKey = retryKeys.current.get(semanticKey) ?? nextIdempotencyKey();
    retryKeys.current.set(semanticKey, idempotencyKey);
    await mutation(idempotencyKey);
    retryKeys.current.delete(semanticKey);
  };

  const catalogQuery = useQuery({
    queryKey: ["bidrock", "catalog", viewerCacheScope],
    queryFn: loadBidRockCatalog,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const catalog = catalogQuery.data;
  const canSell = catalog?.viewer.canSell === true;
  const canUseOrders = Boolean(
    isAuthenticated &&
    (catalog?.viewer.verifiedBusiness || catalog?.viewer.canSell || catalog?.viewer.admin)
  );
  const canAdmin = catalog?.viewer.admin === true;
  const providerQuery = useQuery({
    queryKey: ["bidrock", "provider-assignments", viewerCacheScope],
    queryFn: loadBidRockProviderAssignments,
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
  const providerAssignments = providerQuery.data ?? [];
  const canUseProvider = providerAssignments.length > 0;
  const sellerQuery = useQuery({
    queryKey: ["bidrock", "seller-inventory", viewerCacheScope],
    queryFn: loadBidRockSellerInventory,
    enabled: tab === "seller" && canSell,
    staleTime: 10_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["bidrock", "orders", viewerCacheScope],
    queryFn: loadBidRockOrders,
    enabled: (tab === "orders" && canUseOrders) || (tab === "admin" && canAdmin),
    staleTime: 10_000,
  });
  const orderQuery = useQuery({
    queryKey: ["bidrock", "order", selectedOrderId, viewerCacheScope],
    queryFn: () => loadBidRockOrder(selectedOrderId as string),
    enabled: Boolean(selectedOrderId),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GUEST_SAVES_KEY, JSON.stringify([...guestSaved]));
    }
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
  const accountProfileSlug =
    selectedListing?.sourceProfileSlug ||
    listings[0]?.sourceProfileSlug ||
    BIDROCK_DEFAULT_PROFILE_SLUG;
  const accountProfileName =
    selectedListing?.sourceProfileName || listings[0]?.sourceProfileName || "BidRock";
  const accountQuery = useQuery({
    queryKey: ["profile-account", accountProfileSlug, viewerCacheScope],
    queryFn: () => loadProfileAccountState(accountProfileSlug, isAuthenticated),
    staleTime: 30_000,
  });
  const comparedListings = compareIds
    .map((id) => listings.find((listing) => listing.id === id))
    .filter((listing): listing is BidRockListing => Boolean(listing));
  const groupingNow = Date.parse(catalog?.generatedAt || "") || Date.now();
  const liveListings = filteredListings.filter((listing) =>
    ["live", "extended"].includes(listing.auction?.status || "")
  );
  const closingSoon = liveListings.filter(
    (listing) =>
      Date.parse(listing.auction?.endsAt || "") - groupingNow <= CLOSING_SOON_MILLISECONDS
  );
  const liveLater = liveListings.filter((listing) => !closingSoon.includes(listing));
  const scheduled = filteredListings.filter((listing) => listing.auction?.status === "scheduled");
  const results = filteredListings.filter((listing) =>
    ["sold", "no_sale", "ended"].includes(listing.auction?.status || "")
  );
  const totalBidCount = filteredListings.reduce(
    (total, listing) => total + (listing.auction?.bidCount ?? 0),
    0
  );
  const sellerCount = new Set(filteredListings.map((listing) => listing.sourceProfileSlug)).size;
  const accountActionLabel = accountQuery.data
    ? profileAccountActionLabel(accountQuery.data)
    : isAuthenticated
      ? "Business access"
      : "Sign in to bid";

  const reportFailure = (error: unknown, title: string) => {
    toast({
      title,
      description: formatUserFacingErrorMessage(error, "Please try again."),
      variant: "destructive",
    });
  };

  const refreshBidRock = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bidrock", "catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "seller-inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "orders"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "order"] }),
      queryClient.invalidateQueries({ queryKey: ["bidrock", "provider-assignments"] }),
    ]);
  };

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    setBusy(true);
    try {
      await action();
      await refreshBidRock();
      toast({ title: success });
      return true;
    } catch (error) {
      reportFailure(error, failure);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const placeMaximumBid = async (listing: BidRockListing, maximumBid: string) => {
    if (!listing.auction) return;
    const auctionId = listing.auction.id;
    setBusy(true);
    try {
      await withStableRetryKey(`bid:${auctionId}:${maximumBid}`, (idempotencyKey) =>
        placeBidRockMaximum({
          auctionId,
          maximumBid,
          idempotencyKey,
        }).then(() => undefined)
      );
      await refreshBidRock();
      toast({ title: "Maximum bid placed" });
    } catch (error) {
      reportFailure(error, "Bid could not be placed");
      throw error;
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
      nextSaved ? "Lot saved" : "Saved lot removed",
      "Saved lot could not be updated"
    );
  };

  const selectMarketListing = (listingId: string) => {
    setSelectedMarketId(listingId);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  };

  const detailProps = {
    listing: selectedListing,
    verifiedBusiness: catalog?.viewer.verifiedBusiness === true,
    compared: selectedListing ? compareIds.includes(selectedListing.id) : false,
    saved: selectedListing ? isSaved(selectedListing) : false,
    submittingBid: busy,
    onCompare: () => selectedListing && toggleCompare(selectedListing.id),
    onSave: () => selectedListing && void toggleSaved(selectedListing),
    onOpenAccount: () => setAccountOpen(true),
    onPlaceBid: async (maximumBid: string) => {
      if (selectedListing) await placeMaximumBid(selectedListing, maximumBid);
    },
  };
  const sellerListings = sellerQuery.data ?? [];
  const orders = ordersQuery.data ?? [];

  return (
    <div
      className="bidrock-theme min-h-screen bg-[var(--bidrock-canvas)] text-[var(--bidrock-ink)]"
      data-testid="bidrock-workspace"
    >
      <SEOHelmet
        title="BidRock | Business Stone Auctions"
        description="Timed business auctions for exact natural and engineered stone lots."
        canonical="https://www.thetradescout.com/bidrock"
      />
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-[var(--bidrock-auction-deep)] px-4 text-white sm:px-6">
        <a
          href="/bidrock"
          className="flex min-w-0 items-center gap-3"
          aria-label="BidRock auctions home"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--bidrock-auction)]">
            <Gavel className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-black tracking-tight">BidRock</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">
              B2B stone auctions
            </span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {catalog?.viewer.verifiedBusiness ? (
            <Badge className="hidden border-emerald-400/20 bg-emerald-400/10 text-emerald-100 sm:inline-flex">
              <Building2 className="mr-1 h-3 w-3" aria-hidden="true" /> Verified bidder
            </Badge>
          ) : (
            <Badge className="hidden border-white/15 bg-white/5 text-white/75 sm:inline-flex">
              Bid values private
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setAccountOpen(true)}
            className="border-white/20 bg-transparent px-3 text-xs text-white hover:bg-white/10 hover:text-white sm:text-sm"
          >
            {accountActionLabel}
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
        <div className="border-b border-stone-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--bidrock-auction)]">
                Business-only stone auction house
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                Natural and engineered stone on the block
              </h1>
              <p className="mt-1.5 text-xs leading-5 text-stone-600 sm:text-sm">
                Exact slabs, bundles, blocks, and containers. Business verification is required to
                participate.
              </p>
            </div>
            <TabsList className="max-w-full justify-start overflow-x-auto border-stone-200 bg-stone-100 text-stone-600">
              <TabsTrigger value="market">Auction floor</TabsTrigger>
              {canSell ? <TabsTrigger value="seller">Seller controls</TabsTrigger> : null}
              {canUseOrders ? <TabsTrigger value="orders">Orders</TabsTrigger> : null}
              {canUseProvider ? (
                <TabsTrigger value="provider">Assigned handoffs</TabsTrigger>
              ) : null}
              {canAdmin ? <TabsTrigger value="admin">Operations</TabsTrigger> : null}
            </TabsList>
          </div>
          <div className="grid grid-cols-2 bg-stone-950 text-white sm:grid-cols-4">
            <AuctionHouseStat label="Live now" value={String(liveListings.length)} live />
            <AuctionHouseStat label="Closing within 24h" value={String(closingSoon.length)} />
            <AuctionHouseStat label="Upcoming" value={String(scheduled.length)} />
            <AuctionHouseStat label="Auction sellers" value={String(sellerCount)} />
          </div>
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
          <div className="grid min-h-[calc(100vh-133px)] lg:grid-cols-[210px_minmax(0,1fr)_380px]">
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
            <main className="min-w-0 border-r border-stone-200 bg-[var(--bidrock-auction-workspace)]">
              <div className="flex min-h-11 items-center justify-between gap-3 border-b border-stone-200 bg-white/70 px-4 text-xs text-stone-600">
                <span>
                  {filteredListings.length} timed {filteredListings.length === 1 ? "lot" : "lots"}
                  {totalBidCount > 0
                    ? ` · ${totalBidCount} ${totalBidCount === 1 ? "bid" : "bids"}`
                    : ""}
                </span>
                {compareIds.length ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setCompareOpen(true)}
                    className="h-8 text-stone-700 hover:bg-stone-100 hover:text-stone-950 focus-visible:ring-[var(--bidrock-auction)]"
                  >
                    <GitCompareArrows aria-hidden="true" /> Compare {compareIds.length}
                  </Button>
                ) : null}
              </div>
              {catalogQuery.isLoading ? (
                <div
                  className="grid gap-4 p-4 md:grid-cols-2"
                  aria-label="Loading live stone auctions"
                >
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="aspect-[4/5] animate-pulse rounded-xl bg-white/80" />
                  ))}
                </div>
              ) : catalogQuery.isError ? (
                <div className="p-10 text-center">
                  <p className="font-semibold text-stone-900">
                    BidRock auctions could not be loaded.
                  </p>
                  <Button
                    type="button"
                    onClick={() => void catalogQuery.refetch()}
                    className="mt-4 bg-[var(--bidrock-auction)] text-white hover:bg-[var(--bidrock-auction-hover)]"
                  >
                    Try again
                  </Button>
                </div>
              ) : filteredListings.length ? (
                <div className="space-y-7 p-4 sm:p-5">
                  <AuctionGroup
                    title="Closing soon"
                    description="Live lots closing within 24 hours. Bids in the final two minutes extend the close."
                    listings={closingSoon}
                    selectedListing={selectedListing}
                    compareIds={compareIds}
                    isSaved={isSaved}
                    onSelect={selectMarketListing}
                    onCompare={toggleCompare}
                    onSave={(listing) => void toggleSaved(listing)}
                  />
                  <AuctionGroup
                    title="Live auctions"
                    description="Seller-published stone lots accepting verified business bids now."
                    listings={liveLater}
                    selectedListing={selectedListing}
                    compareIds={compareIds}
                    isSaved={isSaved}
                    onSelect={selectMarketListing}
                    onCompare={toggleCompare}
                    onSave={(listing) => void toggleSaved(listing)}
                  />
                  <AuctionGroup
                    title="Upcoming lots"
                    description="Scheduled auctions with published start and end times."
                    listings={scheduled}
                    selectedListing={selectedListing}
                    compareIds={compareIds}
                    isSaved={isSaved}
                    onSelect={selectMarketListing}
                    onCompare={toggleCompare}
                    onSave={(listing) => void toggleSaved(listing)}
                  />
                  <AuctionGroup
                    title="Auction results"
                    description="Closed lots show sold or no-sale outcomes without exposing private maximums."
                    listings={results}
                    selectedListing={selectedListing}
                    compareIds={compareIds}
                    isSaved={isSaved}
                    onSelect={selectMarketListing}
                    onCompare={toggleCompare}
                    onSave={(listing) => void toggleSaved(listing)}
                  />
                </div>
              ) : (
                <div className="mx-auto max-w-xl px-6 py-16 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stone-950 text-white">
                    <Gavel className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-xl font-semibold text-stone-900">
                    {listings.length
                      ? "No auction lots match these filters."
                      : "No seller-published auctions are live."}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    {listings.length
                      ? "Clear a filter to return to the auction floor."
                      : "Confirmed inventory stays private until its seller publishes the opening bid, schedule, and fulfillment terms."}
                  </p>
                </div>
              )}
            </main>
            <div className="hidden lg:block">
              <BidRockDetailPanel {...detailProps} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seller" className="m-0">
          {sellerQuery.isLoading ? (
            <div className="p-10 text-sm text-stone-500">Loading seller lots…</div>
          ) : sellerQuery.isError ? (
            <div className="p-10 text-sm text-stone-500">
              Seller auction controls are unavailable.
            </div>
          ) : (
            <SellerAuctionPanel
              listings={sellerListings}
              selectedId={selectedSellerId}
              busy={busy}
              onSelect={setSelectedSellerId}
              onPublication={async (listingId, saleReady) => {
                await run(
                  () => setBidRockPublication(listingId, saleReady),
                  saleReady ? "Lot made auction-ready" : "Lot returned to private inventory",
                  "Auction-ready state could not be saved"
                );
              }}
              onConfigure={async (args) => {
                await run(
                  () => configureBidRockAuction(args).then(() => undefined),
                  "Timed auction scheduled",
                  "Auction could not be scheduled"
                );
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="orders" className="m-0">
          <OrderQueue
            orders={orders}
            loading={ordersQuery.isLoading}
            error={ordersQuery.isError}
            onOpenOrder={setSelectedOrderId}
          />
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
              orders={orders}
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
              onCloseAuctions={() =>
                run(
                  () => closeExpiredBidRockAuctions().then(() => undefined),
                  "Ended auctions closed",
                  "Auction closure failed"
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
            <SheetTitle>{selectedListing?.title || "BidRock auction lot"}</SheetTitle>
            <SheetDescription>Selected timed lot facts and maximum-bid controls.</SheetDescription>
          </SheetHeader>
          <BidRockDetailPanel {...detailProps} />
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
        profileSlug={accountProfileSlug}
        profileName={accountProfileName}
        tone="light"
        initialState={accountQuery.data ?? null}
        onStateChange={(next: ProfileAccountResponse) => {
          queryClient.setQueryData(["profile-account", accountProfileSlug, viewerCacheScope], next);
          void catalogQuery.refetch();
        }}
      />
    </div>
  );
}

function AuctionHouseStat({
  label,
  value,
  live = false,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="border-b border-r border-white/10 px-4 py-3 last:border-r-0 sm:border-b-0">
      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
        {live ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--bidrock-live)]" aria-hidden="true" />
        ) : null}
        {label}
      </p>
      <p className="mt-0.5 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function AuctionGroup({
  title,
  description,
  listings,
  selectedListing,
  compareIds,
  isSaved,
  onSelect,
  onCompare,
  onSave,
}: {
  title: string;
  description: string;
  listings: readonly BidRockListing[];
  selectedListing: BidRockListing | null;
  compareIds: readonly string[];
  isSaved: (listing: BidRockListing) => boolean;
  onSelect: (listingId: string) => void;
  onCompare: (listingId: string) => void;
  onSave: (listing: BidRockListing) => void;
}) {
  if (!listings.length) return null;
  return (
    <section aria-labelledby={`bidrock-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-3">
        <h2
          id={`bidrock-${title.toLowerCase().replace(/\s+/g, "-")}`}
          className="text-lg font-bold text-stone-950"
        >
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {listings.map((listing) => (
          <BidRockListingRow
            key={listing.id}
            listing={listing}
            selected={selectedListing?.id === listing.id}
            compared={compareIds.includes(listing.id)}
            saved={isSaved(listing)}
            onSelect={() => onSelect(listing.id)}
            onCompare={() => onCompare(listing.id)}
            onSave={() => onSave(listing)}
          />
        ))}
      </div>
    </section>
  );
}

function SellerAuctionPanel({
  listings,
  selectedId,
  busy,
  onSelect,
  onPublication,
  onConfigure,
}: {
  listings: readonly BidRockListing[];
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onPublication: (listingId: string, saleReady: boolean) => Promise<void>;
  onConfigure: (args: {
    listingId: string;
    openingBid: string;
    reserveBid?: string;
    minimumIncrement: string;
    startsAt: string;
    endsAt: string;
    pickupTerms: string;
    freightTerms: string;
  }) => Promise<void>;
}) {
  const selected = listings.find((listing) => listing.id === selectedId) ?? listings[0] ?? null;
  const editor = selected ? (
    <SellerAuctionEditor
      key={selected.id}
      listing={selected}
      busy={busy}
      onPublication={onPublication}
      onConfigure={onConfigure}
    />
  ) : null;
  return (
    <div className="grid min-h-[calc(100vh-133px)] bg-[var(--bidrock-auction-workspace)] lg:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-label="Seller auction lots">
        <div className="border-b border-stone-200 bg-[var(--bidrock-auction-soft)] px-4 py-4 text-[var(--bidrock-auction-soft-ink)]">
          <p className="text-xs font-bold">Seller-controlled auction publication</p>
          <div className="mt-3 grid gap-2 text-[11px] leading-4 sm:grid-cols-3">
            {[
              "Confirm exact physical stock",
              "Mark the lot auction-ready",
              "Publish price, schedule, and terms",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-2"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-950 text-[10px] font-black text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
        {listings.length ? (
          listings.map((listing) => (
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
          ))
        ) : (
          <div className="p-10 text-center">
            <PackageCheck className="mx-auto h-7 w-7 text-stone-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-stone-800">
              No confirmed seller lots are available.
            </p>
          </div>
        )}
      </section>
      <div className="hidden border-l border-stone-200 bg-white lg:block">{editor}</div>
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && onSelect(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto bg-white p-0 text-stone-950 lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selected?.title || "Seller auction controls"}</SheetTitle>
            <SheetDescription>Configure the selected timed stone auction.</SheetDescription>
          </SheetHeader>
          {editor}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function SellerAuctionEditor({
  listing,
  busy,
  onPublication,
  onConfigure,
}: {
  listing: BidRockListing;
  busy: boolean;
  onPublication: (listingId: string, saleReady: boolean) => Promise<void>;
  onConfigure: (args: {
    listingId: string;
    openingBid: string;
    reserveBid?: string;
    minimumIncrement: string;
    startsAt: string;
    endsAt: string;
    pickupTerms: string;
    freightTerms: string;
  }) => Promise<void>;
}) {
  const configuration = listing.auction?.configuration;
  const [openingBid, setOpeningBid] = useState(
    configuration ? (configuration.openingBid.amountCents / 100).toFixed(2) : ""
  );
  const [reserveBid, setReserveBid] = useState(
    configuration?.reserveBid ? (configuration.reserveBid.amountCents / 100).toFixed(2) : ""
  );
  const [minimumIncrement, setMinimumIncrement] = useState(
    configuration ? (configuration.minimumIncrement.amountCents / 100).toFixed(2) : ""
  );
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(configuration?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateTimeLocal(configuration?.endsAt));
  const [pickupTerms, setPickupTerms] = useState(configuration?.pickupTerms || "");
  const [freightTerms, setFreightTerms] = useState(configuration?.freightTerms || "");
  const canPublish = listing.sellerCapabilities?.publish ?? listing.canManage;
  const currentAuction = listing.auction && !["sold", "no_sale"].includes(listing.auction.status);

  return (
    <aside className="p-5 lg:sticky lg:top-[65px] lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bidrock-auction)]">
        Seller control
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-stone-950">{listing.title}</h2>
      <p className="mt-1 text-xs text-stone-500">
        {formatBidRockAssetKind(listing)} · {formatBidRockDimensions(listing)} · {listing.quantity}{" "}
        {listing.unit}
      </p>

      <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-stone-200 p-4">
        <div>
          <p className="text-sm font-bold text-stone-900">Auction-ready stock</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Publication confirms this exact quantity is current and available for a timed auction.
          </p>
        </div>
        <Switch
          checked={listing.saleReady}
          disabled={busy || !listing.fresh || !canPublish || Boolean(currentAuction)}
          onCheckedChange={(checked) => void onPublication(listing.id, checked)}
          aria-label={`Mark ${listing.title} auction-ready`}
        />
      </div>

      {listing.auction ? (
        <section
          className="mt-5 rounded-xl bg-stone-950 p-4 text-white"
          aria-label="Configured auction"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-stone-400">
                {listing.auction.lotNumber}
              </p>
              <p className="mt-1 font-bold capitalize">
                {listing.auction.status.replace(/_/g, " ")}
              </p>
            </div>
            <Gavel className="h-5 w-5 text-stone-300" aria-hidden="true" />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-700 pt-3 text-xs">
            <div>
              <dt className="text-stone-400">Starts</dt>
              <dd className="mt-1">{new Date(listing.auction.startsAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Ends</dt>
              <dd className="mt-1">{new Date(listing.auction.endsAt).toLocaleString()}</dd>
            </div>
            {configuration ? (
              <>
                <div>
                  <dt className="text-stone-400">Opening bid</dt>
                  <dd className="mt-1">{formatBidRockMoney(configuration.openingBid)}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">Increment</dt>
                  <dd className="mt-1">{formatBidRockMoney(configuration.minimumIncrement)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}

      {!listing.auction || listing.auction.status === "no_sale" ? (
        listing.saleReady && canPublish ? (
          <form
            className="mt-5 space-y-4 border-t border-stone-200 pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              void onConfigure({
                listingId: listing.id,
                openingBid,
                reserveBid: reserveBid || undefined,
                minimumIncrement,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                pickupTerms,
                freightTerms,
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-stone-700">
                Opening bid
                <Input
                  value={openingBid}
                  onChange={(event) => setOpeningBid(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1"
                />
              </label>
              <label className="text-xs font-bold text-stone-700">
                Optional reserve
                <Input
                  value={reserveBid}
                  onChange={(event) => setReserveBid(event.target.value)}
                  inputMode="decimal"
                  placeholder="No reserve"
                  className="mt-1"
                />
              </label>
              <label className="col-span-2 text-xs font-bold text-stone-700">
                Minimum increment
                <Input
                  value={minimumIncrement}
                  onChange={(event) => setMinimumIncrement(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1"
                />
              </label>
              <label className="text-xs font-bold text-stone-700">
                Starts
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="text-xs font-bold text-stone-700">
                Ends
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className="mt-1"
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-stone-700">
              Pickup terms
              <Textarea
                value={pickupTerms}
                onChange={(event) => setPickupTerms(event.target.value)}
                className="mt-1 min-h-20"
              />
            </label>
            <label className="block text-xs font-bold text-stone-700">
              Freight terms
              <Textarea
                value={freightTerms}
                onChange={(event) => setFreightTerms(event.target.value)}
                className="mt-1 min-h-20"
              />
            </label>
            <Button
              type="submit"
              disabled={
                busy ||
                !openingBid ||
                !minimumIncrement ||
                !startsAt ||
                !endsAt ||
                !pickupTerms.trim() ||
                !freightTerms.trim()
              }
              className="w-full bg-[var(--bidrock-auction)] text-white hover:bg-[var(--bidrock-auction-hover)]"
            >
              <Clock3 aria-hidden="true" />
              {listing.auction?.status === "no_sale"
                ? "Relist timed auction"
                : "Schedule timed auction"}
            </Button>
          </form>
        ) : (
          <p className="mt-5 rounded-lg bg-stone-100 p-4 text-sm text-stone-600">
            {canPublish
              ? "Make the confirmed lot auction-ready before setting its auction terms."
              : "This delegation does not include auction publication authority."}
          </p>
        )
      ) : null}
    </aside>
  );
}

function OrderQueue({
  orders,
  loading,
  error,
  onOpenOrder,
}: {
  orders: readonly BidRockOrder[];
  loading: boolean;
  error: boolean;
  onOpenOrder: (orderId: string) => void;
}) {
  if (loading) return <div className="p-10 text-sm text-stone-500">Loading auction orders…</div>;
  if (error)
    return <div className="p-10 text-sm text-stone-500">Auction orders are unavailable.</div>;
  return (
    <section className="mx-auto max-w-4xl p-4 sm:p-6" aria-label="Auction orders">
      <h2 className="text-xl font-semibold text-stone-950">Won and sold lots</h2>
      <p className="mt-1 text-sm text-stone-500">
        Reserve-met auctions continue through the existing ACH-only order and logistics path.
      </p>
      {orders.length ? (
        <div className="mt-5 divide-y divide-stone-200 border-y border-stone-200 bg-white">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-stone-950">{order.id}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {order.quantity} slabs ·{" "}
                  {(order.subtotalCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}{" "}
                  · ACH
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {order.status.replace(/_/g, " ")}
                </Badge>
                <Button type="button" variant="outline" onClick={() => onOpenOrder(order.id)}>
                  Open order
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 border-y border-stone-200 bg-white p-6 text-sm text-stone-500">
          No auction orders yet.
        </p>
      )}
    </section>
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
      <h2 className="text-xl font-semibold text-stone-950">Assigned handoffs</h2>
      <p className="mt-1 text-sm text-stone-500">
        Only the lot reference and assigned handoff scope are shown.
      </p>
      <div className="mt-5 divide-y divide-stone-200 border-y border-stone-200 bg-white">
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
                    aria-disabled={!action.enabled}
                    title={action.disabledReason ?? undefined}
                  >
                    {action.handoffType.replace(/_/g, " ")} · {action.nextStatus.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenOrder(assignment.orderReference)}
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
        Search auctions
        <span className="relative mt-2 block">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Lot, stone, or seller"
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
        <Bookmark className="h-4 w-4" aria-hidden="true" /> Watched lots
      </button>
    </div>
  );
}

function FilterRail(props: FilterProps) {
  return (
    <aside
      className="hidden border-r border-stone-200 bg-[var(--bidrock-auction-rail)] p-4 lg:block"
      aria-label="Auction filters"
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
    <details className="border-b border-stone-200 bg-[var(--bidrock-auction-rail)] lg:hidden">
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
          <DialogTitle className="text-stone-950">Compare auction lots</DialogTitle>
          <DialogDescription className="text-stone-500">
            Compare physical facts, fulfillment terms, activity, reserve state, and time remaining.
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
                      {listing.auction?.lotNumber} · {listing.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                <CompareRow label="Lot type" values={listings.map(formatBidRockAssetKind)} />
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
                  label="Finish"
                  values={listings.map((listing) =>
                    listing.finishQuantities.length
                      ? listing.finishQuantities
                          .map((finish) => `${finish.slabCount} ${finish.finish}`)
                          .join(", ")
                      : "Pending"
                  )}
                />
                <CompareRow
                  label="Activity"
                  values={listings.map((listing) => {
                    const bidCount = listing.auction?.bidCount ?? 0;
                    return `${bidCount} ${bidCount === 1 ? "bid" : "bids"} · ${listing.auction?.reserveState.replace(/_/g, " ") ?? "Unknown"}`;
                  })}
                />
                <CompareRow
                  label="Pickup"
                  values={listings.map((listing) => listing.auction?.pickupTerms || "Pending")}
                />
                <CompareRow
                  label="Freight"
                  values={listings.map((listing) => listing.auction?.freightTerms || "Pending")}
                />
                {verifiedBusiness ? (
                  <CompareRow
                    label="Current bid"
                    values={listings.map((listing) =>
                      listing.auction?.currentBid
                        ? formatBidRockMoney(listing.auction.currentBid)
                        : "No bid"
                    )}
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-sm text-stone-500">Choose up to three auction lots.</p>
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
