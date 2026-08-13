import { Building2, PanelsTopLeft, RectangleHorizontal } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

export type SteelHomePlanner = "building" | "countertops" | "cabinets";

export const STEEL_HOME_PLANNERS = [
  {
    key: "countertops",
    label: "Countertop Planner",
    shortLabel: "Countertops",
    hash: "#countertops",
    icon: RectangleHorizontal,
  },
  {
    key: "cabinets",
    label: "Cabinet Planner",
    shortLabel: "Cabinets",
    hash: "#cabinets",
    icon: PanelsTopLeft,
  },
  {
    key: "building",
    label: "Metal Building Planner",
    shortLabel: "Metal Buildings",
    hash: "#building",
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

export function plannerFromHash(hash: string): SteelHomePlanner {
  return HASH_ALIASES[hash.trim().toLowerCase()] || "countertops";
}

export function plannerTabId(planner: SteelHomePlanner): string {
  return `steel-home-planner-tab-${planner}`;
}

export function plannerPanelId(planner: SteelHomePlanner): string {
  return `steel-home-planner-panel-${planner}`;
}

type Props = {
  activePlanner: SteelHomePlanner;
  onChange: (planner: SteelHomePlanner, focusPanel?: boolean) => void;
};

export default function SteelHomePlannerNav({ activePlanner, onChange }: Props) {
  const tabRefs = useRef(new Map<SteelHomePlanner, HTMLButtonElement>());

  const move = (event: KeyboardEvent<HTMLButtonElement>, planner: SteelHomePlanner) => {
    const currentIndex = STEEL_HOME_PLANNERS.findIndex((item) => item.key === planner);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % STEEL_HOME_PLANNERS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + STEEL_HOME_PLANNERS.length) % STEEL_HOME_PLANNERS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = STEEL_HOME_PLANNERS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = STEEL_HOME_PLANNERS[nextIndex].key;
    onChange(next);
    tabRefs.current.get(next)?.focus();
  };

  return (
    <nav
      aria-label="Steel home planners"
      className="sticky top-16 z-40 border-b border-[#18312f]/10 bg-[#eee7dc]/95 px-3 py-2 backdrop-blur sm:px-6"
      data-testid="steel-home-planner-tabs"
    >
      <div
        role="tablist"
        aria-label="Choose a planner"
        className="mx-auto grid max-w-4xl grid-cols-3 gap-1 rounded-2xl bg-[#18312f]/[0.06] p-1"
      >
        {STEEL_HOME_PLANNERS.map((planner) => {
          const Icon = planner.icon;
          const selected = planner.key === activePlanner;
          return (
            <button
              key={planner.key}
              ref={(element) => {
                if (element) tabRefs.current.set(planner.key, element);
                else tabRefs.current.delete(planner.key);
              }}
              type="button"
              id={plannerTabId(planner.key)}
              role="tab"
              aria-selected={selected}
              aria-controls={plannerPanelId(planner.key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(planner.key, true)}
              onKeyDown={(event) => move(event, planner.key)}
              data-testid={plannerTabId(planner.key)}
              className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2 sm:px-5 sm:text-sm ${
                selected
                  ? "bg-[#18312f] text-white shadow-[0_8px_24px_rgba(24,49,47,.16)]"
                  : "text-[#4e5d59] hover:bg-white/70 hover:text-[#18312f]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate sm:hidden">{planner.shortLabel}</span>
              <span className="hidden truncate sm:inline">{planner.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
