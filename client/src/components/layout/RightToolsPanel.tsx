import React, { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
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
  Shield,
} from "lucide-react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { openFloatingNote } from "@/lib/floatingNotes";
import { safeNavigate } from "@/lib/safeNavigate";

type NavLinkProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onNavigate?: (href: string) => void;
};

const NavLink: React.FC<NavLinkProps> = ({ href, icon, label, description, onNavigate }) => (
  <a
    href={href}
    onClick={(e) => {
      // If JS routing isn't wired for some reason, let the browser navigate normally.
      if (!onNavigate) return;
      // Allow open-in-new-tab behavior.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onNavigate(href);
    }}
    className="flex flex-col gap-1 rounded-xl transition-colors cursor-pointer"
    style={{
      borderColor: "var(--border-primary)",
      backgroundColor: "var(--surface-intermediate)",
      width: "100%",
      textAlign: "left",
      textDecoration: "none",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-card)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-intermediate)";
    }}
  >
    <div className="px-3 py-2 flex items-center gap-2">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
        style={{
          backgroundColor: "var(--surface-intermediate)",
          borderColor: "var(--border-primary)",
          color: "var(--text-primary)",
        }}
      >
        {icon}
      </span>
      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </div>
    {description && (
      <p className="px-3 pb-2 text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    )}
  </a>
);

type RightToolsPanelProps = {
  footer?: ReactNode;
  onNavigate?: () => void;
};

export function RightToolsPanel({ footer, onNavigate }: RightToolsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const [, navigate] = useLocation();

  const handleNavigate = (href: string) => {
    safeNavigate(navigate, href);
    onNavigate?.();
  };

  const displayName = (user as any)?.firstName || (user as any)?.name || "Guest";

  const locationLabel =
    (user as any)?.county && (user as any)?.state
      ? `${(user as any).county}, ${(user as any).state}`
      : undefined;

  return (
    <div
      className="h-full flex flex-col relative"
      style={{
        backgroundColor: "var(--surface-intermediate)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        color: "var(--text-primary)",
        zIndex: 60,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-secondary)" }}>
        <div
          className="text-[0.65rem] uppercase tracking-[0.3em]"
          style={{ color: "var(--text-secondary)" }}
        >
          Your space
        </div>
        <div className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {displayName}
        </div>
        {locationLabel && (
          <div className="text-[0.7rem] mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {locationLabel}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Profile & account */}
        <section>
          <div
            className="text-[0.7rem] uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Profile
          </div>
          <div className="space-y-2">
            <NavLink
              href="/profile"
              icon={
                <User className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />
              }
              label="My profile"
              description="View and edit your public profile, sections, and visibility."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/settings"
              icon={
                <Settings
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--theme-accent-primary)" }}
                />
              }
              label="Account settings"
              description="Notifications, app behavior, and connected tools."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/notifications"
              icon={
                <Bell className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />
              }
              label="Notifications"
              description="Control alerts from Scout and jobs."
              onNavigate={handleNavigate}
            />
          </div>
        </section>

        {/* Workspaces (user-specific) */}
        <section>
          <div
            className="text-[0.7rem] uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Workspaces
          </div>
          <div className="space-y-2">
            {user?.isAdmin && (user as any)?.isSuperAdmin ? (
              <NavLink
                href="/admin/panel"
                icon={
                  <LayoutDashboard
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--theme-accent-primary)" }}
                  />
                }
                label="Super Admin OS"
                description="Full-site controls for TradeScout."
                onNavigate={handleNavigate}
              />
            ) : (
              <NavLink
                href="/scout"
                icon={
                  <LayoutDashboard
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--theme-accent-primary)" }}
                  />
                }
                label="Scout hub"
                description="Assistant-first workspace with your live dashboard."
                onNavigate={handleNavigate}
              />
            )}
            <NavLink
              href="/finances"
              icon={
                <ClipboardList
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--theme-accent-primary)" }}
                />
              }
              label="Finances workspace"
              description="Invoices, job records, and deal workflow."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/hoa-dashboard"
              icon={
                <Building
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--theme-accent-primary)" }}
                />
              }
              label="HOA & neighborhood"
              description="Join or manage your neighborhood HOA."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/messages"
              icon={
                <MessageCircle
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--theme-accent-primary)" }}
                />
              }
              label="Messages & quotes"
              description="Conversations, quotes, follow-ups."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/saved-ads"
              icon={
                <Bookmark
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--theme-accent-primary)" }}
                />
              }
              label="Saved items"
              description="Saved projects, listings, and ideas."
              onNavigate={handleNavigate}
            />
          </div>
        </section>

        {/* Notes */}
        <section>
          <div
            className="text-[0.7rem] uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Notes
          </div>
          <div className="space-y-2">
            {/* Embedded notes workspace only; full Notes is reachable via main nav/Scout */}
            <EmbeddedNotesWorkspace />
          </div>
        </section>

        {/* Legal & policies */}
        <section>
          <div
            className="text-[0.7rem] uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Legal &amp; policies
          </div>
          <div className="space-y-2">
            <NavLink
              href="/privacy"
              icon={<Settings className="h-3.5 w-3.5 text-orange-400" />}
              label="Privacy & data"
              description="Privacy policy, data handling, and cookie use."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/terms"
              icon={<ClipboardList className="h-3.5 w-3.5 text-orange-400" />}
              label="Terms of service"
              description="Usage rules, responsibilities, and limits."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/compliance"
              icon={<Building className="h-3.5 w-3.5 text-orange-400" />}
              label="Compliance dashboard"
              description="Marketplace, INFORM Act, and safety disclosures."
              onNavigate={handleNavigate}
            />
            <NavLink
              href="/privacy"
              icon={<Bookmark className="h-3.5 w-3.5 text-orange-400" />}
              label="Cookie controls"
              description="Cookie policy and preference controls."
              onNavigate={handleNavigate}
            />
          </div>
        </section>
      </div>

      {/* Footer / bottom tab content */}
      <div
        className="border-t px-4 py-3 text-[0.7rem] space-y-2"
        style={{ borderColor: "var(--border-secondary)", color: "var(--text-secondary)" }}
      >
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
        {footer && <div style={{ color: "var(--text-secondary)" }}>{footer}</div>}
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
      for (let i = 0; i < (typeof window !== "undefined" ? window.localStorage.length : 0); i++) {
        const key = window.localStorage.key(i) || "";
        if (!key.startsWith("ts:note:")) continue;
        const id = key.slice("ts:note:".length);
        const raw = window.localStorage.getItem(key) || "";
        let text = raw;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
            text = parsed.text as string;
          }
        } catch {
          // keep raw
        }
        arr.push({ id, text });
      }
      // Show most recent first by simple length heuristic
      setNotes(arr.reverse().slice(0, 5));
      const quickRaw = window.localStorage.getItem("ts:note:quick") || "";
      try {
        const parsedQuick = JSON.parse(quickRaw);
        setQuickText(typeof parsedQuick?.text === "string" ? parsedQuick.text : quickRaw);
      } catch {
        setQuickText(quickRaw);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const saveQuick = () => {
    try {
      const payload = JSON.stringify({ text: quickText, updatedAt: Date.now() });
      window.localStorage.setItem("ts:note:quick", payload);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: "var(--border-primary)",
        backgroundColor: "var(--surface-intermediate)",
      }}
    >
      <div
        className="px-3 pt-2 text-[0.7rem] uppercase tracking-[0.2em]"
        style={{ color: "var(--text-secondary)" }}
      >
        Workspace notes
      </div>
      <div className="px-3 pb-2 space-y-2">
        <div>
          <label className="text-[0.7rem]" style={{ color: "var(--text-secondary)" }}>
            Quick note
          </label>
          <textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onBlur={saveQuick}
            className="mt-1 w-full rounded-lg border px-2 py-1 text-[0.8rem]"
            style={{
              borderColor: "var(--border-primary)",
              backgroundColor: "var(--surface-intermediate)",
              color: "var(--text-primary)",
            }}
            rows={3}
            placeholder="Type and click away to save"
          />
        </div>
        {notes.length > 0 && (
          <div>
            <div className="text-[0.7rem] mb-1" style={{ color: "var(--text-secondary)" }}>
              Recent
            </div>
            <ul className="space-y-1">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-md border px-2 py-1 text-[0.8rem] truncate"
                  style={{
                    borderColor: "var(--border-secondary)",
                    color: "var(--text-primary)",
                    backgroundColor: "var(--surface-intermediate)",
                  }}
                >
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {n.id}
                  </span>
                  <span className="ml-2" style={{ color: "var(--text-secondary)" }}>
                    {n.text.slice(0, 60)}
                    {n.text.length > 60 ? "…" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Notes routing button */}
        <div className="mt-3 flex justify-end">
          <a
            href="/notes"
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[0.8rem]"
            style={{
              backgroundColor: "var(--surface-card)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            Open Notes
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M13.5 4.5a.75.75 0 0 1 .75-.75h5.25a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V6.31l-6.97 6.97a.75.75 0 1 1-1.06-1.06l6.97-6.97h-3.44a.75.75 0 0 1-.75-.75Z" />
              <path d="M3.75 5.25A2.25 2.25 0 0 1 6 3h5.25a.75.75 0 0 1 0 1.5H6A.75.75 0 0 0 5.25 5.25v12A.75.75 0 0 0 6 18.75h12a.75.75 0 0 0 .75-.75V12.75a.75.75 0 0 1 1.5 0V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18V5.25Z" />
            </svg>
          </a>
        </div>
        {/* Full Notes entry removed (accessible via other nav + Scout chips) */}
      </div>
    </div>
  );
}
