import { useEffect, useMemo, type ReactNode } from "react";
import {
  Building,
  ClipboardList,
  Compass,
  Share2,
  ShoppingBag,
  Users,
  Wrench,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ROUTES } from "@/lib/routes";
import { isOnboardingSurfacePath } from "@/lib/onboardingSurface";
import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState";
import AppShellCore from "./AppShellCore";
import type { NavItem } from "./AppShellCore";

export type { NavItem } from "./AppShellCore";

type AppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

const DESKTOP_APP_RAIL_WIDTH = "76px";

function isPublicProfileLikePath(pathOnly: string): boolean {
  if (/^\/(?:u|p)\/[^/]+(?:\/|$)/i.test(pathOnly)) return true;
  if (/^\/business\/[^/]+(?:\/edit)?$/i.test(pathOnly)) return true;
  if (/^\/profile\/[^/]+$/i.test(pathOnly)) return true;
  if (/^\/helpers\/[^/]+$/i.test(pathOnly)) return true;
  if (pathOnly === "/jw-stone" || pathOnly.startsWith("/jw-stone/")) return true;

  if (/^\/contractors\/[^/]+$/i.test(pathOnly)) {
    return pathOnly !== "/contractors/top" && pathOnly !== "/contractors/board";
  }

  return false;
}

function buildDesktopPrimaryNav(): NavItem[] {
  const iconStyle = { color: "currentColor" } as const;

  return [
    {
      label: "Scout",
      href: "/scout",
      icon: <Compass className="h-5 w-5" style={iconStyle} />,
      description: "Ask TradeScout what to do next.",
    },
    {
      label: "Requests",
      href: DIRECT_CONNECT_TASKBAR_RESUME_HREF,
      icon: <ClipboardList className="h-5 w-5" style={iconStyle} />,
      description: "Create requests, track replies, and continue work.",
    },
    {
      label: "Businesses",
      href: ROUTES.CONTRACTORS ?? "/contractors",
      icon: <Building className="h-5 w-5" style={iconStyle} />,
      description: "Find businesses that serve your area.",
    },
    {
      label: "Jobs",
      href: "/direct-connect/opportunities",
      icon: <Wrench className="h-5 w-5" style={iconStyle} />,
      description: "Find work, hire, and manage applicants.",
    },
    {
      label: "Community",
      href: ROUTES.COMMUNITY ?? "/community",
      icon: <Users className="h-5 w-5" style={iconStyle} />,
      description: "See nearby posts and updates.",
    },
    {
      label: "Exchange",
      href: ROUTES.EXCHANGE ?? "/exchange",
      icon: <ShoppingBag className="h-5 w-5" style={iconStyle} />,
      description: "Buy, sell, rent, and browse listings.",
    },
    {
      label: "Share",
      href: "/share",
      icon: <Share2 className="h-5 w-5" style={iconStyle} />,
      description: "Share attributable links and activity.",
    },
  ];
}

function isNavItemActive(pathOnly: string, item: NavItem): boolean {
  const itemPath = item.href.split("?")[0].split("#")[0] || "/";
  if (itemPath === "/direct-connect") {
    return pathOnly === itemPath || pathOnly.startsWith("/direct-connect/");
  }
  if (itemPath === "/community") {
    return (
      pathOnly === "/community" ||
      pathOnly.startsWith("/community-") ||
      pathOnly.startsWith("/community/")
    );
  }
  return pathOnly === itemPath || pathOnly.startsWith(`${itemPath}/`);
}

/**
 * Owns the stable TradeScout OS chrome. Mobile keeps the compact bottom taskbar
 * owned by AppShellCore; signed-in desktop gets a dedicated application rail.
 */
