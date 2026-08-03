import { buildFirstCutPresentation } from "./firstCut";

export function FirstCutSection() {
  const presentation = buildFirstCutPresentation();
  const hasAssignments = presentation.some((item) => item.kind === "stone");

  return (
    <section
      aria-labelledby="first-cut-title"
      className="border-y border-white/10 bg-stone-950 px-5 py-12 text-stone-50 sm:px-8 lg:px-12 lg:py-16"
    >
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
            Upcoming editorial reveals
          </p>
          <h2
            id="first-cut-title"
            className="mt-4 max-w-xl font-editorial text-4xl leading-none sm:text-5xl"
          >
            First Cut Exclusives
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            {hasAssignments
              ? "Explicitly verified first-look selections from JW Stone."
              : "A dedicated first-look destination is being prepared for explicitly verified JW Stone introductions. The collection will open when those selections are supplied."}
          </p>
        </div>

        <div
          className="scrollbar-hide flex snap-x gap-3 overflow-x-auto pb-2 sm:gap-4 sm:overflow-visible sm:pb-0"
          aria-label={
            hasAssignments
              ? "Verified First Cut selections"
              : "Three upcoming First Cut reveal positions"
          }
        >
          {presentation.map((item, index) =>
            item.kind === "stone" ? (
              <figure
                key={item.stone.id}
                className="w-44 shrink-0 snap-start bg-stone-900 sm:min-w-0 sm:flex-1"
              >
                <img
                  src={item.stone.images[0]}
                  alt={`${item.stone.publicLabel} stone photograph`}
                  className={`w-full object-cover ${index === 1 ? "h-56" : "h-48"}`}
                />
                <figcaption className="p-4 font-editorial text-2xl">
                  {item.stone.publicLabel}
                </figcaption>
              </figure>
            ) : (
              <div
                key={item.position}
                data-first-cut-placeholder="true"
                className={`relative w-44 shrink-0 snap-start overflow-hidden border border-white/15 bg-stone-900 sm:min-w-0 sm:flex-1 ${
                  index === 1 ? "h-56" : "h-48"
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-amber-100/60" />
                <div className="flex h-full flex-col justify-between p-4 sm:p-6">
                  <span className="font-mono text-[10px] tracking-[0.24em] text-stone-500">
                    POSITION {String(item.position).padStart(2, "0")}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    Reveal pending
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
