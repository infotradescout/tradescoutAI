import { buildFirstCutPresentation, JW_STONE_FIRST_CUT_SECTION_NOTE } from "./firstCut";
import { jw } from "./brand";

export function FirstCutSection() {
  const presentation = buildFirstCutPresentation();
  const hasStones = presentation.some((item) => item.kind === "stone");
  const hasPhotos = presentation.some((item) => item.kind === "photo");

  const ariaLabel = hasStones
    ? "First Cut selections"
    : hasPhotos
      ? "First Cut photos"
      : "Upcoming First Cut placements";

  return (
    <section
      aria-labelledby="first-cut-title"
      className={`bg-[var(--jw-bg)] px-0 pb-10 pt-9 sm:pb-12 sm:pt-11 ${jw.scrollTarget}`}
    >
      <div className={`mx-auto max-w-[1600px] px-5 sm:px-9 lg:px-12 ${jw.scrollTarget}`}>
        <h2
          id="first-cut-title"
          className="font-editorial text-2xl leading-tight text-[var(--jw-ink)] sm:text-3xl"
        >
          First Cut
        </h2>
        <p className={`mt-2 max-w-xl text-sm leading-6 ${jw.muted}`}>
          {JW_STONE_FIRST_CUT_SECTION_NOTE}
        </p>
      </div>

      <div
        className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pl-5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-6 sm:gap-4 sm:pl-9 lg:pl-12 [&::-webkit-scrollbar]:hidden"
        aria-label={ariaLabel}
        data-testid="jw-first-cut-rail"
      >
        {presentation.map((item) => {
          if (item.kind === "stone") {
            return (
              <figure
                key={item.stone.id}
                className="w-[88vw] max-w-[42rem] shrink-0 snap-start sm:w-[86vw]"
              >
                <img
                  src={item.stone.images[0]}
                  alt={`${item.stone.publicLabel} stone photograph`}
                  className="aspect-[4/5] w-full object-cover sm:aspect-[5/4]"
                />
                {item.stone.displayName ? (
                  <figcaption className="mt-3 font-editorial text-lg leading-tight text-[var(--jw-ink)] sm:text-xl">
                    {item.stone.displayName}
                  </figcaption>
                ) : null}
              </figure>
            );
          }

          if (item.kind === "photo") {
            return (
              <figure
                key={item.id}
                data-first-cut-photo="true"
                className="w-[88vw] max-w-[42rem] shrink-0 snap-start sm:w-[86vw]"
              >
                <img
                  src={item.imageSrc}
                  alt="First Cut stone photograph"
                  className="aspect-[4/5] w-full object-cover sm:aspect-[5/4]"
                />
              </figure>
            );
          }

          return (
            <div
              key={item.position}
              data-first-cut-placeholder="true"
              className="flex w-[88vw] max-w-[42rem] shrink-0 snap-start flex-col justify-end bg-[var(--jw-surface)] aspect-[4/5] p-5 sm:w-[86vw] sm:aspect-[5/4]"
            >
              <span className={`text-xs uppercase tracking-[0.16em] ${jw.muted}`}>Coming soon</span>
            </div>
          );
        })}
        {/* Trailing inset so the last slide can snap with a peek of previous. */}
        <div className="w-5 shrink-0 sm:w-9 lg:w-12" aria-hidden="true" />
      </div>
    </section>
  );
}
