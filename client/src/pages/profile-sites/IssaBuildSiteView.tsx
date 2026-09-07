import { lazy, Suspense, useEffect, useState, type ComponentProps, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import ProfileSiteManageChrome from "@/components/profile/ProfileSiteManageChrome";
import { PublicProfileTrustActions } from "@/components/profile/PublicProfileTrustActions";
import { PublicProfileItems, hasVisiblePublicProfileItems, type CanonicalProfileItems } from "@/components/profile/PublicProfileItems";
import { ProfileBookingRequestDialog } from "@/components/profile/ProfileBookingRequestDialog";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { trackDiscoveryLandingOnce } from "@/lib/discoveryLanding";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { createProfileInventoryItemShareMetadata } from "@shared/profileItemShare";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";
import { withTradeScoutPublishingProvenance } from "@shared/profilePublishingProvenance";
import {
  ISSA_BUILD_BUSINESS_NAME, ISSA_BUILD_LOCAL_DISCOVERY, ISSA_BUILD_LOGO,
  ISSA_BUILD_PROFILE_IMAGES, ISSA_BUILD_PROFILE_SLUG, ISSA_BUILD_HERO_POSTER,
} from "@shared/issaBuildProfile";
import {
  buildIssaBuildBusinessContentBlocks, buildIssaBuildOnyxContentBlocks,
  issaBuildBusinessText, ISSA_BUILD_ONYX_PAGE_DESCRIPTION, ISSA_BUILD_ONYX_PAGE_TITLE,
} from "@shared/issaBuildPageContent";
import {
  ISSA_BUILD_PUBLIC_PATH, ISSA_BUILD_ONYX_PATH, resolveIssaBuildOnyxItem,
  resolveIssaBuildPublicPage, resolveIssaBuildCanonicalRedirect,
} from "@shared/issaBuildRoutes";
import DefaultProfileTheme from "./DefaultProfileTheme";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

const OnyxPresentation = lazy(() => import("./WholesalerProfileThemeLegacy"));
type DefaultThemeProps = ComponentProps<typeof DefaultProfileTheme>;
type ManageProps = ComponentProps<typeof ProfileSiteManageChrome>;
type BookingProps = ComponentProps<typeof ProfileBookingRequestDialog>;
// The business profile consumes more visibility controls than its item list.
// Keep those existing optional controls without changing rendering defaults.
type ProfileSections = NonNullable<ComponentProps<typeof PublicProfileItems>["profileSections"]> & {
  about?: boolean;
  rolesAndBadges?: boolean;
  stats?: boolean;
  reviews?: boolean;
  contactCard?: boolean;
};
type Recommendation = NonNullable<DefaultThemeProps["recommendations"]>[number] & {
  contractor?: { companyName?: string; slug?: string; canonicalBusinessProfileUrl?: string | null };
};
type BookingData = {
  enabled?: boolean; paidBookings?: boolean; bookingPriceUsd?: number;
  calendarVisibility?: "public" | "private"; timezone?: string;
  pricingTableEnabled?: boolean; pricingRows?: BookingProps["pricingRows"];
  slots?: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; active?: boolean }>;
};
type ProfileResponse = {
  profile: {
    id: string; slug: string; displayName: string; headline?: string | null;
    roleContext?: string; contentBlocks?: unknown; profileSections?: ProfileSections;
    profileBooking?: BookingData;
    seoMeta?: { title?: string; description?: string; imageUrl?: string; faviconUrl?: string; customDomain?: string };
    contactPolicy?: { reason?: string };
  };
  business?: {
    name?: string; address?: string; city?: string; stateCode?: string; zipCode?: string;
    categories?: string[]; serviceAreas?: string[]; services?: string[];
    brandColors?: DefaultThemeProps["brandColors"];
    directConnectOwnerUserId?: string;
    expressContactCapabilities?: { call?: boolean; deliveryCustody?: "business" | "tradescout_pending_owner" };
  } | null;
  viewerCanManage?: boolean;
  profileItems?: CanonicalProfileItems;
  recommendationsDirectory?: Recommendation[];
  recommendationDirectoryMode?: "received" | "authored";
  recommendationDirectorySummary?: { positive: number; negative: number; total: number };
};
const clean = (value: unknown, max = 500) => sanitizePublicProfileText(value, max);

