import { useEffect, useId, useRef, useState } from "react";
import { Bookmark, Menu, UserRound, X } from "lucide-react";
import { JW_STONE_LOGO_URL, jw } from "./brand";
import { marketplaceBasePath } from "./marketplaceRoutes";

type MarketplaceHeaderProps = {
  wishlistCount: number;
  onOpenWishlist: () => void;
  onOpenAccount: () => void;
  onStartRequest: () => void;
};

/**
 * Light site chrome: logo · Saved · Create account · Menu.
 * Social destinations stay together in the company section near the bottom.
 */
export function MarketplaceHeader({
  wishlistCount,
  onOpenWishlist,
  onOpenAccount,
  onStartRequest,
}: MarketplaceHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen]);

  const closeAnd = (action?: () => void) => {
    setMenuOpen(false);
    action?.();
  };

  return (
    <header
      data-testid="jw-marketplace-header"
      className={`sticky top-0 z-40 border-b ${jw.border} ${jw.surface}`}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-4 sm:h-[4.25rem] sm:gap-4 sm:px-9 lg:px-12">
        <a
          href={marketplaceBasePath() || "/"}
          aria-label="JW Stone marketplace home"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center"
        >
          <img
            src={JW_STONE_LOGO_URL}
            alt="JW Stone"
            className="h-auto w-[112px] object-contain object-left sm:w-[180px] md:w-[200px]"
            data-testid="jw-marketplace-logo"
          />
        </a>

        <nav aria-label="JW Stone actions" className="flex items-center gap-0.5 sm:gap-1.5">
          <button
            type="button"
            onClick={onOpenWishlist}
            className={`relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-sm sm:px-3 ${jw.ghostOnLight}`}
            aria-label={`Open saved stones, ${wishlistCount} saved`}
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Saved</span>
            {wishlistCount > 0 ? (
              <span
                className="inline-flex min-w-5 justify-center rounded-full bg-[var(--jw-accent)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--jw-on-accent)]"
                aria-hidden="true"
              >
                {wishlistCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            data-testid="jw-marketplace-account-button"
            onClick={onOpenAccount}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--jw-accent)] px-2.5 text-xs font-black text-[var(--jw-on-accent)] transition hover:opacity-90 sm:px-3 sm:text-sm"
            aria-label="Create an account with JW Stone"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            <span>Create account</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              data-testid="jw-marketplace-menu-button"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close page menu" : "Open page menu"}
              onClick={() => setMenuOpen((open) => !open)}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-sm sm:px-3 ${jw.ghostOnLight}`}
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Menu</span>
            </button>

            {menuOpen ? (
              <div
                id={menuId}
                data-testid="jw-marketplace-menu-panel"
                className={`absolute right-0 top-[calc(100%+0.35rem)] z-50 min-w-[13rem] border p-1.5 ${jw.border} ${jw.surface}`}
              >
                <nav aria-label="JW Stone menu" className="flex flex-col gap-0.5 text-sm">
                  <button
                    type="button"
                    onClick={() => closeAnd(onOpenAccount)}
                    className="px-3 py-2.5 text-left font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]"
                  >
                    Create account
                  </button>
                  <a
                    href="#about-jw-stone"
                    onClick={() => closeAnd()}
                    className="px-3 py-2.5 text-left font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]"
                  >
                    About
                  </a>
                  <a
                    href="#jw-stone-location"
                    onClick={() => closeAnd()}
                    className="px-3 py-2.5 text-left font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]"
                  >
                    Visit
                  </a>
                  <a
                    href="#jw-stone-socials"
                    onClick={() => closeAnd()}
                    className="px-3 py-2.5 text-left font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]"
                  >
                    Socials
                  </a>
                  <button
                    type="button"
                    onClick={() => closeAnd(onStartRequest)}
                    className="px-3 py-2.5 text-left font-semibold text-[var(--jw-accent)] hover:bg-[var(--jw-bg)]"
                  >
                    Start a Request
                  </button>
                </nav>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
