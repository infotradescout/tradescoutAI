import React from "react";
import { useLocation } from "wouter";
import { getSuperAdminNavForRole, type AdminRole, findActiveItem } from "./superAdminNav";
import { SuperAdminLeftNav } from "./SuperAdminLeftNav";
import { AdminHeader } from "./AdminHeader";
import { useAuth } from "@/hooks/useAuth";

interface SuperAdminOSLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminOSLayout({ children }: SuperAdminOSLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = (user?.role as AdminRole) || "super_admin";
  const navSections = getSuperAdminNavForRole(role);
  const activeItem = findActiveItem(location);

  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const [isNavOpen, setIsNavOpen] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("admin:ui:density");
      if (stored === "compact" || stored === "comfortable") {
        setDensity(stored);
        return;
      }
    } catch {
      // ignore storage errors
    }

    // New default: keep admin nav compact on mobile to prevent long-scroll menus.
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    setDensity(isDesktop ? "comfortable" : "compact");
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("admin:ui:navOpen");
      if (stored === "0" || stored === "1") {
        setIsNavOpen(stored === "1");
        return;
      }
    } catch {
      // ignore storage errors
    }

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    setIsNavOpen(isDesktop);
  }, []);

  const toggleDensity = () => {
    setDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      try {
        window.localStorage.setItem("admin:ui:density", next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleToggleNav = () => {
    setIsNavOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("admin:ui:navOpen", next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleNavigate = () => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    // Keep nav persistent on desktop, collapse only on mobile/tablet.
    if (!isDesktop) {
      setIsNavOpen(false);
      try {
        window.localStorage.setItem("admin:ui:navOpen", "0");
      } catch {
        // ignore storage errors
      }
    }
  };

  return (
    <div className={density === "compact" ? "bg-slate-950 py-3" : "bg-slate-950 py-6"}>
      <div
        className={
          density === "compact"
            ? "max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 flex flex-col md:flex-row gap-4"
            : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-6"
        }
      >
        <div className={isNavOpen ? "block md:shrink-0" : "hidden"}>
          <SuperAdminLeftNav sections={navSections} onNavigate={handleNavigate} density={density} />
        </div>
        <div
          className={
            density === "compact"
              ? "flex-1 flex flex-col space-y-3"
              : "flex-1 flex flex-col space-y-4"
          }
        >
          <AdminHeader
            currentItem={activeItem}
            onToggleNav={handleToggleNav}
            isNavOpen={isNavOpen}
            density={density}
            onToggleDensity={toggleDensity}
          />
          <div
            className={
              density === "compact"
                ? "flex-1 bg-slate-900/80 border border-slate-800 rounded-xl p-3 overflow-auto"
                : "flex-1 bg-slate-900/80 border border-slate-800 rounded-xl p-4 overflow-auto"
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
