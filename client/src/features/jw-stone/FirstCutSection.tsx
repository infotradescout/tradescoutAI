import {
  buildFirstCutPresentation,
  resolveFirstCutDetailStone,
  type FirstCutPresentation,
} from "./firstCut";
import { jw } from "./brand";
import type { JwStoneCatalogItem } from "./types";

type FirstCutSectionProps = {
  onOpen?: (stone: JwStoneCatalogItem) => void;
};

type TileRole = "lead" | "support";

/** Cache-bust so updated first-cut assets are not stuck behind an old empty response. */
const FIRST_CUT_PHOTO_CACHE_BUST = "green-bookmatch-lead-1";

function tileImageSrc(item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>): string {
  if (item.kind === "stone") return item.stone.images[0] ?? "";
  return `${item.imageSrc}?v=${FIRST_CUT_PHOTO_CACHE_BUST}`;
}

function tileAriaLabel(item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>): string {
  if (item.kind === "stone") return item.stone.publicLabel;
  return "First Cut stone";
}

function tileAspectClass(role: TileRole): string {
  return role === "lead"
    ? "aspect-[2/1] lg:aspect-[12/5]"
    : "aspect-[4/3] sm:aspect-[3/2] lg:aspect-[8/5]";
}

export function FirstCutSection({ onOpen }: FirstCutSectionProps) {
  const presentation = buildFirstCutPresentation().slice(0, 3);
  const [lead, ...support] = presentation;
  const hasStones = presentation.some((item) => item.kind === "stone");
  const hasPhotos = presentation.some((item) => item.kind === "photo");

  const ariaLabel = hasStones
    ? "First Cut selections"
    : hasPhotos
      ? "First Cut photos"
      : "Upcoming First Cut placements";

  const renderMedia = (
    item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>,
    role: TileRole
  ) => {
    const testId =
      item.kind === "stone"
        ? `jw-first-cut-stone-${item.stone.id}`
        : `jw-first-cut-photo-${item.id}`;

    return (
      <button
        key={item.kind === "stone" ? item.stone.id : item.id}
        type="button"
        data-testid={testId}
        data-first-cut-photo={item.kind === "photo" ? "true" : undefined}
        data-first-cut-lead={role === "lead" ? "true" : undefined}
        data-first-cut-support={role === "support" ? "true" : undefined}
        onClick={() => onOpen?.(resolveFirstCutDetailStone(item))}
        className={`jw-first-cut__tile jw-first-cut__tile--${role} group relative flex h-full w-full min-w-0 flex-col text-left`}
        aria-label={tileAriaLabel(item)}
      >
        {/*
          Fixed responsive frames keep the premiere cinematic without letting it
          consume most of a desktop viewport. Mobile retains the original crop;
          larger screens become progressively wider and shorter.
        */}
        <span
          className={`relative block w-full overflow-hidden bg-[var(--jw-bg)] ${tileAspectClass(
            role
          )}`}
        >
          <img
            src={tileImageSrc(item)}
            alt=""
            className="jw-first-cut__image h-full w-full object-cover object-center"
          />
        </span>
        {item.kind === "stone" && item.stone.displayName ? (
          <span className="mt-2 font-editorial text-base leading-tight text-[var(--jw-ink)] sm:text-lg">
            {item.stone.displayName}
          </span>
        ) : null}
      </button>
    );
  };

  const renderPlaceholder = (
    item: Extract<FirstCutPresentation, { kind: "placeholder" }>,
    role: TileRole
  ) => (
    <div
      key={item.position}
      data-first-cut-placeholder="true"
      data-first-cut-lead={role === "lead" ? "true" : undefined}
      data-first-cut-support={role === "support" ? "true" : undefined}
      className={`jw-first-cut__tile jw-first-cut__tile--${role} flex w-full min-w-0 flex-col justify-end bg-[var(--jw-surface)] p-4 ${tileAspectClass(
        role
      )}`}
    >
      <span className={`text-[10px] uppercase tracking-[0.16em] sm:text-xs ${jw.muted}`}>
        Coming soon
      </span>
    </div>
  );

  const renderItem = (item: FirstCutPresentation | undefined, role: TileRole) => {
    if (!item) return null;
    if (item.kind === "placeholder") return renderPlaceholder(item, role);
    return renderMedia(item, role);
  };

  return (
    <section
      aria-labelledby="first-cut-title"
      data-testid="jw-first-cut"
      className={`jw-first-cut bg-[var(--jw-bg)] px-0 pb-8 pt-5 sm:pb-12 sm:pt-7 ${jw.scrollTarget}`}
    >
      <div className={`mx-auto w-full max-w-[1680px] px-3 sm:px-6 lg:px-8 ${jw.scrollTarget}`}>
        <header className="jw-first-cut__intro mb-3 sm:mb-4">
          <h2
            id="first-cut-title"
            className="font-editorial text-2xl font-medium leading-none tracking-tight text-[var(--jw-ink)] sm:text-3xl"
          >
            First Cut Exclusives
          </h2>
        </header>

        {/* Full-width lead on top; two supports in one tight row below — no side column / beige void. */}
        <div
          className="jw-first-cut__premiere grid grid-cols-1 gap-2 sm:gap-2.5"
          aria-label={ariaLabel}
          data-testid="jw-first-cut-rail"
        >
          <div className="jw-first-cut__lead w-full">{renderItem(lead, "lead")}</div>
          <div className="jw-first-cut__support grid w-full grid-cols-2 items-stretch gap-2 sm:gap-2.5">
            {support.map((item) => renderItem(item, "support"))}
          </div>
        </div>
      </div>
    </section>
  );
}
