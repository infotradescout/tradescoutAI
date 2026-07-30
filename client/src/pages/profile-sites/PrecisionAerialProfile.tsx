import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ExternalLink,
  Instagram,
  MapPin,
  Play,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { THEMES } from "@/lib/themes";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import { buildProfilePublicItemPath } from "@shared/profilePublicItemRoute";
import type { ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";

type ContentBlock = {
  type?: unknown;
  data?: unknown;
};

type BrandColors = {
  primary?: unknown;
  primaryDark?: unknown;
  background?: unknown;
  surface?: unknown;
};

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  businessName: string;
  headline?: string | null;
  contentBlocks: unknown;
  brandColors?: BrandColors | null;
  services: string[];
  serviceAreas: string[];
  aboutText?: string | null;
  galleryItems: ResolvedProfileGalleryItem[];
  sharedGallerySlug?: string | null;
  profileShareDestination: string;
  profileShareImage?: string;
  onDirectConnect: (serviceName?: string) => void;
  deliveryCustody?: "business" | "tradescout_pending_owner";
  trustActions: ReactNode;
  profileItems?: ReactNode;
};

type HeroData = {
  imageUrl: string;
  logoUrl: string;
  operatorName: string;
  locationLabel: string;
  featuredWorkUrl: string;
  instagramUrl: string;
  instagramHandle: string;
  tiktokUrl: string;
  tiktokHandle: string;
  title: string;
  text: string;
};

function readString(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === "string" ? String(record[key]).trim() : "";
}

function readHeroData(contentBlocks: unknown): HeroData {
  const blocks = Array.isArray(contentBlocks) ? (contentBlocks as ContentBlock[]) : [];
  const block = blocks.find((entry) => entry?.type === "hero");
  const data =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data)
      ? (block.data as Record<string, unknown>)
      : {};

  return {
    imageUrl: readString(data, "imageUrl") || readString(data, "heroImageUrl"),
    logoUrl: readString(data, "logoUrl"),
    operatorName: readString(data, "operatorName"),
    locationLabel: readString(data, "locationLabel"),
    featuredWorkUrl: readString(data, "featuredWorkUrl"),
    instagramUrl: readString(data, "instagramUrl"),
    instagramHandle: readString(data, "instagramHandle"),
    tiktokUrl: readString(data, "tiktokUrl"),
    tiktokHandle: readString(data, "tiktokHandle"),
    title: readString(data, "title"),
    text: readString(data, "text") || readString(data, "body"),
  };
}

function safeSocialUrl(value: string, hosts: string[]): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return "";
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function safeFeaturedWorkUrl(value: string): string {
  return safeSocialUrl(value, [
    "instagram.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "vimeo.com",
  ]);
}