/** Two public destinations, one existing business record and the same contact authority. */
export default function IssaBuildSiteView() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const pathname = String(location || window.location.pathname).split(/[?#]/, 1)[0];
  const redirect = resolveIssaBuildCanonicalRedirect(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  const page = resolveIssaBuildPublicPage(pathname);
  const isOnyx = page === "onyx";
  const [requestOpen, setRequestOpen] = useState(false);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(() => new URLSearchParams(window.location.search).get("edit") === "1");
  const { data, isLoading, error, refetch } = useQuery<ProfileResponse | null>({
    queryKey: ["issa-build-public-profile", user?.id || "public"],
    enabled: !redirect && page !== null,
    queryFn: async () => {
      const response = await fetch(`/api/u/${ISSA_BUILD_PROFILE_SLUG}`, { cache: "no-cache", credentials: "same-origin" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Profile request failed");
      const result = await response.json() as ProfileResponse;
      if (result.profile?.slug !== ISSA_BUILD_PROFILE_SLUG) throw new Error("Unexpected profile identity");
      return result;
    },
    staleTime: 0,
    retry: 1,
  });
  useEffect(() => { if (redirect) window.location.replace(redirect); }, [redirect]);
  useEffect(() => { setRequestOpen(false); setServiceName(null); }, [pathname]);
  useEffect(() => {
    if (!data?.profile) return;
    void trackDiscoveryLandingOnce({ canonicalRoute: pathname, search: window.location.search });
  }, [data?.profile, pathname]);

  if (redirect || isLoading) return <div className="grid min-h-[60vh] place-items-center" role="status">Loading…</div>;
  if (error || !data || !page) return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{error ? "This profile could not load." : "This profile is not available."}</h1>
      {error ? <button className="mt-6 underline" onClick={() => void refetch()}>Try again</button> : null}
      <a className="ml-6 underline" href="/">TradeScout</a>
    </main>
  );
  const { profile, business } = data;
  const blocks = buildIssaBuildBusinessContentBlocks(profile.contentBlocks);
  const onyxBlocks = buildIssaBuildOnyxContentBlocks();
  const blockData = (type: string) => blocks.find((block) => block.type === type)?.data || {};
  const hero = blockData("hero");
  const sections = profile.profileSections || {};
  const name = clean(business?.name || profile.displayName || ISSA_BUILD_BUSINESS_NAME, 200);
  const headline = clean(issaBuildBusinessText(profile.headline, ISSA_BUILD_LOCAL_DISCOVERY.headline));
  const origin = getCanonicalAppOrigin();
  const profileUrl = `${origin}${ISSA_BUILD_PUBLIC_PATH}`;
  const query = new URLSearchParams(window.location.search);
  const selectedStoneSlug = isOnyx ? resolveIssaBuildOnyxItem(pathname) || query.get("stone") : null;
  const stoneShare = isOnyx ? createProfileInventoryItemShareMetadata({
    profileName: name,
    profileUrl: `${origin}${ISSA_BUILD_ONYX_PATH}`,
    assetOrigin: origin,
    categories: onyxBlocks.find((block) => block.type === "inventoryCatalog")?.data?.categories,
    itemSlug: selectedStoneSlug,
    photo: query.get("photo"),
    publicRouteContentBlocks: onyxBlocks,
  }) : null;
  if (selectedStoneSlug && !stoneShare) return <main className="mx-auto max-w-xl px-6 py-16">
    <SEOHelmet title="Stone not found" description="Stone not found" noIndex />
    <h1 className="text-2xl font-semibold">Stone not found</h1>
    <a className="mt-6 inline-block underline" href={ISSA_BUILD_ONYX_PATH}>Onyx</a>
  </main>;
  const title = stoneShare?.title || (isOnyx ? ISSA_BUILD_ONYX_PAGE_TITLE : clean(issaBuildBusinessText(profile.seoMeta?.title, ISSA_BUILD_LOCAL_DISCOVERY.title), 240));
  const description = stoneShare?.description || (isOnyx ? ISSA_BUILD_ONYX_PAGE_DESCRIPTION : clean(issaBuildBusinessText(profile.seoMeta?.description, ISSA_BUILD_LOCAL_DISCOVERY.description), 1000));
  const canonical = stoneShare?.canonical || `${origin}${isOnyx ? ISSA_BUILD_ONYX_PATH : ISSA_BUILD_PUBLIC_PATH}`;
  const destination = stoneShare ? `${new URL(stoneShare.canonical).pathname}${new URL(stoneShare.canonical).search}` : isOnyx ? ISSA_BUILD_ONYX_PATH : ISSA_BUILD_PUBLIC_PATH;
  const hasSession = isAuthenticated || Boolean(user?.id);
  const signInHref = `/pre-scout-setup?mode=signin&next=${encodeURIComponent(destination)}`;
  const viewerCanManage = data.viewerCanManage === true;
  const booking = profile.profileBooking || {};
  const serviceItems = Array.isArray(blockData("services").items) ? blockData("services").items : [];
  const services: string[] = serviceItems.map((item: unknown) => {
    if (typeof item === "string") return clean(item, 180);
    if (!item || typeof item !== "object") return "";
    const value = item as Record<string, unknown>;
    return clean(value.title || value.name || value.label, 180);
  }).filter(Boolean);
  const storedAreas = blockData("serviceAreas").areas;
  const serviceAreas: string[] = (business?.serviceAreas?.length ? business.serviceAreas : Array.isArray(storedAreas) ? storedAreas : []).map((value: unknown) => clean(value, 160)).filter(Boolean);
  const storedGallery = listProfileGalleryItems(blocks);
  const gallery = storedGallery.length ? storedGallery : ISSA_BUILD_PROFILE_IMAGES.map((imageUrl, index) => ({
    slug: `project-${index + 1}`, title: name, imageUrl, imageAlt: `${name} project`,
  }));
  const profileItems = data.profileItems || {};
  const about = blockData("about");
  const allowCall = business?.expressContactCapabilities?.call === true;
  const publicAddress = [business?.address, business?.city, business?.stateCode, business?.zipCode].filter(Boolean).join(", ") || null;
  const directPath = business?.directConnectOwnerUserId
    ? `/direct-connect?target=${encodeURIComponent(business.directConnectOwnerUserId)}&targetName=${encodeURIComponent(name)}&source=profile_site`
    : `/direct-connect?profile=${ISSA_BUILD_PROFILE_SLUG}`;
  const openRequest = (service?: string) => { setServiceName(clean(service, 180) || null); setRequestOpen(true); };
  const trust = (tone: "light" | "dark") => <>
    <p className="mb-3 text-sm font-semibold">100% Verified by TradeScout</p>
    <PublicProfileTrustActions profileSlug={ISSA_BUILD_PROFILE_SLUG} profileName={name}
      profileShareDestination={ISSA_BUILD_PUBLIC_PATH} signInHref={signInHref}
      hasViewerSession={hasSession} platformBaseHref="" subjectKind="business" tone={tone}
      initialRecommendationCount={data.recommendationDirectorySummary?.positive || 0} />
  </>;
  const identity = { "@type": "LocalBusiness", "@id": `${profileUrl}#identity`, name, url: profileUrl,
    description: clean(issaBuildBusinessText(profile.seoMeta?.description, ISSA_BUILD_LOCAL_DISCOVERY.description)),
    ...(serviceAreas.length ? { areaServed: serviceAreas } : {}),
  };
  const mainEntityId = stoneShare ? `${canonical}#product` : isOnyx ? `${canonical}#collection` : `${profileUrl}#identity`;
  const productEntity = stoneShare ? {
    "@type": "Product", "@id": mainEntityId, name: stoneShare.itemName,
    url: canonical, description: stoneShare.description, image: [stoneShare.imageUrl],
    category: stoneShare.category,
    brand: { "@id": `${profileUrl}#identity` },
    ...(stoneShare.countryOfOrigin ? { countryOfOrigin: { "@type": "Country", name: stoneShare.countryOfOrigin } } : {}),
    ...(stoneShare.thicknessCm ? { additionalProperty: [{ "@type": "PropertyValue", name: "Thickness", value: stoneShare.thicknessCm, unitText: "cm" }] } : {}),
  } : null;
  const structuredData = withTradeScoutPublishingProvenance({
    structuredData: { "@context": "https://schema.org", "@graph": [identity, ...(productEntity ? [productEntity] : isOnyx ? [{
      "@type": "CollectionPage", "@id": mainEntityId, name: "Onyx", url: canonical,
      description: ISSA_BUILD_ONYX_PAGE_DESCRIPTION, about: { "@id": `${profileUrl}#identity` },
    }] : [])] },
    pageUrl: canonical, mainEntityId, ownerIdentityId: `${profileUrl}#identity`,
    pageType: isOnyx ? "WebPage" : "ProfilePage",
  });
  const gallerySlug = query.get("gallery");
  const shareImage = stoneShare?.imageUrl || (isOnyx ? ISSA_BUILD_HERO_POSTER : profile.seoMeta?.imageUrl || ISSA_BUILD_LOGO);
  const socials: NonNullable<DefaultThemeProps["socials"]> = [];
  for (const kind of ["instagram", "tiktok"] as const) {
    const href = hero[`${kind}Url`];
    if (typeof href === "string" && href.trim()) socials.push({
      label: kind === "instagram" ? "Instagram" : "TikTok", href,
      handle: clean(hero[`${kind}Handle`], 120), kind,
    });
  }
  const customBlocks = blocks.filter((block) => !["hero", "about", "services", "serviceAreas", "cta", "gallery", "siteTemplate", "inventoryCatalog", "publicDiscovery", "trust"].includes(block.type))
    .map((block) => ({ title: clean(block.data?.title || block.title, 200), body: clean(block.data?.text || block.data?.body || block.body, 2000) }))
    .filter((block) => block.title && block.body);
  const recommendations = (data.recommendationsDirectory || []).map((entry) => ({
    ...entry,
    subjectName: entry.contractor?.companyName || entry.subjectName,
    subjectHref: entry.contractor?.canonicalBusinessProfileUrl || (entry.contractor?.slug ? `/contractors/${encodeURIComponent(entry.contractor.slug)}` : entry.subjectHref),
  }));
  const quickFacts = [
    ...(services.length ? [{ label: "Services", value: String(services.length) }] : []),
    ...(serviceAreas.length ? [{ label: "Serves", value: `${serviceAreas.length} area${serviceAreas.length === 1 ? "" : "s"}` }] : []),
    ...(booking.enabled === true ? [{ label: "Appointments", value: "Available" }] : []),
  ];

  return <>
    <SEOHelmet title={title} socialTitle={title} description={description} canonical={canonical}
      ogType={stoneShare ? "product" : isOnyx ? "website" : "profile"} ogImage={shareImage}
      preserveCanonicalQuery={Boolean(stoneShare)} structuredData={structuredData} />
    {!isOnyx && viewerCanManage ? <ProfileSiteManageChrome
      profileId={profile.id} profileSlug={ISSA_BUILD_PROFILE_SLUG} displayName={name} headline={headline}
      contentBlocks={blocks as ManageProps["contentBlocks"]} siteTemplate="default" editMode={editMode}
      platformBaseHref="" customDomain={profile.seoMeta?.customDomain || null} isOnCustomDomain={false}
      onSaved={() => void refetch()}
      onToggleEdit={(next) => {
        setEditMode(next);
        const url = new URL(window.location.href);
        if (next) url.searchParams.set("edit", "1"); else url.searchParams.delete("edit");
        window.history.replaceState(window.history.state, "", url.toString());
      }} /> : null}
    {isOnyx ? <div data-testid="issa-build-onyx-page">
      <Suspense fallback={<div className="grid min-h-[60vh] place-items-center" role="status">Loading…</div>}>
        <OnyxPresentation profileSlug={ISSA_BUILD_PROFILE_SLUG} displayName={name}
          headline={null} contentBlocks={onyxBlocks} categories={[]} serviceAreas={[]}
          businessAddress={publicAddress} brandColors={business?.brandColors}
          contactReason={profile.contactPolicy?.reason} hasViewerSession={hasSession}
          isSuperAdminViewer={Boolean((user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin || user?.role === "super_admin")}
          useExpressDirectConnect allowExpressCall={allowCall}
          profileShareDestination={ISSA_BUILD_ONYX_PATH} currentPageShareDestination={destination}
          currentPageShareTitle={title} platformBaseHref=""
          tradeScoutReturnHref={ISSA_BUILD_PUBLIC_PATH} directConnectHref={directPath}
          preScoutCreateHref={`/pre-scout-setup?mode=create&next=${encodeURIComponent(directPath)}`}
          preScoutSignInHref={signInHref} trustActions={trust("light")}
          onProjectRequest={() => openRequest("Onyx")} />
      </Suspense>
    </div> : <div data-testid="issa-build-business-profile" style={{ "--ts-profile-top-offset": viewerCanManage ? "3.5rem" : "0px" } as CSSProperties}>
      <DefaultProfileTheme businessName={name} operatorName={clean(hero.operatorName, 160) || undefined}
        presentationVariant={hero.presentationVariant === "first-deliverable" ? "first-deliverable" : "classic"}
        profileKind="business" categoryLabel={business?.categories?.[0] || ISSA_BUILD_LOCAL_DISCOVERY.primaryCategory}
        locationLabel={clean(hero.locationLabel || [business?.city, business?.stateCode].filter(Boolean).join(", ") || serviceAreas[0], 200)}
        headline={headline} heroTitle={clean(hero.title, 200) || undefined} heroText={clean(hero.text, 800) || undefined}
        logoUrl={hero.logoUrl || profile.seoMeta?.faviconUrl || ISSA_BUILD_LOGO}
        heroImageUrl={hero.imageUrl || hero.heroImageUrl || gallery[0]?.imageUrl}
        heroImageAlt={clean(hero.imageAlt, 400) || gallery[0]?.imageAlt || name}
        featuredWorkUrl={hero.featuredWorkUrl} brandColors={business?.brandColors}
        services={services.length ? services : business?.services || []} serviceAreas={serviceAreas}
        aboutText={clean(about.text || about.body || about.description, 4000) || undefined}
        galleryItems={gallery} sharedGallerySlug={gallerySlug} socials={socials} customBlocks={customBlocks}
        badges={business?.categories || []} recommendations={recommendations} stats={quickFacts}
        recommendationMode={data.recommendationDirectoryMode || "authored"}
        showAbout={sections.about !== false} showBadges={sections.rolesAndBadges !== false}
        showStats={sections.stats !== false} showServices={sections.services !== false}
        showServiceAreas={sections.services !== false} showRecommendations={sections.reviews !== false}
        showContact={sections.contactCard !== false} deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}
        onDirectConnect={openRequest}
        shareAction={<ShareButton destination={ISSA_BUILD_PUBLIC_PATH} title={name} imageUrl={shareImage} />}
        renderGalleryShare={(item) => <ShareButton destination={`${ISSA_BUILD_PUBLIC_PATH}?gallery=${encodeURIComponent(item.slug)}`}
          title={item.title} imageUrl={item.imageUrl} />}
        bookingSection={booking.enabled === true ? <section className="rounded-3xl border border-[var(--profile-line)] p-6">
          <h2 className="mb-4 text-2xl font-semibold">Bookings</h2>
          <ProfileBookingRequestDialog profileId={profile.id} profileName={name}
            timezone={booking.timezone || "America/Chicago"} pricingRows={booking.pricingRows || []}
            paidBookings={booking.paidBookings === true} bookingPriceUsd={Number(booking.bookingPriceUsd || 0)}
            bookingCategory={business?.categories?.[0] || profile.roleContext || "business_owner"}
            bookingStateCode={business?.stateCode || ""} hasViewerSession={hasSession} viewerCanManage={viewerCanManage}
            signInHref={`/pre-scout-setup?mode=create&next=${encodeURIComponent(`${ISSA_BUILD_PUBLIC_PATH}?book=1`)}`} platformBaseHref="" />
          {booking.calendarVisibility === "public" ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(booking.slots || []).filter((slot) => slot.active !== false).map((slot) => <div key={slot.id} className="flex justify-between gap-4">
              <span>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][slot.dayOfWeek]}</span>
              <span>{slot.startTime}–{slot.endTime}</span>
            </div>)}
          </div> : null}
          {booking.pricingTableEnabled === true ? <div className="mt-4">
            {(booking.pricingRows || []).map((row) => <div key={row.id} className="flex justify-between gap-4"><span>{row.name}</span><span>{row.priceLabel}</span></div>)}
          </div> : null}
        </section> : null}
        profileItems={<>
          <section aria-label="Products" className="rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-surface)] p-6">
            <h2 className="mb-4 text-2xl font-semibold">Products</h2>
            <a href={ISSA_BUILD_ONYX_PATH} className="flex items-center gap-5 rounded-2xl border border-[var(--profile-line)] p-3">
              <img src={ISSA_BUILD_HERO_POSTER} alt="Onyx" className="h-24 w-32 rounded-xl object-cover" loading="lazy" />
              <span className="text-xl font-semibold">Onyx <span aria-hidden="true">→</span></span>
            </a>
          </section>
          {hasVisiblePublicProfileItems(profileItems, sections) ? <PublicProfileItems items={profileItems} profileSections={sections} platformBaseHref="" /> : null}
        </>}
        trustActions={trust("dark")} lightTrustActions={trust("light")}
        tradeScoutHandoff={<TradeScoutProfileHandoff profileSlug={ISSA_BUILD_PROFILE_SLUG} profileName={name} platformBaseHref="" />} />
    </div>}
    <ExpressDirectConnectPanel open={requestOpen} onClose={() => setRequestOpen(false)}
      profileSlug={ISSA_BUILD_PROFILE_SLUG} businessName={name} businessAddress={publicAddress}
      platformBaseHref="" hasViewerSession={hasSession} allowCall={allowCall} requestMode="service"
      initialServiceName={serviceName} initialRequestType={serviceName ? "request_service" : null}
      deliveryCustody={business?.expressContactCapabilities?.deliveryCustody} stayInProfile />
  </>;
}
