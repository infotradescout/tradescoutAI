import { useLayoutEffect, useMemo, useState } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useAuth } from "@/hooks/useAuth";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { JW_STONE_CATALOG, getCatalogItemById, getNamedCatalogItemByShareSlug } from "./catalog";
import { ColorPaletteRail, type ColorSwatchSelection } from "./ColorPaletteRail";
import { FirstCutSection } from "./FirstCutSection";
import { JwStoneRequestBand } from "./JwStoneRequestBand";
import { JwStoneStorySection } from "./JwStoneStorySection";
import { MarketplaceIntroduction } from "./MarketplaceIntroduction";
import { MarketplaceFooter } from "./MarketplaceFooter";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { MaterialCategoryRail } from "./MaterialCategoryRail";
import { StoneCollection } from "./StoneCollection";
import { StoneDetailDialog } from "./StoneDetailDialog";
import { WishlistPanel } from "./WishlistPanel";
import type { JwStoneCatalogItem } from "./types";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import { useMarketplaceUrlState } from "./useMarketplaceUrlState";

const JW_STONE_CANONICAL_URL = "https://www.thetradescout.com/jw-stone";
const JW_STONE_DESCRIPTION =
  "Browse JW Stone's stone collection, open full photo galleries, save selections, and ask about a material when you are ready.";
const JW_STONE_COLLECTION_DATA = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "JW Stone | Stone Discovery",
  description: JW_STONE_DESCRIPTION,
  url: JW_STONE_CANONICAL_URL,
  image: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
};

function scrollToInventory() {
  requestAnimationFrame(() => {
    document.getElementById("current-inventory")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

export default function JWStoneMarketplace() {
  const { user, isAuthenticated } = useAuth();
  const { state, commit } = useMarketplaceUrlState();
  const wishlist = useJwStoneWishlist();
  const [wishlistOpen, setWishlistOpen] = useState(false);
  /** Ephemeral / First Cut / anonymous detail stones not resolvable from catalog by id alone. */
  const [detailOverride, setDetailOverride] = useState<JwStoneCatalogItem | null>(null);
  const [requestContext, setRequestContext] = useState<readonly JwStoneCatalogItem[] | null>(null);

  // Ensure unlock while this page is mounted; AppLayout owns route-level cleanup
  // so Strict Mode remounts do not briefly strip the class mid-route.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("jw-marketplace-scroll");
    body.classList.add("jw-marketplace-scroll");
    if (body.style.overflow === "hidden") {
      body.style.overflow = "";
    }
  }, []);

  // Prefer URL-named stone, else explicit override (First Cut photo / anonymous catalog).
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
      // First Cut photo ids are not in JW_STONE_CATALOG — keep the full object.
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

  const selectPalette = (next: ColorSwatchSelection) => {
    commit({ ...state, aesthetic: next.aesthetic, color: next.color, stone: null });
    if (next.aesthetic || next.color) scrollToInventory();
  };

  const selectMaterial = (material: string | null) => {
    commit({ ...state, material, stone: null });
    if (!material) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-testid="jw-material-section-${material}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <div
      className={`min-h-screen overflow-x-visible pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(6.25rem+env(safe-area-inset-bottom))] ${jw.page}`}
      style={JW_STONE_BRAND_STYLE}
      data-jw-brand="true"
    >
      <SEOHelmet
        title="JW Stone | Stone Discovery"
        socialTitle="JW Stone | Stone Discovery"
        description={JW_STONE_DESCRIPTION}
        canonical={JW_STONE_CANONICAL_URL}
        ogType="website"
        ogImage="/images/businesses/jw-stone/logo-social-preview.png"
        structuredData={JW_STONE_COLLECTION_DATA}
      />
      <MarketplaceHeader
        wishlistCount={wishlist.count}
        onOpenWishlist={() => setWishlistOpen(true)}
        onStartRequest={() => startRequest([])}
      />
      <p className="sr-only" aria-live="polite">
        {wishlist.count} {wishlist.count === 1 ? "stone" : "stones"} saved
      </p>

      <MarketplaceIntroduction />
      <FirstCutSection onOpen={openStone} />
      <ColorPaletteRail
        aesthetic={state.aesthetic}
        color={state.color}
        material={state.material}
        origin={state.origin}
        onSelect={selectPalette}
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

      <StoneCollection
        state={state}
        isSaved={wishlist.isSaved}
        onUpdateFilters={(filters) => commit({ ...state, ...filters, stone: null })}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        onAsk={askAboutStone}
        catalog={JW_STONE_CATALOG}
      />

      <JwStoneStorySection />

      <MarketplaceFooter />

      <JwStoneRequestBand onStartRequest={() => startRequest([])} />

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
        businessName="JW Stone"
        hasViewerSession={isAuthenticated || Boolean((user as { id?: unknown } | null)?.id)}
        allowCall={false}
        stayInProfile
        requestMode="materials"
        initialStoneSelections={requestTargets}
        initialView="request"
        initialRequestType="request_material"
      />
    </div>
  );
}
