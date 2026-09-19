import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { z } from "zod";
import {
  JW_STONE_CART_REVIEW_PATH,
  JW_STONE_CART_REVIEW_MAX_LINES,
  jwStoneCartReviewRequestSchema,
  jwStoneInventoryPublicIdSchema,
  parseJwStoneCartReview,
  type JwStoneCartSelection,
} from "@shared/jwStoneCart";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { isJwStoneBundleEligible } from "@shared/jwStoneBundle";
import {
  JW_STONE_CART_HOLD_PATH,
  jwStoneCartHoldIdSchema,
  jwStoneCartHoldRequestSchema,
} from "@shared/jwStoneCartHolds";
import { parseJwStoneCartHoldRecovery } from "@shared/jwStoneCartHoldRecovery";
import {
  JW_STONE_CART_HOLD_MINUTES,
  JW_STONE_CART_HOLD_PATH,
  jwStoneCartHoldReceiptSchema,
  jwStoneCartHoldRequestSchema,
  parseJwStoneCartHoldRecovery,
} from "@shared/jwStoneCartHolds";
import { JwStoneBundleBuilder } from "./JwStoneBundleBuilder";
import type { JwStoneOfferContext } from "@shared/jwStoneOffer";
import { normalizePublicStoneInventoryImageUrls } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { JW_STONE_BRAND_STYLE } from "./brand";
import { JW_STONE_CATALOG } from "./catalog";
import {
  JwStoneFulfillmentDetailsFields,
  useJwStoneFulfillmentDetails,
} from "./JwStoneFulfillmentDetails";
import {
  JW_CART_QUOTE_MESSAGE_LIMIT,
  fulfillmentDetailsError,
  fulfillmentDetailsSummary,
} from "./fulfillmentDetails";

const stockSchema = z.object({
  id: jwStoneInventoryPublicIdSchema,
  materialName: z.string().min(1).max(160),
  quantity: z.number().positive(),
  unit: z.string().max(40),
  assetKind: z.string().max(40),
  dimensions: z
    .object({
      length: z.number().positive().nullable().optional(),
      height: z.number().positive().nullable().optional(),
      thickness: z.number().positive().nullable().optional(),
      unit: z.enum(["in", "mm"]).nullable().optional(),
    })
    .nullable(),
  imageUrls: z.array(z.string()).max(12),
  finishQuantities: z
    .array(z.object({ finish: z.string().max(80), slabCount: z.number().positive() }))
    .max(12),
});
type StockItem = z.infer<typeof stockSchema>;
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const preferencesSchema = z.object({
  method: z.enum(["pickup", "delivery"]),
  postalCode: z.string().max(10),
  jobReference: z.string().max(100),
});
const emptyPreferences = { method: "pickup" as const, postalCode: "", jobReference: "" };
const preferencesKey = (viewerId: string) => `tradescout:jw-stone:cart-fulfillment:v1:${viewerId}`;
const holdOperationKey = (viewerId: string) => `tradescout:jw-stone:cart-hold-operation:v1:${viewerId}`;
const holdOperationSchema = z.object({
  fingerprint: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});
const holdReceiptSchema = z
  .object({
    reservationId: jwStoneCartHoldIdSchema,
    status: z.enum(["active", "released", "expired"]),
    expiresAt: z.string().datetime(),
    serverTime: z.string().datetime(),
    materialSubtotalCents: z.number().int().positive(),
    paymentStatus: z.literal("not_started"),
    readyForCheckout: z.literal(false),
    lines: z
      .array(
        z.object({
          inventoryPublicId: jwStoneInventoryPublicIdSchema,
          materialName: z.string().min(1).max(180),
          quantity: z.number().int().positive(),
        })
      )
      .min(1),
  })
  .passthrough();

function newHoldOperationId(): string {
  return window.crypto.randomUUID();
}

function getOrCreateHoldOperation(viewerId: string, fingerprint: string): string {
  try {
    const parsed = holdOperationSchema.safeParse(
      JSON.parse(window.localStorage.getItem(holdOperationKey(viewerId)) || "null")
    );
    if (parsed.success && parsed.data.fingerprint === fingerprint)
      return parsed.data.idempotencyKey;
    const next = { fingerprint, idempotencyKey: newHoldOperationId() };
    window.localStorage.setItem(holdOperationKey(viewerId), JSON.stringify(next));
    return next.idempotencyKey;
  } catch {
    return newHoldOperationId();
  }
}

