import { lazy, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  ExternalLink,
  Flame,
  Globe2,
  HardHat,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { type ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";
import { buildProfilePublicItemPath } from "@shared/profilePublicItemRoute";
import type {
  LocalServiceProfileIcon,
  LocalServiceProfilePresentation,
} from "@shared/localServiceProfile";

type RecommendationEntry = {
  id: string;
  recommendationType: "positive" | "negative";
  comment: string;
  projectType: string | null;
  customerName: string;
  contractor: {
    companyName: string;
    canonicalBusinessProfileUrl?: string | null;
  };
};

export type PublicCommunityVerification = {
  score: number | null;
  scoreHistoryStartsAt: string | null;
  lifetimeScoreChange: number | null;
  scoreChange30d: number | null;
  scoreChange30dComparedAt: string | null;
  activePolicyBoostPoints: number;
  activeBoosts: Array<{
    policyKey: string;
    label: string;
    points: number;
    expiresAt: string | null;
  }>;
  badges: string[];
  computedAt: string | null;
};

export type LocalServiceProfileProps = {
  profileSlug: string;
  platformBaseHref?: string;
  businessName: string;
  presentation: LocalServiceProfilePresentation;
  onDirectConnect: (serviceName?: string) => void;
  canCall?: boolean;
  hasViewerSession: boolean;
  tradeScoutReturnHref: string;
  profileShareDestination: string;
  publicRouteContentBlocks?: unknown;
  galleryItems?: ResolvedProfileGalleryItem[];
  sharedGallerySlug?: string | null;
  recommendationsDirectory?: RecommendationEntry[];
  trustActions: ReactNode;
  profileItems?: ReactNode;
  verificationStatus?: string | null;
  verifiedBadge?: boolean;
  communityVerification?: PublicCommunityVerification | null;
};

type ProfileAction =
  | "request"
  | "call"
  | "directions"
  | "website"
  | "service"
  | "gallery"
  | "financing";

const iconByName: Record<LocalServiceProfileIcon, typeof Wrench> = {
  backflow: ShieldCheck,
  bath: Droplets,
  construction: HardHat,
  drain: Droplets,
  gas: Flame,
  repair: Wrench,
  "water-heater": Flame,
};

function formatScoreHistoryDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function trackProfileAction(args: {
  profileSlug: string;
  action: ProfileAction;
  surface: string;
  detail?: string;
}) {
  if (typeof window === "undefined") return;

  const payload = {
    type: "public_profile_action_selected",
    profileSlug: args.profileSlug.slice(0, 100),
    action: args.action,
    surface: args.surface.slice(0, 80),
    detail: args.detail?.slice(0, 120) || undefined,
    deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
    ts: new Date().toISOString(),
  };

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        "/api/analytics/shell",
        new Blob([body], { type: "application/json" })
      );
      if (accepted) return;
    }

    void fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => undefined);
  } catch {
    // Profile actions must never be blocked by telemetry.
  }
}

function externalActionProps(args: {
  profileSlug: string;
  action: "directions" | "website";
  surface: string;
}) {
  return {
    target: "_blank",
    rel: "noreferrer",
    onClick: () => trackProfileAction(args),
  } as const;
}

