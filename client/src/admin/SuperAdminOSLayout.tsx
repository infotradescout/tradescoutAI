import React from "react";
import { useLocation } from "wouter";
import { findActiveAdminTool, getAdminNavSectionsForRole, type AdminRole } from "./adminTools";
import { SuperAdminLeftNav } from "./SuperAdminLeftNav";
import { AdminHeader } from "./AdminHeader";
import { useAuth } from "@/hooks/useAuth";

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
  const superFlag = Boolean(isSuperAdmin || (user as any)?.isSuperAdmin === true);
  const navSections = getAdminNavSectionsForRole(effectiveRole, superFlag);
  const activeItem = findActiveAdminTool(location);
  const activeSection =
    navSections.find((section) => section.items.some((item) => item.id === activeItem?.id))?.section ||
    "Operations";

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [railCollapsed, setRailCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setRailCollapsed(window.localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      // Keep the expanded rail when storage is unavailable.
    }
  }, []);

  const toggleRail = () => {
    setRailCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage errors; the current session still updates.
      }
      return next;
    });
  };

  const focusToolSearch = () => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setMobileNavOpen(true);
      window.setTimeout(() => window.dispatchEvent(new Event("admin:focus-tool-search")), 80);
      return;
    }
    window.dispatchEvent(new Event("admin:focus-tool-search"));
  };

  return (
    <div className="ts-admin-shell min-h-full bg-[#08090a] text-zinc-100">
      <div
        className={`grid min-h-[var(--app-height)] transition-[grid-template-columns] duration-200 lg:grid-cols-[${
          railCollapsed ? "4.75rem" : "16.5rem"
        }_minmax(0,1fr)]`}
        style={{
          gridTemplateColumns: undefined,
        }}
      >
        <div
          className={`hidden border-r border-white/10 bg-[#0b0c0d] lg:block ${
            railCollapsed ? "lg:w-[4.75rem]" : "lg:w-[16.5rem]"
          }`}
        >
          <div className="sticky top-0 h-[var(--app-height)]">
            <SuperAdminLeftNav
              sections={navSections}
              onNavigate={() => undefined}
              collapsed={railCollapsed}
              onToggleCollapsed={toggleRail}
            />
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Close admin navigation"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative h-full w-[min(21rem,88vw)] border-r border-white/10 bg-[#0b0c0d] shadow-2xl">
              <SuperAdminLeftNav
                sections={navSections}
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
          />
          <main className="ts-admin-content min-w-0 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
