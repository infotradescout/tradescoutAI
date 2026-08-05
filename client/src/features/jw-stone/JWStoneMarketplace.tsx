import { useEffect, useMemo, useState } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useAuth } from "@/hooks/useAuth";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { JW_STONE_CATALOG, getCatalogItemById, getNamedCatalogItemByShareSlug } from "./catalog";
import { ColorPaletteRail, type ColorSwatchSelection } from "./ColorPaletteRail";
import { FirstCutSection } from "./FirstCutSection";
import { JwStoneRequestBand } from "./JwStoneRequestBand";
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

export default function JWStoneMarketplace() {
  const { user, isAuthenticated } = useAuth();
  const { state, commit } = useMarketplaceUrlState();
  const wishlist = useJwStoneWishlist();
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [anonymousDetailId, setAnonymousDetailId] = useState<string | null>(null);
  const [requestContext, setRequestContext] = useState<readonly JwStoneCatalogItem[] | null>(null);

  // Document scroll only — avoid body/#root dual-scroll trapping hash landings.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("jw-marketplace-scroll");
    body.classList.add("jw-marketplace-scroll");
    return () => {
      root.classList.remove("jw-marketplace-scroll");
      body.classList.remove("jw-marketplace-scroll");
    };
  }, []);

  const selectedStone =
    (state.stone ? getNamedCatalogItemByShareSlug(state.stone) : null) ||
    (anonymousDetailId ? getCatalogItemById(anonymousDetailId) : null);

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
    setAnonymousDetailId(null);
    if (state.stone) commit({ ...state, stone: null }, { replace: true });
  };

  const openStone = (stone: JwStoneCatalogItem) => {
    if (stone.anonymous || !stone.shareSlug) {
      setAnonymousDetailId(stone.id);
      return;
    }
    setAnonymousDetailId(null);
    commit({ ...state, stone: stone.shareSlug });
  };

  const openSavedStone = (stone: JwStoneCatalogItem) => {
    setWishlistOpen(false);
    setAnonymousDetailId(null);
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
  };

  const selectMaterial = (material: string | null) => {
    commit({ ...state, material, stone: null });
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
      <FirstCutSection />
      <ColorPaletteRail
        aesthetic={state.aesthetic}
        color={state.color}
        material={state.material}
        origin={state.origin}
        onSelect={selectPalette}
      />
      <MaterialCategoryRail active={state.material} onSelect={selectMaterial} />

      <StoneCollection
        state={state}
        isSaved={wishlist.isSaved}
        onUpdateFilters={(filters) => commit({ ...state, ...filters, stone: null })}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        catalog={JW_STONE_CATALOG}
      />

      <MarketplaceFooter />

      <JwStoneRequestBand onStartRequest={() => startRequest([])} />

      <StoneDetailDialog
        stone={selectedStone}
        saved={selectedStone ? wishlist.isSaved(selectedStone.id) : false}
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
