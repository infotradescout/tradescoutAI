import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, ExternalLink, Instagram, MapPin, MessageCircle, Play, X } from "lucide-react";
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
  deliveryCustody = "business",
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
  const workItems = galleryItems.filter((item) => item.imageUrl !== heroImage);
  const visibleWorkItems = workItems.length > 0 ? workItems : galleryItems;
  const locationLabel = hero.locationLabel || serviceAreas[0] || "";
  const featuredWorkUrl = safeFeaturedWorkUrl(hero.featuredWorkUrl);
  const instagramUrl = safeSocialUrl(hero.instagramUrl, ["instagram.com"]);
  const tiktokUrl = safeSocialUrl(hero.tiktokUrl, ["tiktok.com"]);
  const [activeItem, setActiveItem] = useState<ResolvedProfileGalleryItem | null>(
    sharedGallerySlug ? galleryItems.find((item) => item.slug === sharedGallerySlug) || null : null
  );

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
      className="min-h-full bg-slate-100 text-slate-900"
      style={themeStyle}
      data-testid="precision-aerial-profile"
    >
      <header
        className="relative z-30 border-b border-black/10 bg-white"
        data-testid="precision-aerial-header"
      >
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-3 py-2 sm:min-h-20 sm:px-6 lg:px-8">
          <a
            href={profileShareDestination}
            className="flex min-w-0 items-center gap-2.5 sm:gap-3"
            aria-label={`${businessName} home`}
          >
            {hero.logoUrl ? (
              <SafeProfileImg
                src={hero.logoUrl}
                alt={`${businessName} logo`}
                className="h-11 w-11 shrink-0 rounded-full border border-black/10 object-cover shadow-sm sm:h-14 sm:w-14"
              />
            ) : null}
            <span className="min-w-0">
              <strong className="block truncate text-xs font-black tracking-[-0.02em] sm:text-base">
                {businessName}
              </strong>
              <small className="mt-1 hidden truncate text-xs text-slate-500 sm:block">
                {[hero.operatorName, locationLabel].filter(Boolean).join(" · ")}
              </small>
            </span>
          </a>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ShareButton
              destination={profileShareDestination}
              title={businessName}
              text={`See ${businessName} on TradeScout`}
              imageUrl={profileShareImage || heroImage}
              label="Share"
              className="hidden min-h-10 rounded-full border-black/10 bg-white px-4 text-slate-900 sm:inline-flex"
            />
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ts-orange px-3.5 text-xs font-black text-white shadow-sm transition hover:bg-ts-orange-dark sm:min-h-11 sm:px-5 sm:text-sm"
              data-testid="precision-primary-direct-connect"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="sm:hidden">Connect</span>
              <span className="hidden sm:inline">Direct Connect</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="overflow-hidden bg-slate-100 px-3 py-5 sm:px-6 sm:py-10 lg:px-8 lg:py-14"
          data-testid="precision-aerial-hero"
        >
          <div className="mx-auto grid w-full max-w-7xl items-center lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
            <div
              className="relative aspect-[4/3] min-h-[300px] overflow-hidden rounded-[1.6rem] bg-[var(--precision-brand-surface)] shadow-[0_28px_80px_rgba(17,24,32,0.16)] sm:min-h-[480px] sm:rounded-[2.5rem] lg:min-h-[640px]"
              data-testid="precision-aerial-hero-media"
            >
              {heroImage ? (
                <SafeProfileImg
                  src={heroImage}
                  fallbackSrcs={heroFallbacks}
                  alt={`${businessName} aerial work`}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="eager"
                />
              ) : (
                <div className="absolute inset-0 bg-[var(--precision-brand-surface)]" />
              )}

              {hero.logoUrl ? (
                <div className="absolute left-4 top-4 rounded-full bg-white p-1.5 shadow-xl shadow-black/20 sm:left-6 sm:top-6 sm:p-2">
                  <SafeProfileImg
                    src={hero.logoUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover sm:h-20 sm:w-20"
                  />
                </div>
              ) : null}

              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 text-slate-900 shadow-xl shadow-black/15 backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:px-5 sm:py-4">
                <span className="min-w-0">
                  <strong className="block truncate text-xs font-black sm:text-sm">
                    {businessName}
                  </strong>
                  {locationLabel ? (
                    <small className="mt-1 block truncate text-[10px] text-slate-500 sm:text-xs">
                      {locationLabel}
                    </small>
                  ) : null}
                </span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--precision-primary)] shadow-[0_0_0_5px_rgba(82,200,245,0.16)]"
                  aria-hidden
                />
              </div>
            </div>

            <div
              className="relative z-10 mx-2 -mt-6 rounded-[1.6rem] border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(17,24,32,0.16)] sm:mx-8 sm:-mt-10 sm:rounded-[2.5rem] sm:p-10 lg:mx-0 lg:-ml-12 lg:mt-0 lg:p-12"
              data-testid="precision-aerial-hero-identity"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--precision-primary-dark)] sm:text-xs">
                {[headline || hero.text, locationLabel].filter(Boolean).join(" · ")}
              </p>
              <h2 className="mt-4 text-xl font-black tracking-[-0.035em] sm:mt-6 sm:text-2xl">
                {businessName}
              </h2>
              {hero.operatorName ? (
                <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
                  {hero.operatorName}
                </p>
              ) : null}
              <h1 className="mt-6 text-[2.7rem] font-black leading-[0.94] tracking-[-0.065em] sm:mt-9 sm:text-6xl">
                {hero.title || "A better view."}
              </h1>
              {hero.text || headline ? (
                <p className="mt-3 text-sm font-semibold text-slate-500 sm:mt-5 sm:text-lg">
                  {hero.text || headline}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-8">
                <button
                  type="button"
                  onClick={() => onDirectConnect()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ts-orange px-5 text-sm font-black text-white transition hover:bg-ts-orange-dark"
                >
                  <MessageCircle className="h-4 w-4" />
                  Direct Connect
                </button>
                {featuredWorkUrl ? (
                  <a
                    href={featuredWorkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-sky-100 px-5 text-sm font-black text-slate-900 transition hover:-translate-y-0.5"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch reel
                  </a>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-black/10 pt-5 text-xs font-bold text-slate-500">
                <a href="#work" className="inline-flex items-center gap-1.5 text-slate-900">
                  View work
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5"
                  >
                    {hero.instagramHandle || "Instagram"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {tiktokUrl ? (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5"
                  >
                    {hero.tiktokHandle || "TikTok"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>

              <ShareButton
                destination={profileShareDestination}
                title={businessName}
                text={`See ${businessName} on TradeScout`}
                imageUrl={profileShareImage || heroImage}
                label="Share profile"
                className="mt-5 min-h-10 rounded-full border-black/10 bg-white text-slate-900 sm:hidden"
              />
            </div>
          </div>
        </section>

        {visibleWorkItems.length > 0 ? (
          <section
            id="work"
            className="border-y border-black/10 bg-white"
            data-testid="precision-aerial-work"
          >
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
              <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[var(--precision-primary-dark)] sm:text-xs">
                    Work
                  </p>
                  <h2 className="mt-3 text-4xl font-black leading-none tracking-[-0.055em] sm:text-6xl">
                    Selected work
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {featuredWorkUrl ? (
                    <a
                      href={featuredWorkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 bg-[rgba(82,200,245,0.14)] px-4 text-xs font-black"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Watch reel
                    </a>
                  ) : null}
                  {instagramUrl ? (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-black"
                    >
                      More on Instagram
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {visibleWorkItems.map((item, index) => (
                  <article
                    key={item.slug}
                    id={`profile-gallery-${item.slug}`}
                    className={`group overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_18px_55px_rgba(17,24,32,0.12)] ${
                      visibleWorkItems.length === 1 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveItem(item)}
                      className="block w-full text-left"
                      aria-label={`Open ${item.title}`}
                    >
                      <SafeProfileImg
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        className={`w-full object-cover transition duration-500 group-hover:scale-[1.015] ${
                          index === 0 || visibleWorkItems.length === 1
                            ? "aspect-[4/3] sm:aspect-video"
                            : "aspect-[4/3]"
                        }`}
                      />
                      <span className="block px-5 py-5 sm:px-7 sm:py-6">
                        <strong className="block text-lg font-black tracking-[-0.025em] sm:text-xl">
                          {item.title}
                        </strong>
                        {item.description ? (
                          <span className="mt-2 block text-sm leading-6 text-slate-500">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {services.length > 0 ? (
          <section
            id="services"
            className="border-b border-black/10 bg-slate-100"
            data-testid="precision-aerial-services"
          >
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
              <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[var(--precision-primary-dark)] sm:text-xs">
                Services
              </p>
              <h2 className="mt-3 text-4xl font-black leading-none tracking-[-0.055em] sm:text-6xl">
                What Cameron can capture.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Choose a service to add it directly to your private request.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {services.map((service, index) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => onDirectConnect(service.trim().slice(0, 180))}
                    className={`flex min-h-20 items-center gap-4 rounded-2xl border border-black/10 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--precision-primary)] hover:shadow-lg ${
                      services.length % 2 === 1 && index === services.length - 1
                        ? "sm:col-span-2"
                        : ""
                    }`}
                    aria-label={`Request ${service}`}
                    data-testid={`precision-aerial-service-${index}`}
                  >
                    <span className="text-[10px] font-black tracking-[0.18em] text-[var(--precision-primary-dark)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong className="min-w-0 flex-1 text-sm font-black leading-5 sm:text-base">
                      {service}
                    </strong>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--precision-primary-dark)]" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-y border-white/10 bg-[var(--precision-brand)] text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[var(--precision-primary)] sm:text-xs">
                About
              </p>
              <h2 className="mt-3 text-4xl font-black leading-none tracking-[-0.055em] sm:text-6xl">
                Meet {hero.operatorName || "Cameron"}.
              </h2>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-[var(--precision-primary)]">
                {businessName}
              </p>
              {aboutText ? (
                <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white/70 sm:text-2xl sm:leading-10">
                  {aboutText}
                </p>
              ) : null}
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-[var(--precision-brand-surface)] p-6 shadow-2xl shadow-black/25 sm:p-8">
              <div className="flex items-center gap-4">
                {hero.logoUrl ? (
                  <SafeProfileImg
                    src={hero.logoUrl}
                    alt={`${businessName} logo`}
                    className="h-16 w-16 shrink-0 rounded-full border border-white/10 object-cover sm:h-20 sm:w-20"
                  />
                ) : null}
                <span className="min-w-0">
                  <strong className="block text-lg font-black tracking-[-0.03em] sm:text-xl">
                    {businessName}
                  </strong>
                  {hero.operatorName ? (
                    <small className="mt-1 block text-xs text-white/60 sm:text-sm">
                      {hero.operatorName}
                    </small>
                  ) : null}
                </span>
              </div>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm font-bold">
                <p className="flex items-center gap-3">
                  <span
                    className="h-2 w-2 rounded-full bg-[var(--precision-primary)]"
                    aria-hidden
                  />
                  {headline || hero.text || "Drone photo and video"}
                </p>
                {locationLabel ? (
                  <p className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-[var(--precision-primary)]" />
                    {locationLabel}
                  </p>
                ) : null}
              </div>

              {serviceAreas.length > 0 ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/50">
                    Service area
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {serviceAreas.map((area) => (
                      <span
                        key={area}
                        className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(instagramUrl || tiktokUrl) && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6">
                  {instagramUrl ? (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3 text-xs font-bold"
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
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3 text-xs font-bold"
                    >
                      <Play className="h-4 w-4" />
                      {hero.tiktokHandle || "TikTok"}
                    </a>
                  ) : null}
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-14">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[var(--precision-primary-dark)] sm:text-xs">
                Ready when you are
              </p>
              <h2 className="mt-3 text-4xl font-black leading-none tracking-[-0.055em] sm:text-6xl">
                Tell {hero.operatorName || "Cameron"} what you need.
              </h2>
              {deliveryCustody === "tradescout_pending_owner" ? (
                <p
                  className="mt-5 max-w-2xl text-sm leading-6 text-slate-500"
                  data-testid="precision-aerial-pending-owner-disclosure"
                >
                  TradeScout securely holds requests until this business connects its profile.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-ts-orange px-7 text-base font-black text-white transition hover:bg-ts-orange-dark lg:w-auto"
            >
              Direct Connect
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
            className="relative max-h-[94vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white text-slate-900"
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
