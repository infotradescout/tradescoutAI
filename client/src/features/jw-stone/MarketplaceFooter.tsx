import { JW_STONE_LOGO_URL, jw } from "./brand";

type MarketplaceFooterProps = {
  /** Reserved for parent wiring; primary Connect lives on the sticky request bar. */
  onStartRequest?: () => void;
  /** Only link to #new-arrivals when that section is mounted. */
  showNewArrivals?: boolean;
};

/**
 * Light compact footer sheet — logo, short nav, legal.
 * Connect CTA is the sticky request bar (not duplicated here).
 */
export function MarketplaceFooter({ showNewArrivals = false }: MarketplaceFooterProps) {
  const nav: { href: string; label: string }[] = [
    { href: "#first-cut-title", label: "First Cut" },
    ...(showNewArrivals ? [{ href: "#new-arrivals", label: "New Arrivals" }] : []),
    { href: "#current-inventory", label: "Inventory" },
    { href: "#jw-trending", label: "Trending" },
  ];

  return (
    <footer
      data-testid="jw-marketplace-footer"
      className={`border-t ${jw.border} bg-[var(--jw-bg)]`}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-4 px-4 pb-3 pt-6 sm:px-6 sm:pb-4 sm:pt-7 lg:px-8">
        <a href="/jw-stone" aria-label="JW Stone marketplace home" className="shrink-0">
          <img
            src={JW_STONE_LOGO_URL}
            alt="JW Stone"
            className="h-auto w-[140px] object-contain sm:w-[160px]"
            data-testid="jw-marketplace-footer-logo"
          />
        </a>

        <nav aria-label="JW Stone sections" className="w-full max-w-md">
          <ul className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-1">
            {nav.map((item) => (
              <li key={item.href} className="sm:contents">
                <a
                  href={item.href}
                  className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-[var(--jw-ink)] transition-colors hover:text-[var(--jw-accent)] sm:min-h-10"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={`flex flex-col items-center gap-1 text-xs ${jw.muted} sm:flex-row sm:gap-3 sm:text-sm`}
        >
          <p>© {new Date().getFullYear()} JW Stone</p>
          <span className="hidden text-[var(--jw-border-strong)] sm:inline" aria-hidden="true">
            ·
          </span>
          <a
            href="/"
            className="inline-flex min-h-11 items-center font-semibold text-[var(--jw-muted)] underline decoration-[var(--jw-border-strong)] underline-offset-4 transition-colors hover:text-[var(--jw-ink)] sm:min-h-0"
            data-testid="jw-marketplace-tradescout-link"
          >
            Powered by TradeScout
          </a>
        </div>
      </div>
    </footer>
  );
}
