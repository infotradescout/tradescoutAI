import type { CSSProperties, ReactNode } from "react";
import { Link } from "wouter";
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  Droplets,
  Flame,
  HardHat,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import {
  buildProfileGalleryShareSearch,
  type ResolvedProfileGalleryItem,
} from "@shared/profileGalleryShare";
import type {
  LocalServiceProfileIcon,
  LocalServiceProfilePresentation,
} from "@shared/localServiceProfile";

type RecommendationEntry = {
  id: string;
  recommendationType: "positive" | "negative";
  comment: string;
  projectType: string | null;
  contractor: {
    companyName: string;
    canonicalBusinessProfileUrl?: string | null;
  };
};

type Props = {
  businessName: string;
  presentation: LocalServiceProfilePresentation;
  onDirectConnect: () => void;
  hasViewerSession: boolean;
  tradeScoutReturnHref: string;
  profileShareDestination: string;
  galleryItems?: ResolvedProfileGalleryItem[];
  sharedGallerySlug?: string | null;
  recommendationsDirectory?: RecommendationEntry[];
  profileItems?: ReactNode;
  verificationStatus?: string | null;
  cvsScore?: number | null;
  cvsPerformanceScore?: number | null;
  cvsBoostPoints?: number | null;
};

const iconByName: Record<LocalServiceProfileIcon, typeof Wrench> = {
  backflow: ShieldCheck,
  bath: Droplets,
  construction: HardHat,
  drain: Droplets,
  gas: Flame,
  repair: Wrench,
  "water-heater": Building2,
};

