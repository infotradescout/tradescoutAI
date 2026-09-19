import type { JwStoneCartHolds } from "./jwStoneCartHolds";
/** Multiple application instances are safe: the ledger serializes each seller and checks active state. */
export function startJwStoneCartHoldExpiry(
  holds: Pick<JwStoneCartHolds, "expireDueSellers">,
  intervalMs = 60_000
) {
  let busy = false;
  let stopped = false;
  const run = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const result = await holds.expireDueSellers();
      if (result.failedSellers)
        console.error("[jw-cart-holds] expired stock needs reconciliation", {
          failedSellers: result.failedSellers,
        });
    } catch {
      console.error("[jw-cart-holds] idle expiry unavailable; retrying next interval");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  void run();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
