import { Activity, Menu, Search } from "lucide-react";
import { getAdminToolDescription, type AdminTool } from "./adminTools";

interface AdminHeaderProps {
  currentItem: AdminTool | null;
  currentSection: string;
  onOpenNavigation: () => void;
  onFindTool: () => void;
}

export function AdminHeader({
  currentItem,
  currentSection,
  onOpenNavigation,
  onFindTool,
}: AdminHeaderProps) {
  const label = currentItem?.label ?? "Admin Home";
  const summary = currentItem
    ? getAdminToolDescription(currentItem)
    : "See the work that needs an operator decision.";

  return (
    <header className="sticky top-0 z-40 flex min-h-[4.5rem] items-center gap-3 border-b border-white/10 bg-[#090a0b]/95 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
      <button
        type="button"
        onClick={onOpenNavigation}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-white/70 hover:bg-white/[0.07] hover:text-white lg:hidden"
        aria-label="Open admin navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
          <span>Admin</span>
          <span aria-hidden="true">/</span>
          <span className="truncate">{currentSection}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-lg font-semibold text-white sm:text-xl">{label}</h1>
          <p className="hidden truncate text-sm text-white/42 xl:block">{summary}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onFindTool}
        className="hidden min-h-10 min-w-[13rem] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-left text-sm text-white/40 transition hover:border-white/20 hover:bg-white/[0.055] hover:text-white/65 md:flex"
        aria-label="Find an admin tool"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">Find tool</span>
        <kbd className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/35">
          /
        </kbd>
      </button>

      <a
        href="/admin/live-stream"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white/60 transition hover:border-cyan-400/25 hover:bg-cyan-400/8 hover:text-cyan-100"
      >
        <Activity className="h-4 w-4" />
        <span className="hidden sm:inline">System status</span>
      </a>
    </header>
  );
}
