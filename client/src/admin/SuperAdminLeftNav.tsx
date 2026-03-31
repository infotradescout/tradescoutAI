import React from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  const { data: toolNotifications } = useQuery<{
    byTool?: Record<string, number>;
    totalUnread?: number;
  }>({
    queryKey: ["/api/admin/tool-notifications"],
    queryFn: () => apiRequest("GET", "/api/admin/tool-notifications"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const unreadByTool = toolNotifications?.byTool || {};
  const getToolUnreadCount = React.useCallback(
    (toolId: string) => {
      return Number(unreadByTool[toolId] || 0);
    },
    [unreadByTool]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setCollapsed(parsed as Record<string, boolean>);
          return;
        }
      }
    } catch {
      // ignore storage/parse errors and fall back to compact defaults
    }

    // Default behavior with no prior preference: collapse all sections except the
    // currently active section (or first section if none is active).
    const defaults: Record<string, boolean> = {};
    for (const section of sections) defaults[section.section] = true;
    const activeSection = sections.find((section) =>
      section.items.some((item) => isItemActive(normalizedLocation, item))
    )?.section;
    if (activeSection) defaults[activeSection] = false;
    else if (sections.length > 0) defaults[sections[0].section] = false;
    setCollapsed(defaults);
  }, [sections, normalizedLocation]);

  const collapseAll = React.useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const section of sections) next[section.section] = true;
    setCollapsed(next);
  }, [sections]);

  const expandAll = React.useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const section of sections) next[section.section] = false;
    setCollapsed(next);
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

  const activeSection = sections.find((section) =>
    section.items.some((item) => isItemActive(normalizedLocation, item))
  );
  const activeItem =
    activeSection?.items.find((item) => isItemActive(normalizedLocation, item)) ?? null;
  const visibleToolCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const totalUnread = sections.reduce(
    (sum, section) =>
      sum + section.items.reduce((inner, item) => inner + getToolUnreadCount(item.id), 0),
    0
  );

  return (
    <aside className={density === "compact" ? "w-64 shrink-0" : "w-[18rem] shrink-0"}>
      <div className="rounded-2xl border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.86))] p-3 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
        <div className="border-b border-slate-800 pb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Admin navigation
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {activeSection?.section || "Platform ops"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {activeItem?.label || "Choose a tool"} • {visibleToolCount} tools available
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              {sections.length} sections
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              {totalUnread} unread
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300 hover:bg-slate-900/60"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300 hover:bg-slate-900/60"
          >
            Collapse all
          </button>
        </div>

        <nav
          className={
            density === "compact"
              ? "mt-3 space-y-3 max-h-[calc(var(--app-height)-180px)] overflow-y-auto pr-1"
              : "mt-3 space-y-4 max-h-[calc(var(--app-height)-190px)] overflow-y-auto pr-1"
          }
        >
          {sections.map((section) => (
            <div key={section.section} className="space-y-1.5">
              {(() => {
                const sectionUnread = section.items.reduce(
                  (sum, item) => sum + getToolUnreadCount(item.id),
                  0
                );
                const sectionActive = section.items.some((item) =>
                  isItemActive(normalizedLocation, item)
                );
                return (
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [section.section]: !prev[section.section],
                      }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      sectionActive
                        ? "border-slate-600 bg-slate-900/90"
                        : "border-slate-800 bg-slate-950/60 hover:bg-slate-900/60"
                    }`}
                    aria-expanded={!collapsed[section.section]}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {section.section}
                      </span>
                      {collapsed[section.section] ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{section.items.length} tools</span>
                      {sectionUnread > 0 && (
                        <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-orange-200">
                          {sectionUnread} new
                        </span>
                      )}
                    </div>
                  </button>
                );
              })()}
              {!collapsed[section.section] &&
                section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(normalizedLocation, item);
                  const unreadCount = getToolUnreadCount(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setLocation(item.path);
                        if (onNavigate) onNavigate();
                      }}
                      className={`w-full rounded-xl border text-left transition-colors ${
                        active
                          ? "border-orange-500/60 bg-orange-500/12 text-orange-50 shadow-[0_0_0_1px_rgba(249,115,22,0.08)]"
                          : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
                      } ${density === "compact" ? "px-3 py-2" : "px-3 py-2.5"}`}
                    >
                      <div className="flex items-center gap-3">
                        {Icon && (
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                              active
                                ? "border-orange-400/30 bg-orange-500/10 text-orange-200"
                                : "border-slate-800 bg-slate-900/80 text-slate-400"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {item.path === "/admin"
                              ? "Mission Control home"
                              : item.path.replace("/admin/", "").replaceAll("-", " ")}
                          </span>
                        </span>
                        {unreadCount > 0 && (
                          <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
