import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronRight,
  MapPin,
  ShieldCheck,
  Package,
  Truck,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
  Gem,
  Wrench,
  Building2,
  Compass,
  Home,
  Search,
  X,
} from "lucide-react";
import ExpressDirectConnectPanel, {
  type ExpressDirectConnectRequestType,
} from "./ExpressDirectConnectPanel";

/**
 * Premium profile theme for paid-tier businesses (wholesalers, suppliers,
 * distributors, etc.). The layout, sections, trust language, and Direct
 * Connect flow match TradeScout's own profile design system -- but the
 * palette is customer-brandable via business.profileData.brandColors, so
 * each paying customer's profile can look like their own brand rather than
 * TradeScout's. Falls back to a tasteful default palette when unset.
 */

type ContentBlock = {
  type: string;
  data?: Record<string, any>;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
};

type RecommendationEntry = {
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
};

type RecommendationDirectorySummary = {
  total: number;
  positive: number;
  negative: number;
};

type InventoryStone = {
  name: string;
  slug: string;
  images: string[];
  slabCounts?: number[];
  materialStatus?: "user_confirmed" | "source_folder" | "filename" | "historical_assignment" | "unconfirmed";
  finishes?: string[];
  finishStatus?: "explicit" | "unconfirmed";
  sourceNote?: string;
};

type InventoryCategory = {
  category: string;
  categorySlug: string;
  stones: InventoryStone[];
};

export type WholesalerBrandColors = {
  primary?: string;
  primaryDark?: string;
  accent?: string;
  secondary?: string;
  background?: string;
  surface?: string;
};

type WholesalerProfileThemeProps = {
  profileSlug: string;
  displayName: string;
  headline: string | null;
  contentBlocks: ContentBlock[];
  categories: string[];
  serviceAreas: string[];
  brandColors?: WholesalerBrandColors;
  contactReason?: string | null;
  hasViewerSession: boolean;
  isSuperAdminViewer: boolean;
  useExpressDirectConnect: boolean;
  directConnectHref: string;
  preScoutCreateHref: string;
  preScoutSignInHref: string;
  recommendationsDirectory?: RecommendationEntry[];
  recommendationDirectorySummary?: RecommendationDirectorySummary;
};

const DEFAULT_BRAND_COLORS: Required<WholesalerBrandColors> = {
  primary: "#0e3a5c",
  primaryDark: "#08283f",
  accent: "#b3892b",
  secondary: "#7a7466",
  background: "#ffffff",
  surface: "#f7f4ec",
};

const AUDIENCE_PATHS = [
  {
    icon: Wrench,
    label: "Fabricators",
    body: "Bookmatched slabs and bundle sourcing for shops running production schedules.",
  },
  {
    icon: Building2,
    label: "Builders & Developers",
    body: "Project-volume material for developments that need consistent supply and delivery windows.",
  },
  {
    icon: Compass,
    label: "Architects & Designers",
    body: "One-off slab selection for specified projects, with direct access to what's actually in stock.",
  },
  {
    icon: Home,
    label: "Homeowners",
    body: "Hand-selected stone for a single kitchen, bath, or feature -- no minimum order.",
  },
] as const;

const DEFAULT_DIFFERENTIATORS = [
  {
    icon: Gem,
    title: "Material selection",
    body: "Slabs are chosen individually, not bought sight-unseen by the container.",
  },
  {
    icon: ShieldCheck,
    title: "Processing & finish oversight",
    body: "Each order is reviewed through fabrication and finishing before it ships.",
  },
  {
    icon: Truck,
    title: "Logistics & delivery",
    body: "Delivery is coordinated directly, not handed off to a third party.",
  },
  {
    icon: Package,
    title: "Project-specific sourcing",
    body: "When the right slab isn't in stock, it gets sourced for the specific project.",
  },
] as const;

const DIRECT_CONNECT_OPTIONS: ReadonlyArray<{
  label: string;
  value: ExpressDirectConnectRequestType;
}> = [
  { label: "Request material", value: "request_material" },
  { label: "Match a project", value: "match_project" },
  { label: "Ask about a bundle", value: "ask_about_bundle" },
  { label: "Schedule a showroom visit", value: "schedule_showroom" },
];

const JW_STONE_STORY_IMAGES = [
  {
    src: "/images/businesses/jw-stone/story/quarry.webp",
    alt: "Natural stone quarry represented on the JW Stone website",
    label: "Direct quarry relationships",
  },
  {
    src: "/images/businesses/jw-stone/story/taj-living-room.webp",
    alt: "Light natural stone installation represented on the JW Stone website",
    label: "Stone specified for the whole space",
  },
  {
    src: "/images/businesses/jw-stone/story/fireplace.webp",
    alt: "Dark and light stone interior represented on the JW Stone website",
    label: "Material with architectural impact",
  },
  {
    src: "/images/businesses/jw-stone/story/mont-blanc-bar.webp",
    alt: "Illuminated stone bar represented on the JW Stone website",
    label: "Finished-space inspiration",
  },
] as const;

