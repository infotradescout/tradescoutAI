import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommunityShell } from "@/components/layout/CommunityShell";
import { useNotifications } from "@/hooks/useNotifications";
import { apiRequest } from "@/lib/queryClient";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  state: string;
  county: string;
  createdAt: string;
  sellerId: string;
  sellerName?: string | null;
};

type CreateListingPayload = {
  title: string;
  description?: string;
  price: number;
  categoryId?: string;
};

export default function MarketplacePage() {
  const { unreadCount } = useNotifications();
  const location = useLocationContext();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();

  const stateCode = location.stateCode;
  const county = (location.countyFips || (location as any).county) as
    | string
    | undefined;

  const listingsQuery = useQuery<{ listings: Listing[]}>({
    queryKey: [
      "/api/marketplace/listings",
      stateCode,
      county,
      categoryFilter,
      searchTerm,
    ],
    enabled: Boolean(stateCode && county),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("state", stateCode!);
      params.set("county", county!);
      params.set("limit", "24");
      params.set("offset", "0");
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const countyCommitted = hasCountyContext(location);
      const rawListings = await apiRequest(
        "GET",
        `/api/marketplace/listings?${params.toString()}`
      );

      const listings: Listing[] = (rawListings as any[]).map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description ?? null,
        enabled: hasCountyContext,
        thumbnailUrl: (l.images && Array.isArray(l.images) && l.images[0]) || null,
        categoryName: (l as any).categoryName ?? null,
        state: l.state,
        county: l.county,
        createdAt: l.createdAt,
        sellerId: l.sellerId,
        sellerName: (l as any).sellerName ?? null,
      }));

      return { listings };
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (payload: CreateListingPayload) => {
      const body: any = {
        title: payload.title,
        description: payload.description ?? "",
        price: payload.price,
      };
      if (payload.categoryId) body.categoryId = payload.categoryId;
      if (stateCode) body.state = stateCode;
      if (county) body.county = county;
      body.condition = body.condition ?? "good";
      body.isLocalPickupOnly = true;
      body.willShip = false;

      return apiRequest("POST", "/api/marketplace/listings", body);
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      setFormTitle("");
      setFormDescription("");
      setFormPrice("");
      setFormCategoryId(undefined);

      queryClient.invalidateQueries({
        queryKey: [
          "/api/marketplace/listings",
          stateCode,
          county,
          categoryFilter,
          searchTerm,
        ],
      });
    },
  });

  const listings = listingsQuery.data?.listings ?? [];

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const numericPrice = Number(formPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return;

    createListingMutation.mutate({
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      price: numericPrice,
      categoryId: formCategoryId,
    });
  };

  const countyCommitted = hasCountyContext(location as any);

  return (
    <CommunityShell sectionLabel="For Sale" notificationsCount={unreadCount}>
      <CountyRequiredGate locationOverride={location}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search listings..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/70"
            data-testid="marketplace-search-input"
          />
          <select
            value={categoryFilter ?? ""}
            onChange={(e) =>
              setCategoryFilter(e.target.value || undefined)
            }
            className="w-32 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/70"
            data-testid="marketplace-category-filter"
          >
            <option value="">All</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400"
          data-testid="marketplace-create-button"
        >
          + New listing
        </button>
      </div>

      {listingsQuery.isLoading && (
        <div className="py-8 text-center text-slate-400">
          Loading listings…
        </div>
      )}

      {listingsQuery.isError && (
        <div className="py-8 text-center text-red-400">
          Failed to load listings. Please try again.
        </div>
      )}

      {!listingsQuery.isLoading &&
        !listingsQuery.isError &&
        listings.length === 0 && (
          <div
            className="py-8 text-center text-slate-400"
            data-testid="marketplace-empty-state"
          >
            No listings in your area yet.
          </div>
        )}

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        data-testid="marketplace-listings-grid"
      >
        {listings.map((listing) => (
          <article
            key={listing.id}
            className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3"
            data-testid="marketplace-listing-card"
          >
            <div className="flex items-start gap-3">
              {listing.thumbnailUrl && (
                <div className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-900">
                  <img
                    src={listing.thumbnailUrl}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-50">
                  {listing.title}
                </div>
                {listing.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                    {listing.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-orange-400">
                    ${listing.price.toLocaleString()}
                  </span>
                  {listing.categoryName && (
                    <span>• {listing.categoryName}</span>
                  )}
                  {listing.sellerName && (
                    <span>• Seller: {listing.sellerName}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {listing.state} / {listing.county}
              </span>
              <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
            </div>
          </article>
        )}

        {isCreateOpen && (
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
          data-testid="marketplace-create-modal"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                New listing
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={handleSubmitCreate}
            >
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  data-testid="marketplace-create-title"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="h-20 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  data-testid="marketplace-create-description"
                  required
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-400">
                    Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                    data-testid="marketplace-create-price"
                    required
                  />
                </div>

                <div className="w-32">
                  <label className="mb-1 block text-xs text-slate-400">
                    Category
                  </label>
                  <select
                    value={formCategoryId ?? ""}
                    onChange={(e) =>
                      setFormCategoryId(e.target.value || undefined)
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                    data-testid="marketplace-create-category"
                  >
                    <option value="">None</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={createListingMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
                data-testid="marketplace-create-submit"
              >
                {createListingMutation.isPending
                  ? "Creating…"
                  : "Create listing"}
              </button>
            </form>
          </div>
        </div>
      )}
      </CountyRequiredGate>
    </CommunityShell>
  );
}
