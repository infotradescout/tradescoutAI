import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEOHelmet } from "@/components/SEOHelmet";
import { getCategoryPlaceholderSrc } from "@/lib/categoryPlaceholders";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Calendar,
  Clock3,
  Compass,
  DollarSign,
  Flag,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Page } from "@/components/layout/PagePrimitives";
import { ShareButton } from "@/components/ShareButton";
import WholesalerProfileTheme from "@/pages/profile-sites/WholesalerProfileTheme";
import JrsAutoGlassProfileTheme from "@/pages/profile-sites/JrsAutoGlassProfileTheme";
import LocalServiceProfileTheme from "@/pages/profile-sites/LocalServiceProfileTheme";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import {
  PublicProfileItems,
  type CanonicalProfileItems,
} from "@/components/profile/PublicProfileItems";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import { createProfileInventoryItemShareMetadata } from "@shared/profileItemShare";
import {
  buildProfileGalleryShareSearch,
  createProfileGalleryItemShareMetadata,
  listProfileGalleryItems,
  resolveProfileGalleryItem,
} from "@shared/profileGalleryShare";
import { JRS_AUTO_GLASS_GALLERY_BLOCKS } from "@shared/jrsAutoGlassProfile";
import type { LocalServiceProfilePresentation } from "@shared/localServiceProfile";

// TradePartner is a paid tier: any business with `tradePartner: true` gets the
// richer branded layout, regardless of category. It is not tied to being a
// wholesaler/supplier specifically -- that's just who's bought it so far.
function isTradePartner(business: PublicBusinessSubset): boolean {
  return Boolean(business?.tradePartner);
}

function getSafeTradeScoutHome(): string {
  if (typeof window === "undefined") return "https://www.thetradescout.com/";
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1"
    ? `${window.location.origin}/`
    : "https://www.thetradescout.com/";
}

function getProfileNameFromSlug(value: string): string {
  const acronyms = new Set(["co", "inc", "la", "llc", "usa", "jw", "hvac"]);
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original URL segment when a shared link is malformed.
  }

  const words = decoded
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      acronyms.has(word.toLowerCase())
        ? word.toUpperCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
    );

  return words.join(" ") || "This TradeScout profile";
}

