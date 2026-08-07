import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { jw } from "./brand";
import { JwStoneShareControl } from "./JwStoneShareControl";
import { stoneShareDestination } from "./marketplaceRoutes";
import { availabilityDimensionsLine, materialFinishLine } from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";

type StoneCardProps = {
  stone: JwStoneCatalogItem;
  saved: boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  /** Optional overlays inside the media frame (e.g. material-pager stone prev/next). */
  mediaChrome?: ReactNode;
};

/**
 * Showroom inventory tile — full-width stone photograph with a centered caption
 * system underneath (not a left-ragged classifieds column).
 * Actions: Save (bookmark), View stone, Ask — no color / Pairs with chrome.
 * When a stone has multiple mapped photos, shoppers can browse them on the card
 * (swipe / dots; edge arrows when this card owns the media chrome).
 */
export function StoneCard({
  stone,
  saved,
  onToggleSaved,
  onOpen,
  onAsk,
  mediaChrome,
}: StoneCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const imageCount = stone.images.length;
  const selectedImage = stone.images[imageIndex] || stone.images[0];
  const ownsPhotoArrows = imageCount > 1 && !mediaChrome;

  useEffect(() => setImageIndex(0), [stone.id]);

  const movePhoto = (direction: -1 | 1) => {
    if (imageCount < 2) return;
    setImageIndex((current) => (current + direction + imageCount) % imageCount);
  };

  const alt = stone.displayName
    ? `${stone.displayName} stone photograph${
        imageCount > 1 ? `, view ${imageIndex + 1} of ${imageCount}` : ""
      }`
    : `Stone selection photograph from JW Stone${
        imageCount > 1 ? `, view ${imageIndex + 1} of ${imageCount}` : ""
      }`;
  const meta = materialFinishLine(stone);
  const facts = availabilityDimensionsLine(stone);
  const title = stone.displayName || "";
  const caption = [meta, facts].filter(Boolean).join(" · ");

  return (
    <article
      data-stone-card="true"
      data-stone-id={stone.id}
      data-photo-count={imageCount}
      className="group"
      data-anonymous={stone.anonymous ? "true" : "false"}
    >
      <div
        className="relative bg-[var(--jw-dark)]"
        onTouchStart={(event) => {
          if (imageCount < 2) return;
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (imageCount < 2) return;
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start == null || end == null || Math.abs(start - end) < 45) return;
          movePhoto(start > end ? 1 : -1);
        }}
      >
        <button
          type="button"
          onClick={() => onOpen(stone)}
          className="block w-full"
          aria-label={`Open ${stone.publicLabel}`}
        >
          <img
            src={selectedImage}
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
            className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center bg-[var(--jw-bg)]/85 text-[var(--jw-ink)] backdrop-blur-[2px] transition-colors hover:bg-[var(--jw-bg)]"
          >
            {saved ? (
              <BookmarkCheck className="h-5 w-5 text-[var(--jw-accent)]" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
        {imageCount > 1 ? (
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5"
            data-testid="jw-stone-card-photo-dots"
            role="group"
            aria-label={`Photo ${imageIndex + 1} of ${imageCount}`}
          >
            {stone.images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                data-testid={`jw-stone-card-photo-dot-${index}`}
                aria-label={`Show photo ${index + 1} of ${imageCount}`}
                aria-current={index === imageIndex ? "true" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  setImageIndex(index);
                }}
                className={`pointer-events-auto h-2.5 w-2.5 rounded-full transition-opacity ${
                  index === imageIndex
                    ? "bg-white opacity-100"
                    : "bg-white/55 opacity-80 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        ) : null}
        {ownsPhotoArrows ? (
          <>
            <button
              type="button"
              data-testid="jw-stone-card-photo-prev"
              aria-label="Previous stone photo"
              onClick={(event) => {
                event.stopPropagation();
                movePhoto(-1);
              }}
              className="absolute left-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-[var(--jw-dark)]/75 text-white backdrop-blur-[1px] transition-[background-color,transform] hover:bg-[var(--jw-dark)]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95 sm:left-3 sm:h-12 sm:w-12"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="jw-stone-card-photo-next"
              aria-label="Next stone photo"
              onClick={(event) => {
                event.stopPropagation();
                movePhoto(1);
              }}
              className="absolute right-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-[var(--jw-dark)]/75 text-white backdrop-blur-[1px] transition-[background-color,transform] hover:bg-[var(--jw-dark)]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95 sm:right-3 sm:h-12 sm:w-12"
            >
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
        {mediaChrome}
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
          {stone.wishlistEligible && stone.shareSlug ? (
            <JwStoneShareControl
              destination={stoneShareDestination(stone.shareSlug)}
              title={stone.displayName || "JW Stone selection"}
              text={
                stone.displayName
                  ? `See ${stone.displayName} at JW Stone`
                  : "See this stone selection at JW Stone"
              }
              imageUrl={selectedImage}
              label="Share"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--jw-ink)]"
            />
          ) : null}
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
