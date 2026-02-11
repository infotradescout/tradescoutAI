import React from "react";
import { useLocation } from "wouter";
import type { SuperAdminNavSection, SuperAdminNavItem } from "./superAdminNav";

interface SuperAdminLeftNavProps {
  sections: SuperAdminNavSection[];
  onNavigate?: () => void;
  density?: "comfortable" | "compact";
}

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

  return (
    <aside className={density === "compact" ? "w-60 shrink-0" : "w-64 shrink-0"}>
      <div className={density === "compact" ? "mb-3" : "mb-4"}>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Admin</div>
      </div>

      <nav className={density === "compact" ? "space-y-3" : "space-y-4"}>
        {sections.map((section) => (
          <div key={section.section} className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-2">
              {section.section}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(location, item);
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
