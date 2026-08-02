import { Building2, Hammer, Home, Palette, RotateCcw } from "lucide-react";
import { JW_STONE_CATALOG } from "./catalog";
import { COLOR_DIRECTIONS } from "./colorDirections";
import type { BuyerType, ColorDirectionId } from "./types";

const BUYERS: ReadonlyArray<{
  id: BuyerType;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Hammer;
}> = [
  {
    id: "fabricator",
    label: "I’m a fabricator",
    shortLabel: "Fabricator",
    description:
      "Move quickly through supported material, finish, source-count, and gallery facts.",
    icon: Hammer,
  },
  {
    id: "builder",
    label: "I’m a builder",
    shortLabel: "Builder",
    description:
      "Shape a project selection around material, visual direction, and source evidence.",
    icon: Building2,
  },
  {
    id: "designer",
    label: "I’m a designer",
    shortLabel: "Designer",
    description: "Lead with imagery, movement, finishes, and verified source details.",
    icon: Palette,
  },
  {
    id: "homeowner",
    label: "I’m a homeowner",
    shortLabel: "Homeowner",
    description: "Explore in plain language and save a visual shortlist before reaching out.",
    icon: Home,
  },
];

export function buyerLabel(buyer: BuyerType): string {
  return BUYERS.find((option) => option.id === buyer)?.shortLabel ?? buyer;
}

type BuyerJourneyProps = {
  buyer: BuyerType | null;
  onChooseBuyer: (buyer: BuyerType) => void;
  onChooseColor: (color: ColorDirectionId) => void;
  onResetBuyer: () => void;
};

export function BuyerJourney({
  buyer,
  onChooseBuyer,
  onChooseColor,
  onResetBuyer,
}: BuyerJourneyProps) {
  if (buyer) {
    return (
      <section
        data-testid="color-selection"
        className="min-h-[calc(100vh-5rem)] bg-stone-100 px-5 py-16 text-stone-950 sm:px-8 lg:px-12 lg:py-24"
        aria-labelledby="color-direction-title"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 border-b border-stone-300 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
                Step 2 of 2 · {buyerLabel(buyer)}
              </p>
              <h1
                id="color-direction-title"
                className="mt-4 max-w-3xl font-editorial text-5xl leading-none sm:text-6xl lg:text-7xl"
              >
                Which direction feels right?
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
                These are visual groupings drawn from the supplied stone photography. Choose one to
                open your {buyerLabel(buyer).toLowerCase()} workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={onResetBuyer}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start border border-stone-400 px-4 text-sm font-semibold hover:bg-stone-200 sm:self-auto"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Change buyer type
            </button>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {COLOR_DIRECTIONS.map((direction, index) => {
              const representative = JW_STONE_CATALOG.find(
                (stone) => stone.colorDirection === direction.id
              );
              return (
                <button
                  type="button"
                  key={direction.id}
                  onClick={() => onChooseColor(direction.id)}
                  className={`group overflow-hidden border border-stone-300 bg-white text-left transition-transform hover:-translate-y-1 hover:border-stone-600 sm:min-h-[26rem] ${
                    index === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                  }`}
                >
                  <div className="aspect-[4/5] overflow-hidden bg-stone-200">
                    {representative ? (
                      <img
                        src={representative.images[0]}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.03]"
                        loading={index < 2 ? "eager" : "lazy"}
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <span className="font-editorial text-2xl">{direction.label}</span>
                    <span className="mt-2 block text-sm leading-6 text-stone-600">
                      {direction.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        data-testid="buyer-selection"
        className="relative isolate min-h-[78vh] overflow-hidden bg-stone-950 text-stone-50"
        aria-labelledby="jw-marketplace-title"
      >
        <img
          src="/images/businesses/jw-stone/video/hero-poster.jpg"
          alt="Natural stone presented by JW Stone"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/70 to-black/10" />
        <div className="mx-auto flex min-h-[78vh] max-w-7xl items-end px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
              JW Stone · A new way to discover stone
            </p>
            <h1
              id="jw-marketplace-title"
              className="mt-6 max-w-4xl font-editorial text-6xl leading-[0.9] sm:text-7xl lg:text-8xl"
            >
              Natural stone, selected at the source.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-200 sm:text-xl">
              Start with who you are, then choose the color direction you want to explore. Your
              workspace will meet you there.
            </p>
            <a
              href="#choose-buyer"
              className="mt-9 inline-flex min-h-12 items-center bg-stone-100 px-6 font-bold text-stone-950 hover:bg-white"
            >
              Begin your selection
            </a>
          </div>
        </div>
      </section>

      <section
        id="choose-buyer"
        aria-labelledby="buyer-title"
        className="scroll-mt-24 bg-stone-100 px-5 py-20 text-stone-950 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
            Step 1 of 2
          </p>
          <h2 id="buyer-title" className="mt-4 font-editorial text-5xl sm:text-6xl">
            How do you work with stone?
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
            Choose the path that fits your decisions. You can change it at any time.
          </p>

          <div className="mt-12 grid border-l border-t border-stone-300 sm:grid-cols-2 lg:grid-cols-4">
            {BUYERS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => onChooseBuyer(option.id)}
                  className="group flex min-h-72 flex-col justify-between border-b border-r border-stone-300 bg-white p-7 text-left transition-colors hover:bg-stone-950 hover:text-stone-50"
                >
                  <Icon className="h-7 w-7 text-stone-500 group-hover:text-amber-200" aria-hidden />
                  <span>
                    <span className="block font-editorial text-3xl">{option.label}</span>
                    <span className="mt-4 block text-sm leading-6 text-stone-600 group-hover:text-stone-300">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
