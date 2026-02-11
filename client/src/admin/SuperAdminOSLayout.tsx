import React from "react";
import { useLocation } from "wouter";
import {
  type SuperAdminNavItem,
  getSuperAdminNavForRole,
  type AdminRole,
  findActiveItem,
} from "./superAdminNav";
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

  // Default the nav to open so the classic layout remains the
  // baseline experience, but allow it to be collapsed on any
  // viewport to create a "windowed" Admin OS surface.
  const [isNavOpen, setIsNavOpen] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) {
      setIsNavOpen(true);
    }
  }, [location]);

  const handleToggleNav = () => {
    setIsNavOpen((prev) => !prev);
  };

  const handleNavigate = () => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    // Keep nav persistent on desktop, collapse only on mobile/tablet.
    if (!isDesktop) {
      setIsNavOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-6">
        <div className={isNavOpen ? "block md:shrink-0" : "hidden"}>
          <SuperAdminLeftNav sections={navSections} onNavigate={handleNavigate} />
        </div>
        <div className="flex-1 flex flex-col space-y-4">
          <AdminHeader
            currentItem={activeItem}
            onToggleNav={handleToggleNav}
            isNavOpen={isNavOpen}
          />
          <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg p-4 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
