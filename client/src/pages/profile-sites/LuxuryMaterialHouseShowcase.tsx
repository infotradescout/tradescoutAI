import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Mail, MessageCircle, Phone, X } from "lucide-react";
import { ISSA_BUILD_BUSINESS_NAME } from "@shared/issaBuildProfile";
import { ISSA_BUILD_MANAGED_CONTACT } from "@shared/issaBuildManagedContact";
import type { PremiumProductProfileData } from "@shared/premiumProductProfile";
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
  profileShareDestination: _profileShareDestination,
  platformBaseHref: _platformBaseHref,
  onDirectConnect,
  platformEngagement,
}: Props) {
  const house = data.luxuryHouse;
  if (!house) {
    throw new Error('PremiumProductProfileData.presentation "lux" requires luxuryHouse data');
  }

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

  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const deepLinkAppliedRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sampleGroups = house.materialSamples?.groups || [];
  const managedContact =
    profileName.trim().toLowerCase() === ISSA_BUILD_BUSINESS_NAME.toLowerCase()
      ? ISSA_BUILD_MANAGED_CONTACT
      : null;

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

  return (
    <div
      data-testid="luxury-material-house-showcase"
      className="overflow-hidden bg-[var(--profile-luxury-ink,#070605)] text-[var(--profile-luxury-text,#f4efe6)]"
    >
      {/* 1. Backlighting story — clean photo + translucent copy panel */}
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
            <p className="text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent,#d9a441)]">
              {house.designedWithLight.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-4xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl md:text-6xl">
              {house.designedWithLight.title}
            </h2>
            <p className="mt-4 max-w-xl text-sm font-light leading-7 text-white/90 sm:text-base sm:leading-8">
              {house.designedWithLight.body}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Editorial material chapters — installed application only */}
      <section
        id="material-chapters"
        data-testid="luxury-house-material-chapters"
        className="scroll-mt-24 bg-[var(--profile-luxury-surface,#0c0a08)] px-4 py-10 sm:px-8 sm:py-14"
      >
        <div className="mx-auto max-w-7xl space-y-12 sm:space-y-16">
          {house.materialChapters.map((chapter, chapterIndex) => {
            const chapterProduct = products.find((entry) => entry.slug === chapter.slug) || {
              name: chapter.name,
              slug: chapter.slug,
              images: [chapter.applicationImage, chapter.detailImage],
            };
            const chapterImages = chapterProduct.images.length
              ? chapterProduct.images
              : [chapter.applicationImage, chapter.detailImage];
            const chapterHeadline = chapter.title || chapter.name;

            return (
              <article
                key={chapter.slug}
                id={`chapter-${chapter.slug}`}
                data-testid={`luxury-house-chapter-${chapter.slug}`}
                className="grid gap-6 lg:grid-cols-12 lg:gap-8"
              >
                <div className={`lg:col-span-7 ${chapterIndex % 2 === 1 ? "lg:order-2" : ""}`}>
                  <div className="overflow-hidden">
                    <button
                      type="button"
                      id={`luxury-house-photo-${chapter.slug}-0`}
                      data-testid={`luxury-house-photo-${chapter.slug}-0`}
                      data-photo-index="0"
                      onClick={() => {
                        setSelectedMaterialSlug(chapter.slug);
                        setActivePhoto(0);
                      }}
                      className="block w-full text-left"
                      aria-label={`Open ${chapter.name} application image`}
                    >
                      <SafeProfileImg
                        src={chapter.applicationImage}
                        fallbackSrcs={chapterImages.slice(1)}
                        alt={`${chapter.name} installed interior`}
                        loading={chapterIndex === 0 ? "eager" : "lazy"}
                        className="aspect-[4/3] h-full w-full object-cover transition duration-[1200ms] ease-out hover:scale-[1.015] motion-reduce:transition-none"
                      />
                    </button>
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
                    {chapterHeadline}
                  </h3>
                  <p className="mt-4 text-sm font-light leading-7 text-[var(--profile-luxury-muted,#b7aa98)] sm:text-base">
                    {chapter.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMaterialSlug(chapter.slug);
                      connectMaterial(chapter.slug, chapter.name);
                    }}
                    aria-label={`Direct Connect about ${chapter.name}`}
                    className="mt-6 inline-flex min-h-12 w-fit items-center justify-center gap-2 border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] px-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--profile-luxury-dark,#17100b)] transition hover:bg-[var(--brand-accent,#d9a441)]/90"
                  >
                    Discuss {chapter.name}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Capabilities — clean list, Designed-with-light typography */}
      <section
        id="capabilities"
        data-testid="luxury-house-capabilities"
        className="scroll-mt-24 bg-[var(--profile-luxury-surface,#0c0a08)] px-4 py-10 sm:px-8 sm:py-14"
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
              <p className="mt-3 max-w-2xl text-sm font-light leading-7 text-[var(--profile-luxury-muted,#b7aa98)] sm:text-base sm:leading-8">
                {house.capabilities.body}
              </p>
            ) : null}
          </div>
          <ul className="max-w-xl space-y-2 border-t border-white/10 pt-4">
            {house.capabilities.items.map((item) => (
              <li
                key={item.title}
                className="border-b border-white/10 py-2.5 text-sm font-light tracking-wide text-[var(--profile-luxury-text,#f4efe6)]/90 sm:text-base"
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
        className="scroll-mt-24 bg-[var(--profile-luxury-ink,#070605)] px-4 py-10 sm:px-8 sm:py-14"
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
              <p className="mt-3 max-w-2xl text-sm font-light leading-7 text-[var(--profile-luxury-muted,#b7aa98)] sm:text-base">
                {house.showcase.body}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-4 lg:grid-cols-12">
            {house.showcase.images.map((image, index) => {
              const wide = index % 5 === 0 || index % 5 === 3;
              return (
                <figure
                  key={image}
                  className={`overflow-hidden bg-[var(--profile-luxury-card,#120f0c)] ${
                    wide ? "col-span-2 lg:col-span-8" : "col-span-1 lg:col-span-4"
                  } ${index % 3 === 1 ? "lg:mt-8" : ""}`}
                >
                  <SafeProfileImg
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

      {platformEngagement ? (
        <section
          className="border-y border-white/10 bg-[var(--profile-luxury-surface,#0c0a08)] py-4"
          aria-label="Trust and profile actions"
          data-testid="luxury-house-platform-engagement"
        >
          {platformEngagement}
        </section>
      ) : null}

      {/* 5. Material samples — slab / close-up rail only */}
      {house.materialSamples && sampleGroups.length > 0 ? (
        <section
          id="material-samples"
          data-testid="luxury-house-material-samples"
          className="scroll-mt-24 bg-[var(--profile-luxury-surface,#0c0a08)] px-4 py-10 sm:px-8 sm:py-14"
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
            <div className="space-y-7">
              {sampleGroups.map((group) => (
                <div key={group.slug} data-testid={`luxury-house-sample-group-${group.slug}`}>
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.28em] text-white/55">
                    {group.name}
                  </p>
                  <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:px-0">
                    {group.images.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        onClick={() => {
                          setSelectedMaterialSlug(group.slug);
                          const linked = materialProductFor(
                            group.slug,
                            group.name,
                            house.materialChapters.find((c) => c.slug === group.slug)
                              ?.applicationImage || image,
                            house.materialChapters.find((c) => c.slug === group.slug)
                              ?.detailImage || image
                          );
                          const photoIdx = Math.max(0, linked.images.indexOf(image));
                          setActivePhoto(photoIdx >= 0 ? photoIdx : 0);
                        }}
                        className="relative w-[9.5rem] flex-none overflow-hidden bg-[var(--profile-luxury-card,#120f0c)] text-left sm:w-44"
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
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 6. Consultation — single final action (no duplicate closing / trust strip) */}
      <section
        id="consult"
        data-testid="luxury-house-consultation"
        className="scroll-mt-24 bg-[var(--profile-luxury-light,#f7f0e4)] px-4 py-10 text-[var(--profile-luxury-dark,#17100b)] sm:px-8 sm:py-14"
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
          <p className="mt-3 max-w-xl text-sm font-light leading-7 text-[var(--profile-luxury-light-muted,#5c5348)] sm:text-base sm:leading-8">
            {house.consultation.body}
          </p>

          {house.materialChapters.length > 1 ? (
            <div
              className="mt-6 flex w-fit flex-wrap gap-1 border border-[var(--profile-luxury-light-ink,#342316)]/20 p-1"
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
                      : "text-[var(--profile-luxury-light-ink,#342316)]/70 hover:text-[var(--profile-luxury-light-ink,#342316)]"
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
            aria-label={`Direct Connect about ${selectedChapter.name}`}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] px-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--profile-luxury-dark,#17100b)] transition hover:bg-[var(--brand-accent,#d9a441)]/90"
          >
            <MessageCircle className="h-4 w-4" />
            Discuss your project
            <ChevronRight className="h-4 w-4" />
          </button>
          {house.consultation.note ? (
            <p className="mt-4 max-w-xl text-xs leading-5 text-[var(--profile-luxury-light-muted,#5c5348)]">
              {house.consultation.note}
            </p>
          ) : null}

          {managedContact ? (
            <aside
              className="mt-8 border-t border-[var(--profile-luxury-light-ink,#342316)]/20 pt-6"
              data-testid="issa-build-managed-contact"
              aria-label={managedContact.label}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-accent,#d9a441)]">
                {managedContact.label}
              </p>
              <h3 className="mt-2 font-editorial text-2xl font-medium">
                {managedContact.heading}
              </h3>
              <p className="mt-2 max-w-xl text-sm font-light leading-6 text-[var(--profile-luxury-light-muted,#5c5348)]">
                {managedContact.description}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <a
                  href={`tel:${managedContact.tel}`}
                  className="inline-flex min-h-12 items-center gap-3 border border-[var(--profile-luxury-light-ink,#342316)]/20 px-4 text-sm font-medium transition hover:border-[var(--brand-accent,#d9a441)]"
                >
                  <Phone className="h-4 w-4 text-[var(--brand-accent,#d9a441)]" />
                  {managedContact.phone}
                </a>
                <a
                  href={`mailto:${managedContact.email}`}
                  className="inline-flex min-h-12 items-center gap-3 border border-[var(--profile-luxury-light-ink,#342316)]/20 px-4 text-sm font-medium transition hover:border-[var(--brand-accent,#d9a441)]"
                >
                  <Mail className="h-4 w-4 text-[var(--brand-accent,#d9a441)]" />
                  {managedContact.email}
                </a>
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      {faqItems.length > 0 ? (
        <section className="bg-[var(--profile-luxury-surface,#0c0a08)] px-4 py-10 sm:px-8 sm:py-14">
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
                    <p className="mt-3 text-sm font-light leading-7 text-[var(--profile-luxury-muted,#b7aa98)]">
                      {faq.answer}
                    </p>
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
          <div className="flex max-h-[96svh] w-full max-w-7xl flex-col overflow-hidden border border-white/10 bg-[var(--profile-luxury-ink,#070605)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--profile-luxury-gold-text,#efd393)]">
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
                className="inline-flex min-h-11 flex-none items-center justify-center border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--profile-luxury-dark,#17100b)]"
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
