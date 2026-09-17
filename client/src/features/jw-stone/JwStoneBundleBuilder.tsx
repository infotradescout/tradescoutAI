import type { JwStoneCartReview } from "@shared/jwStoneCart";
import { JW_STONE_BUNDLE_SLABS } from "@shared/jwStoneBundle";

export function JwStoneBundleBuilder({
  review,
  empty,
  checking,
  onBrowse,
}: {
  review?: JwStoneCartReview;
  empty: boolean;
  checking: boolean;
  onBrowse: () => void;
}) {
  const bundle = review?.bundle;
  const count = bundle?.eligibleSlabs ?? 0;
  const remaining = bundle?.remainingSlabs ?? JW_STONE_BUNDLE_SLABS;
  const showProgress = Boolean(bundle) || empty;
  const message = checking
    ? "Checking bundle eligibility…"
    : bundle?.unlocked
      ? "Bundle pricing unlocked"
      : bundle && remaining === 0
        ? "Resolve unavailable selections to confirm bundle pricing."
        : bundle
          ? "Add " +
            remaining +
            " more eligible " +
            (remaining === 1 ? "slab" : "slabs") +
            " to unlock bundle pricing."
          : empty
            ? "Choose 7 eligible slabs to unlock bundle pricing."
            : "Choose exact stock to check your bundle.";
  return (
    <section
      aria-labelledby="jw-bundle-title"
      data-testid="jw-bundle-builder"
      className="mb-4 border border-[var(--jw-accent)] bg-[var(--jw-bg)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="jw-bundle-title" className="text-base font-semibold">
          Build a bundle
        </h2>
        <span className="text-xs text-[var(--jw-muted)]">7 slabs = 1 bundle</span>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-sm font-medium">
        {message}
      </p>
      {showProgress ? (
        <>
          <div
            role="progressbar"
            aria-label="Bundle progress"
            aria-valuemin={0}
            aria-valuemax={7}
            aria-valuenow={Math.min(count, 7)}
            aria-valuetext={count + " eligible slabs; " + remaining + " more needed"}
            className="mt-3 grid grid-cols-7 gap-1"
          >
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={
                  index < count ? "h-2 bg-[var(--jw-accent)]" : "h-2 bg-[var(--jw-border)]"
                }
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--jw-muted)]">
            {count} eligible {count === 1 ? "slab" : "slabs"} selected
            {bundle?.unlocked ? " · Bundle rate applies to every eligible slab" : " · 7 needed"}
          </p>
        </>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-[var(--jw-muted)]">
        Mix eligible materials at each stone’s listed bundle rate. Lower quantity rates still apply.
        Special higher-minimum materials do not count toward this bundle.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-2 min-h-11 w-full border border-[var(--jw-border)] px-3 text-sm font-semibold"
      >
        {bundle?.unlocked ? "Continue shopping" : "Choose more slabs"}
      </button>
    </section>
  );
}
