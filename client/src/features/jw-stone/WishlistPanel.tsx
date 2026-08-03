import { useEffect, useState } from "react";
import { Bookmark, MessageCircle, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { JwStoneCatalogItem } from "./types";

type WishlistPanelProps = {
  open: boolean;
  items: readonly JwStoneCatalogItem[];
  restored: boolean;
  persisted: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenStone: (stone: JwStoneCatalogItem) => void;
  onAsk: (stones: readonly JwStoneCatalogItem[]) => void;
};

export function WishlistPanel({
  open,
  items,
  restored,
  persisted,
  onOpenChange,
  onRemove,
  onClear,
  onOpenStone,
  onAsk,
}: WishlistPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) setConfirmClear(false);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col border-stone-300 bg-stone-100 p-0 text-stone-950 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-stone-300 px-6 py-7 text-left sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
            Your private browser list
          </p>
          <SheetTitle className="font-editorial text-4xl font-normal text-stone-950">
            Saved stones
          </SheetTitle>
          <SheetDescription className="max-w-md leading-6 text-stone-600">
            Keep a working selection without an account. Nothing is sent to JW Stone until you
            deliberately start a request.
          </SheetDescription>
          {restored && !persisted ? (
            <p className="text-sm text-amber-900">
              Browser storage is unavailable, so this selection lasts for the current visit only.
            </p>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {items.length ? (
            <ul className="space-y-4" aria-label={`${items.length} saved stones`}>
              {items.map((stone) => (
                <li
                  key={stone.id}
                  className="grid grid-cols-[6rem_1fr_auto] gap-4 border-b border-stone-300 pb-4"
                >
                  <button
                    type="button"
                    onClick={() => onOpenStone(stone)}
                    className="aspect-square overflow-hidden bg-stone-200"
                    aria-label={`Open ${stone.publicLabel}`}
                  >
                    <img
                      src={stone.images[0]}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenStone(stone)}
                    className="self-center text-left"
                  >
                    <span className="block font-editorial text-2xl leading-tight">
                      {stone.publicLabel}
                    </span>
                    <span className="mt-1 block text-xs uppercase tracking-wider text-stone-500">
                      {[stone.materialLabel, stone.finishes.join(" / ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(stone.id)}
                    className="inline-flex h-11 w-11 items-center justify-center self-center border border-stone-300 hover:border-stone-700 hover:bg-white"
                    aria-label={`Remove ${stone.publicLabel} from saved stones`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
              <Bookmark className="h-8 w-8 text-stone-400" aria-hidden="true" />
              <h3 className="mt-5 font-editorial text-3xl">Your selection is open</h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
                Save any named stone from the collection. It will appear here when you return in
                this browser.
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-7 min-h-11 border border-stone-400 px-5 text-sm font-semibold hover:bg-white"
              >
                Continue exploring
              </button>
            </div>
          )}
        </div>

        {items.length ? (
          <div className="border-t border-stone-300 bg-white px-6 py-5 sm:px-8">
            <button
              type="button"
              onClick={() => onAsk(items)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-stone-950 px-5 font-bold text-white hover:bg-black"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Ask about {items.length === 1 ? "this stone" : `these ${items.length} stones`}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmClear) {
                  onClear();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                }
              }}
              className="mt-2 min-h-11 w-full text-sm font-semibold text-stone-600 hover:text-stone-950"
            >
              {confirmClear ? "Confirm clear saved stones" : "Clear saved stones"}
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
