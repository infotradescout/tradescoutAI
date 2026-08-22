import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "@/components/layout/AppShell";

type MobileAppBarProps = {
  items: NavItem[];
  primaryLimit?: number;
  stablePrimary?: boolean;
};

export function getMobileAppBarPathOnly(href: string): string {
  return href.split("?")[0].split("#")[0] || "/";
}

export function doesMobileAppBarItemMatch(pathOnly: string, itemHref: string): boolean {
  const currentPathOnly = getMobileAppBarPathOnly(pathOnly);
  const itemPathOnly = getMobileAppBarPathOnly(itemHref);
  if (itemPathOnly === "/direct-connect/inbox") {
    return (
      currentPathOnly === itemPathOnly ||
      currentPathOnly.startsWith(itemPathOnly + "/") ||
      currentPathOnly === "/direct-connect/engagements" ||
      currentPathOnly.startsWith("/direct-connect/engagements/")
    );
  }

  if (itemPathOnly === "/community") {
    return (
      currentPathOnly === itemPathOnly ||
      currentPathOnly.startsWith(itemPathOnly + "/") ||
      currentPathOnly === "/community-feed" ||
      currentPathOnly.startsWith("/community-feed/") ||
      currentPathOnly.startsWith("/community-post/")
    );
  }

  return currentPathOnly === itemPathOnly || currentPathOnly.startsWith(itemPathOnly + "/");
}

export function getMobileAppBarActiveHref(
  currentHref: string,
  items: NavItem[]
): string | undefined {
  const pathOnly = getMobileAppBarPathOnly(currentHref);

  return items
    .filter((item) => doesMobileAppBarItemMatch(pathOnly, item.href))
    .sort(
      (a, b) => getMobileAppBarPathOnly(b.href).length - getMobileAppBarPathOnly(a.href).length
    )[0]?.href;
}

export function partitionMobileAppBarItems(
  items: NavItem[],
  primaryLimit: number,
  activeHref?: string,
  stablePrimary = false
): { primaryItems: NavItem[]; overflowItems: NavItem[] } {
  const limit = Math.max(1, primaryLimit);
  if (items.length <= limit) {
    return { primaryItems: items, overflowItems: [] };
  }

  const initialPrimary = items.slice(0, limit);
  const initialOverflow = items.slice(limit);

  if (
    stablePrimary ||
    initialPrimary.some((item) => item.href === activeHref) ||
    activeHref == null
  ) {
    return { primaryItems: initialPrimary, overflowItems: initialOverflow };
  }

  const activeOverflowIndex = initialOverflow.findIndex((item) => item.href === activeHref);
  if (activeOverflowIndex < 0) {
    return { primaryItems: initialPrimary, overflowItems: initialOverflow };
  }

  const activeOverflowItem = initialOverflow[activeOverflowIndex];
  const swappedPrimary = [...initialPrimary.slice(0, limit - 1), activeOverflowItem];
  const swappedOverflow = [...initialOverflow];
  const displaced = initialPrimary[limit - 1];
  swappedOverflow.splice(activeOverflowIndex, 1);
  swappedOverflow.unshift(displaced);

  return { primaryItems: swappedPrimary, overflowItems: swappedOverflow };
}

