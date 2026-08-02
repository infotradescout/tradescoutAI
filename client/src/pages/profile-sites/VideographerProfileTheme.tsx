import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Instagram, MapPin, MessageCircle, Play, X } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import { buildProfilePublicItemPath } from "@shared/profilePublicItemRoute";
import type { ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";

type ContentBlock = {
  type?: unknown;
  data?: unknown;
};

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  businessName: string;
  headline?: string | null;
  contentBlocks: unknown;
  services: string[];
  serviceAreas: string[];
  aboutText?: string | null;
  galleryItems: ResolvedProfileGalleryItem[];
  sharedGallerySlug?: string | null;
  profileShareDestination: string;
  onDirectConnect: (serviceName?: string) => void;
  deliveryCustody?: "business" | "tradescout_pending_owner";
  trustActions: ReactNode;
  profileItems?: ReactNode;
};

type HeroData = {
  imageUrl: string;
  posterUrl: string;
  videoUrl: string;
  featuredWorkUrl: string;
  logoUrl: string;
  logoAlt: string;
  operatorName: string;
  locationLabel: string;
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
    imageUrl: readString(data, "imageUrl"),
    posterUrl: readString(data, "posterUrl"),
    videoUrl: readString(data, "videoUrl"),
    featuredWorkUrl: readString(data, "featuredWorkUrl"),
    logoUrl: readString(data, "logoUrl"),
    logoAlt: readString(data, "logoAlt"),
    operatorName: readString(data, "operatorName"),
    locationLabel: readString(data, "locationLabel"),
    instagramUrl: readString(data, "instagramUrl"),
    instagramHandle: readString(data, "instagramHandle"),
    tiktokUrl: readString(data, "tiktokUrl"),
    tiktokHandle: readString(data, "tiktokHandle"),
    title: readString(data, "title"),
    text: readString(data, "text") || readString(data, "body") || readString(data, "description"),
  };
}

function isDirectVideoUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value, "https://www.thetradescout.com");
    const isRelative = value.startsWith("/") && !value.startsWith("//");
    const isTradeScoutMedia =
      url.protocol === "https:" &&
      (url.hostname === "thetradescout.com" || url.hostname.endsWith(".thetradescout.com"));
    return (isRelative || isTradeScoutMedia) && /\.(?:mp4|webm|ogg)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function safeFeaturedWorkUrl(value: string): string {
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return safeSocialUrl(value, [
    "instagram.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "vimeo.com",
  ]);
}

function featuredWorkLabel(value: string): string {
  try {
    const host = new URL(value, "https://www.thetradescout.com").hostname
      .toLowerCase()
      .replace(/^www\./, "");
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return "Watch on Instagram";
    }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      return "Watch on TikTok";
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
      return "Watch on YouTube";
    }
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      return "Watch on Vimeo";
    }
  } catch {
    // Relative links and malformed input use the neutral label.
  }
  return "Watch featured work";
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

function instagramEmbedUrl(value: string): string {
  const safeUrl = safeSocialUrl(value, ["instagram.com"]);
  if (!safeUrl) return "";

  try {
    const parsed = new URL(safeUrl);
    const [kind, shortcode] = parsed.pathname.split("/").filter(Boolean);
    const normalizedKind = String(kind || "").toLowerCase();
    if (!["p", "reel", "tv"].includes(normalizedKind)) return "";
    if (!/^[A-Za-z0-9_-]+$/.test(String(shortcode || ""))) return "";
    return `https://www.instagram.com/${normalizedKind}/${shortcode}/embed/`;
  } catch {
    return "";
  }
}

