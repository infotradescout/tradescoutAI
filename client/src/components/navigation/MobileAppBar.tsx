import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
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
      className="relative w-full pb-[env(safe-area-inset-bottom)]"
      style={{
        backgroundColor: "var(--surface-frame)",
        borderTop: "1px solid color-mix(in oklab, var(--surface-frame-border) 80%, transparent)",
      }}
    >
      <div className="h-[58px] w-full px-1">
        <div className="flex h-full items-stretch justify-between">
          {primaryItems.map((item) => {
            const active = isItemActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[0.65rem] font-medium leading-none transition-colors"
                style={{
                  color: active ? "var(--theme-accent-primary)" : "var(--theme-text-secondary)",
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: "var(--theme-accent-primary)" }}
                  />
                )}

                {/* Icon */}
                {item.icon && (
                  <span
                    className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md transition-colors"
                    style={{
                      backgroundColor: active
                        ? "color-mix(in oklab, var(--theme-accent-primary) 14%, transparent)"
                        : "transparent",
                    }}
                  >
                    {item.icon}
                  </span>
                )}

                {/* Label */}
                <span className="max-w-full truncate">{item.label}</span>

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
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[0.65rem] font-medium leading-none transition-colors"
                  style={{ color: "var(--theme-text-secondary)" }}
                  aria-label="Open more navigation options"
                >
                  <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md">
                    <Menu className="h-4.5 w-4.5" />
                  </span>
                  <span>More</span>
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
                    More destinations
                  </SheetTitle>
                </SheetHeader>

                <div className="grid grid-cols-2 gap-2 pb-4">
                  {overflowItems.map((item) => {
                    const active = isItemActive(item);
                    return (
                      <Link
                        key={`overflow-${item.href}`}
                        href={item.href}
                        onClick={() => setIsMoreOpen(false)}
                        className="flex h-12 w-full items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors"
                        style={{
                          borderColor: active
                            ? "color-mix(in oklab, var(--theme-accent-primary) 60%, transparent)"
                            : "color-mix(in oklab, var(--border-primary) 80%, transparent)",
                          backgroundColor: active
                            ? "color-mix(in oklab, var(--theme-accent-primary) 10%, var(--surface-card))"
                            : "color-mix(in oklab, var(--surface-card) 80%, transparent)",
                          color: active ? "var(--theme-accent-primary)" : "var(--text-primary)",
                        }}
                      >
                        {item.icon && (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center">
                            {item.icon}
                          </span>
                        )}
                        <span className="truncate">{item.label}</span>
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
