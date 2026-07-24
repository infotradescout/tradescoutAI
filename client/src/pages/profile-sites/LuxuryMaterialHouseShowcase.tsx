import { useEffect, useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import type { PremiumProductProfileData } from "@shared/premiumProductProfile";

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
  onDirectConnect: (productName?: string | null) => void;
};

/**
 * Vertical editorial luxury-material-house presentation.
 * Application imagery leads; no inventory/catalog chrome.
 */
export default function LuxuryMaterialHouseShowcase({
  profileName,
  product,
  products = [product],
  initialProductSlug,
  data,
  trustFacts: _trustFacts,
  faqItems,
  onDirectConnect,
}: Props) {
  const house = data.luxuryHouse;
  if (!house) {
    throw new Error(
      'PremiumProductProfileData.presentation "luxury-material-house" requires luxuryHouse data'
    );
  }

  const initialChapter =
    house.materialChapters.find((chapter) => chapter.slug === initialProductSlug) ||
    house.materialChapters.find((chapter) => chapter.slug === data.featuredProductSlug) ||
    house.materialChapters[0];
  const [selectedMaterialSlug, setSelectedMaterialSlug] = useState(initialChapter.slug);
  const selectedChapter =
    house.materialChapters.find((chapter) => chapter.slug === selectedMaterialSlug) ||
    initialChapter;
  const selectedProduct =
    products.find((entry) => entry.slug === selectedMaterialSlug) ||
    products.find((entry) => entry.slug === selectedChapter.slug) ||
    product;

  useEffect(() => {
    if (!initialProductSlug) return;
    const match = house.materialChapters.find((chapter) => chapter.slug === initialProductSlug);
    if (match) setSelectedMaterialSlug(match.slug);
  }, [house.materialChapters, initialProductSlug]);

  const startConsultation = () => onDirectConnect(selectedProduct.name);

  return (
    <div
      data-testid="luxury-material-house-showcase"
      className="overflow-hidden bg-[#070605] text-[#f4efe6]"
    >
      {/* 1. Designed with light — immersive installed interior */}
      <section
        id="designed-with-light"
        data-testid="luxury-house-designed-with-light"
        className="relative isolate min-h-[78svh] scroll-mt-24 overflow-hidden"
      >
        <img
          src={house.designedWithLight.image}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <span className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,6,5,0.25)_0%,rgba(7,6,5,0.55)_48%,rgba(7,6,5,0.92)_100%)]" />
        <div className="relative z-10 mx-auto flex min-h-[78svh] max-w-7xl items-end px-4 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.designedWithLight.eyebrow}
            </p>
            <h2 className="mt-4 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl md:text-6xl">
              {house.designedWithLight.title}
            </h2>
            <p className="mt-5 max-w-xl text-sm font-light leading-7 text-white/80 sm:text-base sm:leading-8">
              {house.designedWithLight.body}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Editorial material chapters — application first, detail second */}
      <section
        id="material-chapters"
        data-testid="luxury-house-material-chapters"
        className="scroll-mt-24 bg-[#0c0a08] px-4 py-16 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl space-y-20 sm:space-y-28">
          {house.materialChapters.map((chapter, chapterIndex) => (
            <article
              key={chapter.slug}
              id={`chapter-${chapter.slug}`}
              data-testid={`luxury-house-chapter-${chapter.slug}`}
              className="grid gap-8 lg:grid-cols-12 lg:gap-10"
            >
              <div className={`lg:col-span-7 ${chapterIndex % 2 === 1 ? "lg:order-2" : ""}`}>
                <div className="overflow-hidden">
                  <img
                    src={chapter.applicationImage}
                    alt={`${chapter.name} installed interior`}
                    loading={chapterIndex === 0 ? "eager" : "lazy"}
                    className="aspect-[4/3] h-full w-full object-cover transition duration-[1200ms] ease-out hover:scale-[1.015] motion-reduce:transition-none"
                  />
                </div>
                <div className="mt-3 overflow-hidden">
                  <img
                    src={chapter.detailImage}
                    alt={`${chapter.name} material detail`}
                    loading="lazy"
                    className="aspect-[16/7] w-full object-cover"
                  />
                </div>
              </div>
              <div
                className={`flex flex-col justify-center lg:col-span-5 ${
                  chapterIndex % 2 === 1 ? "lg:order-1" : ""
                }`}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
                  {chapter.eyebrow}
                </p>
                <h3 className="mt-3 font-editorial text-3xl font-medium leading-[1.02] tracking-[-0.02em] sm:text-4xl md:text-5xl">
                  {chapter.name}
                </h3>
                <p className="mt-4 text-sm font-light leading-7 text-[#b7aa98] sm:text-base">
                  {chapter.body}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMaterialSlug(chapter.slug);
                    onDirectConnect(chapter.name);
                  }}
                  aria-label={`Direct Connect about ${chapter.name}`}
                  className="mt-8 inline-flex min-h-12 w-fit items-center justify-center gap-2 border-2 border-ts-orange bg-[var(--brand-bg,#f7f3ea)]/92 px-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-ts-orange transition hover:bg-[var(--brand-bg,#f7f3ea)]"
                >
                  Discuss {chapter.name}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. From stone to space — capabilities */}
      <section
        id="capabilities"
        data-testid="luxury-house-capabilities"
        className="scroll-mt-24 bg-[#f7f0e4] px-4 py-16 text-[#17100b] sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl sm:mb-14">
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.capabilities.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              {house.capabilities.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-light leading-7 text-[#5c5348] sm:text-base">
              {house.capabilities.body}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {house.capabilities.items.map((item, index) => (
              <div key={item.title} className="border-t border-[#342316]/15 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-accent,#d9a441)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-editorial text-2xl font-medium tracking-[-0.02em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm font-light leading-7 text-[#5c5348]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Curated project showcase — application images only */}
      <section
        id="showcase"
        data-testid="luxury-house-showcase"
        className="scroll-mt-24 bg-[#070605] px-4 py-16 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl sm:mb-14">
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.showcase.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              {house.showcase.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-light leading-7 text-[#b7aa98] sm:text-base">
              {house.showcase.body}
            </p>
          </div>
          <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-4 lg:grid-cols-12">
            {house.showcase.images.map((image, index) => {
              const wide = index % 5 === 0 || index % 5 === 3;
              return (
                <figure
                  key={image}
                  className={`overflow-hidden bg-[#120f0c] ${
                    wide ? "col-span-2 lg:col-span-8" : "col-span-1 lg:col-span-4"
                  } ${index % 3 === 1 ? "lg:mt-10" : ""}`}
                >
                  <img
                    src={image}
                    alt={`${profileName} installed project ${index + 1}`}
                    loading={index < 2 ? "eager" : "lazy"}
                    className={`w-full object-cover transition duration-[1100ms] ease-out hover:scale-[1.02] motion-reduce:transition-none ${
                      wide ? "aspect-[16/10]" : "aspect-[4/5]"
                    }`}
                  />
                </figure>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Private project consultation */}
      <section
        id="consult"
        data-testid="luxury-house-consultation"
        className="scroll-mt-24 bg-[#f7f0e4] px-4 py-16 text-[#17100b] sm:px-8 sm:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.consultation.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              {house.consultation.title}
            </h2>
            <p className="mt-4 max-w-xl text-sm font-light leading-7 text-[#5c5348] sm:text-base">
              {house.consultation.body}
            </p>
            <p className="mt-3 font-editorial text-2xl font-medium text-[#342316]">
              {house.consultation.prompt}
            </p>

            {house.materialChapters.length > 1 ? (
              <div
                className="mt-8 flex w-fit flex-wrap gap-1 border border-[#342316]/20 p-1"
                role="group"
                aria-label="Select material for consultation"
              >
                {house.materialChapters.map((chapter) => (
                  <button
                    key={chapter.slug}
                    type="button"
                    onClick={() => setSelectedMaterialSlug(chapter.slug)}
                    aria-pressed={chapter.slug === selectedMaterialSlug}
                    className={`min-h-11 px-5 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                      chapter.slug === selectedMaterialSlug
                        ? "bg-[var(--brand-accent,#d9a441)] text-[var(--brand-primary-dark,#17100b)]"
                        : "text-[#342316]/70 hover:text-[#342316]"
                    }`}
                  >
                    {chapter.name}
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={startConsultation}
              aria-label={`Direct Connect about ${selectedProduct.name}`}
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 border-2 border-ts-orange bg-[#17100b] px-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-ts-orange transition hover:bg-[#24180f]"
            >
              <MessageCircle className="h-4 w-4" />
              Direct Connect
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="border border-[#342316]/12 bg-white/70 p-5 backdrop-blur sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a7f70]">
              A useful first message includes
            </p>
            <ul className="mt-5 space-y-3">
              {house.consultation.fields.map((field, index) => (
                <li
                  key={field}
                  className="flex items-center gap-3 border border-[#342316]/10 bg-white px-4 py-3.5"
                >
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center bg-[#17100b] text-[10px] font-semibold tracking-[0.14em] text-[var(--brand-accent,#d9a441)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-[#342316]">{field}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-5 text-[#5c5348]">{house.consultation.note}</p>
          </div>
        </div>
      </section>

      {faqItems.length > 0 ? (
        <section className="bg-[#0c0a08] px-4 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-editorial text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
              Before the conversation
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {faqItems.map((faq, index) => (
                <details
                  key={`${faq.question || "Question"}-${index}`}
                  className="border border-white/10 bg-black/30 p-5 open:border-[var(--brand-accent,#d9a441)]/40"
                >
                  <summary className="cursor-pointer list-none font-medium text-white">
                    {faq.question}
                  </summary>
                  {faq.answer ? (
                    <p className="mt-3 text-sm font-light leading-7 text-[#b7aa98]">{faq.answer}</p>
                  ) : null}
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="connect"
        className="relative isolate min-h-[52svh] overflow-hidden px-4 py-20 sm:px-8"
      >
        <img
          src={house.showcase.images[2] || house.designedWithLight.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-black/92 via-black/70 to-black/20" />
        <div className="mx-auto flex min-h-[40svh] max-w-7xl items-center">
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
            <button
              type="button"
              onClick={startConsultation}
              aria-label={`Direct Connect about ${selectedProduct.name}`}
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 border-2 border-ts-orange bg-[var(--brand-bg,#f7f3ea)]/92 px-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-ts-orange transition hover:bg-[var(--brand-bg,#f7f3ea)]"
            >
              Direct Connect
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