const JW_STONE_PICK_SLUGS = new Set([
  "blue-dunes",
  "cristallo",
  "gold-macaubas",
  "rhino-white",
  "taj-mahal",
  "titanium",
]);

const JW_STONE_FEATURED_OFFERS = [
  {
    slug: "taj-mahal",
    material: "Quartzite",
    finish: "Polished",
    price: "$26.95/sf",
    size: "126 × 79",
    availability: "27 slabs",
  },
  {
    slug: "titanium",
    material: "Granite",
    finish: "Leathered",
    price: "$13.50/sf",
    size: "115 × 76",
    availability: "6 slabs",
  },
  {
    slug: "rhino-white",
    material: "Marble",
    finish: "Polished",
    price: "$26.50/sf",
    size: "111 × 69.25",
    availability: "7 slabs",
  },
] as const;

// Horizontal, scroll-snapped rows keep the page short and let visitors jump
// straight to what they came for instead of scrolling past every section.
const SCROLL_ROW =
  "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const SCROLL_CARD = "w-[240px] flex-shrink-0 snap-start sm:w-[260px]";

function useWholesalerThemeFonts() {
  useEffect(() => {
    const id = "wholesaler-theme-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "preload";
    link.as = "style";
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap";
    link.onload = () => {
      link.rel = "stylesheet";
    };
    document.head.appendChild(link);
  }, []);
}

const DISPLAY_FONT = "font-['Playfair_Display',serif]";

function findBlock(blocks: ContentBlock[], type: string): ContentBlock | undefined {
  return blocks.find((b) => b?.type === type);
}

function blockText(block: ContentBlock | undefined): string {
  if (!block) return "";
  return (
    (typeof block.data?.text === "string" && block.data.text) ||
    (typeof block.body === "string" && block.body) ||
    ""
  );
}

function blockItems(block: ContentBlock | undefined): string[] {
  if (!block) return [];
  return Array.isArray(block.data?.items)
    ? block.data.items.filter(
        (i: unknown): i is string => typeof i === "string" && i.trim().length > 0
      )
    : [];
}

