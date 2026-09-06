import { IRANIAN_ONYX_STOCK } from "@shared/onyxOrigins";

export function IranianOnyxFeature({
  href,
  onExplore,
  label = "Explore Iranian onyx",
}: {
  href: string;
  onExplore?: () => void;
  label?: string;
}) {
  return (
    <section
      aria-label="Featured Iranian onyx"
      className="border-y border-amber-900/15 bg-[#f8f3e9] text-[#292923]"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-9">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#805a28]">
            Featured material
          </p>
          <h2 className="mt-1 font-editorial text-2xl">{IRANIAN_ONYX_STOCK.headline}</h2>
          <p className="mt-1 text-sm font-semibold">{IRANIAN_ONYX_STOCK.stockLabel}</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#655f53]">
            {IRANIAN_ONYX_STOCK.stockNote}
          </p>
        </div>
        <a
          href={href}
          onClick={(event) => {
            if (
              onExplore &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0
            ) {
              event.preventDefault();
              onExplore();
            }
          }}
          className="inline-flex min-h-11 items-center rounded-full bg-[#292923] px-5 py-2 text-sm font-semibold text-white hover:bg-[#805a28]"
        >
          {label}{" "}
          <span aria-hidden="true" className="ml-3">
            →
          </span>
        </a>
      </div>
    </section>
  );
}
