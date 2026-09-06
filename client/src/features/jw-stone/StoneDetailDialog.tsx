import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { isFirstCutDetailStone } from "./firstCut";
import { JwStoneShareControl } from "./JwStoneShareControl";
import { JwStoneMemberPriceDisplay } from "./JwStoneMemberPricing";
import { firstCutShareDestination, stoneShareDestination } from "./marketplaceRoutes";
import {
  availabilityDetailLabel,
  confirmedFinishes,
  formatDimensionsForDisplay,
} from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";
import { useMomentumRail } from "./useMomentumRail";

type StoneDetailDialogProps = {
  stone: JwStoneCatalogItem | null;
  saved: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

const DETAIL_PHOTO_ARROW_CLASS =
  "absolute top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition-[background-color,border-color,opacity,transform] hover:border-white/45 hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:h-12 sm:w-12";

export function StoneDetailDialog({
  stone,
  saved,
  onOpenChange,
  onToggleSaved,
  onAsk,
}: StoneDetailDialogProps) {
  const imageCount = stone?.images.length ?? 0;
  const {
    activeIndex: imageIndex,
    railRef,
    onScroll,
    scrollToIndex,
  } = useMomentumRail({
    itemCount: imageCount,
    resetKey: stone?.id ?? "closed",
  });

  if (!stone) return null;

  const selectedImage = stone.images[imageIndex] || stone.images[0];
  const finishes = confirmedFinishes(stone);
  const availability = availabilityDetailLabel(stone);
  const dimensions = formatDimensionsForDisplay(stone.slabDimensions);
  const firstCut = isFirstCutDetailStone(stone);
  const askLabel = stone.displayName
    ? `Ask JW about ${stone.displayName}`
    : firstCut
      ? "Ask JW about this First Cut"
      : "Ask JW about this stone";
  const hasConfirmedFacts = Boolean(
    stone.materialLabel || availability || finishes.length || dimensions || stone.origin
  );
  const shareDestination = stone.shareSlug
    ? stoneShareDestination(stone.shareSlug)
    : firstCut
      ? firstCutShareDestination()
      : null;
  const shareTitle = stone.displayName || (firstCut ? "JW Stone First Cut" : "JW Stone selection");
  const shareText = stone.displayName
    ? `See ${stone.displayName} at JW Stone`
    : firstCut
      ? "See this First Cut selection at JW Stone"
      : "See this stone selection at JW Stone";

  const move = (direction: -1 | 1) => {
    if (imageCount < 2) return;
    scrollToIndex(imageIndex + direction);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        style={JW_STONE_BRAND_STYLE}
        className="fixed inset-0 left-0 top-0 z-[1000] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-x-hidden overflow-y-auto rounded-none border-0 bg-[var(--jw-bg)] p-0 text-[var(--jw-ink)] shadow-none data-[state=open]:zoom-in-100 sm:max-w-none sm:rounded-none [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:inline-flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-white/50 [&>button]:bg-[var(--jw-bg)]/90 [&>button]:text-[var(--jw-ink)] [&>button]:opacity-100 [&>button]:shadow-lg [&>button]:ring-0 [&>button]:backdrop-blur-md"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
        }}
      >
        <div className="flex min-h-full max-w-full flex-col overflow-x-hidden">
          <div
            className="relative flex-none overflow-hidden bg-[var(--jw-dark)] shadow-[0_24px_70px_rgba(30,24,18,0.16)]"
            data-testid="jw-stone-detail-media"
          >
            <div
              ref={railRef}
              data-testid="jw-stone-detail-photo-rail"
              className="scrollbar-hide flex h-[52dvh] min-h-[18rem] w-full max-w-full cursor-grab overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] active:cursor-grabbing sm:h-[62dvh] sm:min-h-[24rem] [&::-webkit-scrollbar]:hidden"
              role={imageCount > 1 ? "region" : undefined}
              aria-roledescription={imageCount > 1 ? "carousel" : undefined}
              aria-label={imageCount > 1 ? `${stone.publicLabel} photo gallery` : undefined}
              onScroll={onScroll}
            >
              {stone.images.map((image, index) => (
                <figure
                  key={`${image}-${index}`}
                  data-momentum-item="true"
                  data-testid={`jw-stone-detail-photo-${index}`}
                  className="flex h-full min-w-full flex-none items-center justify-center overflow-hidden"
                  aria-label={`Photo ${index + 1} of ${imageCount}`}
                >
                  <img
                    src={image}
                    alt={
                      stone.displayName
                        ? `${stone.displayName} stone, view ${index + 1}`
                        : `JW Stone selection, view ${index + 1}`
                    }
                    draggable={false}
                    className="h-full w-full select-none object-contain"
                  />
                </figure>
              ))}
            </div>
            {imageCount > 1 ? (
              <>
                <button
                  type="button"
                  data-testid="jw-stone-detail-photo-prev"
                  onClick={() => move(-1)}
                  aria-label="Previous stone image"
                  disabled={imageIndex === 0}
                  className={`${DETAIL_PHOTO_ARROW_CLASS} left-3`}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="jw-stone-detail-photo-next"
                  onClick={() => move(1)}
                  aria-label="Next stone image"
                  disabled={imageIndex === imageCount - 1}
                  className={`${DETAIL_PHOTO_ARROW_CLASS} right-3`}
                >
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-md">
                  {imageIndex + 1} / {imageCount}
                </div>
              </>
            ) : null}
          </div>

          {imageCount > 1 ? (
            <ul
              className="scrollbar-hide flex max-w-full gap-2.5 overflow-x-auto overscroll-x-contain border-b border-[var(--jw-border)] px-5 py-4 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:px-9 [&::-webkit-scrollbar]:hidden"
              data-testid="jw-stone-detail-photo-thumbs"
            >
              {stone.images.map((image, index) => (
                <li key={`${image}-${index}`} className="shrink-0">
                  <button
                    type="button"
                    data-testid={`jw-stone-detail-photo-thumb-${index}`}
                    onClick={() => scrollToIndex(index)}
                    aria-label={`Show image ${index + 1} of ${imageCount}`}
                    aria-current={index === imageIndex ? "true" : undefined}
                    className={`h-14 w-16 overflow-hidden border bg-[var(--jw-surface)] transition-[border-color,opacity,transform] sm:h-16 sm:w-20 ${
                      index === imageIndex
                        ? "border-[var(--jw-accent)] opacity-100 ring-1 ring-[var(--jw-accent)] ring-offset-2 ring-offset-[var(--jw-bg)]"
                        : "border-[var(--jw-border)] opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={image}
                      alt=""
                      className="h-full w-full object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col px-5 pt-5 sm:px-9 sm:pt-7">
              <DialogTitle className="font-editorial text-3xl font-normal leading-tight text-[var(--jw-ink)] sm:text-4xl">
                {stone.displayName || stone.publicLabel}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Image {imageIndex + 1} of {imageCount}. Confirmed stone details and inquiry.
              </DialogDescription>

              {hasConfirmedFacts ? (
                <dl className="mt-5 space-y-3 text-sm sm:mt-6">
                  {stone.materialLabel ? (
                    <div>
                      <dt className={jw.muted}>Material</dt>
                      <dd className="mt-0.5 font-medium">{stone.materialLabel}</dd>
                    </div>
                  ) : null}
                  {availability ? (
                    <div>
                      <dt className={jw.muted}>Availability</dt>
                      <dd className="mt-0.5 font-medium">{availability}</dd>
                    </div>
                  ) : null}
                  {finishes.length ? (
                    <div>
                      <dt className={jw.muted}>Finish</dt>
                      <dd className="mt-0.5 font-medium">{finishes.join(" / ")}</dd>
                    </div>
                  ) : null}
                  {dimensions ? (
                    <div>
                      <dt className={jw.muted}>Approximate slab dimensions</dt>
                      <dd className="mt-0.5 font-medium">{dimensions}</dd>
                    </div>
                  ) : null}
                  {stone.origin ? (
                    <div>
                      <dt className={jw.muted}>Country of origin</dt>
                      <dd className="mt-0.5 font-medium">{stone.origin.country}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p
                  className={`mt-5 max-w-md text-sm leading-6 sm:mt-6 ${jw.muted}`}
                  data-testid="jw-stone-detail-pending"
                >
                  {firstCut
                    ? "First Cut Exclusive — material, finish, and availability confirmed on request."
                    : "Details pending — ask JW for material and availability."}
                </p>
              )}

              <JwStoneMemberPriceDisplay
                stoneName={stone.displayName}
                slabDimensions={stone.slabDimensions}
                presentation="detail"
              />
            </div>

            <div
              className="sticky bottom-0 mt-8 space-y-3 border-t border-[var(--jw-border)] bg-[var(--jw-bg)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:mt-10 sm:px-9"
              data-testid="jw-stone-detail-actions"
            >
              <button
                type="button"
                onClick={() => onAsk(stone)}
                data-testid="jw-stone-detail-ask"
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.accentCta}`}
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {askLabel}
              </button>
              {shareDestination ? (
                <JwStoneShareControl
                  destination={shareDestination}
                  title={shareTitle}
                  text={shareText}
                  imageUrl={selectedImage}
                  label="Share this stone"
                  className={`inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 sm:min-h-12 ${jw.ghostOnLight}`}
                />
              ) : null}
              {stone.wishlistEligible ? (
                <button
                  type="button"
                  onClick={() => onToggleSaved(stone)}
                  aria-pressed={saved}
                  data-testid="jw-stone-detail-save"
                  className={`inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 sm:min-h-12 ${jw.ghostOnLight}`}
                >
                  {saved ? (
                    <BookmarkCheck className="h-5 w-5 text-[var(--jw-accent)]" aria-hidden="true" />
                  ) : (
                    <Bookmark className="h-5 w-5" aria-hidden="true" />
                  )}
                  {saved ? "Remove from saved stones" : "Save this stone"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
