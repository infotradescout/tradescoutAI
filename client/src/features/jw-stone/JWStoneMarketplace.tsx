import { useLayoutEffect, useMemo, useState } from "react";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PublicProfileAccountDialog } from "@/components/profile/PublicProfileAccountDialog";
import type { ProfileAccountMode } from "@/components/profile/profileAccountClient";
import { useAuth } from "@/hooks/useAuth";
import { trackDiscoveryLandingOnce } from "@/lib/discoveryLanding";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { JW_STONE_CATALOG, getCatalogItemById, getNamedCatalogItemByShareSlug } from "./catalog";
import { ColorPaletteRail, MoodPaletteRail, type ColorSwatchSelection } from "./ColorPaletteRail";
import { FirstCutSection } from "./FirstCutSection";
import { JwStoneCompanySection } from "./JwStoneCompanySection";
import { JwStoneRequestBand } from "./JwStoneRequestBand";
import { JwStoneStorySection } from "./JwStoneStorySection";
import { MarketplaceIntroduction } from "./MarketplaceIntroduction";
import { MarketplaceFooter } from "./MarketplaceFooter";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { MaterialCategoryRail } from "./MaterialCategoryRail";
import { isJwStoneMarketplaceDomainSurface, marketplaceBasePath } from "./marketplaceRoutes";
import { StoneCollection } from "./StoneCollection";
import { StoneDetailDialog } from "./StoneDetailDialog";
import { WishlistPanel } from "./WishlistPanel";
import type { JwStoneCatalogItem } from "./types";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import { useMarketplaceUrlState } from "./useMarketplaceUrlState";

const JW_STONE_DESCRIPTION =
  "Browse JW Stone's stone collection, open full photo galleries, save selections, and ask about a material when you are ready.";
const JW_STONE_SOCIAL_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

function marketplaceCanonicalUrl(): string {
  if (typeof window !== "undefined" && isJwStoneMarketplaceDomainSurface()) {
    return `${window.location.origin}/`;
  }
  return "https://www.thetradescout.com/jw-stone";
}

function readProfileAccountRequest(): { open: boolean; mode: ProfileAccountMode } {
  if (typeof window === "undefined") return { open: false, mode: "create" };
  try {
    const params = new URL(window.location.href).searchParams;
    return {
      open: params.get("profileAccount") === "1",
      mode: params.get("profileAccountMode") === "signin" ? "signin" : "create",
    };
  } catch {
    return { open: false, mode: "create" };
  }
}

function clearProfileAccountRequest(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("profileAccount");
    url.searchParams.delete("profileAccountMode");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // The dialog can still close if history replacement is unavailable.
  }
}

