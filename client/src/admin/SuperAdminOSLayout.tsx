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
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user?.role as AdminRole) || "super_admin";
  const navSections = getSuperAdminNavForRole(role);
  const activeItem = findActiveItem(location);
  const mobileNavItems = React.useMemo(() => {
    const all = navSections.flatMap((section) => section.items);
    const prioritized = all.filter(
      (item) =>
        item.path === "/admin" ||
        item.path.startsWith("/admin/live-stream") ||
        item.path.startsWith("/admin/observability") ||
        item.path.startsWith("/admin/scout-resilience")
    );

    const ordered = [...prioritized];
    for (const item of all) {
      if (ordered.some((existing) => existing.path === item.path)) continue;
      ordered.push(item);
    }
    return ordered.slice(0, 4);
  }, [navSections]);

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
    <div
      className={
        density === "compact"
          ? "min-h-full bg-slate-950 py-3 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-3"
          : "min-h-full bg-slate-950 py-6 pb-[calc(86px+env(safe-area-inset-bottom))] md:pb-6"
      }
      style={{
        backgroundImage:
          "radial-gradient(circle at top left, rgba(249,115,22,0.08), transparent 28%), radial-gradient(circle at top right, rgba(34,211,238,0.08), transparent 32%)",
      }}
    >
      <div
        className={
          density === "compact"
            ? "mx-auto flex max-w-[1500px] flex-col gap-4 px-3 sm:px-4 lg:flex-row lg:px-6"
            : "mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:px-8"
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
                ? "flex-1 overflow-auto rounded-[22px] border border-slate-800 bg-[linear-gradient(180deg,rgba(10,15,28,0.94),rgba(15,23,42,0.78))] p-3 shadow-[0_24px_70px_rgba(2,6,23,0.34)]"
                : "flex-1 overflow-auto rounded-[26px] border border-slate-800 bg-[linear-gradient(180deg,rgba(10,15,28,0.94),rgba(15,23,42,0.78))] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.34)]"
            }
          >
            {children}
          </div>
        </div>
      </div>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_20px_50px_rgba(2,6,23,0.45)] backdrop-blur md:hidden"
        aria-label="Admin OS bottom navigation"
      >
        <div className="grid grid-cols-4 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem?.path === item.path;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setLocation(item.path);
                  handleNavigate();
                }}
                className={`rounded-xl px-2 py-2 text-center transition-colors ${
                  isActive
                    ? "bg-orange-500/18 text-orange-100"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                {Icon && <Icon className="mx-auto h-4 w-4" />}
                <span className="mt-1 block truncate text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
