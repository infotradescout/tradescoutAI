import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Instagram,
  MapPin,
  MessageCircle,
  Play,
  ShieldCheck,
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
        className="relative z-30 border-b border-black/10 bg-white/95 backdrop-blur"
        data-testid="precision-aerial-header"
      >
        <div className="mx-auto flex min-h-16 w-full max-w-[1480px] items-center gap-3 px-4 py-2 sm:min-h-20 sm:px-6 lg:px-10">
          <a
            href={profileShareDestination}
            className="flex min-w-0 items-center gap-3"
            aria-label={`${businessName} home`}
          >
            {hero.logoUrl ? (
              <SafeProfileImg
                src={hero.logoUrl}
                alt={`${businessName} logo`}
                className="h-11 w-11 shrink-0 rounded-full border border-black/10 object-cover sm:h-14 sm:w-14"
              />
            ) : null}
            <span className="min-w-0">
              <strong className="block truncate text-sm font-black tracking-[-0.025em] sm:text-base">
                {businessName}
              </strong>
              {locationLabel ? (
                <small className="mt-0.5 hidden truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500 sm:block">
                  {locationLabel}
                </small>
              ) : null}
            </span>
          </a>

          <nav
            className="ml-auto hidden items-center gap-6 text-xs font-black uppercase tracking-[0.12em] text-slate-600 lg:flex"
            aria-label={`${businessName} page sections`}
          >
            <a href="#work" className="transition hover:text-slate-950">
              Work
            </a>
            <a href="#capabilities" className="transition hover:text-slate-950">
              Capabilities
            </a>
            <a href="#project-brief" className="transition hover:text-slate-950">
              Process
            </a>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-7">
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
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ts-orange px-4 text-xs font-black text-white shadow-sm transition hover:bg-ts-orange-dark sm:min-h-11 sm:px-5 sm:text-sm"
              data-testid="precision-primary-direct-connect"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start a project</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="overflow-hidden bg-[var(--precision-brand)] text-white"
          data-testid="precision-aerial-hero"
        >
          <div className="mx-auto grid min-h-[720px] w-full max-w-[1480px] lg:grid-cols-[0.86fr_1.14fr]">
            <div
              className="flex flex-col justify-center px-5 py-14 sm:px-10 sm:py-20 lg:px-16 xl:px-20"
              data-testid="precision-aerial-hero-identity"
            >
              <div className="flex items-center gap-3">
                {hero.logoUrl ? (
                  <SafeProfileImg
                    src={hero.logoUrl}
                    alt=""
                    className="h-16 w-16 rounded-full border border-white/20 object-cover shadow-2xl sm:h-20 sm:w-20"
                  />
                ) : null}
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300 sm:text-xs">
                  {[hero.text || headline || "Aerial photo + video", locationLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>

              <h1 className="mt-10 max-w-2xl text-[4rem] font-black leading-[0.86] tracking-[-0.075em] sm:text-[6.5rem] lg:text-[7.4rem]">
                {hero.title || "A better view."}
              </h1>
              <p className="mt-7 max-w-xl text-lg font-semibold leading-8 text-white/70 sm:text-2xl sm:leading-10">
                Property. Progress. Land. Motion. Captured from above with a clear purpose for the
                project below.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onDirectConnect()}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-ts-orange px-6 text-sm font-black text-white transition hover:bg-ts-orange-dark sm:px-7 sm:text-base"
                >
                  Start a private project
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#work"
                  className="inline-flex min-h-[52px] items-center rounded-full border border-white/20 px-6 text-sm font-black text-white transition hover:border-white/50 hover:bg-white/5 sm:px-7 sm:text-base"
                >
                  View selected work
                </a>
                {featuredWorkUrl ? (
                  <a
                    href={featuredWorkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-sky-300/30 px-6 text-sm font-black text-sky-200 transition hover:border-sky-300/70 hover:bg-sky-300/5"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch reel
                  </a>
                ) : null}
              </div>

              <p className="mt-8 flex max-w-lg items-start gap-2.5 text-xs font-semibold leading-5 text-white/60">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                Viewing this profile never exposes your contact details. A connection starts only
                when you choose to send a private request.
              </p>
            </div>

            <div
              className="relative min-h-[430px] overflow-hidden border-t border-white/10 bg-[var(--precision-brand-surface)] lg:min-h-[720px] lg:border-l lg:border-t-0"
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent px-5 pb-6 pt-24 text-white sm:px-8 sm:pb-8">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                  Aerial perspective
                </p>
                <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-white/90">
                  See the setting, structure, and scale that ground-level imagery leaves out.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white" aria-label="Profile highlights">
          <div className="mx-auto grid max-w-6xl divide-y divide-black/10 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
            {[
              ["Format", "Aerial photo + video"],
              ["Based in", locationLabel || "Pensacola, Florida"],
              ["Connection", "Private Direct Connect"],
            ].map(([label, value]) => (
              <div key={label} className="py-6 sm:px-8 sm:py-8 sm:first:pl-0 sm:last:pr-0">
                <p className="text-[10px] font-black uppercase tracking-[0.19em] text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-base font-black tracking-[-0.025em] text-slate-950 sm:text-lg">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {galleryItems.length > 0 ? (
          <section
            id="work"
            className="scroll-mt-20 border-b border-black/10 bg-stone-100"
            data-testid="precision-aerial-work"
          >
            <div className="mx-auto max-w-[1380px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
              <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                <div className="max-w-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--precision-primary-dark)] sm:text-xs">
                    Selected work
                  </p>
                  <h2 className="mt-4 text-5xl font-black leading-[0.92] tracking-[-0.06em] sm:text-7xl">
                    The full picture starts above it.
                  </h2>
                </div>
                <p className="max-w-xl text-base font-semibold leading-7 text-slate-600 sm:text-lg sm:leading-8 lg:justify-self-end">
                  Aerial imagery adds the context a listing, progress update, property record, or
                  event cannot get from the ground alone.
                </p>
              </div>

              <div className="mt-12 grid gap-5 lg:grid-cols-12 lg:items-start">
                {galleryItems.map((item, index) => (
                  <article
                    key={item.slug}
                    id={`profile-gallery-${item.slug}`}
                    className={`group overflow-hidden bg-white shadow-[0_24px_70px_rgba(11,23,34,0.12)] ${
                      galleryItems.length === 1
                        ? "lg:col-span-12"
                        : index === 0
                          ? "lg:col-span-8"
                          : "lg:col-span-4 lg:mt-24"
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
                        className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                      />
                      <span className="block border-t border-black/10 px-5 py-5 sm:px-7 sm:py-6">
                        <span className="flex items-center justify-between gap-5">
                          <strong className="text-lg font-black tracking-[-0.03em] sm:text-xl">
                            {item.title}
                          </strong>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--precision-primary-dark)]" />
                        </span>
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

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {featuredWorkUrl ? (
                  <a
                    href={featuredWorkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--precision-brand)] px-5 text-sm font-black text-white"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch the featured reel
                  </a>
                ) : null}
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-5 text-sm font-black text-slate-900"
                  >
                    <Instagram className="h-4 w-4" />
                    {hero.instagramHandle || "Instagram"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {services.length > 0 ? (
          <section
            id="capabilities"
            className="scroll-mt-20 border-b border-black/10 bg-white"
            data-testid="precision-aerial-services"
          >
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
              <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--precision-primary-dark)] sm:text-xs">
                    Capabilities
                  </p>
                  <h2 className="mt-4 text-5xl font-black leading-[0.92] tracking-[-0.06em] sm:text-7xl">
                    Built for the outcome.
                  </h2>
                  <p className="mt-6 max-w-md text-base font-semibold leading-7 text-slate-600">
                    Choose what the project needs. That context carries into the private request
                    instead of forcing you to start over with a generic contact form.
                  </p>
                </div>

                <div className="border-t border-black/10">
                  {services.map((service, index) => (
                    <article
                      key={service}
                      className="grid gap-4 border-b border-black/10 py-7 sm:grid-cols-[42px_1fr_auto] sm:items-start sm:gap-5 sm:py-9"
                    >
                      <span className="text-[11px] font-black tracking-[0.16em] text-[var(--precision-primary-dark)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong className="block text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-2xl">
                          {service}
                        </strong>
                        <span className="mt-2 block max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
                          {describeService(service)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedService(service);
                          openProject(service);
                        }}
                        className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-black/10 px-4 text-xs font-black text-slate-900 transition hover:border-ts-orange hover:text-ts-orange-dark sm:mt-0"
                        aria-label={`Request ${service}`}
                        data-testid={`precision-aerial-service-${index}`}
                      >
                        Start request
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section
          id="project-brief"
          className="scroll-mt-20 overflow-hidden bg-[var(--precision-brand)] text-white"
          data-testid="precision-tradescout-brief"
        >
          <div className="mx-auto grid max-w-[1380px] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-16 lg:py-28">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300 sm:text-xs">
                TradeScout Direct Connect
              </p>
              <h2 className="mt-5 max-w-2xl text-5xl font-black leading-[0.91] tracking-[-0.06em] sm:text-7xl">
                From discovery to a real project.
              </h2>
              <p className="mt-7 max-w-xl text-base font-semibold leading-8 text-white/70 sm:text-lg">
                This profile is more than a listing. Start a private brief for {businessName}, add
                the location, timing, and result you need, then keep the connection organized from
                the first decision forward.
              </p>

              <ol className="mt-10 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ["01", "Choose the capability"],
                  ["02", "Add project details privately"],
                  ["03", "Track the connection"],
                ].map(([number, label]) => (
                  <li key={number}>
                    <span className="text-[10px] font-black tracking-[0.18em] text-sky-300">
                      {number}
                    </span>
                    <strong className="mt-2 block max-w-[12rem] text-sm font-black leading-5 text-white">
                      {label}
                    </strong>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-white/10 bg-[var(--precision-brand-surface)] px-4 py-12 sm:px-10 sm:py-20 lg:border-l lg:border-t-0 lg:px-14 lg:py-24">
              <div className="mx-auto max-w-xl border border-white/10 bg-white p-6 text-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.3)] sm:p-9">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Private project brief
                </p>
                <h3 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                  What should the request start with?
                </h3>

                {services.length > 0 ? (
                  <div
                    className="mt-7 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Project capability"
                  >
                    {services.map((service) => {
                      const selected = selectedService === service;
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => setSelectedService(service)}
                          aria-pressed={selected}
                          className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-left text-xs font-black transition ${
                            selected
                              ? "border-[var(--precision-brand)] bg-[var(--precision-brand)] text-white"
                              : "border-black/10 bg-white text-slate-700 hover:border-black/30"
                          }`}
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                          {service}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-7 border-y border-black/10 py-5">
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-400">
                    Starting context
                  </p>
                  <p className="mt-2 text-base font-black text-slate-950">
                    {selectedService || "General aerial project"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Next, add the job, location, timing, and desired outcome before anything is
                    sent.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openProject()}
                  className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-ts-orange px-7 text-base font-black text-white transition hover:bg-ts-orange-dark"
                  data-testid="precision-project-brief-submit"
                >
                  Start my private request
                  <ArrowRight className="h-5 w-5" />
                </button>

                <ul className="mt-7 space-y-3 text-sm font-semibold leading-6 text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--precision-primary-dark)]" />
                    Your contact details are not made public just because you request service.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--precision-primary-dark)]" />
                    No lead auction, no pay-to-play routing, and no public contact dump.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--precision-primary-dark)]" />
                    Requests, replies, decisions, progress, and follow-up stay together.
                  </li>
                </ul>

                {deliveryCustody === "tradescout_pending_owner" ? (
                  <p
                    className="mt-6 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-950"
                    data-testid="precision-aerial-pending-owner-disclosure"
                  >
                    TradeScout securely holds requests until this business connects its profile.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white" data-testid="precision-company">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20">
            <div className="flex items-center gap-5">
              {hero.logoUrl ? (
                <SafeProfileImg
                  src={hero.logoUrl}
                  alt={`${businessName} logo`}
                  className="h-28 w-28 shrink-0 rounded-full border border-black/10 object-cover shadow-xl sm:h-36 sm:w-36"
                />
              ) : null}
              <span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--precision-primary-dark)]">
                  The company
                </p>
                {hero.operatorName ? (
                  <p
                    className="mt-3 max-w-[12rem] text-sm font-bold leading-6 text-slate-500"
                    data-testid="precision-operator-attribution"
                  >
                    Operated by {hero.operatorName}
                    {locationLabel ? ` in ${locationLabel}` : ""}.
                  </p>
                ) : null}
              </span>
            </div>

            <div>
              <h2 className="text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl">
                {businessName}
              </h2>
              {companyAbout ? (
                <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-slate-600 sm:text-2xl sm:leading-10">
                  {companyAbout}
                </p>
              ) : null}
              <div className="mt-7 flex flex-wrap gap-3">
                {locationLabel ? (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-xs font-black text-slate-700">
                    <MapPin className="h-4 w-4 text-[var(--precision-primary-dark)]" />
                    {locationLabel}
                  </span>
                ) : null}
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-xs font-black text-slate-700"
                  >
                    <Instagram className="h-4 w-4" />
                    {hero.instagramHandle || "Instagram"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {tiktokUrl ? (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-xs font-black text-slate-700"
                  >
                    <Play className="h-4 w-4" />
                    {hero.tiktokHandle || "TikTok"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
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
