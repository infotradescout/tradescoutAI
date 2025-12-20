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
  <nav className="border-t border-slate-800 bg-slate-950/95 backdrop-blur py-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
    <div className="w-full min-h-[72px] overflow-x-auto md:overflow-x-hidden">
    <div className="flex h-full items-stretch px-2 gap-2 min-w-max md:min-w-0 md:w-full md:justify-between">
          {items.map((item) => {
            const active =
              location === item.href || location.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center px-3 py-2 md:flex-1 ${
                active ? "text-orange-400" : "text-slate-400"
                } text-[0.75rem]`}
              >
                {item.icon && (
                <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center">
                    {item.icon}
                  </span>
                )}
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge && (
                  <span className="mt-0.5 text-[0.6rem] rounded-full px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/40">
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