function normalizedHex(value: unknown, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function replaceOperatorWithBusiness(
  value: string | null | undefined,
  operatorName: string,
  businessName: string
): string {
  const copy = String(value || "").trim();
  if (!copy || !operatorName) return copy;
  const escapedName = operatorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return copy.replace(new RegExp(`\\b${escapedName}\\b`, "gi"), businessName);
}

function describeService(service: string): string {
  const normalized = service.toLowerCase();
  if (normalized.includes("real estate")) {
    return "Show the property, its setting, and its scale through aerial stills and motion.";
  }
  if (normalized.includes("construction")) {
    return "Create a clear visual record as a site and its work change over time.";
  }
  if (normalized.includes("roof") || normalized.includes("property imagery")) {
    return "Capture elevated property views that are difficult to document from the ground.";
  }
  if (normalized.includes("land") || normalized.includes("farm")) {
    return "Reveal layout, surroundings, and the full footprint in a single perspective.";
  }
  if (
    normalized.includes("boat") ||
    normalized.includes("vehicle") ||
    normalized.includes("event")
  ) {
    return "Add movement, environment, and an aerial point of view to the story.";
  }
  return "Add this capability to a private brief with the location, timing, and outcome you need.";
}

export default function PrecisionAerialProfile({
  profileSlug,
  platformBaseHref = "",
  businessName,
  headline,
  contentBlocks,
  brandColors,
  services,
  serviceAreas,
  aboutText,
  galleryItems,
  sharedGallerySlug = null,
  profileShareDestination,
  profileShareImage,
  onDirectConnect,
  trustActions,
  profileItems,
}: Props) {
  const hero = useMemo(() => readHeroData(contentBlocks), [contentBlocks]);
  const featuredItem =
    galleryItems.find((item) => item.slug === sharedGallerySlug) || galleryItems[0] || null;
  const heroImage = hero.imageUrl || featuredItem?.imageUrl || "";
  const heroFallbacks = galleryItems
    .map((item) => item.imageUrl)
    .filter((value) => value && value !== heroImage);
  const locationLabel = hero.locationLabel || serviceAreas[0] || "";
  const featuredWorkUrl = safeFeaturedWorkUrl(hero.featuredWorkUrl);
  const instagramUrl = safeSocialUrl(hero.instagramUrl, ["instagram.com"]);
  const tiktokUrl = safeSocialUrl(hero.tiktokUrl, ["tiktok.com"]);
  const companyAbout = replaceOperatorWithBusiness(aboutText, hero.operatorName, businessName);
  const [selectedService, setSelectedService] = useState(() => services[0] || "");
  const [activeItem, setActiveItem] = useState<ResolvedProfileGalleryItem | null>(
    sharedGallerySlug ? galleryItems.find((item) => item.slug === sharedGallerySlug) || null : null
  );

  useEffect(() => {
    if (services.length === 0) {
      setSelectedService("");
      return;
    }
    if (!selectedService || !services.includes(selectedService)) {
      setSelectedService(services[0]);
    }
  }, [selectedService, services]);

  useEffect(() => {
    if (!sharedGallerySlug) return;
    const shared = galleryItems.find((item) => item.slug === sharedGallerySlug);
    if (shared) setActiveItem(shared);
  }, [galleryItems, sharedGallerySlug]);

  useEffect(() => {
    if (!activeItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveItem(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeItem]);

  const galleryHref = (item: ResolvedProfileGalleryItem) =>
    buildProfilePublicItemPath({
      profileBasePath: profileShareDestination,
      itemType: "gallery",
      itemSlug: item.slug,
      contentBlocks,
    }) || profileShareDestination;

  const openProject = (serviceName?: string) => {
    const context = String(serviceName || selectedService || "")
      .trim()
      .slice(0, 180);
    onDirectConnect(context || undefined);
  };

  const themeStyle = {
    "--precision-primary": normalizedHex(brandColors?.primary, THEMES.midnight["--ts-accent"]),
    "--precision-primary-dark": normalizedHex(
      brandColors?.primaryDark,
      THEMES.midnight["--ts-accent-strong"]
    ),
    "--precision-brand": normalizedHex(brandColors?.background, THEMES.midnight["--ts-bg"]),
    "--precision-brand-surface": normalizedHex(
      brandColors?.surface,
      THEMES.midnight["--ts-surface"]
    ),
  } as CSSProperties;

  return (
    <div
      className="min-h-full bg-stone-100 text-slate-950"
      style={themeStyle}
      data-testid="precision-aerial-profile"
    >
      <header
        className="absolute inset-x-0 top-0 z-30 text-white"
        data-testid="precision-aerial-header"
      >
        <div className="mx-auto flex min-h-20 w-full max-w-[1600px] items-center gap-3 px-5 py-3 sm:px-8 lg:px-12">
          <a
            href={profileShareDestination}
            className="flex min-w-0 items-center gap-3"
            aria-label={`${businessName} home`}
          >
            {hero.logoUrl ? (
              <SafeProfileImg
                src={hero.logoUrl}
                alt={`${businessName} logo`}
                className="h-11 w-11 shrink-0 rounded-full border border-white/30 object-cover shadow-xl sm:h-12 sm:w-12"
              />
            ) : null}
            <span className="min-w-0">
              <strong className="block truncate text-sm font-black tracking-[-0.025em] drop-shadow-md sm:text-base">
                {businessName}
              </strong>
              {locationLabel ? (
                <small className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[0.18em] text-white/70 sm:text-[10px]">
                  {locationLabel}
                </small>
              ) : null}
            </span>
          </a>

          <nav
            className="ml-auto hidden items-center gap-7 text-[11px] font-black uppercase tracking-[0.16em] text-white/80 md:flex"
            aria-label={`${businessName} page sections`}
          >
            <a href="#work" className="transition hover:text-white">
              Portfolio
            </a>
            <a href="#services" className="transition hover:text-white">
              Services
            </a>
            <a href="#about" className="transition hover:text-white">
              About
            </a>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-7">
            <ShareButton
              destination={profileShareDestination}
              title={businessName}
              text={`See ${businessName} on TradeScout`}
              imageUrl={profileShareImage || heroImage}
              label="Share"
              className="hidden min-h-10 rounded-full border-white/30 bg-black/20 px-4 text-white backdrop-blur-sm sm:inline-flex"
            />
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-slate-950 shadow-lg transition hover:bg-white/90 sm:px-5 sm:text-sm"
              data-testid="precision-primary-direct-connect"
            >
              <span className="sm:hidden">Book</span>
              <span className="hidden sm:inline">Book a shoot</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="relative min-h-[78svh] overflow-hidden bg-[var(--precision-brand)] text-white sm:min-h-[86svh]"
          data-testid="precision-aerial-hero"
        >
          {heroImage ? (
            <SafeProfileImg
              src={heroImage}
              fallbackSrcs={heroFallbacks}
              alt={`${businessName} aerial photography`}
              className="absolute inset-0 h-full w-full object-cover object-center"
              loading="eager"
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--precision-brand-surface)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/5 to-black/80" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[1600px] px-5 pb-9 sm:px-8 sm:pb-14 lg:px-12 lg:pb-16">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/75 sm:text-xs">
              {[headline || "Aerial photography + film", locationLabel].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="max-w-5xl text-[3.7rem] font-black leading-[0.86] tracking-[-0.075em] drop-shadow-xl sm:text-[6.8rem] lg:text-[8.5rem]">
                  {hero.title || "A better view."}
                </h1>
                <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/85 sm:text-xl sm:leading-8">
                  Aerial photography and film for property, construction, land, events, and motion.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:pb-2">
                <a
                  href="#work"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-slate-950 shadow-lg transition hover:bg-white/90"
                >
                  View portfolio
                  <ArrowRight className="h-4 w-4" />
                </a>
                {featuredWorkUrl ? (
                  <a
                    href={featuredWorkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 bg-black/20 px-5 text-sm font-black text-white backdrop-blur-sm transition hover:bg-black/35"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch reel
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {galleryItems.length > 0 ? (
          <section
            id="work"
            className="scroll-mt-20 bg-neutral-950 text-white"
            data-testid="precision-aerial-work"
          >
            <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-8 sm:py-20 lg:px-12">
              <div className="mb-8 flex items-end justify-between gap-6 sm:mb-11">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50 sm:text-xs">
                    Portfolio
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.055em] sm:text-5xl">
                    Selected work
                  </h2>
                </div>
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 border-b border-white/35 text-xs font-black text-white transition hover:border-white"
                  >
                    <Instagram className="h-4 w-4" />
                    {hero.instagramHandle || "Instagram"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                {galleryItems.map((item, index) => (
                  <button
                    key={item.slug}
                    id={`profile-gallery-${item.slug}`}
                    type="button"
                    onClick={() => setActiveItem(item)}
                    className={`group relative block min-h-[320px] overflow-hidden bg-white/5 text-left sm:min-h-[440px] ${
                      galleryItems.length === 1
                        ? "sm:col-span-2 lg:col-span-12 lg:min-h-[720px]"
                        : index % 5 === 0
                          ? "sm:col-span-2 lg:col-span-8 lg:min-h-[650px]"
                          : index % 5 === 1
                            ? "lg:col-span-4 lg:min-h-[650px]"
                            : "lg:col-span-4 lg:min-h-[460px]"
                    }`}
                    aria-label={`Open ${item.title}`}
                  >
                    <SafeProfileImg
                      src={item.imageUrl}
                      alt={item.imageAlt}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80 transition group-hover:opacity-100" />
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 sm:p-7">
                      <span>
                        <strong className="block text-lg font-black tracking-[-0.03em] sm:text-xl">
                          {item.title}
                        </strong>
                        {item.description ? (
                          <span className="mt-1 block max-w-lg text-sm leading-6 text-white/70">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      <ArrowRight className="h-5 w-5 shrink-0" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {services.length > 0 ? (
          <section
            id="services"
            className="scroll-mt-20 bg-white"
            data-testid="precision-aerial-services"
          >
            <div className="mx-auto grid max-w-[1380px] gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.65fr_1.35fr] lg:gap-24 lg:px-12 lg:py-28">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 sm:text-xs">
                  Services
                </p>
                <h2 className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">
                  Photography with perspective.
                </h2>
                <p className="mt-6 max-w-md text-base leading-7 text-slate-600">
                  Professional aerial imagery shaped around the property, project, or moment you need to show.
                </p>
              </div>

              <div className="border-t border-black/15">
                {services.map((service, index) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => {
                      setSelectedService(service);
                      openProject(service);
                    }}
                    className="group grid w-full gap-3 border-b border-black/15 py-6 text-left sm:grid-cols-[42px_1fr_auto] sm:items-center sm:gap-5 sm:py-8"
                    aria-label={`Book ${service}`}
                    data-testid={`precision-aerial-service-${index}`}
                  >
                    <span className="text-[10px] font-black tracking-[0.18em] text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong className="block text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-2xl">
                        {service}
                      </strong>
                      <span className="mt-1 block max-w-2xl text-sm leading-6 text-slate-500">
                        {describeService(service)}
                      </span>
                    </span>
                    <span className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-black/15 px-4 text-xs font-black text-slate-900 transition group-hover:border-slate-950">
                      Book
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section
          id="about"
          className="scroll-mt-20 border-y border-white/10 bg-[var(--precision-brand)] text-white"
          data-testid="precision-company"
        >
          <div className="mx-auto grid max-w-[1380px] gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.62fr_1.38fr] lg:items-center lg:gap-24 lg:px-12">
            <div className="flex items-center gap-5">
              {hero.logoUrl ? (
                <SafeProfileImg
                  src={hero.logoUrl}
                  alt={`${businessName} logo`}
                  className="h-24 w-24 shrink-0 rounded-full border border-white/20 object-cover shadow-2xl sm:h-32 sm:w-32"
                />
              ) : null}
              <span>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                  About
                </p>
                {locationLabel ? (
                  <p className="mt-3 flex items-center gap-2 text-sm font-bold text-white/75">
                    <MapPin className="h-4 w-4" />
                    {locationLabel}
                  </p>
                ) : null}
              </span>
            </div>

            <div>
              <h2 className="text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">
                {businessName}
              </h2>
              {companyAbout ? (
                <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white/72 sm:text-2xl sm:leading-10">
                  {companyAbout}
                </p>
              ) : (
                <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white/72">
                  Aerial photography and film created with precision, clarity, and respect for the work below.
                </p>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-black text-white"
                  >
                    <Instagram className="h-4 w-4" />
                    {hero.instagramHandle || "Instagram"}
                  </a>
                ) : null}
                {tiktokUrl ? (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-black text-white"
                  >
                    <Play className="h-4 w-4" />
                    {hero.tiktokHandle || "TikTok"}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-stone-100">
          <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:px-8 sm:py-24">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 sm:text-xs">
              Availability
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.06em] text-slate-950 sm:text-6xl">
              Tell us what you need captured.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Share the location, timing, and type of shoot. We’ll take it from there.
            </p>
            <button
              type="button"
              onClick={() => openProject()}
              className="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-ts-orange px-7 text-base font-black text-white transition hover:bg-ts-orange-dark"
              data-testid="precision-project-brief-submit"
            >
              Request availability
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {profileItems}
          <div data-testid="profile-trust-section" aria-label="Trust and profile actions">
            {trustActions}
          </div>
        </section>
      </main>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={businessName}
        platformBaseHref={platformBaseHref}
      />

      {activeItem ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/95 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.title}
          onClick={() => setActiveItem(null)}
        >
          <div
            className="relative max-h-[94vh] w-full max-w-6xl overflow-auto bg-white text-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveItem(null)}
              className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/75 text-white"
              aria-label="Close portfolio image"
            >
              <X className="h-5 w-5" />
            </button>
            <SafeProfileImg
              src={activeItem.imageUrl}
              alt={activeItem.imageAlt}
              className="max-h-[76vh] w-full bg-black object-contain"
            />
            <div className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black">{activeItem.title}</h3>
                {activeItem.description ? (
                  <p className="mt-1 text-sm leading-6 text-slate-500">{activeItem.description}</p>
                ) : null}
              </div>
              <ShareButton
                destination={galleryHref(activeItem)}
                title={`${activeItem.title} | ${businessName}`}
                text={`See ${activeItem.title} from ${businessName}`}
                imageUrl={activeItem.imageUrl}
                variant="outline"
                label="Share this work"
                className="border-black/10 text-slate-900"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
