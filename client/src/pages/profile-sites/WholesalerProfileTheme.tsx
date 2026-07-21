import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
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
  LayoutGrid,
  X,
} from "lucide-react";
import ExpressDirectConnectPanel, {
  type ExpressDirectConnectRequestType,
} from "./ExpressDirectConnectPanel";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";
import PremiumProductProfileSections from "./PremiumProductProfileSections";
import { ShareButton } from "@/components/ShareButton";
import {
  buildProfileInventoryShareSearch,
  resolveProfileInventoryItem,
} from "@shared/profileItemShare";
import {
  buildProfileGalleryShareSearch,
  listProfileGalleryItems,
} from "@shared/profileGalleryShare";
import { isPremiumProductProfileData } from "@shared/premiumProductProfile";
import {
  ISSA_BUILD_HERO_POSTER,
  ISSA_BUILD_HERO_VIDEO,
  isIssaBuildProfileSlug,
} from "@shared/issaBuildProfile";

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
  data?: Record<string, unknown>;
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
  customerName: string;
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
  // Parallel to images -- the finish shown in that specific photo, when the
  // source filename states one explicitly (a stone can be photographed in
  // more than one finish, e.g. polished and leathered side by side).
  imageFinishes?: Array<string[] | undefined>;
  slabCounts?: number[];
  materialStatus?:
    | "user_confirmed"
    | "source_folder"
    | "filename"
    | "historical_assignment"
    | "unconfirmed";
  finishes?: string[];
  finishStatus?: "explicit" | "unconfirmed";
  hideFinishDetails?: boolean;
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
  allowExpressCall: boolean;
  profileShareDestination: string;
  platformBaseHref?: string;
  sharedGallerySlug?: string | null;
  tradeScoutReturnHref: string;
  directConnectHref: string;
  preScoutCreateHref: string;
  preScoutSignInHref: string;
  recommendationsDirectory?: RecommendationEntry[];
  recommendationDirectorySummary?: RecommendationDirectorySummary;
  trustActions: ReactNode;
  profileItems?: ReactNode;
  /** When set, Featured stones uses these inventory slugs instead of random picks. */
  featuredStoneSlugs?: string[];
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

const REQUEST_EXAMPLES = [
  "Stone or material",
  "Project matching",
  "Bundle availability",
  "Showroom planning",
] as const;

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

