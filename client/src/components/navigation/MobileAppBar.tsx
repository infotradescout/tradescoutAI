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
    <nav className="h-14 border-t border-slate-800 bg-slate-950/95 backdrop-blur lg:hidden">
      <div className="w-full h-full overflow-x-auto">
        <div className="flex min-w-max h-full px-2 gap-2">
          {items.map((item) => {
            const active =
              location === item.href || location.startsWith(item.href + "/");

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`flex flex-col items-center justify-center px-3 ${
                    active ? "text-orange-400" : "text-slate-400"
                  } text-[0.7rem]`}
                >
                  {item.icon && (
                    <span className="mb-0.5 inline-flex h-4 w-4 items-center justify-center">
                      {item.icon}
                    </span>
                  )}
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge && (
                    <span className="mt-0.5 text-[0.6rem] rounded-full px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/40">
                      {item.badge}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MobileAppBar;
