import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useAuth } from "@/hooks/useAuth";
import {
  JW_STONE_2_COLOR_DIRECTION_OPTIONS,
  JW_STONE_2_INVENTORY,
  JW_STONE_2_INVENTORY_COUNTS,
  filterJwStone2Inventory,
  getJwStone2ContactSelections,
  getJwStone2FilterOptions,
  getJwStone2NamedItemBySlug,
} from "@/features/jw-stone-2/inventory";
import {
  DEFAULT_JW_STONE_2_FILTERS,
  getJwStone2DiscoveryStage,
  parseJwStone2DiscoveryState,
  serializeJwStone2DiscoveryState,
} from "@/features/jw-stone-2/discoveryState";
import { getJwStone2FirstCutSlots } from "@/features/jw-stone-2/firstCut";
import type {
  JwStone2BuyerType,
  JwStone2ColorDirection,
  JwStone2DiscoveryState,
  JwStone2InventoryItem,
} from "@/features/jw-stone-2/types";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { DiscoveryJourney } from "./DiscoveryJourney";
import { BuyerWorkspace } from "./BuyerWorkspace";
import { FirstCutExclusives } from "./FirstCutExclusives";
import { StoneDetailsDialog } from "./StoneDetailsDialog";
import { TrendingSelection } from "./TrendingSelection";
import { WishlistDrawer } from "./WishlistDrawer";
import { useJwStoneWishlist } from "./useJwStoneWishlist";
import "./jw-stone-2-shell.css";
import "./jw-stone-2-results.css";
import "./jw-stone-2-workspaces-project.css";
import "./jw-stone-2-workspaces-editorial.css";
import "./jw-stone-2-dialog.css";
import "./jw-stone-2-wishlist.css";

type ContactState =
  | { kind: "single"; items: readonly JwStone2InventoryItem[] }
  | { kind: "wishlist"; items: readonly JwStone2InventoryItem[] }
  | null;

const CANONICAL_URL = "https://www.thetradescout.com/jw-stone";

function discoveryUrl(state: JwStone2DiscoveryState) {
  const query = serializeJwStone2DiscoveryState(state);
  return query ? `/jw-stone?${query}` : "/jw-stone";
}

function currentDiscoveryLocation(routerLocation: string) {
  if (routerLocation.includes("?") || typeof window === "undefined") {
    return routerLocation;
  }
  if (window.location.pathname !== "/jw-stone") return routerLocation;
  return `${window.location.pathname}${window.location.search}`;
}