export default function JWStoneMarketplace() {
  const { user, isAuthenticated } = useAuth();
  const hasViewerAccount =
    isAuthenticated || Boolean((user as { id?: unknown } | null)?.id);
  const { state, commit } = useMarketplaceUrlState();
  const wishlist = useJwStoneWishlist();
  const [accountRequest] = useState(readProfileAccountRequest);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(accountRequest.open);
  const [accountMode, setAccountMode] = useState<ProfileAccountMode>(accountRequest.mode);
  /** Ephemeral / First Cut / anonymous detail stones not resolvable from catalog by id alone. */
  const [detailOverride, setDetailOverride] = useState<JwStoneCatalogItem | null>(null);
  const [requestContext, setRequestContext] = useState<readonly JwStoneCatalogItem[] | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("jw-marketplace-scroll");
    body.classList.add("jw-marketplace-scroll");
    if (body.style.overflow === "hidden") body.style.overflow = "";
  }, []);

  useLayoutEffect(() => {
    const landingSearch = window.location.search;
    const canonicalRoute = isJwStoneMarketplaceDomainSurface()
      ? window.location.pathname || "/"
      : window.location.pathname.startsWith(marketplaceBasePath())
        ? window.location.pathname
        : marketplaceBasePath() || "/jw-stone";
    void trackDiscoveryLandingOnce({ canonicalRoute, search: landingSearch });
  }, []);

  const activeStone =
    (state.stone ? getNamedCatalogItemByShareSlug(state.stone) : null) || detailOverride;

  const requestTargets = useMemo<readonly DirectConnectMaterialTarget[]>(
    () =>
      (requestContext || []).flatMap((stone) =>
        stone.wishlistEligible && !stone.anonymous && stone.displayName
          ? [{ itemId: stone.id, itemName: stone.displayName }]
          : []
      ),
    [requestContext]
  );

  const closeStone = () => {
    setDetailOverride(null);
    if (state.stone) commit({ ...state, stone: null }, { replace: true });
  };

  const openStone = (stone: JwStoneCatalogItem) => {
    if (stone.anonymous || !stone.shareSlug) {
      setDetailOverride(getCatalogItemById(stone.id) || stone);
      if (state.stone) commit({ ...state, stone: null }, { replace: true });
      return;
    }
    setDetailOverride(null);
    commit({ ...state, stone: stone.shareSlug });
  };

  const openSavedStone = (stone: JwStoneCatalogItem) => {
    setWishlistOpen(false);
    setDetailOverride(null);
    commit({ ...state, stone: stone.shareSlug });
  };

  const startRequest = (stones: readonly JwStoneCatalogItem[]) => {
    closeStone();
    setWishlistOpen(false);
    setRequestContext(stones);
  };

  const askAboutStone = (stone: JwStoneCatalogItem) => {
    startRequest(stone.wishlistEligible && !stone.anonymous ? [stone] : []);
  };

  const openAccount = () => {
    setAccountMode("create");
    setAccountOpen(true);
  };

  const changeAccountOpen = (open: boolean) => {
    setAccountOpen(open);
    if (!open) clearProfileAccountRequest();
  };

  const selectPalette = (next: ColorSwatchSelection) => {
    commit({
      ...state,
      aesthetic: next.aesthetic,
      color: next.color,
      material: null,
      stone: null,
    });
    if (!next.aesthetic && !next.color) return;
    const resultsTestId = next.aesthetic ? "jw-mood-results" : "jw-palette-results";
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-testid="${resultsTestId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const selectMaterial = (material: string | null) => {
    commit({
      ...state,
      material,
      aesthetic: material ? null : state.aesthetic,
      color: material ? null : state.color,
      stone: null,
    });
    if (!material) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-testid="jw-material-section-${material}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const enterFullInventory = () => {
    if (!state.aesthetic && !state.color && !state.material && !state.origin) return;
    commit(
      {
        ...state,
        aesthetic: null,
        color: null,
        material: null,
        origin: null,
        stone: null,
      },
      { replace: true }
    );
  };

  const canonicalUrl = marketplaceCanonicalUrl();
  const collectionData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "JW Stone | Stone Discovery",
    description: JW_STONE_DESCRIPTION,
    url: canonicalUrl,
    image: JW_STONE_SOCIAL_IMAGE_URL,
    mainEntity: {
      "@type": "LocalBusiness",
      name: JW_STONE_PUBLIC_IDENTITY.brandName,
      description: JW_STONE_PUBLIC_IDENTITY.about,
      foundingDate: JW_STONE_PUBLIC_IDENTITY.foundingDate,
      url: canonicalUrl,
      hasMap: JW_STONE_PUBLIC_IDENTITY.address.mapUrl,
      address: {
        "@type": "PostalAddress",
        streetAddress: JW_STONE_PUBLIC_IDENTITY.address.streetAddress,
        addressLocality: JW_STONE_PUBLIC_IDENTITY.address.addressLocality,
        addressRegion: JW_STONE_PUBLIC_IDENTITY.address.addressRegion,
        postalCode: JW_STONE_PUBLIC_IDENTITY.address.postalCode,
        addressCountry: JW_STONE_PUBLIC_IDENTITY.address.addressCountry,
      },
      sameAs: JW_STONE_PUBLIC_IDENTITY.socials.map((social) => social.href),
    },
  };

  return (
    <div
      className={`min-h-screen max-w-full overflow-x-clip pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(6.25rem+env(safe-area-inset-bottom))] ${jw.page}`}
      style={JW_STONE_BRAND_STYLE}
      data-jw-brand="true"
      data-jw-marketplace-base={marketplaceBasePath() || "/"}
    >
      <SEOHelmet
        title="JW Stone | Stone Discovery"
        socialTitle="JW Stone | Stone Discovery"
        description={JW_STONE_DESCRIPTION}
        canonical={canonicalUrl}
        ogType="website"
        ogImage={JW_STONE_SOCIAL_IMAGE_URL}
        structuredData={collectionData}
      />
      <MarketplaceHeader
        wishlistCount={wishlist.count}
        hasAccount={hasViewerAccount}
        onOpenWishlist={() => setWishlistOpen(true)}
        onOpenAccount={openAccount}
        onStartRequest={() => startRequest([])}
      />
      <p className="sr-only" aria-live="polite">
        {wishlist.count} {wishlist.count === 1 ? "stone" : "stones"} saved
      </p>

      <MarketplaceIntroduction />
      <FirstCutSection onOpen={openStone} />
      <StoneCollection
        state={state}
        isSaved={wishlist.isSaved}
        onUpdateFilters={(filters) => commit({ ...state, ...filters, stone: null })}
        onEnterFullInventory={enterFullInventory}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        onAsk={askAboutStone}
        onSourceRequest={() => startRequest([])}
        catalog={JW_STONE_CATALOG}
      />
      <ColorPaletteRail
        aesthetic={state.aesthetic}
        color={state.color}
        material={null}
        origin={state.origin}
        onSelect={selectPalette}
        isSaved={wishlist.isSaved}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        onAsk={askAboutStone}
      />
      <MoodPaletteRail
        aesthetic={state.aesthetic}
        material={null}
        origin={state.origin}
        onSelect={selectPalette}
        isSaved={wishlist.isSaved}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        onAsk={askAboutStone}
      />
      <MaterialCategoryRail
        active={state.material}
        aesthetic={state.aesthetic}
        color={state.color}
        onSelect={selectMaterial}
        isSaved={wishlist.isSaved}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        onAsk={askAboutStone}
        catalog={JW_STONE_CATALOG}
      />

      <JwStoneStorySection />
      <JwStoneCompanySection />
      <MarketplaceFooter />
      <JwStoneRequestBand onStartRequest={() => startRequest([])} />

      <PublicProfileAccountDialog
        open={accountOpen}
        onOpenChange={changeAccountOpen}
        profileSlug="jw-stone"
        profileName="JW Stone"
        tone="light"
        initialMode={accountMode}
      />

      <StoneDetailDialog
        stone={activeStone}
        saved={activeStone ? wishlist.isSaved(activeStone.id) : false}
        onOpenChange={(open) => {
          if (!open) closeStone();
        }}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onAsk={askAboutStone}
      />

      <WishlistPanel
        open={wishlistOpen}
        items={wishlist.items}
        restored={wishlist.restored}
        persisted={wishlist.persisted}
        knownEmail={typeof user?.email === "string" ? user.email : null}
        onOpenChange={setWishlistOpen}
        onRemove={wishlist.remove}
        onClear={wishlist.clear}
        onOpenStone={openSavedStone}
        onAsk={startRequest}
      />

      <ExpressDirectConnectPanel
        open={requestContext !== null}
        onClose={() => setRequestContext(null)}
        profileSlug="jw-stone"
        businessName={JW_STONE_PUBLIC_IDENTITY.brandName}
        businessAddress={JW_STONE_PUBLIC_IDENTITY.address.formatted}
        hasViewerSession={hasViewerAccount}
        allowCall
        stayInProfile
        requestMode="materials"
        initialStoneSelections={requestTargets}
        initialView="choice"
        initialRequestType="request_material"
      />
    </div>
  );
}
