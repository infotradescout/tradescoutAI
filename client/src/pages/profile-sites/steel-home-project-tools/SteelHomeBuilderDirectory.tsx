import { ArrowUpRight, Building2, PanelsTopLeft, RectangleHorizontal } from "lucide-react";
import { PublicProfileAccountCard } from "@/components/profile/PublicProfileAccountCard";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
} from "@shared/steelHomePackagesProfile";
import {
  buildSteelHomeBuilderPath,
  type SteelHomeBuilderKey,
} from "@shared/steelHomeBuilderRoutes";

export type SteelHomePlanner = SteelHomeBuilderKey;

export const STEEL_HOME_BUILDERS = [
  {
    key: "countertops",
    label: "Countertops",
    title: "Countertop Builder",
    result: "Surface + tops-only area",
    icon: RectangleHorizontal,
  },
  {
    key: "cabinets",
    label: "Cabinets",
    title: "Cabinet Builder",
    result: "Layout + early estimate",
    icon: PanelsTopLeft,
  },
  {
    key: "building",
    label: "Metal Buildings",
    title: "Metal Building Builder",
    result: "Building + early estimate",
    icon: Building2,
  },
] as const;

export const STEEL_HOME_PLANNER_HASH: Record<SteelHomePlanner, string> = {
  building: "#building",
  countertops: "#countertops",
  cabinets: "#cabinets",
};

const HASH_ALIASES: Record<string, SteelHomePlanner> = {
  "#building": "building",
  "#building-designer": "building",
  "#countertop": "countertops",
  "#countertops": "countertops",
  "#countertop-designer": "countertops",
  "#cabinet": "cabinets",
  "#cabinets": "cabinets",
  "#cabinet-designer": "cabinets",
};

export function plannerFromHash(hash: string): SteelHomePlanner | null {
  return HASH_ALIASES[hash.trim().toLowerCase()] || null;
}

export function plannerLauncherId(planner: SteelHomePlanner): string {
  return `steel-home-builder-open-${planner}`;
}

export function plannerPanelId(planner: SteelHomePlanner): string {
  return `steel-home-builder-${planner}`;
}

type Props = {
  onOpen: (planner: SteelHomePlanner) => void;
};

export default function SteelHomeBuilderDirectory({ onOpen }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 pb-8 pt-7 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[#a94f2e]">
            Three stand-alone builders
          </p>
          <h2 className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.04em] text-[#18312f] sm:text-4xl">
            Open the one you need.
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#68736f]">
          Each builder keeps its own choices, result, and request.
        </p>
      </div>

      <div
        className="mt-6 grid flex-1 gap-4 md:grid-cols-3 lg:gap-5"
        data-testid="steel-home-builder-directory"
      >
        {STEEL_HOME_BUILDERS.map((builder) => {
          const card = content.tools.cards.find((item) => item.key === builder.key);
          const Icon = builder.icon;
          if (!card) return null;

          return (
            <article
              key={builder.key}
              className="group grid grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-[1.25rem] border border-[#18312f]/12 bg-white shadow-[0_18px_60px_rgba(24,49,47,.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(24,49,47,.14)] md:flex md:min-h-[25rem] md:flex-col md:rounded-[1.6rem]"
              data-testid={`steel-home-builder-card-${builder.key}`}
            >
              <div className="relative min-h-[9rem] overflow-hidden bg-[#d9d5cc] md:min-h-0 md:flex-1">
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                  loading={builder.key === "countertops" ? "eager" : "lazy"}
                  decoding="async"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#10211f]/75 via-transparent to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 hidden items-end justify-between gap-3 p-5 text-white md:flex">
                  <div>
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[#f0b392]">
                      {builder.result}
                    </p>
                    <h3 className="mt-1 font-editorial text-3xl font-semibold tracking-[-0.035em]">
                      {builder.label}
                    </h3>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </div>

              <div className="flex min-w-0 flex-col justify-center p-4 md:block md:p-5">
                <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-[#a94f2e] md:hidden">
                  {builder.result}
                </p>
                <h3 className="mt-1 font-editorial text-xl font-semibold tracking-[-0.03em] md:hidden">
                  {builder.label}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5f6c68] md:mt-0 md:min-h-12 md:text-sm md:leading-6">
                  {card.body}
                </p>
                {builder.key === "countertops" ? (
                  <p
                    className="mt-2 text-xs font-bold leading-5 text-[#18312f]"
                    data-testid="steel-home-countertop-supply-boundary"
                  >
                    Stone ordering covers material supply only. Templating, fabrication, cutting,
                    and installation require a separate independent fabricator.
                  </p>
                ) : null}
                <a
                  href={buildSteelHomeBuilderPath(builder.key)}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onOpen(builder.key);
                  }}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-between rounded-full bg-[#18312f] px-4 text-xs font-black text-white transition hover:bg-[#a94f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2 md:mt-5 md:min-h-12 md:px-5 md:text-sm"
                  data-testid={plannerLauncherId(builder.key)}
                >
                  Open {builder.title}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <PublicProfileAccountCard
        profileSlug={identity.slug}
        profileName={identity.displayLabel}
        tone="light"
        compact
        className="mt-6"
      />
    </div>
  );
}
