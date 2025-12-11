import React from "react";
import {
  MessageCircle,
  User,
  Layout,
  SlidersHorizontal,
  Settings,
  Wrench,
  Home,
  Car,
  Soup,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { buildRoleNavFromRoles } from "@/lib/roleNav";

const iconMap: Record<string, React.ElementType> = {
  Layout,
  MessageCircle,
  User,
  SlidersHorizontal,
  Settings,
  Wrench,
  Home,
  Car,
  Soup,
};

export function RightToolsPanel() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const rawRoles: string[] = Array.isArray((user as any)?.roles)
    ? ((user as any).roles as string[])
    : user?.role
    ? [user.role]
    : [];

  const roleNavItems = buildRoleNavFromRoles(rawRoles);

  const NavItem = ({
    to,
    icon,
    label,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-900 text-tsTextMain hover:text-white transition text-left"
    >
      {React.createElement(icon, { className: "h-4 w-4 text-tsAccent" })}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Personalized tools menu (always available) */}
      <div className="rounded-2xl border border-tsBorder bg-slate-950/80 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
            Your tools
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <NavItem
            to={ROUTES.DASHBOARD || "/dashboard"}
            icon={Layout}
            label="Dashboard"
          />
          <NavItem
            to={ROUTES.CONVERSATIONS}
            icon={MessageCircle}
            label="Messages"
          />
          <NavItem
            to={ROUTES.PROFILE || "/profile"}
            icon={User}
            label="Profile & identity"
          />
          <NavItem
            to={ROUTES.SETTINGS || "/settings"}
            icon={SlidersHorizontal}
            label="Personalization & settings"
          />
        </div>
      </div>

      {/* Role hubs for every selected role */}
      {roleNavItems.length > 0 && (
        <div className="rounded-2xl border border-tsBorder bg-slate-950/80 p-4 shadow-lg shadow-black/30">
          <div className="mb-3 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
            Role hubs
          </div>
          <div className="space-y-2 text-sm">
            {roleNavItems.map((item) => {
              const Icon = iconMap[item.icon] || Layout;
              return (
                <NavItem
                  key={item.roleKey}
                  to={item.to}
                  icon={Icon}
                  label={item.label}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Small personalization summary */}
      <div className="rounded-2xl border border-tsBorder bg-slate-950/80 p-4 text-xs text-tsTextMuted/90">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-3 w-3 text-tsAccent" />
          <span className="uppercase tracking-[0.18em] text-tsAccentSoft">
            Profile signal
          </span>
        </div>
        {isAuthenticated && user ? (
          <p>
            Signed in as{" "}
            <span className="text-tsTextMain font-medium">
              {user.firstName || user.email}
            </span>
            . Scout tunes Marketplace, Community, and matches to your roles and county.
          </p>
        ) : (
          <p>
            You're browsing as a guest. Sign in to unlock personalized dashboards, saved searches, and local matches.
          </p>
        )}
      </div>
    </div>
  );
}
