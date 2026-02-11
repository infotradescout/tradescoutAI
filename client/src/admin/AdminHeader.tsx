import React from "react";
import { Menu, LayoutGrid } from "lucide-react";
import type { SuperAdminNavItem } from "./superAdminNav";

interface AdminHeaderProps {
  currentItem: SuperAdminNavItem | null;
  onToggleNav?: () => void;
  isNavOpen?: boolean;
  density?: "comfortable" | "compact";
  onToggleDensity?: () => void;
}

export function AdminHeader({
  currentItem,
  onToggleNav,
  isNavOpen,
  density = "comfortable",
  onToggleDensity,
}: AdminHeaderProps) {
  const label = currentItem?.label ?? "Dashboard";

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleNav}
          className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-scout-500/60"
          aria-label={isNavOpen ? "Hide admin navigation" : "Show admin navigation"}
        >
          <Menu className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">{isNavOpen ? "Hide tools" : "Admin tools"}</span>
        </button>
        <div>
          <h1
            className={
              density === "compact"
                ? "text-xl font-semibold text-slate-100 truncate"
                : "text-2xl font-semibold text-slate-100 truncate"
            }
            title={label}
          >
            {label}
          </h1>
          <p className="text-[11px] text-slate-500">Admin tools</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onToggleDensity && (
          <button
            type="button"
            onClick={onToggleDensity}
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            aria-label={
              density === "compact" ? "Switch to comfortable density" : "Switch to compact density"
            }
          >
            <LayoutGrid className="w-4 h-4 mr-1" />
            {density === "compact" ? "Comfort" : "Compact"}
          </button>
        )}
      </div>
    </header>
  );
}
