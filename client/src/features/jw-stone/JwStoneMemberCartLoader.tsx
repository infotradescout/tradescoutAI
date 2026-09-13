import type { JwStoneMemberCartProps } from "./JwStoneMemberCart";
import { JW_STONE_BRAND_STYLE } from "./brand";
import {
  createJwStoneComponentLoader,
  useJwStoneDeferredComponent,
} from "./deferredJwStoneComponent";

const loadCart = createJwStoneComponentLoader<JwStoneMemberCartProps>(() =>
  import("./JwStoneMemberCart").then((module) => module.JwStoneMemberCart)
);

/** The public stone page does not need the cart, its dialog, or its quote form. */
export function JwStoneMemberCart(props: JwStoneMemberCartProps) {
  const { Component: Cart, failed, retry } = useJwStoneDeferredComponent(loadCart);

  if (Cart) return <Cart {...props} />;
  return (
    <aside
      role="region"
      aria-label="Slab cart loading"
      style={JW_STONE_BRAND_STYLE}
      className="fixed bottom-4 right-4 z-[71] w-[calc(100%-2rem)] max-w-sm border border-[var(--jw-border)] bg-[var(--jw-surface)] p-5 text-[var(--jw-ink)] shadow-xl"
    >
      <p role="status" aria-live="polite" className="text-sm">
        {failed
          ? `The cart could not be loaded. ${props.persisted === false ? "Your changes are available for this visit only." : "Your selections are saved in this browser."}`
          : "Opening your cart…"}
      </p>
      <div className="mt-3 flex gap-3">
        {failed ? (
          <button
            type="button"
            onClick={retry}
            className="min-h-11 border border-[var(--jw-border)] px-4 text-sm"
          >
            Try again
          </button>
        ) : null}
        <button type="button" onClick={props.onClose} className="min-h-11 px-4 text-sm underline">
          Close cart
        </button>
      </div>
    </aside>
  );
}
