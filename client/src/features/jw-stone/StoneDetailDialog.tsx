import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import {
  availabilityDetailLabel,
  confirmedFinishes,
  formatDimensionsForDisplay,
} from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";

type StoneDetailDialogProps = {
  stone: JwStoneCatalogItem | null;
  saved: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

export function StoneDetailDialog({
  stone,
  saved,
  onOpenChange,
  onToggleSaved,
  onAsk,
}: StoneDetailDialogProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => setImageIndex(0), [stone?.id]);

  if (!stone) return null;

  const imageCount = stone.images.length;
  const selectedImage = stone.images[imageIndex] || stone.images[0];
  const finishes = confirmedFinishes(stone);
  const availability = availabilityDetailLabel(stone);
  const dimensions = formatDimensionsForDisplay(stone.slabDimensions);
  const askLabel = stone.displayName
    ? `Ask JW about ${stone.displayName}`
    : "Ask JW about this stone";

  const move = (direction: -1 | 1) => {
    if (imageCount < 2) return;
    setImageIndex((current) => (current + direction + imageCount) % imageCount);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        style={JW_STONE_BRAND_STYLE}
        className="fixed inset-0 left-0 top-0 z-[1000] flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-[var(--jw-bg)] p-0 text-[var(--jw-ink)] shadow-none data-[state=open]:zoom-in-100 sm:max-w-none sm:rounded-none [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:inline-flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:bg-[var(--jw-bg)]/85 [&>button]:text-[var(--jw-ink)] [&>button]:opacity-100 [&>button]:ring-0 [&>button]:backdrop-blur-[2px]"
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
        <div className="flex min-h-full flex-col">
          <div
            className="relative bg-[var(--jw-bg)]"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = touchStartX.current;
              const end = event.changedTouches[0]?.clientX;
              touchStartX.current = null;
              if (start == null || end == null || Math.abs(start - end) < 45) return;
              move(start > end ? 1 : -1);
            }}
          >
            <img
              src={selectedImage}
              alt={
                stone.displayName
                  ? `${stone.displayName} stone, view ${imageIndex + 1}`
                  : `JW Stone selection, view ${imageIndex + 1}`
              }
              className="mx-auto block h-auto max-h-[70dvh] w-auto max-w-full"
            />
            {imageCount > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="Previous stone image"
                  className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-black/70 text-white"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Next stone image"
                  className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-black/70 text-white"
                >
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>

          {imageCount > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-9" role="list">
              {stone.images.map((image, index) => (
                <button
                  type="button"
                  role="listitem"
                  key={`${image}-${index}`}
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show image ${index + 1} of ${imageCount}`}
                  aria-current={index === imageIndex ? "true" : undefined}
                  className={`h-14 w-16 shrink-0 overflow-hidden bg-[var(--jw-surface)] sm:h-16 sm:w-20 ${
                    index === imageIndex
                      ? "ring-2 ring-[var(--jw-accent)] ring-offset-2"
                      : "opacity-70"
                  }`}
                >
                  <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col px-5 pt-5 sm:px-9 sm:pt-7">
              <DialogTitle className="font-editorial text-3xl font-normal leading-tight text-[var(--jw-ink)] sm:text-4xl">
                {stone.displayName || stone.publicLabel}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Image {imageIndex + 1} of {imageCount}. Confirmed stone details and inquiry.
              </DialogDescription>

              <dl className="mt-5 space-y-3 text-sm sm:mt-6">
                {stone.materialLabel ? (
                  <div>
                    <dt className={jw.muted}>Material</dt>
                    <dd className="mt-0.5 font-medium">{stone.materialLabel}</dd>
                  </div>
                ) : null}
                {availability ? (
                  <div>
                    <dt className={jw.muted}>Available now</dt>
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
                    <dt className={jw.muted}>Origin</dt>
                    <dd className="mt-0.5 font-medium">{stone.origin.country}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {stone.wishlistEligible ? (
              <div className="sticky bottom-0 mt-8 space-y-3 border-t border-[var(--jw-border)] bg-[var(--jw-bg)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:mt-10 sm:px-9">
                <button
                  type="button"
                  onClick={() => onAsk(stone)}
                  className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 ${jw.accentCta}`}
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  {askLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSaved(stone)}
                  aria-pressed={saved}
                  className={`inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 sm:min-h-12 ${jw.ghostOnLight}`}
                >
                  {saved ? (
                    <BookmarkCheck className="h-5 w-5 text-[var(--jw-accent)]" aria-hidden="true" />
                  ) : (
                    <Bookmark className="h-5 w-5" aria-hidden="true" />
                  )}
                  {saved ? "Remove from saved stones" : "Save this stone"}
                </button>
              </div>
            ) : (
              <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