// Fisher-Yates on a copy -- never mutates the source array, so a stone never
// moves out of the category it's actually assigned to; only the display
// order within that category changes.
function shuffleStones<T>(stones: T[]): T[] {
  const shuffled = [...stones];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Horizontal, scroll-snapped rows keep the page short and let visitors jump
// straight to what they came for instead of scrolling past every section.
const SCROLL_ROW =
  "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const SCROLL_CARD = "w-[240px] flex-shrink-0 snap-start sm:w-[260px]";

// Headings use TradeScout's own display font (Sora, already loaded
// platform-wide) rather than a customer-specific webfont -- brand color and
// imagery still carry the customer's identity, but typography stays
// TradeScout-native so the page doesn't read as a disconnected microsite.
const DISPLAY_FONT = "font-display";

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

function blockString(block: ContentBlock | undefined, key: string): string {
  const value = block?.data?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export default function WholesalerProfileTheme({
  profileSlug,
  displayName,
  headline,
  contentBlocks,
  categories,
  serviceAreas,
  brandColors,
  hasViewerSession,
  useExpressDirectConnect,
  allowExpressCall,
  profileShareDestination,
  platformBaseHref = "",
  sharedGallerySlug,
  tradeScoutReturnHref,
  directConnectHref,
  preScoutCreateHref,
  preScoutSignInHref,
  recommendationsDirectory = [],
  recommendationDirectorySummary,
  trustActions,
  profileItems,
  featuredStoneSlugs = [],
}: WholesalerProfileThemeProps) {
  const [, navigate] = useLocation();
  const isJwStone = profileSlug === "jw-stone";
  const isIssaBuild = isIssaBuildProfileSlug(profileSlug);
  const heroVideo = isIssaBuild
    ? { src: ISSA_BUILD_HERO_VIDEO, poster: ISSA_BUILD_HERO_POSTER }
    : isJwStone
      ? {
          src: "/images/businesses/jw-stone/video/hero.mp4",
          poster: "/images/businesses/jw-stone/video/hero-poster.jpg",
        }
      : null;
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [heroVideoZoomed, setHeroVideoZoomed] = useState(false);
  useEffect(() => {
    if (!heroVideo) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let zoomTimer: number | null = null;
    const syncMotionPreference = () => {
      const reduceMotion = motionQuery.matches;
      setPrefersReducedMotion(reduceMotion);
      if (zoomTimer !== null) window.clearTimeout(zoomTimer);
      if (reduceMotion) {
        setHeroVideoZoomed(false);
        heroVideoRef.current?.pause();
      } else {
        zoomTimer = window.setTimeout(() => setHeroVideoZoomed(true), 100);
        void heroVideoRef.current?.play().catch(() => undefined);
      }
    };
    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);
    return () => {
      if (zoomTimer !== null) window.clearTimeout(zoomTimer);
      motionQuery.removeEventListener("change", syncMotionPreference);
    };
  }, [heroVideo?.src]);

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
  const heroBlock = findBlock(contentBlocks, "hero");
  const servicesBlock = findBlock(contentBlocks, "services");
  const faqBlock = findBlock(contentBlocks, "faq");
  const trustBlock = findBlock(contentBlocks, "trust");
  const differentiatorsBlock = findBlock(contentBlocks, "differentiators");
  const audienceBlock = findBlock(contentBlocks, "audience");
  const inventoryCatalogBlock = findBlock(contentBlocks, "inventoryCatalog");
  const ctaBlock = findBlock(contentBlocks, "cta");
  const premiumProductBlock = findBlock(contentBlocks, "premiumProduct");

  const aboutText = blockText(aboutBlock);
  const inventoryItems = blockItems(servicesBlock);
  const galleryItems = listProfileGalleryItems(contentBlocks);
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
  const audienceItems: Array<{ title?: string; body?: string }> = Array.isArray(
    audienceBlock?.data?.items
  )
    ? audienceBlock.data.items
    : [];
  const audiencePaths =
    audienceItems.length > 0
      ? audienceItems.map((item, index) => ({
          icon: AUDIENCE_PATHS[index % AUDIENCE_PATHS.length].icon,
          label: item.title || AUDIENCE_PATHS[index % AUDIENCE_PATHS.length].label,
          body: item.body || "",
        }))
      : AUDIENCE_PATHS;
  // Real, named inventory grouped by material category -- no pricing here by
  // design; priced/featured stones are a separate, later concern.
  const inventoryCatalogFromContent: InventoryCategory[] = Array.isArray(
    inventoryCatalogBlock?.data?.categories
  )
    ? inventoryCatalogBlock.data.categories
    : [];
  // Shuffled once per profile visit (not on every render), so a returning
  // visitor sees a different order at the top of each category without
  // scrolling -- stones never move out of the category they belong to.
  const inventoryCatalog = useMemo(
    () =>
      inventoryCatalogFromContent.map((category) => ({
        ...category,
        stones: shuffleStones(category.stones),
      })),
    [inventoryCatalogBlock]
  );
  const [activeCategorySlug, setActiveCategorySlug] = useState("all");
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryVisibleLimit, setInventoryVisibleLimit] = useState(24);
  const pendingInventoryScrollRef = useRef(false);
  const [openStone, setOpenStone] = useState<InventoryStone | null>(null);
  const [openImageIndex, setOpenImageIndex] = useState(0);
  const [lightboxImageFailed, setLightboxImageFailed] = useState(false);
  const triedLightboxIndexesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    triedLightboxIndexesRef.current = new Set();
    setLightboxImageFailed(false);
  }, [openStone]);
  useEffect(() => {
    if (!openStone) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenStone(null);
      if (event.key === "ArrowLeft" && openStone.images.length > 1) {
        setOpenImageIndex(
          (current) => (current - 1 + openStone.images.length) % openStone.images.length
        );
      }
      if (event.key === "ArrowRight" && openStone.images.length > 1) {
        setOpenImageIndex((current) => (current + 1) % openStone.images.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openStone]);
  const [expressPanelOpen, setExpressPanelOpen] = useState(false);
  const [expressStoneName, setExpressStoneName] = useState<string | null>(null);
  const [expressRequestType, setExpressRequestType] =
    useState<ExpressDirectConnectRequestType | null>(null);
  const normalizedInventorySearch = inventorySearch.trim().toLowerCase();
  const allInventoryStones = inventoryCatalog.flatMap((category) => category.stones);
  const premiumProductData = isPremiumProductProfileData(premiumProductBlock?.data)
    ? premiumProductBlock.data
    : null;
  const premiumProduct =
    premiumProductData && allInventoryStones.length === 1 ? allInventoryStones[0] : null;
  // Opens a shared inventory-item link directly to that stone's lightbox
  // instead of just the profile root -- see ShareButton in the lightbox below.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedItem = resolveProfileInventoryItem(
      inventoryCatalog,
      params.get("stone"),
      params.get("photo")
    );
    if (!sharedItem) return;
    const match = allInventoryStones.find((stone) => stone.slug === sharedItem.slug);
    if (!match) return;
    setOpenStone(match);
    setOpenImageIndex(sharedItem.imageIndex);
  }, []);
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
  const stoneCategoryBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of inventoryCatalog) {
      for (const stone of category.stones) {
        map.set(stone.slug, category.category);
      }
    }
    return map;
  }, [inventoryCatalog]);
  // Curated featured picks win when the owner/admin saved featuredStoneSlugs.
  // Otherwise JW Stone keeps random 3 picks per visit.
  const featuredStones = useMemo(() => {
    if (profileSlug !== "jw-stone" && featuredStoneSlugs.length === 0) return [];
    const allStones = inventoryCatalog.flatMap((category) => category.stones);
    const bySlug = new Map(allStones.map((stone) => [stone.slug, stone]));
    const curated = featuredStoneSlugs
      .map((slug) => bySlug.get(slug))
      .filter((stone): stone is (typeof allStones)[number] => Boolean(stone))
      .slice(0, 3)
      .map((stone) => ({
        slug: stone.slug,
        stone,
        material: stoneCategoryBySlug.get(stone.slug) || "",
        finish: stone.finishes?.[0],
      }));
    if (curated.length > 0) return curated;
    if (profileSlug !== "jw-stone") return [];
    return shuffleStones(allStones)
      .slice(0, 3)
      .map((stone) => ({
        slug: stone.slug,
        stone,
        material: stoneCategoryBySlug.get(stone.slug) || "",
        finish: stone.finishes?.[0],
      }));
  }, [profileSlug, inventoryCatalog, stoneCategoryBySlug, featuredStoneSlugs]);
  const hasInventoryFilters = activeCategorySlug !== "all" || normalizedInventorySearch.length > 0;
  useEffect(() => {
    setInventoryVisibleLimit(24);
  }, [activeCategorySlug, normalizedInventorySearch]);
  const amazonicGreenHeroImage = inventoryCatalog
    .flatMap((category) => category.stones)
    .find((stone) => stone.slug === "amazonic-green")?.images[0];
  // Index 1 specifically -- the warehouse shot (steel racking, skylights),
  // not index 0 which is the outdoor stone-yard shot.
  const rhinoWhiteWarehouseCtaImage = allInventoryStones.find(
    (stone) => stone.slug === "rhino-white"
  )?.images[1];
  const heroImage =
    (profileSlug === "jw-stone" ? amazonicGreenHeroImage : undefined) ||
    inventoryCatalog.flatMap((c) => c.stones).flatMap((s) => s.images)[0] ||
    galleryItems[0]?.imageUrl;
  const heroEyebrow =
    profileSlug === "jw-stone"
      ? "Amazonic Green · current inventory"
      : blockString(heroBlock, "eyebrow") || categories.slice(0, 3).join(" · ");
  const heroHeadline =
    profileSlug === "jw-stone"
      ? "Natural stone, selected at the source."
      : headline || "Hand-selected stone. Direct from the source.";
  // The hero is a glance, not a read -- keep it to one sentence and let the
  // "Why Us" section carry the fuller story for anyone who scrolls that far.
  const heroTeaser =
    profileSlug === "jw-stone"
      ? "Search the full collection or ask JW Stone about your project."
      : blockString(heroBlock, "teaser") || aboutText.split(/(?<=[.!?])\s+/)[0] || aboutText;
  const headerLabel =
    blockString(heroBlock, "headerLabel") || categories.slice(0, 2).join(" · ") || "Natural stone";
  const inventoryTitle =
    blockString(inventoryCatalogBlock, "title") ||
    (isJwStone ? "Current Inventory" : "Explore the collection");
  const inventoryDescription =
    blockString(inventoryCatalogBlock, "description") ||
    "Open any material to see the available photos or start a private request.";
  const audienceTitle = blockString(audienceBlock, "title") || "Who We Work With";
  const ctaHeading =
    blockString(ctaBlock, "heading") ||
    (isJwStone ? "Tell JW Stone what you need" : `Tell ${displayName} what you need`);
  const ctaDescription =
    blockString(ctaBlock, "description") ||
    "Ask about the material, match it to a project, or plan the next step.";
  const contactOperatorName = blockString(ctaBlock, "contactOperatorName");
  const contactOperatorRole = blockString(ctaBlock, "contactOperatorRole");
  const footerText =
    blockString(ctaBlock, "footerText") ||
    (isJwStone
      ? "Quarry-direct sourcing. Your contact details stay private until you choose to connect."
      : "Explore the material, then use Direct Connect when you are ready. Your contact details stay private until the recipient accepts your request.");
  const configuredRequestExamples = Array.isArray(ctaBlock?.data?.requestExamples)
    ? ctaBlock.data.requestExamples.filter(
        (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
      )
    : [];
  const requestExamples = configuredRequestExamples.length
    ? configuredRequestExamples
    : REQUEST_EXAMPLES;

  // Primary profile information and actions must be available immediately;
  // the background video may still provide motion when the visitor permits it.
  const heroReveal = (_stage: number) =>
    isJwStone ? "translate-y-0 opacity-100 transition-all duration-700 ease-out" : "";

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

  const scrollToInventoryBrowser = () => {
    window.requestAnimationFrame(() => {
      document
        .getElementById("inventory-browser")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openFullInventory = () => {
    setActiveCategorySlug("all");
    setInventorySearch("");
    if (inventoryExpanded) {
      scrollToInventoryBrowser();
      return;
    }
    pendingInventoryScrollRef.current = true;
    setInventoryExpanded(true);
  };

  useEffect(() => {
    if (!inventoryExpanded || !pendingInventoryScrollRef.current) return;
    pendingInventoryScrollRef.current = false;
    scrollToInventoryBrowser();
  }, [inventoryExpanded]);

  // Nothing to go "back" from at the top-level home state -- the back
  // button would just no-op scroll to top. Only meaningful once the
  // visitor has actually drilled into something.
  const isProfileHome = !expressPanelOpen && !openStone && !inventoryExpanded;

  const goBackWithinProfile = () => {
    if (expressPanelOpen) {
      setExpressPanelOpen(false);
      return;
    }
    if (openStone) {
      setOpenStone(null);
      return;
    }
    if (inventoryExpanded) {
      setInventoryExpanded(false);
      setActiveCategorySlug("all");
      setInventorySearch("");
      setInventoryVisibleLimit(24);
      window.requestAnimationFrame(() => {
        document
          .getElementById("collection")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // A handful of source files are truncated mid-upload (correct WebP header
  // and dimensions, but the compressed frame data cuts off) -- the browser
  // reports them as loaded successfully, so onError never fires. Sampling a
  // downscaled draw catches the "decoded to solid black" case those produce.
  const isDecodedFrameBlack = (img: HTMLImageElement): boolean => {
    try {
      const w = 24;
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w) || 24);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
      return sum / (data.length / 4) < 4;
    } catch {
      return false;
    }
  };

  // Falls through the material's other photos before giving up. JW Stone has
  // an approved fallback mark; other profiles must never inherit that brand.
  const advanceStoneImage = (img: HTMLImageElement, stone: InventoryStone) => {
    const nextIndex = Number(img.dataset.fallbackIndex || "0") + 1;
    if (nextIndex < stone.images.length) {
      img.dataset.fallbackIndex = String(nextIndex);
      img.src = stone.images[nextIndex];
      return;
    }
    img.onerror = null;
    if (isJwStone) {
      img.src = "/images/businesses/jw-stone/logo.svg";
      img.className =
        "h-full w-full bg-stone-200 object-contain p-10 opacity-40 transition-transform duration-300 group-hover:scale-105";
      return;
    }
    img.removeAttribute("src");
    img.alt = `${stone.name} photo temporarily unavailable`;
    img.style.visibility = "hidden";
  };

  const handleStoneImageError =
    (stone: InventoryStone) => (event: SyntheticEvent<HTMLImageElement>) => {
      advanceStoneImage(event.currentTarget, stone);
    };

  const handleStoneImageLoad =
    (stone: InventoryStone) => (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      if (isDecodedFrameBlack(img)) {
        advanceStoneImage(img, stone);
      }
    };

  const renderStoneCard = (
    stone: InventoryStone,
    priority: "high" | "eager" | "lazy",
    wrapperClassName: string
  ) => (
    <article
      key={stone.slug}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-[#241d0f]/15 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/60 hover:shadow-lg ${wrapperClassName}`}
      data-testid={isJwStone ? "jw-stone-inventory-card" : "profile-inventory-card"}
    >
      <div className="relative h-52 overflow-hidden bg-stone-200">
        <button
          type="button"
          onClick={() => {
            setOpenStone(stone);
            setOpenImageIndex(0);
          }}
          className="block h-full w-full text-left"
          aria-label={`View details for ${stone.name}`}
        >
          {stone.images[0] ? (
            <img
              src={stone.images[0]}
              alt={stone.name}
              loading={priority === "lazy" ? "lazy" : "eager"}
              fetchPriority={priority === "high" ? "high" : "auto"}
              data-fallback-index="0"
              onError={handleStoneImageError(stone)}
              onLoad={handleStoneImageLoad(stone)}
              className="h-full w-full bg-stone-200 object-contain p-1 transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-5 text-sm font-semibold text-stone-600">
              Photo coming soon
            </span>
          )}
        </button>
        <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/35 bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {stone.materialStatus === "unconfirmed" ? "Material to confirm" : "Current collection"}
        </span>
        <ShareButton
          destination={`${profileShareDestination}${buildProfileInventoryShareSearch(stone.slug)}`}
          title={stone.name}
          text={`${stone.name} from ${displayName}`}
          size="icon"
          label=""
          className="absolute right-3 top-3 rounded-full border-white/25 bg-black/70 text-white hover:bg-black"
        />
        {stone.images.length > 1 ? (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
            {stone.images.length} photos
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-base font-extrabold !text-[#241d0f]">{stone.name}</p>
        {stone.slabCounts?.length ? (
          <p className="mt-1 text-sm font-bold text-[var(--brand-primary)]">
            {stone.slabCounts.length === 1
              ? `${stone.slabCounts[0]} slabs`
              : `Bundle counts: ${stone.slabCounts.join(", ")} slabs`}
          </p>
        ) : null}
        {!stone.hideFinishDetails ? (
          <p className="mt-1 text-xs font-medium !text-[#4a4238]">
            {stone.finishes?.length
              ? stone.finishes.join(" · ")
              : `Finish details: ask ${displayName}`}
          </p>
        ) : null}
        {stone.materialStatus === "unconfirmed" ? (
          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
            Details being confirmed
          </span>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setOpenStone(stone);
              setOpenImageIndex(0);
            }}
            className="min-h-10 rounded-xl border border-[var(--brand-primary)]/20 px-3 text-xs font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/5"
          >
            View details
          </button>
          <button
            type="button"
            onClick={() => startDirectConnect(stone.name, "request_material")}
            className="min-h-10 rounded-xl border border-[var(--brand-accent)]/40 px-3 text-xs font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10"
          >
            Ask about {stone.name}
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div
      className={`wholesaler-public-profile flex min-h-full flex-col bg-[var(--brand-bg)] !text-stone-900 ${
        isJwStone ? "pt-14 sm:pt-[96px] md:pt-[112px]" : ""
      }`}
      // eslint-disable-next-line no-restricted-syntax -- sets CSS custom properties for per-business dynamic brand colors, not literal color values
      style={themeVars}
    >
      <header
        className={`${
          isJwStone ? "fixed inset-x-0 top-0 z-40 shadow-md" : "sticky top-0 z-20 shadow-sm"
        } border-b border-[var(--brand-primary)]/10 bg-[var(--brand-bg)]`}
      >
        <div
          className={`container mx-auto items-center px-3 md:px-8 ${
            isJwStone
              ? "grid h-14 grid-cols-[44px_1fr_auto] gap-1 md:h-[72px] md:grid-cols-[1fr_auto_1fr]"
              : "flex justify-between gap-3 py-2 md:py-3"
          }`}
        >
          {isJwStone ? (
            <>
              {isProfileHome ? (
                <span className="inline-flex h-10 w-10 justify-self-start" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={goBackWithinProfile}
                  aria-label="Back within JW Stone"
                  title="Back within JW Stone"
                  className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-full border border-[var(--brand-primary)]/15 text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-surface)]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setExpressPanelOpen(false);
                  setOpenStone(null);
                  setInventoryExpanded(false);
                  setActiveCategorySlug("all");
                  setInventorySearch("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center justify-center"
                aria-label="JW Stone home"
              >
                <img
                  src="/images/businesses/jw-stone/logo.svg"
                  alt="JW Stone — Premium Wholesale Stone Distributor"
                  className="h-auto w-[132px] sm:w-[164px] md:w-[204px]"
                />
              </button>
              <div className="flex items-center justify-self-end gap-2">
                <ShareButton
                  destination={profileShareDestination}
                  title={displayName}
                  text={`Check out ${displayName}`}
                  size="icon"
                  label=""
                  className="rounded-full border-[var(--brand-primary)]/15 bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-surface)]"
                />
                <button
                  type="button"
                  onClick={() => startDirectConnect()}
                  aria-label="Direct Connect with JW Stone"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-ts-orange/45 bg-ts-orange/5 text-ts-orange shadow-sm transition-colors hover:bg-ts-orange/10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2.5 md:px-5 md:text-sm"
                >
                  <MessageCircle className="h-4 w-4 sm:hidden" />
                  <span className="hidden text-xs font-bold sm:inline md:text-sm">
                    Direct Connect
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-lg font-bold leading-tight text-[var(--brand-primary)] md:text-xl ${DISPLAY_FONT}`}
                >
                  {displayName}
                </span>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-secondary)]">
                  {headerLabel}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <ShareButton
                  destination={profileShareDestination}
                  title={displayName}
                  text={`Check out ${displayName} on TradeScout`}
                  size="icon"
                  label=""
                  className="rounded-full border-[var(--brand-primary)]/15 bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-surface)]"
                />
                <button
                  type="button"
                  onClick={() => startDirectConnect()}
                  className="flex-shrink-0 rounded-full border border-ts-orange/45 bg-transparent px-3.5 py-2 text-xs font-bold text-ts-orange shadow-sm transition-colors hover:bg-ts-orange/10 md:px-5 md:text-sm"
                >
                  Direct Connect
                </button>
              </div>
            </>
          )}
        </div>
        <nav
          className={`scrollbar-hide items-center overflow-x-auto uppercase tracking-wide text-[#241d0f] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            isJwStone
              ? "hidden h-10 gap-4 px-3 pb-2 text-[11px] font-bold sm:flex md:gap-5 md:px-8 md:text-xs"
              : "hidden gap-5 px-5 pb-2 text-xs font-semibold md:flex md:px-8"
          }`}
        >
          {profileSlug === "jw-stone" && allInventoryStones.length > 0 ? (
            <button
              type="button"
              onClick={openFullInventory}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-[#16200b] shadow-sm"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Browse full inventory
            </button>
          ) : null}
          {(premiumProductData
            ? [
                ["Day + glow", "why-us"],
                ["Ideas", "audience"],
                ["Photos", "collection"],
                ["Connect", "connect"],
              ]
            : [
                ["Why Us", "why-us"],
                ["Who We Serve", "audience"],
                ["Materials", "materials"],
                ["Connect", "connect"],
              ]
          ).map(([label, sectionId]) => (
            <button
              key={sectionId}
              type="button"
              onClick={() =>
                document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" })
              }
              className="flex-shrink-0 whitespace-nowrap transition-colors hover:text-[var(--brand-accent)]"
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Hero */}
      <section
        className={`relative isolate flex items-end overflow-hidden py-8 md:items-center md:py-20 ${
          isJwStone || isIssaBuild
            ? "min-h-[460px] bg-transparent md:min-h-[600px]"
            : "min-h-[min(690px,calc(100svh-150px))] bg-[var(--brand-primary)] bg-cover bg-center md:min-h-[500px]"
        }`}
      >
        {!heroVideo && heroImage ? (
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-center ${
              isJwStone || isIssaBuild ? "bg-transparent" : "bg-stone-950"
            } ${premiumProductData ? "object-contain" : "object-cover"}`}
          />
        ) : null}
        {heroVideo ? (
          <video
            ref={heroVideoRef}
            autoPlay={!prefersReducedMotion}
            muted
            loop
            playsInline
            poster={heroVideo.poster}
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[5500ms] ease-out ${
              heroVideoZoomed ? "scale-100 md:scale-[1.12]" : "scale-100"
            }`}
          >
            <source src={heroVideo.src} type="video/mp4" />
          </video>
        ) : null}
        {/* No full-bleed wash on JW Stone / ISSA Build — stone/video stays true. */}
        {!isJwStone && !isIssaBuild ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,14,8,0.22)_0%,rgba(20,14,8,0.54)_42%,rgba(20,14,8,0.96)_100%)] md:bg-[linear-gradient(90deg,rgba(20,14,8,0.82)_0%,rgba(20,14,8,0.5)_55%,rgba(20,14,8,0.26)_100%)]"
          />
        ) : null}
        <div
          className={`relative z-10 container mx-auto px-5 text-left ${
            isJwStone || isIssaBuild ? "md:px-8" : "md:px-6 md:text-center"
          }`}
        >
          {heroEyebrow ? (
            <span
              className={`mb-3 inline-block rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white md:mb-6 md:px-4 md:text-xs ${
                isJwStone || isIssaBuild
                  ? "border-white/40 bg-black/35"
                  : "border-white/25 bg-black/25 backdrop-blur-sm"
              } ${heroReveal(1)}`}
            >
              {heroEyebrow}
            </span>
          ) : null}
          <h1
            className={`mb-3 max-w-[18ch] font-bold text-white md:mb-6 md:max-w-3xl md:text-6xl md:leading-tight ${
              isJwStone || isIssaBuild
                ? "text-[2.2rem] leading-[1.02] [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] md:text-[2.7rem] md:leading-[0.96]"
                : "text-[2.55rem] leading-[0.98] [text-shadow:0_2px_18px_rgba(0,0,0,0.5)] md:mx-auto"
            } ${DISPLAY_FONT} ${heroReveal(2)}`}
          >
            {heroHeadline}
          </h1>
          {heroTeaser ? (
            <p
              className={`mb-5 max-w-[34rem] text-sm leading-relaxed text-white md:mb-10 md:text-lg ${
                isJwStone || isIssaBuild
                  ? "font-medium [text-shadow:0_1px_6px_rgba(0,0,0,0.55)] md:text-base"
                  : "text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.65)] md:mx-auto"
              } ${heroReveal(3)}`}
            >
              {heroTeaser}
            </p>
          ) : null}
          <div
            className={`flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-3 ${
              isJwStone || isIssaBuild ? "max-w-[38rem]" : "md:justify-center"
            } ${heroReveal(4)}`}
          >
            {profileSlug === "jw-stone" && allInventoryStones.length > 0 ? (
              <button
                type="button"
                onClick={openFullInventory}
                className="group flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-accent)] bg-[var(--brand-bg)]/92 px-6 py-3 text-sm font-extrabold text-[var(--brand-accent)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-bg)] md:min-h-14 md:rounded-full md:py-3.5"
              >
                Browse full inventory
                <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })
                }
                className="flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-accent)] bg-white/12 px-7 py-3.5 text-sm font-extrabold text-[var(--brand-accent)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                {premiumProductData ? "See the material" : "Explore Inventory"}
              </button>
            )}
            <button
              type="button"
              onClick={() => startDirectConnect()}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-ts-orange px-6 py-3 text-sm font-extrabold transition-colors md:min-h-14 md:rounded-full md:py-3.5 ${
                isJwStone || isIssaBuild
                  ? "bg-[var(--brand-bg)]/92 text-ts-orange shadow-sm hover:bg-[var(--brand-bg)]"
                  : "bg-white/12 text-ts-orange-light backdrop-blur-xl hover:bg-white/20"
              }`}
            >
              Direct Connect
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section
        className="border-b border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] py-5"
        aria-label="Trust and profile actions"
        data-testid="profile-trust-section"
      >
        <div className="container mx-auto max-w-3xl px-4 md:px-6">{trustActions}</div>
      </section>

      {premiumProductData && premiumProduct ? (
        <PremiumProductProfileSections
          profileSlug={profileSlug}
          profileName={displayName}
          product={premiumProduct}
          data={premiumProductData}
          trustFacts={trustFacts}
          faqItems={faqItems}
          profileShareDestination={profileShareDestination}
          platformBaseHref={platformBaseHref}
          onDirectConnect={(productName) =>
            startDirectConnect(productName || premiumProduct.name, "request_material")
          }
        />
      ) : (
        <>
          {/* Company info strip -- confirmed facts only, sourced from the "trust" content block */}
          {trustFacts.length > 0 || serviceAreas.length > 0 ? (
            <section className="border-b border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] py-5">
              <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 text-sm font-semibold !text-stone-900 md:px-6">
                {trustFacts.map((fact, i) => (
                  <span key={i} className="inline-flex items-center">
                    {i > 0 ? (
                      <span className="mx-3 text-[var(--brand-primary)]/25" aria-hidden="true">
                        &bull;
                      </span>
                    ) : null}
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
            <section
              id="collection"
              className={`scroll-mt-28 bg-[var(--brand-bg)] ${
                isJwStone ? "border-t border-[#241d0f]/10 pt-10 md:pt-14" : "py-8 md:py-11"
              }`}
            >
              <div className="container mx-auto px-4 md:px-6">
                {featuredStones.length > 0 ? (
                  <div className={inventoryExpanded ? "mb-11" : "mb-0"}>
                    <div className="mb-5 max-w-2xl">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--brand-accent)] md:text-xs">
                        Featured stones
                      </p>
                      <h2
                        className={`mt-1.5 text-[1.7rem] font-extrabold leading-tight text-[var(--brand-primary)] md:text-4xl ${DISPLAY_FONT}`}
                      >
                        Stone worth building around.
                      </h2>
                      <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed !text-[#4a4238] md:text-base">
                        Three picks from the current collection -- reload to see more.
                      </p>
                    </div>
                    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
                      {featuredStones.map((offer, offerIndex) => {
                        const stone = offer.stone;
                        if (!stone) return null;
                        return (
                          <article
                            key={offer.slug}
                            className="group flex w-[82vw] max-w-[320px] flex-none snap-start flex-col overflow-hidden rounded-xl border border-[#241d0f]/15 bg-white text-left shadow-[0_10px_30px_rgba(36,29,15,0.08)] transition duration-300 hover:-translate-y-1 hover:border-[var(--brand-accent)]/55 hover:shadow-[0_18px_40px_rgba(36,29,15,0.14)] sm:w-auto sm:max-w-none sm:rounded-2xl"
                            data-testid="jw-stone-featured-product-card"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e5dc]">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenStone(stone);
                                  setOpenImageIndex(0);
                                }}
                                className="block h-full w-full"
                                aria-label={`View details for ${stone.name}`}
                              >
                                <img
                                  src={stone.images[0]}
                                  alt={stone.name}
                                  data-fallback-index="0"
                                  onError={handleStoneImageError(stone)}
                                  onLoad={handleStoneImageLoad(stone)}
                                  className="h-full w-full bg-[#e9e5dc] object-contain p-1 transition-transform duration-500 group-hover:scale-[1.02]"
                                />
                              </button>
                              {stone.images.length > 1 ? (
                                <span className="absolute left-2 top-2 inline-flex items-center rounded-full border border-white/40 bg-black/55 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm sm:left-3 sm:top-3 sm:px-2.5 sm:text-[9px]">
                                  {stone.images.length} photos
                                </span>
                              ) : null}
                              <ShareButton
                                destination={`${profileShareDestination}${buildProfileInventoryShareSearch(stone.slug)}`}
                                title={stone.name}
                                text={`${stone.name} at JW Stone`}
                                size="icon"
                                label=""
                                className="absolute right-2 top-2 rounded-full border-white/25 bg-black/70 text-white hover:bg-black sm:right-3 sm:top-3"
                              />
                              <span className="pointer-events-none absolute bottom-2 right-2 text-[9px] font-bold tracking-[0.14em] text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.85)] sm:bottom-3 sm:right-3 sm:text-[10px]">
                                0{offerIndex + 1}
                              </span>
                            </div>
                            <div className="flex flex-1 flex-col p-2.5 sm:p-4">
                              <p className="truncate text-xs font-extrabold !text-[#241d0f] sm:text-base">
                                {stone.name}
                              </p>
                              <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)] sm:text-xs">
                                {offer.material}
                                {offer.finish ? ` · ${offer.finish}` : ""}
                              </p>
                              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#241d0f]/10 pt-3 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenStone(stone);
                                    setOpenImageIndex(0);
                                  }}
                                  className="min-h-10 rounded-xl border border-[var(--brand-primary)]/20 px-2 text-[10px] font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/5 sm:text-xs"
                                >
                                  View details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startDirectConnect(stone.name, "request_material")}
                                  className="min-h-10 rounded-xl border border-[var(--brand-accent)]/40 px-2 text-[10px] font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10 sm:text-xs"
                                >
                                  Ask about {stone.name}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {!inventoryExpanded ? (
                  isJwStone ? (
                    <div className="-mx-4 mt-0 md:-mx-6">
                      <button
                        type="button"
                        onClick={openFullInventory}
                        className="group relative flex min-h-[320px] w-full items-center justify-center overflow-hidden bg-[var(--brand-primary-dark)] px-7 py-10 text-center text-white sm:min-h-[340px] sm:px-10"
                      >
                        {rhinoWhiteWarehouseCtaImage ? (
                          <img
                            src={rhinoWhiteWarehouseCtaImage}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.025]"
                          />
                        ) : null}
                        <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,15,18,0.66)_0%,rgba(7,15,18,0.48)_58%,rgba(7,15,18,0.24)_100%)]" />
                        <span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-accent)]" />
                        <span className="relative z-10 flex min-w-0 max-w-[34rem] flex-col items-center">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-accent)] sm:text-xs">
                            Rhino White · current inventory
                          </span>
                          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md transition-colors group-hover:bg-white/20">
                            Browse full inventory
                            <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="mx-auto mb-6 max-w-2xl text-center">
                        <h2
                          className={`text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                        >
                          {inventoryTitle}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed !text-[#4a4238] md:text-base">
                          {inventoryDescription}
                        </p>
                      </div>
                      {allInventoryStones.length === 1 ? (
                        <div className="mx-auto max-w-xl">
                          {renderStoneCard(allInventoryStones[0], "high", "")}
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={openFullInventory}
                            className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--brand-primary)] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[var(--brand-primary)]/25 transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-primary-dark)]"
                          >
                            <LayoutGrid className="h-5 w-5 flex-shrink-0" />
                            Explore the collection
                            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm">
                              {allInventoryStones.length}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div id="inventory-browser" className="scroll-mt-28 pb-10 md:pb-14">
                    <div className="mb-6">
                      <h2
                        className={`mb-1 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                      >
                        {inventoryTitle}
                      </h2>
                      <p className="text-sm !text-[#4a4238]">{inventoryDescription}</p>
                    </div>

                    <div className="mb-6 rounded-2xl border border-[#241d0f]/15 bg-white p-3 shadow-sm md:p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-center">
                        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-4 focus-within:border-[var(--brand-primary)]/50">
                          <Search className="h-4 w-4 flex-shrink-0 text-[var(--brand-primary)]/60" />
                          <span className="sr-only">Search {displayName} inventory</span>
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
                              <option value="jw-picks">
                                JW Stone Picks ({JW_STONE_PICK_SLUGS.size})
                              </option>
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
                          {visibleStones.length} {visibleStones.length === 1 ? "stone" : "stones"}{" "}
                          shown
                        </p>
                      ) : null}
                    </div>

                    {hasInventoryFilters ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {displayedStones.map((stone, stoneIndex) =>
                            renderStoneCard(
                              stone,
                              stoneIndex < 4 ? "high" : stoneIndex < 8 ? "eager" : "lazy",
                              ""
                            )
                          )}
                        </div>
                        {visibleStones.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--brand-primary)]/20 bg-[var(--brand-surface)] px-5 py-10 text-center">
                            <p className="font-semibold text-[#241d0f]">
                              {normalizedInventorySearch
                                ? `No match for “${inventorySearch.trim()}”`
                                : "No matching stone name"}
                            </p>
                            <p className="mt-1 text-sm text-[#241d0f]/75">
                              {profileSlug === "jw-stone" && normalizedInventorySearch
                                ? "JW Stone may be able to source it for your project."
                                : `Try another spelling or send ${displayName} a request for help.`}
                            </p>
                            {profileSlug === "jw-stone" && normalizedInventorySearch ? (
                              <button
                                type="button"
                                onClick={() =>
                                  startDirectConnect(inventorySearch.trim(), "request_material")
                                }
                                className="mt-5 rounded-full border border-[var(--brand-accent)]/40 px-6 py-3 text-sm font-extrabold text-[var(--brand-accent)] transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/10"
                              >
                                Request this stone
                              </button>
                            ) : null}
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
                                  renderStoneCard(
                                    stone,
                                    stoneIndex < 2 ? "high" : stoneIndex < 4 ? "eager" : "lazy",
                                    SCROLL_CARD
                                  )
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
                              {/* Every rail below the first competes for bandwidth if
                          eager-loaded simultaneously -- native lazy-loading
                          fetches these as the user actually scrolls to them. */}
                              {category.stones
                                .slice(0, 12)
                                .map((stone) => renderStoneCard(stone, "lazy", SCROLL_CARD))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : inventoryItems.length > 0 ? (
            <section id="collection" className="scroll-mt-28 py-8 md:py-11">
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
              role="dialog"
              aria-modal="true"
              aria-label={`${openStone.name} photo gallery`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpenStone(null);
              }}
            >
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#0f0d09]">
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div>
                    <h3 className={`text-lg font-bold text-white sm:text-xl ${DISPLAY_FONT}`}>
                      {openStone.name}
                    </h3>
                    {!openStone.hideFinishDetails ? (
                      <p className="mt-1 text-xs text-white/60">
                        {openStone.finishes?.length
                          ? `Finish: ${openStone.finishes.join(" · ")}`
                          : `Finish not confirmed — ask ${displayName}`}
                      </p>
                    ) : null}
                    {openStone.imageFinishes?.[openImageIndex]?.length ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--brand-accent)]">
                        This photo: {openStone.imageFinishes[openImageIndex]?.join(" · ")}
                      </p>
                    ) : null}
                    {openStone.slabCounts?.length ? (
                      <p className="mt-1 text-xs font-semibold text-white/80">
                        {openStone.slabCounts.length === 1
                          ? `${openStone.slabCounts[0]} slabs in source inventory`
                          : `Source bundle counts: ${openStone.slabCounts.join(", ")} slabs`}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <ShareButton
                      destination={`${profileShareDestination}${buildProfileInventoryShareSearch(
                        openStone.slug,
                        openImageIndex
                      )}`}
                      title={openStone.name}
                      text={`${openStone.name} from ${displayName}`}
                      size="icon"
                      label=""
                      className="rounded-full border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
                    />
                    <button
                      onClick={() => setOpenStone(null)}
                      aria-label="Close gallery"
                      className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="relative flex min-h-[240px] flex-1 items-center justify-center bg-black">
                  {lightboxImageFailed ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-white/60">
                      {isJwStone ? (
                        <img
                          src="/images/businesses/jw-stone/logo.svg"
                          alt=""
                          className="w-28 opacity-40"
                        />
                      ) : (
                        <p className={`text-xl font-bold text-white/70 ${DISPLAY_FONT}`}>
                          {displayName}
                        </p>
                      )}
                      <p className="text-sm">
                        Photo unavailable right now — ask {displayName} for an updated view.
                      </p>
                    </div>
                  ) : (
                    <img
                      key={`${openStone.slug}-${openImageIndex}`}
                      src={openStone.images[openImageIndex]}
                      alt={`${openStone.name} ${openImageIndex + 1}`}
                      onError={() => {
                        triedLightboxIndexesRef.current.add(openImageIndex);
                        if (triedLightboxIndexesRef.current.size >= openStone.images.length) {
                          setLightboxImageFailed(true);
                          return;
                        }
                        setOpenImageIndex((current) => (current + 1) % openStone.images.length);
                      }}
                      onLoad={(event) => {
                        if (!isDecodedFrameBlack(event.currentTarget)) return;
                        triedLightboxIndexesRef.current.add(openImageIndex);
                        if (triedLightboxIndexesRef.current.size >= openStone.images.length) {
                          setLightboxImageFailed(true);
                          return;
                        }
                        setOpenImageIndex((current) => (current + 1) % openStone.images.length);
                      }}
                      className="max-h-[55vh] w-full object-contain"
                    />
                  )}
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
                        <img
                          src={url}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                          onLoad={(event) => {
                            if (isDecodedFrameBlack(event.currentTarget)) {
                              event.currentTarget.style.visibility = "hidden";
                            }
                          }}
                          className="h-full w-full bg-white/10 object-cover"
                        />
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
                    className="rounded-full border border-[var(--brand-accent)]/50 px-6 py-2.5 text-sm font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10"
                  >
                    Ask about this stone
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Why us */}
          <section id="why-us" className="scroll-mt-28 bg-[var(--brand-surface)] py-8 md:py-11">
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
                  <h2
                    className={`text-3xl font-bold leading-tight text-white md:text-5xl ${DISPLAY_FONT}`}
                  >
                    Stone selected with the final room in mind.
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
                  {JW_STONE_STORY_IMAGES.map((image, index) => (
                    <figure
                      key={image.src}
                      className={`group relative overflow-hidden rounded-2xl bg-black ${
                        index < 2 ? "aspect-[40/27]" : "aspect-square"
                      } ${index === 0 ? "sm:col-span-2" : ""}`}
                    >
                      <img
                        src={image.src}
                        alt={image.alt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
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
          <section id="audience" className="scroll-mt-28 py-8 md:py-11">
            <div className="container mx-auto px-4 md:px-6">
              <h2
                className={`mb-6 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
              >
                {audienceTitle}
              </h2>
              <div className={SCROLL_ROW}>
                {audiencePaths.map((path, i) => {
                  const Icon = path.icon;
                  return (
                    <article key={i} className={`${SCROLL_CARD} text-left`}>
                      <div className="flex h-full flex-col rounded-xl border-2 border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] p-6 shadow-sm transition-colors hover:border-[var(--brand-accent)]/40">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                          <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                        </div>
                        <p className="mb-2 font-semibold text-[#241d0f]">{path.label}</p>
                        <p className="text-sm text-[#241d0f]/70">{path.body}</p>
                        <button
                          type="button"
                          onClick={() => startDirectConnect()}
                          className="mt-5 min-h-10 rounded-xl border border-[var(--brand-accent)]/40 px-4 text-xs font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10"
                        >
                          Direct Connect
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Featured materials */}
          {profileSlug === "jw-stone" && jwStonePicks.length > 0 ? (
            <section
              id="materials"
              className="scroll-mt-28 bg-[var(--brand-surface)] py-8 md:py-11"
            >
              <div className="container mx-auto px-4 md:px-6">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <h2
                    className={`text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                  >
                    Featured Materials
                  </h2>
                  <button
                    type="button"
                    onClick={openFullInventory}
                    className="text-sm font-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline"
                  >
                    View all inventory
                  </button>
                </div>
                <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
                  {jwStonePicks.map((stone, index) => (
                    <article
                      key={stone.slug}
                      className="w-[82vw] max-w-[340px] flex-none snap-start overflow-hidden rounded-2xl border border-[var(--brand-primary)]/10 bg-white shadow-sm md:w-auto md:max-w-none"
                    >
                      <div className="relative h-64 overflow-hidden bg-stone-200">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenStone(stone);
                            setOpenImageIndex(0);
                          }}
                          className="block h-full w-full"
                          aria-label={`View details for ${stone.name}`}
                        >
                          <img
                            src={stone.images[0]}
                            alt={stone.name}
                            loading={index === 0 ? "eager" : "lazy"}
                            className="h-full w-full bg-stone-200 object-contain p-1 transition-transform duration-300 hover:scale-[1.02]"
                          />
                        </button>
                        <ShareButton
                          destination={`${profileShareDestination}${buildProfileInventoryShareSearch(stone.slug)}`}
                          title={stone.name}
                          text={`${stone.name} at JW Stone`}
                          size="icon"
                          label=""
                          className="absolute right-3 top-3 rounded-full border-white/25 bg-black/70 text-white hover:bg-black"
                        />
                        {stone.images.length > 1 ? (
                          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                            {stone.images.length} photos
                          </span>
                        ) : null}
                      </div>
                      <div className="px-5 pb-3 pt-4">
                        <h3 className={`text-xl font-bold !text-[#241d0f] ${DISPLAY_FONT}`}>
                          {stone.name}
                        </h3>
                        <p className="mt-1 text-sm !text-[#4a4238]">
                          {stone.finishes?.length
                            ? stone.finishes.join(" · ")
                            : "Current JW Stone inventory"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 px-5 pb-5">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenStone(stone);
                            setOpenImageIndex(0);
                          }}
                          className="rounded-xl border border-[var(--brand-primary)]/20 px-3 py-3 text-sm font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/5"
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          onClick={() => startDirectConnect(stone.name, "request_material")}
                          className="w-full rounded-xl border border-[var(--brand-accent)]/40 px-4 py-3 text-sm font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10"
                        >
                          Ask about {stone.name}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : galleryItems.length > 0 ? (
            <section
              id="materials"
              className="scroll-mt-28 bg-[var(--brand-surface)] py-8 md:py-11"
            >
              <div className="container mx-auto px-4 md:px-6">
                <h2
                  className={`mb-6 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                >
                  Featured Materials
                </h2>
                <div className={SCROLL_ROW}>
                  {galleryItems.map((item) => (
                    <article
                      id={`profile-gallery-${item.slug}`}
                      key={item.slug}
                      className={`${SCROLL_CARD} scroll-mt-28 overflow-hidden rounded-xl border bg-white shadow-md transition-shadow ${
                        item.slug === sharedGallerySlug
                          ? "border-[var(--brand-accent)] ring-2 ring-[var(--brand-accent)]/40"
                          : "border-black/10"
                      }`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        className="h-64 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="space-y-3 p-4">
                        <div>
                          <h3 className={`font-bold text-[var(--brand-primary)] ${DISPLAY_FONT}`}>
                            {item.title}
                          </h3>
                          {item.description ? (
                            <p className="mt-1 text-sm text-[#241d0f]/70">{item.description}</p>
                          ) : null}
                        </div>
                        <ShareButton
                          destination={`${profileShareDestination}${buildProfileGalleryShareSearch(item.slug)}`}
                          title={`${item.title} by ${displayName}`}
                          text={`View ${item.title} from ${displayName} on TradeScout`}
                          className="border-[var(--brand-primary)]/25 text-[var(--brand-primary)]"
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {profileItems ? (
            <section className="bg-[#241d0f] py-8 md:py-11">
              <div className="container mx-auto max-w-6xl px-4 md:px-6">{profileItems}</div>
            </section>
          ) : null}

          {/* FAQ */}
          {faqItems.length > 0 ? (
            <section className="py-8 md:py-11">
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
                        <p className="mb-2 font-semibold text-[var(--brand-primary)]">
                          {faq.question}
                        </p>
                      ) : null}
                      {faq.answer ? <p className="text-[#241d0f]/70">{faq.answer}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* Customer recommendations */}
          {recommendationsDirectory.length > 0 ? (
            <section className="bg-[var(--brand-surface)] py-8 md:py-11">
              <div className="container mx-auto max-w-3xl px-4 md:px-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    className={`text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                  >
                    What customers say
                  </h2>
                  <div className="text-sm font-medium text-[#241d0f]/70">
                    {summary.total} {summary.total === 1 ? "recommendation" : "recommendations"}
                  </div>
                </div>
                <p className="mb-8 text-sm text-[#241d0f]/75">
                  Recommendations customers choose to share appear here.
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
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
                            : "Recently"}
                        </div>
                      </div>
                      <p className="mb-3 text-sm text-[#241d0f]/80">{entry.comment}</p>
                      <p className="text-xs font-semibold text-[#241d0f]/75">
                        Shared by {entry.customerName || "a customer"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* Contact / CTA */}
          <section id="connect" className="scroll-mt-28 bg-[var(--brand-primary)] py-9 md:py-12">
            <div className="container mx-auto px-4 text-center md:px-6">
              <h2 className={`mb-4 text-2xl font-bold text-white md:text-4xl ${DISPLAY_FONT}`}>
                {ctaHeading}
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-white/80">{ctaDescription}</p>
              <div className="mx-auto mb-10 flex max-w-2xl flex-wrap items-center justify-center gap-3">
                {requestExamples.map((example) => (
                  <span
                    key={example}
                    className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90"
                  >
                    {example}
                  </span>
                ))}
              </div>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => startDirectConnect()}
                  className="flex items-center justify-center gap-2 rounded-full bg-ts-orange px-8 py-4 text-base font-bold text-white transition-colors hover:bg-ts-orange-dark"
                >
                  <MessageCircle className="h-5 w-5" />
                  Direct Connect
                </button>
              </div>
            </div>
          </section>

          {/* Brand footer, then TradeScout site footer at the absolute bottom */}
          <footer className="bg-[#241d0f] py-10 text-white/70">
            <div className="container mx-auto px-4 text-center text-sm md:px-6">
              <p className={`mb-2 text-lg font-bold text-white ${DISPLAY_FONT}`}>{displayName}</p>
              <p>{footerText}</p>
            </div>
          </footer>

          <TradeScoutProfileHandoff
            profileSlug={profileSlug}
            profileName={displayName}
            platformBaseHref={platformBaseHref}
          />
        </>
      )}
      <ExpressDirectConnectPanel
        open={expressPanelOpen}
        onClose={() => setExpressPanelOpen(false)}
        profileSlug={profileSlug}
        businessName={displayName}
        hasViewerSession={hasViewerSession}
        allowCall={allowExpressCall}
        stayInProfile
        requestMode="materials"
        initialStoneName={expressStoneName}
        initialRequestType={expressRequestType}
        contactOperatorName={contactOperatorName || undefined}
        contactOperatorRole={contactOperatorRole || undefined}
      />
    </div>
  );
}
