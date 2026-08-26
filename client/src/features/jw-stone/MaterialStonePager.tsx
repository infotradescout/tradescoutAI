import { ArrowLeft, ArrowRight } from "lucide-react";
import { StoneCard } from "./StoneCard";
import type { JwStoneCatalogItem } from "./types";
import { useMomentumRail } from "./useMomentumRail";

type MaterialStonePagerProps = {
  materialLabel: string;
  stones: readonly JwStoneCatalogItem[];
  isSaved: (id: string) => boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

const NAV_BUTTON_CLASS =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--jw-border-strong)] bg-[var(--jw-bg)] text-[var(--jw-ink)] shadow-[0_8px_24px_rgba(30,24,18,0.08)] transition-[background-color,border-color,opacity,transform] hover:border-[var(--jw-ink)] hover:bg-[var(--jw-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95 disabled:pointer-events-none disabled:opacity-30";

/**
 * Native horizontal stone corridor. It intentionally avoids scroll snap so a
 * released touch or trackpad gesture keeps its natural momentum.
 */
export function MaterialStonePager({
  materialLabel,
  stones,
  isSaved,
  onToggleSaved,
  onOpen,
  onAsk,
}: MaterialStonePagerProps) {
  const total = stones.length;
  const railKey = `${materialLabel}:${stones.map((stone) => stone.id).join("|")}`;
  const { activeIndex, railRef, onScroll, scrollToIndex } = useMomentumRail({
    itemCount: total,
    resetKey: railKey,
  });
  const safeIndex = total ? Math.min(activeIndex, total - 1) : 0;

  if (!total) return null;

  const go = (direction: -1 | 1) => {
    scrollToIndex(safeIndex + direction);
  };

  return (
    <div
      data-testid="jw-material-stone-rail"
      className="min-w-0 max-w-full overflow-hidden outline-none"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${materialLabel} stones, ${safeIndex + 1} of ${total}. Swipe or scroll left and right to browse.`}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        }
      }}
    >
      <div className="mb-3 flex items-end justify-between gap-4 sm:mb-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--jw-muted)] sm:text-[11px]"
            data-testid="jw-material-stone-status"
            aria-live="polite"
          >
            {materialLabel} · {safeIndex + 1} of {total}
          </p>
          <div
            className="mt-2.5 flex h-px overflow-hidden"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={safeIndex + 1}
            aria-label={`${materialLabel} browse position`}
            data-testid="jw-material-stone-progress"
          >
            {stones.map((stone, index) => (
              <span
                key={stone.id}
                aria-hidden="true"
                className={`h-full flex-1 transition-colors duration-300 ${
                  index <= safeIndex ? "bg-[var(--jw-accent)]" : "bg-[var(--jw-border)]"
                }`}
              />
            ))}
          </div>
        </div>

        {total > 1 ? (
          <div
            className="flex shrink-0 items-center gap-2"
            aria-label={`${materialLabel} controls`}
          >
            <button
              type="button"
              data-testid="jw-material-stone-prev"
              aria-label={`Previous ${materialLabel} stone`}
              disabled={safeIndex === 0}
              onClick={() => go(-1)}
              className={NAV_BUTTON_CLASS}
            >
              <ArrowLeft className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="jw-material-stone-next"
              aria-label={`Next ${materialLabel} stone`}
              disabled={safeIndex === total - 1}
              onClick={() => go(1)}
              className={NAV_BUTTON_CLASS}
            >
              <ArrowRight className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={railRef}
        data-testid="jw-material-stone-track"
        className="scrollbar-hide flex max-w-full cursor-grab gap-3 overflow-x-auto overscroll-x-contain px-[3%] pb-5 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] active:cursor-grabbing sm:gap-4 sm:px-[5%] lg:px-[7%] [&::-webkit-scrollbar]:hidden"
        role="list"
        onScroll={onScroll}
      >
        {stones.map((stone, index) => (
          <div
            key={stone.id}
            data-momentum-item="true"
            data-testid={`jw-material-stone-${stone.id}`}
            data-active={index === safeIndex ? "true" : "false"}
            className="min-w-[87%] flex-none sm:min-w-[72%] lg:min-w-[58%] xl:min-w-[52%]"
            role="listitem"
          >
            <StoneCard
              stone={stone}
              saved={isSaved(stone.id)}
              onToggleSaved={onToggleSaved}
              onOpen={onOpen}
              onAsk={onAsk}
              photoBrowsing={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
