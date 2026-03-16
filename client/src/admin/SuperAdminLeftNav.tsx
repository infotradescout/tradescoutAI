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

  return (
    <aside className={density === "compact" ? "w-60 shrink-0" : "w-64 shrink-0"}>
      <div className={density === "compact" ? "mb-3" : "mb-4"}>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Admin</div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-900/60"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-900/60"
          >
            Collapse all
          </button>
        </div>
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
            {(() => {
              const sectionUnread = section.items.reduce(
                (sum, item) => sum + getToolUnreadCount(item.id),
                0
              );
              return (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [section.section]: !prev[section.section] }))
                  }
                  className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-2 py-1 rounded-md hover:bg-slate-900/50"
                  aria-expanded={!collapsed[section.section]}
                >
                  <span className="truncate flex items-center gap-2">
                    <span>{section.section}</span>
                    {sectionUnread > 0 && (
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_0_2px_rgba(251,146,60,0.2)]"
                        title={`${sectionUnread} new items`}
                      />
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {collapsed[section.section] ? (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </span>
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
                    <span className="flex-1 truncate flex items-center gap-2">
                      <span className="truncate">{item.label}</span>
                      {unreadCount > 0 && (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_0_2px_rgba(251,146,60,0.2)]"
                          title={`${unreadCount} pending`}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
