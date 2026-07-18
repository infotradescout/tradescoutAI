import { ArrowUpRight, Compass, House, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { Link } from "wouter";

type TradeScoutDestination = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const destinations: TradeScoutDestination[] = [
  {
    href: "/scout",
    label: "Scout",
    description: "Get a clear next step",
    icon: Compass,
  },
  {
    href: "/community-feed",
    label: "Community",
    description: "See what is happening nearby",
    icon: Users,
  },
  {
    href: "/exchange",
    label: "Exchange",
    description: "Buy, sell, and discover",
    icon: ShoppingBag,
  },
  {
    href: "/homes",
    label: "HomeID",
    description: "Keep your home history together",
    icon: House,
  },
];

type Props = {
  className?: string;
};

export default function TradeScoutProfileHandoff({ className = "" }: Props) {
  return (
    <section
      aria-label="Explore TradeScout tools"
      className={`bg-[#071016] px-4 py-8 text-white sm:px-6 sm:py-14 ${className}`}
      data-testid="profile-tradescout-handoff"
    >
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,111,15,0.18),transparent_42%),linear-gradient(145deg,#111b22,#090f13)] shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-6 border-b border-white/10 p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ts-orange">
              More TradeScout
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-4xl">
              Need something else? Keep going.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              Ask Scout, check what is happening nearby, browse the Exchange, or keep your home
              history in one place.
            </p>
          </div>
          <Link
            href="/home"
            className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-black text-white transition hover:border-ts-orange/60 hover:bg-ts-orange/15"
          >
            Open TradeScout
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-24 items-center gap-3 border-b border-white/10 p-4 transition hover:bg-white/[0.06] sm:min-h-28 sm:gap-4 sm:border-r sm:p-5 lg:border-b-0"
            >
              <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-ts-orange/15 text-ts-orange transition group-hover:bg-ts-orange group-hover:text-white sm:h-11 sm:w-11">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-black text-white">
                  {label}
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-ts-orange" />
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