export default function VideographerProfileTheme({
  profileSlug,
  platformBaseHref = "",
  businessName,
  headline,
  contentBlocks,
  services,
  serviceAreas,
  aboutText,
  galleryItems,
  sharedGallerySlug = null,
  profileShareDestination,
  onDirectConnect,
  trustActions,
  profileItems,
}: Props) {
  const hero = useMemo(() => readHeroData(contentBlocks), [contentBlocks]);
  const featuredItem =
    galleryItems.find((item) => item.slug === sharedGallerySlug) || galleryItems[0] || null;
  const mediaFallbacks = galleryItems
    .map((item) => item.imageUrl)
    .filter((url) => url && url !== featuredItem?.imageUrl);
  const heroImage = hero.posterUrl || hero.imageUrl || featuredItem?.imageUrl || "";
  const directVideoUrl = isDirectVideoUrl(hero.videoUrl) ? hero.videoUrl : "";
  const featuredWorkUrl = safeFeaturedWorkUrl(
    hero.featuredWorkUrl || (!directVideoUrl ? hero.videoUrl : "")
  );
  const featuredInstagramEmbedUrl = instagramEmbedUrl(featuredWorkUrl);
  const featuredWorkCta = featuredWorkLabel(featuredWorkUrl);
  const instagramUrl = safeSocialUrl(hero.instagramUrl, ["instagram.com"]);
  const tiktokUrl = safeSocialUrl(hero.tiktokUrl, ["tiktok.com"]);
  const locationLabel = hero.locationLabel || serviceAreas[0] || "";
  const shortHeadline = hero.text || headline?.trim() || "";
  const hasHeroMedia = Boolean(featuredInstagramEmbedUrl || directVideoUrl || heroImage);
  const [activeItem, setActiveItem] = useState<ResolvedProfileGalleryItem | null>(
    sharedGallerySlug ? galleryItems.find((item) => item.slug === sharedGallerySlug) || null : null
  );
  const [instagramEmbedLoaded, setInstagramEmbedLoaded] = useState(false);

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

  return (
    <div className="min-h-full bg-neutral-950 text-white" data-testid="videographer-profile">
      <section
        className="relative isolate min-h-[72svh] overflow-hidden bg-black sm:min-h-[78svh]"
        data-testid="videographer-hero"
      >
        {heroImage ? (
          <SafeProfileImg
            src={heroImage}
            fallbackSrcs={mediaFallbacks}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-45 blur-sm"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-black/65" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,.96)_0%,rgba(0,0,0,.76)_48%,rgba(0,0,0,.45)_100%)]" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 sm:py-6">
          <a
            href={profileShareDestination}
            className="flex min-w-0 items-center gap-3"
            aria-label={`${businessName} home`}
          >
            {hero.logoUrl ? (
              <img
                src={hero.logoUrl}
                alt={hero.logoAlt || businessName}
                className="h-10 w-10 rounded-lg border border-white/25 bg-black/50 object-contain sm:h-12 sm:w-12"
              />
            ) : null}
            <span className="truncate text-sm font-black tracking-[-0.02em] sm:text-base">
              {businessName}
            </span>
          </a>
          <button
            type="button"
            onClick={() => onDirectConnect()}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-ts-orange px-4 text-sm font-black text-white shadow-lg shadow-black/25 transition hover:bg-ts-orange-dark sm:px-5"
            data-testid="videographer-primary-direct-connect"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Direct Connect</span>
          </button>
        </header>

        <div
          className={`relative z-10 mx-auto grid min-h-[calc(72svh-76px)] w-full max-w-7xl items-center gap-8 px-4 pb-8 pt-4 sm:min-h-[calc(78svh-96px)] sm:px-6 sm:pb-10 ${
            hasHeroMedia ? "lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)]" : ""
          }`}
        >
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold uppercase tracking-[0.14em] text-white/75">
              {hero.operatorName ? <span>{hero.operatorName}</span> : null}
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-ts-orange" />
                  {locationLabel}
                </span>
              ) : null}
            </div>

            <h1 className="text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">
              {hero.title || businessName}
            </h1>
            {shortHeadline ? (
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/80 sm:text-base">
                {shortHeadline}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-ts-orange px-5 text-sm font-black text-white transition hover:bg-ts-orange-dark"
            >
              <MessageCircle className="h-4 w-4" />
              Direct Connect
            </button>
          </div>

          {hasHeroMedia ? (
            <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl shadow-black/40">
              {featuredInstagramEmbedUrl ? (
                instagramEmbedLoaded ? (
                  <iframe
                    src={featuredInstagramEmbedUrl}
                    title={`${businessName} featured Instagram reel`}
                    className="aspect-[4/5] max-h-[68svh] w-full bg-white"
                    loading="lazy"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerPolicy="no-referrer"
                    data-testid="videographer-instagram-embed"
                  />
                ) : (
                  <div
                    className="flex aspect-[4/5] max-h-[68svh] w-full flex-col items-center justify-center gap-4 bg-neutral-900 px-6 text-center"
                    data-testid="videographer-instagram-consent"
                  >
                    <button
                      type="button"
                      onClick={() => setInstagramEmbedLoaded(true)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-white/90"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Play featured reel
                    </button>
                    <p className="max-w-xs text-xs leading-5 text-white/55">
                      Playing loads Instagram content and shares browser data with Meta.
                    </p>
                  </div>
                )
              ) : directVideoUrl ? (
                <video
                  src={directVideoUrl}
                  poster={heroImage || undefined}
                  className="aspect-video max-h-[68svh] w-full object-contain"
                  muted
                  playsInline
                  controls
                />
              ) : (
                <SafeProfileImg
                  src={heroImage}
                  fallbackSrcs={mediaFallbacks}
                  alt={featuredItem?.imageAlt || `${businessName} featured work`}
                  className="aspect-video max-h-[68svh] w-full object-contain"
                />
              )}

              {featuredWorkUrl ? (
                <a
                  href={featuredWorkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 border-t border-white/10 bg-black px-4 text-sm font-bold text-white/80 transition hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  {featuredWorkCta}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <main>
        {galleryItems.length > 0 ? (
          <section id="work" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-black tracking-[-0.045em] sm:text-5xl">Portfolio</h2>
              {featuredWorkUrl && !featuredInstagramEmbedUrl ? (
                <a
                  href={featuredWorkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition hover:text-white"
                >
                  {featuredWorkCta}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>

            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12"
              data-testid="videographer-portfolio"
            >
              {galleryItems.map((item, index) => (
                <article
                  key={item.slug}
                  id={`profile-gallery-${item.slug}`}
                  className={`group relative overflow-hidden rounded-2xl bg-white/[0.04] ${
                    index === 0 ? "sm:col-span-2 lg:col-span-8" : "lg:col-span-4"
                  } ${index > 2 ? "lg:col-span-6" : ""}`}
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
                      className={`w-full object-cover transition duration-500 group-hover:scale-[1.02] ${
                        index === 0 ? "aspect-[16/9]" : "aspect-[4/3]"
                      }`}
                    />
                    <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/90 via-black/45 to-transparent px-5 pb-5 pt-16">
                      <span className="block text-lg font-black text-white">{item.title}</span>
                      {item.description ? (
                        <span className="mt-1 line-clamp-2 block text-sm leading-5 text-white/70">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {services.length > 0 ? (
          <section className="border-y border-white/10 bg-white/[0.025]" id="services">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
              <h2 className="text-3xl font-black tracking-[-0.045em] sm:text-5xl">Services</h2>
              <ul className="mt-8 grid border-t border-white/15 sm:grid-cols-2">
                {services.map((service) => (
                  <li key={service} className="border-b border-white/15 sm:pr-8">
                    <button
                      type="button"
                      onClick={() => onDirectConnect(service.trim().slice(0, 180))}
                      className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-lg font-bold sm:text-xl"
                      aria-label={`Request ${service}`}
                    >
                      <span>{service}</span>
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-ts-orange">
                        Request
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ts-orange">About</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              {hero.operatorName || businessName}
            </h2>
            {aboutText ? (
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                {aboutText}
              </p>
            ) : null}

            {(instagramUrl || tiktokUrl) && (
              <div
                className="mt-7 flex flex-wrap gap-3"
                aria-label={`${businessName} social media`}
              >
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold text-white transition hover:border-white/35"
                    data-testid="videographer-instagram"
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
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold text-white transition hover:border-white/35"
                    data-testid="videographer-tiktok"
                  >
                    <Play className="h-4 w-4" />
                    {hero.tiktokHandle || "TikTok"}
                  </a>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div data-testid="profile-trust-section" aria-label="Trust and profile actions">
              {trustActions}
            </div>
            {profileItems}
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-ts-orange px-5 text-left text-sm font-black text-white transition hover:bg-ts-orange-dark"
            >
              <span>Direct Connect with {hero.operatorName || businessName}</span>
              <MessageCircle className="h-5 w-5" />
            </button>
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
            className="relative max-h-[94vh] w-full max-w-6xl overflow-auto rounded-2xl bg-neutral-900"
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
                  <p className="mt-1 text-sm leading-6 text-white/65">{activeItem.description}</p>
                ) : null}
              </div>
              <ShareButton
                destination={galleryHref(activeItem)}
                title={`${activeItem.title} | ${businessName}`}
                text={`See ${activeItem.title} from ${businessName}`}
                imageUrl={activeItem.imageUrl}
                variant="outline"
                label="Share this work"
                className="border-white/20 text-white hover:bg-white/10 hover:text-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
