import React from "react";
import { Menu } from "lucide-react";
import type { SuperAdminNavItem } from "./superAdminNav";

interface AdminHeaderProps {
  currentItem: SuperAdminNavItem | null;
  onToggleNav?: () => void;
  isNavOpen?: boolean;
}

export function AdminHeader({ currentItem, onToggleNav, isNavOpen }: AdminHeaderProps) {
  const label = currentItem?.label ?? "Dashboard";

  return (
    <header className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleNav}
          className="md:hidden inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-scout-500/60"
          aria-label={isNavOpen ? "Hide admin navigation" : "Show admin navigation"}
        >
          <Menu className="w-4 h-4 mr-1" />
          <span>{isNavOpen ? "Hide tools" : "Admin tools"}</span>
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <span>Admin OS</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">{label}</p>
        </div>
      </div>
    </header>
  );
}
