import { ArrowUpRight, Compass, House, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { appendPublicProfileContinuation } from "@/lib/publicProfileContinuation";

type TradeScoutDestination = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type Props = {
  profileSlug: string;
  profileName: string;
  itemName?: string;
  platformBaseHref?: string;
  className?: string;
};

export default function TradeScoutProfileHandoff({
  profileSlug,
  profileName,
  itemName,
  platformBaseHref = "",
  className = "",
}: Props) {
  const context = { profileSlug, profileName, ...(itemName ? { itemName } : {}) };
  const contextLabel = itemName || profileName;
  const addPlatformBase = (href: string) =>
    platformBaseHref && href.startsWith("/")
      ? `${platformBaseHref.replace(/\/$/, "")}${href}`
      : href;
  const contextualHref = (href: string) =>
    addPlatformBase(appendPublicProfileContinuation(href, context));

  const scoutPrompt = itemName
    ? `I am looking at ${itemName} on ${profileName}'s TradeScout profile. Help me decide what to ask and what the best next step is.`
    : `I am looking at ${profileName}'s TradeScout profile. Help me decide what to ask and what the best next step is.`;
  const scoutParams = new URLSearchParams({
    source: "business_profile_call",
    businessSlug: profileSlug,
    prompt: scoutPrompt,
  });
  const destinations: TradeScoutDestination[] = [
    {
      href: contextualHref(`/scout?${scoutParams.toString()}`),
      label: "Scout",
      description: `Plan the next step for ${contextLabel}`,
      icon: Compass,
    },
    {
      href: contextualHref("/community-feed"),
      label: "Community",
      description: "Ask local people and compare experience",
      icon: Users,
    },
    {
      href: contextualHref("/exchange"),
      label: "Exchange",
      description: "Find the other things the project needs",
      icon: ShoppingBag,
    },
    {
      href: contextualHref("/homes"),
      label: "HomeID",
      description: "Keep property and job history together",
      icon: House,
    },
  ];

  return (
    <section
      aria-label={`TradeScout quick access from ${contextLabel}`}
      className={`bg-stone-950 px-4 py-6 text-white sm:px-6 sm:py-8 ${className}`}
      data-testid="profile-tradescout-handoff"
    >
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-stone-900 shadow-2xl shadow-black/25 sm:rounded-3xl">
        <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
                TradeScout · Connection Without Compromise
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-stone-300">
                Continuing from {contextLabel}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-white sm:text-2xl">
              Keep the next step with you.
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-stone-400 sm:text-sm">
              Decide with Scout, see what is local, find what the job needs, and keep the property
              history together—without selling your information.
            </p>
          </div>
          <div className="flex items-center">
            <a
              href={destinations[0].href}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-stone-950 transition hover:bg-sky-100"
            >
              Open TradeScout
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <nav
          aria-label="TradeScout profile quick access"
          className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4"
        >
          {destinations.map(({ href, label, description, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="group flex min-h-20 w-[210px] flex-none snap-start items-center gap-3 border-r border-white/10 px-4 py-3 transition hover:bg-white/[0.06] lg:w-auto"
            >
              <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/10 text-sky-200 transition group-hover:bg-sky-300 group-hover:text-stone-950">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-black text-white">
                  {label}
                  <ArrowUpRight className="h-3 w-3 text-stone-600 transition group-hover:text-sky-300" />
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-stone-400">
                  {description}
                </span>
              </span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
