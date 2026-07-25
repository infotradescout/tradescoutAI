import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import type { PremiumProductProfileData } from "@shared/premiumProductProfile";
import { seedFromProfileMaterial } from "@/lib/scoutContextCache";
import type { DirectConnectTarget } from "./directConnectMaterial";
import { SafeProfileImg } from "./safeProfileImage";

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
  /** Platform Recommend / Like / Favorite / Share — placed after showcase. */
  platformEngagement?: ReactNode;
};

type ShowcaseTile = {
  span: 4 | 6 | 8 | 12;
  aspect: "wide" | "tall";
};

/**
 * Editorial collage spans that always fill 12-column rows — no orphan empty cells.
 * Alternates 8+4 / 4+8; packs leftovers as 4+4+4, 6+6, or full-bleed 12.
 */
export function buildShowcaseCollageLayout(count: number): ShowcaseTile[] {
  if (count <= 0) return [];
  const tiles: ShowcaseTile[] = [];
  let remaining = count;
  let pairToggle = 0;

  while (remaining > 0) {
    if (remaining === 1) {
      tiles.push({ span: 12, aspect: "wide" });
      remaining = 0;
      continue;
    }
    if (remaining === 2) {
      if (pairToggle % 2 === 0) {
        tiles.push({ span: 8, aspect: "wide" }, { span: 4, aspect: "tall" });
      } else {
        tiles.push({ span: 6, aspect: "wide" }, { span: 6, aspect: "wide" });
      }
      remaining = 0;
      continue;
    }
    if (remaining === 3) {
      tiles.push(
        { span: 4, aspect: "tall" },
        { span: 4, aspect: "tall" },
        { span: 4, aspect: "tall" }
      );
      remaining = 0;
      continue;
    }
    if (pairToggle % 2 === 0) {
      tiles.push({ span: 8, aspect: "wide" }, { span: 4, aspect: "tall" });
    } else {
      tiles.push({ span: 4, aspect: "tall" }, { span: 8, aspect: "wide" });
    }
    remaining -= 2;
    pairToggle += 1;
  }

  return tiles;
}

/**
 * Lux presentation (canonical id: `lux`).
 * Application imagery leads; slab close-ups sit in a bottom sample rail.
 * Photography stays ungraded — copy uses translucent panels, not full-image scrims.
 */
