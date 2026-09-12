import { useEffect, useMemo, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DESKTOP_PRODUCT_NAV_IDS,
  PRODUCT_NAV_ITEMS,
  getActiveProductNavItem,
} from "@/lib/productNavigation";
import { isApplicationUiSurface, getUiPathname } from "@/lib/applicationUiScope";
import { getCurrentInternalPath } from "@/lib/postOnboardingRoute";
import { isRecommendationActionPath } from "@shared/recommendationContinuation";
import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState";
import ProductNavigator from "@/components/navigation/ProductNavigator";
import AppShellCore from "./AppShellCore";
import "./CoreApplicationTheme.css";

export type { NavItem } from "./AppShellCore";

type AppShellProps = { children: ReactNode; footer?: ReactNode };
const DESKTOP_APP_RAIL_WIDTH = "76px";

/** Core app only. Public/custom profiles retain their own presentation and palette. */
export function AppShell({ children, footer }: AppShellProps) {
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const pathOnly = getUiPathname(location);
  const customDomainProfileSlug =
    typeof window === "undefined"
      ? ""
      : String(
          (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
            .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__ || ""
        );
  const applicationUi = isApplicationUiSurface(location, customDomainProfileSlug);
  const isRecommendationSurface = isRecommendationActionPath(getCurrentInternalPath(location));
  const showDesktopAppRail =
    Boolean(isAuthenticated) && !isMobile && applicationUi && !isRecommendationSurface;
  const desktopPrimaryNav = useMemo(
    () =>
      DESKTOP_PRODUCT_NAV_IDS.flatMap((id) => {
        const item = PRODUCT_NAV_ITEMS.find((entry) => entry.id === id);
        return item ? [item] : [];
      }),
    []
  );
  const activeItem = getActiveProductNavItem(pathOnly, desktopPrimaryNav);

  useEffect(() => {
    document.body.classList.toggle("ts-desktop-app-rail-active", showDesktopAppRail);
    return () => document.body.classList.remove("ts-desktop-app-rail-active");
  }, [showDesktopAppRail]);

  return (
    <div data-ts-core-ui={applicationUi ? "true" : undefined} style={{ display: "contents" }}>
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
          data-ts-core-ui="true"
          className="ts-desktop-app-rail fixed bottom-0 left-0 z-30 flex flex-col border-r px-2 py-3"
          style={{
            top: "var(--top-nav-h)",
            borderColor: "var(--border-primary)",
            background: "var(--surface-frame)",
          }}
          aria-label="TradeScout primary navigation"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {desktopPrimaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.id === "requests" ? DIRECT_CONNECT_TASKBAR_RESUME_HREF : item.href}
                  title={item.description}
                  aria-current={activeItem?.id === item.id ? "page" : undefined}
                  className="ts-product-nav-link flex min-h-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-2 shrink-0">
            <ProductNavigator />
          </div>
        </nav>
      ) : null}
    </div>
  );
}

export default AppShell;
