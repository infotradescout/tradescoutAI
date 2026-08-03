import { buildFirstCutPresentation } from "./firstCut";

export function FirstCutSection() {
  const presentation = buildFirstCutPresentation();
  const hasAssignments = presentation.some((item) => item.kind === "stone");

  return (
    <section
      aria-labelledby="first-cut-title"
      className="border-y border-white/10 bg-stone-950 px-5 py-20 text-stone-50 sm:px-8 lg:px-12 lg:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
            Upcoming editorial reveals
          </p>
          <h2
            id="first-cut-title"
            className="mt-5 max-w-xl font-editorial text-5xl leading-none sm:text-6xl"
          >
            First Cut Exclusives
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-stone-300 sm:text-lg">
            {hasAssignments
              ? "Explicitly verified first-look selections from JW Stone."
              : "A dedicated first-look destination is being prepared for explicitly verified JW Stone introductions. The collection will open when those selections are supplied."}
          </p>
        </div>

        <div
          className="grid min-h-80 grid-cols-3 items-end gap-3 sm:gap-5"
          aria-label={
            hasAssignments
              ? "Verified First Cut selections"
              : "Three upcoming First Cut reveal positions"
          }
        >
          {presentation.map((item, index) =>
            item.kind === "stone" ? (
              <figure key={item.stone.id} className="bg-stone-900">
                <img
                  src={item.stone.images[0]}
                  alt={`${item.stone.publicLabel} stone photograph`}
                  className={`w-full object-cover ${index === 1 ? "h-80" : "h-64"}`}
                />
                <figcaption className="p-4 font-editorial text-2xl">
                  {item.stone.publicLabel}
                </figcaption>
              </figure>
            ) : (
              <div
                key={item.position}
                data-first-cut-placeholder="true"
                className={`relative overflow-hidden border border-white/15 bg-stone-900 ${
                  index === 1 ? "h-80" : "h-64"
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
