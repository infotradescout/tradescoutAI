import React, { ReactNode, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  User,
  Settings,
  Bell,
  LayoutDashboard,
  MessageCircle,
  Bookmark,
  ClipboardList,
  Building,
  LogOut,
  StickyNote,
} from "lucide-react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { openFloatingNote } from "@/lib/floatingNotes";

type NavLinkProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
};

const NavLink: React.FC<NavLinkProps> = ({
  href,
  icon,
  label,
  description,
  onClick,
}) => (
  <Link
    href={href}
    onClick={onClick}
    className="flex flex-col gap-1 rounded-xl border transition-colors"
    style={{
      borderColor: 'var(--border-primary)',
      backgroundColor: 'var(--charcoal-700)',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--charcoal-800)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--charcoal-700)';
    }}
  >
    <div className="px-3 py-2 flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border" style={{ backgroundColor: 'var(--charcoal-800)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
        {icon}
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </div>
    {description && (
      <p className="px-3 pb-2 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
    )}
  </Link>
);

type RightToolsPanelProps = {
  footer?: ReactNode;
  onNavigate?: () => void;
};

const ActionButton = ({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left flex flex-col gap-1 rounded-xl border transition-colors"
    style={{
      borderColor: 'var(--border-primary)',
      backgroundColor: 'var(--charcoal-700)',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--charcoal-800)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--charcoal-700)';
    }}
  >
    <div className="px-3 py-2 flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border" style={{ backgroundColor: 'var(--charcoal-800)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
        {icon}
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </div>
    {description && (
      <p className="px-3 pb-2 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
    )}
  </button>
);


export function RightToolsPanel({ footer, onNavigate }: RightToolsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    "Guest";

  const locationLabel =
    (user as any)?.county && (user as any)?.state
      ? `${(user as any).county}, ${(user as any).state}`
      : undefined;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--charcoal-800)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-secondary)' }}>
        <div className="text-[0.65rem] uppercase tracking-[0.3em]" style={{ color: 'var(--text-secondary)' }}>
          Your space
        </div>
        <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {displayName}
        </div>
        {locationLabel && (
          <div className="text-[0.7rem] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {locationLabel}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Profile & account */}
        <section>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
            Profile
          </div>
          <div className="space-y-2">
            <NavLink
              href="/profile"
              icon={<User className="h-3.5 w-3.5 text-orange-400" />}
              label="My profile"
              description="View and edit your public profile, sections, and visibility."
              onClick={onNavigate}
            />
            <NavLink
              href="/settings"
              icon={<Settings className="h-3.5 w-3.5 text-orange-400" />}
              label="Account settings"
              description="Notifications, app behavior, and connected tools."
              onClick={onNavigate}
            />
            <NavLink
              href="/finances"
              icon={<ClipboardList className="h-3.5 w-3.5 text-orange-400" />}
              label="Finances"
              description="Invoices, jobs, and money flows."
              onClick={onNavigate}
            />
            <NavLink
              href="/notifications"
              icon={<Bell className="h-3.5 w-3.5 text-orange-400" />}
              label="Notifications"
              description="Control alerts from Scout and jobs."
              onClick={onNavigate}
            />
          </div>
        </section>

        {/* Workspaces (user-specific) */}
        <section>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
            Workspaces
          </div>
          <div className="space-y-2">
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="h-3.5 w-3.5 text-orange-400" />}
              label="Dashboard"
              description="Your personal hub and live metrics."
              onClick={onNavigate}
            />
            <NavLink
              href="/finances"
              icon={<ClipboardList className="h-3.5 w-3.5 text-orange-400" />}
              label="Finances workspace"
              description="Invoices, job records, and deal workflow."
              onClick={onNavigate}
            />
            <NavLink
              href="/hoa-management"
              icon={<Building className="h-3.5 w-3.5 text-orange-400" />}
              label="HOA & neighborhood"
              description="Join or manage your neighborhood HOA."
              onClick={onNavigate}
            />
            <NavLink
              href="/messages"
              icon={<MessageCircle className="h-3.5 w-3.5 text-orange-400" />}
              label="Messages & quotes"
              description="Conversations, quotes, follow-ups."
              onClick={onNavigate}
            />
            <NavLink
              href="/saved"
              icon={<Bookmark className="h-3.5 w-3.5 text-orange-400" />}
              label="Saved items"
              description="Saved projects, listings, and ideas."
              onClick={onNavigate}
            />
          </div>
        </section>

        {/* Notes & quick capture */}
        <section>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
            Notes
          </div>
          <div className="space-y-2">
            <ActionButton
              icon={<StickyNote className="h-3.5 w-3.5 text-orange-400" />}
              label="Quick note"
              description="Open a pinned note window that stays on top while you work."
              onClick={() => {
                void openFloatingNote("quick");
                onNavigate?.();
              }}
            />
            <ActionButton
              icon={<StickyNote className="h-3.5 w-3.5 text-orange-400" />}
              label="Project note"
              description="Keep a project-specific note floating while switching apps."
              onClick={() => {
                void openFloatingNote("project");
                onNavigate?.();
              }}
            />
            {/* Embedded notes workspace */}
            <EmbeddedNotesWorkspace />
          </div>
        </section>

        {/* Legal & policies */}
        <section>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
            Legal &amp; policies
          </div>
          <div className="space-y-2">
            <NavLink
              href="/legal/privacy-policy"
              icon={<Settings className="h-3.5 w-3.5 text-orange-400" />}
              label="Privacy & data"
              description="Privacy policy, data handling, and cookie use."
              onClick={onNavigate}
            />
            <NavLink
              href="/terms"
              icon={<ClipboardList className="h-3.5 w-3.5 text-orange-400" />}
              label="Terms of service"
              description="Usage rules, responsibilities, and limits."
              onClick={onNavigate}
            />
            <NavLink
              href="/legal/compliance"
              icon={<Building className="h-3.5 w-3.5 text-orange-400" />}
              label="Compliance dashboard"
              description="Marketplace, INFORM Act, and safety disclosures."
              onClick={onNavigate}
            />
            <NavLink
              href="/legal/cookie-policy"
              icon={<Bookmark className="h-3.5 w-3.5 text-orange-400" />}
              label="Cookie controls"
              description="Cookie policy and preference controls."
              onClick={onNavigate}
            />
          </div>
        </section>
      </div>

      {/* Footer / bottom tab content */}
      <div className="border-t px-4 py-3 text-[0.7rem] space-y-2" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="truncate">Signed in as {displayName}</div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                logout();
                onNavigate?.();
              }}
              className="inline-flex items-center gap-1 rounded-full border border-red-500/60 px-2 py-1 text-[0.65rem] text-red-300 hover:bg-red-600/10"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign out</span>
            </button>
          )}
        </div>
        {footer && <div style={{ color: 'var(--text-secondary)' }}>{footer}</div>}
      </div>
    </div>
  );
}

