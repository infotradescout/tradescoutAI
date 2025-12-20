import React, { ReactNode } from "react";
import { Link } from "wouter";
import {
  User,
  Settings,
  Bell,
  LayoutDashboard,
  MessageCircle,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavLinkProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
};

const NavLink: React.FC<NavLinkProps> = ({
  href,
  icon,
  label,
  description,
}) => (
  <Link
    href={href}
    className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/60 px-3 py-2 hover:bg-slate-900"
  >
    <div className="flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-50">{label}</span>
    </div>
    {description && (
      <p className="text-[11px] text-slate-400 leading-snug">
        {description}
      </p>
    )}
  </Link>
);

type RightToolsPanelProps = {
  footer?: ReactNode;
};

export function RightToolsPanel({ footer }: RightToolsPanelProps) {
  const { user } = useAuth();

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    "Guest";

  const locationLabel =
    (user as any)?.county && (user as any)?.state
      ? `${(user as any).county}, ${(user as any).state}`
      : undefined;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
          Your space
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-50">
          {displayName}
        </div>
        {locationLabel && (
          <div className="text-[0.7rem] text-slate-400 mt-0.5">
            {locationLabel}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Profile & account */}
        <section>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500 mb-2">
            Profile
          </div>
          <div className="space-y-2">
            <NavLink
              href="/profile"
              icon={<User className="h-3.5 w-3.5 text-orange-400" />}
              label="View profile"
              description="How homeowners and contractors see you."
            />
            <NavLink
              href="/settings"
              icon={<Settings className="h-3.5 w-3.5 text-orange-400" />}
              label="Account settings"
              description="Login, preferences, and privacy."
            />
            <NavLink
              href="/notifications"
              icon={<Bell className="h-3.5 w-3.5 text-orange-400" />}
              label="Notifications"
              description="Control alerts from Scout and jobs."
            />
          </div>
        </section>

        {/* Workspaces (user-specific) */}
        <section>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500 mb-2">
            Workspaces
          </div>
          <div className="space-y-2">
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="h-3.5 w-3.5 text-orange-400" />}
              label="Dashboard"
              description="Your personal hub and live metrics."
            />
            <NavLink
              href="/messages"
              icon={<MessageCircle className="h-3.5 w-3.5 text-orange-400" />}
              label="Messages & quotes"
              description="Conversations, quotes, follow-ups."
            />
            <NavLink
              href="/saved"
              icon={<Bookmark className="h-3.5 w-3.5 text-orange-400" />}
              label="Saved items"
              description="Saved projects, listings, and ideas."
            />
          </div>
        </section>
      </div>

      {/* Footer / bottom tab content */}
      <div className="border-t border-slate-800 px-4 py-2 text-[0.7rem] text-slate-500 space-y-1">
        <div>Signed in as {displayName}</div>
        {footer && <div className="text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}

export default RightToolsPanel;
