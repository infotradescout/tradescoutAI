import React, { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  User,
  Users,
  MessageCircle,
  Bookmark,
  ClipboardList,
  Building,
  Shirt,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { safeNavigate } from "@/lib/safeNavigate";

type NavLinkProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: string | number;
  onNavigate?: (href: string) => void;
};

const NavLink: React.FC<NavLinkProps> = ({ href, icon, label, badge, onNavigate }) => {
  const [location] = useLocation();
  const pathOnly = location.split("?")[0].split("#")[0];
  const hrefPath = href.split("?")[0].split("#")[0];
  const isActive = pathOnly === hrefPath || pathOnly.startsWith(hrefPath + "/");

  return (
    <a
      href={href}
      onClick={(e) => {
        if (!onNavigate) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(href);
      }}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left no-underline transition-all duration-150"
      style={{
        backgroundColor: isActive
          ? "color-mix(in oklab, var(--theme-accent-primary) 10%, var(--surface-card))"
          : "transparent",
        borderLeft: isActive ? "2px solid var(--theme-accent-primary)" : "2px solid transparent",
      }}
    >
      {/* Icon */}
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: isActive
            ? "color-mix(in oklab, var(--theme-accent-primary) 18%, transparent)"
            : "color-mix(in oklab, var(--surface-frame) 80%, transparent)",
          color: isActive ? "var(--theme-accent-primary)" : "var(--text-secondary)",
        }}
      >
        {icon}
      </span>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <div
          className="text-[0.8rem] font-medium leading-tight"
          style={{ color: isActive ? "var(--theme-accent-primary)" : "var(--text-primary)" }}
        >
          {label}
        </div>
      </div>

      {/* Badge / chevron */}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {badge != null && String(badge).trim() !== "" && (
          <span className="inline-flex items-center rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        )}
        <ChevronRight
          className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
          style={{ color: "var(--text-secondary)" }}
        />
      </span>
    </a>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mb-1 px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.22em]"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      className="my-1 h-px w-full"
      style={{ backgroundColor: "color-mix(in oklab, var(--border-primary) 50%, transparent)" }}
    />
  );
}

