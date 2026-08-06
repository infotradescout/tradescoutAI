import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

/**
 * One large stone at a time with visible Previous / Next — no swipe-as-primary.
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
  const total = stones.length;
  const safeIndex = total ? Math.min(index, total - 1) : 0;
  const stone = stones[safeIndex] ?? null;

  useEffect(() => {
    setIndex(0);
  }, [materialLabel, stones]);

  if (!stone || !total) return null;

  const go = (direction: -1 | 1) => {
    setIndex((current) => (current + direction + total) % total);
  };

  return (
    <div data-testid="jw-material-stone-rail" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-sm font-semibold text-[var(--jw-ink)]"
          data-testid="jw-material-stone-status"
        >
          {materialLabel} · {safeIndex + 1} of {total}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="jw-material-stone-prev"
            aria-label={`Previous ${materialLabel} stone`}
            onClick={() => go(-1)}
            disabled={total < 2}
            className="inline-flex min-h-11 min-w-11 items-center justify-center bg-[var(--jw-dark)] text-white disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="jw-material-stone-next"
            aria-label={`Next ${materialLabel} stone`}
            onClick={() => go(1)}
            disabled={total < 2}
            className="inline-flex min-h-11 min-w-11 items-center justify-center bg-[var(--jw-dark)] text-white disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div data-testid={`jw-material-stone-${stone.id}`}>
        <StoneCard
          stone={stone}
          saved={isSaved(stone.id)}
          onToggleSaved={onToggleSaved}
          onOpen={onOpen}
          onAsk={onAsk}
        />
      </div>
    </div>
  );
}
