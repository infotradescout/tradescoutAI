import { useEffect, useState, type ComponentType } from "react";
import type { JwStoneMemberCartProps } from "./JwStoneMemberCart";
import { JW_STONE_BRAND_STYLE } from "./brand";

type CartComponent = ComponentType<JwStoneMemberCartProps>;
let pendingCart: Promise<CartComponent> | null = null;

function loadCart(): Promise<CartComponent> {
  if (!pendingCart) {
    pendingCart = import("./JwStoneMemberCart")
      .then((module) => module.JwStoneMemberCart)
      .catch((error: unknown) => {
        pendingCart = null;
        throw error;
      });
  }
  return pendingCart;
}

/** The public stone page does not need the cart, its dialog, or its quote form. */
export function JwStoneMemberCart(props: JwStoneMemberCartProps) {
  const [Cart, setCart] = useState<CartComponent | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFailed(false);
    loadCart().then(
      (component) => { if (current) setCart(() => component); },
      () => { if (current) setFailed(true); }
    );
    // A closed cart or changed member must not be reopened by a late import.
    return () => { current = false; };
  }, [attempt]);

  if (Cart) return <Cart {...props} />;
  return (
    <aside role="region" aria-label="Slab cart loading" style={JW_STONE_BRAND_STYLE}
      className="fixed bottom-4 right-4 z-[71] w-[calc(100%-2rem)] max-w-sm border border-[var(--jw-border)] bg-[var(--jw-surface)] p-5 text-[var(--jw-ink)] shadow-xl">
      <p role="status" aria-live="polite" className="text-sm">
        {failed ? "The cart could not be loaded. Your selections are saved in this browser." : "Opening your cart…"}
      </p>
      <div className="mt-3 flex gap-3">
        {failed ? <button type="button" onClick={() => setAttempt((value) => value + 1)}
          className="min-h-11 border border-[var(--jw-border)] px-4 text-sm">Try again</button> : null}
        <button type="button" onClick={props.onClose} className="min-h-11 px-4 text-sm underline">Close cart</button>
      </div>
    </aside>
  );
}
