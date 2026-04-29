import React from "react";
import { ArrowRight, Compass, HelpCircle, MapPinned, MessageSquareText } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const ComingSoon: React.FC = () => {
  const routes = [
    { href: "/scout", label: "Open Scout", icon: MessageSquareText },
    { href: "/help", label: "Visit help center", icon: HelpCircle },
    { href: "/trade", label: "Browse trades", icon: Compass },
    { href: "/county-directory", label: "Browse counties", icon: MapPinned },
  ];

  return (
    <>
      <SEOHelmet
        title="Route Not Ready | TradeScout"
        description="This TradeScout route is not ready yet. Continue through Scout, Help, trades, or county directory paths."
        canonical="https://www.thetradescout.com/coming-soon"
        noIndex
      />
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-tsCard/70 p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)] backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ts-orange">
            Route not ready
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            This path is not active yet
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65">
            TradeScout is still available from stable routes. Start with Scout for guided routing,
            or browse the public help, trade, and county pages for local context.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {routes.map((route) => {
              const Icon = route.icon;
              return (
                <a
                  key={route.href}
                  href={route.href}
                  className="group flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:border-ts-orange/40 hover:bg-white/[0.07]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ts-orange/15 text-ts-orange">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{route.label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-ts-orange" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default ComingSoon;
