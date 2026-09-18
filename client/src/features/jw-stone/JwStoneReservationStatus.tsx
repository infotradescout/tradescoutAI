import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  JW_STONE_CART_HOLD_PATH,
  jwStoneHoldRemainingSeconds,
  parseJwStoneCartHoldRecovery,
} from "@shared/jwStoneCartHoldRecovery";
import { apiRequest } from "@/lib/queryClient";

type Props = { viewerId: string | null; onContact: () => void };
/** Read-only, price-free ownership recovery. It does not create, renew or release stock. */
export function JwStoneReservationStatus({ viewerId, onContact }: Props) {
  const owner = String(viewerId || "").trim();
  const [now, setNow] = useState(() => performance.now());
  const query = useQuery({
    queryKey: ["jw-stone", "owned-hold-status", owner],
    queryFn: async ({ signal }) => {
      const requestStartedAt = performance.now();
      const recovery = parseJwStoneCartHoldRecovery(
        await apiRequest(`${JW_STONE_CART_HOLD_PATH}/active`, { signal }),
        owner
      );
      return { ...recovery, requestStartedAt };
    },
    enabled: Boolean(owner),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  const hold = owner && query.data?.viewerId === owner ? query.data.hold : null;
  useEffect(() => {
    setNow(performance.now());
    if (hold?.status !== "active") return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, [owner, hold?.reservationId, hold?.status, query.dataUpdatedAt]);
  const remaining =
    hold && query.data ? jwStoneHoldRemainingSeconds(hold, query.data.requestStartedAt, now) : null;
  // An unmounted endpoint or no owned hold must not block the catalog or contact flow.
  if (!hold) return null;
  return (
    <aside
      data-testid="jw-owned-reservation-status"
      aria-label="Your temporary stock reservation"
      className="mx-auto max-w-[1600px] border-b border-[var(--jw-border)] px-4 py-4 text-[var(--jw-ink)] sm:px-9"
    >
      <h2 className="text-base font-semibold">Your temporary stock reservation</h2>
      <p className="mt-1 text-sm">
        {hold.totalSlabs} {hold.totalSlabs === 1 ? "slab" : "slabs"} ·{" "}
        {hold.status === "active"
          ? remaining === 0
            ? "Deadline reached — refresh to confirm status"
            : "Held for you"
          : hold.status === "expired"
            ? "Expired"
            : "Released"}
      </p>
      {remaining !== null ? (
        <p className="mt-1 text-sm">
          Estimated time remaining:{" "}
          <span role="timer" aria-live="off" aria-label="Estimated reservation time remaining">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </span>
        </p>
      ) : null}
      <p className="mt-1 text-sm">
        Original expiration:{" "}
        <time dateTime={hold.expiresAt}>{new Date(hold.expiresAt).toLocaleString()}</time>
      </p>
      <p className="mt-1 break-all text-xs text-[var(--jw-muted)]">
        Reservation {hold.reservationId}
      </p>
      <p className="mt-2 text-xs">
        A temporary hold is not an order or payment. Reloading does not extend its deadline.
      </p>
      <ul className="mt-2 space-y-1 text-sm" aria-label="Reserved stock">
        {hold.lines.map((line) => (
          <li key={line.inventoryPublicId}>
            {line.quantity} × {line.materialName}
          </li>
        ))}
      </ul>
      {query.isError ? (
        <p role="status" className="mt-2 text-xs">
          This is the last confirmed status. It could not be refreshed.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="min-h-11 border border-[var(--jw-border)] px-3 text-sm disabled:opacity-50"
        >
          {query.isFetching ? "Checking reservation…" : "Refresh reservation status"}
        </button>
        <button type="button" onClick={onContact} className="min-h-11 px-3 text-sm underline">
          Contact JW Stone
        </button>
      </div>
    </aside>
  );
}
