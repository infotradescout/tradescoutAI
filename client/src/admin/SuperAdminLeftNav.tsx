import React from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SuperAdminNavSection, SuperAdminNavItem } from "./superAdminNav";

interface SuperAdminLeftNavProps {
  sections: SuperAdminNavSection[];
  onNavigate?: () => void;
  density?: "comfortable" | "compact";
}

const COLLAPSE_KEY = "admin:nav:collapsedSections:v1";

function isItemActive(pathname: string, item: SuperAdminNavItem): boolean {
  if (!pathname) return false;
  if (pathname === item.path) return true;
  if (item.path !== "/admin" && pathname.startsWith(item.path + "/")) return true;
  return false;
}

export function SuperAdminLeftNav({
  sections,
  onNavigate,
  density = "comfortable",
}: SuperAdminLeftNavProps) {
  const [location, setLocation] = useLocation();
  const normalizedLocation = (location || "/").split(/[?#]/, 1)[0] || "/";
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      setCollapsed(parsed as Record<string, boolean>);
    } catch {
      // ignore storage/parse errors
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  // Always keep the active section visible.
  React.useEffect(() => {
    const activeSection = sections.find((section) =>
      section.items.some((item) => isItemActive(normalizedLocation, item))
    )?.section;
    if (!activeSection) return;
    setCollapsed((prev) => (prev[activeSection] ? { ...prev, [activeSection]: false } : prev));
  }, [normalizedLocation, sections]);

  return (
    <aside className={density === "compact" ? "w-60 shrink-0" : "w-64 shrink-0"}>
      <div className={density === "compact" ? "mb-3" : "mb-4"}>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Admin</div>
      </div>

      <nav
        className={
          density === "compact"
            ? "space-y-3 max-h-[calc(var(--app-height)-110px)] overflow-y-auto pr-1"
            : "space-y-4 max-h-[calc(var(--app-height)-120px)] overflow-y-auto pr-1"
        }
      >
        {sections.map((section) => (
          <div key={section.section} className="space-y-1">
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [section.section]: !prev[section.section] }))
              }
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-2 py-1 rounded-md hover:bg-slate-900/50"
              aria-expanded={!collapsed[section.section]}
            >
              <span className="truncate">{section.section}</span>
              {collapsed[section.section] ? (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
            {!collapsed[section.section] &&
              section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(normalizedLocation, item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setLocation(item.path);
                      if (onNavigate) onNavigate();
                    }}
                    className={`w-full flex items-center gap-3 rounded-md transition-colors text-left border
                      ${
                        active
                          ? "bg-orange-600/20 border-orange-500/60 text-orange-100"
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                      }
                      ${density === "compact" ? "px-3 py-1.5 text-[13px]" : "px-3 py-2 text-sm"}
                    `}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
