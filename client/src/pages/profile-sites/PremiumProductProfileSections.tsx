import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { buildProfileInventoryShareSearch } from "@shared/profileItemShare";
import type { PremiumProductProfileData } from "@shared/premiumProductProfile";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

type Product = {
  name: string;
  slug: string;
  images: string[];
};

type FaqItem = {
  question?: string;
  answer?: string;
};

type Props = {
  profileSlug: string;
  profileName: string;
  product: Product;
  data: PremiumProductProfileData;
  trustFacts: string[];
  faqItems: FaqItem[];
  profileShareDestination: string;
  platformBaseHref?: string;
  onDirectConnect: (productName?: string | null) => void;
};

function safeImage(images: string[], index: number): string {
  return images[index] || images[0] || "";
}

export default function PremiumProductProfileSections({
  profileSlug,
  profileName,
  product,
  data,
  trustFacts,
  faqItems,
  profileShareDestination,
  platformBaseHref = "",
  onDirectConnect,
}: Props) {
  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  useEffect(() => {
    if (activePhoto === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activePhoto]);

  const openPhoto = (index: number) => setActivePhoto(index);
  const startProductRequest = () => onDirectConnect(product.name);
  const activePhotoIndex = activePhoto ?? 0;

  return (
    <div data-testid="premium-product-profile-sections" className="overflow-hidden bg-stone-950">
      {trustFacts.length > 0 ? (
        <section className="relative z-10 -mt-5 px-4 sm:-mt-7 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-stone-900/95 shadow-2xl backdrop-blur-xl sm:grid-cols-4 sm:rounded-3xl">
            {trustFacts.map((fact) => (
              <div
                key={fact}
                className="flex min-h-20 items-center gap-2.5 border-b border-r border-white/10 px-3 py-4 text-xs font-bold leading-5 text-stone-100 last:border-r-0 sm:min-h-24 sm:px-5 sm:text-sm"
              >
                <ShieldCheck className="h-4 w-4 flex-none text-amber-300" />
                <span>{fact}</span>
              </div>
            ))}
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

          <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
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
                className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-stone-900 text-left sm:min-h-[520px]"
                aria-label={`Open ${label.toLowerCase()} photo of ${product.name}`}
              >
                <img
                  src={safeImage(product.images, index)}
                  alt={`${product.name} in ${label.toLowerCase()}`}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
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

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-12 sm:gap-4">
            {product.images.map((image, index) => {
              const desktopPlacement = [
                "sm:col-span-7 sm:row-span-2 sm:min-h-[580px]",
                "sm:col-span-5 sm:min-h-[282px]",
                "sm:col-span-5 sm:min-h-[282px]",
                "sm:col-span-4 sm:min-h-[330px]",
                "sm:col-span-4 sm:min-h-[330px]",
                "sm:col-span-4 sm:min-h-[330px]",
              ][index];
              return (
                <button
                  key={image}
                  type="button"
                  onClick={() => openPhoto(index)}
                  className={`group relative min-h-[190px] overflow-hidden rounded-2xl bg-stone-300 text-left shadow-sm ${
                    index === 0 ? "col-span-2 min-h-[280px]" : ""
                  } ${desktopPlacement || "sm:col-span-4 sm:min-h-[330px]"}`}
                  aria-label={`Open ${product.name} photo ${index + 1} of ${product.images.length}`}
                >
                  <img
                    src={image}
                    alt={`${product.name} material photo ${index + 1}`}
                    loading={index < 2 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-80" />
                  <span className="absolute bottom-3 left-3 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/25 bg-black/45 px-2 text-[10px] font-black tracking-[0.14em] text-white backdrop-blur-md sm:bottom-4 sm:left-4">
                    {String(index + 1).padStart(2, "0")}
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
                className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-stone-900"
              >
                <img
                  src={safeImage(product.images, item.imageIndex)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-[1.025] group-hover:opacity-75"
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
              onClick={startProductRequest}
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
        <img
          src={safeImage(product.images, data.closing.imageIndex)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
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
              onClick={startProductRequest}
              className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-8 text-base font-black text-white shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
            >
              Direct Connect
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={profileName}
        itemName={product.name}
        platformBaseHref={platformBaseHref}
      />

      {activePhoto !== null ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} photo gallery`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePhoto(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-stone-950 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <p className="text-sm font-black">{product.name}</p>
                <p className="text-xs text-stone-400">
                  Photo {activePhotoIndex + 1} of {product.images.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton
                  destination={`${profileShareDestination}${buildProfileInventoryShareSearch(
                    product.slug,
                    activePhotoIndex
                  )}`}
                  title={product.name}
                  text={`See this ${product.name} photo on TradeScout`}
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
                src={product.images[activePhotoIndex]}
                alt={`${product.name} material photo ${activePhotoIndex + 1}`}
                className="max-h-[68vh] w-full object-contain"
              />
              {product.images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhoto(
                        (activePhotoIndex - 1 + product.images.length) % product.images.length
                      )
                    }
                    className="absolute left-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 sm:left-4"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhoto((activePhotoIndex + 1) % product.images.length)}
                    className="absolute right-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 sm:right-4"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActivePhoto(index)}
                    className={`h-12 w-16 flex-none overflow-hidden rounded-lg border-2 transition ${
                      index === activePhotoIndex
                        ? "border-amber-300 opacity-100"
                        : "border-transparent opacity-55 hover:opacity-100"
                    }`}
                    aria-label={`View photo ${index + 1}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePhoto(null);
                  startProductRequest();
                }}
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
