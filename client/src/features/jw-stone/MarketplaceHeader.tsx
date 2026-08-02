import { Bookmark, MessageCircle } from "lucide-react";

type MarketplaceHeaderProps = {
  wishlistCount: number;
  onOpenWishlist: () => void;
  onStartRequest: () => void;
};

export function MarketplaceHeader({
  wishlistCount,
  onOpenWishlist,
  onStartRequest,
}: MarketplaceHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-stone-950/95 text-stone-50 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <a href="/jw-stone" aria-label="JW Stone marketplace home" className="shrink-0">
          <img
            src="/images/businesses/jw-stone/logo.svg"
            alt="JW Stone"
            className="h-11 w-auto max-w-44 object-contain object-left brightness-0 invert"
          />
        </a>

        <nav aria-label="JW Stone actions" className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenWishlist}
            className="relative inline-flex min-h-11 items-center gap-2 border border-white/20 px-3 text-sm font-semibold text-stone-100 transition-colors hover:border-white/50 hover:bg-white/5 sm:px-4"
            aria-label={`Open saved stones, ${wishlistCount} saved`}
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Saved</span>
            <span
              className="inline-flex min-w-6 justify-center rounded-full bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-stone-950"
              aria-hidden="true"
            >
              {wishlistCount}
            </span>
          </button>
          <button
            type="button"
            onClick={onStartRequest}
            className="inline-flex min-h-11 items-center gap-2 bg-stone-100 px-3 text-sm font-bold text-stone-950 transition-colors hover:bg-white sm:px-5"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Start a Request</span>
            <span className="sm:hidden">Ask JW</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
