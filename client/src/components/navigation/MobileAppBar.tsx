import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "@/components/layout/AppShell";

type MobileAppBarProps = {
  items: NavItem[];
  primaryLimit?: number;
};

const MobileAppBar: React.FC<MobileAppBarProps> = ({ items, primaryLimit = 4 }) => {
  const [location] = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const pathOnly = location.split("?")[0].split("#")[0];

  const isItemActive = (item: NavItem) =>
    pathOnly === item.href || pathOnly.startsWith(item.href + "/");

  const { primaryItems, overflowItems } = useMemo(() => {
    const limit = Math.max(1, primaryLimit);
    if (items.length <= limit) {
      return { primaryItems: items, overflowItems: [] as NavItem[] };
    }

    const initialPrimary = items.slice(0, limit);
    const initialOverflow = items.slice(limit);

    if (initialPrimary.some((item) => isItemActive(item))) {
      return { primaryItems: initialPrimary, overflowItems: initialOverflow };
    }

    const activeOverflowIndex = initialOverflow.findIndex((item) => isItemActive(item));
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
  }, [items, pathOnly, primaryLimit]);

  const hasActiveOverflow = overflowItems.some((item) => isItemActive(item));

  useEffect(() => {
    // Keep the first item visible when admin entry is prepended.
    if (items[0]?.href === "/admin" && navRef.current) {
      navRef.current.scrollLeft = 0;
    }
  }, [items, location]);

  if (!items.length) return null;

  const navItemBaseClass =
    "group flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[0.68rem] leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-primary)]";

  const navItemSurfaceStyle = {
    minHeight: "44px",
    border: "1px solid color-mix(in oklab, var(--border-primary) 78%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 82%, transparent)",
    color: "var(--theme-text-secondary)",
    boxShadow: "inset 0 1px 0 color-mix(in oklab, white 4%, transparent)",
  } as const;

  const navItemActiveStyle = {
    border: "1px solid color-mix(in oklab, var(--theme-accent-primary) 40%, transparent)",
    backgroundColor:
      "color-mix(in oklab, var(--theme-accent-primary) 14%, var(--surface-intermediate))",
    color: "var(--theme-accent-primary)",
    boxShadow: "0 6px 16px color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
  } as const;

  return (
    <nav
      ref={navRef}
      className="relative w-full border-t pt-1.5 pb-[env(safe-area-inset-bottom)]"
      style={{
        backgroundColor: "var(--surface-frame)",
        borderColor: "var(--surface-frame-border)",
      }}
    >
      <div className="h-[62px] w-full px-2">
        <div className="flex h-full items-stretch justify-between gap-1">
          {primaryItems.map((item) => {
            const active = isItemActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={navItemBaseClass}
                style={{
                  ...navItemSurfaceStyle,
                  ...(active ? navItemActiveStyle : {}),
                }}
              >
                {item.icon && (
                  <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center transition-transform duration-200 group-hover:scale-105">
                    {item.icon}
                  </span>
                )}
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge && (
                  <span
                    className="mt-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem]"
                    style={{
                      backgroundColor:
                        "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
                      border:
                        "1px solid color-mix(in oklab, var(--theme-accent-primary) 40%, transparent)",
                      color: "var(--theme-text-primary)",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {overflowItems.length > 0 && (
            <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={navItemBaseClass}
                  style={{
                    ...navItemSurfaceStyle,
                    ...(hasActiveOverflow ? navItemActiveStyle : {}),
                  }}
                  aria-label="Open more navigation options"
                >
                  <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center transition-transform duration-200 group-hover:scale-105">
                    <Menu className="h-5 w-5" />
                  </span>
                  <span className="whitespace-nowrap">More</span>
                </button>
              </SheetTrigger>

              <SheetContent
                side="bottom"
                className="rounded-t-3xl border-t px-4 pb-4 pt-3"
                style={{
                  borderColor: "color-mix(in oklab, var(--border-primary) 80%, transparent)",
                  backgroundColor: "var(--surface-card)",
                  boxShadow: "0 -16px 40px color-mix(in oklab, black 30%, transparent)",
                }}
              >
                <SheetHeader>
                  <SheetTitle className="text-sm" style={{ color: "var(--text-primary)" }}>
                    More destinations
                  </SheetTitle>
                </SheetHeader>

                <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Every destination stays available. Pick where you want to go.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 pb-2">
                  {overflowItems.map((item) => {
                    const active = isItemActive(item);
                    return (
                      <Link key={`overflow-${item.href}`} href={item.href}>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full justify-start gap-2 rounded-xl border"
                          style={{
                            borderColor: active
                              ? "color-mix(in oklab, var(--theme-accent-primary) 42%, transparent)"
                              : "color-mix(in oklab, var(--border-primary) 85%, transparent)",
                            backgroundColor: active
                              ? "color-mix(in oklab, var(--theme-accent-primary) 14%, var(--surface-intermediate))"
                              : "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
                            color: active ? "var(--theme-accent-primary)" : "var(--text-primary)",
                          }}
                          onClick={() => setIsMoreOpen(false)}
                        >
                          {item.icon && (
                            <span className="inline-flex h-4 w-4 items-center">{item.icon}</span>
                          )}
                          <span className="truncate">{item.label}</span>
                        </Button>
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
