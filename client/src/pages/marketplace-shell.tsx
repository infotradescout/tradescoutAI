import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  useLocationContext,
  hasCountyContext,
} from "@/hooks/useLocationContext";
import { MarketplaceShell } from "@/shells/MarketplaceShell";
import type { MarketplaceListing } from "@shared/schema";

type CreateListingPayload = {
  title: string;
  description?: string;
  price: number;
  categoryId?: string;
};

function formatListingPrice(price: MarketplaceListing["price"]): string {
  const numeric =
    typeof price === "number" ? price : Number((price as any) ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0";
  return numeric.toLocaleString();
}

export default function MarketplaceShellPage() {
  const location = useLocationContext();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();

  const stateCode = (location as any).stateCode as string | undefined;
  const county = (location as any).county as string | undefined;
  const countyCommitted = hasCountyContext(location as any);

  const listingsQuery = useQuery<MarketplaceListing[]>({
    queryKey: [
      "/api/marketplace/listings",
      stateCode,
      county,
      categoryFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateCode) params.set("state", stateCode);
      if (county) params.set("county", county);
      // Keep the shell lightweight and bounded
      params.set("limit", "24");
      params.set("offset", "0");
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const raw = await apiRequest(
        "GET",
        `/api/marketplace/listings?${params.toString()}`
      );
      return (raw as MarketplaceListing[]) || [];
    },
    enabled: !!stateCode && !!county && countyCommitted,
  });

  const listings = listingsQuery.data ?? [];

  const createListingMutation = useMutation({
    mutationFn: async (payload: CreateListingPayload) => {
      if (!stateCode || !county) {
        throw new Error(
          "Set your county before posting to the marketplace."
        );
      }

      const body: any = {
        title: payload.title,
        description: payload.description ?? "",
        price: payload.price,
        condition: "good",
        isLocalPickupOnly: true,
        willShip: false,
      };

      if (payload.categoryId) body.categoryId = payload.categoryId;
      body.state = stateCode;
      body.county = county;

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

  return (
    <MarketplaceShell locationOverride={location}>
        <div className="max-w-5xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search listings..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-ts-orange/70"
                data-testid="marketplace-search-input"
              />
              <select
                value={categoryFilter ?? ""}
                onChange={(e) =>
                  setCategoryFilter(e.target.value || undefined)
                }
                className="w-32 rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ts-orange/70"
                data-testid="marketplace-category-filter"
              >
                <option value="">All</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-ts-orange px-3 py-2 text-xs font-semibold text-black hover:bg-ts-orange"
              data-testid="marketplace-create-button"
            >
              + New listing
            </button>
          </div>

          {listingsQuery.isLoading && (
            <div className="py-4 text-center text-white/60">
              Loading listings…
            </div>
          )}

          {listingsQuery.isError && (
            <div className="py-4 text-center text-red-400">
              Failed to load listings. Please try again.
            </div>
          )}

          {!listingsQuery.isLoading &&
            !listingsQuery.isError &&
            listings.length === 0 && (
              <div
                className="py-6 text-center text-white/60"
                data-testid="marketplace-empty-state"
              >
                No listings in your area yet.
              </div>
            )}

          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            data-testid="marketplace-listings-grid"
          >
            {listings.map((listing) => {
              const images = (listing as any).images as string[] | undefined;
              const primaryIndex = (listing as any)
                .primaryImageIndex as number | undefined;
              const thumbnailUrl = images?.length
                ? images[primaryIndex ?? 0] ?? images[0]
                : null;

              const categoryName = (listing as any)
                .categoryName as string | undefined;
              const sellerName = (listing as any)
                .sellerName as string | undefined;

              return (
                <article
                  key={listing.id}
                  className="flex flex-col rounded-xl border border-white/10 bg-black/30 p-3"
                  data-testid="marketplace-listing-card"
                >
                  <div className="flex items-start gap-3">
                    {thumbnailUrl && (
                      <div className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-tsCard">
                        <img
                          src={thumbnailUrl}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {listing.title}
                      </div>
                      {listing.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-white/60">
                          {listing.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                        <span className="font-semibold text-ts-orange">
                          ${formatListingPrice(listing.price)}
                        </span>
                        {categoryName && <span>• {categoryName}</span>}
                        {sellerName && <span>• Seller: {sellerName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                    <span>
                      {listing.state} / {listing.county}
                    </span>
                    <span>
                      {listing.createdAt
                        ? new Date(listing.createdAt as any).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          {isCreateOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
              data-testid="marketplace-create-modal"
            >
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-tsBg p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    New listing
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-xs text-white/60 hover:text-white/70"
                  >
                    Close
                  </button>
                </div>

                <form
                  className="mt-4 space-y-3"
                  onSubmit={handleSubmitCreate}
                >
                  <div>
                    <label className="mb-1 block text-xs text-white/60">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-ts-orange/70"
                      data-testid="marketplace-create-title"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-white/60">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="h-20 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ts-orange/70"
                      data-testid="marketplace-create-description"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-white/60">
                        Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-ts-orange/70"
                        data-testid="marketplace-create-price"
                        required
                      />
                    </div>

                    <div className="w-32">
                      <label className="mb-1 block text-xs text-white/60">
                        Category
                      </label>
                      <select
                        value={formCategoryId ?? ""}
                        onChange={(e) =>
                          setFormCategoryId(e.target.value || undefined)
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ts-orange/70"
                        data-testid="marketplace-create-category"
                      >
                        <option value="">None</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={createListingMutation.isPending}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-ts-orange px-3 py-2 text-xs font-semibold text-black hover:bg-ts-orange disabled:opacity-60"
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
        </div>
    </MarketplaceShell>
  );
}