function clearHoldOperation(viewerId: string): void {
  try {
    window.localStorage.removeItem(holdOperationKey(viewerId));
  } catch {
    /* The server receipt still proves the hold when local storage is unavailable. */
  }
}
const holdOperationKey = (viewerId: string) =>
  `tradescout:jw-stone:cart-hold-operation:v1:${viewerId}`;
const holdOperationSchema = z
  .object({ fingerprint: z.string().min(1).max(20_000), operationId: z.string().uuid() })
  .strict();
function loadOrCreateHoldOperation(viewerId: string, fingerprint: string): string {
  try {
    const stored = holdOperationSchema.safeParse(
      JSON.parse(window.sessionStorage.getItem(holdOperationKey(viewerId)) || "null")
    );
    if (stored.success && stored.data.fingerprint === fingerprint) return stored.data.operationId;
  } catch {
    /* A retry remains possible even when session storage is unavailable. */
  }
  const operationId = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(
      holdOperationKey(viewerId),
      JSON.stringify({ fingerprint, operationId })
    );
  } catch {
    /* Keep the in-memory request identity for this attempt. */
  }
  return operationId;
}
function clearHoldOperation(viewerId: string, operationId: string): void {
  try {
    const stored = holdOperationSchema.safeParse(
      JSON.parse(window.sessionStorage.getItem(holdOperationKey(viewerId)) || "null")
    );
    if (stored.success && stored.data.operationId === operationId)
      window.sessionStorage.removeItem(holdOperationKey(viewerId));
  } catch {
    /* Nothing to clear. */
  }
}
function loadPreferences(viewerId: string): z.infer<typeof preferencesSchema> {
  try {
    const parsed = preferencesSchema.safeParse(
      JSON.parse(window.localStorage.getItem(preferencesKey(viewerId)) || "null")
    );
    return parsed.success ? parsed.data : emptyPreferences;
  } catch {
    return emptyPreferences;
  }
}
function dimensionsLabel(item: StockItem): string {
  const dimensions = item.dimensions;
  if (!dimensions?.length || !dimensions.height || !dimensions.unit) return "Dimensions needed";
  return `${dimensions.length} × ${dimensions.height}${dimensions.thickness ? ` × ${dimensions.thickness}` : ""} ${dimensions.unit}`;
}
function lineMessage(status: string): string {
  switch (status) {
    case "insufficient_quantity":
      return "Reduce the quantity or ask JW Stone about additional stock.";
    case "dimensions_required":
      return "Exact slab dimensions are needed for a total.";
    case "slab_quantity_required":
      return "JW Stone needs to confirm the slab quantity for this stock item.";
    case "price_unavailable":
      return "Ask JW Stone for pricing on this selection.";
    default:
      return "This stock item is unavailable. Choose another item or request a quote.";
  }
}

export type JwStoneMemberCartProps = {
  viewerId: string;
  items: readonly JwStoneCartSelection[];
  onClose: () => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onStockChange: (id: string, inventoryPublicId: string | undefined) => void;
};

