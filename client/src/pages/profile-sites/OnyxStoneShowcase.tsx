import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";
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
  profileName,
  product,
  products = [product],
  initialProductSlug,
  initialPhotoIndex = 0,
  data,
  trustFacts,
  faqItems,
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
  const offering = data.offerings?.items.find((entry) => entry.slug === activeProduct.slug);
  const narrativeEyebrow =
    (isFeaturedProduct ? data.contrast.eyebrow : offering?.eyebrow) || activeProduct.name;
  const narrativeTitle =
    (isFeaturedProduct ? data.contrast.title : offering?.title) || activeProduct.name;
  const narrativeBody =
    (isFeaturedProduct ? data.contrast.body : offering?.body) ||
    `Explore the approved ${activeProduct.name} photography before starting a conversation.`;

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
      const nextItem = rail.children.item(clamped) as HTMLElement | null;
      const left = nextItem?.offsetLeft || 0;
      if (typeof rail.scrollTo === "function") {
        rail.scrollTo({ left, behavior });
      } else {
        rail.scrollLeft = left;
      }
      setVisiblePhoto(clamped);
    },
    [activeProduct.images.length]
  );

  const closeLightbox = useCallback(() => {
    const index = activePhoto;
    setActivePhoto(null);
    if (index !== null) {
      // Keep counter + rail aligned to the last viewed photo after deep-link close.
      window.requestAnimationFrame(() => scrollRailToIndex(index, "auto"));
    }
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [activePhoto, scrollRailToIndex]);

  useEffect(() => {
    if (!requestedProduct) return;
    const requestedIndex = Math.min(
      Math.max(0, initialPhotoIndex),
      Math.max(0, requestedProduct.images.length - 1)
    );
    setActiveProductSlug(requestedProduct.slug);
    setVisiblePhoto(requestedIndex);
    setActivePhoto(requestedIndex);
  }, [initialPhotoIndex, requestedProduct]);

  useEffect(() => {
    if (!requestedProduct) return;
    if (activeProductSlug !== requestedProduct.slug) return;
    const requestedIndex = Math.min(
      Math.max(0, initialPhotoIndex),
      Math.max(0, requestedProduct.images.length - 1)
    );
    // Wait until the product rail has painted, then scroll the shared photo into view.
    const frame = window.requestAnimationFrame(() => {
      scrollRailToIndex(requestedIndex, "auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeProductSlug,
    initialPhotoIndex,
    requestedProduct,
    scrollRailToIndex,
  ]);

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
    <div data-testid="onyx-stone-showcase" className="overflow-hidden bg-[#0b0907] text-[#f7f0e5]">
      {trustFacts.length ? (
        <section className="border-y border-white/10" aria-label={`${profileName} highlights`}>
          <div className="mx-auto flex max-w-7xl snap-x snap-mandatory overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
            {trustFacts.map((fact) => (
              <p
                key={fact}
                className="flex min-h-14 min-w-[72vw] snap-start items-center border-r border-white/10 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d9c8ad] first:border-l sm:min-w-0 sm:flex-1 sm:justify-center sm:text-center"
              >
                {fact}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section id="collection" className="scroll-mt-24 py-8 sm:py-12">
        <div className="mx-auto mb-6 max-w-7xl px-4 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d8b675]">
            {data.offerings?.eyebrow || data.gallery.eyebrow}
          </p>
          <div className="mt-2 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <h2 className="max-w-[20ch] font-serif text-3xl font-medium leading-[1.02] tracking-[-0.035em] sm:text-5xl">
                {data.offerings?.title || data.gallery.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c9beb0] sm:text-base">
                {data.offerings?.body || data.gallery.body}
              </p>
            </div>
            {products.length > 1 ? (
              <div
                className="flex w-fit rounded-full border border-white/15 bg-white/5 p-1"
                role="group"
                aria-label="Choose onyx collection"
              >
                {products.map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => selectProduct(entry.slug)}
                    aria-pressed={entry.slug === activeProduct.slug}
                    className={`min-h-11 rounded-full px-4 text-xs font-semibold transition ${
                      entry.slug === activeProduct.slug
                        ? "bg-[#e8d6b4] text-[#211a14]"
                        : "text-white/70 hover:text-white"
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
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth outline-none [scrollbar-color:#d8b675_#211b16] [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#efd393] motion-reduce:scroll-auto"
          >
            {activeProduct.images.map((image, index) => {
              const detail = isFeaturedProduct ? data.gallery.photos?.[index] : undefined;
              return (
                <article
                  key={image}
                  className="group relative h-[62svh] min-h-[430px] w-[92vw] max-w-[1180px] flex-none snap-start overflow-hidden border-r border-white/10 bg-stone-900 sm:h-[68svh] sm:min-h-[540px] sm:w-[82vw]"
                >
                  <img
                    src={image}
                    alt={`${activeProduct.name}: ${detail?.title || `material view ${index + 1}`}`}
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(min-width: 1024px) 82vw, 92vw"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none group-hover:scale-[1.01]"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,3,0.05)_25%,rgba(5,4,3,0.9)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8">
                    <div className="max-w-xl">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#efd393]">
                        {detail?.label || offering?.eyebrow || "Material view"} ·{" "}
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-2 font-serif text-2xl font-medium sm:text-4xl">
                        {detail?.title || activeProduct.name}
                      </h3>
                      <p className="mt-2 hidden text-sm leading-6 text-white/75 sm:block">
                        {detail?.body || offering?.body}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        returnFocusRef.current = event.currentTarget;
                        setActivePhoto(index);
                      }}
                      className="inline-flex min-h-12 flex-none items-center gap-2 rounded-full border border-white/35 bg-black/30 px-4 text-xs font-semibold backdrop-blur-md transition hover:bg-white hover:text-stone-950"
                      aria-label={`Expand ${detail?.title || `${activeProduct.name} photo ${index + 1}`}`}
                    >
                      Expand <ArrowUpRight className="h-4 w-4" />
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
              className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/50 disabled:opacity-20"
              aria-label="Previous showcase image"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => scrollRail(1)}
              disabled={visiblePhoto >= activeProduct.images.length - 1}
              className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/50 disabled:opacity-20"
              aria-label="Next showcase image"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-7xl justify-between px-4 text-[10px] uppercase tracking-[0.18em] text-[#a89b8b] sm:px-6">
          <p>Swipe, scroll, or use arrow keys</p>
          <p className="text-[#d8b675]" aria-live="polite" aria-atomic="true">
            {String(visiblePhoto + 1).padStart(2, "0")} /{" "}
            {String(activeProduct.images.length).padStart(2, "0")}
          </p>
        </div>
      </section>

      <section id="why-us" className="bg-[#efe9df] px-4 py-10 text-[#211a14] sm:px-6 sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#88662d]">
              {narrativeEyebrow}
            </p>
            <h2 className="mt-2 max-w-[18ch] font-serif text-3xl font-medium leading-[1.02] sm:text-5xl">
              {narrativeTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#665b50]">{narrativeBody}</p>
            <button
              type="button"
              onClick={() => onDirectConnect(activeProduct.name)}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#211a14] px-6 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Direct Connect
            </button>
          </div>
          <div className="divide-y divide-[#211a14]/15 border-y border-[#211a14]/15">
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none justify-between font-semibold">
                {isFeaturedProduct ? "Where the material belongs" : `About ${activeProduct.name}`}
                <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
              </summary>
              {isFeaturedProduct ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {data.applications.items.map((item) => (
                    <div key={item.title}>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#665b50]">{item.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm leading-6 text-[#665b50]">{narrativeBody}</p>
                  {offering?.highlights?.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {offering.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="rounded-full border border-[#88662d]/30 px-3 py-1 text-xs font-semibold"
                        >
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none justify-between font-semibold">
                Plan a useful request
                <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#665b50]">{data.brief.body}</p>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {data.brief.steps.map((step) => (
                  <li key={step} className="border-l border-[#88662d]/45 pl-3">
                    {step}
                  </li>
                ))}
              </ul>
            </details>
            {faqItems.length ? (
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none justify-between font-semibold">
                  Questions before connecting
                  <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
                  {faqItems.map((faq, index) => (
                    <details key={`${faq.question}-${index}`} className="border-l pl-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        {faq.question}
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-[#665b50]">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="connect"
        className="relative isolate min-h-[52svh] overflow-hidden px-4 py-16 sm:px-6"
      >
        <img
          src={activeProduct.images[data.closing.imageIndex] || activeProduct.images[0]}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/65 to-black/15" />
        <div className="mx-auto flex min-h-[40svh] max-w-7xl items-center">
          <div className="max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#efd393]">
              {offering?.eyebrow || data.closing.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-4xl font-medium leading-[0.98] sm:text-6xl">
              Put {activeProduct.name} in the conversation.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">
              Share the {activeProduct.name} view that fits your idea, then send the project through
              Direct Connect. Your contact details stay private unless the request is accepted.
            </p>
            <button
              type="button"
              onClick={() => onDirectConnect(activeProduct.name)}
              className="mt-7 min-h-12 rounded-full bg-ts-orange px-7 text-sm font-semibold text-white"
            >
              Direct Connect
            </button>
          </div>
        </div>
      </section>

      {activePhoto !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeProduct.name} photo gallery`}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95 p-2 sm:p-6"
          onMouseDown={(event) => event.target === event.currentTarget && closeLightbox()}
        >
          <div
            className="flex max-h-[96svh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0907]"
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
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#efd393]">
                  {activeProduct.name} · Photo {photoIndex + 1} of {activeProduct.images.length}
                </p>
                <h3 className="mt-1 font-serif text-xl">
                  {photoDetail?.title || activeProduct.name}
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
                  className="rounded-full border-white/15 bg-white/5 text-white"
                />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeLightbox}
                  className="h-11 w-11 rounded-full border border-white/15"
                  aria-label="Close expanded gallery"
                >
                  <X className="mx-auto h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              <img
                src={activeProduct.images[photoIndex]}
                alt={`${activeProduct.name}: ${
                  photoDetail?.title || `material view ${photoIndex + 1}`
                }`}
                className="max-h-[74svh] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => movePhoto(-1)}
                className="absolute left-2 h-12 w-12 rounded-full bg-black/55"
                aria-label="Previous expanded image"
              >
                <ChevronLeft className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => movePhoto(1)}
                className="absolute right-2 h-12 w-12 rounded-full bg-black/55"
                aria-label="Next expanded image"
              >
                <ChevronRight className="mx-auto" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 sm:px-6">
              <p className="text-xs text-white/65">
                {photoDetail?.body || "Swipe or use the arrow keys to explore the stone."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivePhoto(null);
                  onDirectConnect(activeProduct.name);
                }}
                className="min-h-11 flex-none rounded-full border border-ts-orange/45 px-5 text-xs font-semibold text-ts-orange"
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
