import { Bookmark, BookmarkCheck, Expand, MessageCircle } from "lucide-react";
import type { BuyerType, JwStoneCatalogItem } from "./types";

type StoneCardProps = {
  stone: JwStoneCatalogItem;
  buyer: BuyerType;
  saved: boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

function StoneFacts({ stone, buyer }: { stone: JwStoneCatalogItem; buyer: BuyerType }) {
  const finishes = stone.finishes.length ? stone.finishes.join(" / ") : null;

  if (buyer === "fabricator") {
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
            <dt className="uppercase tracking-wider text-stone-500">Source bundle counts</dt>
            <dd className="mt-1 font-semibold text-stone-900">
              {stone.sourceEvidence.counts.join(" · ")}
            </dd>
          </div>
        ) : null}
        {stone.origin ? (
          <div>
            <dt className="uppercase tracking-wider text-stone-500">Origin</dt>
            <dd className="mt-1 font-semibold text-stone-900">{stone.origin.country}</dd>
          </div>
        ) : null}
      </dl>
    );
  }

  if (buyer === "builder") {
    return (
      <ul className="space-y-2 border-t border-stone-300 pt-4 text-sm text-stone-700">
        {stone.materialLabel ? <li>Material · {stone.materialLabel}</li> : null}
        {finishes ? <li>Recorded finish · {finishes}</li> : null}
        {stone.sourceEvidence ? (
          <li>Source bundle counts · {stone.sourceEvidence.counts.join(" · ")}</li>
        ) : null}
      </ul>
    );
  }

  if (buyer === "designer") {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
        {stone.materialLabel ? <span>{stone.materialLabel}</span> : null}
        {finishes ? <span>{finishes}</span> : null}
        {stone.origin ? <span>{stone.origin.country}</span> : null}
      </div>
    );
  }

  return (
    <p className="text-sm leading-6 text-stone-600">
      {[stone.materialLabel, finishes].filter(Boolean).join(" · ") ||
        "Explore the photographs and ask JW Stone for the details that matter to your project."}
    </p>
  );
}

export function StoneCard({ stone, buyer, saved, onToggleSaved, onOpen, onAsk }: StoneCardProps) {
  const imageAspect = buyer === "designer" ? "aspect-[4/5]" : "aspect-[4/3]";
  const alt = stone.displayName
    ? `${stone.displayName} stone photograph`
    : "Stone selection photograph from JW Stone";

  return (
    <article
      data-stone-card="true"
      data-anonymous={stone.anonymous ? "true" : "false"}
      className={`group flex h-full flex-col border border-stone-300 bg-white ${
        buyer === "designer" ? "lg:border-0 lg:bg-transparent" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(stone)}
        className={`relative block w-full overflow-hidden bg-stone-200 text-left ${imageAspect}`}
        aria-label={`Open ${stone.publicLabel} gallery`}
      >
        <img
          src={stone.images[0]}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.025]"
        />
        <span className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center bg-stone-950/85 text-white">
          <Expand className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <div className={`flex flex-1 flex-col ${buyer === "designer" ? "p-5 lg:px-0" : "p-5"}`}>
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
          <StoneFacts stone={stone} buyer={buyer} />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
          <button
            type="button"
            onClick={() => onOpen(stone)}
            className="min-h-11 border border-stone-400 px-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
          >
            View gallery
          </button>
          <button
            type="button"
            onClick={() => onAsk(stone)}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-stone-950 px-3 text-sm font-semibold text-white hover:bg-black"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {stone.anonymous ? "Ask JW Stone" : "Ask about it"}
          </button>
        </div>
      </div>
    </article>
  );
}