/** Mounted only for the currently authorized JW member; all totals come from the server. */
export function JwStoneMemberCart({
  viewerId,
  items,
  onClose,
  onQuantityChange,
  onStockChange,
}: JwStoneMemberCartProps) {
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState(() => loadPreferences(viewerId));
  const [requestOpen, setRequestOpen] = useState(false);
  const [offerContext, setOfferContext] = useState<JwStoneOfferContext | null>(null);
  const deliveryDetails = useJwStoneFulfillmentDetails(viewerId);
  const fulfillmentError = fulfillmentDetailsError(deliveryDetails.details, preferences.method);
  useEffect(() => {
    try {
      window.localStorage.setItem(preferencesKey(viewerId), JSON.stringify(preferences));
    } catch {
      /* Keep the in-memory draft when storage is unavailable. */
    }
  }, [preferences, viewerId]);

  const inventoryQuery = useQuery({
    queryKey: ["jw-stone", "cart-stock", viewerId],
    queryFn: async ({ signal }) => {
      const response = await apiRequest("/api/u/jw-stone/stone-inventory/current", { signal });
      if (response?.profileSlug !== "jw-stone" || !Array.isArray(response.items))
        throw new Error("Stock details could not be loaded.");
      return response.items.flatMap((raw: unknown) => {
        const item = stockSchema.safeParse(raw);
        return item.success
          ? [
              {
                ...item.data,
                imageUrls: normalizePublicStoneInventoryImageUrls(item.data.imageUrls),
              },
            ]
          : [];
      }) as StockItem[];
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const stock = inventoryQuery.isError ? [] : inventoryQuery.data || [];
  const activeHoldQuery = useQuery({
    queryKey: ["jw-stone", "owned-hold-status", viewerId],
    queryFn: async ({ signal }) => {
      const requestStartedAt = performance.now();
      const recovery = parseJwStoneCartHoldRecovery(
        await apiRequest(`${JW_STONE_CART_HOLD_PATH}/active`, { signal }),
        viewerId
      );
      return { ...recovery, requestStartedAt };
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const activeHold =
    activeHoldQuery.data?.viewerId === viewerId && activeHoldQuery.data.hold?.status === "active"
      ? activeHoldQuery.data.hold
      : null;
  const fulfillment =
    preferences.method === "pickup"
      ? { method: "pickup" as const }
      : { method: "delivery" as const, postalCode: preferences.postalCode.trim() };
  const requestInput = useMemo(
    () => ({
      lines: items.map((item) => ({
        inventoryPublicId: item.inventoryPublicId,
        quantity: item.quantity,
      })),
      fulfillment,
    }),
    [items, preferences.method, preferences.postalCode]
  );
  const parsedRequest = jwStoneCartReviewRequestSchema.safeParse(requestInput);
  const fullySelected = items.length > 0 && items.every((item) => Boolean(item.inventoryPublicId));
  const validDestination =
    preferences.method === "pickup" || /^\d{5}(?:-\d{4})?$/.test(preferences.postalCode.trim());
  const reviewQuery = useQuery({
    queryKey: ["jw-stone", "cart-review", viewerId, requestInput],
    queryFn: async ({ signal }) => {
      const request = jwStoneCartReviewRequestSchema.parse(requestInput);
      const response = await apiRequest(JW_STONE_CART_REVIEW_PATH, {
        method: "POST",
        data: request,
        signal,
      });
      return parseJwStoneCartReview(response, viewerId, request);
    },
    enabled: parsedRequest.success && !requestOpen && !offerContext,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: requestOpen || offerContext ? false : 60_000,
  });
  const review =
    parsedRequest.success && !reviewQuery.isFetching && !reviewQuery.isError
      ? reviewQuery.data
      : undefined;
  const reserveBase =
    review?.materialReady &&
    review.subtotalCents != null &&
    parsedRequest.success &&
    !fulfillmentError
      ? {
          lines: parsedRequest.data.lines,
          expectedSubtotalCents: review.subtotalCents,
          fulfillment,
        }
      : null;
  const reserveMutation = useMutation({
    mutationFn: async () => {
      if (!reserveBase) throw new Error("Recheck the cart before reserving stock.");
      const fingerprint = JSON.stringify(reserveBase);
      const request = jwStoneCartHoldRequestSchema.parse({
        ...reserveBase,
        idempotencyKey: getOrCreateHoldOperation(viewerId, fingerprint),
      });
      const response = holdReceiptSchema.parse(
        await apiRequest(JW_STONE_CART_HOLD_PATH, { method: "POST", data: request })
      );
      if (response.status !== "active")
        throw new Error("The reservation is no longer active. Recheck the cart.");
      return response;
    },
    onSuccess: (receipt) => {
      clearHoldOperation(viewerId);
      queryClient.setQueryData(["jw-stone", "owned-hold-status", viewerId], {
        viewerId,
        hold: {
          reservationId: receipt.reservationId,
          status: receipt.status,
          expiresAt: receipt.expiresAt,
          serverTime: receipt.serverTime,
          totalSlabs: receipt.lines.reduce((sum, line) => sum + line.quantity, 0),
          lines: receipt.lines.map((line) => ({
            inventoryPublicId: line.inventoryPublicId,
            materialName: line.materialName,
            quantity: line.quantity,
          })),
        },
        requestStartedAt: performance.now(),
      });
    },
  });
  useEffect(() => {
    const status = (reviewQuery.error as { status?: number } | null)?.status;
    if (status !== 401 && status !== 403) return;
    queryClient.setQueryData(["jw-stone", "member-pricing", viewerId], null);
    onClose();
  }, [reviewQuery.error, queryClient, viewerId, onClose]);

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (
        !parsedRequest.success ||
        !review?.materialReady ||
        review.subtotalCents == null ||
        fulfillmentError
      ) {
        throw new Error("Recheck current stock, pricing, and fulfillment before reserving.");
      }
      const stableInput = {
        lines: parsedRequest.data.lines,
        fulfillment: parsedRequest.data.fulfillment,
        expectedSubtotalCents: review.subtotalCents,
      };
      const fingerprint = JSON.stringify(stableInput);
      const idempotencyKey = loadOrCreateHoldOperation(viewerId, fingerprint);
      const request = jwStoneCartHoldRequestSchema.parse({ ...stableInput, idempotencyKey });
      try {
        const receipt = jwStoneCartHoldReceiptSchema.parse(
          await apiRequest(JW_STONE_CART_HOLD_PATH, { method: "POST", data: request })
        );
        return { receipt, recoveredHold: null, idempotencyKey };
      } catch (error) {
        // A lost POST response can still mean stock was reserved. Recover by the same
        // stable operation identity before surfacing an uncertain retry to the member.
        try {
          const recovery = parseJwStoneCartHoldRecovery(
            await apiRequest(`${JW_STONE_CART_HOLD_PATH}/operations/${idempotencyKey}`),
            viewerId
          );
          if (recovery.hold) return { receipt: null, recoveredHold: recovery.hold, idempotencyKey };
        } catch {
          // Preserve the original mutation failure when recovery itself is unavailable.
        }
        throw error;
      }
    },
    onSuccess: ({ idempotencyKey }) => {
      clearHoldOperation(viewerId, idempotencyKey);
      void queryClient.invalidateQueries({
        queryKey: ["jw-stone", "owned-hold-status", viewerId],
      });
      onClose();
    },
  });

  const requestSelections = items
    .flatMap((item) => {
      const catalog = JW_STONE_CATALOG.find(
        (entry) =>
          entry.wishlistEligible &&
          !entry.anonymous &&
          jwStonePriceKey(entry.displayName) === item.stoneKey
      );
      return catalog?.displayName ? [{ itemId: catalog.id, itemName: catalog.displayName }] : [];
    })
    .filter((item, index, all) => all.findIndex((other) => other.itemId === item.itemId) === index);
  const requestMessage = [
    "JW Stone slab cart — quote request only; no order or inventory hold.",
    ...(preferences.jobReference.trim() ? [`Job / PO: ${preferences.jobReference.trim()}`] : []),
    ...items.map(
      (item) =>
        `${item.quantity} slab(s): ${item.stoneName}${item.inventoryPublicId ? ` — stock ${item.inventoryPublicId}` : " — select exact stock with JW Stone"}`
    ),
    preferences.method === "delivery"
      ? `Delivery requested to ZIP ${preferences.postalCode.trim()}. Please quote freight and timing.`
      : "Pickup requested. Please confirm pickup readiness and timing.",
    ...fulfillmentDetailsSummary(deliveryDetails.details, preferences.method),
    ...(review?.materialReady && review.subtotalCents != null
      ? [
          `Material subtotal checked ${review.reviewedAt}: ${money(review.subtotalCents)}. Delivery and tax are not included; this is not a final quote.`,
        ]
      : []),
    ...(review?.bundle?.unlocked
      ? [
          "Seven-slab bundle pricing applied to " +
            review.bundle.eligibleSlabs +
            " eligible slabs. Quantity savings versus slab rates: " +
            money(review.bundle.savingsCents ?? 0) +
            ". Please reconfirm when quoting.",
        ]
      : []),
    "Please confirm stock, exact slab measurements, finish, final total, and availability before payment.",
  ].join("\n");
  const canRequest =
    items.length > 0 &&
    items.length <= JW_STONE_CART_REVIEW_MAX_LINES &&
    validDestination &&
    !fulfillmentError &&
    requestMessage.length <= JW_CART_QUOTE_MESSAGE_LIMIT;

  return (
    <>
      <Dialog.Root
        open={!requestOpen && !offerContext}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
          <Dialog.Content
            style={JW_STONE_BRAND_STYLE}
            data-jw-brand="true"
            data-testid="jw-stone-member-cart"
            className="fixed inset-y-0 right-0 z-[71] flex h-[100dvh] w-full max-w-md flex-col bg-[var(--jw-surface)] text-[var(--jw-ink)] shadow-2xl focus:outline-none"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--jw-border)] px-5 py-4">
              <div>
                <Dialog.Title className="text-xl font-semibold">Slab cart</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-[var(--jw-muted)]">
                  JW Stone business members · Saved on this browser
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="inline-flex min-h-11 min-w-11 items-center justify-center"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <JwStoneBundleBuilder
                review={review}
                empty={items.length === 0}
                checking={reviewQuery.isFetching}
                onBrowse={onClose}
              />
              {items.length === 0 ? (
                <div className="border border-dashed border-[var(--jw-border)] p-6 text-center">
                  <ShoppingCart className="mx-auto h-6 w-6" aria-hidden="true" />
                  <p className="mt-3 font-semibold">Your cart is empty</p>
                  <p className="mt-2 text-sm text-[var(--jw-muted)]">
                    Add stone selections to compare stock and request a quote.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {inventoryQuery.isError ? (
                    <div role="status" className="text-sm">
                      Stock details could not be loaded. Your selections are saved.{" "}
                      <button
                        type="button"
                        onClick={() => void inventoryQuery.refetch()}
                        className="min-h-11 underline"
                      >
                        Try again
                      </button>
                    </div>
                  ) : null}
                  {items.map((item) => {
                    const actualStock = stock.find((entry) => entry.id === item.inventoryPublicId);
                    const candidates = stock.filter(
                      (entry) => jwStonePriceKey(entry.materialName) === item.stoneKey
                    );
                    const checked = review?.lines.find(
                      (line) => line.inventoryPublicId === item.inventoryPublicId
                    );
                    const image = actualStock?.imageUrls[0];
                    const ownedReservationLine = activeHold?.lines.find(
                      (line) => line.inventoryPublicId === item.inventoryPublicId
                    );
                    const remaining = review?.bundle?.remainingSlabs ?? 0;
                    const canCompleteBundle =
                      review?.materialReady &&
                      checked?.status === "ready" &&
                      checked.bundlePricing &&
                      isJwStoneBundleEligible(checked.bundlePricing) &&
                      remaining > 0 &&
                      checked.availableQuantity >= checked.requestedQuantity + remaining &&
                      checked.requestedQuantity + remaining <= 999 &&
                      item.quantity + remaining <= 999;
                    return (
                      <article
                        key={item.id}
                        className="border border-[var(--jw-border)] p-4"
                        data-testid="jw-cart-line"
                      >
                        <div className="flex items-start gap-3">
                          {image ? (
                            <img
                              src={image}
                              alt={actualStock.materialName}
                              className="h-16 w-20 shrink-0 object-contain"
                              loading="lazy"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold">
                              {actualStock?.materialName || item.stoneName}
                            </h3>
                            {actualStock ? (
                              <p className="mt-1 text-xs text-[var(--jw-muted)]">
                                {dimensionsLabel(actualStock)}
                                {actualStock.finishQuantities.length
                                  ? ` · ${actualStock.finishQuantities.map((finish) => finish.finish).join(" / ")}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => onQuantityChange(item.id, 0)}
                            aria-label={`Remove ${item.stoneName} from cart`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <label className="mt-3 block text-xs">
                          Stock selection
                          <select
                            aria-label={`Stock for ${item.stoneName}`}
                            value={item.inventoryPublicId || ""}
                            onChange={(event) =>
                              onStockChange(item.id, event.target.value || undefined)
                            }
                            className="mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-2 text-sm text-[var(--jw-ink)]"
                          >
                            <option value="">Choose exact stock</option>
                            {item.inventoryPublicId &&
                            !candidates.some((entry) => entry.id === item.inventoryPublicId) ? (
                              <option value={item.inventoryPublicId}>
                                {inventoryQuery.isLoading
                                  ? "Loading stock…"
                                  : "Previously selected stock"}
                              </option>
                            ) : null}
                            {candidates.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.id.slice(-8)} · {dimensionsLabel(entry)} · {entry.quantity}{" "}
                                {entry.unit}
                              </option>
                            ))}
                          </select>
                        </label>
                        {item.inventoryPublicId ? (
                          <p className="mt-1 break-all text-[10px] text-[var(--jw-muted)]">
                            Stock ID: {item.inventoryPublicId}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--jw-muted)]">
                            Choose stock for a checked total, or ask JW Stone to match this
                            selection.
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center border border-[var(--jw-border)]">
                            <button
                              type="button"
                              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                              className="min-h-11 min-w-11"
                              aria-label={`Decrease ${item.stoneName} quantity`}
                            >
                              <Minus className="mx-auto h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              inputMode="numeric"
                              value={item.quantity}
                              aria-label={`Quantity for ${item.stoneName}`}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (Number.isInteger(value) && value >= 1 && value <= 999)
                                  onQuantityChange(item.id, value);
                              }}
                              className="min-h-11 w-14 bg-[var(--jw-surface)] text-center text-sm text-[var(--jw-ink)]"
                            />
                            <button
                              type="button"
                              disabled={item.quantity >= 999}
                              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                              className="min-h-11 min-w-11 disabled:opacity-40"
                              aria-label={`Increase ${item.stoneName} quantity`}
                            >
                              <Plus className="mx-auto h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-xs text-[var(--jw-muted)]">slabs</span>
                        </div>
                        {ownedReservationLine ? (
                          <p
                            role="status"
                            className="mt-3 text-xs font-semibold"
                            data-testid="jw-cart-owned-reservation-line"
                          >
                            {ownedReservationLine.quantity} slab
                            {ownedReservationLine.quantity === 1 ? "" : "s"} already reserved in
                            your active hold.
                          </p>
                        ) : checked?.status === "ready" ? (
                          <div className="mt-3 text-sm" data-testid="jw-cart-line-total">
                            <strong>{money(checked.oneSlabTotalCents * item.quantity)}</strong>
                            <p className="mt-1 text-xs text-[var(--jw-muted)]">
                              {money(checked.unitRateCents)} / sq. ft. ·{" "}
                              {checked.pricingTier === "bundle"
                                ? "Quantity rate applied"
                                : "Slab rate"}
                            </p>
                          </div>
                        ) : checked ? (
                          <p role="status" className="mt-3 text-xs">
                            {lineMessage(checked.status)}
                            {checked.status === "insufficient_quantity"
                              ? ` ${checked.availableQuantity} slabs available for the combined selection.`
                              : ""}
                          </p>
                        ) : null}
                        {canCompleteBundle ? (
                          <button
                            type="button"
                            data-testid="jw-bundle-complete-line"
                            onClick={() => onQuantityChange(item.id, item.quantity + remaining)}
                            className="mt-3 min-h-11 w-full border border-[var(--jw-accent)] px-3 text-sm font-semibold"
                          >
                            Add {remaining} more {remaining === 1 ? "slab" : "slabs"} to complete
                            bundle
                          </button>
                        ) : null}
                        {checked?.status === "ready" &&
                        checked.bundlePricing &&
                        !isJwStoneBundleEligible(checked.bundlePricing) ? (
                          <p className="mt-2 text-xs text-[var(--jw-muted)]">
                            This material does not count toward the 7-slab bundle. Its listed
                            pricing still applies.
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                  <fieldset className="border border-[var(--jw-border)] p-4">
                    <legend className="px-1 text-sm font-semibold">Pickup or delivery</legend>
                    <div className="flex gap-5">
                      {(["pickup", "delivery"] as const).map((method) => (
                        <label
                          key={method}
                          className="inline-flex min-h-11 items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name="jw-cart-fulfillment"
                            value={method}
                            checked={preferences.method === method}
                            onChange={() => setPreferences((current) => ({ ...current, method }))}
                          />
                          {method === "pickup" ? "Pickup" : "Delivery"}
                        </label>
                      ))}
                    </div>
                    {preferences.method === "delivery" ? (
                      <label className="mt-2 block text-sm">
                        Delivery ZIP
                        <input
                          autoComplete="postal-code"
                          inputMode="numeric"
                          maxLength={10}
                          value={preferences.postalCode}
                          onChange={(event) =>
                            setPreferences((current) => ({
                              ...current,
                              postalCode: event.target.value,
                            }))
                          }
                          className="mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-3 text-[var(--jw-ink)]"
                        />
                        <span className="mt-2 block text-xs text-[var(--jw-muted)]">
                          JW Stone will quote delivery cost and timing. No delivery charge has been
                          added.
                        </span>
                      </label>
                    ) : (
                      <p className="text-xs text-[var(--jw-muted)]">
                        Pickup timing is arranged with JW Stone.
                      </p>
                    )}
                    <JwStoneFulfillmentDetailsFields
                      method={preferences.method}
                      details={deliveryDetails.details}
                      onChange={deliveryDetails.update}
                      storageError={deliveryDetails.storageError}
                    />
                    <label className="mt-4 block text-sm">
                      Job / PO reference <span className="text-[var(--jw-muted)]">(optional)</span>
                      <input
                        maxLength={100}
                        value={preferences.jobReference}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            jobReference: event.target.value,
                          }))
                        }
                        className="mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-3 text-[var(--jw-ink)]"
                      />
                    </label>
                  </fieldset>
                </div>
              )}
            </div>
            <div className="border-t border-[var(--jw-border)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div role="status" aria-live="polite" className="text-sm">
                {review?.materialReady && review.subtotalCents != null ? (
                  <div
                    className="flex justify-between gap-4"
                    data-testid="jw-cart-reviewed-subtotal"
                  >
                    <span>Material subtotal</span>
                    <strong>{money(review.subtotalCents)}</strong>
                  </div>
                ) : reviewQuery.isFetching ? (
                  "Checking current prices and stock…"
                ) : reviewQuery.isError ? (
                  "The total could not be checked. Your cart is saved; retry or request a quote."
                ) : items.length > JW_STONE_CART_REVIEW_MAX_LINES ? (
                  "Review up to 50 selections at a time."
                ) : items.length && !validDestination ? (
                  "Enter a valid delivery ZIP."
                ) : fullySelected && !parsedRequest.success ? (
                  "Reduce the combined quantity for a stock item to 999 or fewer."
                ) : items.length ? (
                  "A full total will appear after every stock selection is checked."
                ) : null}
              </div>
              {reserveMutation.data ? (
                <div
                  role="status"
                  className="mt-3 border border-[var(--jw-accent)] p-3 text-sm"
                  data-testid="jw-cart-reservation-confirmed"
                >
                  <strong>Stock reserved for 30 minutes.</strong>
                  <p className="mt-1 text-xs">
                    No payment was taken. Reservation {reserveMutation.data.reservationId} expires{" "}
                    {new Date(reserveMutation.data.expiresAt).toLocaleString()}.
                  </p>
                </div>
              ) : null}
              {reserveMutation.isError ? (
                <p role="alert" className="mt-2 text-xs">
                  {reserveMutation.error instanceof Error
                    ? reserveMutation.error.message
                    : "The stock could not be reserved. Your cart is unchanged."}
                </p>
              ) : null}
              {activeHold && !reserveMutation.data ? (
                <p role="status" className="mt-2 text-xs">
                  You already have an active JW Stone reservation. Release it above before
                  reserving another cart.
                </p>
              ) : null}
              {review?.materialReady && review.bundle && (review.bundle.savingsCents ?? 0) > 0 ? (
                <div data-testid="jw-bundle-savings" className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between gap-3 text-[var(--jw-muted)]">
                    <span>Slab-rate subtotal</span>
                    <span>{money(review.bundle.regularSubtotalCents!)}</span>
                  </div>
                  <div className="flex justify-between gap-3 font-semibold">
                    <span>Quantity savings</span>
                    <span>−{money(review.bundle.savingsCents!)}</span>
                  </div>
                </div>
              ) : null}
              {review?.materialReady &&
              review.subtotalCents != null &&
              parsedRequest.success &&
              !fulfillmentError ? (
                <button
                  type="button"
                  data-testid="jw-cart-reserve-stock"
                  disabled={holdMutation.isPending}
                  onClick={() => holdMutation.mutate()}
                  className="mt-3 min-h-11 w-full bg-[var(--jw-accent)] px-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:opacity-40"
                >
                  {holdMutation.isPending
                    ? "Reserving checked stock…"
                    : `Reserve stock for ${JW_STONE_CART_HOLD_MINUTES} minutes`}
                </button>
              ) : null}
              {holdMutation.isError ? (
                <p role="alert" className="mt-2 text-xs">
                  {holdMutation.error instanceof Error
                    ? holdMutation.error.message
                    : "The reservation could not be confirmed. Recheck and retry."}
                </p>
              ) : null}
              {reserveBase ? (
                <button
                  type="button"
                  disabled={
                    reserveMutation.isPending ||
                    Boolean(activeHold) ||
                    reserveMutation.data?.status === "active"
                  }
                  onClick={() => reserveMutation.mutate()}
                  className="mt-3 min-h-11 w-full bg-[var(--jw-accent)] px-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:opacity-40"
                  data-testid="jw-cart-reserve-stock"
                >
                  {reserveMutation.isPending
                    ? "Reserving stock…"
                    : activeHold
                      ? "Active reservation already exists"
                      : "Reserve selected stock for 30 minutes"}
                </button>
              ) : null}
              {review?.materialReady &&
              review.subtotalCents != null &&
              parsedRequest.success &&
              !fulfillmentError ? (
                <button
                  type="button"
                  data-testid="jw-cart-make-offer"
                  disabled={holdMutation.isPending}
                  onClick={() =>
                    setOfferContext({
                      scope: "cart",
                      viewerId,
                      selection: parsedRequest.data,
                      displayedSubtotalCents: review.subtotalCents!,
                    })
                  }
                  className="mt-3 min-h-11 w-full border border-[var(--jw-accent)] px-3 text-sm font-semibold disabled:opacity-40"
                >
                  Make an offer on this cart
                </button>
              ) : null}
              {items.length && fulfillmentError ? (
                <p role="alert" className="mt-2 text-xs">
                  {fulfillmentError}
                </p>
              ) : null}
              {items.length ? (
                <p className="mt-2 text-xs leading-5 text-[var(--jw-muted)]">
                  Delivery and tax are not included. A reservation is a temporary stock hold only;
                  no payment is accepted or started.
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                {parsedRequest.success ? (
                  <button
                    type="button"
                    disabled={reviewQuery.isFetching}
                    onClick={() => void reviewQuery.refetch()}
                    className="min-h-11 flex-1 border border-[var(--jw-border)] px-3 text-sm disabled:opacity-40"
                  >
                    Recheck total
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canRequest}
                  onClick={() => setRequestOpen(true)}
                  className="min-h-11 flex-1 bg-[var(--jw-accent)] px-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:opacity-40"
                  data-testid="jw-cart-request-quote"
                >
                  Request quote
                </button>
              </div>
              {requestMessage.length > JW_CART_QUOTE_MESSAGE_LIMIT ? (
                <p className="mt-2 text-xs">Please split this cart into smaller quote requests.</p>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="mt-2 min-h-11 w-full text-sm underline"
              >
                Continue shopping
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {offerContext ? (
        <ExpressDirectConnectPanel
          open
          onClose={() => setOfferContext(null)}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession
          allowCall={false}
          stayInProfile
          requestMode="materials"
          initialView="request"
          initialRequestType="make_offer"
          jwStoneOffer={offerContext}
          initialMessage={[
            preferences.jobReference.trim() ? "Job / PO: " + preferences.jobReference.trim() : "",
            ...fulfillmentDetailsSummary(deliveryDetails.details, preferences.method),
          ]
            .filter(Boolean)
            .join("\n")}
        />
      ) : null}
      {requestOpen ? (
        <ExpressDirectConnectPanel
          open
          onClose={() => setRequestOpen(false)}
          profileSlug="jw-stone"
          businessName="JW Stone"
          hasViewerSession
          allowCall={false}
          stayInProfile
          requestMode="materials"
          initialView="request"
          initialRequestType="request_material"
          initialStoneSelections={requestSelections}
          initialMessage={requestMessage}
        />
      ) : null}
    </>
  );
}
