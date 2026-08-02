import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { BuyerType, JwStoneCatalogItem } from "./types";

type StoneDetailDialogProps = {
  stone: JwStoneCatalogItem | null;
  buyer: BuyerType;
  saved: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

export function StoneDetailDialog({
  stone,
  buyer,
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
  const selectedImageFinishes = stone.imageFinishes?.[imageIndex];
  const move = (direction: -1 | 1) => {
    if (imageCount < 2) return;
    setImageIndex((current) => (current + direction + imageCount) % imageCount);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[94vh] overflow-y-auto border-stone-700 bg-stone-950 p-0 text-stone-50 sm:max-w-6xl"
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
        <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
          <div className="bg-black">
            <div
              className="relative flex min-h-[50vh] items-center justify-center lg:min-h-[78vh]"
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
                className="max-h-[78vh] w-full object-contain"
              />
              {imageCount > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    aria-label="Previous stone image"
                    className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-black/75 text-white hover:bg-black"
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    aria-label="Next stone image"
                    className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-black/75 text-white hover:bg-black"
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>

            {imageCount > 1 ? (
              <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-3" role="list">
                {stone.images.map((image, index) => (
                  <button
                    type="button"
                    role="listitem"
                    key={`${image}-${index}`}
                    onClick={() => setImageIndex(index)}
                    aria-label={`Show image ${index + 1} of ${imageCount}`}
                    aria-current={index === imageIndex ? "true" : undefined}
                    className={`h-16 w-20 shrink-0 overflow-hidden border-2 ${
                      index === imageIndex ? "border-amber-200" : "border-transparent opacity-65"
                    }`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col p-6 sm:p-9 lg:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
              {buyer === "designer"
                ? "Designer selection"
                : buyer === "fabricator"
                  ? "Fabricator detail"
                  : buyer === "builder"
                    ? "Project detail"
                    : "Stone detail"}
            </p>
            <DialogTitle className="mt-4 font-editorial text-4xl font-normal leading-none text-stone-50 sm:text-5xl">
              {stone.publicLabel}
            </DialogTitle>
            <DialogDescription className="mt-4 text-sm leading-6 text-stone-400">
              Image {imageIndex + 1} of {imageCount}. Use the arrow keys or swipe to move through
              the gallery.
            </DialogDescription>

            <dl className="mt-8 divide-y divide-white/10 border-y border-white/10 text-sm">
              {stone.materialLabel ? (
                <div className="flex justify-between gap-5 py-4">
                  <dt className="text-stone-400">Material</dt>
                  <dd className="text-right font-semibold">{stone.materialLabel}</dd>
                </div>
              ) : null}
              {stone.finishes.length ? (
                <div className="flex justify-between gap-5 py-4">
                  <dt className="text-stone-400">Verified finish</dt>
                  <dd className="text-right font-semibold">{stone.finishes.join(" / ")}</dd>
                </div>
              ) : null}
              {selectedImageFinishes?.length ? (
                <div className="flex justify-between gap-5 py-4">
                  <dt className="text-stone-400">This image</dt>
                  <dd className="text-right font-semibold">{selectedImageFinishes.join(" / ")}</dd>
                </div>
              ) : null}
              {stone.sourceEvidence ? (
                <div className="flex justify-between gap-5 py-4">
                  <dt className="text-stone-400">Source bundle counts</dt>
                  <dd className="text-right font-semibold">
                    {stone.sourceEvidence.counts.join(" · ")}
                  </dd>
                </div>
              ) : null}
              {stone.origin ? (
                <div className="flex justify-between gap-5 py-4">
                  <dt className="text-stone-400">Country of origin</dt>
                  <dd className="text-right font-semibold">{stone.origin.country}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-auto space-y-3 pt-9">
              {stone.wishlistEligible ? (
                <button
                  type="button"
                  onClick={() => onToggleSaved(stone)}
                  aria-pressed={saved}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-white/30 px-5 font-semibold hover:border-white hover:bg-white/5"
                >
                  {saved ? (
                    <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Bookmark className="h-5 w-5" aria-hidden="true" />
                  )}
                  {saved ? "Remove from saved stones" : "Save this stone"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onAsk(stone)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-stone-100 px-5 font-bold text-stone-950 hover:bg-white"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {stone.anonymous ? "Ask JW Stone about availability" : "Ask about this stone"}
              </button>
              <p className="text-center text-xs leading-5 text-stone-500">
                Saving stays in this browser. Contact starts only when you choose an inquiry.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