type RightToolsPanelProps = {
  footer?: ReactNode;
  onNavigate?: () => void;
  contactRequestCount?: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function RightToolsPanel({
  footer,
  onNavigate,
  contactRequestCount = 0,
  collapsed = false,
  onToggleCollapsed,
}: RightToolsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const [, navigate] = useLocation();
  const messagesHref = contactRequestCount > 0 ? "/messages?tab=requests" : "/messages";

  const handleNavigate = (href: string) => {
    safeNavigate(navigate, href);
    onNavigate?.();
  };

  const displayName = (user as any)?.firstName || (user as any)?.name || "Guest";

  const locationLabel =
    (user as any)?.county && (user as any)?.state
      ? `${(user as any).county}, ${(user as any).state}`
      : undefined;

  // ── Collapsed state ──────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        className="h-full flex flex-col items-center gap-2 pt-2"
        style={{
          backgroundColor: "var(--surface-intermediate)",
          borderLeft: "1px solid color-mix(in oklab, var(--border-primary) 50%, transparent)",
          color: "var(--text-primary)",
          zIndex: 60,
        }}
      >
        <button
          type="button"
          aria-label="Expand tools panel"
          title="Expand tools"
          onClick={() => onToggleCollapsed?.()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:opacity-90 focus:outline-none"
          style={{
            borderColor: "var(--border-primary)",
            backgroundColor: "var(--surface-card)",
            color: "var(--theme-accent-primary)",
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="mt-auto pb-2">{footer}</div>
      </div>
    );
  }

  // ── Expanded state ───────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col relative"
      style={{
        backgroundColor: "var(--surface-intermediate)",
        borderLeft: "1px solid color-mix(in oklab, var(--border-primary) 50%, transparent)",
        color: "var(--text-primary)",
        zIndex: 60,
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{
          borderBottom: "1px solid color-mix(in oklab, var(--border-primary) 50%, transparent)",
        }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="text-[0.8rem] font-semibold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {displayName}
          </div>
          {locationLabel && (
            <div className="mt-0.5 text-[0.68rem]" style={{ color: "var(--text-secondary)" }}>
              {locationLabel}
            </div>
          )}
        </div>

        {onToggleCollapsed && (
          <button
            type="button"
            aria-label="Collapse tools panel"
            title="Collapse tools"
            onClick={() => onToggleCollapsed()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition hover:opacity-90 focus:outline-none"
            style={{
              borderColor: "var(--border-primary)",
              backgroundColor: "var(--surface-card)",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Scrollable nav body ── */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {/* Profile & account */}
        <PanelSection label="Profile">
          <NavLink
            href="/profile"
            icon={<User className="h-3.5 w-3.5" />}
            label="My profile"
            description="View and edit your public profile"
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/settings?tab=profile"
            icon={<Shield className="h-3.5 w-3.5" />}
            label="Profile settings"
            description="Theme, sections, booking, and visibility"
            onNavigate={handleNavigate}
          />
        </PanelSection>

        <Divider />

        <PanelSection label="Finance">
          <NavLink
            href="/finances"
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Finances"
            description="Overview, invoices, expenses, jobs, and reports"
            onNavigate={handleNavigate}
          />
        </PanelSection>

        <Divider />

        <PanelSection label="Operations">
          <NavLink
            href="/project-tracker"
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            label="Project tracker"
            description="Track active jobs and milestones"
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/analytics"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Analytics"
            description="Measure activity, outcomes, and trends"
            onNavigate={handleNavigate}
          />
        </PanelSection>

        <Divider />

        {/* Shortcuts */}
        <PanelSection label="Shortcuts">
          <NavLink
            href="/hoa-dashboard"
            icon={<Building className="h-3.5 w-3.5" />}
            label="HOA & neighborhood"
            description="Join or manage your neighborhood HOA"
            onNavigate={handleNavigate}
          />
          <NavLink
            href={messagesHref}
            icon={<MessageCircle className="h-3.5 w-3.5" />}
            label="Messages & quotes"
            description="Conversations, quotes, follow-ups"
            badge={
              contactRequestCount > 0
                ? contactRequestCount > 9
                  ? "9+"
                  : contactRequestCount
                : undefined
            }
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/connections"
            icon={<Users className="h-3.5 w-3.5" />}
            label="Approved contacts"
            description="People you can message directly"
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/saved-ads"
            icon={<Bookmark className="h-3.5 w-3.5" />}
            label="Saved items"
            description="Saved projects, listings, and ideas"
            onNavigate={handleNavigate}
          />
        </PanelSection>

        {/* Marketing tools */}
        {isAuthenticated && (
          <>
            <Divider />
            <PanelSection label="Marketing">
              <NavLink
                href="/marketing/scoutfitters"
                icon={<Shirt className="h-3.5 w-3.5" />}
                label="ScoutFitters"
                description="Rugged merch visualizer + fulfillment"
                onNavigate={handleNavigate}
              />
            </PanelSection>
          </>
        )}

        <Divider />

        {/* Notes */}
        <PanelSection label="Notes">
          <NavLink
            href="/notes"
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Open notes workspace"
            description="Full notes history and editing workspace"
            onNavigate={handleNavigate}
          />
          <EmbeddedNotesWorkspace />
        </PanelSection>

        <Divider />

        {/* Legal & policies */}
        <PanelSection label="Legal & policies">
          <NavLink
            href="/privacy"
            icon={<Settings className="h-3.5 w-3.5" />}
            label="Privacy & data"
            description="Privacy policy, data handling, and cookies"
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/terms"
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            label="Terms of service"
            description="Usage rules, responsibilities, and limits"
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/compliance"
            icon={<Building className="h-3.5 w-3.5" />}
            label="Compliance dashboard"
            description="Marketplace, INFORM Act, and safety disclosures"
            onNavigate={handleNavigate}
          />
          <NavLink
            href="/privacy"
            icon={<Bookmark className="h-3.5 w-3.5" />}
            label="Cookie controls"
            description="Cookie policy and preference controls"
            onNavigate={handleNavigate}
          />
        </PanelSection>
      </div>

      {/* ── Footer ── */}
      <div
        className="px-4 py-3 text-[0.7rem]"
        style={{
          borderTop: "1px solid color-mix(in oklab, var(--border-primary) 50%, transparent)",
          color: "var(--text-secondary)",
        }}
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
              className="inline-flex items-center gap-1 rounded-full border border-red-500/40 px-2.5 py-1 text-[0.65rem] text-red-400 transition hover:bg-red-600/10 hover:border-red-500/70"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          )}
        </div>
        {footer && (
          <div className="mt-2" style={{ color: "var(--text-secondary)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default RightToolsPanel;

// ─── Embedded mini notes inside the right workspace panel ────────────────────
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
    <div className="space-y-2 px-1">
      {/* Quick note textarea */}
      <div>
        <label className="text-[0.68rem]" style={{ color: "var(--text-secondary)" }}>
          Quick note
        </label>
        <textarea
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          onBlur={saveQuick}
          className="mt-1 w-full rounded-lg border px-2 py-1.5 text-[0.8rem] resize-none focus:outline-none focus:ring-1"
          style={{
            borderColor: "var(--border-primary)",
            backgroundColor: "color-mix(in oklab, var(--surface-card) 70%, transparent)",
            color: "var(--text-primary)",
            // @ts-expect-error CSS custom property is valid here.
            "--tw-ring-color": "var(--theme-accent-primary)",
          }}
          rows={3}
          placeholder="Type and click away to save…"
        />
      </div>

      {/* Recent notes */}
      {notes.length > 0 && (
        <div>
          <div className="mb-1 text-[0.68rem]" style={{ color: "var(--text-secondary)" }}>
            Recent
          </div>
          <ul className="space-y-1">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-md border px-2 py-1 text-[0.75rem] truncate"
                style={{
                  borderColor: "var(--border-secondary)",
                  color: "var(--text-primary)",
                  backgroundColor: "color-mix(in oklab, var(--surface-card) 60%, transparent)",
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

      {/* Open Notes link */}
      <div className="flex justify-end">
        <a
          href="/notes"
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[0.75rem] transition hover:opacity-80"
          style={{
            backgroundColor: "var(--surface-card)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        >
          Open Notes
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