export default RightToolsPanel;

// Embedded mini notes inside the right workspace panel
function EmbeddedNotesWorkspace() {
  const [notes, setNotes] = useState<Array<{ id: string; text: string }>>([]);
  const [quickText, setQuickText] = useState<string>("");

  useEffect(() => {
    try {
      const arr: Array<{ id: string; text: string }> = [];
      for (let i = 0; i < (typeof window !== 'undefined' ? window.localStorage.length : 0); i++) {
        const key = window.localStorage.key(i) || "";
        if (!key.startsWith("ts:note:")) continue;
        const id = key.slice("ts:note:".length);
        const val = window.localStorage.getItem(key) || "";
        arr.push({ id, text: val });
      }
      // Show most recent first by simple length heuristic
      setNotes(arr.reverse().slice(0, 5));
      setQuickText(window.localStorage.getItem("ts:note:quick") || "");
    } catch {
      // ignore storage errors
    }
  }, []);

  const saveQuick = () => {
    try {
      window.localStorage.setItem("ts:note:quick", quickText);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--charcoal-700)' }}>
      <div className="px-3 pt-2 text-[0.7rem] uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
        Workspace notes
      </div>
      <div className="px-3 pb-2 space-y-2">
        <div>
          <label className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>Quick note</label>
          <textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onBlur={saveQuick}
            className="mt-1 w-full rounded-lg border px-2 py-1 text-[0.8rem]"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--charcoal-800)', color: 'var(--text-primary)' }}
            rows={3}
            placeholder="Type and click away to save"
          />
        </div>
        {notes.length > 0 && (
          <div>
            <div className="text-[0.7rem] mb-1" style={{ color: 'var(--text-secondary)' }}>Recent</div>
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border px-2 py-1 text-[0.8rem] truncate" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-primary)', backgroundColor: 'var(--charcoal-800)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{n.id}</span>
                  <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>{n.text.slice(0, 60)}{n.text.length > 60 ? '…' : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="pt-1">
          <Link href="/notes" className="inline-flex items-center rounded-md border px-2 py-1 text-[0.75rem]" style={{ borderColor: 'var(--border-primary)', color: 'var(--theme-accent-primary)' }}>
            Open full Notes
          </Link>
        </div>
      </div>
    </div>
  );
}
