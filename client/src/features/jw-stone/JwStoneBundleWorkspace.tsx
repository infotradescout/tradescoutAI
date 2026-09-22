import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import {
  JW_STONE_CART_REVIEW_PATH,
  jwStoneCartReviewRequestSchema,
  parseJwStoneCartReview,
} from "@shared/jwStoneCart";
import { JW_STONE_BUNDLE_SLABS } from "@shared/jwStoneBundle";
import { JW_STONE_BRAND_STYLE } from "./brand";
import { useJwStoneShopping } from "./JwStoneMemberPricing";
import BundleStockPicker from "./JwStoneBundleStockPicker";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** Separate storefront workspace; the cart is a later handoff, not its entry point. */
export default function JwStoneBundleWorkspace({ onClose }: { onClose: () => void }) {
  const shopping = useJwStoneShopping();
  const selection = {
    lines: shopping.items.map((item) => ({
      inventoryPublicId: item.inventoryPublicId,
      quantity: item.quantity,
    })),
    fulfillment: { method: "pickup" as const },
  };
  const parsed = jwStoneCartReviewRequestSchema.safeParse(selection);
  const reviewQuery = useQuery({
    queryKey: ["jw-stone", "standalone-bundle-review", shopping.viewerId, selection],
    queryFn: async ({ signal }) => {
      const input = jwStoneCartReviewRequestSchema.parse(selection);
      const value = await apiRequest(JW_STONE_CART_REVIEW_PATH, {
        method: "POST",
        data: input,
        signal,
      });
      return parseJwStoneCartReview(value, shopping.viewerId, input);
    },
    enabled: shopping.cartEnabled && parsed.success,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const review = !reviewQuery.isError && parsed.success ? reviewQuery.data : undefined;
  const checked = !reviewQuery.isFetching && review?.materialReady === true;
  const count = review?.bundle?.eligibleSlabs ?? 0;
  const remaining = Math.max(0, JW_STONE_BUNDLE_SLABS - count);
  const unlocked = checked && review?.bundle?.unlocked === true;
  const total = checked ? review?.subtotalCents : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        style={JW_STONE_BRAND_STYLE}
        data-jw-brand="true"
        data-testid="jw-standalone-bundle-builder"
        className="fixed inset-0 left-0 top-0 z-[1000] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[var(--jw-bg)] p-0 text-[var(--jw-ink)] sm:max-w-none [&>button]:right-4 [&>button]:top-4 [&>button]:z-20"
      >
        <header className="shrink-0 border-b border-[var(--jw-border)] px-5 pb-4 pr-16 pt-5 sm:px-8 sm:pr-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--jw-accent)]">
            JW Stone · Mix and match
          </p>
          <DialogTitle className="mt-1 font-editorial text-3xl font-normal text-[var(--jw-ink)]">
            Build a Bundle
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-[var(--jw-muted)]">
            Choose seven eligible slabs, including seven different stones. Each stone uses its own
            listed bundle rate.
          </DialogDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8">
          <div className="mx-auto grid max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-label="Choose slabs" className="min-w-0">
              <BundleStockPicker standalone review={review} checking={reviewQuery.isFetching} />
            </section>
            <aside
              className="min-w-0 border border-[var(--jw-border)] bg-[var(--jw-surface)] p-4 lg:sticky lg:top-0"
              aria-label="Your bundle selections"
            >
              <h2 className="text-lg font-semibold">Your bundle</h2>
              <p
                role="status"
                aria-live="polite"
                data-testid="jw-standalone-bundle-progress"
                className="mt-2 text-sm"
              >
                {reviewQuery.isFetching
                  ? "Checking current stock and bundle rates…"
                  : unlocked
                    ? "Bundle pricing unlocked"
                    : reviewQuery.isError
                      ? "Bundle total unavailable. Your selections are saved."
                      : shopping.items.length && !parsed.success
                        ? "Choose exact stock for each selection in the cart, or remove it here."
                        : `${count} eligible slabs selected · Add ${remaining} more to unlock bundle pricing.`}
              </p>
              <div
                role="progressbar"
                aria-label="Standalone bundle progress"
                aria-valuemin={0}
                aria-valuemax={7}
                aria-valuenow={Math.min(count, 7)}
                className="mt-3 grid grid-cols-7 gap-1"
              >
                {Array.from({ length: 7 }, (_, index) => (
                  <span
                    key={index}
                    className={
                      index < count ? "h-2 bg-[var(--jw-accent)]" : "h-2 bg-[var(--jw-border)]"
                    }
                  />
                ))}
              </div>
              {shopping.items.length ? (
                <ul className="mt-4 divide-y divide-[var(--jw-border)]">
                  {shopping.items.map((item) => {
                    const line = review?.lines.find(
                      (candidate) => candidate.inventoryPublicId === item.inventoryPublicId
                    );
                    return (
                      <li key={item.id} className="py-3" data-testid="jw-standalone-bundle-line">
                        <p className="break-words text-sm font-semibold">{item.stoneName}</p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <label className="text-xs">
                            Slabs
                            <input
                              aria-label={`Bundle quantity for ${item.stoneName}`}
                              type="number"
                              min={1}
                              max={999}
                              value={item.quantity}
                              onChange={(event) => {
                                const quantity = Number(event.target.value);
                                if (Number.isInteger(quantity) && quantity >= 1)
                                  shopping.updateQuantity(item.id, quantity);
                              }}
                              className="ml-2 min-h-11 w-20 border border-[var(--jw-border)] bg-[var(--jw-bg)] px-2 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove ${item.stoneName} from bundle`}
                            className="min-h-11 px-2 text-xs underline"
                            onClick={() => shopping.updateQuantity(item.id, 0)}
                          >
                            Remove
                          </button>
                        </div>
                        {line && line.status !== "ready" ? (
                          <p role="alert" className="mt-1 text-xs">
                            This selection needs a stock or pricing review. Reduce its quantity,
                            remove it, or review it in your cart.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--jw-muted)]">
                  Start by adding a slab from the selector. No cart setup is required.
                </p>
              )}
              {reviewQuery.isError ? (
                <button
                  type="button"
                  className="mt-3 min-h-11 w-full border px-3 text-sm"
                  onClick={() => void reviewQuery.refetch()}
                >
                  Retry bundle total
                </button>
              ) : null}
              {total != null ? (
                <dl className="mt-4 space-y-2 border-t border-[var(--jw-border)] pt-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt>Material subtotal</dt>
                    <dd data-testid="jw-standalone-bundle-subtotal" className="font-semibold">
                      {money(total)}
                    </dd>
                  </div>
                  {(review?.bundle?.savingsCents ?? 0) > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt>Quantity savings</dt>
                      <dd data-testid="jw-standalone-bundle-savings">
                        {money(review!.bundle!.savingsCents!)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-[var(--jw-muted)]">
                Selections are saved to your account’s cart on this browser. No payment or
                reservation is made. Tax, delivery and timing are confirmed separately.
              </p>
            </aside>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--jw-border)] bg-[var(--jw-surface)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-8">
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm underline">
            Continue browsing
          </button>
          <button
            type="button"
            data-testid="jw-standalone-bundle-review-cart"
            disabled={!shopping.items.length}
            onClick={shopping.openCart}
            className="min-h-12 border border-[var(--jw-accent)] bg-[var(--jw-accent)] px-5 text-sm font-semibold text-[var(--jw-on-accent)] disabled:opacity-50"
          >
            Review selections in cart
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
