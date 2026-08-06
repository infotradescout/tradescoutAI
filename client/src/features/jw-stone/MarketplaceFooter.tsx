import { JW_STONE_LOGO_URL, jw } from "./brand";

/**
 * Light compact footer sheet — logo + legal.
 * Connect CTA is the sticky request bar (not duplicated here).
 */
export function MarketplaceFooter() {
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
