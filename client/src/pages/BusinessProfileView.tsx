import React, { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  BriefcaseBusiness,
  Compass,
  Edit,
  FileCheck2,
  Globe,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Shield,
  ShieldCheck,
} from "lucide-react";
import type { BusinessProfile } from "@/../../shared/businessProfile";
import type { PublicBusinessListingCard } from "@shared/publicBusinessListing";
import { recordActivity } from "@/agent/activity";
import { useAuth } from "@/hooks/useAuth";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import { SEOHelmet, createLocalBusinessStructuredData } from "@/components/SEOHelmet";
import { useToast } from "@/hooks/use-toast";
import { DecisionCard } from "@/components/community/DecisionCard";
import { ShareButton } from "@/components/ShareButton";
import { ProfileBookingRequestDialog } from "@/components/profile/ProfileBookingRequestDialog";
import { apiRequest } from "@/lib/queryClient";
import { getCategoryPlaceholderSrc } from "@/lib/categoryPlaceholders";
import { stripCountySuffix } from "@/lib/userFacingCopy";
import {
  buildProfileGalleryShareSearch,
  createProfileGalleryItemShareMetadata,
  listProfileGalleryItems,
} from "@shared/profileGalleryShare";
import { shouldNoIndexBusinessProfile } from "@/lib/businessProfileIndexability";
import { slugifyCountyName } from "@shared/tradeSeo";
import {
  appendDiscoveryAttributionHandoff,
  getPublishedDiscoveryCanonicalRoute,
  trackDiscoveryLandingOnce,
  trackPublicProfileCtaOnce,
} from "@/lib/discoveryLanding";

/**
 * PublicBusinessProfileView
 *
 * Renders a public business page at /business/:slug.
 *
 * Contract:
 * - Fetches via GET /api/business-profile/slug/:slug
 * - Renders: name, location, description, service areas, website
 * - Primary CTA: "Contact via TradeScout" → routes to Direct Connect or Scout
 * - Owner-only: Shows "Edit Business Page" button
 * - Telemetry: business_profile_viewed { slug, isOwner }
 * - Empty state: encourages adding business details if no description
 */
