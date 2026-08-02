import { useMemo, useState } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useAuth } from "@/hooks/useAuth";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";
import { BuyerJourney } from "./BuyerJourney";
import { BuyerWorkspace } from "./BuyerWorkspace";
import { FirstCutSection } from "./FirstCutSection";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { StoneDetailDialog } from "./StoneDetailDialog";
import { WishlistPanel } from "./WishlistPanel";
import { getCatalogItemById, getNamedCatalogItemByShareSlug } from "./catalog";
import type { BuyerType, ColorDirectionId, JwStoneCatalogItem, MarketplaceUrlState } from "./types";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import { useMarketplaceUrlState } from "./useMarketplaceUrlState";

const JW_STONE_CANONICAL_URL = "https://www.thetradescout.com/jw-stone";
const JW_STONE_DESCRIPTION =
  "Explore JW Stone inventory by buyer and color direction, save named selections in a browser wishlist, and choose when to start a request.";
const JW_STONE_COLLECTION_DATA = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "JW Stone | Guided Stone Discovery",
  description: JW_STONE_DESCRIPTION,
  url: JW_STONE_CANONICAL_URL,
  image: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
};

const EMPTY_STATE: MarketplaceUrlState = {
  buyer: null,
  color: null,
  material: null,
  finish: null,
  origin: null,
  stone: null,
};

type ReadyMarketplaceState = MarketplaceUrlState & {
  buyer: BuyerType;
  color: ColorDirectionId;
};

function scrollToPageStart() {
  if (typeof window === "undefined" || typeof window.scrollTo !== "function") return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  try {
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
}

export default function JWStoneMarketplace() {
  const { user, isAuthenticated } = useAuth();
  const { state, commit } = useMarketplaceUrlState();
  const wishlist = useJwStoneWishlist();
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [anonymousDetailId, setAnonymousDetailId] = useState<string | null>(null);
  const [requestContext, setRequestContext] = useState<readonly JwStoneCatalogItem[] | null>(null);

  const selectedStone =
    (state.stone ? getNamedCatalogItemByShareSlug(state.stone) : null) ||
    (anonymousDetailId ? getCatalogItemById(anonymousDetailId) : null);

  const requestTargets = useMemo<readonly DirectConnectMaterialTarget[]>(
    () =>
      (requestContext || [])
        .filter((stone) => stone.wishlistEligible && !stone.anonymous && stone.displayName)
        .map((stone) => ({ itemId: stone.id, itemName: stone.displayName! })),
    [requestContext]
  );

  const chooseBuyer = (buyer: BuyerType) => {
    commit({ ...EMPTY_STATE, buyer });
    scrollToPageStart();
  };

  const chooseColor = (color: ColorDirectionId) => {
    commit({ ...EMPTY_STATE, buyer: state.buyer, color });
    scrollToPageStart();
  };

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
    commit({
      buyer: state.buyer || "designer",
      color: stone.colorDirection,
      material: null,
      finish: null,
      origin: null,
      stone: stone.shareSlug,
    });
  };

  const startRequest = (stones: readonly JwStoneCatalogItem[]) => {
    closeStone();
    setWishlistOpen(false);
    setRequestContext(stones);
  };

  const readyState = state.buyer && state.color ? (state as ReadyMarketplaceState) : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-100 font-sans text-stone-950">
      <SEOHelmet
        title="JW Stone | Guided Stone Discovery"
        socialTitle="JW Stone | Guided Stone Discovery"
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

      {readyState ? (
        <BuyerWorkspace
          state={readyState}
          savedCount={wishlist.count}
          isSaved={wishlist.isSaved}
          onChangeBuyer={() => {
            commit(EMPTY_STATE);
            scrollToPageStart();
          }}
          onChangeColor={() => {
            commit({ ...EMPTY_STATE, buyer: readyState.buyer });
            scrollToPageStart();
          }}
          onUpdateFilters={(filters) =>
            commit({
              ...readyState,
              ...filters,
              stone: null,
            })
          }
          onToggleSaved={(stone) => wishlist.toggle(stone.id)}
          onOpen={openStone}
          onAsk={(stone) => startRequest(stone.wishlistEligible ? [stone] : [])}
        />
      ) : (
        <BuyerJourney
          buyer={state.buyer}
          onChooseBuyer={chooseBuyer}
          onChooseColor={chooseColor}
          onResetBuyer={() => {
            commit(EMPTY_STATE);
            scrollToPageStart();
          }}
        />
      )}

      <FirstCutSection />

      <footer className="border-t border-stone-300 bg-stone-100 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <img
            src="/images/businesses/jw-stone/logo.svg"
            alt="JW Stone"
            className="h-10 w-auto max-w-44 object-contain object-left"
          />
          <p>Stone discovery on your terms. Saving never starts a request.</p>
        </div>
      </footer>

      <StoneDetailDialog
        stone={selectedStone}
        buyer={state.buyer || "homeowner"}
        saved={selectedStone ? wishlist.isSaved(selectedStone.id) : false}
        onOpenChange={(open) => {
          if (!open) closeStone();
        }}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onAsk={(stone) => startRequest(stone.wishlistEligible ? [stone] : [])}
      />

      <WishlistPanel
        open={wishlistOpen}
        items={wishlist.items}
        restored={wishlist.restored}
        persisted={wishlist.persisted}
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
