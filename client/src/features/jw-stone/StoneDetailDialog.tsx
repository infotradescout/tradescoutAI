import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { StonePalette } from "./StonePalette";
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
        className="fixed inset-0 left-0 top-0 z-[1000] flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-[#f5f0e6] p-0 text-[#171717] shadow-none data-[state=open]:zoom-in-100 sm:max-w-none sm:rounded-none [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:inline-flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:bg-[#f5f0e6]/85 [&>button]:text-[#171717] [&>button]:opacity-100 [&>button]:ring-0 [&>button]:backdrop-blur-[2px]"
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
            className="relative bg-[var(--jw-dark)]"
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
              className="max-h-[58dvh] w-full object-contain sm:max-h-[68dvh]"
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
                  className={`h-14 w-16 shrink-0 overflow-hidden sm:h-16 sm:w-20 ${
                    index === imageIndex
                      ? "ring-2 ring-[var(--jw-accent)] ring-offset-2"
                      : "opacity-70"
                  }`}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-9 sm:pt-7">
            <DialogTitle className="font-editorial text-3xl font-normal leading-tight text-[var(--jw-ink)] sm:text-4xl">
              {stone.displayName || ""}
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
            </dl>

            {stone.colorSwatches.length ? (
              <div className="mt-6 sm:mt-7">
                <StonePalette
                  colorSwatches={stone.colorSwatches}
                  pairingSwatches={stone.pairingSwatches}
                  size="md"
                  showLabels
                />
              </div>
            ) : null}

            {stone.wishlistEligible ? (
              <div className="mt-8 space-y-3 sm:mt-10">
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
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
