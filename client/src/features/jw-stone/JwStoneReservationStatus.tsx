import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  JW_STONE_CART_HOLD_PATH,
  jwStoneHoldRemainingSeconds,
  parseJwStoneCartHoldRecovery,
} from "@shared/jwStoneCartHoldRecovery";
import { jwStoneCartHoldReleaseSchema } from "@shared/jwStoneCartHolds";
import { apiRequest } from "@/lib/queryClient";

type Props = { viewerId: string | null; onContact: () => void };
/** Read-only, price-free ownership recovery. It does not create, renew or release stock. */
export function JwStoneReservationStatus({ viewerId, onContact }: Props) {
  const owner = String(viewerId || "").trim();
  const queryClient = useQueryClient();
  const deadlineRefresh = useRef<string | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [releaseConfirm, setReleaseConfirm] = useState(false);
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
  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!hold || hold.status !== "active") throw new Error("No active reservation to release.");
      return jwStoneCartHoldReleaseSchema.parse(
        await apiRequest(`${JW_STONE_CART_HOLD_PATH}/${hold.reservationId}/release`, {
          method: "POST",
          data: {},
        })
      );
    },
    onSuccess: () => {
      setReleaseConfirm(false);
      void query.refetch();
    },
  });
  useEffect(() => {
    setNow(performance.now());
    if (hold?.status !== "active") return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, [owner, hold?.reservationId, hold?.status, query.dataUpdatedAt]);
  const remaining =
    hold && query.data ? jwStoneHoldRemainingSeconds(hold, query.data.requestStartedAt, now) : null;
  useEffect(() => {
    if (
      remaining !== 0 ||
      hold?.status !== "active" ||
      query.isFetching ||
      deadlineRefresh.current === hold.reservationId
    )
      return;
    deadlineRefresh.current = hold.reservationId;
    void query.refetch();
  }, [remaining, hold?.reservationId, hold?.status, query.isFetching, query.refetch]);
  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!hold || hold.status !== "active") throw new Error("No active reservation to release.");
      const result = await apiRequest(
        `${JW_STONE_CART_HOLD_PATH}/${encodeURIComponent(hold.reservationId)}/release`,
        { method: "POST", data: {} }
      );
      if (
        result?.reservationId !== hold.reservationId ||
        (result?.status !== "released" && result?.status !== "expired")
      ) {
        throw new Error("The reservation release could not be confirmed.");
      }
      return result as { reservationId: string; status: "released" | "expired" };
    },
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["jw-stone", "cart-stock"] }),
        queryClient.invalidateQueries({ queryKey: ["jw-stone", "cart-review"] }),
      ]);
    },
  });
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
      {releaseMutation.isError ? (
        <p role="alert" className="mt-2 text-xs">
          {releaseMutation.error instanceof Error
            ? releaseMutation.error.message
            : "The reservation could not be released. Try again."}
        </p>
      ) : null}
      {releaseMutation.isError ? (
        <p role="alert" className="mt-2 text-xs">
          {releaseMutation.error instanceof Error
            ? releaseMutation.error.message
            : "The reservation could not be released. Refresh and retry."}
        </p>
      ) : null}
      {hold.status === "active" && releaseConfirm ? (
        <div className="mt-3 border border-[var(--jw-border)] p-3 text-sm" role="group" aria-label="Confirm reservation release">
          <p>Release these slabs back to available stock now?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={releaseMutation.isPending}
              onClick={() => releaseMutation.mutate()}
              className="min-h-11 bg-[var(--jw-accent)] px-3 font-semibold text-[var(--jw-on-accent)] disabled:opacity-50"
            >
              {releaseMutation.isPending ? "Releasing…" : "Confirm release"}
            </button>
            <button
              type="button"
              disabled={releaseMutation.isPending}
              onClick={() => setReleaseConfirm(false)}
              className="min-h-11 border border-[var(--jw-border)] px-3 disabled:opacity-50"
            >
              Keep reservation
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={query.isFetching || releaseMutation.isPending}
          onClick={() => void query.refetch()}
          className="min-h-11 border border-[var(--jw-border)] px-3 text-sm disabled:opacity-50"
        >
          {query.isFetching ? "Checking reservation…" : "Refresh reservation status"}
        </button>
        {hold.status === "active" && !releaseConfirm ? (
          <button
            type="button"
            disabled={releaseMutation.isPending}
            onClick={() => setReleaseConfirm(true)}
            className="min-h-11 border border-[var(--jw-border)] px-3 text-sm disabled:opacity-50"
          >
            Release reservation
          </button>
        ) : null}
        {hold.status === "active" ? (
          <button
            type="button"
            disabled={releaseMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Release this temporary reservation? The slabs will become available to other buyers."
                )
              )
                releaseMutation.mutate();
            }}
            className="min-h-11 border border-[var(--jw-border)] px-3 text-sm disabled:opacity-50"
            data-testid="jw-release-reservation"
          >
            {releaseMutation.isPending ? "Releasing…" : "Release reservation"}
          </button>
        ) : null}
        <button type="button" onClick={onContact} className="min-h-11 px-3 text-sm underline">
          Contact JW Stone
        </button>
      </div>
    </aside>
  );
}
