import { ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import TasksHub from "../tasks";
import WorkerMarketplacePage from "../worker-marketplace";

const SECTIONS = ["post", "board", "inbox", "pros", "engagements"] as const;

type Section = (typeof SECTIONS)[number];

function getSectionFromPath(path: string): Section {
  const match = path.match(/^\/direct-connect(?:\/(.+))?/);
  const raw = match?.[1]?.split("/")[0] ?? "";
  if (!raw) return "post";
  if (SECTIONS.includes(raw as Section)) return raw as Section;
  return "post";
}

function buildHref(section: Section): string {
  if (section === "post") return "/direct-connect";
  return `/direct-connect/${section}`;
}

export default function DirectConnectShell() {
  const [location, setLocation] = useLocation();

  const activeSection = useMemo<Section>(() => getSectionFromPath(location), [location]);

  const navigateSection = (section: Section) => {
    setLocation(buildHref(section));
  };

  let centerContent: ReactNode = null;
  switch (activeSection) {
    case "post":
      centerContent = <TasksHub />;
      break;
    case "board":
      centerContent = <TasksHub />;
      break;
    case "inbox":
      // Placeholder: will be replaced by inbox surface backed by Engagements
      centerContent = (
        <div className="text-gray-300 text-sm">
          Inbox for routed opportunities will appear here.
        </div>
      );
      break;
    case "pros":
      centerContent = <WorkerMarketplacePage />;
      break;
    case "engagements":
      // Placeholder: future My engagements summary
      centerContent = (
        <div className="text-gray-300 text-sm">
          Your Direct Connect engagements will live here.
        </div>
      );
      break;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 pb-20 flex gap-6">
        {/* Left rail: Direct Connect nav */}
        <div className="w-56 shrink-0 hidden md:block">
          <div className="sticky top-20 space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Direct Connect
            </h2>
            {SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => navigateSection(section)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  activeSection === section
                    ? "bg-orange-500/15 text-orange-400"
                    : "text-gray-300 hover:text-white hover:bg-navy-700/80",
                )}
              >
                <span className="capitalize">
                  {section === "post" && "Post"}
                  {section === "board" && "Board"}
                  {section === "inbox" && "Inbox"}
                  {section === "pros" && "Pros"}
                  {section === "engagements" && "My engagements"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Center + right: list/detail + thread */}
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {centerContent}
          </div>

          {/* Right panel: thread + actions (to be wired later) */}
          <aside className="w-full lg:w-80 shrink-0 bg-navy-900/60 border border-navy-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-2">Conversation & actions</h2>
            <p className="text-xs text-gray-300">
              When you engage with a provider, the shared message thread and quote/commit/invoice actions will appear here.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
