import React from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  getAdminToolSearchText,
  type AdminTool,
  type AdminToolSection,
} from "./adminTools";

interface SuperAdminLeftNavProps {
  sections: AdminToolSection[];
  onNavigate?: () => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const COLLAPSE_KEY = "admin:nav:collapsedSections:v2";

function isItemActive(pathname: string, item: AdminTool): boolean {
  if (!pathname) return false;
  if (pathname === item.path) return true;
  return item.path !== "/admin" && pathname.startsWith(`${item.path}/`);
}

export function SuperAdminLeftNav({
  sections,
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: SuperAdminLeftNavProps) {
  const [location, setLocation] = useLocation();
  const normalizedLocation = (location || "/").split(/[?#]/, 1)[0] || "/";
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const { data: toolNotifications } = useQuery<{
    byTool?: Record<string, number>;
  }>({
    queryKey: ["/api/admin/tool-notifications"],
    queryFn: () => apiRequest("GET", "/api/admin/tool-notifications"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  React.useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener("admin:focus-tool-search", focus);
    return () => window.removeEventListener("admin:focus-tool-search", focus);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setCollapsedSections(parsed as Record<string, boolean>);
          return;
        }
      }
    } catch {
      // Fall through to the active-section default.
    }

    const next: Record<string, boolean> = {};
    for (const section of sections) next[section.section] = true;
    const activeSection = sections.find((section) =>
      section.items.some((item) => isItemActive(normalizedLocation, item))
    )?.section;
    if (activeSection) next[activeSection] = false;
    else if (sections[0]) next[sections[0].section] = false;
    setCollapsedSections(next);
  }, [normalizedLocation, sections]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsedSections));
    } catch {
      // The rail remains usable without persistence.
    }
  }, [collapsedSections]);

  React.useEffect(() => {
    const activeSection = sections.find((section) =>
      section.items.some((item) => isItemActive(normalizedLocation, item))
    )?.section;
    if (!activeSection) return;
    setCollapsedSections((current) =>
      current[activeSection] ? { ...current, [activeSection]: false } : current
    );
  }, [normalizedLocation, sections]);

  const unreadByTool = toolNotifications?.byTool || {};
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = React.useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map((section) => ({
        section: section.section,
        items: section.items.filter((item) =>
          getAdminToolSearchText(item, section.section).includes(normalizedQuery)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [normalizedQuery, sections]);

  const openTool = (item: AdminTool) => {
    setLocation(item.path);
    onNavigate?.();
  };

  return (
    <aside className="flex h-full flex-col bg-tsBg" aria-label="Admin workspaces">
      <div className="flex h-[4.5rem] items-center gap-3 border-b border-white/10 px-3">
        <button
          type="button"
          onClick={() => setLocation("/admin")}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-black"
          aria-label="Open Admin Home"
        >
          <ShieldCheck className="h-5 w-5" />
        </button>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">TradeScout Admin</p>
            <p className="truncate text-[11px] text-white/40">Operate the platform</p>
          </div>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close admin navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="border-b border-white/10 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an admin tool"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/15"
            />
          </div>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {visibleSections.map((section) => {
          const sectionOpen =
            Boolean(normalizedQuery) || !collapsedSections[section.section];
          const sectionActive = section.items.some((item) =>
            isItemActive(normalizedLocation, item)
          );
          return (
            <div key={section.section} className="mb-3 last:mb-0">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedSections((current) => ({
                      ...current,
                      [section.section]: !current[section.section],
                    }))
                  }
                  className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left"
                  aria-expanded={sectionOpen}
                >
                  <span
                    className={`truncate text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      sectionActive ? "text-orange-300" : "text-white/35"
                    }`}
                  >
                    {section.section}
                  </span>
                  {sectionOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-white/25" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-white/25" />
                  )}
                </button>
              ) : null}

              {(collapsed || sectionOpen) && (
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(normalizedLocation, item);
                    const unread = Number(unreadByTool[item.id] || 0);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={collapsed ? item.label : undefined}
                        onClick={() => openTool(item)}
                        className={`group relative flex w-full items-center gap-3 rounded-lg text-left transition-colors ${
                          collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2.5"
                        } ${
                          active
                            ? "bg-orange-500/12 text-white"
                            : "text-white/58 hover:bg-white/[0.055] hover:text-white"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        {active ? (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-orange-400" />
                        ) : null}
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-orange-500/15 text-orange-200"
                              : "bg-white/[0.035] text-white/42 group-hover:text-white/75"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed ? (
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.label}
                          </span>
                        ) : null}
                        {unread > 0 ? (
                          <span
                            className={`rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-black ${
                              collapsed ? "absolute right-1 top-1" : ""
                            }`}
                          >
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {visibleSections.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-white/35">No matching tools.</div>
        ) : null}
      </nav>

      {onToggleCollapsed ? (
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={`flex min-h-10 w-full items-center rounded-lg text-white/45 hover:bg-white/[0.055] hover:text-white ${
              collapsed ? "justify-center px-2" : "gap-3 px-2.5"
            }`}
            aria-label={collapsed ? "Expand admin navigation" : "Collapse admin navigation"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            {!collapsed ? <span className="text-xs font-medium">Collapse navigation</span> : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