export default function LocalServiceProfileTheme({
  businessName,
  presentation,
  onDirectConnect,
  hasViewerSession,
  tradeScoutReturnHref,
  profileShareDestination,
  galleryItems = [],
  sharedGallerySlug = null,
  recommendationsDirectory = [],
  profileItems,
  verificationStatus = null,
  cvsScore = null,
  cvsPerformanceScore = null,
  cvsBoostPoints = null,
}: Props) {
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );
  const themeStyle = {
    "--service-brand": presentation.brand.primary,
    "--service-brand-dark": presentation.brand.primaryDark,
    "--service-surface": presentation.brand.surface,
    "--service-background": presentation.brand.background,
  } as CSSProperties;
  const isVerified = String(verificationStatus || "").toLowerCase() === "approved";
  const normalizedCvsScore =
    typeof cvsScore === "number" && Number.isFinite(cvsScore)
      ? Math.max(0, Math.round(cvsScore))
      : null;
  const normalizedBoostPoints =
    typeof cvsBoostPoints === "number" && Number.isFinite(cvsBoostPoints)
      ? Math.max(0, Math.round(cvsBoostPoints))
      : 0;
  const normalizedPerformanceScore =
    typeof cvsPerformanceScore === "number" && Number.isFinite(cvsPerformanceScore)
      ? Math.max(0, Math.min(100, Math.round(cvsPerformanceScore)))
      : normalizedCvsScore === null
        ? null
        : Math.max(0, Math.min(100, normalizedCvsScore - normalizedBoostPoints));
  const cvsStanding =
    normalizedPerformanceScore === null
      ? null
      : normalizedPerformanceScore === 50
        ? "Verified baseline"
        : normalizedPerformanceScore > 84
          ? "Exceptional record"
          : normalizedPerformanceScore > 69
            ? "Proven record"
            : normalizedPerformanceScore > 50
              ? "Building a positive record"
              : normalizedPerformanceScore > 34
                ? "Needs attention"
                : "At risk";

  return (
    <main
      style={themeStyle}
      className="min-h-screen bg-[var(--service-background)] text-slate-100"
      data-testid="local-service-profile-theme"
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--service-background)]/95 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[44px_1fr_44px] items-center gap-2 px-3 sm:h-20 sm:grid-cols-[170px_1fr_170px] sm:px-6">
          <a
            href={tradeScoutReturnHref}
            aria-label={
              hasViewerSession
                ? `Close ${businessName} and return to Direct Connect`
                : `Close ${businessName} and return to TradeScout`
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </a>

          <div className="flex min-w-0 items-center justify-center">
            <div className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <img
                src={presentation.logoImage}
                alt={presentation.logoAlt}
                className="h-8 w-[150px] object-contain sm:h-11 sm:w-[220px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onDirectConnect}
            aria-label={`Make A Request with ${businessName}`}
            className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full bg-ts-orange text-white transition hover:bg-ts-orange-dark sm:w-auto sm:gap-2 sm:px-4"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden text-xs font-black sm:inline">Make A Request</span>
          </button>
        </div>
      </header>

      <section className="relative isolate min-h-[580px] overflow-hidden sm:min-h-[650px]">
        <img
          src={presentation.heroImage}
          alt={presentation.heroImageAlt}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,14,20,0.96)_0%,rgba(3,14,20,0.77)_48%,rgba(3,14,20,0.38)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--service-background)] to-transparent" />

        <div className="relative mx-auto flex min-h-[580px] max-w-6xl items-end px-4 pb-16 pt-24 sm:min-h-[650px] sm:px-6 sm:pb-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md">
              <MapPin className="h-3.5 w-3.5 text-[var(--service-brand)]" />
              {presentation.locationLabel}
            </div>
            {isVerified ? (
              <div className="ml-2 mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-950/55 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-100 backdrop-blur-md sm:mt-0">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified by TradeScout
              </div>
            ) : null}
            {isVerified && normalizedCvsScore !== null && cvsStanding ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-white/65">
                <span>
                  CVS {normalizedCvsScore} · {cvsStanding}
                </span>
                {normalizedBoostPoints > 0 ? (
                  <span className="rounded-full border border-sky-300/20 bg-sky-950/50 px-2.5 py-1 text-sky-100">
                    +{normalizedBoostPoints} active TradeScout boost
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[var(--service-brand)]">
              {presentation.eyebrow}
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              {presentation.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
              {presentation.heroDescription}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onDirectConnect}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-sm font-black text-white shadow-[0_18px_50px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
              >
                Make A Request
                <ChevronRight className="h-4 w-4" />
              </button>
              <ShareButton
                destination={profileShareDestination}
                title={businessName}
                text={`${presentation.eyebrow} in ${presentation.locationLabel}`}
                variant="outline"
                label={`Share ${businessName}`}
                className="min-h-12 rounded-full border-white/20 bg-black/25 px-6 text-white hover:bg-white/10 hover:text-white"
              />
            </div>
            <p className="mt-3 max-w-xl text-xs leading-5 text-white/55">
              {presentation.requestDescription}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[var(--service-surface)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-white/10 px-4 sm:grid-cols-4 sm:divide-y-0 sm:px-6">
          {presentation.highlights.map((highlight) => (
            <div key={highlight} className="flex min-h-24 items-center gap-3 px-3 py-5 sm:px-5">
              <BadgeCheck className="h-5 w-5 flex-none text-[var(--service-brand)]" />
              <p className="text-sm font-bold leading-5 text-slate-100">{highlight}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--service-brand)]">
              {presentation.servicesEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">
              {presentation.servicesTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              {presentation.serviceNote}
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {presentation.services.map((service) => {
              const Icon = iconByName[service.icon] || Wrench;
              return (
                <article
                  key={service.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-[var(--service-brand)]/50 hover:bg-white/[0.055]"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--service-brand)]/12 text-[var(--service-brand)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-black leading-6 text-white">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{service.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--service-brand)]">
                {presentation.galleryEyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">
                {presentation.galleryTitle}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              {presentation.galleryDescription}
            </p>
          </div>

          {galleryItems.length > 0 ? (
            <div className="mt-10 grid auto-rows-[240px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {galleryItems.map((item, index) => {
                const isSharedItem = item.slug === sharedGallerySlug;
                const isWide = index === 0 || index === 5;
                return (
                  <figure
                    id={`profile-gallery-${item.slug}`}
                    key={item.slug}
                    className={`group relative overflow-hidden rounded-2xl border bg-black ${
                      isWide ? "sm:col-span-2" : ""
                    } ${
                      isSharedItem ? "border-ts-orange ring-2 ring-ts-orange/50" : "border-white/10"
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                    <figcaption className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/65">
                          {item.description}
                        </p>
                      ) : null}
                    </figcaption>
                    <ShareButton
                      destination={`${profileShareDestination}${buildProfileGalleryShareSearch(item.slug)}`}
                      title={`${item.title} from ${businessName}`}
                      text={`${presentation.galleryShareText} from ${businessName}`}
                      size="icon"
                      label=""
                      className="absolute right-3 top-3 border-white/20 bg-black/70 text-white hover:bg-black"
                    />
                  </figure>
                );
              })}
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <p className="font-bold text-white">You&apos;re here early.</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Project photos will be added as the profile grows.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[var(--service-surface)] lg:grid-cols-[0.85fr_1.15fr]">
          {presentation.aboutImage ? (
            <img
              src={presentation.aboutImage}
              alt={presentation.aboutImageAlt || presentation.aboutTitle}
              loading="lazy"
              className="h-full min-h-[360px] w-full object-cover"
            />
          ) : null}
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--service-brand)]">
              {presentation.aboutEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">
              {presentation.aboutTitle}
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">{presentation.aboutBody}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-[var(--service-brand)]" />
              <h2 className="text-2xl font-black text-white">Service area</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {presentation.serviceAreaDescription}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {presentation.serviceAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-200"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-[var(--service-brand)]" />
              <h2 className="text-2xl font-black text-white">{presentation.credentialLabel}</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {presentation.credentials.map((credential) => (
                <div key={credential.label} className="rounded-xl bg-black/20 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                    {credential.label}
                  </p>
                  <p className="mt-1 font-black text-white">{credential.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              {isVerified
                ? presentation.credentialDisclosure
                : "Credential review is in progress. You’re here early, and this profile will update when the review is complete."}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-[var(--service-brand)]" />
            <h2 className="text-3xl font-black tracking-[-0.03em] text-white">
              Customer recommendations
            </h2>
          </div>

          {publicRecommendations.length > 0 ? (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {publicRecommendations.slice(0, 6).map((entry) => {
                const content = (
                  <>
                    <p className="font-black text-white">{entry.contractor.companyName}</p>
                    {entry.projectType ? (
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--service-brand)]">
                        {entry.projectType}
                      </p>
                    ) : null}
                    {entry.comment ? (
                      <p className="mt-3 text-sm leading-6 text-slate-400">{entry.comment}</p>
                    ) : null}
                  </>
                );

                return entry.contractor.canonicalBusinessProfileUrl ? (
                  <Link
                    key={entry.id}
                    href={entry.contractor.canonicalBusinessProfileUrl}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-[var(--service-brand)]/40"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <p className="font-bold text-white">You&apos;re here early.</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Customer recommendations will appear here as they come in.
              </p>
            </div>
          )}
        </div>
      </section>

      {profileItems ? (
        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">{profileItems}</div>
        </section>
      ) : null}

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[var(--service-brand)] px-6 py-10 text-slate-950 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:px-10 sm:py-14">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-950/60">
            Direct Connect
          </p>
          <div className="mt-3 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                {presentation.requestTitle}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-950/75">
                {presentation.requestDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={onDirectConnect}
              className="inline-flex min-h-12 flex-none items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-sm font-black text-white transition hover:bg-ts-orange-dark"
            >
              Make A Request
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-center sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Connection Without Compromise
        </p>
      </footer>
    </main>
  );
}