function ProfileArrivalState({
  slug,
  mode,
  onRetry,
}: {
  slug: string;
  mode: "early" | "retry";
  onRetry: () => void;
}) {
  const profileName = getProfileNameFromSlug(slug);
  const tradeScoutHome = getSafeTradeScoutHome();
  const scoutHref = new URL("scout", tradeScoutHome).toString();
  const communityHref = new URL("community-feed", tradeScoutHome).toString();
  const isRetry = mode === "retry";
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const reportThisLink = async () => {
    if (reportState === "sending" || reportState === "sent") return;
    setReportState("sending");
    try {
      const response = await fetch("/api/error-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: `Public profile link reported: ${profileName}`,
          description: `A visitor reported the ${mode} public-profile fallback at /u/${slug}.`,
          errorType: "ui_issue",
          currentUrl: window.location.href,
          userAgent: navigator.userAgent,
          browserInfo: { profileSlug: slug, arrivalMode: mode },
        }),
      });
      if (!response.ok) throw new Error("Report failed");
      setReportState("sent");
    } catch {
      setReportState("failed");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071016] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 16% 16%, rgba(249,115,22,.18), transparent 34%), radial-gradient(circle at 84% 26%, rgba(14,165,233,.16), transparent 36%), linear-gradient(145deg, #071016 0%, #0b1921 58%, #071016 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-16 h-80 w-80 rounded-full border border-ts-orange/20"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between py-2">
          <a
            href={tradeScoutHome}
            aria-label="Return to TradeScout"
            className="inline-flex items-center"
          >
            <img src="/tradescout-logo.png" alt="TradeScout" className="h-9 w-auto" />
          </a>
          <a
            href={tradeScoutHome}
            aria-label="Close this profile and return to TradeScout"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </a>
        </header>

        <section className="my-auto grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c171e]/95 shadow-[0_36px_110px_rgba(0,0,0,.45)] backdrop-blur-xl lg:grid-cols-[1.15fr_.85fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
              {isRetry ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isRetry ? "Quick pit stop" : "Opening soon"}
            </div>

            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-sky-300/80">
              {profileName}
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {isRetry ? "This page took a quick pit stop." : "You found it before opening day."}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              {isRetry
                ? "The profile is still here; it just did not finish loading. Your link is fine, so give it another try."
                : "This TradeScout profile is getting its finishing touches. Keep this link—when the doors open, it will happen right here."}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {isRetry ? (
                <Button
                  type="button"
                  onClick={onRetry}
                  className="h-12 rounded-full bg-ts-orange px-6 font-bold text-white shadow-lg shadow-orange-950/30 hover:bg-ts-orange-dark"
                >
                  Try again
                  <RefreshCw className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  asChild
                  className="h-12 rounded-full bg-ts-orange px-6 font-bold text-white shadow-lg shadow-orange-950/30 hover:bg-ts-orange-dark"
                >
                  <a href={communityHref}>
                    Browse the Community
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-white/15 bg-white/[0.04] px-6 font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <a href={scoutHref}>
                  <Compass className="mr-2 h-4 w-4" />
                  Open Scout
                </a>
              </Button>
              {!isRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex h-12 items-center justify-center gap-2 px-3 text-sm font-semibold text-white/60 transition hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Check again
                </button>
              ) : null}
              <button
                type="button"
                onClick={reportThisLink}
                disabled={reportState === "sending" || reportState === "sent"}
                className="inline-flex h-12 items-center justify-center gap-2 px-3 text-sm font-semibold text-white/60 transition hover:text-white disabled:cursor-default disabled:text-emerald-300"
                aria-live="polite"
              >
                <Flag className="h-4 w-4" />
                {reportState === "sending"
                  ? "Reporting…"
                  : reportState === "sent"
                    ? "Reported — thank you"
                    : reportState === "failed"
                      ? "Try reporting again"
                      : "Report this link"}
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden border-t border-white/10 bg-[#0a222d] p-8 lg:min-h-[600px] lg:border-l lg:border-t-0">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,.18),transparent_58%)]"
            />
            <div
              aria-hidden="true"
              className="absolute left-[12%] top-[14%] h-20 w-20 rounded-3xl border border-sky-300/20 bg-sky-300/[0.06] rotate-12"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-[10%] right-[10%] h-28 w-28 rounded-full border border-ts-orange/25 bg-ts-orange/[0.06]"
            />

            <div className="relative w-full max-w-sm rounded-[1.75rem] border border-white/12 bg-[#07141b]/90 p-6 shadow-2xl sm:p-8">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                    This address
                  </p>
                  <p className="mt-2 max-w-[240px] truncate font-semibold text-white/90">
                    /u/{slug}
                  </p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ts-orange text-white shadow-lg shadow-orange-950/40">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  "Right address",
                  isRetry ? "Loading again" : "Finishing touches",
                  "Public profile next",
                ].map((label, index) => (
                  <div
                    key={label}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                      index === 2
                        ? "border-ts-orange/25 bg-ts-orange/[0.08]"
                        : "border-white/8 bg-white/[0.035]"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        index === 2
                          ? "bg-ts-orange shadow-[0_0_18px_rgba(249,115,22,.8)]"
                          : "bg-emerald-400"
                      }`}
                    />
                    <span className="text-sm font-semibold text-white/76">{label}</span>
                  </div>
                ))}
              </div>

              <p className="mt-7 text-sm leading-6 text-white/48">
                No detour and no dead end. This same link is where the finished profile will live.
              </p>
            </div>
          </div>
        </section>

        <footer className="py-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
          Connection Without Compromise
        </footer>
      </div>
    </main>
  );
}

type ProfileSections = {
  about?: boolean;
  rolesAndBadges?: boolean;
  stats?: boolean;
  services?: boolean;
  marketplaceListings?: boolean;
  reviews?: boolean;
  communityActivity?: boolean;
  contactCard?: boolean;
};

type PublicProfile = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  roleContext: string;
  contentBlocks: any;
  ctaConfig: any;
  seoMeta: any;
  profileSections?: ProfileSections | null;
  contactPolicy?: {
    mode?: "direct_connect_only";
    requiresTradeScoutAccount?: boolean;
    reason?: string;
  } | null;
  profileBooking?: {
    enabled?: boolean;
    paidBookings?: boolean;
    bookingPriceUsd?: number;
    calendarVisibility?: "public" | "private";
    timezone?: string;
    slots?: Array<{
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      label?: string;
      active?: boolean;
    }>;
    pricingTableEnabled?: boolean;
    pricingRows?: Array<{
      id: string;
      name: string;
      priceLabel: string;
      description?: string;
    }>;
  } | null;
};

type PublicBusinessSubset = {
  id: string;
  name: string;
  categories: string[];
  serviceAreas: string[];
  tradePartner?: boolean;
  brandColors?: {
    primary?: string;
    primaryDark?: string;
    accent?: string;
    secondary?: string;
    background?: string;
    surface?: string;
  };
  directConnectOwnerUserId?: string;
  verificationStatus?: string | null;
  verifiedBadge?: boolean;
  cvsScore?: number | null;
  cvsPerformanceScore?: number | null;
  cvsBoostPoints?: number | null;
  trustComputedAt?: string | null;
  expressContactCapabilities?: {
    call?: boolean;
    request?: boolean;
  };
} | null;

type PublicProfileResponse = {
  profile: PublicProfile;
  business: PublicBusinessSubset;
  profileItems?: CanonicalProfileItems;
  recommendationsDirectory?: Array<{
    id: string;
    createdAt: string | null;
    recommendationType: "positive" | "negative";
    comment: string;
    projectType: string | null;
    contractor: {
      id: string;
      companyName: string;
      slug: string;
      canonicalBusinessProfileUrl?: string | null;
    };
  }>;
  recommendationDirectorySummary?: {
    total: number;
    positive: number;
    negative: number;
  };
};

export default function ProfileSiteView() {
  const { user, isAuthenticated } = useAuth();
  const [, paramsU] = useRoute("/u/:slug");
  const [matchP, paramsP] = useRoute("/p/:slug");
  const [location, navigate] = useLocation();
  // Custom-domain root has no /u/:slug in the path at all -- the server
  // tells us the slug directly via this injected global (see
  // injectCustomDomainProfileSlug in server/publicProfileHtml.ts).
  const customDomainSlug =
    typeof window !== "undefined"
      ? (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
          .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__
      : undefined;
  const slug = (paramsU?.slug || paramsP?.slug || customDomainSlug || "").trim();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expressPanelOpen, setExpressPanelOpen] = useState(false);

  // Public profiles are commonly opened from texts, social posts, and QR
  // codes. Add one same-page history boundary so the browser Back control can
  // return to a safe TradeScout destination instead of dropping the visitor
  // onto an unrelated external app or site.
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;

    const guardKey = "__tradeScoutProfileHistoryBoundary";
    const currentState = (window.history.state || {}) as Record<string, unknown>;
    let safeReturnHref = getSafeTradeScoutHome();

    try {
      const referrer = new URL(document.referrer);
      const current = new URL(window.location.href);
      const isTradeScoutReferrer =
        referrer.origin === current.origin || referrer.origin === "https://www.thetradescout.com";
      const isCanonicalAliasForThisProfile =
        referrer.origin === "https://www.thetradescout.com" &&
        [`/u/${encodeURIComponent(slug)}`, `/p/${encodeURIComponent(slug)}`].includes(
          referrer.pathname
        );
      const isSameProfile =
        isCanonicalAliasForThisProfile ||
        (referrer.origin === current.origin &&
          referrer.pathname === current.pathname &&
          referrer.search === current.search);
      if (isTradeScoutReferrer && !isSameProfile) safeReturnHref = referrer.toString();
    } catch {
      // Empty and malformed referrers use the canonical TradeScout home.
    }

    const handlePopState = () => {
      window.location.replace(safeReturnHref);
    };

    if (currentState[guardKey] !== slug) {
      window.history.pushState({ ...currentState, [guardKey]: slug }, "", window.location.href);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    if (matchP) {
      navigate(`/u/${encodeURIComponent(slug)}`, { replace: true });
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setNotFound(false);
        setLoadFailed(false);

        const response = await fetch(`/api/u/${encodeURIComponent(slug)}`);
        if (response.status === 404) {
          setData(null);
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch profile");

        const json = (await response.json()) as PublicProfileResponse;

        // A profile with a verified custom domain is canonically served
        // there. The server-rendered /u/:slug route already 301s for a full
        // page load; this covers client-side navigation to /u/:slug (e.g. an
        // in-app Link) that never hits that server route at all. Guard
        // against redirecting when we're already on that domain (e.g. this
        // component also renders profiles in place at their own custom
        // domain root) -- otherwise it's an infinite reload loop.
        const customDomain = json.profile?.seoMeta?.customDomain;
        if (
          typeof customDomain === "string" &&
          customDomain.trim() &&
          window.location.hostname.toLowerCase() !== customDomain.trim().toLowerCase()
        ) {
          const redirectUrl = new URL("/", `https://${customDomain.trim()}`);
          redirectUrl.search = window.location.search;
          redirectUrl.hash = window.location.hash;
          window.location.replace(redirectUrl.toString());
          return; // Stay in the loading state until the browser navigates away.
        }

        setData(json);
        setLoading(false);
      } catch (e) {
        console.error("Error fetching profile:", e);
        setData(null);
        setLoadFailed(true);
        setLoading(false);
      }
    };

    run();
  }, [slug, matchP, navigate, reloadKey]);

  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stone")) return;
    const sharedGalleryItem = resolveProfileGalleryItem(
      data.profile.contentBlocks,
      params.get("gallery")
    );
    if (!sharedGalleryItem) return;

    window.requestAnimationFrame(() => {
      document.getElementById(`profile-gallery-${sharedGalleryItem.slug}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
    });
  }, [data, location]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="ts-surface rounded-2xl px-6 py-8 text-center text-white md:px-10">
          <p className="text-lg font-semibold">Getting this page ready…</p>
          <p className="mt-2 text-sm text-white/60">The good stuff is almost here.</p>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <ProfileArrivalState
        slug={slug}
        mode="retry"
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  if (notFound || !data) {
    return (
      <ProfileArrivalState
        slug={slug}
        mode="early"
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  const { profile, business } = data;
  const profileItems = data.profileItems || {};
  const recommendationsDirectory = Array.isArray(data.recommendationsDirectory)
    ? data.recommendationsDirectory
    : [];
  const recommendationDirectorySummary = data.recommendationDirectorySummary || {
    total: recommendationsDirectory.length,
    positive: recommendationsDirectory.filter((row) => row.recommendationType === "positive")
      .length,
    negative: recommendationsDirectory.filter((row) => row.recommendationType === "negative")
      .length,
  };
  const profileSections = profile.profileSections || {};
  const showContactCard = profileSections.contactCard !== false;
  const booking = profile.profileBooking || {};
  const bookingEnabled = booking.enabled === true;
  const paidBookings = booking.paidBookings === true;
  const bookingPriceUsd = Number(booking.bookingPriceUsd || 0);
  const calendarVisibility = booking.calendarVisibility === "private" ? "private" : "public";
  const slots = Array.isArray(booking.slots)
    ? booking.slots.filter((slot) => slot && slot.active !== false)
    : [];
  const pricingRows = Array.isArray(booking.pricingRows) ? booking.pricingRows : [];
  const timezone =
    typeof booking.timezone === "string" && booking.timezone.trim().length > 0
      ? booking.timezone
      : "America/Chicago";
  const displayName =
    business?.name && business.name.trim().length > 0 ? business.name : profile.displayName;
  const storedContentBlocks = Array.isArray(profile.contentBlocks) ? profile.contentBlocks : [];
  // JW Stone's reconciled catalog is versioned with the profile experience so
  // the public page cannot silently fall back to an older database seed. Drive
  // folder placement is evidence, not an assertion: uncertain materials stay
  // in "Material to Confirm" and finishes only appear when the source says so.
  const contentBlocks =
    profile.slug === "jw-stone"
      ? [
          ...storedContentBlocks.filter((block: any) => block?.type !== "inventoryCatalog"),
          {
            type: "inventoryCatalog",
            data: { categories: JW_STONE_INVENTORY_CATEGORIES },
          },
        ]
      : profile.slug === "jrs-auto-glass" &&
          !storedContentBlocks.some((block: any) => block?.type === "gallery")
        ? [...storedContentBlocks, ...JRS_AUTO_GLASS_GALLERY_BLOCKS]
        : storedContentBlocks;
  const profileCustomDomain =
    typeof profile.seoMeta?.customDomain === "string"
      ? profile.seoMeta.customDomain.trim().toLowerCase()
      : "";
  const profileCanonicalBase = profileCustomDomain
    ? `https://${profileCustomDomain}/`
    : `${getCanonicalAppOrigin()}/u/${encodeURIComponent(profile.slug)}`;
  const isOnProfileCustomDomain =
    profileCustomDomain.length > 0 &&
    typeof window !== "undefined" &&
    window.location.hostname.toLowerCase() === profileCustomDomain;
  const profileShareDestination = isOnProfileCustomDomain
    ? "/"
    : `/u/${encodeURIComponent(profile.slug)}`;
  const inventoryCategories = (
    contentBlocks.find((block: any) => block?.type === "inventoryCatalog") as any
  )?.data?.categories;
  const galleryItems = listProfileGalleryItems(contentBlocks);
  const localServicePresentation = contentBlocks.find(
    (block: any) => block?.type === "localServiceProfile"
  )?.data as LocalServiceProfilePresentation | undefined;
  const itemShareParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const inventoryItemShareMeta = createProfileInventoryItemShareMetadata({
    profileName: displayName,
    profileUrl: profileCanonicalBase,
    assetOrigin: typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin(),
    categories: inventoryCategories,
    itemSlug: itemShareParams?.get("stone"),
    photo: itemShareParams?.get("photo"),
  });
  const galleryItemShareMeta = createProfileGalleryItemShareMetadata({
    profileName: displayName,
    profileUrl: profileCanonicalBase,
    assetOrigin: typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin(),
    contentBlocks,
    itemSlug: itemShareParams?.get("gallery"),
  });
  // Existing inventory links win if a malformed URL supplies both selectors.
  const itemShareMeta = inventoryItemShareMeta || galleryItemShareMeta;
  const sharedGallerySlug = inventoryItemShareMeta ? null : galleryItemShareMeta?.itemSlug || null;
  const featuredGalleryItem =
    galleryItems.find((item) => item.slug === sharedGallerySlug) || galleryItems[0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const profileSeoTitle =
    typeof profile.seoMeta?.title === "string" && profile.seoMeta.title.trim().length > 0
      ? profile.seoMeta.title
      : `${displayName} | TradeScout`;
  const profileSeoDescription =
    typeof profile.seoMeta?.description === "string" &&
    profile.seoMeta.description.trim().length > 0
      ? profile.seoMeta.description
      : profile.headline ||
        `${displayName} on TradeScout. See services, recent work, and local offers, then send a private request when you're ready.`;
  const seoTitle = itemShareMeta?.title || profileSeoTitle;
  const seoDescription = itemShareMeta?.description || profileSeoDescription;
  const seoImage =
    itemShareMeta?.imageUrl ||
    (typeof profile.seoMeta?.imageUrl === "string" && profile.seoMeta.imageUrl.trim().length > 0
      ? profile.seoMeta.imageUrl
      : undefined);
  const seoCanonical = itemShareMeta?.canonical || profileCanonicalBase;
  const profileStructuredData = {
    "@context": "https://schema.org",
    "@type": business?.name ? "LocalBusiness" : "Person",
    name: displayName,
    description: profileSeoDescription,
    url: profileCanonicalBase,
    ...(business?.categories?.length ? { category: business.categories.slice(0, 6) } : {}),
    ...(business?.serviceAreas?.length ? { areaServed: business.serviceAreas.slice(0, 10) } : {}),
  };
  const structuredData = inventoryItemShareMeta
    ? {
        "@context": "https://schema.org",
        "@graph": [
          Object.fromEntries(
            Object.entries(profileStructuredData).filter(([key]) => key !== "@context")
          ),
          {
            "@type": "Product",
            "@id": `${inventoryItemShareMeta.canonical}#product`,
            name: inventoryItemShareMeta.itemName,
            description: inventoryItemShareMeta.description,
            image: [inventoryItemShareMeta.imageUrl],
            category: inventoryItemShareMeta.category || undefined,
            url: inventoryItemShareMeta.canonical,
            brand: { "@type": "Organization", name: displayName },
          },
        ],
      }
    : galleryItemShareMeta
      ? {
          "@context": "https://schema.org",
          "@graph": [
            Object.fromEntries(
              Object.entries(profileStructuredData).filter(([key]) => key !== "@context")
            ),
            {
              "@type": "ImageObject",
              "@id": `${galleryItemShareMeta.canonical}#image`,
              name: galleryItemShareMeta.itemTitle,
              description: galleryItemShareMeta.description,
              contentUrl: galleryItemShareMeta.imageUrl,
              url: galleryItemShareMeta.canonical,
              creator: { "@type": "Organization", name: displayName },
            },
          ],
        }
      : profileStructuredData;
  const normalizedViewerRole = String((user as any)?.role || "")
    .trim()
    .toLowerCase();
  const isSuperAdminViewer =
    Boolean((user as any)?.isSuperAdmin === true) || normalizedViewerRole === "super_admin";
  const hasViewerSession = isAuthenticated || Boolean((user as any)?.id);
  const tradeScoutReturnHref = isOnProfileCustomDomain
    ? getSafeTradeScoutHome()
    : hasViewerSession
      ? "/direct-connect"
      : "/";
  // The boundary is the surface, not the referrer. A CTA on an individual
  // TradePartner business profile is an express connection to that exact
  // business. The /direct-connect portal retains the full discovery path.
  const useExpressDirectConnect = true;
  const canExpressCall = business?.expressContactCapabilities?.call === true;
  // TradePartners expose a directConnectOwnerUserId so their CTA opens Direct
  // Connect targeted straight at their own account (via the target/targetName
  // prefill params DirectConnectShell already reads), instead of the
  // anonymous, business-agnostic request flow every other profile uses.
  const jrsRequestDescription =
    "Vehicle year, make, model, and VIN (if available):\nWhich glass is damaged:\nChip or crack size and location:\nCamera or sensors near the glass:\nInsurance claim or self-pay:\nVehicle location:\nPreferred timing:\nPhotos attached:";
  const jrsDirectConnectTarget = business?.directConnectOwnerUserId
    ? `target=${encodeURIComponent(business.directConnectOwnerUserId)}`
    : `profile=${encodeURIComponent(profile.slug)}`;
  const directConnectHref =
    profile.slug === "jrs-auto-glass"
      ? `/direct-connect?${jrsDirectConnectTarget}&targetName=${encodeURIComponent(displayName)}&source=profile_site&title=${encodeURIComponent("Auto glass request")}&description=${encodeURIComponent(jrsRequestDescription)}&intent=vehicle_service`
      : business?.directConnectOwnerUserId
        ? `/direct-connect?target=${encodeURIComponent(business.directConnectOwnerUserId)}&targetName=${encodeURIComponent(displayName)}&source=profile_site`
        : `/direct-connect?profile=${encodeURIComponent(profile.slug)}`;
  const preScoutCreateHref = `/pre-scout-setup?mode=create&next=${encodeURIComponent(directConnectHref)}`;
  const preScoutSignInHref = `/pre-scout-setup?mode=signin&next=${encodeURIComponent(directConnectHref)}`;
  const aboutText = contentBlocks
    .filter((block) => block && typeof block === "object")
    .map((block: any) => {
      if (block.type === "about" || block.type === "hero") {
        const data = block?.data && typeof block.data === "object" ? block.data : {};
        const raw =
          typeof data.text === "string"
            ? data.text
            : typeof data.description === "string"
              ? data.description
              : typeof data.body === "string"
                ? data.body
                : "";
        return raw.trim();
      }
      return "";
    })
    .find((value) => value.length > 0);
  const serviceTags = Array.from(
    new Set(
      [
        ...(Array.isArray(business?.categories) ? business?.categories : []),
        ...contentBlocks.flatMap((block: any) => {
          if (block?.type !== "services") return [] as string[];
          const data = block?.data && typeof block.data === "object" ? block.data : {};
          if (Array.isArray(data.items)) {
            return data.items
              .map((item: unknown) => String(item || "").trim())
              .filter((item: string) => item.length > 0);
          }
          if (typeof data.text === "string") {
            return data.text
              .split(/\n|,|\u2022|- /g)
              .map((item: string) => item.trim())
              .filter((item: string) => item.length > 0);
          }
          return [] as string[];
        }),
      ]
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
    )
  );
  const serviceAreas = Array.isArray(business?.serviceAreas) ? business.serviceAreas : [];
  const profilePlaceholderSrc = getCategoryPlaceholderSrc([
    ...(Array.isArray(business?.categories) ? business.categories.slice(0, 4) : []),
    ...serviceTags.slice(0, 4),
    profile.headline,
    profile.roleContext,
  ]);
  const profilePlaceholderAlt = `${
    serviceTags[0] || profile.headline || "Business"
  } illustration for ${displayName}`;
  const profileTypeLabel = business ? "Local business" : "Community profile";
  const quickFacts = [
    serviceTags.length > 0 ? { label: "Services", value: String(serviceTags.length) } : null,
    serviceAreas.length > 0
      ? {
          label: "Serves",
          value: `${serviceAreas.length} area${serviceAreas.length === 1 ? "" : "s"}`,
        }
      : null,
    bookingEnabled ? { label: "Appointments", value: "Available" } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const customBlocks = contentBlocks
    .filter((block) => block && typeof block === "object")
    .filter(
      (block: any) => !["about", "hero", "services", "cta", "gallery"].includes(String(block?.type))
    )
    .slice(0, 4)
    .map((block: any) => {
      const data = block?.data && typeof block.data === "object" ? block.data : {};
      const title =
        typeof data.title === "string"
          ? data.title
          : typeof block.type === "string"
            ? block.type.charAt(0).toUpperCase() + block.type.slice(1)
            : "Details";
      const body =
        typeof data.text === "string"
          ? data.text
          : typeof data.body === "string"
            ? data.body
            : typeof data.description === "string"
              ? data.description
              : "";
      return { title, body: body.trim() };
    })
    .filter((item) => item.body.length > 0);

  if (profile.slug === "jrs-auto-glass") {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={inventoryItemShareMeta ? "product" : galleryItemShareMeta ? "article" : "profile"}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(itemShareMeta)}
        />
        <JrsAutoGlassProfileTheme
          onDirectConnect={() => setExpressPanelOpen(true)}
          hasViewerSession={hasViewerSession}
          tradeScoutReturnHref={tradeScoutReturnHref}
          profileShareDestination={profileShareDestination}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          recommendationsDirectory={recommendationsDirectory}
          profileItems={
            <PublicProfileItems items={profileItems} profileSections={profileSections} />
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          businessName={displayName}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode="auto_glass"
        />
      </>
    );
  }

  if (localServicePresentation?.template === "local-service") {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={galleryItemShareMeta ? "article" : "profile"}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(galleryItemShareMeta)}
        />
        <LocalServiceProfileTheme
          businessName={displayName}
          presentation={localServicePresentation}
          onDirectConnect={() => setExpressPanelOpen(true)}
          hasViewerSession={hasViewerSession}
          tradeScoutReturnHref={tradeScoutReturnHref}
          profileShareDestination={profileShareDestination}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          recommendationsDirectory={recommendationsDirectory}
          verificationStatus={business?.verificationStatus}
          cvsScore={business?.cvsScore}
          cvsPerformanceScore={business?.cvsPerformanceScore}
          cvsBoostPoints={business?.cvsBoostPoints}
          profileItems={
            <PublicProfileItems items={profileItems} profileSections={profileSections} />
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          businessName={displayName}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode="service"
        />
      </>
    );
  }

  if (isTradePartner(business)) {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={inventoryItemShareMeta ? "product" : galleryItemShareMeta ? "article" : "profile"}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(itemShareMeta)}
        />
        <WholesalerProfileTheme
          profileSlug={profile.slug}
          displayName={displayName}
          headline={profile.headline}
          contentBlocks={contentBlocks}
          categories={business?.categories || []}
          serviceAreas={business?.serviceAreas || []}
          brandColors={business?.brandColors}
          contactReason={profile.contactPolicy?.reason}
          hasViewerSession={hasViewerSession}
          isSuperAdminViewer={isSuperAdminViewer}
          useExpressDirectConnect={useExpressDirectConnect}
          allowExpressCall={canExpressCall}
          profileShareDestination={profileShareDestination}
          sharedGallerySlug={sharedGallerySlug}
          tradeScoutReturnHref={tradeScoutReturnHref}
          directConnectHref={directConnectHref}
          preScoutCreateHref={preScoutCreateHref}
          preScoutSignInHref={preScoutSignInHref}
          recommendationsDirectory={recommendationsDirectory}
          recommendationDirectorySummary={recommendationDirectorySummary}
          profileItems={
            <PublicProfileItems items={profileItems} profileSections={profileSections} />
          }
        />
      </>
    );
  }

  return (
    <Page className="max-w-6xl space-y-6">
      <SEOHelmet
        title={seoTitle}
        description={seoDescription}
        canonical={seoCanonical}
        ogType={inventoryItemShareMeta ? "product" : galleryItemShareMeta ? "article" : "profile"}
        ogImage={seoImage}
        structuredData={structuredData}
        preserveCanonicalQuery={Boolean(itemShareMeta)}
      />
      <Card className="bg-tsCard overflow-hidden">
        <CardHeader className="space-y-4 bg-tsCardMuted">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">Public profile</Badge>
                <ShareButton
                  destination={profileShareDestination}
                  title={displayName}
                  text={`Check out ${displayName} on TradeScout`}
                />
              </div>
              <CardTitle className="text-white text-3xl md:text-4xl">{displayName}</CardTitle>
              <div className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                <img
                  src={featuredGalleryItem?.imageUrl || profilePlaceholderSrc}
                  alt={featuredGalleryItem?.imageAlt || profilePlaceholderAlt}
                  className={`h-12 w-16 rounded bg-white/10 ${
                    featuredGalleryItem ? "object-cover" : "p-1 object-contain"
                  }`}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src =
                      "/images/tradescout/categories/general-contractor.svg";
                  }}
                />
                <div className="text-xs text-white/70">
                  {featuredGalleryItem
                    ? sharedGallerySlug
                      ? "The work someone shared with you"
                      : "Recent work"
                    : "New photos are on the way."}
                </div>
              </div>
              {profileSections.about !== false ? (
                <p className="text-white/70 text-sm uppercase tracking-[0.18em]">
                  {profileTypeLabel}
                </p>
              ) : null}
              {profile.headline && profileSections.about !== false ? (
                <p className="text-white/80 max-w-2xl">{profile.headline}</p>
              ) : null}
            </div>
            {profileSections.stats !== false && quickFacts.length > 0 ? (
              <div className="grid min-w-[220px] grid-cols-2 gap-2">
                {quickFacts.map((fact) => (
                  <div key={fact.label} className="rounded-md bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/60">
                      {fact.label}
                    </p>
                    <p className="text-lg font-semibold text-white">{fact.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {profileSections.rolesAndBadges !== false ? (
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-ts-orange text-white">{profileTypeLabel}</Badge>
              <Badge className="bg-white/10 text-white">Requests stay private</Badge>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {profileSections.about !== false && (aboutText || profile.headline) ? (
                <section className="space-y-2">
                  <h2 className="text-white font-semibold text-lg">About</h2>
                  <p className="text-white/75 leading-relaxed">{aboutText || profile.headline}</p>
                </section>
              ) : null}

              {profileSections.services !== false && serviceTags.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-white font-semibold text-lg">Services</h2>
                  <div className="flex flex-wrap gap-2">
                    {serviceTags.slice(0, 24).map((service) => (
                      <Badge key={service} className="bg-white/10 text-white">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {profileSections.services !== false && serviceAreas.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-white font-semibold text-lg">Service Areas</h2>
                  <div className="flex flex-wrap gap-2">
                    {serviceAreas.slice(0, 20).map((area) => (
                      <Badge key={area} className="bg-white/10 text-white/80">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {profileSections.reviews !== false && recommendationsDirectory.length > 0 ? (
                <section id="recommendations-directory" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-white font-semibold text-lg">What people say</h2>
                    <div className="text-xs text-white/70">
                      {recommendationDirectorySummary.total}{" "}
                      {recommendationDirectorySummary.total === 1
                        ? "recommendation"
                        : "recommendations"}
                    </div>
                  </div>
                  <p className="text-xs text-white/60">
                    Recommendations people choose to share appear here.
                  </p>
                  <div className="space-y-3">
                    {recommendationsDirectory.slice(0, 24).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {entry.recommendationType === "positive" ? (
                              <Badge className="bg-emerald-600/80 text-white">
                                <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                                Recommends
                              </Badge>
                            ) : (
                              <Badge className="bg-red-600/80 text-white">
                                <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                                Does not recommend
                              </Badge>
                            )}
                            {entry.projectType ? (
                              <Badge className="bg-white/10 text-white/80">
                                {entry.projectType}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-white/60">
                            {entry.createdAt
                              ? new Date(entry.createdAt).toLocaleDateString()
                              : "Recently"}
                          </div>
                        </div>
                        <p className="text-sm text-white/80">{entry.comment}</p>
                        {entry.contractor?.slug ? (
                          <Link
                            href={
                              entry.contractor.canonicalBusinessProfileUrl ||
                              `/contractors/${encodeURIComponent(entry.contractor.slug)}`
                            }
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/20 text-white"
                            >
                              {entry.contractor.companyName}
                            </Button>
                          </Link>
                        ) : (
                          <p className="text-xs text-white/60">{entry.contractor.companyName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {galleryItems.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-white font-semibold text-lg">Work &amp; Gallery</h2>
                    <p className="text-xs text-white/60">Share any image directly</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {galleryItems.map((item) => {
                      const isSharedItem = item.slug === sharedGallerySlug;
                      return (
                        <article
                          id={`profile-gallery-${item.slug}`}
                          key={item.slug}
                          className={`scroll-mt-24 overflow-hidden rounded-xl border bg-black/20 transition-shadow ${
                            isSharedItem
                              ? "border-ts-orange ring-2 ring-ts-orange/40 shadow-lg"
                              : "border-white/10"
                          }`}
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.imageAlt}
                            className="aspect-[4/3] w-full object-cover"
                            loading="lazy"
                          />
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="font-medium text-white">{item.title}</h3>
                                {item.description ? (
                                  <p className="mt-1 text-sm leading-relaxed text-white/70">
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>
                              {isSharedItem ? (
                                <Badge className="shrink-0 bg-ts-orange text-white">
                                  Shared image
                                </Badge>
                              ) : null}
                            </div>
                            <ShareButton
                              destination={`${profileShareDestination}${buildProfileGalleryShareSearch(item.slug)}`}
                              title={`${item.title} by ${displayName}`}
                              text={`View ${item.title} from ${displayName} on TradeScout`}
                              className="border-white/20 text-white"
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {customBlocks.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-white font-semibold text-lg">Profile Highlights</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {customBlocks.map((block, index) => (
                      <div
                        key={`${block.title}-${index}`}
                        className="rounded-lg bg-black/20 p-4 space-y-2"
                      >
                        <h3 className="text-white font-medium">{block.title}</h3>
                        <p className="text-white/70 text-sm leading-relaxed">{block.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {bookingEnabled ? (
                <section className="space-y-3 rounded-lg bg-black/20 p-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-ts-orange" />
                    Bookings
                  </h2>
                  <p className="text-sm text-white/70">
                    Choose a time and send a booking request. Nothing is shared until you review it.
                  </p>
                  {calendarVisibility === "public" && slots.length > 0 ? (
                    <div className="space-y-1 text-sm text-white/70">
                      <div className="text-xs text-white/60 flex items-center gap-1 uppercase tracking-wider">
                        <Clock3 className="h-3.5 w-3.5" />
                        Availability ({timezone})
                      </div>
                      {slots.slice(0, 14).map((slot) => (
                        <div key={slot.id} className="flex justify-between gap-4">
                          <span>{dayNames[slot.dayOfWeek] || "Day"}</span>
                          <span>
                            {slot.startTime} - {slot.endTime}
                            {slot.label ? ` (${slot.label})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {booking.pricingTableEnabled === true && pricingRows.length > 0 ? (
                    <div className="space-y-1 text-sm text-white/70">
                      <div className="text-xs text-white/60 uppercase tracking-wider">
                        Pricing table
                      </div>
                      {pricingRows.slice(0, 10).map((row) => (
                        <div key={row.id} className="flex justify-between gap-4">
                          <span>{row.name}</span>
                          <span className="font-medium">{row.priceLabel}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Link href={hasViewerSession ? directConnectHref : preScoutCreateHref}>
                      <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                        Direct Connect
                      </Button>
                    </Link>
                    {paidBookings && bookingPriceUsd > 0 ? (
                      <Link
                        href={`/checkout/booking/${encodeURIComponent(profile.id)}?amount=${encodeURIComponent(String(bookingPriceUsd))}&description=${encodeURIComponent(`Booking deposit for ${displayName}`)}`}
                      >
                        <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Pay deposit (${bookingPriceUsd.toFixed(2)})
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4">
              {business && (business.categories.length > 0 || business.serviceAreas.length > 0) ? (
                <section className="rounded-lg bg-black/20 p-4 space-y-3">
                  <h2 className="text-white font-semibold">At a glance</h2>
                  <div className="text-sm text-white/70 space-y-1">
                    {business.categories.length > 0 ? (
                      <p>{business.categories.slice(0, 6).join(" · ")}</p>
                    ) : null}
                    {business.serviceAreas.length > 0 ? (
                      <p className="text-white/60">
                        Serves {business.serviceAreas.slice(0, 6).join(", ")}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {showContactCard ? (
                <section className="space-y-3 rounded-lg bg-black/20 p-4">
                  <h2 className="text-white font-semibold">
                    {business ? "Ask about working together" : "Send a private request"}
                  </h2>
                  <div className="space-y-2 text-sm text-white/70">
                    <div className="flex items-center gap-2 text-white/70">
                      <ShieldCheck className="h-4 w-4 text-ts-orange" />
                      <span>Your contact details stay private.</span>
                    </div>
                    <p className="text-white/60">
                      Send a request first. You can continue directly after they accept.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      onClick={() => setExpressPanelOpen(true)}
                      className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>Direct Connect</span>
                    </Button>
                    {!hasViewerSession ? (
                      <Link href={preScoutSignInHref}>
                        <Button className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white">
                          Sign in
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        </CardContent>
      </Card>
      <PublicProfileItems items={profileItems} profileSections={profileSections} />
      <TradeScoutProfileHandoff className="rounded-3xl" />
      <ExpressDirectConnectPanel
        open={expressPanelOpen}
        onClose={() => setExpressPanelOpen(false)}
        profileSlug={profile.slug}
        businessName={displayName}
        hasViewerSession={hasViewerSession}
        allowCall={canExpressCall}
        requestMode="service"
      />
    </Page>
  );
}
