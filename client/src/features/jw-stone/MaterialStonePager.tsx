import { useEffect, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { StoneCard } from "./StoneCard";
import type { JwStoneCatalogItem } from "./types";

type MaterialStonePagerProps = {
  materialLabel: string;
  stones: readonly JwStoneCatalogItem[];
  isSaved: (id: string) => boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

type SlideDirection = -1 | 1;

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-[var(--jw-dark)]/75 text-white backdrop-blur-[1px] transition-[background-color,transform] hover:bg-[var(--jw-dark)]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95 sm:h-12 sm:w-12";

/**
 * One large stone at a time with prev/next on the photograph edges —
 * header stays a quiet position line + progress, not detached chrome.
 */
export function MaterialStonePager({
  materialLabel,
  stones,
  isSaved,
  onToggleSaved,
  onOpen,
  onAsk,
}: MaterialStonePagerProps) {
  const [index, setIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<SlideDirection>(1);
  const total = stones.length;
  const safeIndex = total ? Math.min(index, total - 1) : 0;
  const stone = stones[safeIndex] ?? null;
  const progressPct = total ? ((safeIndex + 1) / total) * 100 : 0;

  useEffect(() => {
    setIndex(0);
    setSlideDir(1);
  }, [materialLabel, stones]);

  if (!stone || !total) return null;

  const go = (direction: SlideDirection) => {
    if (total < 2) return;
    setSlideDir(direction);
    setIndex((current) => (current + direction + total) % total);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  };

  const slideClass =
    slideDir === 1
      ? "animate-in fade-in slide-in-from-right-2 duration-300"
      : "animate-in fade-in slide-in-from-left-2 duration-300";

  return (
    <div
      data-testid="jw-material-stone-rail"
      className="min-w-0 outline-none"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${materialLabel} stones, ${safeIndex + 1} of ${total}. Use left and right arrow keys to browse.`}
      onKeyDown={onKeyDown}
    >
      <div className="mb-2.5 sm:mb-3">
        <p
          className="text-xs font-medium tracking-wide text-[var(--jw-muted)] sm:text-sm"
          data-testid="jw-material-stone-status"
        >
          {materialLabel} · {safeIndex + 1} of {total}
        </p>
        <div
          className="mt-2 h-0.5 overflow-hidden bg-[var(--jw-border)]"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={safeIndex + 1}
          aria-label={`${materialLabel} browse position`}
          data-testid="jw-material-stone-progress"
        >
          <div
            className="h-full bg-[var(--jw-dark)] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div key={stone.id} data-testid={`jw-material-stone-${stone.id}`} className={slideClass}>
        <StoneCard
          stone={stone}
          saved={isSaved(stone.id)}
          onToggleSaved={onToggleSaved}
          onOpen={onOpen}
          onAsk={onAsk}
          mediaChrome={
            total > 1 ? (
              <>
                <button
                  type="button"
                  data-testid="jw-material-stone-prev"
                  aria-label={`Previous ${materialLabel} stone`}
                  onClick={() => go(-1)}
                  className={`${NAV_BUTTON_CLASS} left-2 sm:left-3`}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="jw-material-stone-next"
                  aria-label={`Next ${materialLabel} stone`}
                  onClick={() => go(1)}
                  className={`${NAV_BUTTON_CLASS} right-2 sm:right-3`}
                >
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null
          }
        />
      </div>
    </div>
  );
}