export default function JwStoneMarketplacePage() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(() =>
    parseJwStone2DiscoveryState(currentDiscoveryLocation(location))
  );
  const [activeItem, setActiveItem] = useState<JwStone2InventoryItem | null>(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contact, setContact] = useState<ContactState>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const wishlist = useJwStoneWishlist();

  const stage = getJwStone2DiscoveryStage(state);
  const filteredItems = useMemo(() => filterJwStone2Inventory(state), [state]);
  const namedItems = useMemo(
    () => filteredItems.filter((item) => item.isEligibleForPublicActions),
    [filteredItems]
  );
  const anonymousItems = useMemo(
    () => filteredItems.filter((item) => !item.isEligibleForPublicActions),
    [filteredItems]
  );
  const colorInventory = useMemo(
    () =>
      state.color
        ? JW_STONE_2_INVENTORY.filter((item) => item.colorDirection === state.color)
        : JW_STONE_2_INVENTORY,
    [state.color]
  );
  const filterOptions = useMemo(() => getJwStone2FilterOptions(colorInventory), [colorInventory]);
  const colorChoices = useMemo(
    () =>
      JW_STONE_2_COLOR_DIRECTION_OPTIONS.map((option) => {
        const representative = JW_STONE_2_INVENTORY.find(
          (item) => item.colorDirection === option.id && item.isNamed
        );
        return {
          ...option,
          count: JW_STONE_2_INVENTORY.filter((item) => item.colorDirection === option.id).length,
          image: representative?.images[0] || JW_STONE_2_INVENTORY[0].images[0],
        };
      }),
    []
  );

  useEffect(() => {
    const restore = (source: string) => {
      const restored = parseJwStone2DiscoveryState(source);
      setState(restored);
      if (!restored.buyer || !restored.color || !restored.stone) {
        setActiveItem((current) => (current?.isNamed ? null : current));
        return;
      }
      const restoredItem = getJwStone2NamedItemBySlug(restored.stone);
      const matchesRestoredState = filterJwStone2Inventory(restored).some(
        (item) => item.id === restoredItem?.id
      );
      setActiveItem(matchesRestoredState ? restoredItem || null : null);
    };
    restore(currentDiscoveryLocation(location));
    const restoreAfterHistoryNavigation = () =>
      restore(`${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", restoreAfterHistoryNavigation);
    return () => window.removeEventListener("popstate", restoreAfterHistoryNavigation);
  }, [location]);

  const commitState = useCallback(
    (next: JwStone2DiscoveryState) => {
      setState(next);
      navigate(discoveryUrl(next), { replace: true });
    },
    [navigate]
  );

  const scrollToDiscovery = () => {
    requestAnimationFrame(() => {
      document.getElementById("discover")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const chooseBuyer = (buyer: JwStone2BuyerType) => {
    commitState({ ...DEFAULT_JW_STONE_2_FILTERS, buyer });
    setActiveItem(null);
    scrollToDiscovery();
  };
  const chooseColor = (color: JwStone2ColorDirection) => {
    commitState({ ...DEFAULT_JW_STONE_2_FILTERS, buyer: state.buyer, color });
    setActiveItem(null);
    scrollToDiscovery();
  };
  const updateFilter = (key: keyof JwStone2DiscoveryState, value: string | null) => {
    commitState({ ...state, [key]: value, stone: null });
    setActiveItem(null);
  };
  const openDetails = (item: JwStone2InventoryItem) => {
    setWishlistOpen(false);
    setActiveItem(item);
    if (item.publicSlug && state.buyer && state.color) {
      commitState({ ...state, stone: item.publicSlug });
    }
  };
  const closeDetails = () => {
    setActiveItem(null);
    if (state.stone) commitState({ ...state, stone: null });
  };
  const toggleSaved = (item: JwStone2InventoryItem) => {
    if (item.isEligibleForPublicActions) wishlist.toggle(item.id);
  };
  const askAboutStone = (item: JwStone2InventoryItem) => {
    if (!item.isEligibleForPublicActions) return;
    setActiveItem(null);
    setContact({ kind: "single", items: [item] });
  };
  const askAboutWishlist = (items: readonly JwStone2InventoryItem[]) => {
    const eligibleItems = items.filter((item) => item.isEligibleForPublicActions);
    if (!eligibleItems.length) return;
    if (eligibleItems.length > 24) {
      setPageNotice(
        "A request can carry 24 named selections at a time. The first 24 are included."
      );
    }
    setWishlistOpen(false);
    setContact({ kind: "wishlist", items: eligibleItems.slice(0, 24) });
  };

  const contactSelections = contact
    ? getJwStone2ContactSelections(contact.items.map((item) => item.id)).map((selection) => ({
        itemId: selection.id,
        itemName: selection.label,
      }))
    : [];
  const singleContact = contact?.kind === "single" ? contact.items[0] : null;
  const combinedNotice = pageNotice || wishlist.notice;

  return (
    <div className="jw2" data-jw-stone-2>
      <SEOHelmet
        title="JW Stone | Guided Natural Stone Discovery"
        socialTitle="JW Stone — A guided way to discover the collection"
        description="Explore JW Stone's photographed stone collection by buyer path and color direction, save named selections, and contact JW voluntarily."
        canonical={CANONICAL_URL}
        ogType="website"
        ogImage="/images/businesses/jw-stone/video/hero-poster.jpg"
      />

      <header className="jw2-header">
        <button
          className="jw2-brand"
          type="button"
          onClick={() => commitState({ ...DEFAULT_JW_STONE_2_FILTERS })}
          aria-label="JW Stone home"
        >
          <img src="/images/businesses/jw-stone/logo.svg" alt="JW Stone" />
        </button>
        <nav className={mobileNavOpen ? "jw2-nav is-open" : "jw2-nav"} aria-label="JW Stone">
          <a href="#discover" onClick={() => setMobileNavOpen(false)}>
            Discover
          </a>
          <a href="#first-cut" onClick={() => setMobileNavOpen(false)}>
            First Cut
          </a>
          <button type="button" onClick={() => setWishlistOpen(true)}>
            <Bookmark aria-hidden="true" size={16} />
            Saved <span>{wishlist.items.length}</span>
          </button>
        </nav>
        <button
          className="jw2-menu-button"
          type="button"
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <main>
        <section className="jw2-hero">
          <img
            className="jw2-hero-image"
            src="/images/businesses/jw-stone/video/hero-poster.jpg"
            alt="JW Stone natural stone presentation"
          />
          <div className="jw2-hero-shade" aria-hidden="true" />
          <div className="jw2-hero-content">
            <p>JW Stone · Natural stone discovery</p>
            <h1>Stone chosen around the way you see a project.</h1>
            <span>
              A buyer-first, color-led path through {JW_STONE_2_INVENTORY_COUNTS.total} current
              stone selections, guided by real photography and available details.
            </span>
            <a href="#discover">Begin your path</a>
          </div>
        </section>

        <div id="first-cut">
          <FirstCutExclusives slots={getJwStone2FirstCutSlots()} />
        </div>

        <div id="discover">
          <DiscoveryJourney
            state={state}
            stage={stage}
            colorChoices={colorChoices}
            filterOptions={filterOptions}
            resultCount={filteredItems.length}
            onChooseBuyer={chooseBuyer}
            onChooseColor={chooseColor}
            onChangeBuyer={() => {
              commitState({ ...DEFAULT_JW_STONE_2_FILTERS });
              setActiveItem(null);
            }}
            onChangeColor={() => {
              commitState({ ...DEFAULT_JW_STONE_2_FILTERS, buyer: state.buyer });
              setActiveItem(null);
            }}
            onFilter={updateFilter}
          />
        </div>

        {stage === "results" && state.buyer ? (
          <div className="jw2-results">
            {namedItems.length ? (
              <BuyerWorkspace
                buyer={state.buyer}
                items={namedItems}
                savedIds={wishlist.savedIds}
                onToggleSave={toggleSaved}
                onOpenDetails={openDetails}
                onAsk={askAboutStone}
              />
            ) : (
              <section className="jw2-no-results" aria-live="polite">
                <p className="jw2-eyebrow">No named selections match every filter</p>
                <h2>Open the filters a little wider.</h2>
                <p>Your buyer and color choices are still saved.</p>
                <button
                  type="button"
                  onClick={() =>
                    commitState({
                      ...DEFAULT_JW_STONE_2_FILTERS,
                      buyer: state.buyer,
                      color: state.color,
                    })
                  }
                >
                  Clear the extra filters
                </button>
              </section>
            )}
            <TrendingSelection items={anonymousItems} onOpenGallery={openDetails} />
          </div>
        ) : null}
      </main>

      <footer className="jw2-footer">
        <img src="/images/businesses/jw-stone/logo.svg" alt="JW Stone" />
        <p>Stone photography and collection details from JW Stone.</p>
        <a href="/">Powered by TradeScout</a>
      </footer>

      {combinedNotice ? (
        <div className="jw2-notice" role="status">
          <span>{combinedNotice}</span>
          <button
            type="button"
            onClick={() => {
              setPageNotice(null);
              wishlist.dismissNotice();
            }}
            aria-label="Dismiss message"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}

      <StoneDetailsDialog
        item={activeItem}
        isSaved={Boolean(activeItem && wishlist.savedIds.has(activeItem.id))}
        onClose={closeDetails}
        onToggleSave={toggleSaved}
        onAsk={askAboutStone}
      />
      <WishlistDrawer
        open={wishlistOpen}
        items={wishlist.items}
        onClose={() => setWishlistOpen(false)}
        onRemove={wishlist.remove}
        onClear={wishlist.clear}
        onOpenDetails={openDetails}
        onAskAboutSelection={askAboutWishlist}
      />
      <ExpressDirectConnectPanel
        open={Boolean(contact)}
        onClose={() => setContact(null)}
        profileSlug="jw-stone"
        businessName="JW Stone LLC"
        hasViewerSession={isAuthenticated}
        allowCall={false}
        requestMode="materials"
        initialStoneName={singleContact?.publicName}
        initialItemId={singleContact?.publicSlug}
        initialStoneSelections={contact?.kind === "wishlist" ? contactSelections : null}
        initialRequestType="request_material"
      />
    </div>
  );
}
