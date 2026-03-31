import React from "react";
import { Menu, LayoutGrid, ArrowUpRight, ShieldCheck } from "lucide-react";
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
  const path = currentItem?.path ?? "/admin";
  const summary =
    path === "/admin"
      ? "Priority queue, live demand, and operator decisions."
      : path.startsWith("/admin/live-stream")
        ? "Evidence feed for what the platform is producing right now."
        : path.startsWith("/admin/observability")
          ? "Snapshot freshness, jobs, and system signals."
          : path.startsWith("/admin/scout-resilience")
            ? "Fix failures that block Scout from reaching action."
            : path.startsWith("/admin/cumulus-intelligence")
              ? "Commercial pressure, county demand, and market reads."
              : "Focused admin tool for platform operations.";

  return (
    <header className="rounded-2xl border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] px-4 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onToggleNav}
            className="mt-0.5 inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-scout-500/60"
            aria-label={isNavOpen ? "Hide admin navigation" : "Show admin navigation"}
          >
            <Menu className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">{isNavOpen ? "Hide tools" : "Admin tools"}</span>
          </button>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin OS
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                {path}
              </span>
            </div>
            <h1
              className={
                density === "compact"
                  ? "truncate text-xl font-semibold text-slate-100"
                  : "truncate text-2xl font-semibold text-slate-100"
              }
              title={label}
            >
              {label}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{summary}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {onToggleDensity && (
            <button
              type="button"
              onClick={onToggleDensity}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
              aria-label={
                density === "compact"
                  ? "Switch to comfortable density"
                  : "Switch to compact density"
              }
            >
              <LayoutGrid className="mr-1 h-4 w-4" />
              {density === "compact" ? "Comfort" : "Compact"}
            </button>
          )}
          <a
            href="/admin/live-stream"
            className="inline-flex items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/15"
          >
            Live Stream
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
