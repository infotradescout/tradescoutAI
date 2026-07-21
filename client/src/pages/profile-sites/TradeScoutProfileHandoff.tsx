import { Compass, House, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { appendPublicProfileContinuation } from "@/lib/publicProfileContinuation";

type TradeScoutDestination = {
  href: string;
  label: string;
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
      icon: Compass,
    },
    {
      href: contextualHref("/community-feed"),
      label: "Community",
      icon: Users,
    },
    {
      href: contextualHref("/exchange"),
      label: "Exchange",
      icon: ShoppingBag,
    },
    {
      href: contextualHref("/homes"),
      label: "HomeID",
      icon: House,
    },
  ];

  return (
    <footer
      aria-label={`TradeScout site footer from ${contextLabel}`}
      className={`mt-auto border-t border-white/10 bg-stone-950 px-4 py-5 text-white sm:px-6 ${className}`}
      data-testid="profile-tradescout-handoff"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
          TradeScout · Connection Without Compromise
        </p>
        <nav
          aria-label="TradeScout profile quick access"
          className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {destinations.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="inline-flex min-h-8 flex-none items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-stone-200 transition hover:bg-white/10 hover:text-sky-200"
            >
              <Icon className="h-3.5 w-3.5 flex-none" />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
