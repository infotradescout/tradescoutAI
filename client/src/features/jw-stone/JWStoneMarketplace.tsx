import { useMemo, useState } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useAuth } from "@/hooks/useAuth";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import type { DirectConnectMaterialTarget } from "@/pages/profile-sites/directConnectMaterial";
import { CustomerPathGuide } from "./CustomerPathGuide";
import { MarketplaceIntroduction } from "./MarketplaceIntroduction";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { StoneCollection } from "./StoneCollection";
import { StoneDetailDialog } from "./StoneDetailDialog";
import { WishlistPanel } from "./WishlistPanel";
import { getCatalogItemById, getNamedCatalogItemByShareSlug } from "./catalog";
import type { BuyerType, JwStoneCatalogItem } from "./types";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import { useMarketplaceUrlState } from "./useMarketplaceUrlState";

const JW_STONE_CANONICAL_URL = "https://www.thetradescout.com/jw-stone";
const JW_STONE_DESCRIPTION =
  "Browse JW Stone's supplied stone catalog, open full photo galleries, save named selections, and use optional source-backed guidance before choosing when to start a request.";
const JW_STONE_COLLECTION_DATA = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "JW Stone | Guided Stone Discovery",
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

  const chooseBuyer = (buyer: BuyerType) => {
    commit({ ...state, buyer, stone: null });
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
    commit({ ...state, stone: stone.shareSlug });
  };

  const startRequest = (stones: readonly JwStoneCatalogItem[]) => {
    closeStone();
    setWishlistOpen(false);
    setRequestContext(stones);
  };

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

      <MarketplaceIntroduction />

      <CustomerPathGuide
        selectedPath={state.buyer}
        onSelectPath={(buyer) =>
          buyer ? chooseBuyer(buyer) : commit({ ...state, buyer: null, stone: null })
        }
        onOpenStone={openStone}
      />

      <StoneCollection
        state={state}
        savedCount={wishlist.count}
        isSaved={wishlist.isSaved}
        onUpdateFilters={(filters) => commit({ ...state, ...filters, stone: null })}
        onToggleSaved={(stone) => wishlist.toggle(stone.id)}
        onOpen={openStone}
        onAsk={(stone) => startRequest(stone.wishlistEligible ? [stone] : [])}
      />

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
