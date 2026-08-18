import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  Sparkles,
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

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  businessName: string;
  presentation: LocalServiceProfilePresentation;
  onDirectConnect: () => void;
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

function trackProfileAction(args: {
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

export default function LocalServiceProfileTheme({
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
}: Props) {
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);
  const publicRecommendations = useMemo(
    () =>
      recommendationsDirectory.filter(
        (entry) => entry.recommendationType === "positive" && entry.comment.trim().length > 0
      ),
    [recommendationsDirectory]
  );
  const missionEyebrow = presentation.missionEyebrow || presentation.eyebrow;
  const missionStatement = presentation.missionStatement || presentation.heroTitle;
  const commitments =
    presentation.commitments?.filter((commitment) => commitment.trim().length > 0) || [];
  const serviceGroups =
    presentation.serviceGroups?.filter((group) => group.services.length > 0) || [];
  const activeGalleryItem =
    activeGalleryIndex === null ? null : galleryItems[activeGalleryIndex] || null;
  const isVerified =
    verifiedBadge === true && String(verificationStatus || "").toLowerCase() === "approved";
  const verificationScore =
    typeof communityVerification?.score === "number" &&
    Number.isFinite(communityVerification.score)
      ? Math.max(0, Math.round(communityVerification.score))
      : null;
  const scoreHistoryStart = formatScoreHistoryDate(
    communityVerification?.scoreHistoryStartsAt
  );
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
    onDirectConnect();
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
      className="min-h-screen bg-[var(--service-background)] text-slate-100"
      data-testid="local-service-profile-theme"
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 shadow-[0_10px_35px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:h-20 sm:gap-3 sm:px-6">
          <a
            href={tradeScoutReturnHref}
            aria-label="Return to TradeScout"
            className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/10 text-white/70 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>

          <div className="flex min-w-0 flex-1 items-center sm:flex-none">
            <div className="flex h-10 w-[150px] items-center justify-center overflow-hidden rounded-xl bg-white px-2 shadow-sm sm:h-14 sm:w-[245px] sm:px-4">
              <img
                src={presentation.logoImage}
                alt={presentation.logoAlt}
                className="h-full w-full object-contain contrast-125"
              />
            </div>
          </div>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Profile sections">
            {[
              ["Services", "services"],
              ["Work", "work"],
              ["Company", "company"],
              ["Verify", "verify"],
            ].map(([label, sectionId]) => (
              <button
                key={sectionId}
                type="button"
                onClick={() =>
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-full px-3 py-2 text-xs font-bold text-white/65 transition hover:bg-white/5 hover:text-white"
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => openProtectedContact("request", "header")}
            className="ml-auto inline-flex min-h-10 flex-none items-center justify-center gap-2 rounded-full bg-ts-orange px-4 text-xs font-black text-white transition hover:bg-ts-orange-dark sm:px-5 sm:text-sm lg:ml-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden min-[430px]:inline">
              {presentation.primaryActionLabel || "Start a Request"}
            </span>
          </button>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <img
          src={presentation.heroImage}
          alt={presentation.heroImageAlt}
          className="absolute inset-0 h-full w-full object-cover object-[65%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,18,0.99)_0%,rgba(2,12,18,0.92)_45%,rgba(2,12,18,0.46)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--service-background)] to-transparent" />

        <div className="relative mx-auto grid min-h-[680px] max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:py-20">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white backdrop-blur-md">
                <MapPin className="h-3.5 w-3.5 text-[var(--service-brand)]" />
                {presentation.locationLabel}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-950/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 backdrop-blur-md">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified TradeScout provider
                </span>
              ) : null}
            </div>

            <p className="mt-7 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--service-brand)]">
              {missionEyebrow}
            </p>
            <p className="mt-2 max-w-2xl text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
              {missionStatement}
            </p>
            <h1 className="mt-5 max-w-3xl text-[2.5rem] font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl lg:text-[4.6rem]">
              {presentation.heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
              {presentation.heroDescription}
            </p>
          </div>

          <aside className="rounded-[1.75rem] border border-white/15 bg-slate-950/88 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--service-brand)]">
              Choose how to start
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
              Get the job in front of LA Plumbing.
            </h2>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => openProtectedContact("request", "hero")}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-ts-orange px-6 text-base font-black text-white transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
              >
                <MessageCircle className="h-5 w-5" />
                {presentation.primaryActionLabel || "Start a Request"}
              </button>
              <button
                type="button"
                onClick={() => openProtectedContact("call", "hero")}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--service-brand)]/45 bg-[var(--service-brand)]/10 px-6 text-base font-black text-white transition hover:-translate-y-0.5 hover:border-[var(--service-brand)]/70 hover:bg-[var(--service-brand)]/15"
                aria-label={`${presentation.callActionLabel || "Call"} through protected contact options`}
              >
                <Phone className="h-5 w-5 text-[var(--service-brand)]" />
                {presentation.callActionLabel || "Call"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {presentation.directionsUrl ? (
                <a
                  href={presentation.directionsUrl}
                  {...externalActionProps({
                    profileSlug,
                    action: "directions",
                    surface: "hero",
                  })}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <MapPin className="h-4 w-4 text-[var(--service-brand)]" />
                  {presentation.directionsActionLabel || "Directions"}
                </a>
              ) : null}
              {presentation.websiteUrl ? (
                <a
                  href={presentation.websiteUrl}
                  {...externalActionProps({
                    profileSlug,
                    action: "website",
                    surface: "hero",
                  })}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <Globe2 className="h-4 w-4 text-[var(--service-brand)]" />
                  {presentation.websiteActionLabel || "Website"}
                </a>
              ) : null}
            </div>

            <div className="mt-5 space-y-3 border-t border-white/10 pt-5 text-sm">
              {presentation.addressLabel ? (
                <p className="flex items-start gap-3 text-slate-300">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-[var(--service-brand)]" />
                  {presentation.addressLabel}
                </p>
              ) : null}
              {presentation.hoursLabel ? (
                <p className="flex items-start gap-3 text-slate-300">
                  <CalendarClock className="mt-0.5 h-4 w-4 flex-none text-[var(--service-brand)]" />
                  {presentation.hoursLabel}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[var(--service-surface)] px-4 py-4 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {presentation.highlights.map((highlight) => (
            <div
              key={highlight}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3"
            >
              <Check className="h-4 w-4 flex-none text-[var(--service-brand)]" />
              <p className="text-sm font-bold leading-5 text-slate-100">{highlight}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="border-b border-white/10 bg-[var(--service-surface)] px-4 py-4 sm:px-6"
        aria-label="Trust and profile actions"
        data-testid="profile-trust-section"
      >
        <div className="mx-auto max-w-4xl">{trustActions}</div>
      </section>

      <section id="services" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
              {presentation.servicesEyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.05em] text-white sm:text-5xl">
              {presentation.servicesTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              {presentation.serviceNote}
            </p>
          </div>

          {serviceGroups.length > 0 ? (
            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {serviceGroups.map((group) => (
                <article
                  key={group.title}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-[var(--service-surface)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={group.imageUrl}
                      alt={group.imageAlt}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-[var(--service-surface)] via-transparent to-transparent" />
                  </div>
                  <div className="-mt-8 relative p-5 sm:p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--service-brand)]">
                      {group.eyebrow}
                    </p>
                    <h3 className="mt-2 text-2xl font-black leading-tight text-white">
                      {group.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{group.description}</p>
                    <ul className="mt-5 space-y-2.5">
                      {group.services.map((service) => (
                        <li
                          key={service}
                          className="flex items-start gap-2.5 text-sm leading-6 text-slate-200"
                        >
                          <Check className="mt-1 h-3.5 w-3.5 flex-none text-[var(--service-brand)]" />
                          {service}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() =>
                        openProtectedContact("service", "service_group", group.title)
                      }
                      className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-ts-orange/35 bg-ts-orange/10 px-5 text-sm font-black text-ts-orange transition hover:border-ts-orange/60 hover:bg-ts-orange/15"
                    >
                      Start this request
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presentation.services.map((service) => {
              const Icon = iconByName[service.icon] || Wrench;
              return (
                <button
                  key={service.title}
                  type="button"
                  onClick={() =>
                    openProtectedContact("service", "service_list", service.title)
                  }
                  className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--service-brand)]/45 hover:bg-white/[0.045]"
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--service-brand)]/10 text-[var(--service-brand)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-black text-white">{service.title}</span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-400">
                      {service.description}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-ts-orange">
                      Start a Request
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="work"
        className="scroll-mt-24 border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
                {presentation.galleryEyebrow}
              </p>
              <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.05em] text-white sm:text-5xl">
                {presentation.galleryTitle}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-400">
              {presentation.galleryDescription}
            </p>
          </div>

          {galleryItems.length > 0 ? (
            <div className="-mx-4 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
              {galleryItems.map((item, index) => {
                const isSharedItem = item.slug === sharedGallerySlug;
                return (
                  <article
                    id={`profile-gallery-${item.slug}`}
                    key={item.slug}
                    className={`group relative aspect-[4/3] w-[82vw] max-w-[420px] flex-none snap-start overflow-hidden rounded-3xl border bg-black ${
                      isSharedItem
                        ? "border-ts-orange ring-2 ring-ts-orange/50"
                        : "border-white/10"
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
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/5 to-black/10" />
                      <span className="absolute inset-x-0 bottom-0 p-5">
                        <span className="block text-base font-black text-white">{item.title}</span>
                        {item.description ? (
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-white/65">
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
                      className="absolute right-3 top-3 z-10 border-white/20 bg-black/55 text-white hover:bg-black/75 hover:text-white"
                    />
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section id="company" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--service-surface)] md:grid-cols-[0.82fr_1.18fr]">
            {presentation.aboutImage ? (
              <div className="relative min-h-[340px] overflow-hidden">
                <img
                  src={presentation.aboutImage}
                  alt={presentation.aboutImageAlt || presentation.aboutTitle}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
            ) : null}
            <div className="flex flex-col justify-center p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
                {presentation.aboutEyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-4xl">
                {presentation.aboutTitle}
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-300">{presentation.aboutBody}</p>
              {commitments.length > 0 ? (
                <div className="mt-6 grid gap-2">
                  {commitments.map((commitment) => (
                    <p
                      key={commitment}
                      className="flex items-start gap-3 text-sm leading-6 text-slate-200"
                    >
                      <Check className="mt-1 h-3.5 w-3.5 flex-none text-[var(--service-brand)]" />
                      {commitment}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </article>

          <div className="grid gap-5">
            <article className="rounded-3xl border border-white/10 bg-[var(--service-surface)] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-[var(--service-brand)]" />
                <h2 className="text-2xl font-black text-white">Where the team works</h2>
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
              {presentation.hoursLabel ? (
                <p className="mt-5 flex items-start gap-2 text-xs font-bold leading-5 text-slate-400">
                  <CalendarClock className="mt-0.5 h-4 w-4 flex-none text-[var(--service-brand)]" />
                  <span>
                    {presentation.hoursLabel}
                    {presentation.hoursNote ? (
                      <span className="mt-1 block font-normal text-slate-500">
                        {presentation.hoursNote}
                      </span>
                    ) : null}
                  </span>
                </p>
              ) : null}
            </article>

            {presentation.financingTitle && presentation.financingDescription ? (
              <article className="rounded-3xl border border-[var(--service-brand)]/25 bg-[var(--service-brand)]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <WalletCards className="h-6 w-6 text-[var(--service-brand)]" />
                  <div>
                    {presentation.financingProvider ? (
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200/70">
                        Current provider · {presentation.financingProvider}
                      </p>
                    ) : null}
                    <h2 className="mt-1 text-2xl font-black text-white">
                      {presentation.financingTitle}
                    </h2>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {presentation.financingDescription}
                </p>
                <button
                  type="button"
                  onClick={() => openProtectedContact("financing", "financing")}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  Ask about financing
                  <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="verify"
        className="scroll-mt-24 border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-white/10 bg-[var(--service-surface)] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
                    Verify before regulated work
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                    {presentation.credentialLabel}
                  </h2>
                </div>
                <ShieldCheck className="h-8 w-8 flex-none text-emerald-300" />
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {presentation.credentials.map((credential) => (
                  <div
                    key={`${credential.label}-${credential.value}`}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {credential.label}
                    </p>
                    <p className="mt-1.5 text-lg font-black text-white">{credential.value}</p>
                    {credential.authority ? (
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {credential.authority}
                      </p>
                    ) : null}
                    {credential.statusLabel ? (
                      <p className="mt-2 text-xs font-bold leading-5 text-amber-200">
                        {credential.statusLabel}
                      </p>
                    ) : null}
                    {credential.checkedAt ? (
                      <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        Source reviewed {credential.checkedAt}
                      </p>
                    ) : null}
                    {credential.verificationUrl ? (
                      <a
                        href={credential.verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[var(--service-brand)] hover:underline"
                      >
                        Verify with the authority
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {credential.note ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">{credential.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {presentation.credentialDisclosure ? (
                <p className="mt-5 text-xs leading-6 text-slate-400">
                  {presentation.credentialDisclosure}
                </p>
              ) : null}
            </article>

            <div className="grid gap-5">
              <article className="rounded-3xl border border-white/10 bg-[var(--service-surface)] p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-6 w-6 text-emerald-300" />
                  <h2 className="text-2xl font-black text-white">
                    What TradeScout verification means
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {presentation.verificationHistoryNote ||
                    "TradeScout verification confirms the business identity and onboarding record."}
                </p>

                {verificationScore !== null ? (
                  <details className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <summary className="cursor-pointer list-none font-black text-white">
                      Community Verification Score · {verificationScore}
                    </summary>
                    <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                      <p>
                        Active policy boosts: +{activeBoostPoints}. Score history begins{" "}
                        {scoreHistoryStart || "when enough governed history is available"}.
                      </p>
                      {typeof communityVerification?.scoreChange30d === "number" ? (
                        <p>
                          30-day change:{" "}
                          {communityVerification.scoreChange30d > 0 ? "+" : ""}
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

              <article className="rounded-3xl border border-white/10 bg-[var(--service-surface)] p-6 sm:p-8">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--service-brand)]">
                  Current source decision
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">One current record, not blended claims.</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {presentation.sourceSummary}
                </p>
                {presentation.sourceCheckedAt ? (
                  <p className="mt-4 text-xs font-bold text-slate-500">
                    Source set reviewed {presentation.sourceCheckedAt}
                  </p>
                ) : null}
              </article>
            </div>
          </div>
        </div>
      </section>

      {publicRecommendations.length > 0 ? (
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-[var(--service-brand)]" />
              <h2 className="text-3xl font-black tracking-[-0.035em] text-white">
                Customer recommendations
              </h2>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {publicRecommendations.slice(0, 6).map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <p className="font-black text-white">{entry.customerName || "Customer"}</p>
                  {entry.projectType ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--service-brand)]">
                      {entry.projectType}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm leading-6 text-slate-300">{entry.comment}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {profileItems ? (
        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-7xl">{profileItems}</div>
        </section>
      ) : null}

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--service-surface)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
              Start here
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl">
              {presentation.requestTitle}
            </h2>
            {presentation.requestDescription ? (
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                {presentation.requestDescription}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openProtectedContact("request", "final_cta")}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-8 text-base font-black text-white transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
              >
                {presentation.primaryActionLabel || "Start a Request"}
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => openProtectedContact("call", "final_cta")}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 text-base font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Phone className="h-5 w-5 text-[var(--service-brand)]" />
                {presentation.callActionLabel || "Call"}
              </button>
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden lg:min-h-[560px]">
            <img
              src={presentation.serviceGroups?.[0]?.imageUrl || presentation.heroImage}
              alt={presentation.serviceGroups?.[0]?.imageAlt || presentation.heroImageAlt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[var(--service-surface)]/30 lg:to-transparent" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-7 text-center sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <a
            href={qualifyPublicProfileItemDestination("/", platformBaseHref)}
            className="inline-flex min-h-11 items-center justify-center rounded-md px-2 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/80"
          >
            Powered by TradeScout
          </a>
          <ShareButton
            destination={profileShareDestination}
            title={businessName}
            text={`${presentation.eyebrow} in ${presentation.locationLabel}`}
            variant="outline"
            label={`Share ${businessName}`}
            className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          />
        </div>
      </footer>

      {activeGalleryItem && activeGalleryIndex !== null ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} completed work gallery`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveGalleryIndex(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-black text-white">{activeGalleryItem.title}</p>
                {activeGalleryItem.description ? (
                  <p className="truncate text-xs text-slate-400">
                    {activeGalleryItem.description}
                  </p>
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