export default function LuxuryMaterialHouseShowcase({
  profileName,
  product,
  products = [product],
  initialProductSlug,
  initialPhotoIndex = 0,
  data,
  trustFacts: _trustFacts,
  faqItems,
  profileShareDestination,
  platformBaseHref: _platformBaseHref,
  onDirectConnect,
  platformEngagement,
}: Props) {
  const house = data.luxuryHouse;
  if (!house) {
    throw new Error('PremiumProductProfileData.presentation "lux" requires luxuryHouse data');
  }
  const profileSlugFromShare = String(profileShareDestination || "")
    .replace(/^\/u\//, "")
    .split("?")[0]
    .split("#")[0]
    .trim()
    .toLowerCase();

  const initialChapter =
    house.materialChapters.find((chapter) => chapter.slug === initialProductSlug) ||
    house.materialChapters.find((chapter) => chapter.slug === data.featuredProductSlug) ||
    house.materialChapters[0];
  const [selectedMaterialSlug, setSelectedMaterialSlug] = useState(initialChapter.slug);
  const selectedChapter =
    house.materialChapters.find((chapter) => chapter.slug === selectedMaterialSlug) ||
    initialChapter;

  const materialProductFor = (
    slug: string,
    name: string,
    applicationImage: string,
    detailImage: string
  ) =>
    products.find((entry) => entry.slug === slug) || {
      name,
      slug,
      images: [applicationImage, detailImage],
    };

  const lightboxProduct = materialProductFor(
    selectedChapter.slug,
    selectedChapter.name,
    selectedChapter.applicationImage,
    selectedChapter.detailImage
  );

  // Sample rail always shows every material group — toggle does not filter it.
  const sampleGroups = house.materialSamples?.groups || [];

  const selectedShowcaseImages = (() => {
    const productImages = new Set(lightboxProduct.images);
    const filtered = house.showcase.images.filter(
      (image) => productImages.has(image) && /\/applications\//.test(image)
    );
    if (filtered.length > 0) return filtered;
    if (productImages.has(selectedChapter.applicationImage)) {
      return [selectedChapter.applicationImage];
    }
    return house.showcase.images.filter((image) => image === selectedChapter.applicationImage);
  })();

  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const deepLinkAppliedRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const selectMaterial = (slug: string, options?: { scrollToChapter?: boolean }) => {
    const chapter = house.materialChapters.find((entry) => entry.slug === slug);
    if (!chapter) return;
    setSelectedMaterialSlug(chapter.slug);
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("stone", chapter.slug);
      const nextState = {
        ...(typeof window.history.state === "object" && window.history.state
          ? window.history.state
          : {}),
        luxMaterialId: chapter.slug,
        luxMaterialName: chapter.name,
      };
      window.history.replaceState(nextState, "", `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(
        new CustomEvent("tradescout:lux-material-change", {
          detail: { itemId: chapter.slug, itemName: chapter.name, profile: profileName },
        })
      );
      if (profileSlugFromShare) {
        seedFromProfileMaterial({
          profileSlug: profileSlugFromShare,
          profileName,
          itemId: chapter.slug,
          itemName: chapter.name,
          source: "lux_material_toggle",
        });
      }
    } catch {
      /* ignore URL sync failures in non-browser test shells */
    }
    if (options?.scrollToChapter) {
      window.requestAnimationFrame(() => {
        document
          .getElementById("material-chapters")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  useEffect(() => {
    if (!initialProductSlug) return;
    const match = house.materialChapters.find((chapter) => chapter.slug === initialProductSlug);
    if (match) setSelectedMaterialSlug(match.slug);
  }, [house.materialChapters, initialProductSlug]);

  // Restore exact stone + photo deep links (?stone=&photo=) via lightbox + chapter focus.
  useEffect(() => {
    if (!initialProductSlug || deepLinkAppliedRef.current) return;
    const chapter = house.materialChapters.find((entry) => entry.slug === initialProductSlug);
    if (!chapter) return;
    const linked = materialProductFor(
      chapter.slug,
      chapter.name,
      chapter.applicationImage,
      chapter.detailImage
    );
    if (!linked.images.length) return;
    const clamped = Math.min(Math.max(0, initialPhotoIndex), linked.images.length - 1);
    deepLinkAppliedRef.current = true;
    setSelectedMaterialSlug(linked.slug);
    setActivePhoto(clamped);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`chapter-${linked.slug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document
        .getElementById(`luxury-house-photo-${linked.slug}-0`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [house.materialChapters, initialPhotoIndex, initialProductSlug, products]);

  useEffect(() => {
    if (activePhoto === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const imageCount = lightboxProduct.images.length;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhoto(null);
      if (imageCount <= 1) return;
      if (event.key === "ArrowLeft") {
        setActivePhoto((current) =>
          current === null ? null : (current - 1 + imageCount) % imageCount
        );
      }
      if (event.key === "ArrowRight") {
        setActivePhoto((current) => (current === null ? null : (current + 1) % imageCount));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activePhoto, lightboxProduct.images.length]);

  const connectMaterial = (slug: string, name: string) =>
    onDirectConnect({ itemId: slug, itemName: name });

  const startConsultation = () => connectMaterial(selectedChapter.slug, selectedChapter.name);

  const lightboxImages = lightboxProduct.images;
  const lightboxName = lightboxProduct.name;
  const lightboxSlug = lightboxProduct.slug;
  const photoIndex = activePhoto ?? 0;

  const chapterImages = lightboxProduct.images.length
    ? lightboxProduct.images
    : [selectedChapter.applicationImage, selectedChapter.detailImage];
  const chapterHeadline = selectedChapter.title || selectedChapter.name;

  return (
    <div
      data-testid="luxury-material-house-showcase"
      data-selected-material={selectedChapter.slug}
      data-selected-material-name={selectedChapter.name}
      className="overflow-hidden bg-[#070605] text-[#f4efe6]"
    >
      {/* 1. Backlighting story — body paragraph only on translucent panel */}
      <section
        id="designed-with-light"
        data-testid="luxury-house-designed-with-light"
        className="relative isolate min-h-[70svh] scroll-mt-24 overflow-hidden"
      >
        <SafeProfileImg
          src={house.designedWithLight.image}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="relative z-10 mx-auto flex min-h-[70svh] max-w-7xl items-end px-4 py-10 sm:px-8 sm:py-14">
          <div className="max-w-2xl bg-black/45 p-5 backdrop-blur-sm sm:p-7">
            <p className="max-w-xl text-sm font-light leading-7 text-white/90 sm:text-base sm:leading-8">
              {house.designedWithLight.body}
            </p>
          </div>
        </div>
      </section>

      {/* Material dataset toggle — switches chapter, showcase, samples, DC context */}
      {house.materialChapters.length > 1 ? (
        <div
          className="sticky top-0 z-40 border-b border-white/10 bg-[#0c0a08]/95 backdrop-blur-md"
          data-testid="luxury-house-material-toggle"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
              Material
            </p>
            <div
              className="flex w-full flex-wrap gap-1 border border-white/15 p-1 sm:w-auto"
              role="tablist"
              aria-label="Select material dataset"
            >
              {house.materialChapters.map((chapter) => (
                <button
                  key={chapter.slug}
                  type="button"
                  role="tab"
                  aria-selected={chapter.slug === selectedMaterialSlug}
                  data-testid={`luxury-house-material-tab-${chapter.slug}`}
                  onClick={() => selectMaterial(chapter.slug)}
                  className={`min-h-11 flex-1 px-5 text-[10px] font-semibold uppercase tracking-[0.22em] transition sm:flex-none ${
                    chapter.slug === selectedMaterialSlug
                      ? "bg-[var(--brand-accent,#d9a441)] text-[var(--brand-primary-dark,#17100b)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {chapter.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Selected material chapter only */}
      <section
        id="material-chapters"
        data-testid="luxury-house-material-chapters"
        className="scroll-mt-24 bg-[#0c0a08] px-4 py-10 sm:px-8 sm:py-14"
      >
        <div className="mx-auto max-w-7xl">
          <article
            id={`chapter-${selectedChapter.slug}`}
            data-testid={`luxury-house-chapter-${selectedChapter.slug}`}
            data-material-slug={selectedChapter.slug}
            className="grid gap-6 lg:grid-cols-12 lg:gap-8"
          >
            <div className="lg:col-span-7">
              <div className="overflow-hidden">
                <button
                  type="button"
                  id={`luxury-house-photo-${selectedChapter.slug}-0`}
                  data-testid={`luxury-house-photo-${selectedChapter.slug}-0`}
                  data-photo-index="0"
                  onClick={() => setActivePhoto(0)}
                  className="block w-full text-left"
                  aria-label={`Open ${selectedChapter.name} application image`}
                >
                  <SafeProfileImg
                    key={selectedChapter.applicationImage}
                    src={selectedChapter.applicationImage}
                    fallbackSrcs={chapterImages.slice(1)}
                    alt={`${selectedChapter.name} installed interior`}
                    loading="eager"
                    className="aspect-[4/3] h-full w-full object-cover transition duration-[1200ms] ease-out hover:scale-[1.015] motion-reduce:transition-none"
                  />
                </button>
              </div>
            </div>
            <div className="flex flex-col justify-center lg:col-span-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
                {selectedChapter.eyebrow}
              </p>
              <h3 className="mt-3 font-editorial text-3xl font-medium leading-[1.02] tracking-[-0.02em] sm:text-4xl md:text-5xl">
                {chapterHeadline}
              </h3>
              <p className="mt-4 text-sm font-light leading-7 text-[#b7aa98] sm:text-base">
                {selectedChapter.body}
              </p>
              <button
                type="button"
                onClick={() => connectMaterial(selectedChapter.slug, selectedChapter.name)}
                aria-label={`Direct Connect about ${selectedChapter.name}`}
                className="mt-6 inline-flex min-h-12 w-fit items-center justify-center gap-2 border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] px-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#17100b] transition hover:bg-[var(--brand-accent,#d9a441)]/90"
              >
                Discuss {selectedChapter.name}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* 3. Capabilities — clean list, Designed-with-light typography */}
      <section
        id="capabilities"
        data-testid="luxury-house-capabilities"
        className="scroll-mt-24 bg-[#0c0a08] px-4 py-10 sm:px-8 sm:py-14"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 max-w-3xl sm:mb-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.capabilities.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              {house.capabilities.title}
            </h2>
            {house.capabilities.body ? (
              <p className="mt-3 max-w-2xl text-sm font-light leading-7 text-[#b7aa98] sm:text-base sm:leading-8">
                {house.capabilities.body}
              </p>
            ) : null}
          </div>
          <ul className="max-w-xl space-y-2 border-t border-white/10 pt-4">
            {house.capabilities.items.map((item) => (
              <li
                key={item.title}
                className="border-b border-white/10 py-2.5 text-sm font-light tracking-wide text-[#f4efe6]/90 sm:text-base"
              >
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Installed work — photographs lead, no overlays */}
      <section
        id="showcase"
        data-testid="luxury-house-showcase"
        className="scroll-mt-24 bg-[#070605] px-4 py-10 sm:px-8 sm:py-14"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 max-w-3xl sm:mb-9">
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.showcase.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              {house.showcase.title}
            </h2>
            {house.showcase.body ? (
              <p className="mt-3 max-w-2xl text-sm font-light leading-7 text-[#b7aa98] sm:text-base">
                {house.showcase.body}
              </p>
            ) : null}
          </div>
          <div
            className="grid grid-cols-2 items-start gap-2.5 sm:gap-4 lg:grid-cols-12"
            data-testid="luxury-house-showcase-grid"
            data-material-slug={selectedChapter.slug}
            data-collage-count={String(selectedShowcaseImages.length)}
          >
            {(() => {
              const collage = buildShowcaseCollageLayout(selectedShowcaseImages.length);
              return selectedShowcaseImages.map((image, index) => {
                const tile = collage[index] || { span: 12 as const, aspect: "wide" as const };
                const wide = tile.aspect === "wide";
                const lgSpanClass =
                  tile.span === 12
                    ? "lg:col-span-12"
                    : tile.span === 8
                      ? "lg:col-span-8"
                      : tile.span === 6
                        ? "lg:col-span-6"
                        : "lg:col-span-4";
                return (
                  <figure
                    key={`${selectedChapter.slug}-${image}`}
                    data-collage-span={String(tile.span)}
                    className={`overflow-hidden bg-[#120f0c] ${
                      wide || tile.span >= 8 ? "col-span-2" : "col-span-1"
                    } ${lgSpanClass} ${index % 3 === 1 && tile.span <= 6 ? "lg:mt-8" : ""}`}
                  >
                    <SafeProfileImg
                      src={image}
                      alt={`${selectedChapter.name} installed project ${index + 1}`}
                      loading={index < 2 ? "eager" : "lazy"}
                      className={`w-full object-cover transition duration-[1100ms] ease-out hover:scale-[1.02] motion-reduce:transition-none ${
                        wide ? "aspect-[16/10]" : "aspect-[4/5]"
                      }`}
                    />
                  </figure>
                );
              });
            })()}
          </div>
        </div>
      </section>

      {platformEngagement ? (
        <section
          className="border-y border-white/10 bg-[#070605] py-5"
          aria-label="Trust and profile actions"
          data-testid="luxury-house-platform-engagement"
        >
          {platformEngagement}
        </section>
      ) : null}

      {/* 5. Material samples — always both materials (toggle does not filter this rail) */}
      {house.materialSamples && sampleGroups.length > 0 ? (
        <section
          id="material-samples"
          data-testid="luxury-house-material-samples"
          className="scroll-mt-24 bg-[#0c0a08] px-4 py-10 sm:px-8 sm:py-14"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 max-w-3xl sm:mb-7">
              <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
                {house.materialSamples.eyebrow}
              </p>
              <h2 className="mt-3 font-editorial text-3xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-4xl">
                {house.materialSamples.title}
              </h2>
            </div>
            <div className="space-y-8 sm:space-y-10">
              {sampleGroups.map((group) => {
                const chapter = house.materialChapters.find((entry) => entry.slug === group.slug);
                const groupProduct = materialProductFor(
                  group.slug,
                  group.name,
                  chapter?.applicationImage || group.images[0] || "",
                  chapter?.detailImage || group.images[0] || ""
                );
                const openSample = (image: string) => {
                  selectMaterial(group.slug);
                  const photoIdx = Math.max(0, groupProduct.images.indexOf(image));
                  setActivePhoto(photoIdx >= 0 ? photoIdx : 0);
                };
                return (
                  <div
                    key={group.slug}
                    data-testid={`luxury-house-sample-group-${group.slug}`}
                    data-material-slug={group.slug}
                  >
                    <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.28em] text-white/55">
                      {group.name}
                    </p>
                    {group.images.length <= 2 ? (
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {group.images.map((image, index) => (
                          <button
                            key={image}
                            type="button"
                            onClick={() => openSample(image)}
                            className="relative w-full overflow-hidden bg-[#120f0c] text-left"
                            aria-label={`Open ${group.name} sample ${index + 1}`}
                          >
                            <SafeProfileImg
                              src={image}
                              alt={`${group.name} material sample ${index + 1}`}
                              loading="lazy"
                              className="aspect-[4/5] w-full object-cover sm:aspect-[5/6]"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:gap-3.5 sm:px-0">
                        {group.images.map((image, index) => (
                          <button
                            key={image}
                            type="button"
                            onClick={() => openSample(image)}
                            className="relative w-[12rem] flex-none overflow-hidden bg-[#120f0c] text-left sm:w-56"
                            aria-label={`Open ${group.name} sample ${index + 1}`}
                          >
                            <SafeProfileImg
                              src={image}
                              alt={`${group.name} material sample ${index + 1}`}
                              loading="lazy"
                              className="aspect-[4/5] w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* 6. Consultation — single final action (no duplicate closing / trust strip) */}
      <section
        id="consult"
        data-testid="luxury-house-consultation"
        className="scroll-mt-24 bg-[#f7f0e4] px-4 py-10 text-[#17100b] sm:px-8 sm:py-14"
      >
        <div className="mx-auto max-w-3xl">
          {house.consultation.eyebrow ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.consultation.eyebrow}
            </p>
          ) : null}
          <h2
            className={`${house.consultation.eyebrow ? "mt-3" : ""} font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl`}
          >
            {house.consultation.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm font-light leading-7 text-[#5c5348] sm:text-base sm:leading-8">
            {house.consultation.body}
          </p>

          <p
            className="mt-5 text-[10px] font-medium uppercase tracking-[0.28em] text-[#342316]/55"
            data-testid="luxury-house-consult-material"
          >
            {selectedChapter.name}
          </p>

          <button
            type="button"
            onClick={startConsultation}
            aria-label={`Direct Connect about ${selectedChapter.name}`}
            className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] px-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#17100b] transition hover:bg-[var(--brand-accent,#d9a441)]/90"
          >
            <MessageCircle className="h-4 w-4" />
            Discuss your project
            <ChevronRight className="h-4 w-4" />
          </button>
          {house.consultation.note ? (
            <p className="mt-4 max-w-xl text-xs leading-5 text-[#5c5348]">
              {house.consultation.note}
            </p>
          ) : null}
        </div>
      </section>

      {faqItems.length > 0 ? (
        <section className="bg-[#0c0a08] px-4 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-editorial text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
              Before the conversation
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
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

      {activePhoto !== null && lightboxImages[photoIndex] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxName} photo gallery`}
          data-testid="luxury-house-deep-link-lightbox"
          data-stone-slug={lightboxSlug}
          data-photo-index={String(photoIndex)}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/96 p-2 sm:p-6"
          onMouseDown={(event) => event.target === event.currentTarget && setActivePhoto(null)}
        >
          <div className="flex max-h-[96svh] w-full max-w-7xl flex-col overflow-hidden border border-white/10 bg-[#070605]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#efd393]">
                  {lightboxName} · {String(photoIndex + 1).padStart(2, "0")} /{" "}
                  {String(lightboxImages.length).padStart(2, "0")}
                </p>
                <h3 className="mt-1 font-editorial text-2xl font-medium">{lightboxName}</h3>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setActivePhoto(null)}
                className="h-11 w-11 border border-white/15"
                aria-label="Close expanded gallery"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              <SafeProfileImg
                src={lightboxImages[photoIndex]}
                fallbackSrcs={lightboxImages}
                alt={`${lightboxName}: view ${photoIndex + 1}`}
                data-testid="luxury-house-deep-link-image"
                data-photo-index={String(photoIndex)}
                className="max-h-[74svh] w-full object-contain"
              />
              {lightboxImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhoto((current) =>
                        current === null
                          ? null
                          : (current - 1 + lightboxImages.length) % lightboxImages.length
                      )
                    }
                    className="absolute left-2 h-12 w-12 border border-white/15 bg-black/55"
                    aria-label="Previous expanded image"
                  >
                    <ChevronLeft className="mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhoto((current) =>
                        current === null ? null : (current + 1) % lightboxImages.length
                      )
                    }
                    className="absolute right-2 h-12 w-12 border border-white/15 bg-black/55"
                    aria-label="Next expanded image"
                  >
                    <ChevronRight className="mx-auto" />
                  </button>
                </>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 sm:px-6">
              <p className="text-xs font-light text-white/65">
                Shared image for {lightboxSlug}. Use the arrow keys to continue.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivePhoto(null);
                  connectMaterial(lightboxSlug, lightboxName);
                }}
                className="inline-flex min-h-11 flex-none items-center justify-center border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#17100b]"
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
