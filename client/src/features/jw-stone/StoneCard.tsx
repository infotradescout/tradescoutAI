import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { jw } from "./brand";
import { JwStoneShareControl } from "./JwStoneShareControl";
import { JwStoneTopSellerBadge } from "./JwStoneTopSellerBadge";
import { stoneShareDestination } from "./marketplaceRoutes";
import { availabilityDimensionsLine, materialFinishLine } from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";
import { useMomentumRail } from "./useMomentumRail";

type StoneCardProps = {
  stone: JwStoneCatalogItem;
  saved: boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  /** Disable the photo rail when this card already lives inside a stone rail. */
  photoBrowsing?: boolean;
};

const PHOTO_ARROW_CLASS =
  "absolute top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition-[background-color,border-color,opacity,transform] hover:border-white/45 hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:h-12 sm:w-12";

/**
 * Showroom inventory tile with a stable stone-photo stage. Multi-photo cards
 * use a real horizontal overflow rail, preserving native touch/trackpad inertia
 * without changing the card or viewport height between images.
 */
export function StoneCard({
  stone,
  saved,
  onToggleSaved,
  onOpen,
  onAsk,
  photoBrowsing = true,
}: StoneCardProps) {
  const imageCount = stone.images.length;
  const visibleImages = photoBrowsing ? stone.images : stone.images.slice(0, 1);
  const galleryCount = visibleImages.length;
  const {
    activeIndex: imageIndex,
    railRef,
    onScroll,
    scrollToIndex,
  } = useMomentumRail({
    itemCount: galleryCount,
    resetKey: `${stone.id}:${photoBrowsing ? "gallery" : "cover"}`,
  });
  const cardRef = useRef<HTMLElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [requestedImageIndexes, setRequestedImageIndexes] = useState<Set<number>>(
    () => new Set(galleryCount > 1 ? [0, 1] : [0])
  );
  const selectedImage = visibleImages[imageIndex] || stone.images[0];
  const hasPhotoRail = galleryCount > 1;
  const meta = materialFinishLine(stone);
  const facts = availabilityDimensionsLine(stone);
  const title = stone.displayName || "";
  const caption = [meta, facts].filter(Boolean).join(" · ");

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      {
        rootMargin: "800px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setRequestedImageIndexes((current) => {
      const next = new Set(current);
      next.add(imageIndex);
      if (imageIndex + 1 < galleryCount) next.add(imageIndex + 1);
      return next.size === current.size ? current : next;
    });
  }, [galleryCount, imageIndex]);

  const photoAlt = (index: number) =>
    stone.displayName
      ? `${stone.displayName} stone photograph${imageCount > 1 ? `, view ${index + 1} of ${imageCount}` : ""}`
      : `Stone selection photograph from JW Stone${
          imageCount > 1 ? `, view ${index + 1} of ${imageCount}` : ""
        }`;

  return (
    <article
      ref={cardRef}
      data-stone-card="true"
      data-stone-id={stone.id}
      data-photo-count={imageCount}
      className="group mx-auto w-full min-w-0 max-w-[1120px]"
      data-anonymous={stone.anonymous ? "true" : "false"}
    >
      <div
        data-testid="jw-stone-card-media"
        className="relative isolate aspect-[4/3] max-w-full overflow-hidden bg-[var(--jw-dark)] shadow-[0_24px_70px_rgba(30,24,18,0.13)] ring-1 ring-black/10 sm:aspect-[16/10]"
      >
        <div
          ref={railRef}
          data-testid="jw-stone-card-photo-rail"
          className="scrollbar-hide flex h-full w-full max-w-full cursor-grab overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
          role={hasPhotoRail ? "region" : undefined}
          aria-roledescription={hasPhotoRail ? "carousel" : undefined}
          aria-label={hasPhotoRail ? `${stone.publicLabel} photos` : undefined}
          onScroll={onScroll}
        >
          {visibleImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              data-momentum-item="true"
              data-testid={`jw-stone-card-photo-${index}`}
              onClick={() => onOpen(stone)}
              className="relative block h-full min-w-full flex-none overflow-hidden"
              aria-label={`Open ${stone.publicLabel}, photo ${index + 1} of ${imageCount}`}
            >
              <img
                src={nearViewport && requestedImageIndexes.has(index) ? image : undefined}
                alt={photoAlt(index)}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                draggable={false}
                onLoad={(event) => {
                  delete event.currentTarget.dataset.retryCount;
                }}
                onError={(event) => {
                  const target = event.currentTarget;
                  const retryCount = Number(target.dataset.retryCount || "0");
                  if (retryCount >= 3) return;

                  const nextRetry = retryCount + 1;
                  const retryDelayMs = 600 * 2 ** retryCount;
                  target.dataset.retryCount = String(nextRetry);

                  window.setTimeout(() => {
                    if (!target.isConnected) return;
                    const separator = image.includes("?") ? "&" : "?";
                    target.src = `${image}${separator}jw_retry=${nextRetry}`;
                  }, retryDelayMs);
                }}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
              />
            </button>
          ))}
        </div>

        <JwStoneTopSellerBadge stone={stone} />

        {stone.wishlistEligible ? (
          <button
            type="button"
            onClick={() => onToggleSaved(stone)}
            aria-label={`${saved ? "Remove" : "Save"} ${stone.publicLabel}${
              saved ? " from" : " to"
            } saved stones`}
            aria-pressed={saved}
            className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/45 bg-[var(--jw-bg)]/90 text-[var(--jw-ink)] shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-md transition-[background-color,transform] hover:bg-[var(--jw-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95"
          >
            {saved ? (
              <BookmarkCheck className="h-5 w-5 text-[var(--jw-accent)]" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : null}

        {hasPhotoRail ? (
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-2 shadow-lg backdrop-blur-md"
            data-testid="jw-stone-card-photo-dots"
            role="group"
            aria-label={`Photo ${imageIndex + 1} of ${imageCount}`}
          >
            {visibleImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                data-testid={`jw-stone-card-photo-dot-${index}`}
                aria-label={`Show photo ${index + 1} of ${imageCount}`}
                aria-current={index === imageIndex ? "true" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  scrollToIndex(index);
                }}
                className={`pointer-events-auto h-1.5 rounded-full transition-[width,background-color,opacity] duration-300 ${
                  index === imageIndex
                    ? "w-5 bg-white opacity-100"
                    : "w-1.5 bg-white/60 opacity-80 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        ) : null}

        {hasPhotoRail ? (
          <>
            <button
              type="button"
              data-testid="jw-stone-card-photo-prev"
              aria-label="Previous stone photo"
              disabled={imageIndex === 0}
              onClick={(event) => {
                event.stopPropagation();
                scrollToIndex(imageIndex - 1);
              }}
              className={`${PHOTO_ARROW_CLASS} left-2 sm:left-3`}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="jw-stone-card-photo-next"
              aria-label="Next stone photo"
              disabled={imageIndex === galleryCount - 1}
              onClick={(event) => {
                event.stopPropagation();
                scrollToIndex(imageIndex + 1);
              }}
              className={`${PHOTO_ARROW_CLASS} right-2 sm:right-3`}
            >
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex flex-col items-center px-3 pb-2 pt-4 text-center sm:px-4 sm:pt-5">
        {title ? (
          <h3 className="font-editorial text-2xl leading-tight tracking-tight text-[var(--jw-ink)] sm:text-[1.75rem]">
            {title}
          </h3>
        ) : null}

        {caption ? (
          <p
            className={`mt-1.5 max-w-md text-xs leading-5 tracking-[0.03em] sm:text-sm ${jw.muted}`}
          >
            {caption}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:mt-3.5 sm:gap-4">
          <button
            type="button"
            onClick={() => onOpen(stone)}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--jw-ink)] underline decoration-[var(--jw-border-strong)] underline-offset-4 transition-colors hover:decoration-[var(--jw-ink)]"
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
              className="inline-flex min-h-9 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--jw-ink)]"
            />
          ) : null}
          {stone.wishlistEligible ? (
            <button
              type="button"
              onClick={() => onAsk(stone)}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] ${jw.accentCta}`}
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
