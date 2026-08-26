import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Compass,
  HelpCircle,
  Home,
  MapPin,
  MessageCircle,
  NotebookPen,
  Pencil,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";

type AuthenticatedSocialFrameProps = {
  children: ReactNode;
  contactRequestCount?: number;
};

type RailLink = {
  label: string;
  href: string;
  icon: typeof Home;
  badge?: string | number;
};

const panelStyle = {
  borderColor: "color-mix(in oklab, var(--border-primary) 78%, transparent)",
  background:
    "linear-gradient(180deg, color-mix(in oklab, var(--surface-card) 96%, transparent), color-mix(in oklab, var(--surface-intermediate) 88%, transparent))",
  boxShadow:
    "inset 0 1px 0 color-mix(in oklab, white 4%, transparent), 0 18px 48px color-mix(in oklab, black 22%, transparent)",
} as const;

function resolveDisplayName(user: any): string {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (typeof user?.name === "string" && user.name.trim()) return user.name.trim();
  if (typeof user?.email === "string" && user.email.trim()) {
    return user.email.split("@")[0] || "My TradeScout";
  }
  return "My TradeScout";
}

function resolveInitials(user: any, displayName: string): string {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  if (typeof user?.email === "string") return user.email.slice(0, 2).toUpperCase();
  return "TS";
}

function resolveLocationLabel(user: any): string | null {
  const city = String(user?.city || "").trim();
  const county = String(user?.countyName || user?.county || "").trim();
  const state = String(user?.stateCode || user?.state || "").trim();

  if (city && state) return `${city}, ${state}`;
  if (county && state) return `${county}, ${state}`;
  if (city) return city;
  if (county) return county;
  if (state) return state;
  return null;
}

function routeMatches(pathOnly: string, href: string): boolean {
  const hrefPath = href.split("?")[0].split("#")[0];
  if (hrefPath === "/direct-connect") return pathOnly === hrefPath;
  return pathOnly === hrefPath || pathOnly.startsWith(`${hrefPath}/`);
}

