import React from "react";
import { Link, useLocation } from "wouter";
import type { NavItem } from "@/components/layout/AppShell";

type MobileAppBarProps = {
  items: NavItem[];
};

const MobileAppBar: React.FC<MobileAppBarProps> = ({ items }) => {
  const [location] = useLocation();

  if (!items.length) return null;

  return (
    <nav
      className="relative w-full pt-1 pb-[env(safe-area-inset-bottom)] overflow-x-auto border-t"
      style={{
        backgroundColor: "var(--surface-frame)",
        borderColor: "var(--surface-frame-border)",
      }}
    >
      <div className="w-full h-[62px] px-1">
        <div className="flex h-full flex-nowrap items-stretch gap-1.5 justify-start">
          {items.map((item) => {
            const pathOnly = location.split("?")[0].split("#")[0];
            const active = pathOnly === item.href || pathOnly.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center px-2 py-1 md:flex-1 text-[0.7rem] leading-tight`}
                style={{
                  color: active ? "var(--theme-accent-primary)" : "var(--theme-text-secondary)",
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
                    className="mt-0.5 text-[0.6rem] rounded-full px-1.5 py-0.5"
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
        </div>
      </div>
    </nav>
  );
};

export default MobileAppBar;
