import React from "react";
import { useLocation } from "wouter";
import { SUPER_ADMIN_NAV, type SuperAdminNavItem, getSuperAdminNavForRole, type AdminRole } from "./superAdminNav";
import { SuperAdminLeftNav } from "./SuperAdminLeftNav";
import { AdminHeader } from "./AdminHeader";
import { useAuth } from "@/hooks/useAuth";

interface SuperAdminOSLayoutProps {
  children: React.ReactNode;
}

function findActiveItem(pathname: string | null): SuperAdminNavItem | null {
  if (!pathname) return null;
  const flat: SuperAdminNavItem[] = SUPER_ADMIN_NAV.flatMap((s) => s.items);
  for (const item of flat) {
    if (pathname === item.path) return item;
    if (item.path !== "/admin" && pathname.startsWith(item.path + "/")) return item;
  }
  // Fallback to dashboard if we're somewhere under /admin but not explicitly mapped
  if (pathname.startsWith("/admin")) {
    return flat.find((i) => i.path === "/admin") ?? null;
  }
  return null;
}

export function SuperAdminOSLayout({ children }: SuperAdminOSLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = (user?.role as AdminRole) || "super_admin";
  const navSections = getSuperAdminNavForRole(role);
  const activeItem = findActiveItem(location);

  return (
    <div className="min-h-screen bg-slate-950 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6">
        <SuperAdminLeftNav sections={navSections} />
        <div className="flex-1 flex flex-col space-y-4">
          <AdminHeader currentItem={activeItem} />
          <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg p-4 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
