import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import {
  buildProfileInventoryShareSearch,
  profileInventoryShareIndexForDisplay,
} from "@shared/profileItemShare";
import type { PremiumProductProfileData } from "@shared/premiumProductProfile";

type Product = {
  name: string;
  slug: string;
  images: string[];
  shareImageOrder?: number[];
};

type Props = {
  profileName: string;
  product: Product;
  products?: Product[];
  initialProductSlug?: string | null;
  initialPhotoIndex?: number;
  data: PremiumProductProfileData;
  trustFacts: string[];
  faqItems: Array<{ question?: string; answer?: string }>;
  profileShareDestination: string;
  onDirectConnect: (productName?: string | null) => void;
};

export default function OnyxStoneShowcase({
  profileName: _profileName,
  product,
  products = [product],
  initialProductSlug,
  initialPhotoIndex = 0,
  data,
  trustFacts: _trustFacts,
  faqItems: _faqItems,
  profileShareDestination,
  onDirectConnect,
}: Props) {
  const initialProduct =
    products.find((entry) => entry.slug === initialProductSlug) ||
    products.find((entry) => entry.slug === data.featuredProductSlug) ||
    product;
  const [activeProductSlug, setActiveProductSlug] = useState(initialProduct.slug);
  const [activePhoto, setActivePhoto] = useState<number | null>(
    initialProductSlug ? Math.min(initialPhotoIndex, initialProduct.images.length - 1) : null
  );
  const [visiblePhoto, setVisiblePhoto] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const activeProduct =
    products.find((entry) => entry.slug === activeProductSlug) || initialProduct;
  const requestedProduct = initialProductSlug
    ? products.find((entry) => entry.slug === initialProductSlug)
    : null;
  const photoIndex = activePhoto ?? 0;
  const isLightboxOpen = activePhoto !== null;
  const isFeaturedProduct = activeProduct.slug === data.featuredProductSlug;
  const photoDetail = isFeaturedProduct ? data.gallery.photos?.[photoIndex] : undefined;

  const movePhoto = useCallback(
    (direction: -1 | 1) =>
      setActivePhoto((current) =>
        current === null
          ? null
          : (current + direction + activeProduct.images.length) % activeProduct.images.length
      ),
    [activeProduct.images.length]
  );

  const scrollRailToIndex = useCallback(
    (index: number, behavior: "auto" | "smooth" = "auto") => {
      const rail = railRef.current;
      if (!rail) return;
      const clamped = Math.max(0, Math.min(activeProduct.images.length - 1, index));
      const child = rail.children[clamped] as HTMLElement | undefined;
      if (!child) return;
      setVisiblePhoto(clamped);
      if (typeof rail.scrollTo === "function") {
        rail.scrollTo({ left: child.offsetLeft, behavior });
      } else {
        rail.scrollLeft = child.offsetLeft;
      }
    },
    [activeProduct.images.length]
  );

  const closeLightbox = useCallback(() => {
    setActivePhoto(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!requestedProduct) return;
    const requestedIndex = Math.min(
      Math.max(0, initialPhotoIndex),
      Math.max(0, requestedProduct.images.length - 1)
    );
    setActiveProductSlug(requestedProduct.slug);
    setVisiblePhoto(requestedIndex);
    setActivePhoto(requestedIndex);
    window.requestAnimationFrame(() => scrollRailToIndex(requestedIndex, "auto"));
  }, [initialPhotoIndex, requestedProduct, scrollRailToIndex]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") movePhoto(-1);
      if (event.key === "ArrowRight") movePhoto(1);
      if (event.key !== "Tab") return;
      const dialog = closeRef.current?.closest<HTMLElement>('[role="dialog"]');
      const focusable = Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ) || []
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeLightbox, isLightboxOpen, movePhoto]);

  const selectProduct = (slug: string) => {
    setActiveProductSlug(slug);
    scrollRailToIndex(0, "auto");
  };

  const scrollRail = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(activeProduct.images.length - 1, visiblePhoto + direction));
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    scrollRailToIndex(next, behavior);
  };

  const onRailKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    scrollRail(event.key === "ArrowLeft" ? -1 : 1);
  };

  return (
    <div data-testid="onyx-stone-showcase" className="overflow-hidden bg-[#070605] text-[#f4efe6]">
      <section id="collection" className="scroll-mt-24 pt-8 sm:pt-12">
        <div className="mx-auto mb-6 max-w-7xl px-4 sm:mb-8 sm:px-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
            {data.offerings?.eyebrow || data.gallery.eyebrow}
          </p>
          <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <h2 className="max-w-[16ch] font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl md:text-6xl">
                {data.offerings?.title || data.gallery.title}
              </h2>
              {data.offerings?.body || data.gallery.body ? (
                <p className="mt-4 max-w-xl text-sm font-light leading-7 text-[#b7aa98] sm:text-base">
                  {data.offerings?.body || data.gallery.body}
                </p>
              ) : null}
            </div>
            {products.length > 1 ? (
              <div
                className="flex w-fit gap-1 border border-white/15 p-1"
                role="group"
                aria-label="Choose onyx collection"
              >
                {products.map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => selectProduct(entry.slug)}
                    aria-pressed={entry.slug === activeProduct.slug}
                    className={`min-h-11 px-5 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                      entry.slug === activeProduct.slug
                        ? "bg-[var(--brand-accent,#d9a441)] text-[var(--brand-primary-dark,#17100b)]"
                        : "text-white/65 hover:text-white"
                    }`}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative">
          <div
            ref={railRef}
            role="region"
            aria-label={`${activeProduct.name} horizontal showcase`}
            tabIndex={0}
            onKeyDown={onRailKeyDown}
            onScroll={(event) => {
              const first = event.currentTarget.firstElementChild as HTMLElement | null;
              setVisiblePhoto(
                Math.max(
                  0,
                  Math.min(
                    activeProduct.images.length - 1,
                    Math.round(
                      event.currentTarget.scrollLeft / Math.max(1, first?.offsetWidth || 1)
                    )
                  )
                )
              );
            }}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-accent,#d9a441)] motion-reduce:scroll-auto"
          >
            {activeProduct.images.map((image, index) => {
              const detail = isFeaturedProduct ? data.gallery.photos?.[index] : undefined;
              const caption = detail?.title || detail?.label || "";
              return (
                <article
                  key={image}
                  className="group relative h-[82svh] min-h-[540px] w-[96vw] max-w-none flex-none snap-center overflow-hidden bg-[#120f0c] sm:h-[86svh] sm:w-[88vw] lg:w-[82vw]"
                >
                  <img
                    src={image}
                    alt={`${activeProduct.name}: ${caption || `view ${index + 1}`}`}
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(min-width: 1024px) 82vw, 96vw"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out motion-reduce:transition-none group-hover:scale-[1.02]"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,3,0)_48%,rgba(5,4,3,0.78)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8">
                    <div className="max-w-lg">
                      <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-[var(--brand-accent,#d9a441)]">
                        {activeProduct.name}
                        <span className="mx-2 text-white/35">·</span>
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      {caption ? (
                        <h3 className="mt-2 font-editorial text-2xl font-medium tracking-[-0.02em] sm:text-4xl">
                          {caption}
                        </h3>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        returnFocusRef.current = event.currentTarget;
                        setActivePhoto(index);
                      }}
                      className="inline-flex min-h-11 flex-none items-center gap-2 border border-white/40 bg-black/25 px-4 text-[10px] font-semibold uppercase tracking-[0.24em] backdrop-blur-md transition hover:bg-[var(--brand-accent,#d9a441)] hover:text-[var(--brand-primary-dark,#17100b)]"
                      aria-label={`Expand ${caption || `${activeProduct.name} photo ${index + 1}`}`}
                    >
                      Expand <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-3 sm:px-6">
            <button
              type="button"
              onClick={() => scrollRail(-1)}
              disabled={!visiblePhoto}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center border border-white/20 bg-black/45 disabled:opacity-15"
              aria-label="Previous showcase image"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => scrollRail(1)}
              disabled={visiblePhoto >= activeProduct.images.length - 1}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center border border-white/20 bg-black/45 disabled:opacity-15"
              aria-label="Next showcase image"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="mx-auto mt-5 flex max-w-7xl justify-between px-4 text-[10px] uppercase tracking-[0.28em] text-[#8f8374] sm:px-8">
          <p>Lookbook</p>
          <p className="text-[var(--brand-accent,#d9a441)]" aria-live="polite" aria-atomic="true">
            {String(visiblePhoto + 1).padStart(2, "0")} /{" "}
            {String(activeProduct.images.length).padStart(2, "0")}
          </p>
        </div>
      </section>

      <section
        id="connect"
        className="relative isolate min-h-[58svh] overflow-hidden px-4 py-20 sm:px-8"
      >
        <img
          src={activeProduct.images[data.closing.imageIndex] || activeProduct.images[0]}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-black/92 via-black/70 to-black/20" />
        <div className="mx-auto flex min-h-[42svh] max-w-7xl items-center">
          <div className="max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {data.closing.eyebrow}
            </p>
            <h2 className="mt-4 font-editorial text-5xl font-medium leading-[0.95] sm:text-6xl">
              {data.closing.title}
            </h2>
            <p className="mt-5 max-w-xl text-sm font-light leading-7 text-white/75">
              {data.closing.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => onDirectConnect(activeProduct.name)}
                className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-ts-orange bg-[var(--brand-bg,#f7f3ea)]/92 px-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-ts-orange transition hover:bg-[var(--brand-bg,#f7f3ea)]"
              >
                Direct Connect
              </button>
            </div>
          </div>
        </div>
      </section>

      {activePhoto !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeProduct.name} photo gallery`}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/96 p-2 sm:p-6"
          onMouseDown={(event) => event.target === event.currentTarget && closeLightbox()}
        >
          <div
            className="flex max-h-[96svh] w-full max-w-7xl flex-col overflow-hidden border border-white/10 bg-[#070605]"
            onTouchStart={(event) =>
              (touchStartX.current = event.changedTouches[0]?.clientX ?? null)
            }
            onTouchEnd={(event) => {
              if (touchStartX.current === null) return;
              const distance = event.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(distance) > 55) movePhoto(distance > 0 ? -1 : 1);
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#efd393]">
                  {activeProduct.name} · {String(photoIndex + 1).padStart(2, "0")} /{" "}
                  {String(activeProduct.images.length).padStart(2, "0")}
                </p>
                <h3 className="mt-1 font-editorial text-2xl font-medium">
                  {photoDetail?.title || photoDetail?.label || activeProduct.name}
                </h3>
              </div>
              <div className="flex gap-2">
                <ShareButton
                  destination={`${profileShareDestination}${buildProfileInventoryShareSearch(
                    activeProduct.slug,
                    profileInventoryShareIndexForDisplay(
                      activeProduct.images,
                      activeProduct.shareImageOrder,
                      photoIndex
                    )
                  )}`}
                  title={activeProduct.name}
                  text={`See this ${activeProduct.name} photo on TradeScout`}
                  size="icon"
                  label=""
                  className="rounded-none border-white/15 bg-white/5 text-white"
                />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeLightbox}
                  className="h-11 w-11 border border-white/15"
                  aria-label="Close expanded gallery"
                >
                  <X className="mx-auto h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              <img
                src={activeProduct.images[photoIndex]}
                alt={`${activeProduct.name}: ${photoDetail?.title || `view ${photoIndex + 1}`}`}
                className="max-h-[74svh] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => movePhoto(-1)}
                className="absolute left-2 h-12 w-12 border border-white/15 bg-black/55"
                aria-label="Previous expanded image"
              >
                <ChevronLeft className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => movePhoto(1)}
                className="absolute right-2 h-12 w-12 border border-white/15 bg-black/55"
                aria-label="Next expanded image"
              >
                <ChevronRight className="mx-auto" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 sm:px-6">
              <p className="text-xs font-light text-white/65">
                {photoDetail?.body || "Use the arrow keys to continue."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivePhoto(null);
                  onDirectConnect(activeProduct.name);
                }}
                className="inline-flex min-h-11 flex-none items-center justify-center border-2 border-ts-orange px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ts-orange"
              >
                Direct Connect
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
