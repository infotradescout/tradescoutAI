import { useEffect, useState, type CSSProperties } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEOHelmet } from "@/components/SEOHelmet";
import { getCategoryPlaceholderSrc } from "@/lib/categoryPlaceholders";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { trackDiscoveryLandingOnce } from "@/lib/discoveryLanding";
import {
  qualifyPublicProfileItemDestination,
  requiresDocumentNavigation,
} from "@/lib/publicProfileItemDestination";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Calendar,
  Clock3,
  Compass,
  Flag,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Page } from "@/components/layout/PagePrimitives";
import { ShareButton } from "@/components/ShareButton";
import DefaultProfileTheme from "@/pages/profile-sites/DefaultProfileTheme";
import WholesalerProfileTheme from "@/pages/profile-sites/WholesalerProfileTheme";
import JrsAutoGlassProfileTheme from "@/pages/profile-sites/JrsAutoGlassProfileTheme";
import ProFabProfileTheme from "@/pages/profile-sites/ProFabProfileTheme";
import VideographerProfileTheme from "@/pages/profile-sites/VideographerProfileTheme";
import PrecisionAerialProfile from "@/pages/profile-sites/PrecisionAerialProfile";
import SteelHomePackagesProfile from "@/pages/profile-sites/SteelHomePackagesProfile";
import {
  createProfileHistoryBoundaryState,
  isProfileHistoryBoundaryState,
} from "@/pages/profileHistoryBoundary";
import LocalServiceProfileTheme, {
  type PublicCommunityVerification,
} from "@/pages/profile-sites/LocalServiceProfileTheme";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import {
  hasVisiblePublicProfileItems,
  PublicProfileItems,
  type CanonicalProfileItems,
} from "@/components/profile/PublicProfileItems";
import { PublicProfileTrustActions } from "@/components/profile/PublicProfileTrustActions";
import { ProfileBookingRequestDialog } from "@/components/profile/ProfileBookingRequestDialog";
import { applyProfileSiteContentAdapter } from "@/data/profileSiteContentAdapters";
import {
  createProfileInventoryItemShareMetadata,
  listProfileInventoryItems,
} from "@shared/profileItemShare";
import {
  createProfileGalleryItemShareMetadata,
  listProfileGalleryItems,
  resolveProfileGalleryItem,
} from "@shared/profileGalleryShare";
import { createProfileInventoryCategoryShareMetadata } from "@shared/profileCategoryShare";
import {
  buildProfilePublicCategoryPath,
  buildProfilePublicItemPath,
  buildProfilePublicItemUrl,
  resolveProfilePublicCategoryRoute,
  resolveProfilePublicItemRoute,
} from "@shared/profilePublicItemRoute";
import { JRS_AUTO_GLASS_GALLERY_BLOCKS } from "@shared/jrsAutoGlassProfile";
import {
  ISSA_BUILD_LEGACY_PROFILE_SLUG,
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_SLUG,
  isIssaBuildProfileSlug,
} from "@shared/issaBuildProfile";
import {
  LA_PLUMBING_PROFILE_PRESENTATION,
  LA_PLUMBING_PROFILE_SLUG,
  type LocalServiceProfilePresentation,
} from "@shared/localServiceProfile";
import { PRECISION_AERIAL_PROFILE_SLUG } from "@shared/precisionAerialProfile";
import {
  isSteelHomePackagesProfileSlug,
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import {
  buildSteelHomeBuilderPath,
  resolveSteelHomeBuilderRoute,
  STEEL_HOME_BUILDER_PAGE_METADATA,
} from "@shared/steelHomeBuilderRoutes";
import {
  readFeaturedStoneSlugs,
  resolveSiteTemplateId,
  seedBlocksForTemplate,
  type ProfileSiteTemplateId,
} from "@shared/profileSiteTemplates";
import ProfileSiteManageChrome from "@/components/profile/ProfileSiteManageChrome";
import { sanitizePublicProfileText as sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import {
  buildProfileSocialDescription,
  buildProfileSocialPreviewImageUrl,
  buildProfileSocialTitle,
  resolveProfileSocialPresentation,
} from "@shared/profileSocialPreview";

import { withTradeScoutPublishingProvenance } from "@shared/profilePublishingProvenance";

const PROFILE_HISTORY_BOUNDARY_KEY = "__tradeScoutProfileHistoryBoundary";

// TradePartner is a paid tier: any business with `tradePartner: true` gets the
// richer branded layout, regardless of category. It is not tied to being a
// wholesaler/supplier specifically -- that's just who's bought it so far.
function isTradePartner(business: PublicBusinessSubset): boolean {
  return Boolean(business?.tradePartner);
}

function isPrimaryTradeScoutHost(host: string): boolean {
  return (
    host === "thetradescout.com" ||
    host === "www.thetradescout.com" ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

// A visitor on a business's own custom domain should never get sent to
// thetradescout.com except by deliberately clicking a footer CTA -- so
// "safe" here means the current domain's own root everywhere except on
// thetradescout.com itself.
function getSafeTradeScoutHome(): string {
  if (typeof window === "undefined") return "https://www.thetradescout.com/";
  const host = window.location.hostname.toLowerCase();
  return isPrimaryTradeScoutHost(host)
    ? "https://www.thetradescout.com/"
    : `${window.location.origin}/`;
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
  mode: "unavailable" | "retry";
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
    <main className="relative overflow-hidden bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 16% 16%, rgba(249,115,22,.18), transparent 34%), radial-gradient(circle at 84% 26%, rgba(14,165,233,.16), transparent 36%), linear-gradient(145deg, rgb(2 6 23) 0%, rgb(15 23 42) 58%, rgb(2 6 23) 100%)",
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

        <section className="my-auto grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-[0_36px_110px_rgba(0,0,0,.45)] backdrop-blur-xl lg:grid-cols-[1.15fr_.85fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
              {isRetry ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isRetry ? "Quick pit stop" : "Profile unavailable"}
            </div>

            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-sky-300/80">
              {isRetry ? profileName : "TradeScout public profile"}
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {isRetry
                ? "This page took a quick pit stop."
                : "This public profile is not available."}
            </h1>
            {!isRetry ? (
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                The profile may be unpublished, private, moved, or no longer available.
              </p>
            ) : null}

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

          <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden border-t border-white/10 bg-slate-900 p-8 lg:min-h-[600px] lg:border-l lg:border-t-0">
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

            <div className="relative w-full max-w-sm rounded-[1.75rem] border border-white/12 bg-slate-950/90 p-6 shadow-2xl sm:p-8">
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
                {(isRetry
                  ? ["Loading interrupted", "Trying again may recover"]
                  : ["No public profile at this address", "Browse available public spaces"]
                ).map((label, index) => (
                  <div
                    key={label}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                      index === 1
                        ? "border-ts-orange/25 bg-ts-orange/[0.08]"
                        : "border-white/8 bg-white/[0.035]"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        index === 1
                          ? "bg-ts-orange shadow-[0_0_18px_rgba(249,115,22,.8)]"
                          : "bg-emerald-400"
                      }`}
                    />
                    <span className="text-sm font-semibold text-white/76">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
  siteTemplate?: ProfileSiteTemplateId;
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
  services?: string[];
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
  communityVerification?: PublicCommunityVerification | null;
  expressContactCapabilities?: {
    call?: boolean;
    request?: boolean;
    deliveryCustody?: "business" | "tradescout_pending_owner";
  };
  address?: string;
  city?: string;
  stateCode?: string;
  zipCode?: string;
} | null;

type PublicProfileResponse = {
  profile: PublicProfile;
  business: PublicBusinessSubset;
  viewerCanManage?: boolean;
  profileItems?: CanonicalProfileItems;
  recommendationsDirectory?: Array<{
    id: string;
    createdAt: string | null;
    recommendationType: "positive" | "negative";
    comment: string;
    projectType: string | null;
    customerName: string;
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
  recommendationDirectoryMode?: "received" | "authored";
};

export default function ProfileSiteView() {
  const { user, isAuthenticated } = useAuth();
  const [, paramsU] = useRoute("/u/:slug");
  const [, paramsUItem] = useRoute("/u/:slug/:collection/:itemSlug");
  const [matchP, paramsP] = useRoute("/p/:slug");
  const [matchPItem, paramsPItem] = useRoute("/p/:slug/:collection/:itemSlug");
  const [location, navigate] = useLocation();
  // Custom-domain root has no /u/:slug in the path at all -- the server
  // tells us the slug directly via this injected global (see
  // injectCustomDomainProfileSlug in server/publicProfileHtml.ts).
  const customDomainSlug =
    typeof window !== "undefined"
      ? (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
          .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__
      : undefined;
  const slug = (
    paramsU?.slug ||
    paramsUItem?.slug ||
    paramsP?.slug ||
    paramsPItem?.slug ||
    customDomainSlug ||
    ""
  ).trim();
  const steelHomeBuilderRoute = isSteelHomePackagesProfileSlug(slug)
    ? resolveSteelHomeBuilderRoute(
        paramsUItem?.collection || paramsPItem?.collection,
        paramsUItem?.itemSlug || paramsPItem?.itemSlug
      )
    : null;
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expressPanelOpen, setExpressPanelOpen] = useState(false);
  const [expressInventoryContext, setExpressInventoryContext] = useState<{
    itemName: string;
    itemId: string;
  } | null>(null);
  const [expressServiceContext, setExpressServiceContext] = useState<string | null>(null);
  const [manageEditMode, setManageEditMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("edit") === "1";
  });

  // Public profiles are commonly opened from texts, social posts, and QR
  // codes. Add one same-page history boundary so the browser Back control can
  // return to a safe TradeScout destination instead of dropping the visitor
  // onto an unrelated external app or site.
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;

    const currentState = (window.history.state || {}) as Record<string, unknown>;
    // getSafeTradeScoutHome() already resolves to the current domain's own
    // root everywhere except thetradescout.com itself -- only a referrer that
    // was actually thetradescout.com (handled below) sends visitors there
    // from a custom domain.
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

    const handlePopState = (event: PopStateEvent) => {
      if (isProfileHistoryBoundaryState(event.state, PROFILE_HISTORY_BOUNDARY_KEY, slug)) return;
      window.location.replace(safeReturnHref);
    };

    if (!isProfileHistoryBoundaryState(currentState, PROFILE_HISTORY_BOUNDARY_KEY, slug)) {
      window.history.pushState(
        createProfileHistoryBoundaryState(currentState, PROFILE_HISTORY_BOUNDARY_KEY, slug),
        "",
        window.location.href
      );
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    if (typeof window !== "undefined" && slug.toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG) {
      window.location.replace(
        `/u/${ISSA_BUILD_PROFILE_SLUG}${window.location.search}${window.location.hash}`
      );
      return;
    }

    if (matchP || matchPItem) {
      const itemSuffix =
        matchPItem && paramsPItem?.collection && paramsPItem?.itemSlug
          ? `/${encodeURIComponent(paramsPItem.collection)}/${encodeURIComponent(
              paramsPItem.itemSlug
            )}${window.location.search}`
          : "";
      navigate(`/u/${encodeURIComponent(slug)}${itemSuffix}`, {
        replace: true,
        state: createProfileHistoryBoundaryState(
          window.history.state,
          PROFILE_HISTORY_BOUNDARY_KEY,
          slug
        ),
      });
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setNotFound(false);
        setLoadFailed(false);

        const response = await fetch(`/api/u/${encodeURIComponent(slug)}`, {
          // Public profiles are edited and published independently of the app
          // bundle. Revalidate cached profile data so a successful publish does
          // not leave visitors looking at an older profile for another hour.
          cache: "no-cache",
        });
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
          new URLSearchParams(window.location.search).get("book") !== "1" &&
          window.location.hostname.toLowerCase() !== customDomain.trim().toLowerCase()
        ) {
          const searchParams = new URLSearchParams(window.location.search);
          const contentBlocks = applyProfileSiteContentAdapter({
            profileSlug: json.profile.slug,
            contentBlocks: json.profile.contentBlocks,
          });
          const routedItem = resolveProfilePublicItemRoute({
            pathname: window.location.pathname,
            profileBasePath: `/u/${encodeURIComponent(json.profile.slug)}`,
            contentBlocks,
          });
          const routedCategory = resolveProfilePublicCategoryRoute({
            pathname: window.location.pathname,
            profileBasePath: `/u/${encodeURIComponent(json.profile.slug)}`,
            contentBlocks,
          });
          const requestedItemType =
            routedItem?.itemType ||
            (searchParams.get("stone")
              ? "inventory"
              : searchParams.get("gallery")
                ? "gallery"
                : null);
          const requestedItemSlug =
            routedItem?.itemSlug ||
            (requestedItemType === "inventory"
              ? searchParams.get("stone")
              : requestedItemType === "gallery"
                ? searchParams.get("gallery")
                : null);
          const requestedPhoto = Number.parseInt(searchParams.get("photo") || "", 10);
          const itemPath =
            requestedItemType && requestedItemSlug
              ? buildProfilePublicItemPath({
                  profileBasePath: "/",
                  itemType: requestedItemType,
                  itemSlug: requestedItemSlug,
                  imageIndex: requestedPhoto > 1 ? requestedPhoto - 1 : 0,
                  contentBlocks,
                })
              : null;
          const categoryPath =
            !itemPath && (routedCategory?.categorySlug || searchParams.get("category"))
              ? buildProfilePublicCategoryPath({
                  profileBasePath: "/",
                  categorySlug: routedCategory?.categorySlug || searchParams.get("category"),
                  contentBlocks,
                })
              : null;
          const redirectUrl = new URL(
            itemPath || categoryPath || "/",
            `https://${customDomain.trim()}`
          );
          if (!itemPath && !categoryPath) redirectUrl.search = window.location.search;
          const referralCode = searchParams.get("ref");
          if (referralCode) redirectUrl.searchParams.set("ref", referralCode);
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
  }, [slug, matchP, matchPItem, navigate, paramsPItem, reloadKey]);

  useEffect(() => {
    if (!data || data.viewerCanManage || typeof window === "undefined") return;
    void trackDiscoveryLandingOnce({
      canonicalRoute: window.location.pathname || `/u/${encodeURIComponent(data.profile.slug)}`,
      search: window.location.search,
    });
  }, [data]);

  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const contentBlocks = applyProfileSiteContentAdapter({
      profileSlug: data.profile.slug,
      contentBlocks: data.profile.contentBlocks,
    });
    const customDomainRoute = Boolean(
      (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
        .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__
    );
    const routeItem = resolveProfilePublicItemRoute({
      pathname: window.location.pathname,
      profileBasePath: customDomainRoute ? "/" : `/u/${encodeURIComponent(data.profile.slug)}`,
      contentBlocks,
    });
    if (params.get("stone") || routeItem?.itemType === "inventory") return;
    const sharedGalleryItem = resolveProfileGalleryItem(
      contentBlocks,
      routeItem?.itemType === "gallery" ? routeItem.itemSlug : params.get("gallery")
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
        mode="unavailable"
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
  const recommendationDirectoryMode = data.recommendationDirectoryMode || "authored";
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
    sanitizePublicDiscoveryText(
      business?.name && business.name.trim().length > 0 ? business.name : profile.displayName,
      200
    ) || "TradeScout public profile";
  const publicHeadline = sanitizePublicDiscoveryText(profile.headline, 500);
  const publicCategories = (Array.isArray(business?.categories) ? business.categories : [])
    .map((value) => sanitizePublicDiscoveryText(value, 120))
    .filter(Boolean);
  const bookingCategory = [profile.roleContext, ...publicCategories].some((value) =>
    /notary/i.test(value)
  )
    ? "legal_notary"
    : publicCategories[0] || profile.roleContext;
  const publicServiceAreas = (Array.isArray(business?.serviceAreas) ? business.serviceAreas : [])
    .map((value) => sanitizePublicDiscoveryText(value, 160))
    .filter(Boolean);
  const storedContentBlocks = Array.isArray(profile.contentBlocks) ? profile.contentBlocks : [];
  const adaptedContentBlocks = applyProfileSiteContentAdapter({
    profileSlug: profile.slug,
    contentBlocks: storedContentBlocks,
  });
  const contentBlocks = isIssaBuildProfileSlug(profile.slug)
    ? [...ISSA_BUILD_PROFILE_CONTENT_BLOCKS]
    : profile.slug === "jrs-auto-glass" &&
        !adaptedContentBlocks.some((block: any) => block?.type === "gallery")
      ? [...adaptedContentBlocks, ...JRS_AUTO_GLASS_GALLERY_BLOCKS]
      : adaptedContentBlocks;
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
  const platformBaseHref = isOnProfileCustomDomain ? getCanonicalAppOrigin() : "";
  const profileShareDestination = isOnProfileCustomDomain
    ? "/"
    : `/u/${encodeURIComponent(profile.slug)}`;
  const inventoryCategories = (
    contentBlocks.find((block: any) => block?.type === "inventoryCatalog") as any
  )?.data?.categories;
  const galleryItems = listProfileGalleryItems(contentBlocks);
  const storedLocalServicePresentation = contentBlocks.find(
    (block: any) => block?.type === "localServiceProfile"
  )?.data as LocalServiceProfilePresentation | undefined;
  const localServicePresentation =
    profile.slug === LA_PLUMBING_PROFILE_SLUG
      ? LA_PLUMBING_PROFILE_PRESENTATION
      : storedLocalServicePresentation;
  const siteTemplate = resolveSiteTemplateId({
    slug: profile.slug,
    contentBlocks,
    tradePartner: isTradePartner(business),
    hasLocalServicePresentation: Boolean(localServicePresentation?.template === "local-service"),
  });
  const viewerCanManage = data.viewerCanManage === true;
  const wantsManageUi =
    manageEditMode ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("edit") === "1");
  const featuredStoneSlugs = readFeaturedStoneSlugs(contentBlocks);
  const resolvedLocalServicePresentation =
    localServicePresentation ||
    ((siteTemplate === "plumbing-company" || siteTemplate === "electrician-solo") &&
      (() => {
        const seeded = seedBlocksForTemplate(siteTemplate, contentBlocks, {
          displayName,
        });
        const block = seeded.find((entry) => entry.type === "localServiceProfile");
        return block?.data as LocalServiceProfilePresentation | undefined;
      })());
  const itemShareParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const routedProfileItem =
    typeof window !== "undefined"
      ? resolveProfilePublicItemRoute({
          pathname: window.location.pathname,
          profileBasePath: isOnProfileCustomDomain ? "/" : `/u/${encodeURIComponent(profile.slug)}`,
          contentBlocks,
        })
      : null;
  const routedProfileCategory =
    typeof window !== "undefined"
      ? resolveProfilePublicCategoryRoute({
          pathname: window.location.pathname,
          profileBasePath: isOnProfileCustomDomain ? "/" : `/u/${encodeURIComponent(profile.slug)}`,
          contentBlocks,
        })
      : null;
  const inventoryItemShareMeta = createProfileInventoryItemShareMetadata({
    profileName: displayName,
    profileUrl: profileCanonicalBase,
    assetOrigin: typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin(),
    categories: inventoryCategories,
    itemSlug:
      routedProfileItem?.itemType === "inventory"
        ? routedProfileItem.itemSlug
        : itemShareParams?.get("stone"),
    photo: itemShareParams?.get("photo"),
    publicRouteContentBlocks: contentBlocks,
  });
  const galleryItemShareMeta = createProfileGalleryItemShareMetadata({
    profileName: displayName,
    profileUrl: profileCanonicalBase,
    assetOrigin: typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin(),
    contentBlocks,
    itemSlug:
      routedProfileItem?.itemType === "gallery"
        ? routedProfileItem.itemSlug
        : itemShareParams?.get("gallery"),
  });
  const inventoryCategoryShareMeta = createProfileInventoryCategoryShareMetadata({
    profileName: displayName,
    profileUrl: profileCanonicalBase,
    assetOrigin: typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin(),
    categories: inventoryCategories,
    categorySlug: routedProfileCategory?.categorySlug || itemShareParams?.get("category"),
    publicRouteContentBlocks: contentBlocks,
  });
  // Existing inventory links win if a malformed URL supplies both selectors.
  const itemShareMeta = inventoryItemShareMeta || galleryItemShareMeta;
  const categoryShareMeta = itemShareMeta ? null : inventoryCategoryShareMeta;
  const itemShareDestination = itemShareMeta
    ? buildProfilePublicItemPath({
        profileBasePath: profileShareDestination,
        itemType: itemShareMeta.itemType,
        itemSlug: itemShareMeta.itemSlug,
        imageIndex:
          itemShareMeta.itemType === "inventory" ? itemShareMeta.shareImageIndex : undefined,
        contentBlocks,
      })
    : null;
  const categoryShareDestination = categoryShareMeta
    ? buildProfilePublicCategoryPath({
        profileBasePath: profileShareDestination,
        categorySlug: categoryShareMeta.categorySlug,
        contentBlocks,
      })
    : null;
  const currentPageShareDestination =
    itemShareDestination || categoryShareDestination || profileShareDestination;
  const currentPageShareTitle =
    inventoryItemShareMeta?.itemName ||
    galleryItemShareMeta?.itemTitle ||
    categoryShareMeta?.categoryName ||
    displayName;
  const sharedGallerySlug = inventoryItemShareMeta ? null : galleryItemShareMeta?.itemSlug || null;
  const featuredGalleryItem =
    galleryItems.find((item) => item.slug === sharedGallerySlug) || galleryItems[0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const profileSeoTitle = sanitizePublicDiscoveryText(
    typeof profile.seoMeta?.title === "string" && profile.seoMeta.title.trim().length > 0
      ? profile.seoMeta.title
      : `${displayName} | TradeScout`,
    240
  );
  const profileSeoDescription = sanitizePublicDiscoveryText(
    typeof profile.seoMeta?.description === "string" &&
      profile.seoMeta.description.trim().length > 0
      ? profile.seoMeta.description
      : publicHeadline ||
          `${displayName} on TradeScout. See services, recent work, and local offers.`,
    1000
  );
  const itemSocialName = inventoryItemShareMeta?.itemName || galleryItemShareMeta?.itemTitle || "";
  const profileSocialPresentation = resolveProfileSocialPresentation({
    brandName: displayName,
    fallbackBrandName: profile.displayName,
    logoUrl: profile.seoMeta?.faviconUrl,
    profileImageUrl: profile.seoMeta?.imageUrl,
    accentColor: business?.brandColors?.accent || business?.brandColors?.primary,
    configuredCtaLabel: profile.ctaConfig?.primary?.label,
    contentBlocks,
  });
  const itemSocialPresentation = resolveProfileSocialPresentation({
    brandName: displayName,
    fallbackBrandName: profile.displayName,
    logoUrl: profile.seoMeta?.faviconUrl,
    accentColor: business?.brandColors?.accent || business?.brandColors?.primary,
    configuredCtaLabel: profile.ctaConfig?.primary?.label,
    itemType: itemShareMeta?.itemType || (categoryShareMeta ? "category" : null),
    contentBlocks,
  });
  const publicSocialBrandName = itemSocialPresentation.brandName;
  const socialTitle = buildProfileSocialTitle({
    brandName: publicSocialBrandName,
    itemType: itemShareMeta?.itemType || (categoryShareMeta ? "category" : null),
    itemName: itemSocialName || categoryShareMeta?.categoryName,
    category: inventoryItemShareMeta?.category,
  });
  const seoTitle = sanitizePublicDiscoveryText(
    itemShareMeta?.title || categoryShareMeta?.title || profileSeoTitle,
    240
  );
  const fallbackSeoDescription = sanitizePublicDiscoveryText(
    itemShareMeta?.description || categoryShareMeta?.description || profileSeoDescription,
    1000
  );
  const seoDescription = sanitizePublicDiscoveryText(
    inventoryItemShareMeta?.publicKind === "offering" ||
      categoryShareMeta?.collectionKind === "offerings"
      ? fallbackSeoDescription
      : itemShareMeta || categoryShareMeta
        ? buildProfileSocialDescription({
            brandName: publicSocialBrandName,
            itemType: itemShareMeta?.itemType || "category",
            itemName: itemSocialName || categoryShareMeta?.categoryName,
            category: inventoryItemShareMeta?.category,
            fallbackDescription: fallbackSeoDescription,
          })
        : fallbackSeoDescription,
    1000
  );
  const legacyProfileSeoImage =
    typeof profile.seoMeta?.imageUrl === "string" && profile.seoMeta.imageUrl.trim().length > 0
      ? profile.seoMeta.imageUrl
      : undefined;
  const sourceSeoImage =
    itemShareMeta || categoryShareMeta
      ? itemShareMeta?.imageUrl || categoryShareMeta?.imageUrl
      : profileSocialPresentation.profileImageUrl || legacyProfileSeoImage;
  const socialPreviewPageOrigin =
    typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin();
  const profileSocialPreviewImageUrl =
    buildProfileSocialPreviewImageUrl({
      pageOrigin: socialPreviewPageOrigin,
      profileSlug: profile.slug,
      versionSeed: [
        profileSocialPresentation.brandName,
        profileSocialPresentation.logoUrl || "",
        profileSocialPresentation.profileImageUrl || "",
        profileSocialPresentation.accentColor,
        profileSocialPresentation.ctaLabel,
        profileSeoTitle,
        profileSeoDescription,
      ].join("|"),
    }) || sourceSeoImage;
  const gallerySocialPreviewImageUrl = (item: {
    slug: string;
    title: string;
    imageUrl: string;
  }) => {
    const galleryPresentation = resolveProfileSocialPresentation({
      brandName: displayName,
      fallbackBrandName: profile.displayName,
      logoUrl: profile.seoMeta?.faviconUrl,
      accentColor: business?.brandColors?.accent || business?.brandColors?.primary,
      configuredCtaLabel: profile.ctaConfig?.primary?.label,
      itemType: "gallery",
      contentBlocks,
    });
    return (
      buildProfileSocialPreviewImageUrl({
        pageOrigin: socialPreviewPageOrigin,
        profileSlug: profile.slug,
        itemType: "gallery",
        itemSlug: item.slug,
        versionSeed: [
          galleryPresentation.brandName,
          galleryPresentation.logoUrl || "",
          galleryPresentation.accentColor,
          galleryPresentation.ctaLabel,
          item.title,
          item.imageUrl,
        ].join("|"),
      }) || item.imageUrl
    );
  };
  const seoImage =
    buildProfileSocialPreviewImageUrl({
      pageOrigin: socialPreviewPageOrigin,
      profileSlug: profile.slug,
      itemType: itemShareMeta?.itemType || (categoryShareMeta ? "category" : null),
      itemSlug: itemShareMeta?.itemSlug || categoryShareMeta?.categorySlug,
      photo: itemShareParams?.get("photo"),
      versionSeed: [
        publicSocialBrandName,
        socialTitle || seoTitle,
        seoDescription,
        sourceSeoImage || "",
        itemSocialPresentation.logoUrl || "",
        itemSocialPresentation.accentColor,
        itemSocialPresentation.ctaLabel,
      ].join("|"),
    }) || sourceSeoImage;
  const seoCanonical =
    itemShareMeta?.canonical || categoryShareMeta?.canonical || profileCanonicalBase;
  const profileStructuredData = {
    "@context": "https://schema.org",
    "@type": business?.name ? "LocalBusiness" : "Person",
    "@id": `${profileCanonicalBase}#identity`,
    name: displayName,
    description: profileSeoDescription,
    url: profileCanonicalBase,
    ...(publicCategories.length ? { category: publicCategories.slice(0, 6) } : {}),
    ...(publicServiceAreas.length ? { areaServed: publicServiceAreas.slice(0, 10) } : {}),
  };
  const entityStructuredData = inventoryItemShareMeta?.hasPublicName
    ? {
        "@context": "https://schema.org",
        "@graph": [
          Object.fromEntries(
            Object.entries(profileStructuredData).filter(([key]) => key !== "@context")
          ),
          {
            "@type": "Product",
            "@id": `${inventoryItemShareMeta.canonical}#product`,
            name: sanitizePublicDiscoveryText(inventoryItemShareMeta.itemName, 200),
            description: sanitizePublicDiscoveryText(inventoryItemShareMeta.description, 500),
            image: [inventoryItemShareMeta.imageUrl],
            category:
              sanitizePublicDiscoveryText(inventoryItemShareMeta.category, 120) || undefined,
            url: inventoryItemShareMeta.canonical,
            ...(business?.name
              ? {
                  brand: {
                    "@id": `${profileCanonicalBase}#identity`,
                  },
                }
              : {}),
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
              name: sanitizePublicDiscoveryText(galleryItemShareMeta.itemTitle, 200),
              description: sanitizePublicDiscoveryText(galleryItemShareMeta.description, 500),
              contentUrl: galleryItemShareMeta.imageUrl,
              url: galleryItemShareMeta.canonical,
              creator: {
                "@id": `${profileCanonicalBase}#identity`,
              },
            },
          ],
        }
      : categoryShareMeta
        ? {
            "@context": "https://schema.org",
            "@graph": [
              Object.fromEntries(
                Object.entries(profileStructuredData).filter(([key]) => key !== "@context")
              ),
              {
                "@type": "CollectionPage",
                "@id": `${categoryShareMeta.canonical}#collection`,
                name: sanitizePublicDiscoveryText(categoryShareMeta.title, 240),
                description: sanitizePublicDiscoveryText(categoryShareMeta.description, 500),
                url: categoryShareMeta.canonical,
                mainEntity: {
                  "@type": "ItemList",
                  numberOfItems: categoryShareMeta.itemCount,
                  itemListElement: categoryShareMeta.itemSlugs.map((itemSlug, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    url: buildProfilePublicItemUrl({
                      profileUrl: profileCanonicalBase,
                      itemType: "inventory",
                      itemSlug,
                      contentBlocks,
                    }),
                  })),
                },
              },
            ],
          }
        : profileStructuredData;
  const structuredDataMainEntityId = inventoryItemShareMeta?.hasPublicName
    ? `${inventoryItemShareMeta.canonical}#product`
    : galleryItemShareMeta
      ? `${galleryItemShareMeta.canonical}#image`
      : categoryShareMeta
        ? `${categoryShareMeta.canonical}#collection`
        : `${profileCanonicalBase}#identity`;
  const structuredData = withTradeScoutPublishingProvenance({
    structuredData: entityStructuredData,
    pageUrl: seoCanonical,
    mainEntityId: structuredDataMainEntityId,
    ownerIdentityId: `${profileCanonicalBase}#identity`,
    pageType: itemShareMeta || categoryShareMeta ? "WebPage" : "ProfilePage",
  });
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
  const publicBusinessAddress = business?.address?.trim()
    ? [
        business.address.trim(),
        [business.city, business.stateCode, business.zipCode]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : null;
  // TradePartners expose a directConnectOwnerUserId so their CTA opens Direct
  // Connect targeted straight at their own account (via the target/targetName
  // prefill params DirectConnectShell already reads), instead of the
  // anonymous, business-agnostic request flow every other profile uses.
  const jrsRequestDescription =
    "Vehicle year, make, model, and VIN (if available):\nWhich glass is damaged:\nChip or crack size and location:\nCamera or sensors near the glass:\nInsurance claim or self-pay:\nVehicle location:\nPreferred timing:\nPhotos attached:";
  const jrsDirectConnectTarget = business?.directConnectOwnerUserId
    ? `target=${encodeURIComponent(business.directConnectOwnerUserId)}`
    : `profile=${encodeURIComponent(profile.slug)}`;
  const directConnectPath =
    profile.slug === "jrs-auto-glass"
      ? `/direct-connect?${jrsDirectConnectTarget}&targetName=${encodeURIComponent(displayName)}&source=profile_site&title=${encodeURIComponent("Auto glass request")}&description=${encodeURIComponent(jrsRequestDescription)}&intent=vehicle_service`
      : business?.directConnectOwnerUserId
        ? `/direct-connect?target=${encodeURIComponent(business.directConnectOwnerUserId)}&targetName=${encodeURIComponent(displayName)}&source=profile_site`
        : `/direct-connect?profile=${encodeURIComponent(profile.slug)}`;
  const directConnectHref = qualifyPublicProfileItemDestination(
    directConnectPath,
    platformBaseHref
  );
  const preScoutCreateHref = qualifyPublicProfileItemDestination(
    `/pre-scout-setup?mode=create&next=${encodeURIComponent(directConnectPath)}`,
    platformBaseHref
  );
  const preScoutSignInHref = qualifyPublicProfileItemDestination(
    `/pre-scout-setup?mode=signin&next=${encodeURIComponent(directConnectPath)}`,
    platformBaseHref
  );
  const profileActionSignInHref = qualifyPublicProfileItemDestination(
    `/pre-scout-setup?mode=signin&next=${encodeURIComponent(`/u/${profile.slug}`)}`,
    platformBaseHref
  );
  const bookingSignInHref = qualifyPublicProfileItemDestination(
    `/pre-scout-setup?mode=create&next=${encodeURIComponent(`/u/${profile.slug}?book=1`)}`,
    platformBaseHref
  );
  const renderProfileTrustActions = (
    tone: "light" | "dark",
    density: "default" | "compact" = "default"
  ) => (
    <PublicProfileTrustActions
      profileSlug={profile.slug}
      profileName={displayName}
      profileShareDestination={profileShareDestination}
      signInHref={profileActionSignInHref}
      hasViewerSession={hasViewerSession}
      platformBaseHref={platformBaseHref}
      initialRecommendationCount={recommendationDirectorySummary.positive}
      subjectKind={business ? "business" : "profile"}
      tone={tone}
      density={density}
    />
  );
  const readProfileBlockText = (blockType: "about" | "hero") =>
    contentBlocks
      .filter((block: any) => block && typeof block === "object" && block.type === blockType)
      .map((block: any) => {
        const data = block?.data && typeof block.data === "object" ? block.data : {};
        const raw =
          typeof data.text === "string"
            ? data.text
            : typeof data.description === "string"
              ? data.description
              : typeof data.body === "string"
                ? data.body
                : "";
        return sanitizePublicDiscoveryText(raw, 4000);
      })
      .find((value) => value.length > 0);
  const explicitAboutText = readProfileBlockText("about");
  const heroAboutFallback = readProfileBlockText("hero");
  const aboutText = explicitAboutText || heroAboutFallback;
  const defaultAboutText = explicitAboutText;
  const profileServiceTags: string[] = contentBlocks.flatMap((block: any) => {
    if (block?.type !== "services") return [] as string[];
    const data = block?.data && typeof block.data === "object" ? block.data : {};
    if (Array.isArray(data.items)) {
      return data.items
        .map((item: unknown) => {
          if (typeof item === "string") return item.trim();
          if (!item || typeof item !== "object") return "";
          const source = item as Record<string, unknown>;
          const candidate =
            source.title || source.name || source.label || source.description || source.text;
          return typeof candidate === "string" ? candidate.trim() : "";
        })
        .filter((item: string) => item.length > 0);
    }
    if (typeof data.text === "string") {
      return data.text
        .split(/\n|,|\u2022|- /g)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
    }
    return [] as string[];
  });
  const businessServiceTags: string[] = Array.isArray(business?.services)
    ? business.services
        .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
        .filter((item: string) => item.length > 0)
    : [];
  const serviceTags: string[] = Array.from(
    new Set<string>(
      (profileServiceTags.length > 0
        ? profileServiceTags
        : businessServiceTags.length > 0
          ? businessServiceTags
          : publicCategories
      )
        .map((item) => sanitizePublicDiscoveryText(item, 180))
        .filter((item) => item.length > 0)
    )
  );
  const serviceAreas = publicServiceAreas;
  const profilePlaceholderSrc = getCategoryPlaceholderSrc([
    ...publicCategories.slice(0, 4),
    ...serviceTags.slice(0, 4),
    publicHeadline,
    profile.roleContext,
  ]);
  const profilePlaceholderAlt = `${
    serviceTags[0] || publicHeadline || "Business"
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
      return {
        title: sanitizePublicDiscoveryText(title, 200),
        body: sanitizePublicDiscoveryText(body, 2000),
      };
    })
    .filter((item) => item.body.length > 0);
  const defaultHeroData = (() => {
    const block = contentBlocks.find((entry: any) => entry?.type === "hero") as any;
    return block?.data && typeof block.data === "object"
      ? (block.data as Record<string, unknown>)
      : {};
  })();
  const readDefaultHeroText = (key: string, limit = 500) =>
    sanitizePublicDiscoveryText(
      typeof defaultHeroData[key] === "string" ? defaultHeroData[key] : "",
      limit
    );
  const readDefaultHeroUrl = (key: string, limit = 2000) => {
    const value = defaultHeroData[key];
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
  };
  const defaultHeroTitle = readDefaultHeroText("title", 200);
  const defaultHeroText = readDefaultHeroText("text", 800);
  const defaultOperatorName = readDefaultHeroText("operatorName", 160);
  const defaultPresentationVariant =
    defaultHeroData.presentationVariant === "first-deliverable"
      ? ("first-deliverable" as const)
      : ("classic" as const);
  const defaultLogoUrl =
    readDefaultHeroUrl("logoUrl") ||
    String(profile.seoMeta?.faviconUrl || "")
      .trim()
      .slice(0, 2000);
  const defaultHeroImageUrl =
    readDefaultHeroUrl("imageUrl") ||
    readDefaultHeroUrl("heroImageUrl") ||
    featuredGalleryItem?.imageUrl ||
    "";
  const defaultHeroImageAlt =
    readDefaultHeroText("imageAlt", 400) ||
    featuredGalleryItem?.imageAlt ||
    `${displayName} featured work`;
  const defaultFeaturedWorkUrl = readDefaultHeroUrl("featuredWorkUrl");
  const defaultLocationLabel =
    readDefaultHeroText("locationLabel", 200) ||
    sanitizePublicDiscoveryText(
      [business?.city, business?.stateCode]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", "),
      200
    ) ||
    serviceAreas[0] ||
    "";
  const defaultSocials = [
    readDefaultHeroUrl("instagramUrl")
      ? {
          label: "Instagram",
          handle: readDefaultHeroText("instagramHandle", 120),
          href: readDefaultHeroUrl("instagramUrl"),
          kind: "instagram" as const,
        }
      : null,
    readDefaultHeroUrl("tiktokUrl")
      ? {
          label: "TikTok",
          handle: readDefaultHeroText("tiktokHandle", 120),
          href: readDefaultHeroUrl("tiktokUrl"),
          kind: "tiktok" as const,
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const defaultRecommendations = recommendationsDirectory.map((entry) => {
    const subjectHref = entry.contractor?.slug
      ? qualifyPublicProfileItemDestination(
          entry.contractor.canonicalBusinessProfileUrl ||
            `/contractors/${encodeURIComponent(entry.contractor.slug)}`,
          platformBaseHref
        )
      : undefined;
    return {
      ...entry,
      subjectName: entry.contractor?.companyName || undefined,
      subjectHref,
    };
  });

  const manageChrome = viewerCanManage ? (
    <ProfileSiteManageChrome
      profileId={profile.id}
      profileSlug={profile.slug}
      displayName={displayName}
      headline={publicHeadline}
      contentBlocks={storedContentBlocks}
      siteTemplate={siteTemplate}
      editMode={manageEditMode}
      platformBaseHref={platformBaseHref}
      customDomain={profileCustomDomain || null}
      isOnCustomDomain={isOnProfileCustomDomain}
      onSaved={() => setReloadKey((current) => current + 1)}
      onToggleEdit={(next) => {
        setManageEditMode(next);
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (next) url.searchParams.set("edit", "1");
        else url.searchParams.delete("edit");
        window.history.replaceState(window.history.state, "", url.toString());
      }}
    />
  ) : wantsManageUi ? (
    <div
      className="relative z-[80] border-b border-amber-400/40 bg-stone-950 px-4 py-3 text-center text-sm text-white"
      data-testid="profile-site-manage-signin"
    >
      Sign in as the business owner or TradeScout admin on this same domain to edit this profile.{" "}
      <a className="font-semibold text-amber-300 underline" href="/login">
        Sign in
      </a>
    </div>
  ) : null;
  const pageOgType = inventoryItemShareMeta?.hasPublicName
    ? "product"
    : galleryItemShareMeta
      ? "article"
      : categoryShareMeta
        ? "website"
        : inventoryItemShareMeta
          ? "website"
          : "profile";
  const categoryNoIndex = Boolean(categoryShareMeta && !categoryShareMeta.indexable);
  const publishedInventoryItems = listProfileInventoryItems(inventoryCategories);
  const categoryInventoryItems = categoryShareMeta
    ? publishedInventoryItems.filter((item) => categoryShareMeta.itemSlugs.includes(item.slug))
    : [];
  const openInventoryDirectConnect = (itemName: string, itemId: string) => {
    setExpressServiceContext(null);
    setExpressInventoryContext({ itemName, itemId });
    setExpressPanelOpen(true);
  };
  const openGeneralDirectConnect = () => {
    setExpressServiceContext(null);
    setExpressInventoryContext(null);
    setExpressPanelOpen(true);
  };
  const openServiceDirectConnect = (serviceName?: string) => {
    const selectedService = sanitizePublicDiscoveryText(serviceName, 180);
    setExpressInventoryContext(null);
    setExpressServiceContext(selectedService || null);
    setExpressPanelOpen(true);
  };
  const templateIndependentInventoryContext =
    siteTemplate !== "wholesaler" && (inventoryItemShareMeta || categoryShareMeta) ? (
      <section
        className="mx-auto w-full max-w-6xl border-y border-white/10 bg-stone-950 px-4 py-6 text-white md:px-6"
        data-testid="public-profile-inventory-context"
        data-public-inventory-category={categoryShareMeta?.categorySlug}
        data-public-inventory-item={inventoryItemShareMeta?.itemSlug}
      >
        <div className="grid gap-5 md:grid-cols-[minmax(220px,360px)_1fr] md:items-start">
          <img
            src={inventoryItemShareMeta?.imageUrl || categoryShareMeta?.imageUrl}
            alt={inventoryItemShareMeta?.imageAlt || categoryShareMeta?.imageAlt || ""}
            className="aspect-[16/10] w-full rounded-2xl bg-white/5 object-contain"
          />
          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ts-orange">
                {inventoryItemShareMeta
                  ? inventoryItemShareMeta.category || "Current inventory"
                  : `${categoryShareMeta?.itemCount || 0} current ${
                      categoryShareMeta?.itemCount === 1 ? "selection" : "selections"
                    }`}
              </p>
              {inventoryItemShareMeta ? (
                inventoryItemShareMeta.hasPublicName ? (
                  <h1 className="mt-2 text-3xl font-bold text-white">
                    {inventoryItemShareMeta.itemName}
                  </h1>
                ) : null
              ) : (
                <h1 className="mt-2 text-3xl font-bold text-white">
                  {categoryShareMeta?.categoryName}
                </h1>
              )}
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">
                {inventoryItemShareMeta?.description || categoryShareMeta?.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ShareButton
                destination={currentPageShareDestination}
                title={currentPageShareTitle}
                text={
                  inventoryItemShareMeta && !inventoryItemShareMeta.hasPublicName
                    ? `View this stone selection from ${displayName} and request current availability.`
                    : `View ${currentPageShareTitle} from ${displayName}`
                }
                imageUrl={seoImage}
                className="border-white/20 text-white"
              />
              <Button
                type="button"
                onClick={() =>
                  openInventoryDirectConnect(
                    inventoryItemShareMeta
                      ? inventoryItemShareMeta.itemName
                      : categoryShareMeta?.categoryName || "Current inventory",
                    inventoryItemShareMeta?.itemSlug || categoryShareMeta?.categorySlug || ""
                  )
                }
                className="bg-ts-orange text-white hover:bg-ts-orange-dark"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {inventoryItemShareMeta
                  ? inventoryItemShareMeta.hasPublicName
                    ? "Ask about this item"
                    : "Ask about availability"
                  : "Ask about this category"}
              </Button>
            </div>
            {categoryInventoryItems.length > 0 ? (
              <div
                className="grid max-h-[34rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
                aria-label={`${categoryShareMeta?.categoryName} inventory`}
              >
                {categoryInventoryItems.map((item) => {
                  const itemPath =
                    buildProfilePublicItemPath({
                      profileBasePath: profileShareDestination,
                      itemType: "inventory",
                      itemSlug: item.slug,
                      contentBlocks,
                    }) || profileShareDestination;
                  return (
                    <a
                      key={item.slug}
                      href={itemPath}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-ts-orange/60 hover:bg-white/10"
                    >
                      <span className="block truncate font-semibold text-white">{item.name}</span>
                      <span className="mt-1 block text-xs text-white/60">
                        View exact item and photos
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    ) : null;

  if (isSteelHomePackagesProfileSlug(profile.slug)) {
    const steelHomePageMetadata = steelHomeBuilderRoute
      ? STEEL_HOME_BUILDER_PAGE_METADATA[steelHomeBuilderRoute]
      : null;
    const steelHomeRequestHref = qualifyPublicProfileItemDestination(
      STEEL_HOME_PACKAGES_START_REQUEST_PATH,
      platformBaseHref
    );
    const steelHomeLaborRequestHref = qualifyPublicProfileItemDestination(
      STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
      platformBaseHref
    );
    const steelHomeCanonical = steelHomeBuilderRoute
      ? new URL(
          buildSteelHomeBuilderPath(steelHomeBuilderRoute),
          typeof window !== "undefined" ? window.location.origin : getCanonicalAppOrigin()
        ).toString()
      : seoCanonical;
    const steelHomeSeoTitle = steelHomePageMetadata?.title || seoTitle;

    return (
      <>
        <SEOHelmet
          title={steelHomeSeoTitle}
          socialTitle={steelHomeSeoTitle}
          description={
            steelHomePageMetadata?.description ||
            profile.seoMeta?.description ||
            STEEL_HOME_PACKAGES_PROFILE_CONTENT.hero.body
          }
          canonical={steelHomeCanonical}
          ogType="website"
          noIndex
        />
        {manageChrome}
        <SteelHomePackagesProfile
          requestHref={steelHomeRequestHref}
          laborRequestHref={steelHomeLaborRequestHref}
          platformBaseHref={platformBaseHref}
          initialBuilder={steelHomeBuilderRoute}
          onNavigateBuilder={(builder) =>
            navigate(
              builder
                ? buildSteelHomeBuilderPath(builder)
                : `/u/${encodeURIComponent(profile.slug)}`,
              {
                replace: false,
                state: createProfileHistoryBoundaryState(
                  window.history.state,
                  PROFILE_HISTORY_BOUNDARY_KEY,
                  profile.slug
                ),
              }
            )
          }
        />
      </>
    );
  }

  if (profile.slug === PRECISION_AERIAL_PROFILE_SLUG) {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          socialTitle={socialTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={pageOgType}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(galleryItemShareMeta)}
          noIndex={categoryNoIndex}
        />
        {manageChrome}
        {templateIndependentInventoryContext}
        <PrecisionAerialProfile
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          headline={publicHeadline}
          contentBlocks={contentBlocks}
          brandColors={business?.brandColors}
          services={serviceTags}
          serviceAreas={serviceAreas}
          aboutText={aboutText}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          profileShareDestination={profileShareDestination}
          profileShareImage={seoImage}
          onDirectConnect={openServiceDirectConnect}
          deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
          trustActions={renderProfileTrustActions("light", "compact")}
          profileItems={
            hasVisiblePublicProfileItems(profileItems, profileSections) ? (
              <PublicProfileItems
                items={profileItems}
                profileSections={profileSections}
                platformBaseHref={platformBaseHref}
              />
            ) : null
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          businessAddress={publicBusinessAddress}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode="service"
          initialServiceName={expressServiceContext}
          initialRequestType={expressServiceContext ? "request_service" : null}
          deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
          stayInProfile
        />
      </>
    );
  }

  if (siteTemplate === "auto-glass" || profile.slug === "jrs-auto-glass") {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          socialTitle={socialTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={pageOgType}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(itemShareMeta)}
          noIndex={categoryNoIndex}
        />
        {manageChrome}
        {templateIndependentInventoryContext}
        <JrsAutoGlassProfileTheme
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          onDirectConnect={openGeneralDirectConnect}
          hasViewerSession={hasViewerSession}
          tradeScoutReturnHref={tradeScoutReturnHref}
          profileShareDestination={profileShareDestination}
          publicRouteContentBlocks={contentBlocks}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          recommendationsDirectory={recommendationsDirectory}
          trustActions={renderProfileTrustActions("dark")}
          profileItems={
            hasVisiblePublicProfileItems(profileItems, profileSections) ? (
              <PublicProfileItems
                items={profileItems}
                profileSections={profileSections}
                platformBaseHref={platformBaseHref}
              />
            ) : null
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          businessAddress={publicBusinessAddress}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode={expressInventoryContext ? "materials" : "auto_glass"}
          initialStoneName={expressInventoryContext?.itemName}
          initialItemId={expressInventoryContext?.itemId}
          initialRequestType={expressInventoryContext ? "request_material" : null}
        />
      </>
    );
  }

  // Legacy specialty shell until a fabrication gallery template ships.
  if (profile.slug === "pro-fab-specialty-services") {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          socialTitle={socialTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={pageOgType}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(itemShareMeta)}
          noIndex={categoryNoIndex}
        />
        {manageChrome}
        {templateIndependentInventoryContext}
        <ProFabProfileTheme
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          onDirectConnect={openGeneralDirectConnect}
          hasViewerSession={hasViewerSession}
          tradeScoutReturnHref={tradeScoutReturnHref}
          recommendationsDirectory={recommendationsDirectory}
          trustActions={renderProfileTrustActions("dark")}
          profileItems={
            hasVisiblePublicProfileItems(profileItems, profileSections) ? (
              <PublicProfileItems
                items={profileItems}
                profileSections={profileSections}
                platformBaseHref={platformBaseHref}
              />
            ) : null
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          businessAddress={publicBusinessAddress}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode={expressInventoryContext ? "materials" : "service"}
          initialStoneName={expressInventoryContext?.itemName}
          initialItemId={expressInventoryContext?.itemId}
          initialRequestType={expressInventoryContext ? "request_material" : null}
        />
      </>
    );
  }

  if (
    resolvedLocalServicePresentation &&
    (siteTemplate === "plumbing-company" ||
      siteTemplate === "electrician-solo" ||
      resolvedLocalServicePresentation.template === "local-service")
  ) {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          socialTitle={socialTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={pageOgType}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(galleryItemShareMeta)}
          noIndex={categoryNoIndex}
        />
        {manageChrome}
        {templateIndependentInventoryContext}
        <LocalServiceProfileTheme
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          presentation={resolvedLocalServicePresentation}
          onDirectConnect={openGeneralDirectConnect}
          hasViewerSession={hasViewerSession}
          tradeScoutReturnHref={tradeScoutReturnHref}
          profileShareDestination={profileShareDestination}
          publicRouteContentBlocks={contentBlocks}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          recommendationsDirectory={recommendationsDirectory}
          trustActions={renderProfileTrustActions("dark")}
          verificationStatus={business?.verificationStatus}
          verifiedBadge={business?.verifiedBadge === true}
          communityVerification={business?.communityVerification}
          profileItems={
            hasVisiblePublicProfileItems(profileItems, profileSections) ? (
              <PublicProfileItems
                items={profileItems}
                profileSections={profileSections}
                platformBaseHref={platformBaseHref}
              />
            ) : null
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          businessAddress={publicBusinessAddress}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode={expressInventoryContext ? "materials" : "service"}
          initialStoneName={expressInventoryContext?.itemName}
          initialItemId={expressInventoryContext?.itemId}
          initialRequestType={expressInventoryContext ? "request_material" : null}
        />
      </>
    );
  }

  if (siteTemplate === "videographer") {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          socialTitle={socialTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={pageOgType}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(galleryItemShareMeta)}
          noIndex={categoryNoIndex}
        />
        {manageChrome}
        {templateIndependentInventoryContext}
        <VideographerProfileTheme
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          headline={publicHeadline}
          contentBlocks={contentBlocks}
          services={serviceTags}
          serviceAreas={serviceAreas}
          aboutText={aboutText}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          profileShareDestination={profileShareDestination}
          onDirectConnect={openServiceDirectConnect}
          deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
          trustActions={renderProfileTrustActions("dark")}
          profileItems={
            hasVisiblePublicProfileItems(profileItems, profileSections) ? (
              <PublicProfileItems
                items={profileItems}
                profileSections={profileSections}
                platformBaseHref={platformBaseHref}
              />
            ) : null
          }
        />
        <ExpressDirectConnectPanel
          open={expressPanelOpen}
          onClose={() => setExpressPanelOpen(false)}
          profileSlug={profile.slug}
          platformBaseHref={platformBaseHref}
          businessName={displayName}
          businessAddress={publicBusinessAddress}
          hasViewerSession={hasViewerSession}
          allowCall={canExpressCall}
          requestMode="service"
          initialServiceName={expressServiceContext}
          initialRequestType={expressServiceContext ? "request_service" : null}
          deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
        />
      </>
    );
  }

  if (siteTemplate === "wholesaler" || isTradePartner(business)) {
    return (
      <>
        <SEOHelmet
          title={seoTitle}
          socialTitle={socialTitle}
          description={seoDescription}
          canonical={seoCanonical}
          ogType={pageOgType}
          ogImage={seoImage}
          structuredData={structuredData}
          preserveCanonicalQuery={Boolean(itemShareMeta)}
          noIndex={categoryNoIndex}
        />
        {manageChrome}
        <div
          style={
            {
              ["--ts-profile-top-offset" as string]:
                viewerCanManage || wantsManageUi ? "3.5rem" : "0px",
            } as CSSProperties
          }
        >
          <WholesalerProfileTheme
            profileSlug={profile.slug}
            displayName={displayName}
            businessAddress={publicBusinessAddress}
            headline={publicHeadline}
            contentBlocks={contentBlocks}
            categories={publicCategories}
            serviceAreas={publicServiceAreas}
            brandColors={business?.brandColors}
            contactReason={profile.contactPolicy?.reason}
            hasViewerSession={hasViewerSession}
            isSuperAdminViewer={isSuperAdminViewer}
            useExpressDirectConnect={useExpressDirectConnect}
            allowExpressCall={canExpressCall}
            profileShareDestination={profileShareDestination}
            currentPageShareDestination={currentPageShareDestination}
            currentPageShareTitle={
              currentPageShareTitle === displayName
                ? displayName
                : `${currentPageShareTitle} | ${displayName}`
            }
            sharedInventoryCategorySlug={categoryShareMeta?.categorySlug || null}
            platformBaseHref={platformBaseHref}
            sharedGallerySlug={sharedGallerySlug}
            tradeScoutReturnHref={tradeScoutReturnHref}
            directConnectHref={directConnectHref}
            preScoutCreateHref={preScoutCreateHref}
            preScoutSignInHref={preScoutSignInHref}
            recommendationsDirectory={recommendationsDirectory}
            recommendationDirectorySummary={recommendationDirectorySummary}
            trustActions={renderProfileTrustActions("light")}
            featuredStoneSlugs={featuredStoneSlugs}
            profileItems={
              hasVisiblePublicProfileItems(profileItems, profileSections) ? (
                <PublicProfileItems
                  items={profileItems}
                  profileSections={profileSections}
                  platformBaseHref={platformBaseHref}
                />
              ) : null
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHelmet
        title={seoTitle}
        socialTitle={socialTitle}
        description={seoDescription}
        canonical={seoCanonical}
        ogType={pageOgType}
        ogImage={seoImage}
        structuredData={structuredData}
        preserveCanonicalQuery={Boolean(itemShareMeta)}
        noIndex={categoryNoIndex}
      />
      {manageChrome}
      {templateIndependentInventoryContext}
      <div
        style={
          {
            ["--ts-profile-top-offset" as string]:
              viewerCanManage || wantsManageUi ? "3.5rem" : "0px",
          } as CSSProperties
        }
      >
        <DefaultProfileTheme
          businessName={displayName}
          operatorName={defaultOperatorName || undefined}
          presentationVariant={defaultPresentationVariant}
          profileKind={business ? "business" : "community"}
          categoryLabel={publicCategories[0] || undefined}
          locationLabel={defaultLocationLabel || undefined}
          headline={publicHeadline}
          heroTitle={defaultHeroTitle || undefined}
          heroText={defaultHeroText || undefined}
          logoUrl={defaultLogoUrl || undefined}
          heroImageUrl={defaultHeroImageUrl || undefined}
          heroImageAlt={defaultHeroImageAlt}
          featuredWorkUrl={defaultFeaturedWorkUrl || undefined}
          brandColors={business?.brandColors}
          services={serviceTags}
          serviceAreas={serviceAreas}
          aboutText={defaultAboutText}
          galleryItems={galleryItems}
          sharedGallerySlug={sharedGallerySlug}
          socials={defaultSocials}
          customBlocks={customBlocks}
          badges={
            publicCategories.length > 0 ? publicCategories : business ? [] : [profileTypeLabel]
          }
          stats={quickFacts}
          recommendations={defaultRecommendations}
          recommendationMode={recommendationDirectoryMode}
          showAbout={profileSections.about !== false}
          showBadges={profileSections.rolesAndBadges !== false}
          showStats={profileSections.stats !== false}
          showServices={profileSections.services !== false}
          showServiceAreas={profileSections.services !== false}
          showRecommendations={profileSections.reviews !== false}
          showContact={showContactCard}
          deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
          onDirectConnect={openServiceDirectConnect}
          shareAction={
            <ShareButton
              destination={currentPageShareDestination}
              title={currentPageShareTitle}
              text={`Check out ${currentPageShareTitle} on TradeScout`}
              imageUrl={seoImage}
              className="rounded-full border-[var(--profile-line)] bg-[var(--profile-primary-soft)] text-[var(--profile-fg)]"
            />
          }
          renderGalleryShare={(item) => (
            <ShareButton
              destination={
                buildProfilePublicItemPath({
                  profileBasePath: profileShareDestination,
                  itemType: "gallery",
                  itemSlug: item.slug,
                  contentBlocks,
                }) || profileShareDestination
              }
              title={`${item.title} by ${displayName}`}
              text={`View ${item.title} from ${displayName} on TradeScout`}
              imageUrl={gallerySocialPreviewImageUrl(item)}
              className="border-[var(--profile-line)] text-[var(--profile-surface-fg)]"
            />
          )}
          bookingSection={
            bookingEnabled ? (
              <div className="rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-surface)] p-6 text-[var(--profile-surface-fg)] sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] opacity-60">
                      <Calendar className="h-4 w-4 text-ts-orange" />
                      Bookings
                    </p>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">Request a time.</h2>
                  </div>
                  <ProfileBookingRequestDialog
                    profileId={profile.id}
                    profileName={displayName}
                    timezone={timezone}
                    pricingRows={pricingRows}
                    paidBookings={paidBookings}
                    bookingPriceUsd={bookingPriceUsd}
                    bookingCategory={bookingCategory}
                    bookingStateCode={business?.stateCode || ""}
                    hasViewerSession={hasViewerSession}
                    viewerCanManage={viewerCanManage}
                    signInHref={bookingSignInHref}
                    platformBaseHref={platformBaseHref}
                  />
                </div>
                {calendarVisibility === "public" && slots.length > 0 ? (
                  <div className="mt-6 grid gap-2 text-sm opacity-70 sm:grid-cols-2">
                    {slots.slice(0, 14).map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-[var(--profile-line)] px-4 py-3"
                      >
                        <span className="flex items-center gap-2">
                          <Clock3 className="h-3.5 w-3.5" />
                          {dayNames[slot.dayOfWeek] || "Day"}
                        </span>
                        <span>
                          {slot.startTime}–{slot.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {booking.pricingTableEnabled === true && pricingRows.length > 0 ? (
                  <div className="mt-6 divide-y divide-[var(--profile-line)] border-y border-[var(--profile-line)] text-sm">
                    {pricingRows.slice(0, 10).map((row) => (
                      <div key={row.id} className="flex justify-between gap-4 py-3">
                        <span>{row.name}</span>
                        <span className="font-black">{row.priceLabel}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null
          }
          profileItems={
            hasVisiblePublicProfileItems(profileItems, profileSections) ? (
              <PublicProfileItems
                items={profileItems}
                profileSections={profileSections}
                platformBaseHref={platformBaseHref}
              />
            ) : null
          }
          trustActions={renderProfileTrustActions(
            "dark",
            defaultPresentationVariant === "first-deliverable" ? "compact" : "default"
          )}
          lightTrustActions={renderProfileTrustActions(
            "light",
            defaultPresentationVariant === "first-deliverable" ? "compact" : "default"
          )}
          tradeScoutHandoff={
            <TradeScoutProfileHandoff
              profileSlug={profile.slug}
              profileName={displayName}
              itemName={inventoryItemShareMeta?.itemName || galleryItemShareMeta?.itemTitle}
              platformBaseHref={platformBaseHref}
            />
          }
        />
      </div>
      <ExpressDirectConnectPanel
        open={expressPanelOpen}
        onClose={() => setExpressPanelOpen(false)}
        profileSlug={profile.slug}
        platformBaseHref={platformBaseHref}
        businessName={displayName}
        businessAddress={publicBusinessAddress}
        hasViewerSession={hasViewerSession}
        allowCall={canExpressCall}
        requestMode={expressInventoryContext ? "materials" : "service"}
        initialStoneName={expressInventoryContext?.itemName}
        initialItemId={expressInventoryContext?.itemId}
        initialServiceName={expressInventoryContext ? null : expressServiceContext}
        contactOperatorName={defaultOperatorName || undefined}
        initialRequestType={
          expressInventoryContext
            ? "request_material"
            : expressServiceContext
              ? "request_service"
              : null
        }
        deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
      />
    </>
  );
}
