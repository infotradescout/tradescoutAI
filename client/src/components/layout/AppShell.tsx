import { useEffect, useMemo, type ReactNode } from "react";
import { Building, ClipboardList, Compass, Share2, ShoppingBag, Users, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ROUTES } from "@/lib/routes";
import { isOnboardingSurfacePath } from "@/lib/onboardingSurface";
import MobileAppBar from "@/components/navigation/MobileAppBar";
import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState";
import AppShellCore from "./AppShellCore";
import type { NavItem } from "./AppShellCore";

export type { NavItem } from "./AppShellCore";

type AppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

const DESKTOP_BOTTOM_NAV_HEIGHT = "58px";

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

function buildDesktopBottomNav(): NavItem[] {
  const iconStyle = { color: "var(--theme-accent-primary)" } as const;

  return [
    {
      label: "Scout",
      href: "/scout",
      icon: <Compass className="h-5 w-5" style={iconStyle} />,
      description: "Open Scout to review what to do next.",
    },
    {
      label: "Direct Connect",
      href: DIRECT_CONNECT_TASKBAR_RESUME_HREF,
      icon: <ClipboardList className="h-5 w-5" style={iconStyle} />,
      description: "Post requests and track replies.",
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
      description: "Find work, post jobs or resumes, and manage applicants.",
    },
    {
      label: "Community",
      href: ROUTES.COMMUNITY ?? "/community",
      icon: <Users className="h-5 w-5" style={iconStyle} />,
      description: "See nearby posts and updates.",
    },
    {
      label: "Share",
      href: "/share",
      icon: <Share2 className="h-5 w-5" style={iconStyle} />,
      description: "Copy and publish your best links.",
    },
    {
      label: "Exchange",
      href: ROUTES.EXCHANGE ?? "/exchange",
      icon: <ShoppingBag className="h-5 w-5" style={iconStyle} />,
      description: "Browse and post Exchange listings.",
    },
  ];
}

/**
 * Owns the stable TradeScout OS chrome. Signed-in apps keep their own full-width
 * workspaces while primary navigation stays in the bottom taskbar.
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

  const showDesktopBottomNav =
    Boolean(isAuthenticated) &&
    !isMobile &&
    !isAuthOrSetupSurface &&
    !isAdminSurface &&
    !isPublicProfileSurface;

  const desktopBottomNavItems = useMemo(() => buildDesktopBottomNav(), []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle("ts-desktop-bottom-nav-active", showDesktopBottomNav);
    return () => {
      document.body.classList.remove("ts-desktop-bottom-nav-active");
    };
  }, [showDesktopBottomNav]);

  return (
    <>
      <style>{`
        body.ts-desktop-bottom-nav-active .app-shell .ts-shell-main {
          bottom: ${DESKTOP_BOTTOM_NAV_HEIGHT} !important;
        }

        body.ts-desktop-bottom-nav-active [data-testid="profile-completion-banner"] {
          bottom: calc(${DESKTOP_BOTTOM_NAV_HEIGHT} + 1rem) !important;
        }

        body.ts-desktop-bottom-nav-active .scout-search-dock-fixed {
          bottom: calc(${DESKTOP_BOTTOM_NAV_HEIGHT} + 0.5rem) !important;
        }

        body.ts-desktop-bottom-nav-active .ts-desktop-bottom-nav-host .ts-bottom-nav-inner {
          max-width: min(1440px, calc(100% - 24px));
          margin-inline: auto;
          margin-bottom: 4px;
        }

        @media (max-width: 767px) {
          body.ts-desktop-bottom-nav-active .app-shell .ts-shell-main {
            bottom: var(--bottom-nav-h) !important;
          }
        }
      `}</style>

      <AppShellCore footer={showDesktopBottomNav ? undefined : footer}>{children}</AppShellCore>

      {showDesktopBottomNav ? (
        <div
          data-testid="desktop-bottom-nav"
          className="ts-desktop-bottom-nav-host"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
        >
          <MobileAppBar items={desktopBottomNavItems} primaryLimit={5} />
        </div>
      ) : null}
    </>
  );
}

export default AppShell;
