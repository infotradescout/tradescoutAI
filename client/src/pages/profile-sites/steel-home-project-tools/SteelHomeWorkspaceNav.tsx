import type { KeyboardEvent } from "react";
import {
  Boxes,
  Building2,
  Check,
  ClipboardList,
  Home,
  Layers3,
  MapPinned,
  type LucideIcon,
} from "lucide-react";

export type SteelHomeWorkspace =
  | "project"
  | "building"
  | "countertops"
  | "cabinets"
  | "whole-home"
  | "review";

export type SteelHomeWorkspaceStatus = "complete" | "started" | "optional" | "needed";

type WorkspaceItem = {
  key: SteelHomeWorkspace;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export const STEEL_HOME_WORKSPACES: readonly WorkspaceItem[] = [
  {
    key: "project",
    label: "Project Setup",
    shortLabel: "Project",
    description: "Contracting setup and jobsite",
    icon: MapPinned,
  },
  {
    key: "building",
    label: "Building + Roof",
    shortLabel: "Building",
    description: "Size, roof, openings, and colors",
    icon: Building2,
  },
  {
    key: "countertops",
    label: "Countertops",
    shortLabel: "Countertops",
    description: "Surface, layout, and measurements",
    icon: Layers3,
  },
  {
    key: "cabinets",
    label: "Cabinets",
    shortLabel: "Cabinets",
    description: "Room fit, storage, and finishes",
    icon: Boxes,
  },
  {
    key: "whole-home",
    label: "Whole Home",
    shortLabel: "Whole Home",
    description: "Systems, finishes, site, and trades",
    icon: Home,
  },
  {
    key: "review",
    label: "Summary & Request",
    shortLabel: "Summary",
    description: "Check the project and request pricing",
    icon: ClipboardList,
  },
] as const;

export const STEEL_HOME_WORKSPACE_HASH: Record<SteelHomeWorkspace, string> = {
  project: "#project",
  building: "#building",
  countertops: "#countertops",
  cabinets: "#cabinets",
  "whole-home": "#whole-home",
  review: "#review",
};

const HASH_ALIASES: Record<string, SteelHomeWorkspace> = {
  "#project": "project",
  "#project-start": "project",
  "#building": "building",
  "#building-designer": "building",
  "#countertops": "countertops",
  "#countertop-designer": "countertops",
  "#cabinets": "cabinets",
  "#cabinet-designer": "cabinets",
  "#whole-home": "whole-home",
  "#review": "review",
  "#project-review": "review",
};

export function workspaceFromHash(hash: string): SteelHomeWorkspace {
  return HASH_ALIASES[hash.toLowerCase()] || "project";
}

export function workspaceTabId(workspace: SteelHomeWorkspace, mobile = false): string {
  return mobile
    ? `steel-home-mobile-workspace-tab-${workspace}`
    : `steel-home-workspace-tab-${workspace}`;
}

export function workspacePanelId(workspace: SteelHomeWorkspace): string {
  return `steel-home-workspace-panel-${workspace}`;
}

type Props = {
  activeWorkspace: SteelHomeWorkspace;
  statuses: Record<SteelHomeWorkspace, SteelHomeWorkspaceStatus>;
  onChange: (workspace: SteelHomeWorkspace) => void;
  mobile?: boolean;
};

function statusLabel(workspace: SteelHomeWorkspace, status: SteelHomeWorkspaceStatus): string {
  if (status === "started") return "In progress";
  if (status === "optional") return "Optional";
  if (status === "needed") return workspace === "review" ? "Not ready" : "Needed";
  if (workspace === "project") return "Complete";
  if (workspace === "whole-home") return "Selected";
  if (workspace === "review") return "Ready";
  return "Included";
}

export default function SteelHomeWorkspaceNav({
  activeWorkspace,
  statuses,
  onChange,
  mobile = false,
}: Props) {
  const activateByIndex = (index: number) => {
    const item = STEEL_HOME_WORKSPACES[index];
    if (!item) return;
    onChange(item.key);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() =>
        document.getElementById(workspaceTabId(item.key, mobile))?.focus()
      );
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % STEEL_HOME_WORKSPACES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + STEEL_HOME_WORKSPACES.length) % STEEL_HOME_WORKSPACES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = STEEL_HOME_WORKSPACES.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    activateByIndex(nextIndex);
  };

  return (
    <nav
      aria-label="Project sections"
      data-testid={mobile ? "steel-home-mobile-nav" : "steel-home-workspace-tabs"}
      className={
        mobile
          ? "sticky top-16 z-40 overflow-x-auto border-b border-[#18312f]/10 bg-[#f7f3eb] px-3 py-2 xl:hidden"
          : "hidden flex-col xl:flex"
      }
    >
      <div
        role="tablist"
        aria-orientation={mobile ? "horizontal" : "vertical"}
        className={mobile ? "flex min-w-max gap-2" : "flex flex-col gap-1.5"}
      >
        {STEEL_HOME_WORKSPACES.map((item, index) => {
          const active = item.key === activeWorkspace;
          const status = statuses[item.key];
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              id={workspaceTabId(item.key, mobile)}
              role="tab"
              aria-selected={active}
              aria-controls={workspacePanelId(item.key)}
              aria-current={mobile && active ? "page" : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              data-testid={workspaceTabId(item.key, mobile)}
              className={`group flex min-h-12 items-center gap-3 rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9683d] ${
                mobile
                  ? `px-4 py-2 ${active ? "bg-[#18312f] text-white" : "bg-white text-[#18312f]"}`
                  : `w-full px-3 py-3 ${
                      active
                        ? "bg-[#18312f] text-white shadow-[0_12px_28px_rgba(24,49,47,0.16)]"
                        : "text-[#354843] hover:bg-white"
                    }`
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  active ? "bg-white/15" : "bg-[#e9e2d6]"
                }`}
              >
                {status === "complete" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-bold">
                  {mobile ? item.shortLabel : item.label}
                </span>
                {!mobile ? (
                  <span
                    className={`mt-0.5 block text-xs ${active ? "text-white/70" : "text-[#52615d]"}`}
                  >
                    {item.description}
                  </span>
                ) : null}
              </span>
              {!mobile ? (
                <span
                  className={`ml-auto shrink-0 text-[0.62rem] font-black uppercase tracking-[0.12em] ${
                    active
                      ? "text-[#f0b392]"
                      : status === "complete"
                        ? "text-[#2f6842]"
                        : "text-[#6f4f43]"
                  }`}
                >
                  {statusLabel(item.key, status)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
