import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  HardHat,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";
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
  galleryItems?: ResolvedProfileGalleryItem[];
  sharedGallerySlug?: string | null;
  recommendationsDirectory?: RecommendationEntry[];
  trustActions?: ReactNode;
  profileItems?: ReactNode;
  verificationStatus?: string | null;
  verifiedBadge?: boolean;
  communityVerification?: PublicCommunityVerification | null;
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

function isLandscapeServiceImage(imageUrl: string): boolean {
  return /\/(?:bathroom|water-heaters)\.(?:jpe?g|png|webp)(?:\?|$)/i.test(imageUrl);
}

export default function LocalServiceProfileTheme({
  profileSlug,
  platformBaseHref = "",
  businessName,
  presentation,
  onDirectConnect,
  hasViewerSession,
  tradeScoutReturnHref,
  profileShareDestination,
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
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );
  const missionEyebrow = presentation.missionEyebrow || presentation.eyebrow;
  const missionStatement = presentation.missionStatement || presentation.heroTitle;
  const commitments =
    presentation.commitments?.filter((commitment) => commitment.trim().length > 0) || [];
  const serviceGroups =
    presentation.serviceGroups?.filter((group) => group.services.length > 0) || [];
  const themeStyle = {
    "--service-brand": presentation.brand.primary,
    "--service-brand-dark": presentation.brand.primaryDark,
    "--service-surface": presentation.brand.surface,
    "--service-background": presentation.brand.background,
  } as CSSProperties;
  const isVerified =
    verifiedBadge === true && String(verificationStatus || "").toLowerCase() === "approved";
  const normalizedVerificationScore =
    typeof communityVerification?.score === "number" && Number.isFinite(communityVerification.score)
      ? Math.max(0, Math.round(communityVerification.score))
      : null;
  const normalizedActiveBoostPoints =
    typeof communityVerification?.activePolicyBoostPoints === "number" &&
    Number.isFinite(communityVerification.activePolicyBoostPoints)
      ? Math.max(0, Math.round(communityVerification.activePolicyBoostPoints))
      : 0;
  const normalizedScoreChange30d =
    typeof communityVerification?.scoreChange30d === "number" &&
    Number.isFinite(communityVerification.scoreChange30d)
      ? Math.round(communityVerification.scoreChange30d)
      : null;
  const normalizedLifetimeScoreChange =
    typeof communityVerification?.lifetimeScoreChange === "number" &&
    Number.isFinite(communityVerification.lifetimeScoreChange)
      ? Math.round(communityVerification.lifetimeScoreChange)
      : null;
  const scoreHistoryStart = formatScoreHistoryDate(communityVerification?.scoreHistoryStartsAt);
  const score30dComparedAt = formatScoreHistoryDate(
    communityVerification?.scoreChange30dComparedAt
  );
  const activeBoosts = Array.isArray(communityVerification?.activeBoosts)
    ? communityVerification.activeBoosts
    : [];
  const profileBadges = Array.isArray(communityVerification?.badges)
    ? communityVerification.badges
    : [];
  const verificationHistoryNote = (
    presentation as LocalServiceProfilePresentation & { verificationHistoryNote?: string }
  ).verificationHistoryNote;
  const activeGalleryItem =
    activeGalleryIndex === null ? null : galleryItems[activeGalleryIndex] || null;

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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#041017]/95 shadow-[0_10px_35px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-2.5 sm:h-20 sm:gap-3 sm:px-6">
          <a
            href={tradeScoutReturnHref}
            aria-label={
              hasViewerSession
                ? `Close ${businessName} and return to Direct Connect`
                : `Close ${businessName} and return to TradeScout`
            }
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </a>

          <div className="flex min-w-0 flex-1 items-center sm:flex-none">
            <div className="flex h-10 w-[142px] items-center justify-center overflow-hidden rounded-xl bg-white px-2 shadow-sm sm:h-14 sm:w-[245px] sm:px-4">
              <img
                src={presentation.logoImage}
                alt={presentation.logoAlt}
                className="h-full w-full object-contain contrast-125"
              />
            </div>
          </div>

          <nav
            className="ml-auto hidden items-center gap-1 lg:flex"
            aria-label={`${businessName} sections`}
          >
            {[
              ["Work", "work"],
              ["Our story", "story"],
              ["Services", "services"],
              ["Trust", "trust"],
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
            onClick={onDirectConnect}
            aria-label={`Direct Connect with ${businessName}`}
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-ts-orange/35 bg-ts-orange/10 text-xs font-black text-ts-orange transition hover:border-ts-orange/60 hover:bg-ts-orange/15 hover:text-ts-orange-light sm:w-auto sm:gap-2 sm:px-5"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Direct Connect</span>
          </button>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[var(--service-background)] lg:min-h-[720px]">
        <img
          src={presentation.heroImage}
          alt={presentation.heroImageAlt}
          className="h-[430px] w-full object-cover object-[58%_center] sm:h-[520px] lg:absolute lg:inset-0 lg:h-full lg:object-[68%_center]"
        />
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(2,12,18,0.99)_0%,rgba(2,12,18,0.91)_44%,rgba(2,12,18,0.32)_82%)] lg:block" />
        <div className="absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-t from-[var(--service-background)] to-transparent lg:block" />

        <div className="relative mx-auto grid max-w-7xl gap-8 bg-[var(--service-background)] px-4 pb-12 pt-10 sm:px-6 lg:min-h-[720px] lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:bg-transparent lg:pb-14 lg:pt-20">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white backdrop-blur-md">
                <MapPin className="h-3.5 w-3.5 text-[var(--service-brand)]" />
                {presentation.locationLabel}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-950/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 backdrop-blur-md">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified by TradeScout
                </span>
              ) : null}
            </div>

            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--service-brand)]">
              {missionEyebrow}
            </p>
            <p className="mt-2 max-w-2xl text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
              {missionStatement}
            </p>
            <h1 className="mt-5 max-w-3xl text-[2.25rem] font-black leading-[1] tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.1rem] lg:leading-[0.98]">
              {presentation.heroTitle}
            </h1>
            <p className="mt-5 line-clamp-4 max-w-2xl text-[15px] leading-7 text-slate-200 sm:line-clamp-none sm:text-lg sm:leading-8">
              {presentation.heroDescription}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onDirectConnect}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-sm font-black text-white shadow-[0_18px_50px_rgba(249,115,22,0.3)] transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
              >
                Direct Connect
                <ChevronRight className="h-4 w-4" />
              </button>
              <ShareButton
                destination={profileShareDestination}
                title={businessName}
                text={`${presentation.eyebrow} in ${presentation.locationLabel}`}
                variant="outline"
                label={`Share ${businessName}`}
                className="min-h-13 rounded-full border-white/20 bg-black/30 px-6 text-white hover:bg-white/10 hover:text-white"
              />
            </div>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-white/60">
              Call or send the job details privately. Contact information stays protected unless the
              connection is accepted.
            </p>
          </div>

          <aside className="rounded-3xl border border-white/15 bg-[#061821]/92 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-6 lg:mb-0">
            {normalizedVerificationScore !== null ? (
              <div
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
                data-testid="community-verification-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                      Community Verification Score
                    </p>
                    <p className="mt-1 text-5xl font-black tracking-[-0.055em] text-white">
                      {normalizedVerificationScore}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ShieldCheck className="h-7 w-7 flex-none text-emerald-300" />
                    {normalizedScoreChange30d === null ? (
                      <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">
                        30-day history unavailable
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <span className="block text-slate-400">Lifetime score change</span>
                    <strong className="mt-0.5 block text-white">
                      {normalizedLifetimeScoreChange === null
                        ? "Building history"
                        : `${normalizedLifetimeScoreChange > 0 ? "+" : ""}${normalizedLifetimeScoreChange}`}
                    </strong>
                    {normalizedLifetimeScoreChange !== null && scoreHistoryStart ? (
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        Since {scoreHistoryStart}
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <span className="block text-slate-400">30-day score change</span>
                    <strong className="mt-0.5 block text-white">
                      {normalizedScoreChange30d === null
                        ? "Building history"
                        : `${normalizedScoreChange30d > 0 ? "+" : ""}${normalizedScoreChange30d}`}
                    </strong>
                    {normalizedScoreChange30d !== null && score30dComparedAt ? (
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        Compared with {score30dComparedAt}
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-sky-400/10 px-3 py-2.5">
                    <span className="block text-sky-200/75">Active boosts</span>
                    <strong className="mt-0.5 block text-sky-100">
                      +{normalizedActiveBoostPoints}
                    </strong>
                  </div>
                </div>

                {activeBoosts.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Active score boosts">
                    {activeBoosts.map((boost) => (
                      <span
                        key={boost.policyKey}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/15 bg-sky-300/10 px-2.5 py-1 text-[10px] font-bold text-sky-100"
                      >
                        {boost.label}
                        <strong>+{Math.max(0, Math.round(boost.points))}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}

                {verificationHistoryNote ? (
                  <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-200/5 px-3 py-2 text-[11px] leading-5 text-amber-100/85">
                    {verificationHistoryNote}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                <BadgeCheck className="h-4 w-4 flex-none text-emerald-300" />
                <span className="text-slate-200">
                  {presentation.credentials.length} credentials listed by {businessName}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                <Sparkles className="h-4 w-4 flex-none text-[var(--service-brand)]" />
                <span className="text-slate-200">
                  {publicRecommendations.length > 0
                    ? `${publicRecommendations.length} customer recommendation${publicRecommendations.length === 1 ? "" : "s"} published`
                    : "0 customer recommendations have been published"}
                </span>
              </div>
            </div>

            {profileBadges.length > 0 ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Profile badges
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileBadges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-100"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {trustActions ? (
        <section className="border-y border-white/10 bg-[var(--service-surface)] px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">{trustActions}</div>
        </section>
      ) : null}

      <section className="relative z-10 -mt-1 border-y border-white/10 bg-[var(--service-surface)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-white/10 px-4 sm:grid-cols-4 sm:divide-y-0 sm:px-6">
          {presentation.highlights.map((highlight) => (
            <div
              key={highlight}
              className="flex min-h-20 items-center gap-3 px-3 py-4 sm:min-h-24 sm:px-5"
            >
              <BadgeCheck className="h-5 w-5 flex-none text-[var(--service-brand)]" />
              <p className="text-[13px] font-bold leading-5 text-slate-100 sm:text-sm">
                {highlight}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="work" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
                {presentation.galleryEyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">
                {presentation.galleryTitle}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-400">
              {presentation.galleryDescription} Open any photo full screen or share that exact job.
            </p>
          </div>

          {galleryItems.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item, index) => {
                const isSharedItem = item.slug === sharedGallerySlug;
                const isLandscape = isLandscapeServiceImage(item.imageUrl);
                return (
                  <article
                    id={`profile-gallery-${item.slug}`}
                    key={item.slug}
                    className={`group relative overflow-hidden rounded-2xl border bg-black ${
                      isLandscape ? "aspect-[4/3]" : "aspect-[3/4]"
                    } ${
                      isSharedItem ? "border-ts-orange ring-2 ring-ts-orange/50" : "border-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveGalleryIndex(index)}
                      className="absolute inset-0 h-full w-full text-left"
                      aria-label={`Open ${item.title}`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        loading={index < 3 ? "eager" : "lazy"}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/10" />
                      <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                        <span className="block text-sm font-black text-white sm:text-base">
                          {item.title}
                        </span>
                        {item.description ? (
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-white/65">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <ShareButton
                      destination={`${profileShareDestination}${buildProfileGalleryShareSearch(item.slug)}`}
                      title={`${item.title} from ${businessName}`}
                      text={`${presentation.galleryShareText} from ${businessName}`}
                      size="icon"
                      label=""
                      className="absolute right-3 top-3 z-10 border-white/20 bg-black/70 text-white hover:bg-black"
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-6">
              <p className="font-bold text-white">Completed work is being prepared.</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                This profile will update as project photos are published. Direct Connect is
                available now.
              </p>
            </div>
          )}
        </div>
      </section>

      {publicRecommendations.length > 0 ? (
        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-[var(--service-brand)]" />
              <h2 className="text-3xl font-black tracking-[-0.035em] text-white">
                Local recommendations
              </h2>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {publicRecommendations.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <p className="font-black text-white">
                    {entry.customerName || "TradeScout member"}
                  </p>
                  {entry.projectType ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--service-brand)]">
                      {entry.projectType}
                    </p>
                  ) : null}
                  {entry.comment ? (
                    <p className="mt-3 text-sm leading-6 text-slate-300">{entry.comment}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="border-y border-white/10 bg-[var(--service-surface)] px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-white">0 customer recommendations published.</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Customer recommendations will appear here after they are submitted and approved.
              </p>
            </div>
            <ShareButton
              destination={profileShareDestination}
              title={businessName}
              text={`See ${businessName} on TradeScout`}
              variant="outline"
              label={`Share ${businessName}`}
              className="w-fit flex-none rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            />
          </div>
        </section>
      )}

      <section id="story" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--service-surface)] lg:grid-cols-[0.85fr_1.15fr]">
          {presentation.aboutImage ? (
            <div className="relative aspect-[3/4] overflow-hidden lg:aspect-auto lg:min-h-[620px]">
              <img
                src={presentation.aboutImage}
                alt={presentation.aboutImageAlt || presentation.aboutTitle}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          ) : null}
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
              {presentation.aboutEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-5xl">
              {presentation.aboutTitle}
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">{presentation.aboutBody}</p>
            {commitments.length > 0 ? (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {commitments.map((commitment) => (
                  <div
                    key={commitment}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4"
                  >
                    <Check className="mt-0.5 h-4 w-4 flex-none text-[var(--service-brand)]" />
                    <p className="text-sm font-bold leading-6 text-slate-200">{commitment}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="services"
        className="scroll-mt-24 border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
              {presentation.servicesEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">
              {presentation.servicesTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              {presentation.serviceNote}
            </p>
          </div>

          {serviceGroups.length > 0 ? (
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {serviceGroups.map((group) => (
                <article
                  key={group.title}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-[var(--service-surface)]"
                >
                  <div
                    className={`relative overflow-hidden ${
                      isLandscapeServiceImage(group.imageUrl) ? "aspect-[4/3]" : "aspect-[3/4]"
                    }`}
                  >
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
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 open:bg-white/[0.04]">
            <summary className="cursor-pointer list-none font-black text-white">
              See the complete service list
            </summary>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {presentation.services.map((service) => {
                const Icon = iconByName[service.icon] || Wrench;
                return (
                  <div
                    key={service.title}
                    className="rounded-2xl border border-white/10 bg-black/15 p-4"
                  >
                    <Icon className="h-5 w-5 text-[var(--service-brand)]" />
                    <h3 className="mt-3 font-black text-white">{service.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{service.description}</p>
                  </div>
                );
              })}
            </div>
          </details>

          <button
            type="button"
            onClick={onDirectConnect}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-ts-orange/40 bg-ts-orange/10 px-7 text-sm font-black text-ts-orange transition hover:-translate-y-0.5 hover:border-ts-orange/65 hover:bg-ts-orange/15"
          >
            Direct Connect
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section id="trust" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-white/10 bg-[var(--service-surface)] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
                  Reviewed credentials
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
                  key={credential.label}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {credential.label}
                  </p>
                  <p className="mt-1.5 font-black text-white">{credential.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              {isVerified
                ? presentation.credentialDisclosure
                : "Credential review is in progress. This profile will update when the review is complete."}
            </p>
          </article>

          <div className="grid gap-5">
            <article className="rounded-3xl border border-white/10 bg-[var(--service-surface)] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-[var(--service-brand)]" />
                <h2 className="text-2xl font-black text-white">Southeast Louisiana coverage</h2>
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
                <p className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <CalendarClock className="h-4 w-4 text-[var(--service-brand)]" />
                  {presentation.hoursLabel}
                </p>
              ) : null}
            </article>

            {presentation.financingTitle && presentation.financingDescription ? (
              <article className="rounded-3xl border border-[var(--service-brand)]/25 bg-[var(--service-brand)]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <WalletCards className="h-6 w-6 text-[var(--service-brand)]" />
                  <h2 className="text-2xl font-black text-white">{presentation.financingTitle}</h2>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {presentation.financingDescription}
                </p>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      {profileItems ? (
        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-7xl">{profileItems}</div>
        </section>
      ) : null}

      <section className="px-4 py-16 text-white sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--service-surface)] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative aspect-[3/4] max-h-[620px] overflow-hidden lg:order-2 lg:aspect-auto lg:max-h-none lg:min-h-[560px]">
            <img
              src="/images/businesses/la-plumbing-solutions/mechanical-room.jpg"
              alt="Mechanical-room piping installed by LA Plumbing Solutions"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[#031017]/45 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#031017]/35 lg:to-transparent" />
          </div>
          <div className="flex max-w-3xl flex-col justify-center p-6 sm:p-10 lg:p-14">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--service-brand)]">
              Direct Connect
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-6xl">
              {presentation.requestTitle}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">
              {presentation.requestDescription}
            </p>
            <button
              type="button"
              onClick={onDirectConnect}
              className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-8 text-base font-black text-white shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
            >
              Direct Connect
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={businessName}
        platformBaseHref={platformBaseHref}
        className="border-t border-white/10"
      />

      <footer className="border-t border-white/10 px-4 py-7 text-center sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {businessName} on TradeScout · Connection Without Compromise
        </p>
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
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#041017] text-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <p className="text-sm font-black">{activeGalleryItem.title}</p>
                <p className="text-xs text-slate-400">
                  Completed work · Photo {activeGalleryIndex + 1} of {galleryItems.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton
                  destination={`${profileShareDestination}${buildProfileGalleryShareSearch(activeGalleryItem.slug)}`}
                  title={`${activeGalleryItem.title} from ${businessName}`}
                  text={`${presentation.galleryShareText} from ${businessName}`}
                  size="icon"
                  label=""
                  className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => setActiveGalleryIndex(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Close completed work gallery"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-[280px] flex-1 items-center justify-center bg-black">
              <img
                src={activeGalleryItem.imageUrl}
                alt={activeGalleryItem.imageAlt}
                className="max-h-[68vh] w-full object-contain"
              />
              {galleryItems.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveGalleryIndex(
                        (activeGalleryIndex - 1 + galleryItems.length) % galleryItems.length
                      )
                    }
                    className="absolute left-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 sm:left-4"
                    aria-label="Previous completed-work photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveGalleryIndex((activeGalleryIndex + 1) % galleryItems.length)
                    }
                    className="absolute right-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 sm:right-4"
                    aria-label="Next completed-work photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                type="button"
                onClick={() => setActiveGalleryIndex(null)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm font-black text-white hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to the profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveGalleryIndex(null);
                  onDirectConnect();
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ts-orange/40 bg-ts-orange/10 px-6 text-sm font-black text-ts-orange hover:border-ts-orange/65 hover:bg-ts-orange/15"
              >
                Direct Connect
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
