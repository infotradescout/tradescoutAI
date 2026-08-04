import { Bookmark, BookmarkCheck, Expand, MessageCircle } from "lucide-react";
import type { JwStoneCatalogItem } from "./types";

type StoneCardProps = {
  stone: JwStoneCatalogItem;
  saved: boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

function StoneFacts({ stone }: { stone: JwStoneCatalogItem }) {
  const finishes = stone.finishes.length ? stone.finishes.join(" / ") : null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-300 pt-4 text-xs">
      {stone.materialLabel ? (
        <div>
          <dt className="uppercase tracking-wider text-stone-500">Material</dt>
          <dd className="mt-1 font-semibold text-stone-900">{stone.materialLabel}</dd>
        </div>
      ) : null}
      {finishes ? (
        <div>
          <dt className="uppercase tracking-wider text-stone-500">Finish</dt>
          <dd className="mt-1 font-semibold text-stone-900">{finishes}</dd>
        </div>
      ) : null}
      {stone.sourceEvidence ? (
        <div>
          <dt className="uppercase tracking-wider text-stone-500">Recorded source counts</dt>
          <dd className="mt-1 font-semibold text-stone-900">
            {stone.sourceEvidence.counts.join(" · ")}
          </dd>
        </div>
      ) : null}
      {stone.origin ? (
        <div>
          <dt className="uppercase tracking-wider text-stone-500">Verified origin</dt>
          <dd className="mt-1 font-semibold text-stone-900">{stone.origin.country}</dd>
        </div>
      ) : null}
      <div>
        <dt className="uppercase tracking-wider text-stone-500">Supplied views</dt>
        <dd className="mt-1 font-semibold text-stone-900">{stone.images.length}</dd>
      </div>
    </dl>
  );
}

export function StoneCard({ stone, saved, onToggleSaved, onOpen, onAsk }: StoneCardProps) {
  const alt = stone.displayName
    ? `${stone.displayName} stone photograph`
    : "Stone selection photograph from JW Stone";

  return (
    <article
      data-stone-card="true"
      data-stone-id={stone.id}
      data-anonymous={stone.anonymous ? "true" : "false"}
      className="group flex h-full flex-col border border-stone-300 bg-white"
    >
      <button
        type="button"
        onClick={() => onOpen(stone)}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-stone-200 text-left"
        aria-label={`Open ${stone.publicLabel} gallery`}
      >
        <img
          src={stone.images[0]}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center bg-stone-950/85 text-white">
          <Expand className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
              {stone.materialLabel || "JW Stone selection"}
            </p>
            <h3 className="mt-2 font-editorial text-2xl leading-tight text-stone-950">
              {stone.publicLabel}
            </h3>
          </div>
          {stone.wishlistEligible ? (
            <button
              type="button"
              onClick={() => onToggleSaved(stone)}
              aria-label={`${saved ? "Remove" : "Save"} ${stone.publicLabel}${
                saved ? " from" : " to"
              } saved stones`}
              aria-pressed={saved}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-stone-300 text-stone-800 transition-colors hover:border-stone-700 hover:bg-stone-100"
            >
              {saved ? (
                <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Bookmark className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>

        <div className="mt-5">
          <StoneFacts stone={stone} />
        </div>

        <div className={`mt-auto grid gap-2 pt-6 ${stone.wishlistEligible ? "grid-cols-2" : ""}`}>
          <button
            type="button"
            onClick={() => onOpen(stone)}
            className="min-h-11 border border-stone-400 px-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
          >
            View gallery
          </button>
          {stone.wishlistEligible ? (
            <button
              type="button"
              onClick={() => onAsk(stone)}
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-stone-950 px-3 text-sm font-semibold text-white hover:bg-black"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Ask about this stone
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