function CompactLocalServiceProfileTheme({
  profileSlug,
  platformBaseHref = "",
  businessName,
  presentation,
  onDirectConnect,
  tradeScoutReturnHref,
  profileShareDestination,
  publicRouteContentBlocks,
  galleryItems = [],
  sharedGallerySlug = null,
  recommendationsDirectory = [],
  trustActions,
  profileItems,
  verificationStatus = null,
  verifiedBadge = false,
  communityVerification = null,
}: LocalServiceProfileProps) {
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);
  const publicRecommendations = useMemo(
    () =>
      recommendationsDirectory.filter(
        (entry) => entry.recommendationType === "positive" && entry.comment.trim().length > 0
      ),
    [recommendationsDirectory]
  );
  const activeGalleryItem =
    activeGalleryIndex === null ? null : galleryItems[activeGalleryIndex] || null;
  const isVerified =
    verifiedBadge === true && String(verificationStatus || "").toLowerCase() === "approved";
  const verificationScore =
    typeof communityVerification?.score === "number" && Number.isFinite(communityVerification.score)
      ? Math.max(0, Math.round(communityVerification.score))
      : null;
  const hasCredentials = presentation.credentials.length > 0;
  const hasTrustDetails = isVerified || hasCredentials || verificationScore !== null;
  const scoreHistoryStart = formatScoreHistoryDate(communityVerification?.scoreHistoryStartsAt);
  const score30dComparedAt = formatScoreHistoryDate(
    communityVerification?.scoreChange30dComparedAt
  );
  const activeBoostPoints =
    typeof communityVerification?.activePolicyBoostPoints === "number" &&
    Number.isFinite(communityVerification.activePolicyBoostPoints)
      ? Math.max(0, Math.round(communityVerification.activePolicyBoostPoints))
      : 0;
  const themeStyle = {
    "--service-brand": presentation.brand.primary,
    "--service-brand-dark": presentation.brand.primaryDark,
    "--service-surface": presentation.brand.surface,
    "--service-background": presentation.brand.background,
  } as CSSProperties;

  const openProtectedContact = (
    action: "request" | "call" | "service" | "financing",
    surface: string,
    detail?: string
  ) => {
    trackProfileAction({ profileSlug, action, surface, detail });
    onDirectConnect(action === "service" ? detail : undefined);
  };

  useEffect(() => {
    if (!activeGalleryItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveGalleryIndex(null);
      if (event.key === "ArrowLeft" && galleryItems.length > 1) {
        setActiveGalleryIndex((current) =>
          current === null ? null : (current - 1 + galleryItems.length) % galleryItems.length
        );
      }
      if (event.key === "ArrowRight" && galleryItems.length > 1) {
        setActiveGalleryIndex((current) =>
          current === null ? null : (current + 1) % galleryItems.length
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeGalleryItem, galleryItems.length]);

  return (
    <main
      style={themeStyle}
      className="min-h-screen bg-slate-100 pb-24 text-slate-950 md:pb-0"
      data-testid="local-service-profile-theme"
      data-profile-layout="compact-business-profile"
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--service-surface)] text-white shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:h-20 sm:px-5">
          <a
            href={tradeScoutReturnHref}
            aria-label="Return to TradeScout"
            className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/15 text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black sm:text-base">{businessName}</p>
            <p className="truncate text-[11px] text-white/60">{presentation.locationLabel}</p>
          </div>

          <button
            type="button"
            onClick={() => openProtectedContact("request", "header")}
            className="inline-flex min-h-10 flex-none items-center justify-center gap-2 rounded-full bg-ts-orange px-4 text-xs font-black text-white transition hover:bg-ts-orange-dark sm:px-5 sm:text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden min-[390px]:inline">
              {presentation.primaryActionLabel || "Start a Request"}
            </span>
          </button>
        </div>
      </header>

      <section className="relative h-44 overflow-hidden bg-[var(--service-surface)] sm:h-60 lg:h-72">
        <img
          src={presentation.heroImage}
          alt={presentation.heroImageAlt}
          className="h-full w-full object-cover object-[65%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
      </section>

      <section className="relative z-10 -mt-12 px-3 sm:-mt-16 sm:px-5">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="grid grid-cols-1 gap-5 p-5 sm:p-7 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 lg:block">
              <div className="flex h-24 w-44 max-w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:h-28 lg:w-full">
                <img
                  src={presentation.logoImage}
                  alt={presentation.logoAlt}
                  className="h-full w-full object-contain"
                />
              </div>
              <ShareButton
                destination={profileShareDestination}
                title={businessName}
                text={`${presentation.eyebrow} in ${presentation.locationLabel}`}
                variant="outline"
                label={`Share ${businessName}`}
                className="h-auto min-h-11 min-w-0 max-w-full whitespace-normal rounded-full border-slate-200 bg-white py-2 text-slate-700 hover:bg-slate-50 lg:mt-4 lg:w-full"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
                  {presentation.eyebrow}
                </span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified business
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                  <MapPin className="h-3.5 w-3.5" />
                  {presentation.locationLabel}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">
                {businessName}
              </h1>
              <p className="mt-2 text-lg font-bold leading-7 text-slate-800">
                {presentation.heroTitle}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                {presentation.heroDescription}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => openProtectedContact("request", "profile_header")}
                  className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ts-orange px-5 text-sm font-black text-white transition hover:bg-ts-orange-dark sm:col-span-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  {presentation.primaryActionLabel || "Start a Request"}
                </button>
                <button
                  type="button"
                  onClick={() => openProtectedContact("call", "profile_header")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-800 transition hover:bg-sky-100"
                  aria-label={`${presentation.callActionLabel || "Call"} through protected contact options`}
                >
                  <Phone className="h-4 w-4" />
                  {presentation.callActionLabel || "Call"}
                </button>
                {presentation.directionsUrl ? (
                  <a
                    href={presentation.directionsUrl}
                    {...externalActionProps({
                      profileSlug,
                      action: "directions",
                      surface: "profile_header",
                    })}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <MapPin className="h-4 w-4" />
                    Directions
                  </a>
                ) : null}
                {presentation.websiteUrl ? (
                  <a
                    href={presentation.websiteUrl}
                    {...externalActionProps({
                      profileSlug,
                      action: "website",
                      surface: "profile_header",
                    })}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Globe2 className="h-4 w-4" />
                    Website
                  </a>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {presentation.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    <Check className="h-3.5 w-3.5 text-[var(--service-brand)]" />
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <nav
            className="flex gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 py-2 sm:px-6"
            aria-label="Profile sections"
          >
            {[
              ["Services", "services"],
              ["Photos", "work"],
              ["About", "company"],
              ["Details", "details"],
            ].map(([label, sectionId]) => (
              <button
                key={sectionId}
                type="button"
                onClick={() =>
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" })
                }
                className="min-h-10 flex-none rounded-full px-4 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-slate-950"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-3 py-7 sm:px-5 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6">
          <section
            id="services"
            className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                  {presentation.servicesEyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
                  {presentation.servicesTitle?.trim() || "What do you need?"}
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-500">
                {presentation.serviceNote}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {presentation.services.map((service) => {
                const Icon = iconByName[service.icon] || Wrench;
                return (
                  <button
                    key={service.title}
                    type="button"
                    onClick={() => openProtectedContact("service", "service_grid", service.title)}
                    className="group flex min-h-[132px] items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/60 hover:shadow-md"
                  >
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-sky-100 text-sky-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black text-slate-950">{service.title}</span>
                      <span className="mt-1.5 block text-xs leading-5 text-slate-600">
                        {service.description}
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-ts-orange">
                        Start this request
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            id="work"
            className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                  {presentation.galleryEyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
                  {presentation.galleryTitle?.trim() || "Recent work"}
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-500">
                {presentation.galleryDescription}
              </p>
            </div>

            {galleryItems.length > 0 ? (
              <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:px-7">
                {galleryItems.map((item, index) => {
                  const isSharedItem = item.slug === sharedGallerySlug;
                  return (
                    <article
                      id={`profile-gallery-${item.slug}`}
                      key={item.slug}
                      className={`group relative aspect-[4/3] w-[76vw] max-w-[300px] flex-none snap-start overflow-hidden rounded-2xl border bg-black ${
                        isSharedItem
                          ? "border-ts-orange ring-2 ring-ts-orange/40"
                          : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          trackProfileAction({
                            profileSlug,
                            action: "gallery",
                            surface: "work_carousel",
                            detail: item.slug,
                          });
                          setActiveGalleryIndex(index);
                        }}
                        className="absolute inset-0 h-full w-full text-left"
                        aria-label={`Open ${item.title}`}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.imageAlt}
                          loading={index < 2 ? "eager" : "lazy"}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/5 to-transparent" />
                        <span className="absolute inset-x-0 bottom-0 p-4">
                          <span className="block text-sm font-black text-white">{item.title}</span>
                          {item.description ? (
                            <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-white/70">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <ShareButton
                        destination={
                          buildProfilePublicItemPath({
                            profileBasePath: profileShareDestination,
                            itemType: "gallery",
                            itemSlug: item.slug,
                            contentBlocks: publicRouteContentBlocks,
                          }) || profileShareDestination
                        }
                        title={`${item.title} | ${businessName}`}
                        text={presentation.galleryShareText}
                        variant="outline"
                        label={`Share ${item.title}`}
                        className="absolute right-2 top-2 z-10 h-9 border-white/20 bg-black/55 text-white hover:bg-black/75 hover:text-white"
                      />
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section
            id="company"
            className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div
              className={presentation.aboutImage ? "grid md:grid-cols-[230px_minmax(0,1fr)]" : ""}
            >
              {presentation.aboutImage ? (
                <div className="relative min-h-[230px] overflow-hidden">
                  <img
                    src={presentation.aboutImage}
                    alt={presentation.aboutImageAlt || presentation.aboutTitle}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
                  />
                </div>
              ) : null}
              <div className="p-5 sm:p-7">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                  {presentation.aboutEyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
                  {presentation.aboutTitle}
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{presentation.aboutBody}</p>
                {presentation.commitments?.length ? (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {presentation.commitments.map((commitment) => (
                      <p
                        key={commitment}
                        className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-700" />
                        {commitment}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {publicRecommendations.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950">
                Customer recommendations
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {publicRecommendations.slice(0, 6).map((entry) => (
                  <article key={entry.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-black text-slate-950">{entry.customerName || "Customer"}</p>
                    {entry.projectType ? (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                        {entry.projectType}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm leading-6 text-slate-600">{entry.comment}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {profileItems ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              {profileItems}
            </section>
          ) : null}
        </div>

        <aside id="details" className="scroll-mt-24 space-y-5 lg:sticky lg:top-24">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Business details</h2>

            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 flex-none text-sky-700" />
                <div>
                  <p className="font-black text-slate-900">{presentation.locationLabel}</p>
                  {presentation.addressLabel ? (
                    <p className="mt-1 leading-5 text-slate-600">{presentation.addressLabel}</p>
                  ) : null}
                </div>
              </div>

              {presentation.hoursLabel ? (
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 h-5 w-5 flex-none text-sky-700" />
                  <div>
                    <p className="font-black text-slate-900">{presentation.hoursLabel}</p>
                    {presentation.hoursNote ? (
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {presentation.hoursNote}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Service areas
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {presentation.serviceAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </article>

          {presentation.financingTitle && presentation.financingDescription ? (
            <article className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <WalletCards className="mt-0.5 h-6 w-6 flex-none text-sky-700" />
                <div>
                  {presentation.financingProvider ? (
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
                      Financing · {presentation.financingProvider}
                    </p>
                  ) : null}
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    {presentation.financingTitle}
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                {presentation.financingDescription}
              </p>
              <button
                type="button"
                onClick={() => openProtectedContact("financing", "details_sidebar")}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Ask about financing
                <ChevronRight className="h-4 w-4" />
              </button>
            </article>
          ) : null}

          {hasTrustDetails ? (
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    {isVerified ? "Verification" : "Business details"}
                  </p>
                  <h2 className="text-lg font-black text-slate-950">Credentials and trust</h2>
                </div>
              </div>

              {isVerified ? (
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  {presentation.verificationHistoryNote ||
                    "TradeScout verification confirms the business identity and onboarding record."}
                </p>
              ) : null}

              {hasCredentials ? (
                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                    View credential numbers ({presentation.credentials.length})
                  </summary>
                  <div className="mt-4 divide-y divide-slate-200">
                    {presentation.credentials.map((credential) => (
                      <div
                        key={`${credential.label}-${credential.value}`}
                        className="py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                              {credential.label}
                            </p>
                            <p className="mt-1 font-black text-slate-950">{credential.value}</p>
                          </div>
                          {credential.verificationUrl ? (
                            <a
                              href={credential.verificationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex flex-none items-center gap-1 text-xs font-black text-sky-700 hover:underline"
                            >
                              Verify
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                        {credential.authority ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {credential.authority}
                          </p>
                        ) : null}
                        {credential.statusLabel ? (
                          <p className="mt-2 text-xs font-bold leading-5 text-amber-700">
                            {credential.statusLabel}
                          </p>
                        ) : null}
                        {credential.checkedAt ? (
                          <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-slate-400">
                            Source reviewed {credential.checkedAt}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {presentation.credentialDisclosure ? (
                    <p className="mt-4 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">
                      {presentation.credentialDisclosure}
                    </p>
                  ) : null}
                </details>
              ) : null}

              {verificationScore !== null ? (
                <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                    Community Verification Score · {verificationScore}
                  </summary>
                  <div className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
                    <p>
                      Active policy boosts: +{activeBoostPoints}. Score history begins{" "}
                      {scoreHistoryStart || "when enough governed history is available"}.
                    </p>
                    {typeof communityVerification?.scoreChange30d === "number" ? (
                      <p>
                        30-day change: {communityVerification.scoreChange30d > 0 ? "+" : ""}
                        {Math.round(communityVerification.scoreChange30d)}
                        {score30dComparedAt ? ` compared with ${score30dComparedAt}` : ""}.
                      </p>
                    ) : (
                      <p>30-day comparison is not available yet.</p>
                    )}
                  </div>
                </details>
              ) : null}
            </article>
          ) : null}

          <div className="rounded-3xl bg-[var(--service-surface)] p-4 text-white shadow-sm">
            {trustActions}
          </div>
        </aside>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <a
            href={qualifyPublicProfileItemDestination("/", platformBaseHref)}
            className="text-sm font-bold text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
          >
            Powered by TradeScout
          </a>
          <p className="text-xs text-slate-400">Connection Without Compromise</p>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.14)] backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={() => openProtectedContact("request", "mobile_bar")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ts-orange px-4 text-sm font-black text-white"
        >
          <MessageCircle className="h-4 w-4" />
          {presentation.primaryActionLabel || "Start a Request"}
        </button>
        <button
          type="button"
          onClick={() => openProtectedContact("call", "mobile_bar")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-800"
        >
          <Phone className="h-4 w-4" />
          {presentation.callActionLabel || "Call"}
        </button>
      </div>

      {activeGalleryItem && activeGalleryIndex !== null ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} photo gallery`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveGalleryIndex(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-black text-white">{activeGalleryItem.title}</p>
                {activeGalleryItem.description ? (
                  <p className="truncate text-xs text-slate-400">{activeGalleryItem.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveGalleryIndex(null)}
                className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close gallery"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              <img
                src={activeGalleryItem.imageUrl}
                alt={activeGalleryItem.imageAlt}
                className="max-h-[76vh] w-full object-contain"
              />
              {galleryItems.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveGalleryIndex((current) =>
                        current === null
                          ? null
                          : (current - 1 + galleryItems.length) % galleryItems.length
                      )
                    }
                    className="absolute left-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-black/80"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveGalleryIndex((current) =>
                        current === null ? null : (current + 1) % galleryItems.length
                      )
                    }
                    className="absolute right-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-black/80"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
              <p className="text-xs text-slate-500">
                {activeGalleryIndex + 1} of {galleryItems.length}
              </p>
              <ShareButton
                destination={
                  buildProfilePublicItemPath({
                    profileBasePath: profileShareDestination,
                    itemType: "gallery",
                    itemSlug: activeGalleryItem.slug,
                    contentBlocks: publicRouteContentBlocks,
                  }) || profileShareDestination
                }
                title={`${activeGalleryItem.title} | ${businessName}`}
                text={presentation.galleryShareText}
                variant="outline"
                label={`Share ${activeGalleryItem.title}`}
                className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const ProjectServiceProfile = lazy(() => import("./ProjectServiceProfile"));

export default function LocalServiceProfileTheme(props: LocalServiceProfileProps) {
  return props.presentation.layout === "project-profile" ? (
    <ProjectServiceProfile {...props} />
  ) : (
    <CompactLocalServiceProfileTheme {...props} />
  );
}
