import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "@/components/layout/AppShell";

type MobileAppBarProps = {
  items: NavItem[];
};

const MobileAppBar: React.FC<MobileAppBarProps> = ({ items }) => {
  const [location] = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const pathOnly = location.split("?")[0].split("#")[0];

  const isItemActive = (item: NavItem) =>
    pathOnly === item.href || pathOnly.startsWith(item.href + "/");

  const { primaryItems, overflowItems } = useMemo(() => {
    const primaryLimit = 4;
    if (items.length <= primaryLimit) {
      return { primaryItems: items, overflowItems: [] as NavItem[] };
    }

    const initialPrimary = items.slice(0, primaryLimit);
    const initialOverflow = items.slice(primaryLimit);

    if (initialPrimary.some((item) => isItemActive(item))) {
      return { primaryItems: initialPrimary, overflowItems: initialOverflow };
    }

    const activeOverflowIndex = initialOverflow.findIndex((item) => isItemActive(item));
    if (activeOverflowIndex < 0) {
      return { primaryItems: initialPrimary, overflowItems: initialOverflow };
    }

    const activeOverflowItem = initialOverflow[activeOverflowIndex];
    const swappedPrimary = [...initialPrimary.slice(0, primaryLimit - 1), activeOverflowItem];
    const swappedOverflow = [...initialOverflow];
    const displaced = initialPrimary[primaryLimit - 1];
    swappedOverflow.splice(activeOverflowIndex, 1);
    swappedOverflow.unshift(displaced);

    return { primaryItems: swappedPrimary, overflowItems: swappedOverflow };
  }, [items, pathOnly]);

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
      className="relative w-full border-t pt-1 pb-[env(safe-area-inset-bottom)]"
      style={{
        backgroundColor: "var(--surface-frame)",
        borderColor: "var(--surface-frame-border)",
      }}
    >
      <div className="h-[62px] w-full px-1.5">
        <div className="flex h-full items-stretch justify-between gap-1">
          {primaryItems.map((item) => {
            const active = isItemActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[0.68rem] leading-tight"
                style={{
                  color: active ? "var(--theme-accent-primary)" : "var(--theme-text-secondary)",
                  backgroundColor: active
                    ? "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)"
                    : "transparent",
                }}
              >
                {item.icon && (
                  <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center">
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
                  className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[0.68rem] leading-tight"
                  style={{ color: "var(--theme-text-secondary)" }}
                  aria-label="Open more navigation options"
                >
                  <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center">
                    <Menu className="h-5 w-5" />
                  </span>
                  <span className="whitespace-nowrap">More</span>
                </button>
              </SheetTrigger>

              <SheetContent side="bottom" className="rounded-t-2xl border-t-0">
                <SheetHeader>
                  <SheetTitle>More destinations</SheetTitle>
                </SheetHeader>

                <div className="mt-4 grid grid-cols-2 gap-2 pb-2">
                  {overflowItems.map((item) => {
                    const active = isItemActive(item);
                    return (
                      <Link key={`overflow-${item.href}`} href={item.href}>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full justify-start gap-2"
                          style={{
                            borderColor: active
                              ? "var(--theme-accent-primary)"
                              : "var(--border-primary)",
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
