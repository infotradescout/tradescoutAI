import React from "react";
import type { SuperAdminNavItem } from "./superAdminNav";

interface AdminHeaderProps {
  currentItem: SuperAdminNavItem | null;
}

export function AdminHeader({ currentItem }: AdminHeaderProps) {
  const label = currentItem?.label ?? "Dashboard";

  return (
    <header className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
          <span>Super Admin OS</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {label}
        </p>
      </div>
    </header>
  );
}