const MobileAppBar: React.FC<MobileAppBarProps> = ({
  items,
  primaryLimit = 4,
  stablePrimary = false,
}) => {
  const [location] = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const activeHref = useMemo(() => getMobileAppBarActiveHref(location, items), [items, location]);
  const isItemActive = (item: NavItem) => item.href === activeHref;

  const { primaryItems, overflowItems } = useMemo(
    () => partitionMobileAppBarItems(items, primaryLimit, activeHref, stablePrimary),
    [activeHref, items, primaryLimit, stablePrimary]
  );
  const isOverflowActive = overflowItems.some((item) => isItemActive(item));

  useEffect(() => {
    // Keep the first item visible when admin entry is prepended.
    if (items[0]?.href === "/admin" && navRef.current) {
      navRef.current.scrollLeft = 0;
    }
  }, [items, location]);

  if (!items.length) return null;

  return (
    <nav
      ref={navRef}
      className="ts-bottom-nav relative w-full pb-[env(safe-area-inset-bottom)]"
      data-stable-primary={stablePrimary ? "true" : undefined}
      style={{
        backgroundColor: "var(--surface-frame)",
        borderTop: "1px solid color-mix(in oklab, var(--surface-frame-border) 65%, transparent)",
      }}
    >
      <div className="ts-bottom-nav-inner h-[52px] w-full px-1">
        <div className="flex h-full items-stretch justify-between">
          {primaryItems.map((item) => {
            const active = isItemActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className="ts-bottom-nav-item relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.62rem] font-medium leading-none transition-colors"
                style={{
                  color: active ? "var(--text-primary)" : "var(--theme-text-secondary)",
                }}
              >
                {/* Icon */}
                {item.icon && (
                  <span
                    className="ts-bottom-nav-icon inline-flex h-[20px] w-[20px] items-center justify-center rounded-md transition-colors"
                    style={{
                      backgroundColor: active
                        ? "color-mix(in oklab, var(--surface-card) 85%, transparent)"
                        : "transparent",
                    }}
                  >
                    {item.icon}
                  </span>
                )}

                {/* Label */}
                <span
                  className={
                    stablePrimary
                      ? "max-w-full whitespace-normal text-center text-[0.58rem] leading-[0.65rem]"
                      : "max-w-full truncate"
                  }
                >
                  {item.label}
                </span>

                {/* Badge */}
                {item.badge && (
                  <span
                    className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.58rem] font-bold"
                    style={{
                      backgroundColor: "var(--theme-accent-primary)",
                      color: "#000",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* More sheet trigger */}
          {overflowItems.length > 0 && (
            <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="ts-bottom-nav-item flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.62rem] font-medium leading-none transition-colors"
                  style={{
                    color: isOverflowActive ? "var(--text-primary)" : "var(--theme-text-secondary)",
                  }}
                  aria-label="Open more navigation options"
                  data-active={isOverflowActive ? "true" : undefined}
                >
                  <span
                    className="ts-bottom-nav-icon inline-flex h-[20px] w-[20px] items-center justify-center rounded-md"
                    style={{
                      backgroundColor: isOverflowActive
                        ? "color-mix(in oklab, var(--surface-card) 85%, transparent)"
                        : "transparent",
                    }}
                  >
                    <Menu className="h-4.5 w-4.5" />
                  </span>
                  <span>Menu</span>
                </button>
              </SheetTrigger>

              <SheetContent
                side="bottom"
                className="rounded-t-2xl border-t-0"
                style={{ backgroundColor: "var(--surface-frame)" }}
              >
                <SheetHeader className="pb-2">
                  <SheetTitle
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Menu
                  </SheetTitle>
                </SheetHeader>

                <div className="grid grid-cols-1 gap-2 pb-4">
                  {overflowItems.map((item) => {
                    const active = isItemActive(item);
                    return (
                      <Link
                        key={`overflow-${item.href}`}
                        href={item.href}
                        onClick={() => setIsMoreOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-3 text-sm transition-colors"
                        style={{
                          borderColor: active
                            ? "color-mix(in oklab, var(--theme-accent-primary) 45%, transparent)"
                            : "color-mix(in oklab, var(--border-primary) 80%, transparent)",
                          backgroundColor: active
                            ? "color-mix(in oklab, var(--surface-intermediate) 90%, var(--surface-card))"
                            : "color-mix(in oklab, var(--surface-card) 84%, transparent)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.icon && (
                          <span
                            className="inline-flex h-5 w-5 shrink-0 items-center"
                            style={{ opacity: 0.9 }}
                          >
                            {item.icon}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </nav>
  );
};

export default MobileAppBar;
