import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
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
import type { DirectConnectTarget } from "./directConnectMaterial";
import LuxuryMaterialHouseShowcase from "./LuxuryMaterialHouseShowcase";
import OnyxStoneShowcase from "./OnyxStoneShowcase";

type Product = {
  name: string;
  slug: string;
  images: string[];
  shareImageOrder?: number[];
};

type FaqItem = {
  question?: string;
  answer?: string;
};

type Props = {
  profileName: string;
  product: Product;
  products?: Product[];
  initialProductSlug?: string | null;
  initialPhotoIndex?: number;
  data: PremiumProductProfileData;
  trustFacts: string[];
  faqItems: FaqItem[];
  profileShareDestination: string;
  platformBaseHref?: string;
  onDirectConnect: (target?: DirectConnectTarget) => void;
};

function safeImage(images: string[], index: number): string {
  return images[index] || images[0] || "";
}

export default function PremiumProductProfileSections(props: Props) {
  if (props.data.presentation === "luxury-material-house") {
    return <LuxuryMaterialHouseShowcase {...props} />;
  }
  if (props.data.presentation === "horizontal-luxury-showcase") {
    return <OnyxStoneShowcase {...props} />;
  }
  return <EditorialProductProfileSections {...props} />;
}

function EditorialProductProfileSections({
  profileName,
  product,
  products = [product],
  initialProductSlug,
  initialPhotoIndex = 0,
  data,
  trustFacts,
  faqItems,
  profileShareDestination,
  platformBaseHref: _platformBaseHref = "",
  onDirectConnect,
}: Props) {
  const [activeProductSlug, setActiveProductSlug] = useState(product.slug);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const activeGalleryProduct =
    products.find((entry) => entry.slug === activeProductSlug) || product;
  const requestedProduct = initialProductSlug
    ? products.find((entry) => entry.slug === initialProductSlug)
    : null;

  useEffect(() => {
    if (!requestedProduct) return;
    const requestedIndex = Math.min(
      Math.max(0, initialPhotoIndex),
      Math.max(0, requestedProduct.images.length - 1)
    );
    setActiveProductSlug(requestedProduct.slug);
    setActivePhoto(requestedIndex);
  }, [initialPhotoIndex, requestedProduct]);

  useEffect(() => {
    if (activePhoto === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhoto(null);
      if (event.key === "ArrowLeft" && activeGalleryProduct.images.length > 1) {
        setActivePhoto((current) =>
          current === null
            ? null
            : (current - 1 + activeGalleryProduct.images.length) %
              activeGalleryProduct.images.length
        );
      }
      if (event.key === "ArrowRight" && activeGalleryProduct.images.length > 1) {
        setActivePhoto((current) =>
          current === null ? null : (current + 1) % activeGalleryProduct.images.length
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeGalleryProduct.images.length, activePhoto]);

  const openProductPhoto = (selectedProduct: Product, index: number) => {
    setActiveProductSlug(selectedProduct.slug);
    setActivePhoto(index);
  };
  const openPhoto = (index: number) => openProductPhoto(product, index);
  const startFeaturedProductRequest = () => onDirectConnect(product.name);
  const activePhotoIndex = activePhoto ?? 0;
  const activePhotoDetail =
    activeGalleryProduct.slug === product.slug
      ? data.gallery.photos?.[activePhotoIndex]
      : undefined;

  return (
    <div data-testid="premium-product-profile-sections" className="overflow-hidden bg-stone-950">
      {trustFacts.length > 0 ? (
        <section className="relative z-10 -mt-5 px-4 sm:-mt-7 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-stone-900/95 shadow-2xl backdrop-blur-xl sm:grid-cols-4 sm:rounded-3xl">
            {trustFacts.map((fact) => (
              <div
                key={fact}
                className="flex min-h-20 items-center border-b border-r border-white/10 px-3 py-4 text-xs font-bold leading-5 text-stone-100 last:border-r-0 sm:min-h-24 sm:px-5 sm:text-sm"
              >
                <span>{fact}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.offerings && products.length > 1 ? (
        <section
          id="offerings"
          data-testid="premium-product-offerings"
          className="bg-stone-100 px-4 py-16 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-3xl sm:mb-12">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700 sm:text-xs">
                {data.offerings.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] text-stone-950 sm:text-5xl">
                {data.offerings.title}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                {data.offerings.body}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {data.offerings.items.map((offering) => {
                const offeringProduct = products.find((entry) => entry.slug === offering.slug);
                if (!offeringProduct) return null;
                return (
                  <article
                    key={offering.slug}
                    className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
                  >
                    <div className="grid grid-cols-3 gap-1 bg-stone-900 p-1">
                      {offeringProduct.images.slice(0, 3).map((image, index) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => openProductPhoto(offeringProduct, index)}
                          aria-label={`Open ${offering.title} photo ${index + 1}`}
                          className="overflow-hidden rounded-xl"
                        >
                          <img
                            src={image}
                            alt={index === 0 ? `${offering.title} from ${profileName}` : ""}
                            aria-hidden={index === 0 ? undefined : "true"}
                            loading="lazy"
                            className="aspect-[4/3] h-full w-full object-contain transition duration-500 hover:scale-[1.02]"
                          />
                        </button>
                      ))}
                    </div>
                    <div className="p-5 sm:p-7">
                      {offering.eyebrow ? (
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                          {offering.eyebrow}
                        </p>
                      ) : null}
                      <h3 className="mt-2 text-2xl font-black text-stone-950 sm:text-3xl">
                        {offering.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-stone-600">{offering.body}</p>
                      {offering.highlights?.length ? (
                        <ul
                          className="mt-4 flex flex-wrap gap-2"
                          aria-label={`${offering.title} highlights`}
                        >
                          {offering.highlights.map((highlight) => (
                            <li
                              key={highlight}
                              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700"
                            >
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => openProductPhoto(offeringProduct, 0)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 text-sm font-black text-stone-900 transition hover:bg-stone-50"
                        >
                          View collection
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDirectConnect(offeringProduct.name)}
                          aria-label={`Direct Connect about ${offeringProduct.name}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-stone-950 px-5 text-sm font-black text-white transition hover:bg-ts-orange"
                        >
                          Direct Connect
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <ShareButton
                          destination={`${profileShareDestination}${buildProfileInventoryShareSearch(
                            offeringProduct.slug
                          )}`}
                          title={offeringProduct.name}
                          text={`See ${offeringProduct.name} from ${profileName} on TradeScout`}
                          label={`Share ${offeringProduct.name}`}
                          className="border-stone-300 bg-white text-stone-900 hover:bg-stone-50"
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section id="why-us" className="px-4 py-16 text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl sm:mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300 sm:text-xs">
              {data.contrast.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              {data.contrast.title}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-300 sm:text-lg sm:leading-8">
              {data.contrast.body}
            </p>
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-2 lg:gap-5">
            {[
              {
                label: data.contrast.daylightLabel,
                index: data.contrast.daylightImageIndex,
              },
              {
                label: data.contrast.backlitLabel,
                index: data.contrast.backlitImageIndex,
              },
            ].map(({ label, index }) => (
              <button
                key={label}
                type="button"
                onClick={() => openPhoto(index)}
                className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-stone-900 text-left ${
                  data.gallery.portraitPhotoIndexes?.includes(index)
                    ? "aspect-[3/4]"
                    : "aspect-[4/3]"
                }`}
                aria-label={`Open ${label.toLowerCase()} photo of ${product.name}`}
              >
                <img
                  src={safeImage(product.images, index)}
                  alt={`${product.name} in ${label.toLowerCase()}`}
                  className="absolute inset-0 h-full w-full object-contain transition duration-700 group-hover:scale-[1.015]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/10" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-7">
                  <span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                      Actual material
                    </span>
                    <span className="mt-1 block text-2xl font-black text-white sm:text-3xl">
                      {label}
                    </span>
                  </span>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition group-hover:bg-ts-orange">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="collection" className="scroll-mt-24 bg-stone-100 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-5 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700 sm:text-xs">
                {data.gallery.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] text-stone-950 sm:text-5xl">
                {data.gallery.title}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                {data.gallery.body}
              </p>
            </div>
            <ShareButton
              destination={`${profileShareDestination}${buildProfileInventoryShareSearch(product.slug)}`}
              title={product.name}
              text={`See ${product.name} on TradeScout`}
              label={`Share ${product.name}`}
              className="w-fit border-stone-300 bg-white text-stone-900 shadow-sm hover:bg-stone-50"
            />
          </div>

          <div className="grid grid-cols-2 items-start gap-2.5 sm:grid-cols-3 sm:gap-4">
            {product.images.map((image, index) => {
              const photoDetail = data.gallery.photos?.[index];
              const isPortrait = data.gallery.portraitPhotoIndexes?.includes(index);
              return (
                <button
                  key={image}
                  type="button"
                  onClick={() => openPhoto(index)}
                  className={`group relative overflow-hidden rounded-2xl bg-stone-300 text-left shadow-sm ${
                    isPortrait ? "aspect-[3/4]" : "aspect-[4/3]"
                  } ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
                  aria-label={`Open ${photoDetail?.title || `${product.name} photo ${index + 1}`} of ${product.images.length}`}
                >
                  <img
                    src={image}
                    alt={
                      photoDetail
                        ? `${product.name}: ${photoDetail.title}`
                        : `${product.name} material photo ${index + 1}`
                    }
                    loading={index < 2 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-contain transition duration-700 group-hover:scale-[1.015]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-80" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                    <span className="min-w-0">
                      {photoDetail ? (
                        <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                          {photoDetail.label}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-base font-black leading-tight text-white sm:text-lg">
                        {photoDetail?.title || `Photo ${String(index + 1).padStart(2, "0")}`}
                      </span>
                    </span>
                    <span className="inline-flex h-8 min-w-8 flex-none items-center justify-center rounded-full border border-white/25 bg-black/45 px-2 text-[10px] font-black tracking-[0.14em] text-white backdrop-blur-md">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="audience"
        className="scroll-mt-24 bg-stone-950 px-4 py-16 text-white sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl sm:mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300 sm:text-xs">
              {data.applications.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl">
              {data.applications.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
              {data.applications.body}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.applications.items.map((item, index) => (
              <article
                key={item.title}
                className="group relative min-h-[320px] overflow-hidden rounded-3xl border border-white/10 bg-black sm:min-h-[360px]"
              >
                <img
                  src={safeImage(product.images, item.imageIndex)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain opacity-75 transition duration-700 group-hover:scale-[1.015] group-hover:opacity-85"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                    Idea {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-xl font-black text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-amber-200 px-4 py-16 text-stone-950 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-900 sm:text-xs">
              {data.brief.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl">
              {data.brief.title}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-700 sm:text-base">
              {data.brief.body}
            </p>
            <button
              type="button"
              onClick={startFeaturedProductRequest}
              aria-label={`Direct Connect about ${product.name}`}
              className="mt-7 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-ts-orange/45 bg-stone-950/5 px-7 py-3.5 text-sm font-black text-ts-orange-dark transition hover:-translate-y-0.5 hover:bg-ts-orange/10"
            >
              <MessageCircle className="h-4 w-4" />
              Direct Connect
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-3xl border border-stone-950/10 bg-white/70 p-5 shadow-xl shadow-amber-950/10 backdrop-blur sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">
              A useful first message includes
            </p>
            <div className="mt-5 space-y-3">
              {data.brief.steps.map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-2xl border border-stone-950/10 bg-white px-4 py-3.5"
                >
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-stone-950 text-xs font-black text-amber-200">
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-stone-800">{step}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-stone-600">
              <Check className="mt-0.5 h-4 w-4 flex-none" />
              {data.brief.note}
            </p>
          </div>
        </div>
      </section>

      {faqItems.length > 0 ? (
        <section className="bg-stone-100 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 max-w-2xl sm:mb-10">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700 sm:text-xs">
                Before the conversation
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-stone-950 sm:text-5xl">
                The questions people ask first.
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {faqItems.map((faq, index) => (
                <details
                  key={`${faq.question || "Question"}-${index}`}
                  className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm open:border-amber-300 open:shadow-md sm:p-6"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-black text-stone-950">
                    <span>{faq.question}</span>
                    <ChevronDown className="h-5 w-5 flex-none text-amber-700 transition group-open:rotate-180" />
                  </summary>
                  {faq.answer ? (
                    <p className="mt-4 text-sm leading-7 text-stone-600">{faq.answer}</p>
                  ) : null}
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="connect"
        className="relative isolate overflow-hidden px-4 py-20 text-white sm:px-6 sm:py-28"
      >
        <picture>
          <img
            src={safeImage(product.images, data.closing.imageIndex)}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 -z-20 h-full w-full ${
              data.closing.imageFit === "contain" ? "object-contain" : "object-cover"
            }`}
          />
        </picture>
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/80 to-black/35" />
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300 sm:text-xs">
              {data.closing.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-6xl">
              {data.closing.title}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-200 sm:text-lg sm:leading-8">
              {data.closing.body}
            </p>
            <button
              type="button"
              onClick={() => onDirectConnect(null)}
              aria-label={`Direct Connect with ${profileName}`}
              className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-8 text-base font-black text-white shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
            >
              Direct Connect
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {activePhoto !== null ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeGalleryProduct.name} photo gallery`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePhoto(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-stone-950 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  {activePhotoDetail?.label || activeGalleryProduct.name}
                </p>
                <p className="mt-0.5 text-sm font-black">
                  {activePhotoDetail?.title || activeGalleryProduct.name}
                </p>
                <p className="text-xs text-stone-400">
                  Photo {activePhotoIndex + 1} of {activeGalleryProduct.images.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton
                  destination={`${profileShareDestination}${buildProfileInventoryShareSearch(
                    activeGalleryProduct.slug,
                    profileInventoryShareIndexForDisplay(
                      activeGalleryProduct.images,
                      activeGalleryProduct.shareImageOrder,
                      activePhotoIndex
                    )
                  )}`}
                  title={activeGalleryProduct.name}
                  text={`See this ${activeGalleryProduct.name} photo on TradeScout`}
                  size="icon"
                  label=""
                  className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Close gallery"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-[280px] flex-1 items-center justify-center bg-black">
              <img
                src={activeGalleryProduct.images[activePhotoIndex]}
                alt={
                  activePhotoDetail
                    ? `${activeGalleryProduct.name}: ${activePhotoDetail.title}`
                    : `${activeGalleryProduct.name} material photo ${activePhotoIndex + 1}`
                }
                className="max-h-[68vh] w-full object-contain"
              />
              {activeGalleryProduct.images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhoto(
                        (activePhotoIndex - 1 + activeGalleryProduct.images.length) %
                          activeGalleryProduct.images.length
                      )
                    }
                    className="absolute left-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 sm:left-4"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhoto((activePhotoIndex + 1) % activeGalleryProduct.images.length)
                    }
                    className="absolute right-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 sm:right-4"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0 flex-1">
                {activePhotoDetail?.body ? (
                  <p className="mb-3 max-w-2xl text-xs leading-5 text-stone-300 sm:text-sm">
                    {activePhotoDetail.body}
                  </p>
                ) : null}
                <div className="flex gap-2 overflow-x-auto">
                  {activeGalleryProduct.images.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setActivePhoto(index)}
                      className={`h-12 w-16 flex-none overflow-hidden rounded-lg border-2 transition ${
                        index === activePhotoIndex
                          ? "border-amber-300 opacity-100"
                          : "border-transparent opacity-55 hover:opacity-100"
                      }`}
                      aria-label={`View ${
                        activeGalleryProduct.slug === product.slug
                          ? data.gallery.photos?.[index]?.title || `photo ${index + 1}`
                          : `${activeGalleryProduct.name} photo ${index + 1}`
                      }`}
                    >
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePhoto(null);
                  onDirectConnect(activeGalleryProduct.name);
                }}
                aria-label={`Direct Connect about ${activeGalleryProduct.name}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ts-orange/45 bg-ts-orange/10 px-6 text-sm font-black text-ts-orange hover:bg-ts-orange/15"
              >
                Direct Connect
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