export default function BusinessProfileView() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileSource, setProfileSource] = useState<"published" | "directory" | null>(null);
  const [directoryBusinessId, setDirectoryBusinessId] = useState<string | null>(null);
  const [directoryClaimStatus, setDirectoryClaimStatus] = useState<"unclaimed" | "claimed" | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.businessSlug === slug;
  const viewerVerified = Boolean(user?.addressVerified);

  const [showCallDecisionCard, setShowCallDecisionCard] = useState(false);
  const [callBusy, setCallBusy] = useState(false);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestKind, setSuggestKind] = useState<"edit" | "removal">("edit");
  const [suggestMessage, setSuggestMessage] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const profileContentBlocks = Array.isArray(profile?.contentBlocks) ? profile.contentBlocks : [];
  const profileGalleryItems = listProfileGalleryItems(profileContentBlocks);
  const requestedGallerySlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("gallery")
      : null;
  const galleryShareMeta =
    profile && slug && typeof window !== "undefined"
      ? createProfileGalleryItemShareMetadata({
          profileName: profile.name,
          profileUrl: `${window.location.origin}/business/${encodeURIComponent(slug)}`,
          assetOrigin: window.location.origin,
          contentBlocks: profileContentBlocks,
          itemSlug: requestedGallerySlug,
        })
      : null;

  const slugifyCity = (value: string) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  function formatListingPrice(price: PublicBusinessListingCard["price"]): string {
    const numeric = typeof price === "number" ? price : Number((price as any) ?? 0);
    if (!Number.isFinite(numeric)) return "—";
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  useEffect(() => {
    if (!slug) {
      setError("Invalid profile URL");
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        const response = await fetch(`/api/business-profile/slug/${slug}`);
        const data = response.ok ? await response.json() : null;
        const canonicalProfilePath =
          typeof data?.canonicalProfilePath === "string" ? data.canonicalProfilePath.trim() : "";
        if (canonicalProfilePath.startsWith("/u/")) {
          const search = typeof window === "undefined" ? "" : window.location.search;
          setLocation(`${canonicalProfilePath}${search}`);
          return;
        }

        // The governed directory contract wins a slug collision. Legacy
        // preference-backed profiles remain an exact-link/noindex fallback.
        const directoryRes = await fetch(`/api/public/businesses/${slug}`);
        if (directoryRes.ok) {
          const directoryData: any = await directoryRes.json();
          const counties = Array.isArray(directoryData?.counties) ? directoryData.counties : [];
          const primaryCounty = counties[0] || null;
          const publicProfile = directoryData?.profile || {};
          const primaryStateCode = primaryCounty?.stateCode
            ? String(primaryCounty.stateCode).trim().toUpperCase()
            : null;
          const publicProfileStateCode = publicProfile?.stateCode
            ? String(publicProfile.stateCode).trim().toUpperCase()
            : null;
          const publicCity =
            !primaryStateCode || publicProfileStateCode === primaryStateCode
              ? publicProfile?.city || null
              : null;
          const importExtras = publicProfile?.importExtras || {};
          const directoryTier =
            directoryData?.publication?.tier === "verified" ? "verified" : "unclaimed";
          const publicServices = Array.isArray(publicProfile?.services)
            ? publicProfile.services.filter((item: any) => typeof item === "string")
            : [];

          const directoryProfile: BusinessProfile = {
            id: String(directoryData?.id || ""),
            userId: null as any,
            slug: String(directoryData?.slug || slug),
            name: String(directoryData?.name || slug),
            headline: publicProfile?.tagline || publicProfile?.category || null,
            description: publicProfile?.description ?? null,
            services: publicServices,
            countyFips: primaryCounty?.fips || null,
            countyName: primaryCounty?.name || null,
            city: publicCity,
            stateCode: primaryStateCode || publicProfileStateCode || null,
            serviceAreas: counties.map((c: any) => String(c?.name || "")).filter(Boolean),
            // Prevent contact bypass for directory shells; contact stays Scout-gated.
            website: null,
            address: null,
            zipCode: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: null as any,
            // These optional fields are read by the view; keep safe defaults.
            verificationStatus: (directoryTier === "verified"
              ? "approved"
              : "directory_unclaimed") as any,
            addressVerified: (directoryTier === "verified") as any,
            cvsScore: null as any,
            googleRating:
              typeof importExtras?.averageRating === "number" ? importExtras.averageRating : null,
            googleReviewCount:
              typeof importExtras?.reviewCount === "number" ? importExtras.reviewCount : null,
            googleMapsUrl: null,
            directoryPublication: directoryData?.publication || null,
            dataSource: importExtras?.source || "directory_import",
          } as any;

          setDirectoryBusinessId(String(directoryData?.id || ""));
          setDirectoryClaimStatus(
            String(directoryData?.claimStatus || "").toLowerCase() === "claimed"
              ? "claimed"
              : "unclaimed"
          );
          setProfileSource("directory");
          setProfile(directoryProfile);
          setLoading(false);
          return;
        }

        if (directoryRes.status !== 404) {
          throw new Error(`Directory profile lookup failed (${directoryRes.status})`);
        }

        if (!response.ok) {
          setError(
            response.status === 404 ? "Business profile not found" : "Failed to load profile"
          );
          setLoading(false);
          return;
        }
        setProfileSource("published");
        setDirectoryBusinessId(null);
        setDirectoryClaimStatus(null);
        setProfile(data);

        // Non-optional telemetry
        recordActivity({
          type: "business_profile_viewed" as any,
          ts: new Date().toISOString(),
          path: window.location.pathname,
          meta: {
            slug,
            isOwner: user?.businessSlug === slug,
          },
        });
      } catch (err) {
        console.error("Error fetching business profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [slug, user?.businessSlug]);

  useEffect(() => {
    if (!galleryShareMeta?.itemSlug) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`business-gallery-${galleryShareMeta.itemSlug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [galleryShareMeta?.itemSlug]);

  const directoryDiscoverable =
    profileSource === "directory" && (profile as any)?.directoryPublication?.crawlable === true;

  useEffect(() => {
    if (!directoryDiscoverable || isOwner || typeof window === "undefined") return;
    const canonicalRoute = getPublishedDiscoveryCanonicalRoute();
    if (canonicalRoute !== `/business/${String(slug || "").toLowerCase()}`) return;
    void trackDiscoveryLandingOnce({
      canonicalRoute,
      search: window.location.search,
      referrer: document.referrer || null,
    });
  }, [directoryDiscoverable, isOwner, slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2" data-testid="not-found">
                {error || "Profile not found"}
              </h2>
              <p className="text-muted-foreground mb-6">
                This business profile could not be loaded.
              </p>
              <Button onClick={() => setLocation("/community")}>Browse Community</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const businessProfile = profile;
  const listings = Array.isArray(profile.marketplaceListings) ? profile.marketplaceListings : [];
  const hasDescription = profile.description && profile.description.trim().length > 0;
  const hasServiceAreas = profile.serviceAreas && profile.serviceAreas.length > 0;
  const serviceList = Array.isArray(profile.services) ? profile.services.filter(Boolean) : [];
  const localArea =
    stripCountySuffix(profile.countyName) || profile.city || profile.stateCode || "this market";
  const locationLabel = [
    profile.city,
    profile.countyName ? stripCountySuffix(profile.countyName) || profile.countyName : null,
    profile.stateCode,
  ]
    .filter(Boolean)
    .join(", ");
  const publicCountySlug = profile.countyName
    ? slugifyCountyName(stripCountySuffix(profile.countyName) || profile.countyName)
    : "";
  const primaryServiceLabelRaw = String(serviceList[0] || profile.headline || "Local business");
  const primaryServiceLabel =
    primaryServiceLabelRaw.length > 44
      ? `${primaryServiceLabelRaw.slice(0, 41).trim()}...`
      : primaryServiceLabelRaw;
  const profilePlaceholderSrc = getCategoryPlaceholderSrc([
    ...serviceList.slice(0, 4),
    profile.headline,
    primaryServiceLabelRaw,
  ]);
  const visibleSections = {
    about: profile.profileSections?.about !== false,
    rolesAndBadges: profile.profileSections?.rolesAndBadges !== false,
    stats: profile.profileSections?.stats !== false,
    services: profile.profileSections?.services !== false,
    marketplaceListings: profile.profileSections?.marketplaceListings !== false,
    reviews: profile.profileSections?.reviews !== false,
    communityActivity: profile.profileSections?.communityActivity === true,
    contactCard: profile.profileSections?.contactCard !== false,
  };
  const contentBlocks = profileContentBlocks;
  const bookingConfig = profile.bookingConfig || null;
  const hasCustomHero = contentBlocks.some(
    (block: any) => String(block?.type || "").toLowerCase() === "hero"
  );
  const hasCustomCta = contentBlocks.some(
    (block: any) => String(block?.type || "").toLowerCase() === "cta"
  );
  const businessPromise =
    profile.headline ||
    (serviceList.length > 0
      ? `${serviceList.slice(0, 2).join(" + ")} in ${localArea}.`
      : profile.description
        ? `${profile.name} serves ${localArea}.`
        : "");
  const verificationStatus = String(profile.verificationStatus || "").toLowerCase();
  const addressVerified = Boolean(profile.addressVerified);
  const isDirectoryUnclaimed =
    profileSource === "directory" && directoryClaimStatus === "unclaimed";
  const verificationTone = (() => {
    if (verificationStatus === "approved") return "bg-emerald-600 text-white";
    if (verificationStatus === "directory_unclaimed") return "bg-white/10 text-white";
    if (verificationStatus === "under_review" || verificationStatus === "pending") {
      return "bg-amber-500 text-black";
    }
    if (verificationStatus === "rejected" || verificationStatus === "expired") {
      return "bg-red-600 text-white";
    }
    if (verificationStatus === "suspended") return "bg-white/10 text-white";
    return "bg-white/10 text-white";
  })();
  const verificationLabel = (() => {
    if (verificationStatus === "approved") return "Professional Verified";
    if (verificationStatus === "directory_unclaimed") return "Unclaimed directory listing";
    if (verificationStatus === "under_review") return "Verification Review";
    if (verificationStatus === "pending") return "Verification Pending";
    if (verificationStatus === "rejected") return "Verification Required";
    if (verificationStatus === "expired") return "Verification Expired";
    if (verificationStatus === "suspended") return "Verification Suspended";
    return "Verification status unavailable";
  })();
  const trustHighlights = [
    isDirectoryUnclaimed ? "Claimable" : null,
    verificationLabel,
    !isDirectoryUnclaimed && addressVerified ? "Address checked" : null,
    !isDirectoryUnclaimed && verificationStatus && !addressVerified ? "Address pending" : null,
    bookingConfig?.enabled ? "Booking available" : null,
    profile.customDomainVerification?.state === "verified" ? "Domain connected" : null,
  ].filter(Boolean) as string[];
  const trustProofItems = [
    isDirectoryUnclaimed
      ? "This source-backed directory listing is unclaimed and can be claimed through TradeScout."
      : `Profile status: ${verificationLabel}.`,
    isDirectoryUnclaimed
      ? null
      : addressVerified
        ? "Address verification is complete."
        : "Address verification is still pending.",
    profile.customDomainVerification?.state === "verified" ? "A custom domain is connected." : null,
    listings.length > 0
      ? `${listings.length} active listing${listings.length === 1 ? "" : "s"} published.`
      : "No active listings yet.",
  ].filter((item): item is string => Boolean(item));
  const showListingsSection = visibleSections.marketplaceListings && listings.length > 0;

  function renderContentBlock(block: any, idx: number) {
    const profile = businessProfile;
    const type = String(block?.type || "text").toLowerCase();
    const key = block?.id || `${type}-${idx}`;

    if (type === "hero") {
      return (
        <Card key={key} className="border-2" style={themeStyle}>
          <CardContent className="pt-6 space-y-3">
            {block?.title ? <h2 className="text-2xl font-bold">{block.title}</h2> : null}
            {block?.body ? (
              <p className="text-muted-foreground whitespace-pre-wrap">{block.body}</p>
            ) : null}
            {block?.imageUrl ? (
              <a
                href={block.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                View hero image
              </a>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    if (type === "faq") {
      return (
        <Card key={key} style={themeStyle}>
          <CardHeader>
            <CardTitle>{block?.title || "FAQ"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block?.body || ""}</p>
            {block?.secondaryBody ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {block.secondaryBody}
              </p>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    if (type === "proof") {
      return (
        <Card key={key} style={themeStyle}>
          <CardHeader>
            <CardTitle>{block?.title || "Proof"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {block?.body ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block.body}</p>
            ) : null}
            {block?.secondaryBody ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {block.secondaryBody}
              </p>
            ) : null}
            <Badge variant="secondary">Trust Signal</Badge>
          </CardContent>
        </Card>
      );
    }

    if (type === "cta") {
      return (
        <Card key={key} className="border-2" style={themeStyle}>
          <CardContent className="pt-6 text-center space-y-3">
            {block?.title ? <h3 className="text-xl font-semibold">{block.title}</h3> : null}
            {block?.body ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block.body}</p>
            ) : null}
            <Button
              onClick={() => {
                const params = new URLSearchParams({
                  prefill_businessName: businessProfile.name,
                  prefill_businessSlug: businessProfile.slug,
                  prefill_countyFips: businessProfile.countyFips || "",
                });
                if (directoryBusinessId) params.set("targetProviderId", directoryBusinessId);
                if (businessProfile.userId) params.set("target", String(businessProfile.userId));
                setLocation(`/direct-connect?${params.toString()}`);
              }}
            >
              {block?.ctaLabel || profile.ctaConfig?.primary?.label || "Direct Connect"}
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (type === "gallery") {
      const galleryItem = profileGalleryItems.find((item) => item.blockIndex === idx);
      const isSharedGalleryItem = galleryItem?.slug === galleryShareMeta?.itemSlug;
      return (
        <Card
          key={key}
          id={galleryItem ? `business-gallery-${galleryItem.slug}` : undefined}
          style={themeStyle}
          className={isSharedGalleryItem ? "ring-2 ring-ts-orange ring-offset-2" : undefined}
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{block?.title || "Gallery"}</CardTitle>
              {isSharedGalleryItem ? <Badge variant="secondary">Shared image</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {block?.body ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block.body}</p>
            ) : null}
            {galleryItem ? (
              <>
                <div className="overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={galleryItem.imageUrl}
                    alt={galleryItem.imageAlt}
                    className="max-h-[32rem] w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={galleryItem.imageUrl} target="_blank" rel="noreferrer">
                      Open full image
                    </a>
                  </Button>
                  <ShareButton
                    destination={`/business/${encodeURIComponent(profile.slug)}${buildProfileGalleryShareSearch(galleryItem.slug)}`}
                    title={`${galleryItem.title} by ${profile.name}`}
                    text={`View ${galleryItem.title} from ${profile.name} on TradeScout`}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add an image URL to feature media here.
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div key={key} className="rounded border p-4">
        {block?.title ? <h3 className="font-semibold mb-2">{block.title}</h3> : null}
        {block?.body ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{block.body}</p>
        ) : null}
        {block?.imageUrl ? (
          <a
            href={block.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            View image
          </a>
        ) : null}
      </div>
    );
  }
  const themeStyle = {
    background:
      profile.theme?.customColors?.background &&
      String(profile.theme.customColors.background).trim()
        ? String(profile.theme.customColors.background)
        : undefined,
    color:
      profile.theme?.customColors?.text && String(profile.theme.customColors.text).trim()
        ? String(profile.theme.customColors.text)
        : undefined,
    borderColor:
      profile.theme?.customColors?.primary && String(profile.theme.customColors.primary).trim()
        ? String(profile.theme.customColors.primary)
        : undefined,
  } as React.CSSProperties;
  // Decision-layer visibility: internal scoring and detailed trust signals should not be public/crawler-visible.
  // Keep discovery signals public (location, trade/category, unclaimed/claimed, basic verification label).
  // SEO metadata
  const pageTitle =
    galleryShareMeta?.title ||
    profile.seoMeta?.title ||
    (profile.countyName && profile.stateCode
      ? `${profile.name} in ${profile.countyName}, ${profile.stateCode} | TradeScout`
      : `${profile.name} | TradeScout`);

  const pageDescription =
    galleryShareMeta?.description ||
    profile.seoMeta?.description ||
    (hasDescription
      ? (profile.description || "").slice(0, 155)
      : `${profile.name} serving ${profile.countyName || "local areas"}${profile.serviceAreas && profile.serviceAreas.length > 0 ? " and nearby areas" : ""}. Contact via TradeScout.`);

  const canonicalUrl =
    galleryShareMeta?.canonical || `${window.location.origin}/business/${profile.slug}`;
  const showClaimCta =
    !isOwner &&
    profileSource === "directory" &&
    directoryClaimStatus === "unclaimed" &&
    Boolean(directoryBusinessId);
  const showUnclaimedBadge = profileSource === "directory" && directoryClaimStatus === "unclaimed";
  const showSuggestCta = profileSource === "directory" && Boolean(directoryBusinessId);
  const googleReviewCount =
    typeof (profile as any).googleReviewCount === "number" &&
    Number.isFinite(Number((profile as any).googleReviewCount))
      ? Number((profile as any).googleReviewCount)
      : null;
  const importedAddress = [profile.address, profile.zipCode].filter(Boolean).join(" ");
  const directConnectParams = new URLSearchParams({
    prefill_businessName: profile.name,
    prefill_businessSlug: profile.slug,
    prefill_countyFips: profile.countyFips || "",
  });
  if (directoryBusinessId) directConnectParams.set("targetProviderId", directoryBusinessId);
  if (profile.userId) directConnectParams.set("target", String(profile.userId));
  const directConnectUrl = `/direct-connect?${directConnectParams.toString()}`;
  const claimParams = new URLSearchParams({
    slug: profile.slug,
    q: profile.name,
  });
  if (directoryBusinessId) claimParams.set("businessId", String(directoryBusinessId));
  if (profile.countyFips) claimParams.set("countyFips", profile.countyFips);
  if (profile.stateCode) claimParams.set("stateCode", profile.stateCode);
  const claimUrl = `/claim-my-business?${claimParams.toString()}`;
  const trackDirectoryCta = (
    ctaKind: "direct_connect" | "business_claim" | "account_create" | "booking_request"
  ) => {
    if (!directoryDiscoverable) return;
    void trackPublicProfileCtaOnce({
      ctaKind,
      canonicalRoute: `/business/${profile.slug}`,
    });
  };
  const handleDirectConnect = () => {
    trackDirectoryCta("direct_connect");
    setLocation(directConnectUrl);
  };
  const handleDirectoryAccountCreate = () => {
    trackDirectoryCta("account_create");
    const next = `/business/${profile.slug}`;
    setLocation(
      directoryDiscoverable
        ? appendDiscoveryAttributionHandoff(
            `/pre-scout-setup?mode=create&next=${encodeURIComponent(next)}`
          )
        : "/auth"
    );
  };
  const profilePulse = [
    {
      label: "Work",
      value:
        serviceList.length > 0
          ? `${serviceList.length} service${serviceList.length === 1 ? "" : "s"}`
          : "Needs details",
      icon: BriefcaseBusiness,
    },
    {
      label: "Area",
      value: locationLabel || localArea,
      icon: Compass,
    },
    {
      label: "Status",
      value: showUnclaimedBadge ? "Claimable" : verificationLabel,
      icon: FileCheck2,
    },
  ];
  const businessStructuredData = createLocalBusinessStructuredData({
    slug: profile.slug,
    name: profile.name,
    description: pageDescription,
    countyName: profile.countyName || null,
    stateCode: profile.stateCode || null,
    website: profile.website || null,
    category: null,
    verifiedLabel: isDirectoryUnclaimed ? null : verificationLabel || null,
  });
  const structuredData = galleryShareMeta
    ? {
        "@context": "https://schema.org",
        "@graph": [
          businessStructuredData,
          {
            "@type": "ImageObject",
            name: galleryShareMeta.itemTitle,
            description: galleryShareMeta.description,
            contentUrl: galleryShareMeta.imageUrl,
            url: galleryShareMeta.canonical,
          },
        ],
      }
    : businessStructuredData;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 text-white sm:py-8">
      {/* SEO Metadata */}
      <SEOHelmet
        title={pageTitle}
        description={pageDescription}
        canonical={canonicalUrl}
        ogType={galleryShareMeta ? "article" : "profile"}
        ogImage={galleryShareMeta?.imageUrl || profile.seoMeta?.imageUrl || undefined}
        structuredData={structuredData}
        preserveCanonicalQuery={Boolean(galleryShareMeta)}
        noIndex={shouldNoIndexBusinessProfile({
          profileSource,
          directoryCrawlable: (profile as any).directoryPublication?.crawlable === true,
        })}
      />

      <section className="ts-card mb-4 overflow-hidden" style={themeStyle}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              {showUnclaimedBadge ? <Badge variant="secondary">Unclaimed</Badge> : null}
              <Badge className={verificationTone}>
                <Shield className="h-3 w-3 mr-1" />
                {verificationLabel}
              </Badge>
              <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
                {primaryServiceLabel}
              </Badge>
              {googleReviewCount !== null && googleReviewCount > 0 ? (
                <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
                  {googleReviewCount.toLocaleString()} Google review
                  {googleReviewCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>

            <h1
              className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-5xl"
              data-testid="bp-headline"
            >
              {profile.name}
            </h1>

            <div className="mt-4 inline-flex items-center gap-3 rounded-[var(--ts-radius-control)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2">
              <img
                src={profilePlaceholderSrc}
                alt={`${primaryServiceLabelRaw} category placeholder illustration`}
                className="h-10 w-10 rounded bg-white/10 p-1"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.src = "/images/tradescout/categories/general-contractor.svg";
                }}
              />
            </div>

            {businessPromise ? (
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                {businessPromise}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              {importedAddress ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ts-orange" />
                  <span>{importedAddress}</span>
                </div>
              ) : null}

              {locationLabel ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ts-orange" />
                  <span>
                    {profile.city && profile.stateCode ? (
                      <>
                        <a
                          href={`/city/${profile.stateCode.toLowerCase()}/${slugifyCity(profile.city)}`}
                          className="text-white hover:text-ts-orange"
                        >
                          {profile.city}
                        </a>
                        {profile.countyName ? ", " : ""}
                      </>
                    ) : null}
                    {profile.countyName && profile.stateCode ? (
                      <a
                        href={`/county/${profile.stateCode.toLowerCase()}/${publicCountySlug}`}
                        className="text-white hover:text-ts-orange"
                      >
                        {stripCountySuffix(profile.countyName) || profile.countyName},{" "}
                        {profile.stateCode}
                      </a>
                    ) : (
                      locationLabel
                    )}
                  </span>
                </div>
              ) : null}

              {profile.website ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-ts-orange" />
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-white hover:text-ts-orange"
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {trustHighlights.slice(0, 4).map((item) => (
                <Badge key={item} variant="secondary" className="bg-white/8 text-white">
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <aside className="border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-5 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {showClaimCta ? "Claim or connect" : "Direct Connect"}
                </div>
              </div>

              {isOwner ? (
                <Button
                  className="w-full"
                  variant="outline"
                  data-testid="bp-edit"
                  onClick={() => setLocation("/profile")}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Manage Profile
                </Button>
              ) : (
                <>
                  <Button
                    className="w-full"
                    data-testid="bp-contact-cta"
                    onClick={handleDirectConnect}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Direct Connect
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>

                  {showClaimCta ? (
                    <Button
                      className="w-full border-ts-orange/40 bg-ts-orange/10 text-ts-orange hover:bg-ts-orange/15"
                      variant="outline"
                      onClick={() => {
                        trackDirectoryCta("business_claim");
                        setLocation(claimUrl);
                      }}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Claim with Google Maps
                    </Button>
                  ) : null}

                  {profileSource === "directory" && directoryBusinessId ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!user || !viewerVerified || callBusy}
                      onClick={() => {
                        if (!user) {
                          toast({
                            title: "Sign in required",
                            description: "Please sign in to initiate contact.",
                            variant: "destructive",
                          });
                          setLocation(
                            `/login?next=${encodeURIComponent(window.location.pathname)}`
                          );
                          return;
                        }
                        if (!viewerVerified) {
                          toast({
                            title: "Verification required",
                            description: "Verify your address before initiating contact.",
                            variant: "destructive",
                          });
                          setLocation("/account?tab=verification");
                          return;
                        }
                        trackDirectoryCta("direct_connect");
                        setShowCallDecisionCard(true);
                      }}
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Call after decision card
                    </Button>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {!isAuthenticated ? (
                      <Button variant="secondary" onClick={handleDirectoryAccountCreate}>
                        <BadgeCheck className="h-4 w-4 mr-2" />
                        View member details
                      </Button>
                    ) : null}
                    {showSuggestCta ? (
                      <Button variant="outline" onClick={() => setSuggestOpen(true)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Suggest Edit
                      </Button>
                    ) : null}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {profilePulse.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-[var(--ts-radius-control)] border border-[color:var(--border-subtle)] bg-black/25 p-2"
                  >
                    <Icon className="mb-1 h-4 w-4 text-ts-orange" />
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/44">
                      {label}
                    </div>
                    <div className="truncate text-xs font-medium text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {hasDescription && !visibleSections.about ? (
        <div className="ts-panel mb-6 p-5">
          <p
            className="text-base leading-relaxed text-white/76"
            data-testid="bp-mission"
            data-description={profile.description}
          >
            <span data-testid="bp-description">{profile.description}</span>
          </p>
        </div>
      ) : isOwner ? (
        <div className="ts-panel mb-6 p-5">
          <div className="text-sm font-semibold text-white">Add a short profile intro</div>
          <Button className="mt-3" variant="outline" onClick={() => setLocation("/profile")}>
            Add Business Description
          </Button>
        </div>
      ) : null}

      {/* Service Areas */}
      {hasServiceAreas && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Service Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.serviceAreas.map((area, idx) => (
                <Badge key={idx} variant="secondary">
                  {area}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Listings (seller catalog) */}
      {showListingsSection ? (
        <Card className="mb-6" data-testid="bp-active-listings">
          <CardHeader>
            <CardTitle className="text-xl">Active Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {listings.map((listing) => {
                const createdAt = listing.createdAt
                  ? new Date(listing.createdAt).toLocaleDateString()
                  : null;

                return (
                  <article
                    key={listing.id}
                    className="flex gap-3 rounded-xl border border-border bg-background/40 p-4 shadow-sm"
                    data-testid="bp-listing-card"
                  >
                    {listing.imageUrl ? (
                      <Link
                        href={listing.detailPath}
                        className="h-16 w-16 flex-none overflow-hidden rounded-md bg-muted"
                        aria-label={`View ${listing.title}`}
                      >
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      </Link>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={listing.detailPath}
                            className="block truncate text-sm font-semibold hover:text-primary hover:underline"
                          >
                            {listing.title}
                          </Link>
                          {listing.description ? (
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {listing.description}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-sm font-semibold">
                          ${formatListingPrice(listing.price)}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {listing.state}
                          {listing.county ? ` / ${listing.county}` : ""}
                        </span>
                        {listing.categoryName ? <span>• {listing.categoryName}</span> : null}
                        {createdAt ? <span>• {createdAt}</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={listing.detailPath}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          View item <ArrowRight className="h-3 w-3" />
                        </Link>
                        <span data-testid="bp-listing-share">
                          <ShareButton
                            destination={listing.detailPath}
                            title={listing.title}
                            text={`${listing.title} from ${profile.name} on TradeScout`}
                            size="sm"
                            label="Share"
                          />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Separator className="my-6" />

      {visibleSections.services && serviceList.length > 0 ? (
        <Card className="mb-6" style={themeStyle}>
          <CardHeader>
            <CardTitle>Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {serviceList.map((service, idx) => (
                <div key={`${service}-${idx}`} className="rounded-lg border bg-background/40 p-4">
                  <div className="font-medium">{service}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Available through this TradeScout business page.
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {visibleSections.about && hasDescription ? (
        <Card className="mb-6" style={themeStyle}>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
              data-testid="bp-mission"
              data-description={profile.description}
            >
              <span data-testid="bp-description">{profile.description}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {contentBlocks.length > 0 ? (
        <div className="mb-6 space-y-4">
          {contentBlocks.map((block: any, idx: number) => renderContentBlock(block, idx))}
        </div>
      ) : null}

      <Accordion
        type="single"
        collapsible
        className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] px-4"
        style={themeStyle}
      >
        <AccordionItem value="trust" className="border-white/10">
          <AccordionTrigger className="text-left text-sm font-semibold text-white hover:no-underline">
            Trust and page signals
          </AccordionTrigger>
          <AccordionContent className="grid gap-3 md:grid-cols-2">
            {trustProofItems.map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-black/20 p-3">
                {item}
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {bookingConfig?.enabled ? (
        <Card className="mb-6" style={themeStyle}>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Send a booking request through TradeScout.
              {bookingConfig.paidBookings === true &&
              typeof bookingConfig.bookingPriceUsd === "number" &&
              bookingConfig.bookingPriceUsd > 0
                ? ` This business requires a $${bookingConfig.bookingPriceUsd.toFixed(2)} deposit after the request is created.`
                : " No deposit is required to send it."}
            </p>
            {bookingConfig.timezone ? <p>Timezone: {bookingConfig.timezone}</p> : null}
            {bookingConfig.pricingTableEnabled &&
            Array.isArray(bookingConfig.pricingRows) &&
            bookingConfig.pricingRows.length > 0 ? (
              <div className="space-y-2">
                {bookingConfig.pricingRows.map((row: any) => (
                  <div key={row.id || row.name} className="rounded border p-3">
                    <div className="font-medium">
                      {row.name} {row.priceLabel ? `· ${row.priceLabel}` : ""}
                    </div>
                    {row.description ? (
                      <div className="text-xs text-muted-foreground mt-1">{row.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <ProfileBookingRequestDialog
              ownerUserId={profile.id}
              businessProfileSlug={profile.slug}
              profileName={profile.name}
              timezone={bookingConfig.timezone || "America/Chicago"}
              pricingRows={
                Array.isArray(bookingConfig.pricingRows)
                  ? bookingConfig.pricingRows.map((row) => ({
                      id: row.id,
                      name: row.name,
                      priceLabel: row.priceLabel,
                      description: row.description || undefined,
                    }))
                  : []
              }
              paidBookings={bookingConfig.paidBookings === true}
              bookingPriceUsd={Number(bookingConfig.bookingPriceUsd || 0)}
              bookingCategory={profile.services?.[0] || "general"}
              bookingStateCode={profile.stateCode || ""}
              hasViewerSession={isAuthenticated || Boolean(user?.id)}
              viewerCanManage={isOwner}
              signInHref={
                directoryDiscoverable
                  ? appendDiscoveryAttributionHandoff(
                      `/pre-scout-setup?mode=create&next=${encodeURIComponent(
                        `/business/${profile.slug}?book=1`
                      )}`
                    )
                  : `/pre-scout-setup?mode=create&next=${encodeURIComponent(
                      `/business/${profile.slug}?book=1`
                    )}`
              }
              platformBaseHref=""
              onAccountCreate={
                directoryDiscoverable ? () => trackDirectoryCta("account_create") : undefined
              }
              onBookingRequest={
                directoryDiscoverable ? () => trackDirectoryCta("booking_request") : undefined
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Primary CTA: Contact via TradeScout */}
      {!isOwner && visibleSections.contactCard && !hasCustomCta && (
        <Card className="border-2" style={themeStyle}>
          <CardContent className="pt-6">
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold mb-2">Start with {profile.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{locationLabel || localArea}</p>
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" data-testid="bp-contact-cta" onClick={handleDirectConnect}>
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Direct Connect
                </Button>

                {/* Directory-only: verified users can call after Decision Card confirmation */}
                {profileSource === "directory" && directoryBusinessId ? (
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={!user || !viewerVerified || callBusy}
                    onClick={() => {
                      if (!user) {
                        toast({
                          title: "Sign in required",
                          description: "Please sign in to initiate contact.",
                          variant: "destructive",
                        });
                        setLocation(`/login?next=${encodeURIComponent(window.location.pathname)}`);
                        return;
                      }
                      if (!viewerVerified) {
                        toast({
                          title: "Verification required",
                          description: "Verify your address before initiating contact.",
                          variant: "destructive",
                        });
                        setLocation("/account?tab=verification");
                        return;
                      }
                      setShowCallDecisionCard(true);
                    }}
                    title={
                      user && viewerVerified
                        ? "Confirm your reason for calling and unlock the number"
                        : "Verify your address to call. Browsing is still open."
                    }
                  >
                    <Shield className="h-5 w-5 mr-2" />
                    Call (verified)
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showCallDecisionCard && profileSource === "directory" && directoryBusinessId && !isOwner && (
        <div className="mt-4">
          <DecisionCard
            action="call_business"
            context={{
              targetName: profile.name,
              targetRole: "",
              communitySignal: "",
            }}
            scoutAction="COMPLY"
            riskFraming={[]}
            guidance=""
            explanation=""
            onAskScout={() => {
              const params = new URLSearchParams({
                intent: "hire",
                source: "business_profile_call",
                businessId: directoryBusinessId,
                businessSlug: profile.slug,
              });
              setLocation(`/scout?${params.toString()}`);
            }}
            onCancel={() => setShowCallDecisionCard(false)}
            onProceed={async () => {
              try {
                setCallBusy(true);
                const decisionScope = `directory_business:${directoryBusinessId}`;
                const decisionRes = await fetch("/api/decision-cards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    intent: "hire",
                    decisionScope,
                    title: `Call ${profile.name}`,
                    description: `Call ${profile.name} about a service job.`,
                  }),
                });

                if (!decisionRes.ok) {
                  const err = await decisionRes.json().catch(() => ({}));
                  throw new Error(
                    err?.message || `Failed to create decision card (${decisionRes.status})`
                  );
                }
                const decisionJson: any = await decisionRes.json().catch(() => ({}));
                const decisionCardId = String(decisionJson?.id || "");
                if (!decisionCardId) throw new Error("Decision card creation failed");

                const revealRes = await fetch("/api/business-contact/reveal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    businessId: directoryBusinessId,
                    contactType: "call",
                    intent: "hire",
                    decisionScope,
                    authorityGate: "decision_card",
                    sourceDecisionCardId: decisionCardId,
                  }),
                });
                if (!revealRes.ok) {
                  const err = await revealRes.json().catch(() => ({}));
                  throw new Error(err?.message || `Failed to reveal phone (${revealRes.status})`);
                }
                const revealJson: any = await revealRes.json().catch(() => ({}));
                const tel = typeof revealJson?.tel === "string" ? revealJson.tel : "";
                const phone = typeof revealJson?.phone === "string" ? revealJson.phone : "";
                if (!tel) throw new Error("No callable phone returned");

                toast({
                  title: "Phone unlocked",
                  description: phone || "Ready to call",
                });
                window.location.href = tel;
                setShowCallDecisionCard(false);
              } catch (e: any) {
                toast({
                  title: "Call unavailable",
                  description: e?.message || "Failed to start call",
                  variant: "destructive",
                });
              } finally {
                setCallBusy(false);
              }
            }}
          />
        </div>
      )}

      <Dialog open={suggestOpen} onOpenChange={(o) => (!suggestBusy ? setSuggestOpen(o) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>
              Seeded listings are unclaimed. Use this to suggest an edit or request removal. This
              creates an admin queue item.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <div className="text-xs text-white/70 mb-1">Type</div>
              <Select value={suggestKind} onValueChange={(v) => setSuggestKind(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Suggest an edit</SelectItem>
                  <SelectItem value="removal">Request removal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-white/70 mb-1">Message</div>
              <Textarea
                value={suggestMessage}
                onChange={(e) => setSuggestMessage(e.target.value)}
                placeholder="What’s incorrect? Include the corrected name/category/service area, or explain why removal is needed."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestOpen(false)} disabled={suggestBusy}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!directoryBusinessId) return;
                setSuggestBusy(true);
                try {
                  await apiRequest(
                    "POST",
                    `/api/businesses/${encodeURIComponent(directoryBusinessId)}/suggest-edit`,
                    {
                      kind: suggestKind,
                      message: suggestMessage,
                    }
                  );
                  toast({ title: "Submitted", description: "Thanks — we queued this for review." });
                  setSuggestMessage("");
                  setSuggestKind("edit");
                  setSuggestOpen(false);
                } catch (err: any) {
                  toast({
                    title: "Failed",
                    description: formatUserFacingErrorMessage(err, "Could not submit suggestion."),
                    variant: "destructive",
                  });
                } finally {
                  setSuggestBusy(false);
                }
              }}
              disabled={suggestBusy || !directoryBusinessId}
            >
              {suggestBusy ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer: Explore more in county */}
      {profile.countyName && profile.stateCode && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <a
            href={`/county/${profile.stateCode.toLowerCase()}/${publicCountySlug}`}
            className="text-primary hover:underline"
          >
            Explore more businesses near{" "}
            {stripCountySuffix(profile.countyName) || profile.countyName}
          </a>
        </div>
      )}
      <TradeScoutProfileHandoff profileSlug={profile.slug} profileName={profile.name} />
    </div>
  );
}
