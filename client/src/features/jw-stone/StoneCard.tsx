import { Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { jw } from "./brand";
import { availabilityDimensionsLine, materialFinishLine } from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";

type StoneCardProps = {
  stone: JwStoneCatalogItem;
  saved: boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

/**
 * Showroom inventory tile — full-width stone photograph with a centered caption
 * system underneath (not a left-ragged classifieds column).
 * Actions: Save (bookmark), View stone, Ask — no color / Pairs with chrome.
 */
export function StoneCard({ stone, saved, onToggleSaved, onOpen, onAsk }: StoneCardProps) {
  const alt = stone.displayName
    ? `${stone.displayName} stone photograph`
    : "Stone selection photograph from JW Stone";
  const meta = materialFinishLine(stone);
  const facts = availabilityDimensionsLine(stone);
  const title = stone.displayName || "";
  const caption = [meta, facts].filter(Boolean).join(" · ");

  return (
    <article
      data-stone-card="true"
      data-stone-id={stone.id}
      className="group"
      data-anonymous={stone.anonymous ? "true" : "false"}
    >
      <div className="relative bg-[var(--jw-dark)]">
        <button
          type="button"
          onClick={() => onOpen(stone)}
          className="block w-full"
          aria-label={`Open ${stone.publicLabel}`}
        >
          <img
            src={stone.images[0]}
            alt={alt}
            loading="lazy"
            className="mx-auto block h-auto w-full object-contain"
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

      <div className="flex flex-col items-center px-3 pb-1 pt-3 text-center sm:px-4 sm:pt-3.5">
        {title ? (
          <h3 className="font-editorial text-xl leading-tight tracking-tight text-[var(--jw-ink)] sm:text-2xl">
            {title}
          </h3>
        ) : null}

        {caption ? (
          <p className={`mt-1 max-w-md text-xs leading-5 tracking-wide sm:text-sm ${jw.muted}`}>
            {caption}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onOpen(stone)}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--jw-ink)] underline decoration-[var(--jw-border-strong)] underline-offset-4 transition-colors hover:decoration-[var(--jw-ink)]"
          >
            View stone
          </button>
          {stone.wishlistEligible ? (
            <button
              type="button"
              onClick={() => onAsk(stone)}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 px-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] sm:min-h-10 sm:px-4 ${jw.accentCta}`}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Ask
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
