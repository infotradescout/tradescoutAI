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
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { apiRequest } from "@/lib/queryClient";
import { ROUTES } from "@/lib/routes";
import { isOnboardingSurfacePath } from "@/lib/onboardingSurface";
import MobileAppBar from "@/components/navigation/MobileAppBar";
import { AuthenticatedSocialFrame } from "./AuthenticatedSocialFrame";
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

function isFullWidthWorkspacePath(pathOnly: string): boolean {
  return (
    pathOnly === "/scout" ||
    pathOnly.startsWith("/scout/") ||
    pathOnly.startsWith("/maps") ||
    pathOnly.startsWith("/geography-heatmap") ||
    pathOnly.startsWith("/settings") ||
    pathOnly.startsWith("/profile-settings") ||
    pathOnly.startsWith("/dashboard-settings") ||
    pathOnly.startsWith("/notifications") ||
    pathOnly.startsWith("/privacy") ||
    pathOnly.startsWith("/homescout/") ||
    pathOnly.startsWith("/tradepartners/") ||
    pathOnly.startsWith("/collections/")
  );
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
      href: "/direct-connect",
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
 * Keeps the current AppShell and navigation untouched while restoring the
 * familiar signed-in TradeScout page composition around its working surface.
 * Public/custom profiles stay completely outside this authenticated frame.
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

  const showAuthenticatedSocialFrame =
    Boolean(isAuthenticated) &&
    !isMobile &&
    !isAuthOrSetupSurface &&
    !isAdminSurface &&
    !isPublicProfileSurface &&
    !isFullWidthWorkspacePath(pathOnly);

  const showDesktopBottomNav =
    Boolean(isAuthenticated) &&
    !isMobile &&
    !isAuthOrSetupSurface &&
    !isAdminSurface &&
    !isPublicProfileSurface;

  const incomingRequestsQuery = useQuery<{ requests: unknown[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    enabled: Boolean(isAuthenticated) && !isAuthOrSetupSurface && !isPublicProfileSurface,
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
  });
  const contactRequestCount = incomingRequestsQuery.data?.requests?.length || 0;

  const desktopBottomNavItems = useMemo(() => buildDesktopBottomNav(), []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle("ts-desktop-bottom-nav-active", showDesktopBottomNav);
    return () => {
      document.body.classList.remove("ts-desktop-bottom-nav-active");
    };
  }, [showDesktopBottomNav]);

  const framedChildren = showAuthenticatedSocialFrame ? (
    <AuthenticatedSocialFrame contactRequestCount={contactRequestCount}>
      {children}
    </AuthenticatedSocialFrame>
  ) : (
    children
  );

  return (
    <>
      <style>{`
        body.ts-desktop-bottom-nav-active .app-shell .ts-shell-main {
          bottom: ${DESKTOP_BOTTOM_NAV_HEIGHT} !important;
        }

        body.ts-desktop-bottom-nav-active .ts-desktop-bottom-nav-host .ts-bottom-nav-inner {
          max-width: min(1440px, calc(100% - 24px));
          margin-inline: auto;
          margin-bottom: 4px;
        }

        @media (min-width: 1024px) {
          [data-testid="authenticated-social-frame"] {
            grid-template-columns: 220px minmax(0, 1fr) !important;
          }

          [data-testid="authenticated-social-frame"] > aside[aria-label="Account shortcuts"] {
            display: block !important;
          }
        }

        @media (min-width: 1280px) {
          [data-testid="authenticated-social-frame"] {
            grid-template-columns: 232px minmax(0, 1fr) 288px !important;
          }

          [data-testid="authenticated-social-frame"] > aside[aria-label="Activity and quick actions"] {
            display: block !important;
          }
        }

        @media (min-width: 1536px) {
          [data-testid="authenticated-social-frame"] {
            grid-template-columns: 244px minmax(0, 1fr) 304px !important;
          }
        }

        @media (max-width: 767px) {
          body.ts-desktop-bottom-nav-active .app-shell .ts-shell-main {
            bottom: var(--bottom-nav-h) !important;
          }
        }
      `}</style>

      <AppShellCore footer={showDesktopBottomNav ? undefined : footer}>
        {framedChildren}
      </AppShellCore>

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