export function AppShell({ children, footer }: AppShellProps) {
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const pathOnly = location.split("?")[0].split("#")[0] || "/";

  const customDomainProfileSlug =
    typeof window !== "undefined"
      ? String(
          (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
            .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__ || ""
        ).trim()
      : "";

  const isAuthOrSetupSurface =
    pathOnly.startsWith("/create-account") ||
    pathOnly.startsWith("/login") ||
    pathOnly.startsWith("/register") ||
    pathOnly.startsWith("/pre-scout-setup") ||
    isOnboardingSurfacePath(pathOnly);
  const isAdminSurface = pathOnly.startsWith("/admin");
  const isPublicProfileSurface =
    Boolean(customDomainProfileSlug) || isPublicProfileLikePath(pathOnly);
  const isApplicationUiSurface =
    !isAuthOrSetupSurface && !isAdminSurface && !isPublicProfileSurface;

  const showDesktopAppRail = Boolean(isAuthenticated) && !isMobile && isApplicationUiSurface;

  const desktopPrimaryNav = useMemo(() => buildDesktopPrimaryNav(), []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle("ts-desktop-app-rail-active", showDesktopAppRail);
    return () => {
      document.body.classList.remove("ts-desktop-app-rail-active");
    };
  }, [showDesktopAppRail]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle("ts-application-ui-scope", isApplicationUiSurface);
    return () => {
      document.body.classList.remove("ts-application-ui-scope");
    };
  }, [isApplicationUiSurface]);

  return (
    <>
      <style>{`
        body.ts-desktop-app-rail-active .app-shell .ts-shell-main {
          left: ${DESKTOP_APP_RAIL_WIDTH} !important;
        }

        body.ts-desktop-app-rail-active .ts-desktop-app-rail {
          width: ${DESKTOP_APP_RAIL_WIDTH};
        }

        body.ts-desktop-app-rail-active .scout-search-dock-fixed {
          left: calc(${DESKTOP_APP_RAIL_WIDTH} + 0.5rem) !important;
        }

        /*
         * Core-app dark-surface convergence layer. These exact utility values
         * are legacy styling authorities still present in application pages.
         * Public/custom profile surfaces never receive ts-application-ui-scope.
         */
        body.ts-application-ui-scope [class~="bg-white/5"],
        body.ts-application-ui-scope [class~="bg-white/[0.035]"] {
          background-color: color-mix(in oklab, var(--surface-card) 88%, transparent) !important;
        }

        body.ts-application-ui-scope [class~="bg-white/10"],
        body.ts-application-ui-scope [class~="bg-white/18"] {
          background-color: color-mix(in oklab, var(--surface-intermediate) 90%, transparent) !important;
        }

        body.ts-application-ui-scope [class~="bg-zinc-950/95"] {
          background-color: var(--surface-card) !important;
        }

        body.ts-application-ui-scope [class~="border-white/10"] {
          border-color: var(--border-subtle) !important;
        }

        body.ts-application-ui-scope [class~="bg-black/18"],
        body.ts-application-ui-scope [class~="bg-black/20"],
        body.ts-application-ui-scope [class~="bg-black/25"] {
          background-color: color-mix(in oklab, var(--surface-frame) 72%, transparent) !important;
        }

        body.ts-application-ui-scope [class~="bg-black/70"] {
          background-color: color-mix(in oklab, var(--surface-frame) 88%, transparent) !important;
        }

        @media (max-width: 767px) {
          body.ts-desktop-app-rail-active .app-shell .ts-shell-main {
            left: 0 !important;
          }
        }
      `}</style>

      <AppShellCore footer={footer}>{children}</AppShellCore>

      {showDesktopAppRail ? (
        <nav
          data-testid="desktop-app-rail"
          className="ts-desktop-app-rail fixed bottom-0 left-0 z-30 flex flex-col border-r px-2 py-3"
          style={{
            top: "var(--top-nav-h)",
            borderColor: "var(--border-primary)",
            background:
              "color-mix(in oklab, var(--surface-frame) 96%, var(--surface-intermediate))",
          }}
          aria-label="TradeScout primary navigation"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {desktopPrimaryNav.map((item) => {
              const active = isNavItemActive(pathOnly, item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={item.description}
                  aria-current={active ? "page" : undefined}
                  className="group flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center transition"
                  style={{
                    color: active ? "var(--theme-accent-primary)" : "var(--text-secondary)",
                    backgroundColor: active
                      ? "color-mix(in oklab, var(--theme-accent-primary) 12%, var(--surface-card))"
                      : "transparent",
                    border: active
                      ? "1px solid color-mix(in oklab, var(--theme-accent-primary) 30%, transparent)"
                      : "1px solid transparent",
                  }}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center">{item.icon}</span>
                  <span className="max-w-full truncate text-[10px] font-semibold leading-none">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}

export default AppShell;
