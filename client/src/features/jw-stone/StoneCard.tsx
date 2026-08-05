import { Bookmark, BookmarkCheck } from "lucide-react";
import { jw } from "./brand";
import { availabilityDimensionsLine, materialFinishLine } from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";

type StoneCardProps = {
  stone: JwStoneCatalogItem;
  saved: boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
};

/**
 * Single-column editorial inventory row — photo-led, no bordered product box,
 * no Ask CTA (Ask lives only in detail).
 */
export function StoneCard({ stone, saved, onToggleSaved, onOpen }: StoneCardProps) {
  const alt = stone.displayName
    ? `${stone.displayName} stone photograph`
    : "Stone selection photograph from JW Stone";
  const meta = materialFinishLine(stone);
  const facts = availabilityDimensionsLine(stone);
  const title = stone.displayName || "";

  return (
    <article
      data-stone-card="true"
      data-stone-id={stone.id}
      data-anonymous={stone.anonymous ? "true" : "false"}
      className="group"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(stone)}
          className="block w-full overflow-hidden bg-[var(--jw-bg)] text-left"
          aria-label={`Open ${stone.publicLabel}`}
        >
          <img
            src={stone.images[0]}
            alt={alt}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015] sm:aspect-[5/4]"
          />
        </button>
        {stone.wishlistEligible ? (
          <button
            type="button"
            onClick={() => onToggleSaved(stone)}
            aria-label={`${saved ? "Remove" : "Save"} ${stone.publicLabel}${
              saved ? " from" : " to"
            } saved stones`}
            aria-pressed={saved}
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center bg-[var(--jw-bg)]/85 text-[var(--jw-ink)] backdrop-blur-[2px] transition-colors hover:bg-[var(--jw-bg)]"
          >
            {saved ? (
              <BookmarkCheck className="h-5 w-5 text-[var(--jw-accent)]" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      <div className="pt-3.5 sm:pt-4">
        {title ? (
          <h3 className="font-editorial text-2xl leading-tight text-[var(--jw-ink)] sm:text-[1.75rem]">
            {title}
          </h3>
        ) : null}

        {meta ? <p className={`mt-1.5 text-sm leading-5 ${jw.muted}`}>{meta}</p> : null}
        {facts ? <p className={`mt-1 text-sm leading-5 ${jw.muted}`}>{facts}</p> : null}

        <button
          type="button"
          onClick={() => onOpen(stone)}
          className="mt-2.5 text-sm font-medium text-[var(--jw-ink)] underline underline-offset-4 decoration-[var(--jw-border-strong)] transition-colors hover:decoration-[var(--jw-ink)]"
        >
          View stone
        </button>
      </div>
    </article>
  );
}
