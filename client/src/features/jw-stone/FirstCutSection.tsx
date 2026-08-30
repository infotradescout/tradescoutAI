import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  buildFirstCutPresentation,
  resolveFirstCutDetailStone,
  type FirstCutPresentation,
} from "./firstCut";
import { jw } from "./brand";
import type { JwStoneCatalogItem } from "./types";
import { useMomentumRail } from "./useMomentumRail";

type FirstCutSectionProps = {
  onOpen?: (stone: JwStoneCatalogItem) => void;
};

/** Cache-bust so updated first-cut assets are not stuck behind an old empty response. */
const FIRST_CUT_PHOTO_CACHE_BUST = "green-bookmatch-lead-1";

function tileImageSrc(item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>): string {
  if (item.kind === "stone") return item.stone.images[0] ?? "";
  return `${item.imageSrc}?v=${FIRST_CUT_PHOTO_CACHE_BUST}`;
}

function tileAriaLabel(item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>): string {
  if (item.kind === "stone") return `Open ${item.stone.publicLabel}`;
  return "Open First Cut full slab view";
}

function itemKey(item: FirstCutPresentation): string {
  if (item.kind === "stone") return `stone:${item.stone.id}`;
  if (item.kind === "photo") return `photo:${item.id}`;
  return `placeholder:${item.position}`;
}

export function FirstCutSection({ onOpen }: FirstCutSectionProps) {
  const presentation = buildFirstCutPresentation().slice(0, 3);
  const hasStones = presentation.some((item) => item.kind === "stone");
  const hasPhotos = presentation.some((item) => item.kind === "photo");
  const resetKey = presentation.map(itemKey).join("|");
  const { activeIndex, railRef, onScroll, scrollToIndex } = useMomentumRail({
    itemCount: presentation.length,
    resetKey,
  });

  const ariaLabel = hasStones
    ? "First Cut selections"
    : hasPhotos
      ? "First Cut photos"
      : "Upcoming First Cut placements";

  const renderMedia = (
    item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>,
    index: number
  ) => {
    const lead = index === 0;
    const testId =
      item.kind === "stone"
        ? `jw-first-cut-stone-${item.stone.id}`
        : `jw-first-cut-photo-${item.id}`;

    return (
      <button
        key={itemKey(item)}
        type="button"
        data-testid={testId}
        data-momentum-item="true"
        data-first-cut-photo={item.kind === "photo" ? "true" : undefined}
        data-first-cut-lead={lead ? "true" : undefined}
        data-first-cut-support={!lead ? "true" : undefined}
        onClick={() => onOpen?.(resolveFirstCutDetailStone(item))}
        className={`jw-first-cut__tile jw-first-cut__tile--${
          lead ? "lead" : "support"
        } group relative h-[10.5rem] min-w-[84%] shrink-0 overflow-hidden bg-[var(--jw-dark)] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--jw-accent)] focus-visible:ring-inset sm:h-[11.5rem] sm:min-w-[62%] md:min-w-[48%] lg:h-[12.5rem] lg:min-w-[42%] xl:min-w-[38%]`}
        aria-label={tileAriaLabel(item)}
      >
        <span
          className={`relative block h-full w-full overflow-hidden bg-[var(--jw-dark)] ${
            lead ? "aspect-[12/5]" : "aspect-[3/2]"
          }`}
        >
          <img
            src={tileImageSrc(item)}
            alt=""
            className="jw-first-cut__image h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
            loading={lead ? "eager" : "lazy"}
            decoding="async"
          />
          {item.kind === "stone" && item.stone.displayName ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-3 pt-10 font-editorial text-lg leading-tight text-white sm:text-xl">
              {item.stone.displayName}
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  const renderPlaceholder = (
    item: Extract<FirstCutPresentation, { kind: "placeholder" }>,
    index: number
  ) => {
    const lead = index === 0;
    return (
      <div
        key={itemKey(item)}
        data-momentum-item="true"
        data-first-cut-placeholder="true"
        data-first-cut-lead={lead ? "true" : undefined}
        data-first-cut-support={!lead ? "true" : undefined}
        className={`jw-first-cut__tile jw-first-cut__tile--${
          lead ? "lead" : "support"
        } flex h-[10.5rem] min-w-[84%] shrink-0 flex-col justify-end bg-[var(--jw-surface)] p-4 sm:h-[11.5rem] sm:min-w-[62%] md:min-w-[48%] lg:h-[12.5rem] lg:min-w-[42%] xl:min-w-[38%]`}
      >
        <span className={`text-[10px] uppercase tracking-[0.16em] sm:text-xs ${jw.muted}`}>
          Coming soon
        </span>
      </div>
    );
  };

  return (
    <section
      aria-labelledby="first-cut-title"
      data-testid="jw-first-cut"
      className={`jw-first-cut bg-[var(--jw-bg)] px-0 pb-5 pt-3 sm:pb-6 sm:pt-4 ${jw.scrollTarget}`}
    >
      <div className={`mx-auto w-full max-w-[1680px] px-3 sm:px-6 lg:px-8 ${jw.scrollTarget}`}>
        <header className="jw-first-cut__intro mb-2.5 flex items-end justify-between gap-4 sm:mb-3">
          <h2
            id="first-cut-title"
            className="font-editorial text-xl font-medium leading-none tracking-tight text-[var(--jw-ink)] sm:text-2xl lg:text-[1.7rem]"
          >
            First Cut Exclusives
          </h2>

          {presentation.length > 1 ? (
            <div className="flex shrink-0 items-center gap-1.5" aria-label="First Cut carousel controls">
              <button
                type="button"
                data-testid="jw-first-cut-previous"
                aria-label="Previous First Cut"
                disabled={activeIndex === 0}
                onClick={() => scrollToIndex(activeIndex - 1)}
                className="inline-flex h-9 w-9 items-center justify-center border border-[var(--jw-border-strong)] text-[var(--jw-ink)] transition hover:bg-[var(--jw-surface)] disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="jw-first-cut-next"
                aria-label="Next First Cut"
                disabled={activeIndex === presentation.length - 1}
                onClick={() => scrollToIndex(activeIndex + 1)}
                className="inline-flex h-9 w-9 items-center justify-center border border-[var(--jw-border-strong)] text-[var(--jw-ink)] transition hover:bg-[var(--jw-surface)] disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </header>

        <div
          ref={railRef}
          onScroll={onScroll}
          className="jw-first-cut__rail flex gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3"
          aria-label={ariaLabel}
          aria-roledescription="carousel"
          data-testid="jw-first-cut-rail"
        >
          {presentation.map((item, index) =>
            item.kind === "placeholder" ? renderPlaceholder(item, index) : renderMedia(item, index)
          )}
        </div>
      </div>
    </section>
  );
}
