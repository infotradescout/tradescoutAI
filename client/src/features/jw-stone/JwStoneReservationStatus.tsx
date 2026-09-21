import { lazy, Suspense } from "react";

type Props = { viewerId: string | null; onContact: () => void };

function ReservationUnavailable({ onContact }: Props) {
  return (
    <aside className="mx-auto max-w-[1600px] px-4 py-4 text-sm sm:px-9" role="status">
      <p>Reservation status could not be loaded. Refresh the page to try again.</p>
      <button type="button" onClick={() => window.location.reload()} className="min-h-11 px-3 underline">
        Refresh page
      </button>
      <button type="button" onClick={onContact} className="min-h-11 px-3 underline">
        Contact JW Stone
      </button>
    </aside>
  );
}

const OwnerReservationStatus = lazy(() =>
  import("./JwStoneReservationStatusContent")
    .then((module) => ({ default: module.JwStoneReservationStatus }))
    .catch(() => ({ default: ReservationUnavailable }))
);

/** Defer owner-only controls, not owner access: revoked members still recover and release. */
export function JwStoneReservationStatus(props: Props) {
  const owner = String(props.viewerId || "").trim();
  if (!owner) return null;
  return (
    <>
      <div className="mx-auto max-w-[1600px] px-4 py-2 sm:px-9">
        <a href="/jw-stone/orders" data-testid="jw-offers-orders-link" className="inline-flex min-h-11 items-center text-sm font-semibold underline">Your offers and orders</a>
      </div>
      <Suspense fallback={<p role="status" className="px-4 py-4 text-sm sm:px-9">Loading reservation status…</p>}>
        <OwnerReservationStatus key={owner} {...props} viewerId={owner} />
      </Suspense>
    </>
  );
}
