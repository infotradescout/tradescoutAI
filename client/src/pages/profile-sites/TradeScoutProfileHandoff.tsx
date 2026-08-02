import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";

type Props = {
  profileSlug: string;
  profileName: string;
  itemName?: string;
  platformBaseHref?: string;
  className?: string;
};

export default function TradeScoutProfileHandoff({ platformBaseHref = "", className = "" }: Props) {
  return (
    <footer
      aria-label="TradeScout site footer"
      className={`mt-auto border-t border-white/10 bg-stone-950 px-4 py-5 text-white sm:px-6 ${className}`}
      data-testid="profile-tradescout-handoff"
    >
      <div className="mx-auto flex w-full max-w-6xl justify-center">
        <a
          href={qualifyPublicProfileItemDestination("/", platformBaseHref)}
          className="inline-flex min-h-11 items-center justify-center rounded-md px-2 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          data-testid="profile-tradescout-powered-link"
        >
          Powered by TradeScout
        </a>
      </div>
    </footer>
  );
}
