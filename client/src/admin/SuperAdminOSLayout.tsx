import React from "react";
import { useLocation } from "wouter";
import { canSeeAdminTool, findActiveAdminTool, type AdminRole } from "./adminTools";
import {
  getAdminNavWorkspacesForRole,
  getAdminSearchWorkspacesForRole,
  getAdminToolPresentation,
} from "./adminNavWorkspaces";
import { SuperAdminLeftNav } from "./SuperAdminLeftNav";
import { AdminHeader } from "./AdminHeader";
import { useAuth } from "@/hooks/useAuth";
import "./admin-os-v2.css";

interface SuperAdminOSLayoutProps {
  children: React.ReactNode;
  role?: AdminRole;
  isSuperAdmin?: boolean;
}

const RAIL_KEY = "admin:ui:railCollapsed:v2";

export function SuperAdminOSLayout({ children, role, isSuperAdmin }: SuperAdminOSLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const effectiveRole = role || (user?.role as AdminRole) || "ops_admin";
  const superFlag = isSuperAdmin ?? (user as any)?.isSuperAdmin === true;
  const navSections = React.useMemo(
    () => getAdminNavWorkspacesForRole(effectiveRole, superFlag),
    [effectiveRole, superFlag]
  );
  const searchSections = React.useMemo(
    () => getAdminSearchWorkspacesForRole(effectiveRole, superFlag),
    [effectiveRole, superFlag]
  );
  const pathname = (location || "/admin").split(/[?#]/, 1)[0] || "/admin";
  const activeItem = React.useMemo(() => {
    const matchedItem = findActiveAdminTool(pathname);
    if (!matchedItem) return null;
    if (matchedItem.path === "/admin" && pathname !== "/admin") return null;
    return getAdminToolPresentation(matchedItem);
  }, [pathname]);
  const activeSection =
    searchSections.find((section) => section.items.some((item) => item.id === activeItem?.id))
      ?.section || "Operations";

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  const mobileDialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = mobileDialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>("button, input, a[href], select, [tabindex='0']") ||
          []
      ).filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [mobileNavOpen]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setRailCollapsed(window.localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      // Keep the expanded rail when storage is unavailable.
    }
  }, []);

  const persistRailState = React.useCallback((collapsed: boolean) => {
    try {
      window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore storage errors; the current session still updates.
    }
  }, []);

  const toggleRail = () => {
    setRailCollapsed((current) => {
      const next = !current;
      persistRailState(next);
      return next;
    });
  };

  const focusToolSearch = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setMobileNavOpen(true);
      window.setTimeout(() => window.dispatchEvent(new Event("admin:focus-tool-search")), 80);
      return;
    }

    if (railCollapsed) {
      setRailCollapsed(false);
      persistRailState(false);
      window.setTimeout(() => window.dispatchEvent(new Event("admin:focus-tool-search")), 80);
      return;
    }

    window.dispatchEvent(new Event("admin:focus-tool-search"));
  }, [persistRailState, railCollapsed]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      focusToolSearch();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [focusToolSearch]);

  return (
    <div className="ts-admin-shell min-h-full bg-tsBg text-zinc-100">
      <div
        className={`grid min-h-[var(--app-height)] transition-[grid-template-columns] duration-200 ${
          railCollapsed
            ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]"
            : "lg:grid-cols-[16.5rem_minmax(0,1fr)]"
        }`}
      >
        <div className="hidden border-r border-white/10 bg-tsBg lg:block">
          <div className="sticky top-0 h-[var(--app-height)]">
            <SuperAdminLeftNav
              sections={navSections}
              searchSections={searchSections}
              onNavigate={() => undefined}
              collapsed={railCollapsed}
              onToggleCollapsed={toggleRail}
            />
          </div>
        </div>

        {mobileNavOpen ? (
          <div
            ref={mobileDialogRef}
            className="fixed inset-0 z-[120] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Admin workspaces"
          >
            <button
              type="button"
              className="ts-admin-nav-backdrop absolute inset-0"
              aria-label="Close admin navigation"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative h-full w-[min(21rem,88vw)] border-r border-white/10 bg-tsBg shadow-2xl">
              <SuperAdminLeftNav
                sections={navSections}
                searchSections={searchSections}
                onNavigate={() => setMobileNavOpen(false)}
                onClose={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0">
          <AdminHeader
            currentItem={activeItem}
            currentSection={activeSection}
            onOpenNavigation={() => setMobileNavOpen(true)}
            onFindTool={focusToolSearch}
            statusPath={
              searchSections
                .flatMap((section) => section.items)
                .find(
                  (tool) =>
                    tool.id === "live-stream" && canSeeAdminTool(tool, effectiveRole, superFlag)
                )?.path
            }
          />
          <main className="ts-admin-content min-w-0 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