export default function WholesalerProfileTheme({
  profileSlug,
  displayName,
  headline,
  contentBlocks,
  categories,
  serviceAreas,
  brandColors,
  contactReason,
  hasViewerSession,
  useExpressDirectConnect,
  directConnectHref,
  preScoutCreateHref,
  preScoutSignInHref,
  recommendationsDirectory = [],
  recommendationDirectorySummary,
}: WholesalerProfileThemeProps) {
  useWholesalerThemeFonts();
  const [, navigate] = useLocation();

  const colors = { ...DEFAULT_BRAND_COLORS, ...brandColors };
  const themeVars = {
    "--brand-primary": colors.primary,
    "--brand-primary-dark": colors.primaryDark,
    "--brand-accent": colors.accent,
    "--brand-secondary": colors.secondary,
    "--brand-bg": colors.background,
    "--brand-surface": colors.surface,
  } as React.CSSProperties;

  const summary = recommendationDirectorySummary || {
    total: recommendationsDirectory.length,
    positive: recommendationsDirectory.filter((row) => row.recommendationType === "positive")
      .length,
    negative: recommendationsDirectory.filter((row) => row.recommendationType === "negative")
      .length,
  };

  const aboutBlock = findBlock(contentBlocks, "about");
  const servicesBlock = findBlock(contentBlocks, "services");
  const faqBlock = findBlock(contentBlocks, "faq");
  const galleryBlock = findBlock(contentBlocks, "gallery");
  const trustBlock = findBlock(contentBlocks, "trust");
  const differentiatorsBlock = findBlock(contentBlocks, "differentiators");
  const inventoryCatalogBlock = findBlock(contentBlocks, "inventoryCatalog");

  const aboutText = blockText(aboutBlock);
  const inventoryItems = blockItems(servicesBlock);
  const galleryImages: string[] = Array.isArray(galleryBlock?.data?.images)
    ? galleryBlock.data.images.filter((i: unknown): i is string => typeof i === "string")
    : [];
  const faqItems: Array<{ question?: string; answer?: string }> = Array.isArray(
    faqBlock?.data?.faqs
  )
    ? faqBlock.data.faqs
    : [];
  // Only confirmed facts belong here -- this is rendered as verified trust
  // signal, not marketing copy, so it must come from data, not a default.
  const trustFacts = blockItems(trustBlock);
  const differentiatorItems: Array<{ title?: string; body?: string }> = Array.isArray(
    differentiatorsBlock?.data?.items
  )
    ? differentiatorsBlock.data.items
    : [];
  const differentiators =
    differentiatorItems.length > 0
      ? differentiatorItems.map((item, i) => ({
          icon: DEFAULT_DIFFERENTIATORS[i % DEFAULT_DIFFERENTIATORS.length].icon,
          title: item.title || DEFAULT_DIFFERENTIATORS[i % DEFAULT_DIFFERENTIATORS.length].title,
          body: item.body || "",
        }))
      : DEFAULT_DIFFERENTIATORS;
  // Real, named inventory grouped by material category -- no pricing here by
  // design; priced/featured stones are a separate, later concern.
  const inventoryCatalog: InventoryCategory[] = Array.isArray(
    inventoryCatalogBlock?.data?.categories
  )
    ? inventoryCatalogBlock.data.categories
    : [];
  const [activeCategorySlug, setActiveCategorySlug] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryVisibleLimit, setInventoryVisibleLimit] = useState(24);
  const [openStone, setOpenStone] = useState<InventoryStone | null>(null);
  const [openImageIndex, setOpenImageIndex] = useState(0);
  const [expressPanelOpen, setExpressPanelOpen] = useState(false);
  const [expressStoneName, setExpressStoneName] = useState<string | null>(null);
  const [expressRequestType, setExpressRequestType] =
    useState<ExpressDirectConnectRequestType | null>(null);
  const normalizedInventorySearch = inventorySearch.trim().toLowerCase();
  const allInventoryStones = inventoryCatalog.flatMap((category) => category.stones);
  const jwStonePicks = [...JW_STONE_PICK_SLUGS]
    .map((slug) => allInventoryStones.find((stone) => stone.slug === slug))
    .filter((stone): stone is InventoryStone => Boolean(stone))
    .slice(0, 3);
  const selectedCategory = inventoryCatalog.find(
    (category) => category.categorySlug === activeCategorySlug
  );
  const categoryStones =
    activeCategorySlug === "jw-picks"
      ? allInventoryStones.filter((stone) => JW_STONE_PICK_SLUGS.has(stone.slug))
      : selectedCategory?.stones || allInventoryStones;
  const visibleStones = categoryStones.filter((stone) =>
    normalizedInventorySearch ? stone.name.toLowerCase().includes(normalizedInventorySearch) : true
  );
  const displayedStones = visibleStones.slice(0, inventoryVisibleLimit);
  const featuredStones =
    profileSlug === "jw-stone"
      ? JW_STONE_FEATURED_OFFERS.map((offer) => ({
          ...offer,
          stone: allInventoryStones.find((stone) => stone.slug === offer.slug),
        }))
      : [];
  const hasInventoryFilters = activeCategorySlug !== "all" || normalizedInventorySearch.length > 0;
  useEffect(() => {
    setInventoryVisibleLimit(24);
  }, [activeCategorySlug, normalizedInventorySearch]);
  const cristalloHeroImage = inventoryCatalog
    .flatMap((category) => category.stones)
    .find((stone) => stone.slug === "cristallo")?.images[0];
  const heroImage =
    (profileSlug === "jw-stone" ? cristalloHeroImage : undefined) ||
    inventoryCatalog.flatMap((c) => c.stones).flatMap((s) => s.images)[0] ||
    galleryImages[0];
  const heroEyebrow =
    profileSlug === "jw-stone"
      ? "Cristallo quartzite · shown backlit"
      : categories.slice(0, 3).join(" · ");
  const heroHeadline =
    profileSlug === "jw-stone"
      ? "Natural stone, selected at the source."
      : headline || "Hand-selected stone. Direct from the source.";
  // The hero is a glance, not a read -- keep it to one sentence and let the
  // "Why Us" section carry the fuller story for anyone who scrolls that far.
  const heroTeaser =
    profileSlug === "jw-stone"
      ? "Browse current inventory or contact JW Stone directly."
      : aboutText.split(/(?<=[.!?])\s+/)[0] || aboutText;

  const ctaHref = hasViewerSession ? directConnectHref : preScoutCreateHref;
  const startDirectConnect = (
    stoneName?: string | null,
    requestType?: ExpressDirectConnectRequestType | null
  ) => {
    if (useExpressDirectConnect) {
      setExpressStoneName(stoneName || null);
      setExpressRequestType(requestType || (stoneName ? "request_material" : null));
      setExpressPanelOpen(true);
      return;
    }
    navigate(ctaHref);
  };

  const renderStoneCard = (stone: InventoryStone, stoneIndex: number, wrapperClassName: string) => (
    <button
      key={stone.slug}
      onClick={() => {
        setOpenStone(stone);
        setOpenImageIndex(0);
      }}
      className={`group overflow-hidden rounded-2xl border border-[#241d0f]/15 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/60 hover:shadow-lg ${wrapperClassName}`}
    >
      {stone.images[0] ? (
        <div className="relative h-56 overflow-hidden">
          <img
            src={stone.images[0]}
            alt={stone.name}
            loading={stoneIndex < 8 ? "eager" : "lazy"}
            fetchPriority={stoneIndex < 4 ? "high" : "auto"}
            className="h-full w-full bg-stone-200 object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {stone.images.length > 1 ? (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
              {stone.images.length} photos
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="p-4">
        <p className="text-base font-bold !text-[#241d0f]">{stone.name}</p>
        {stone.slabCounts?.length ? (
          <p className="mt-1 text-sm font-bold text-[var(--brand-primary)]">
            {stone.slabCounts.length === 1
              ? `${stone.slabCounts[0]} slabs`
              : `Bundle counts: ${stone.slabCounts.join(", ")} slabs`}
          </p>
        ) : null}
        <p className="mt-1 text-xs font-medium !text-[#4a4238]">
          {stone.finishes?.length ? stone.finishes.join(" · ") : "Finish: ask JW Stone"}
        </p>
        {stone.materialStatus === "unconfirmed" ? (
          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
            Trending at JW Stone
          </span>
        ) : null}
      </div>
    </button>
  );

  return (
    <div
      className="jw-stone-public-profile min-h-full bg-[var(--brand-bg)] !text-stone-900"
      style={themeVars}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--brand-primary)]/10 bg-[var(--brand-bg)] shadow-sm">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-5">
          {profileSlug === "jw-stone" ? (
            <div className="min-w-0">
              <img
                src="/images/businesses/jw-stone/logo.svg"
                alt="JW Stone — Premium Wholesale Stone Distributor"
                className="h-auto w-[164px] max-w-[50vw] md:w-[230px]"
              />
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] !text-[#4a4238]">
                TradeScout Profile · Protected Direct Connect
              </p>
            </div>
          ) : (
            <div>
              <span
                className={`block text-xl font-bold leading-tight text-[var(--brand-primary)] md:text-2xl ${DISPLAY_FONT}`}
              >
                {displayName}
              </span>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-secondary)]">
                TradeScout TradePartner
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => startDirectConnect()}
            className="flex-shrink-0 rounded-full bg-[var(--brand-primary)] px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--brand-primary-dark)] md:px-5 md:text-sm"
          >
            Direct Connect
          </button>
        </div>
        <div className="scrollbar-hide hidden gap-6 overflow-x-auto px-5 pb-3.5 text-xs font-semibold uppercase tracking-wide text-[#241d0f] [-ms-overflow-style:none] [scrollbar-width:none] md:flex md:px-8 [&::-webkit-scrollbar]:hidden">
          {[
            ["Collection", "#collection"],
            ["Why Us", "#why-us"],
            ["Who We Serve", "#audience"],
            ["Materials", "#materials"],
            ["Connect", "#connect"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="flex-shrink-0 whitespace-nowrap transition-colors hover:text-[var(--brand-accent)]"
            >
              {label}
            </a>
          ))}
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative isolate flex min-h-[min(690px,calc(100svh-150px))] items-end overflow-hidden bg-[var(--brand-primary)] bg-cover bg-center py-10 md:min-h-[500px] md:items-center md:py-20"
        style={
          heroImage
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(20,14,8,0.12) 0%, rgba(20,14,8,0.42) 40%, rgba(20,14,8,0.92) 100%), url(${heroImage})`,
              }
            : undefined
        }
      >
        <div className="container mx-auto px-5 text-left md:px-6 md:text-center">
          {heroEyebrow ? (
            <span className="mb-4 inline-block rounded-full border border-white/25 bg-black/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm md:mb-6 md:px-4 md:text-xs">
              {heroEyebrow}
            </span>
          ) : null}
          <h1
            className={`mb-4 max-w-[18ch] text-[2.55rem] font-bold leading-[0.98] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.5)] md:mx-auto md:mb-6 md:max-w-3xl md:text-6xl md:leading-tight ${DISPLAY_FONT}`}
          >
            {heroHeadline}
          </h1>
          {heroTeaser ? (
            <p className="mb-7 max-w-[34rem] text-base leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.65)] md:mx-auto md:mb-10 md:text-lg">
              {heroTeaser}
            </p>
          ) : null}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:justify-center">
            <a href="#collection" className="hidden md:block">
              <button className="flex items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Explore Inventory
              </button>
            </a>
            <button
              type="button"
              onClick={() => startDirectConnect()}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-7 py-3.5 text-base font-bold text-[#16200b] shadow-[0_12px_36px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 md:min-h-0 md:rounded-full md:text-sm md:text-white"
            >
              Direct Connect
              <ChevronRight className="h-4 w-4" />
            </button>
            {!hasViewerSession ? (
              <Link href={preScoutSignInHref} className="hidden md:block">
                <button className="rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Sign in
                </button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Trust strip -- confirmed facts only, sourced from the "trust" content block */}
      {trustFacts.length > 0 || serviceAreas.length > 0 ? (
        <section className="border-b border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] py-5">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm font-semibold !text-stone-900 md:px-6">
            {trustFacts.map((fact, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[var(--brand-accent)]" />
                {fact}
              </span>
            ))}
            {trustFacts.length === 0 && serviceAreas.length > 0 ? (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 text-[var(--brand-accent)]" />
                Serving {serviceAreas.slice(0, 4).join(", ")}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Live stone collection */}
      {inventoryCatalog.length > 0 ? (
        <section id="collection" className="scroll-mt-28 bg-[var(--brand-bg)] py-10 md:py-14">
          <div className="container mx-auto px-4 md:px-6">
            {featuredStones.length > 0 ? (
              <div className="mb-10">
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--brand-accent)]">
                    Featured stone offers
                  </p>
                  <h2 className={`mt-1 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}>
                    Ready for the next job
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {featuredStones.map((offer) => {
                    const stone = offer.stone;
                    if (!stone) return null;
                    return (
                      <button
                        key={offer.slug}
                        type="button"
                        onClick={() => {
                          setOpenStone(stone);
                          setOpenImageIndex(0);
                        }}
                        className="group overflow-hidden rounded-2xl border border-[#241d0f]/15 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <img
                          src={stone.images[0]}
                          alt={stone.name}
                          className="h-52 w-full bg-stone-200 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-bold !text-[#241d0f]">{stone.name}</p>
                              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide !text-[#4a4238]">
                                {offer.material} · {offer.finish}
                              </p>
                            </div>
                            <p className="whitespace-nowrap text-lg font-bold text-[var(--brand-primary)]">
                              {offer.price}
                            </p>
                          </div>
                          <p className="mt-3 text-sm !text-[#4a4238]">
                            {offer.size} · {offer.availability}
                          </p>
                          <span className="mt-4 inline-flex rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-white">
                            Ask about this stone
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="mb-6">
              <h2
                className={`mb-1 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
              >
                Current Inventory
              </h2>
              <p className="text-sm !text-[#4a4238]">
                Search JW Stone's full collection or open any stone to send a protected Direct Connect request.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-[#241d0f]/15 bg-white p-3 shadow-sm md:p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-center">
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-4 focus-within:border-[var(--brand-primary)]/50">
                  <Search className="h-4 w-4 flex-shrink-0 text-[var(--brand-primary)]/60" />
                  <span className="sr-only">Search JW Stone inventory</span>
                  <input
                    type="search"
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="Search by stone name"
                    className="w-full !bg-transparent text-sm !text-stone-900 outline-none placeholder:!text-stone-500"
                  />
                </label>
                <label className="relative">
                  <span className="sr-only">Filter by material</span>
                  <select
                    value={activeCategorySlug}
                    onChange={(event) => setActiveCategorySlug(event.target.value)}
                    className="min-h-12 w-full appearance-none rounded-xl border border-[var(--brand-primary)]/15 !bg-white px-4 pr-10 text-sm font-semibold !text-stone-900 outline-none focus:border-[var(--brand-primary)]/50"
                  >
                    <option value="all">All stone ({allInventoryStones.length})</option>
                    {profileSlug === "jw-stone" ? (
                      <option value="jw-picks">JW Stone Picks ({JW_STONE_PICK_SLUGS.size})</option>
                    ) : null}
                    {inventoryCatalog.map((category) => (
                      <option key={category.categorySlug} value={category.categorySlug}>
                        {category.category} ({category.stones.length})
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[var(--brand-primary)]/55" />
                </label>
                {hasInventoryFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategorySlug("all");
                      setInventorySearch("");
                    }}
                    className="min-h-12 rounded-xl border border-[var(--brand-primary)]/15 px-4 text-sm font-semibold text-[var(--brand-primary)] hover:bg-white"
                  >
                    Clear filters
                  </button>
                ) : (
                  <p className="whitespace-nowrap px-2 text-sm font-semibold !text-[#4a4238]">
                    {visibleStones.length} stones
                  </p>
                )}
              </div>
              {hasInventoryFilters ? (
                <p className="mt-3 px-1 text-sm font-medium !text-[#4a4238]">
                  {visibleStones.length} {visibleStones.length === 1 ? "stone" : "stones"} shown
                </p>
              ) : null}
            </div>

            {hasInventoryFilters ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {displayedStones.map((stone, stoneIndex) =>
                    renderStoneCard(stone, stoneIndex, "")
                  )}
                </div>
                {visibleStones.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--brand-primary)]/20 bg-[var(--brand-surface)] px-5 py-10 text-center">
                    <p className="font-semibold text-[#241d0f]">No matching stone name</p>
                    <p className="mt-1 text-sm text-[#241d0f]/75">
                      Try another spelling or Direct Connect with JW Stone for help.
                    </p>
                  </div>
                ) : null}
                {visibleStones.length > displayedStones.length ? (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInventoryVisibleLimit((current) => current + 24)}
                      className="rounded-xl bg-[var(--brand-primary)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-primary-dark)]"
                    >
                      Show 24 more
                    </button>
                    <p className="text-xs text-[#241d0f]/75">
                      Showing {displayedStones.length} of {visibleStones.length}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-10">
                {profileSlug === "jw-stone" ? (
                  <div>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <h3 className="text-lg font-bold text-[var(--brand-primary)]">
                        JW Stone Picks
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveCategorySlug("jw-picks")}
                        className="text-sm font-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className={SCROLL_ROW}>
                      {allInventoryStones
                        .filter((stone) => JW_STONE_PICK_SLUGS.has(stone.slug))
                        .map((stone, stoneIndex) =>
                          renderStoneCard(stone, stoneIndex, SCROLL_CARD)
                        )}
                    </div>
                  </div>
                ) : null}
                {inventoryCatalog.map((category) => (
                  <div key={category.categorySlug}>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <h3 className="text-lg font-bold text-[var(--brand-primary)]">
                        {category.category}
                      </h3>
                      {category.stones.length > 12 ? (
                        <button
                          type="button"
                          onClick={() => setActiveCategorySlug(category.categorySlug)}
                          className="text-sm font-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline"
                        >
                          View all ({category.stones.length})
                        </button>
                      ) : null}
                    </div>
                    <div className={SCROLL_ROW}>
                      {category.stones
                        .slice(0, 12)
                        .map((stone, stoneIndex) =>
                          renderStoneCard(stone, stoneIndex, SCROLL_CARD)
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : inventoryItems.length > 0 ? (
        <section id="collection" className="scroll-mt-28 py-10 md:py-14">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  className={`mb-1 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                >
                  Live Stone Collection
                </h2>
                <p className="text-sm text-[#241d0f]/70">
                  Direct sourcing, hands-on quality control, material by material.
                </p>
              </div>
            </div>
            <div className={SCROLL_ROW}>
              {inventoryItems.map((item, i) => (
                <div
                  key={i}
                  className={`${SCROLL_CARD} rounded-xl border-2 border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] p-6 shadow-sm`}
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-secondary)]/15">
                    <Package className="h-6 w-6 text-[var(--brand-secondary)]" />
                  </div>
                  <p className="font-semibold text-[#241d0f]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Stone gallery lightbox */}
      {openStone ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6"
          onClick={() => setOpenStone(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#0f0d09]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <h3 className={`text-lg font-bold text-white sm:text-xl ${DISPLAY_FONT}`}>
                  {openStone.name}
                </h3>
                <p className="mt-1 text-xs text-white/60">
                  {openStone.finishes?.length
                    ? `Finish: ${openStone.finishes.join(" · ")}`
                    : "Finish not confirmed — ask JW Stone"}
                </p>
                {openStone.slabCounts?.length ? (
                  <p className="mt-1 text-xs font-semibold text-white/80">
                    {openStone.slabCounts.length === 1
                      ? `${openStone.slabCounts[0]} slabs in source inventory`
                      : `Source bundle counts: ${openStone.slabCounts.join(", ")} slabs`}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setOpenStone(null)}
                aria-label="Close gallery"
                className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex-1 bg-black">
              <img
                src={openStone.images[openImageIndex]}
                alt={`${openStone.name} ${openImageIndex + 1}`}
                className="max-h-[55vh] w-full object-contain"
              />
              {openStone.images.length > 1 ? (
                <>
                  <button
                    onClick={() =>
                      setOpenImageIndex(
                        (openImageIndex - 1 + openStone.images.length) % openStone.images.length
                      )
                    }
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </button>
                  <button
                    onClick={() =>
                      setOpenImageIndex((openImageIndex + 1) % openStone.images.length)
                    }
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                    {openImageIndex + 1} / {openStone.images.length}
                  </span>
                </>
              ) : null}
            </div>

            {openStone.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto px-5 py-3">
                {openStone.images.map((url, index) => (
                  <button
                    key={url}
                    onClick={() => setOpenImageIndex(index)}
                    className={`h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                      index === openImageIndex
                        ? "border-[var(--brand-accent)]"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    aria-label={`View photo ${index + 1}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex justify-center px-5 pb-5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const stoneName = openStone.name;
                  setOpenStone(null);
                  startDirectConnect(stoneName);
                }}
                className="rounded-full bg-[var(--brand-accent)] px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Ask about this stone
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Why us */}
      <section id="why-us" className="scroll-mt-28 bg-[var(--brand-surface)] py-10 md:py-14">
        <div className="container mx-auto px-4 md:px-6">
          <h2
            className={`mb-3 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
          >
            Why {displayName}
          </h2>
          {aboutText ? (
            <p className="mb-6 max-w-2xl whitespace-pre-wrap text-sm text-[#241d0f]/70">
              {aboutText}
            </p>
          ) : null}
          <div className={SCROLL_ROW}>
            {differentiators.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className={`${SCROLL_CARD} rounded-xl border-2 border-[var(--brand-primary)]/10 bg-white p-5 shadow-sm`}
                >
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                    <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                  </div>
                  <p className="mb-2 font-semibold text-[#241d0f]">{item.title}</p>
                  {item.body ? <p className="text-sm text-[#241d0f]/70">{item.body}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Business-story photography is sourced from JW Stone's own website.
          It is intentionally separate from the reconciled inventory catalog above. */}
      {profileSlug === "jw-stone" ? (
        <section className="bg-[#17130d] py-10 text-white md:py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-6 max-w-2xl md:mb-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
                From source to finished space
              </p>
              <h2 className={`text-3xl font-bold leading-tight text-white md:text-5xl ${DISPLAY_FONT}`}>
                Stone selected with the final room in mind.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
              {JW_STONE_STORY_IMAGES.map((image, index) => (
                <figure
                  key={image.src}
                  className={`group relative overflow-hidden rounded-2xl bg-black ${
                    index === 0 ? "sm:col-span-2" : ""
                  }`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${
                      index === 0 ? "h-64 sm:h-[28rem]" : "h-72 sm:h-80"
                    }`}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-5 pt-16">
                    <figcaption className="text-sm font-semibold text-white md:text-base">
                      {image.label}
                    </figcaption>
                  </div>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Audience paths */}
      <section id="audience" className="scroll-mt-28 py-10 md:py-14">
        <div className="container mx-auto px-4 md:px-6">
          <h2
            className={`mb-6 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
          >
            Who We Work With
          </h2>
          <div className={SCROLL_ROW}>
            {AUDIENCE_PATHS.map((path, i) => {
              const Icon = path.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => startDirectConnect()}
                  className={`${SCROLL_CARD} text-left`}
                >
                  <div className="h-full cursor-pointer rounded-xl border-2 border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] p-6 shadow-sm transition-colors hover:border-[var(--brand-accent)]/40">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                      <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                    </div>
                    <p className="mb-2 font-semibold text-[#241d0f]">{path.label}</p>
                    <p className="text-sm text-[#241d0f]/70">{path.body}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured materials */}
      {profileSlug === "jw-stone" && jwStonePicks.length > 0 ? (
        <section id="materials" className="scroll-mt-28 bg-[var(--brand-surface)] py-10 md:py-14">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2
                className={`text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
              >
                Featured Materials
              </h2>
              <a href="#collection" className="text-sm font-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline">
                View all inventory
              </a>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {jwStonePicks.map((stone, index) => (
                <article
                  key={stone.slug}
                  className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/10 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenStone(stone);
                      setOpenImageIndex(0);
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-64 overflow-hidden bg-stone-200">
                      <img
                        src={stone.images[0]}
                        alt={stone.name}
                        loading={index === 0 ? "eager" : "lazy"}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      {stone.images.length > 1 ? (
                        <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                          {stone.images.length} photos
                        </span>
                      ) : null}
                    </div>
                    <div className="px-5 pb-3 pt-4">
                      <h3 className={`text-xl font-bold !text-[#241d0f] ${DISPLAY_FONT}`}>{stone.name}</h3>
                      <p className="mt-1 text-sm !text-[#4a4238]">
                        {stone.finishes?.length ? stone.finishes.join(" · ") : "Current JW Stone inventory"}
                      </p>
                    </div>
                  </button>
                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => startDirectConnect(stone.name, "request_material")}
                      className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-primary-dark)]"
                    >
                      Ask about {stone.name}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : galleryImages.length > 0 ? (
        <section id="materials" className="scroll-mt-28 bg-[var(--brand-surface)] py-10 md:py-14">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className={`mb-6 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}>
              Featured Materials
            </h2>
            <div className={SCROLL_ROW}>
              {galleryImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${displayName} inventory ${i + 1}`}
                  className={`${SCROLL_CARD} h-64 rounded-xl object-cover shadow-md`}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {faqItems.length > 0 ? (
        <section className="py-10 md:py-14">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <h2
              className={`mb-6 text-center text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
            >
              Frequently Asked
            </h2>
            <div className="space-y-6">
              {faqItems.map((faq, i) => (
                <div key={i} className="border-b border-[var(--brand-primary)]/10 pb-6">
                  {faq.question ? (
                    <p className="mb-2 font-semibold text-[var(--brand-primary)]">{faq.question}</p>
                  ) : null}
                  {faq.answer ? <p className="text-[#241d0f]/70">{faq.answer}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Recommendations Directory */}
      {recommendationsDirectory.length > 0 ? (
        <section className="bg-[var(--brand-surface)] py-10 md:py-14">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2
                className={`text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
              >
                Recommendations Directory
              </h2>
              <div className="text-sm font-medium text-[#241d0f]/70">
                {summary.positive} positive, {summary.negative} negative ({summary.total} total)
              </div>
            </div>
            <p className="mb-8 text-sm text-[#241d0f]/75">
              Recommendations are public, moderated, and tied to verified TradeScout activity.
            </p>
            <div className="space-y-4">
              {recommendationsDirectory.slice(0, 24).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/10 bg-white p-5 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {entry.recommendationType === "positive" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-700">
                          <ThumbsUp className="h-3.5 w-3.5" />
                          Recommends
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-3 py-1 text-xs font-bold text-red-700">
                          <ThumbsDown className="h-3.5 w-3.5" />
                          Does not recommend
                        </span>
                      )}
                      {entry.projectType ? (
                        <span className="rounded-full bg-[var(--brand-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                          {entry.projectType}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[#241d0f]/75">
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleDateString()
                        : "Date unavailable"}
                    </div>
                  </div>
                  <p className="mb-3 text-sm text-[#241d0f]/80">{entry.comment}</p>
                  {entry.contractor?.slug ? (
                    <Link
                      href={
                        entry.contractor.canonicalBusinessProfileUrl ||
                        `/contractors/${encodeURIComponent(entry.contractor.slug)}`
                      }
                    >
                      <span className="text-sm font-semibold text-[var(--brand-primary)] underline underline-offset-2">
                        {entry.contractor.companyName}
                      </span>
                    </Link>
                  ) : (
                    <p className="text-xs text-[#241d0f]/75">{entry.contractor.companyName}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Contact / CTA */}
      <section id="connect" className="scroll-mt-28 bg-[var(--brand-primary)] py-12 md:py-16">
        <div className="container mx-auto px-4 text-center md:px-6">
          <h2 className={`mb-4 text-2xl font-bold text-white md:text-4xl ${DISPLAY_FONT}`}>
            Start a Direct Connect Request
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-white/80">
            Contact {displayName} to request material, match a project, or schedule a visit.
          </p>
          <div className="mx-auto mb-10 flex max-w-2xl flex-wrap items-center justify-center gap-3">
            {DIRECT_CONNECT_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => startDirectConnect(null, option.value)}
                className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 transition-colors hover:border-[var(--brand-accent)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mx-auto mb-10 flex max-w-md items-center justify-center gap-2 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[var(--brand-accent)]" />
            <span>
              The phone number appears only after you choose Call. Written requests require your
              phone number before they go directly to {displayName}.
            </span>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => startDirectConnect()}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-5 w-5" />
              Direct Connect
            </button>
            {!hasViewerSession ? (
              <Link href={preScoutSignInHref}>
                <button className="rounded-full border border-white/40 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                  Sign in
                </button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#241d0f] py-10 text-white/70">
        <div className="container mx-auto px-4 text-center text-sm md:px-6">
          <p className={`mb-2 text-lg font-bold text-white ${DISPLAY_FONT}`}>{displayName}</p>
          <p>Quarry-direct sourcing. Contact protected through TradeScout Direct Connect.</p>
        </div>
      </footer>
      <ExpressDirectConnectPanel
        open={expressPanelOpen}
        onClose={() => setExpressPanelOpen(false)}
        profileSlug={profileSlug}
        businessName={displayName}
        hasViewerSession={hasViewerSession}
        initialStoneName={expressStoneName}
        initialRequestType={expressRequestType}
      />
    </div>
  );
}
