import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import {
  JW_STONE_CART_REVIEW_PATH,
  jwStoneCartReviewRequestSchema,
  jwStoneInventoryPublicIdSchema,
  parseJwStoneCartReview,
} from "@shared/jwStoneCart";
import {
  JW_STONE_OFFER_TERMS,
  jwStoneOfferInputSchema,
  parseJwStoneOfferDollars,
  type JwStoneOfferContext,
  type JwStoneOfferInput,
} from "@shared/jwStoneOffer";

const stockSchema = z.object({
  id: jwStoneInventoryPublicIdSchema,
  materialName: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  dimensions: z
    .object({
      length: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
    })
    .nullable(),
});
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const fieldClass =
  "mt-1 block min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-neutral-900";

/** Collects proposed terms only; all listed amounts come from the member cart-review API. */
export function JwStoneOfferFields({
  context,
  onChange,
}: {
  context: JwStoneOfferContext;
  onChange: (input: JwStoneOfferInput | null) => void;
}) {
  const [stockId, setStockId] = useState(
    context.scope === "stone" ? context.inventoryPublicId || "" : ""
  );
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [postalCode, setPostalCode] = useState("");
  const [amount, setAmount] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const inventory = useQuery({
    queryKey: ["jw-stone", "offer-stock", context.viewerId],
    enabled: context.scope === "stone",
    queryFn: async ({ signal }) => {
      const response = await apiRequest("/api/u/jw-stone/stone-inventory/current", { signal });
      if (response?.profileSlug !== "jw-stone" || !Array.isArray(response.items))
        throw new Error("Stock could not be loaded.");
      return response.items.flatMap((raw: unknown) => {
        const parsed = stockSchema.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      }) as z.infer<typeof stockSchema>[];
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const candidates = (inventory.data || []).filter(
    (item) =>
      context.scope === "stone" &&
      jwStonePriceKey(item.materialName) === jwStonePriceKey(context.stoneName)
  );
  const selection = useMemo(
    () =>
      jwStoneCartReviewRequestSchema.safeParse(
        context.scope === "cart"
          ? context.selection
          : {
              lines: [{ inventoryPublicId: stockId, quantity }],
              fulfillment:
                method === "pickup" ? { method } : { method, postalCode: postalCode.trim() },
            }
      ),
    [context, stockId, quantity, method, postalCode]
  );
  const reviewQuery = useQuery({
    queryKey: [
      "jw-stone",
      "offer-review",
      context.viewerId,
      selection.success ? selection.data : null,
    ],
    enabled: selection.success,
    queryFn: async ({ signal }) => {
      if (!selection.success) throw new Error("Choose stock and quantity first.");
      const response = await apiRequest(JW_STONE_CART_REVIEW_PATH, {
        method: "POST",
        data: selection.data,
        signal,
      });
      return parseJwStoneCartReview(response, context.viewerId, selection.data);
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: 60_000,
  });
  const review =
    selection.success && !reviewQuery.isFetching && !reviewQuery.isError
      ? reviewQuery.data
      : undefined;
  const changedCartTotal =
    context.scope === "cart" &&
    review?.materialReady &&
    review.subtotalCents !== context.displayedSubtotalCents;
  const offeredTotalCents = parseJwStoneOfferDollars(amount);
  useEffect(() => {
    if (
      !selection.success ||
      !review?.materialReady ||
      review.subtotalCents == null ||
      changedCartTotal ||
      !acknowledged ||
      offeredTotalCents == null
    ) {
      onChange(null);
      return;
    }
    const input = jwStoneOfferInputSchema.safeParse({
      scope: context.scope,
      selection: selection.data,
      offeredTotalCents,
      expectedSubtotalCents: review.subtotalCents,
      termsAcknowledged: true,
    });
    onChange(input.success ? input.data : null);
    return () => onChange(null);
  }, [
    selection,
    review,
    changedCartTotal,
    acknowledged,
    offeredTotalCents,
    context.scope,
    onChange,
  ]);
  return (
    <section
      className="space-y-3 rounded-xl border border-black/15 bg-white p-4"
      aria-label="Offer details"
    >
      {context.scope === "stone" ? (
        <>
          <label className="block text-sm font-semibold">
            Stock selection
            <select
              aria-label="Offer stock selection"
              required
              value={stockId}
              onChange={(e) => {
                setStockId(e.target.value);
                setAcknowledged(false);
              }}
              className={fieldClass}
            >
              <option value="">Choose exact stock</option>
              {stockId && !candidates.some((item) => item.id === stockId) ? (
                <option value={stockId}>Selected stock</option>
              ) : null}
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id.slice(-8)} ·{" "}
                  {item.dimensions?.length && item.dimensions.height
                    ? item.dimensions.length +
                      " × " +
                      item.dimensions.height +
                      " " +
                      (item.dimensions.unit || "")
                    : "Dimensions to confirm"}{" "}
                  · {item.quantity} {item.unit}
                </option>
              ))}
            </select>
          </label>
          {inventory.isError ? (
            <p role="alert" className="text-sm">
              Stock could not be loaded.{" "}
              <button type="button" className="underline" onClick={() => void inventory.refetch()}>
                Try again
              </button>
            </p>
          ) : null}
          <label className="block text-sm font-semibold">
            Number of slabs
            <input
              aria-label="Offer slab quantity"
              type="number"
              required
              min={1}
              max={999}
              step={1}
              value={quantity}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= 999) {
                  setQuantity(n);
                  setAcknowledged(false);
                }
              }}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Pickup or delivery
            <select
              aria-label="Offer fulfillment"
              value={method}
              onChange={(e) => setMethod(e.target.value as "pickup" | "delivery")}
              className={fieldClass}
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>
          {method === "delivery" ? (
            <label className="block text-sm font-semibold">
              Delivery ZIP
              <input
                aria-label="Offer delivery ZIP"
                required
                inputMode="numeric"
                maxLength={10}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className={fieldClass}
              />
            </label>
          ) : null}
        </>
      ) : (
        <p className="text-sm">
          This offer covers the complete cart shown below. Return to the cart to change quantities
          or delivery details.
        </p>
      )}
      <div role="status" aria-live="polite" className="text-sm">
        {reviewQuery.isFetching ? (
          "Checking current prices and stock…"
        ) : reviewQuery.isError ? (
          <>
            <p>Prices and stock could not be checked. No offer has been sent.</p>
            <button
              type="button"
              className="min-h-11 underline"
              onClick={() => void reviewQuery.refetch()}
            >
              Recheck selections
            </button>
          </>
        ) : changedCartTotal ? (
          "The cart total changed. Return to your cart and review the latest total before making an offer."
        ) : review?.materialReady && review.subtotalCents != null ? (
          <>
            <ul className="space-y-1" aria-label="Offer selections">
              {review.lines.map((line) => (
                <li key={line.inventoryPublicId}>
                  {line.requestedQuantity} ×{" "}
                  {"materialName" in line ? line.materialName : "Selected stone"}
                  {line.status === "ready" ? " — " + money(line.lineTotalCents) : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between gap-2 font-semibold">
              <span>Listed material total</span>
              <span data-testid="jw-offer-listed-total">{money(review.subtotalCents)}</span>
            </p>
            {review.bundle?.unlocked ? (
              <p className="mt-1 text-xs">
                Bundle pricing is already included in this listed total.
              </p>
            ) : null}
          </>
        ) : review ? (
          "One or more selections are unavailable or need updated pricing. Review your selections before making an offer."
        ) : (
          "Choose exact stock and quantity to see the listed material total."
        )}
      </div>
      <label className="block text-sm font-semibold">
        Your total offer (USD)
        <input
          aria-label="Your total offer (USD)"
          required
          inputMode="decimal"
          type="text"
          maxLength={18}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={Boolean(amount && offeredTotalCents == null)}
          className={fieldClass}
        />
      </label>
      <p className="text-xs text-stone-600">
        Offer for all selected slabs, not per slab or per square foot. Tax and delivery are not
        included.
      </p>
      {amount && offeredTotalCents == null ? (
        <p role="alert" className="text-sm">
          Enter a positive dollar amount with no more than two decimal places.
        </p>
      ) : null}
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          aria-label="I understand offer and payment terms"
          type="checkbox"
          required
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>{JW_STONE_OFFER_TERMS}</span>
      </label>
    </section>
  );
}