function RailNavLink({ item, pathOnly }: { item: RailLink; pathOnly: string }) {
  const Icon = item.icon;
  const active = routeMatches(pathOnly, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium no-underline transition-[background-color,border-color,transform] hover:-translate-y-px"
      style={{
        borderColor: active
          ? "color-mix(in oklab, var(--theme-accent-primary) 46%, transparent)"
          : "transparent",
        backgroundColor: active
          ? "color-mix(in oklab, var(--theme-accent-primary) 11%, var(--surface-card))"
          : "transparent",
        color: active ? "var(--theme-accent-primary)" : "var(--text-primary)",
      }}
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{
          borderColor: active
            ? "color-mix(in oklab, var(--theme-accent-primary) 38%, transparent)"
            : "color-mix(in oklab, var(--border-primary) 68%, transparent)",
          backgroundColor: active
            ? "color-mix(in oklab, var(--theme-accent-primary) 14%, transparent)"
            : "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
        }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge != null ? (
        <span
          className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: "var(--theme-accent-primary)",
            color: "var(--surface-frame)",
          }}
        >
          {item.badge}
        </span>
      ) : (
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="px-2 text-[10px] font-bold uppercase tracking-[0.2em]"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

/**
 * Restores the familiar signed-in TradeScout composition: account rail,
 * working surface, and activity rail. The existing AppShell navigation stays
 * authoritative; this component only structures authenticated page content.
 */
export function AuthenticatedSocialFrame({
  children,
  contactRequestCount = 0,
}: AuthenticatedSocialFrameProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const pathOnly = location.split("?")[0].split("#")[0];
  const displayName = resolveDisplayName(user);
  const initials = resolveInitials(user, displayName);
  const locationLabel = resolveLocationLabel(user);
  const profileImageUrl =
    typeof (user as any)?.profileImageUrl === "string" ? (user as any).profileImageUrl : "";

  const accountLinks: RailLink[] = [
    { label: "My profile", href: "/profile", icon: Home },
    { label: "Edit profile", href: "/profile-settings", icon: Pencil },
    { label: "My requests", href: "/direct-connect/active", icon: ClipboardList },
    {
      label: "Inbox",
      href: "/direct-connect/inbox",
      icon: MessageCircle,
      badge: contactRequestCount > 0 ? (contactRequestCount > 9 ? "9+" : contactRequestCount) : undefined,
    },
    { label: "Connections", href: "/connections", icon: Users },
    { label: "Saved", href: "/saved-ads", icon: Bookmark },
  ];

  const exploreLinks: RailLink[] = [
    {
      label: "Find businesses",
      href: ROUTES.CONTRACTORS ?? "/contractors",
      icon: Search,
    },
    {
      label: "Community",
      href: ROUTES.COMMUNITY ?? "/community",
      icon: Users,
    },
    {
      label: "Exchange",
      href: ROUTES.EXCHANGE ?? "/exchange",
      icon: Building2,
    },
    { label: "HomeID", href: "/homes", icon: Home },
  ];

  return (
    <div
      data-testid="authenticated-social-frame"
      className="mx-auto grid w-full max-w-[1880px] min-w-0 gap-4 px-3 pb-5 pt-3 sm:px-4 lg:px-5 xl:grid-cols-[232px_minmax(0,1fr)] xl:px-4 2xl:grid-cols-[244px_minmax(0,1fr)_304px] 2xl:gap-5 2xl:px-6"
    >
      <aside className="hidden min-w-0 xl:block" aria-label="Account shortcuts">
        <div className="sticky top-3 space-y-4">
          <section className="overflow-hidden rounded-2xl border" style={panelStyle}>
            <div
              className="h-16"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at 18% 15%, color-mix(in oklab, var(--theme-accent-primary) 28%, transparent), transparent 42%), linear-gradient(135deg, color-mix(in oklab, var(--surface-intermediate) 96%, transparent), var(--surface-frame))",
              }}
            />
            <div className="px-4 pb-4">
              <div className="-mt-8 flex items-end justify-between gap-3">
                <div
                  className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 text-lg font-bold shadow-xl"
                  style={{
                    borderColor: "var(--theme-accent-primary)",
                    backgroundColor: "var(--surface-frame)",
                    color: "var(--text-primary)",
                  }}
                >
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <Link
                  href="/profile-settings"
                  aria-label="Open account settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor: "var(--surface-intermediate)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <h2 className="mt-3 truncate text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {displayName}
              </h2>
              {locationLabel ? (
                <p
                  className="mt-1 flex items-center gap-1.5 truncate text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {locationLabel}
                </p>
              ) : (
                <Link
                  href="/settings"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: "var(--theme-accent-primary)" }}
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Set your location
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-2xl border p-2" style={panelStyle}>
            <SectionLabel>Your TradeScout</SectionLabel>
            <nav className="mt-2 space-y-0.5" aria-label="Your TradeScout">
              {accountLinks.map((item) => (
                <RailNavLink key={item.href} item={item} pathOnly={pathOnly} />
              ))}
            </nav>
          </section>

          <section className="rounded-2xl border p-2" style={panelStyle}>
            <SectionLabel>Explore</SectionLabel>
            <nav className="mt-2 space-y-0.5" aria-label="Explore TradeScout">
              {exploreLinks.map((item) => (
                <RailNavLink key={item.href} item={item} pathOnly={pathOnly} />
              ))}
            </nav>
          </section>
        </div>
      </aside>

      <section className="min-w-0" data-testid="authenticated-social-frame-content">
        {children}
      </section>

      <aside className="hidden min-w-0 2xl:block" aria-label="Activity and quick actions">
        <div className="sticky top-3 space-y-4">
          <section className="rounded-2xl border p-4" style={panelStyle}>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--theme-accent-primary)" }}
            >
              Your activity
            </p>
            <div className="mt-3 flex items-start gap-3">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  borderColor:
                    "color-mix(in oklab, var(--theme-accent-primary) 40%, transparent)",
                  backgroundColor:
                    "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
                  color: "var(--theme-accent-primary)",
                }}
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {contactRequestCount > 0
                    ? `${contactRequestCount} inbox ${contactRequestCount === 1 ? "item" : "items"} waiting`
                    : "Your inbox is clear"}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                  Review replies, requests, and conversations without leaving TradeScout.
                </p>
              </div>
            </div>
            <Link
              href="/direct-connect/inbox"
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--theme-accent-primary) 46%, transparent)",
                backgroundColor:
                  "color-mix(in oklab, var(--theme-accent-primary) 12%, var(--surface-card))",
                color: "var(--theme-accent-primary)",
              }}
            >
              Open inbox
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          <section className="rounded-2xl border p-4" style={panelStyle}>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Get something done
            </h2>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
              Start with the outcome. TradeScout keeps the request, replies, and next steps together.
            </p>
            <div className="mt-3 grid gap-2">
              <Link
                href="/direct-connect"
                className="inline-flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-semibold"
                style={{
                  borderColor: "var(--theme-accent-primary)",
                  backgroundColor: "var(--theme-accent-primary)",
                  color: "var(--surface-frame)",
                }}
              >
                Start a Request
                <Compass className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/direct-connect/active"
                className="inline-flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-semibold"
                style={{
                  borderColor: "var(--border-primary)",
                  backgroundColor:
                    "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                  color: "var(--text-primary)",
                }}
              >
                My requests
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border p-4" style={panelStyle}>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Local connection
            </h2>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
              {locationLabel
                ? `See people, businesses, and activity around ${locationLabel}.`
                : "Set your location to make community and business discovery local."}
            </p>
            <Link
              href={ROUTES.COMMUNITY ?? "/community"}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-sm font-semibold"
              style={{
                borderColor: "var(--border-primary)",
                backgroundColor:
                  "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                color: "var(--text-primary)",
              }}
            >
              Open community
              <Users className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          <section className="rounded-2xl border p-2" style={panelStyle}>
            <SectionLabel>Shortcuts</SectionLabel>
            <nav className="mt-2 space-y-0.5" aria-label="Account shortcuts">
              <RailNavLink
                item={{ label: "Notes", href: "/notes", icon: NotebookPen }}
                pathOnly={pathOnly}
              />
              <RailNavLink
                item={{ label: "Settings", href: "/settings", icon: Settings }}
                pathOnly={pathOnly}
              />
              <RailNavLink
                item={{ label: "Help center", href: ROUTES.HELP ?? "/help", icon: HelpCircle }}
                pathOnly={pathOnly}
              />
              <RailNavLink
                item={{
                  label: "Calendar",
                  href: "/community-feed?compose=1&category=event",
                  icon: CalendarDays,
                }}
                pathOnly={pathOnly}
              />
            </nav>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default AuthenticatedSocialFrame;
