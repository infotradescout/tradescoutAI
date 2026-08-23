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
  Youtube,
} from "lucide-react";
import ExpressDirectConnectPanel, {
  type ExpressDirectConnectRequestType,
} from "./ExpressDirectConnectPanel";
import PremiumProductProfileSections from "./PremiumProductProfileSections";
import { ShareButton } from "@/components/ShareButton";
import {
  qualifyPublicProfileItemDestination,
  requiresDocumentNavigation,
} from "@/lib/publicProfileItemDestination";
import {
  normalizeProfileInventoryItemSlug,
  normalizeProfileInventoryPhotoIndex,
  profileInventoryShareIndexForDisplay,
  resolveProfileInventoryItem,
} from "@shared/profileItemShare";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";
import {
  buildProfilePublicCategoryPath,
  buildProfilePublicItemPath,
  resolveProfilePublicItemRoute,
} from "@shared/profilePublicItemRoute";
import { isLuxPresentation, isPremiumProductProfileData } from "@shared/premiumProductProfile";
import {
  ISSA_BUILD_HERO_POSTER,
  ISSA_BUILD_HERO_VIDEO,
  isIssaBuildProfileSlug,
} from "@shared/issaBuildProfile";
import { resolveDirectConnectMaterial, type DirectConnectTarget } from "./directConnectMaterial";
import { createFallbackImageHandlers, isDecodedFrameBlack } from "./safeProfileImage";
import { buildProfileSocialPreviewImageUrl } from "@shared/profileSocialPreview";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";

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
  displayName?: string | null;
  nameStatus?: "source" | "placeholder";
  slug: string;
  images: string[];
  shareImageOrder?: number[];
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

type ProfilePresentationConfig = {
  layout?: {
    variant?: "brand-showcase";
  };
  header?: {
    layout?: "centered-brand";
    logoUrl?: string;
    logoAlt?: string;
    homeLabel?: string;
    backLabel?: string;
    directConnectLabel?: string;
  };
  hero?: {
    videoUrl?: string;
    posterUrl?: string;
    inventoryItemSlug?: string;
    eyebrow?: string;
    headline?: string;
    teaser?: string;
    preserveMedia?: boolean;
    align?: "left" | "center";
    zoomVideo?: boolean;
  };
  copy?: {
    inventoryTitle?: string;
    ctaHeading?: string;
    footerText?: string;
  };
  media?: {
    fallbackLogoUrl?: string;
    fallbackLogoAlt?: string;
  };
  inventory?: {
    initialView?: "catalog" | "featured";
    density?: "compact" | "comfortable";
    pageSize?: number;
    pageStep?: number;
    stickyControls?: boolean;
    sourceRequests?: boolean;
    browseCtaImage?: string;
    browseCtaEyebrow?: string;
    featuredCollection?: {
      label?: string;
      slugs?: string[];
    };
  };
  audience?: {
    layout?: "guided" | "cards";
    intro?: string;
    availableFacts?: string[];
    contextHeading?: string;
    availabilityNote?: string;
  };
  faq?: {
    layout?: "disclosure" | "expanded";
  };
  recommendations?: {
    initialLimit?: number;
    maxVisible?: number;
  };
  story?: {
    eyebrow?: string;
    heading?: string;
    images?: Array<{ src?: string; alt?: string; label?: string }>;
  };
  social?: {
    brandName?: string;
    logoUrl?: string;
    profileImageUrl?: string;
    accentColor?: string;
    profileCta?: string;
    inventoryCta?: string;
    galleryCta?: string;
    youtubeUrl?: string;
  };
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
  businessAddress?: string | null;
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
  currentPageShareDestination?: string;
  currentPageShareTitle?: string;
  sharedInventoryCategorySlug?: string | null;
  platformBaseHref?: string;
  sharedGallerySlug?: string | null;
  tradeScoutReturnHref: string;
  directConnectHref: string;
  preScoutCreateHref: string;
  preScoutSignInHref: string;
  onDirectConnect?: () => void;
  onAccountCreate?: () => void;
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

const AUDIENCE_PATH_TEMPLATES = [
  {
    icon: Wrench,
    label: "Fabricators",
    body: (displayName: string) =>
      `Review named stone, confirmed finishes where listed, and source bundle counts, then ask ${displayName} about current bundle matching and production timing.`,
    requestType: "ask_about_bundle",
    actionLabel: "Ask about a bundle",
    review: (displayName: string) => [
      "Material, finish, and stone photos",
      "Bundle or source-count context when listed",
      `Production and delivery timing for ${displayName} to confirm`,
    ],
  },
  {
    icon: Building2,
    label: "Builders & Developers",
    body: (displayName: string) =>
      `Share project volume, location, and timing so ${displayName} can review material consistency, current supply, and delivery needs.`,
    requestType: "match_project",
    actionLabel: "Match a development",
    review: (displayName: string) => [
      "Project location and phase",
      "Volume and consistency needs",
      `Desired delivery timing for ${displayName} to review`,
    ],
  },
  {
    icon: Compass,
    label: "Architects & Designers",
    body: () =>
      "Compare stone imagery, category, and confirmed finish details, then request current availability and specification support for a selected project.",
    requestType: "match_project",
    actionLabel: "Review a specification",
    review: () => [
      "Application and specification needs",
      "Movement, color, and confirmed finish details",
      "Selection timeline and current availability request",
    ],
  },
  {
    icon: Home,
    label: "Homeowners",
    body: (displayName: string) =>
      `Start with a room, inspiration, or selected stone, then ask ${displayName} to review current availability, order requirements, and the next selection step.`,
    requestType: "match_project",
    actionLabel: "Match my project",
    review: () => [
      "Room or application",
      "Inspiration, dimensions, or a selected stone",
      "Fabricator and project timing, if known",
    ],
  },
] as const;

const ALLOWED_SOCIAL_LINK_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtu.be"]);

function sanitizeSocialVideoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!ALLOWED_SOCIAL_LINK_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function audiencePathConfig(title: unknown, fallbackIndex: number, displayName: string) {
  const label = String(title || "").toLowerCase();
  const template = label.includes("fabricator")
    ? AUDIENCE_PATH_TEMPLATES[0]
    : label.includes("builder") || label.includes("developer")
      ? AUDIENCE_PATH_TEMPLATES[1]
      : label.includes("architect") || label.includes("designer")
        ? AUDIENCE_PATH_TEMPLATES[2]
        : label.includes("homeowner")
          ? AUDIENCE_PATH_TEMPLATES[3]
          : AUDIENCE_PATH_TEMPLATES[fallbackIndex % AUDIENCE_PATH_TEMPLATES.length];
  return {
    ...template,
    body: template.body(displayName),
    review: template.review(displayName),
  };
}

const DEFAULT_DIFFERENTIATORS = [
  {
    icon: Gem,
    title: "Material selection",
    body: "Slabs are chosen individually, not bought sight-unseen by the container.",
  },
  {
    icon: ShieldCheck,
    title: "Order review",
    body: "Each order is checked against the confirmed material selection and delivery details before it ships.",
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

const DIRECT_CONNECT_REQUEST_TYPES = new Set<ExpressDirectConnectRequestType>([
  "request_material",
  "match_project",
  "ask_about_bundle",
  "schedule_showroom",
  "request_service",
  "request_quote",
  "ask_question",
  "schedule_service",
  "other",
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

// Profiles with evidence-backed name presentation provide displayName and
// nameStatus independently from materialStatus. Internal identifiers remain
// available for routing, but an unknown public name stays blank.
function getStoneDisplayName(stone: {
  name: string;
  displayName?: string | null;
  nameStatus?: "source" | "placeholder";
  slug: string;
  materialStatus?: string;
}): string {
  const explicitDisplayName = stone.displayName?.trim();
  if (explicitDisplayName) return explicitDisplayName;
  if (stone.nameStatus === "source") return stone.name;
  const namePending =
    stone.nameStatus === "placeholder" ||
    (!stone.nameStatus && stone.materialStatus === "unconfirmed");
  if (!namePending) return stone.name;
  return "";
}

const UNKNOWN_STONE_AVAILABILITY_COPY = "Call for availability";

function isStoneNamePending(stone: InventoryStone): boolean {
  if (stone.nameStatus) return stone.nameStatus === "placeholder";
  return stone.materialStatus === "unconfirmed";
}

function stoneConfirmationLabel(stone: InventoryStone): string {
  if (isStoneNamePending(stone)) return "Name & finish pending confirmation";
  return stone.finishStatus === "unconfirmed"
    ? "Material & finish pending confirmation"
    : "Material pending confirmation";
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

function readPresentationConfig(block: ContentBlock | undefined): ProfilePresentationConfig {
  if (!block?.data || typeof block.data !== "object" || Array.isArray(block.data)) return {};
  return block.data as ProfilePresentationConfig;
}

function positiveInteger(value: unknown, fallback: number, maximum = 48): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

function configuredRequestType(
  value: unknown,
  fallback: ExpressDirectConnectRequestType
): ExpressDirectConnectRequestType {
  return typeof value === "string" &&
    DIRECT_CONNECT_REQUEST_TYPES.has(value as ExpressDirectConnectRequestType)
    ? (value as ExpressDirectConnectRequestType)
    : fallback;
}

export default function WholesalerProfileTheme({
  profileSlug,
  displayName,
  businessAddress,
  headline,
  contentBlocks,
  categories,
  serviceAreas,
  brandColors,
  hasViewerSession,
  useExpressDirectConnect,
  allowExpressCall,
  profileShareDestination,
  currentPageShareDestination,
  currentPageShareTitle,
  sharedInventoryCategorySlug,
  platformBaseHref = "",
  sharedGallerySlug,
  tradeScoutReturnHref,
  directConnectHref,
  preScoutCreateHref,
  preScoutSignInHref,
  onDirectConnect,
  onAccountCreate,
  recommendationsDirectory = [],
  recommendationDirectorySummary,
  trustActions,
  profileItems,
  featuredStoneSlugs = [],
}: WholesalerProfileThemeProps) {
  const [, navigate] = useLocation();
  const isIssaBuild = isIssaBuildProfileSlug(profileSlug);
  const presentationBlock = findBlock(contentBlocks, "profilePresentation");
  const presentation = readPresentationConfig(presentationBlock);
  const brandShowcase = presentation.layout?.variant === "brand-showcase";
  const centeredBrandHeader =
    presentation.header?.layout === "centered-brand" &&
    typeof presentation.header.logoUrl === "string" &&
    presentation.header.logoUrl.trim().length > 0;
  const presentationYouTubeUrl = sanitizeSocialVideoUrl(presentation.social?.youtubeUrl);
  const preserveHeroMedia = presentation.hero?.preserveMedia === true;
  const socialPreviewPageOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://www.thetradescout.com";
  const profileSocialPreviewImageUrl =
    buildProfileSocialPreviewImageUrl({
      pageOrigin: socialPreviewPageOrigin,
      profileSlug,
      versionSeed: displayName,
    }) || undefined;
  const inventorySocialPreviewImageUrl = (
    stone: InventoryStone,
    shareImageIndex: number
  ): string | undefined => {
    const displayImageIndex = stone.shareImageOrder?.[shareImageIndex] ?? shareImageIndex;
    return (
      buildProfileSocialPreviewImageUrl({
        pageOrigin: socialPreviewPageOrigin,
        profileSlug,
        itemType: "inventory",
        itemSlug: stone.slug,
        photo: shareImageIndex + 1,
        versionSeed: [displayName, stone.name, stone.images[displayImageIndex] || ""].join("|"),
      }) || undefined
    );
  };
  const gallerySocialPreviewImageUrl = (item: {
    slug: string;
    title: string;
    imageUrl: string;
  }): string | undefined =>
    buildProfileSocialPreviewImageUrl({
      pageOrigin: socialPreviewPageOrigin,
      profileSlug,
      itemType: "gallery",
      itemSlug: item.slug,
      versionSeed: [displayName, item.title, item.imageUrl].join("|"),
    }) || undefined;
  const heroVideo = isIssaBuild
    ? { src: ISSA_BUILD_HERO_VIDEO, poster: ISSA_BUILD_HERO_POSTER }
    : presentation.hero?.videoUrl
      ? {
          src: presentation.hero.videoUrl,
          poster: presentation.hero.posterUrl || "",
        }
      : null;
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [heroVideoZoomed, setHeroVideoZoomed] = useState(false);
  const [issaHeroReady, setIssaHeroReady] = useState(false);
  useEffect(() => {
    if (!heroVideo) return;
    setIssaHeroReady(false);
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
        // ISSA keeps a static landscape frame (no Ken Burns) so the 16:9 room
        // film is not zoomed into a fragment.
        if (isIssaBuild || presentation.hero?.zoomVideo === false) {
          setHeroVideoZoomed(false);
        } else {
          zoomTimer = window.setTimeout(() => setHeroVideoZoomed(true), 100);
        }
        void heroVideoRef.current?.play().catch(() => undefined);
      }
    };
    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);
    return () => {
      if (zoomTimer !== null) window.clearTimeout(zoomTimer);
      motionQuery.removeEventListener("change", syncMotionPreference);
    };
  }, [heroVideo?.src, isIssaBuild, presentation.hero?.zoomVideo]);

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
  const compactInventory = presentation.inventory?.density === "compact";
  const inventoryOpenByDefault = presentation.inventory?.initialView === "catalog";
  const inventoryPageSize = positiveInteger(
    presentation.inventory?.pageSize,
    compactInventory ? 12 : 24
  );
  const inventoryPageStep = positiveInteger(presentation.inventory?.pageStep, inventoryPageSize);
  const stickyInventoryControls = presentation.inventory?.stickyControls === true;
  const sourceRequestsEnabled = presentation.inventory?.sourceRequests === true;
  const guidedAudience = presentation.audience?.layout === "guided";
  const faqDisclosure = presentation.faq?.layout === "disclosure";
  const recommendationInitialLimit = positiveInteger(
    presentation.recommendations?.initialLimit,
    24,
    24
  );
  const recommendationMaxVisible = Math.max(
    recommendationInitialLimit,
    positiveInteger(presentation.recommendations?.maxVisible, 24, 100)
  );
  const presentationFeaturedSlugs = Array.isArray(presentation.inventory?.featuredCollection?.slugs)
    ? presentation.inventory.featuredCollection.slugs
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
        .slice(0, 12)
    : [];
  const configuredFeaturedSlugs =
    presentationFeaturedSlugs.length > 0 ? presentationFeaturedSlugs : featuredStoneSlugs;
  const configuredFeaturedSlugKey = configuredFeaturedSlugs.join("\u0000");
  const featuredCollectionLabel =
    presentation.inventory?.featuredCollection?.label?.trim() || "Featured";
  const featuredCollectionSlugSet = new Set(configuredFeaturedSlugs);
  const storyImages = Array.isArray(presentation.story?.images)
    ? presentation.story.images
        .filter(
          (
            image
          ): image is {
            src: string;
            alt?: string;
            label?: string;
          } => typeof image?.src === "string" && image.src.trim().length > 0
        )
        .map((image) => ({ ...image, src: image.src.trim() }))
    : [];

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
  const audienceItems: Array<{
    title?: string;
    body?: string;
    actionLabel?: string;
    requestType?: ExpressDirectConnectRequestType;
    review?: string[];
  }> = Array.isArray(audienceBlock?.data?.items) ? audienceBlock.data.items : [];
  const audiencePaths =
    audienceItems.length > 0
      ? audienceItems.map((item, index) => {
          const config = audiencePathConfig(item.title, index, displayName);
          const storedBody = typeof item.body === "string" ? item.body.trim() : "";
          const storedReview = Array.isArray(item.review)
            ? item.review.filter(
                (value): value is string => typeof value === "string" && value.trim().length > 0
              )
            : [];
          return {
            ...config,
            label: item.title || config.label,
            body: storedBody ? `${storedBody} ${config.body}` : config.body,
            actionLabel:
              typeof item.actionLabel === "string" && item.actionLabel.trim()
                ? item.actionLabel.trim()
                : config.actionLabel,
            requestType: configuredRequestType(item.requestType, config.requestType),
            review: storedReview.length > 0 ? storedReview : config.review,
          };
        })
      : AUDIENCE_PATH_TEMPLATES.map((template) => ({
          ...template,
          body: template.body(displayName),
          review: template.review(displayName),
        }));
  // Real, named inventory grouped by material category -- no pricing here by
  // design; priced/featured stones are a separate, later concern.
  const inventoryCatalogFromContent: InventoryCategory[] = Array.isArray(
    inventoryCatalogBlock?.data?.categories
  )
    ? inventoryCatalogBlock.data.categories
    : [];
  const publicInventoryCategories = useMemo(
    () => listProfileInventoryCategories(inventoryCatalogFromContent, contentBlocks),
    [inventoryCatalogBlock, contentBlocks]
  );
  const sharedInventoryCategory = publicInventoryCategories.find(
    (category) => category.slug === sharedInventoryCategorySlug
  );
  const activePageShareDestination = currentPageShareDestination || profileShareDestination;
  const activePageShareTitle = currentPageShareTitle || displayName;
  const activePageSocialPreviewImageUrl = sharedInventoryCategory
    ? buildProfileSocialPreviewImageUrl({
        pageOrigin: socialPreviewPageOrigin,
        profileSlug,
        itemType: "category",
        itemSlug: sharedInventoryCategory.slug,
        versionSeed: [
          displayName,
          sharedInventoryCategory.name,
          sharedInventoryCategory.itemCount,
        ].join("|"),
      }) || profileSocialPreviewImageUrl
    : profileSocialPreviewImageUrl;
  // Shuffled once per profile visit (not on every render), so a returning
  // visitor sees a different order at the top of each category without
  // scrolling -- stones never move out of the category they belong to.
  const inventoryCatalog = useMemo(
    () =>
      inventoryCatalogFromContent.map((category) => {
        // Unnamed/unconfirmed slabs shouldn't compete for the front of a rail
        // with stone JW has actually identified -- keep them shuffled among
        // themselves, but always after everything confirmed.
        const confirmed = category.stones.filter((stone) => stone.materialStatus !== "unconfirmed");
        const unconfirmed = category.stones.filter(
          (stone) => stone.materialStatus === "unconfirmed"
        );
        return {
          ...category,
          stones: [...shuffleStones(confirmed), ...shuffleStones(unconfirmed)],
        };
      }),
    [inventoryCatalogBlock]
  );
  const [activeCategorySlug, setActiveCategorySlug] = useState(
    sharedInventoryCategory?.sourceSlug || "all"
  );
  const [inventoryExpanded, setInventoryExpanded] = useState(inventoryOpenByDefault);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryVisibleLimit, setInventoryVisibleLimit] = useState(inventoryPageSize);
  const [activeAudienceIndex, setActiveAudienceIndex] = useState(0);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);
  const pendingInventoryScrollRef = useRef(false);
  const [openStone, setOpenStone] = useState<InventoryStone | null>(null);
  const openStoneDisplayName = openStone ? getStoneDisplayName(openStone) : "";
  const [openImageIndex, setOpenImageIndex] = useState(0);
  const [premiumSharedItem, setPremiumSharedItem] = useState<{
    slug: string;
    imageIndex: number;
  } | null>(null);
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
  const [expressItemId, setExpressItemId] = useState<string | null>(null);
  const [expressRequestType, setExpressRequestType] =
    useState<ExpressDirectConnectRequestType | null>(null);
  const normalizedInventorySearch = inventorySearch.trim().toLowerCase();
  const allInventoryStones = inventoryCatalog.flatMap((category) => category.stones);
  const premiumInventoryStones = inventoryCatalogFromContent.flatMap((category) => category.stones);
  const rawPremiumPresentation =
    premiumProductBlock?.data &&
    typeof premiumProductBlock.data === "object" &&
    !Array.isArray(premiumProductBlock.data)
      ? (premiumProductBlock.data as Record<string, unknown>).presentation
      : undefined;
  // Presentation flag is checked before full validation so a broken/edited
  // Lux payload fails closed instead of falling through to wholesaler inventory chrome.
  // Accepts canonical "lux" and legacy "luxury-material-house".
  const isLuxuryMaterialHouse = isLuxPresentation(rawPremiumPresentation);
  const premiumProductData = isPremiumProductProfileData(premiumProductBlock?.data)
    ? premiumProductBlock.data
    : null;
  const premiumProduct =
    premiumProductData && premiumProductData.featuredProductSlug
      ? premiumInventoryStones.find(
          (stone) => stone.slug === premiumProductData.featuredProductSlug
        ) || null
      : premiumProductData && premiumInventoryStones.length === 1
        ? premiumInventoryStones[0]
        : null;
  const luxuryHouseProducts = useMemo(() => {
    if (!isLuxuryMaterialHouse || !premiumProductData?.luxuryHouse) return [];
    return premiumProductData.luxuryHouse.materialChapters.map((chapter) => {
      const fromInventory = premiumInventoryStones.find((stone) => stone.slug === chapter.slug);
      return {
        name: chapter.name,
        slug: chapter.slug,
        images:
          fromInventory?.images?.length && fromInventory.images.length > 0
            ? fromInventory.images
            : [chapter.applicationImage, chapter.detailImage],
        shareImageOrder: fromInventory?.shareImageOrder,
      };
    });
  }, [isLuxuryMaterialHouse, premiumInventoryStones, premiumProductData]);
  const luxuryHouseFeaturedProduct =
    luxuryHouseProducts.find((entry) => entry.slug === premiumProductData?.featuredProductSlug) ||
    luxuryHouseProducts[0] ||
    null;
  // Opens a shared inventory-item link directly to that stone's lightbox
  // instead of just the profile root -- see ShareButton in the lightbox below.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customDomainRoute = Boolean(
      (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
        .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__
    );
    const routedItem = resolveProfilePublicItemRoute({
      pathname: window.location.pathname,
      profileBasePath: customDomainRoute ? "/" : `/u/${encodeURIComponent(profileSlug)}`,
      contentBlocks,
    });
    const stoneParam =
      routedItem?.itemType === "inventory" ? routedItem.itemSlug : params.get("stone");
    const photoParam = params.get("photo");

    // Presentation-first: Lux deep links resolve from chapters
    // even when inventoryCatalog is missing/edited.
    if (isLuxuryMaterialHouse && premiumProductData?.luxuryHouse) {
      const fromInventory = resolveProfileInventoryItem(inventoryCatalog, stoneParam, photoParam);
      if (fromInventory) {
        setPremiumSharedItem({ slug: fromInventory.slug, imageIndex: fromInventory.imageIndex });
        return;
      }
      const slug = normalizeProfileInventoryItemSlug(stoneParam);
      const chapter = premiumProductData.luxuryHouse.materialChapters.find(
        (entry) => entry.slug === slug
      );
      if (!chapter) return;
      const chapterImages = [chapter.applicationImage, chapter.detailImage];
      setPremiumSharedItem({
        slug: chapter.slug,
        imageIndex: normalizeProfileInventoryPhotoIndex(photoParam, chapterImages.length),
      });
      return;
    }

    const sharedItem = resolveProfileInventoryItem(inventoryCatalog, stoneParam, photoParam);
    if (!sharedItem) return;
    const match = allInventoryStones.find((stone) => stone.slug === sharedItem.slug);
    if (!match) return;
    if (premiumProductData) {
      setPremiumSharedItem({ slug: sharedItem.slug, imageIndex: sharedItem.imageIndex });
      return;
    }
    setOpenStone(match);
    setOpenImageIndex(sharedItem.imageIndex);
  }, []);
  const selectedCategory = inventoryCatalog.find(
    (category) => category.categorySlug === activeCategorySlug
  );
  // "All stone" flattens every category back together, which would otherwise
  // undo the confirmed-first ordering each category already has -- keep
  // unconfirmed slabs last here too rather than wherever their category
  // happened to fall.
  const allInventoryStonesConfirmedFirst =
    activeCategorySlug === "all"
      ? [
          ...allInventoryStones.filter((stone) => stone.materialStatus !== "unconfirmed"),
          ...allInventoryStones.filter((stone) => stone.materialStatus === "unconfirmed"),
        ]
      : allInventoryStones;
  const categoryStones =
    activeCategorySlug === "featured" && featuredCollectionSlugSet.size > 0
      ? allInventoryStones.filter(
          (stone) =>
            featuredCollectionSlugSet.has(stone.slug) && stone.materialStatus !== "unconfirmed"
        )
      : selectedCategory?.stones || allInventoryStonesConfirmedFirst;
  const visibleStones = categoryStones.filter((stone) => {
    if (!normalizedInventorySearch) return true;
    return getStoneDisplayName(stone).toLowerCase().includes(normalizedInventorySearch);
  });
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
  // Otherwise every inventory profile gets random confirmed picks per visit.
  const featuredStones = useMemo(() => {
    const allStones = inventoryCatalog.flatMap((category) => category.stones);
    const bySlug = new Map(allStones.map((stone) => [stone.slug, stone]));
    // Unnamed/unconfirmed slabs don't get featured until JW has actually
    // identified them -- an unconfirmed stone showing up as a "trending pick"
    // reads as a real recommendation for something we don't know anything
    // about yet.
    const curated = configuredFeaturedSlugKey
      .split("\u0000")
      .filter(Boolean)
      .map((slug) => bySlug.get(slug))
      .filter((stone): stone is (typeof allStones)[number] => Boolean(stone))
      .filter((stone) => stone.materialStatus !== "unconfirmed")
      .slice(0, 3)
      .map((stone) => ({
        slug: stone.slug,
        stone,
        material: stoneCategoryBySlug.get(stone.slug) || "",
        finish: stone.finishes?.[0],
      }));
    if (curated.length > 0) return curated;
    return shuffleStones(allStones.filter((stone) => stone.materialStatus !== "unconfirmed"))
      .slice(0, 3)
      .map((stone) => ({
        slug: stone.slug,
        stone,
        material: stoneCategoryBySlug.get(stone.slug) || "",
        finish: stone.finishes?.[0],
      }));
  }, [configuredFeaturedSlugKey, inventoryCatalog, stoneCategoryBySlug]);
  const hasInventoryFilters = activeCategorySlug !== "all" || normalizedInventorySearch.length > 0;
  useEffect(() => {
    setInventoryVisibleLimit(inventoryPageSize);
  }, [activeCategorySlug, inventoryPageSize, normalizedInventorySearch]);
  const activeAudiencePath =
    audiencePaths[Math.min(activeAudienceIndex, audiencePaths.length - 1)] ||
    audiencePathConfig("", 0, displayName);
  const ActiveAudienceIcon = activeAudiencePath.icon;
  const configuredHeroImage = presentation.hero?.inventoryItemSlug
    ? inventoryCatalog
        .flatMap((category) => category.stones)
        .find((stone) => stone.slug === presentation.hero?.inventoryItemSlug)?.images[0]
    : undefined;
  const heroImage =
    configuredHeroImage ||
    luxuryHouseFeaturedProduct?.images[0] ||
    premiumProduct?.images[0] ||
    inventoryCatalog.flatMap((c) => c.stones).flatMap((s) => s.images)[0] ||
    galleryItems[0]?.imageUrl;
  const heroEyebrow =
    presentation.hero?.eyebrow?.trim() ||
    blockString(heroBlock, "eyebrow") ||
    categories.slice(0, 3).join(" · ");
  const heroHeadline =
    presentation.hero?.headline?.trim() ||
    (isIssaBuild
      ? blockString(heroBlock, "headerLabel") || headline || displayName
      : headline || "Hand-selected stone. Direct from the source.");
  // The hero is a glance, not a read -- keep it to one sentence and let the
  // "Why Us" section carry the fuller story for anyone who scrolls that far.
  const heroTeaser =
    presentation.hero?.teaser?.trim() ||
    blockString(heroBlock, "teaser") ||
    aboutText.split(/(?<=[.!?])\s+/)[0] ||
    aboutText;
  const headerLabel =
    blockString(heroBlock, "headerLabel") || categories.slice(0, 2).join(" · ") || "Natural stone";
  // ISSA sticky subtitle must not repeat displayName/H1 — eyebrow is the category line.
  const stickySubtitle = isIssaBuild
    ? blockString(heroBlock, "eyebrow") || categories.slice(0, 2).join(" · ") || "Natural stone"
    : headerLabel;
  const inventoryTitle =
    blockString(inventoryCatalogBlock, "title") ||
    presentation.copy?.inventoryTitle?.trim() ||
    "Explore the collection";
  const storedInventoryDescription = blockString(inventoryCatalogBlock, "description");
  const inventoryDescription = sanitizePublicProfileText(storedInventoryDescription);
  const inventoryBrowseCtaImage =
    presentation.inventory?.browseCtaImage?.trim() ||
    featuredStones[0]?.stone.images[0] ||
    allInventoryStones[0]?.images[0];
  const inventoryBrowseCtaEyebrow =
    presentation.inventory?.browseCtaEyebrow?.trim() || inventoryTitle;
  const audienceTitle = blockString(audienceBlock, "title") || "Who We Work With";
  const ctaHeading =
    blockString(ctaBlock, "heading") ||
    presentation.copy?.ctaHeading?.trim() ||
    `Tell ${displayName} what you need`;
  const ctaDescription =
    blockString(ctaBlock, "description") ||
    "Ask about the material, match it to a project, or plan the next step.";
  const contactOperatorName = blockString(ctaBlock, "contactOperatorName");
  const contactOperatorRole = blockString(ctaBlock, "contactOperatorRole");
  const storedFooterFact =
    blockString(ctaBlock, "footerText") || presentation.copy?.footerText?.trim() || "";
  const operatingHoursText = /\b(?:open|hours?)\b/i.test(storedFooterFact)
    ? sanitizePublicProfileText(storedFooterFact, 240)
    : "";
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
    brandShowcase ? "translate-y-0 opacity-100 transition-all duration-700 ease-out" : "";

  const ctaHref = hasViewerSession ? directConnectHref : preScoutCreateHref;
  const startDirectConnect = (
    stoneName?: string | null,
    requestType?: ExpressDirectConnectRequestType | null,
    itemId?: string | null
  ) => {
    onDirectConnect?.();
    if (useExpressDirectConnect) {
      setExpressStoneName(stoneName || null);
      setExpressItemId(itemId || null);
      setExpressRequestType(requestType || (stoneName || itemId ? "request_material" : null));
      setExpressPanelOpen(true);
      return;
    }
    if (!hasViewerSession) {
      onAccountCreate?.();
    }
    if (requiresDocumentNavigation(ctaHref)) {
      window.location.assign(ctaHref);
      return;
    }
    navigate(ctaHref);
  };

  const startDirectConnectFromTarget = (target?: DirectConnectTarget) => {
    const material = resolveDirectConnectMaterial(target);
    startDirectConnect(
      material.itemName,
      material.itemId || material.itemName ? "request_material" : null,
      material.itemId
    );
  };

  const scrollToInventoryBrowser = () => {
    window.requestAnimationFrame(() => {
      document
        .getElementById("inventory-browser")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // "View all" from deep inside a trending/category rail swaps the whole
  // browse area to the filtered grid, which is usually much shorter -- left
  // to the browser's default scroll retention, the viewport lands wherever
  // that same pixel offset now falls (often an unrelated section further
  // down the page) instead of the filtered results the click was for.
  const filterToCategory = (slug: string) => {
    setActiveCategorySlug(slug);
    const publicCategory = publicInventoryCategories.find(
      (category) => category.sourceSlug === slug
    );
    const destination = publicCategory
      ? buildProfilePublicCategoryPath({
          profileBasePath: profileShareDestination,
          categorySlug: publicCategory.slug,
          contentBlocks,
        })
      : slug === "all"
        ? profileShareDestination
        : null;
    if (destination) navigate(destination);
    scrollToInventoryBrowser();
  };

  useEffect(() => {
    if (!sharedInventoryCategory) return;
    setActiveCategorySlug(sharedInventoryCategory.sourceSlug);
    setInventoryExpanded(true);
    window.requestAnimationFrame(scrollToInventoryBrowser);
  }, [sharedInventoryCategory?.slug]);

  const openFullInventory = () => {
    filterToCategory("all");
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

  const showFeaturedInventory = () => {
    setInventoryExpanded(false);
    filterToCategory("all");
    setInventorySearch("");
    setInventoryVisibleLimit(inventoryPageSize);
    window.requestAnimationFrame(() => {
      document.getElementById("collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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
      showFeaturedInventory();
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Falls through the material's other photos before giving up. A profile may
  // provide its own approved fallback mark; other profiles never inherit it.
  // Black-frame detection is shared via safeProfileImage (also used by luxury house).
  const stoneImageHandlers = (stone: InventoryStone) =>
    createFallbackImageHandlers(stone.images, (img) => {
      if (presentation.media?.fallbackLogoUrl) {
        img.src = presentation.media.fallbackLogoUrl;
        img.alt = presentation.media.fallbackLogoAlt || `${displayName} logo`;
        img.className =
          "h-full w-full bg-stone-200 object-contain p-10 opacity-40 transition-transform duration-300 group-hover:scale-105";
        return;
      }
      img.removeAttribute("src");
      const stoneDisplayName = getStoneDisplayName(stone);
      img.alt = stoneDisplayName
        ? `${stoneDisplayName} photo temporarily unavailable`
        : "Stone selection photo temporarily unavailable";
      img.style.visibility = "hidden";
    });

  const handleStoneImageError =
    (stone: InventoryStone) => (event: SyntheticEvent<HTMLImageElement>) => {
      stoneImageHandlers(stone).onError(event);
    };

  const handleStoneImageLoad =
    (stone: InventoryStone) => (event: SyntheticEvent<HTMLImageElement>) => {
      stoneImageHandlers(stone).onLoad(event);
    };

  const renderStoneCard = (
    stone: InventoryStone,
    priority: "high" | "eager" | "lazy",
    wrapperClassName: string,
    categoryLabel?: string,
    compact = false
  ) => {
    const stoneDisplayName = getStoneDisplayName(stone);
    const hasPublicStoneName = stoneDisplayName.length > 0;
    const stoneShareTitle = hasPublicStoneName ? stoneDisplayName : "Current stone selection";
    const stoneShareText = hasPublicStoneName
      ? `${stoneDisplayName} from ${displayName}`
      : `View this stone selection from ${displayName} and request current availability.`;
    const leadShareIndex = profileInventoryShareIndexForDisplay(
      stone.images,
      stone.shareImageOrder,
      0
    );

    return (
      <article
        key={stone.slug}
        className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#241d0f]/15 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/60 hover:shadow-lg ${wrapperClassName}`}
        data-testid="profile-inventory-card"
      >
        <div
          className={`relative overflow-hidden bg-stone-200 ${
            compact ? "min-h-24 aspect-[8/5] sm:h-40 sm:min-h-0 sm:aspect-auto" : "h-52"
          }`}
          data-testid="profile-inventory-card-media"
        >
          <button
            type="button"
            onClick={() => {
              setOpenStone(stone);
              setOpenImageIndex(0);
            }}
            className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-accent)]"
            aria-label={
              hasPublicStoneName
                ? `View details for ${stoneDisplayName}`
                : "View stone selection details"
            }
          >
            {stone.images[0] ? (
              <img
                src={stone.images[0]}
                alt={hasPublicStoneName ? stoneDisplayName : "Stone selection"}
                loading={priority === "lazy" ? "lazy" : "eager"}
                {...(priority === "high"
                  ? ({ fetchpriority: "high" } as Record<string, string>)
                  : {})}
                data-fallback-index="0"
                onError={handleStoneImageError(stone)}
                onLoad={handleStoneImageLoad(stone)}
                className={`h-full w-full bg-stone-200 object-contain transition-transform duration-300 group-hover:scale-[1.02] ${
                  compact ? "p-0 sm:p-1" : "p-1"
                }`}
              />
            ) : (
              <span className="flex h-full items-center justify-center px-5 text-sm font-semibold text-stone-600">
                Photo coming soon
              </span>
            )}
          </button>
          <span
            className={`pointer-events-none absolute rounded-full border border-white/35 bg-black/65 font-bold uppercase text-white backdrop-blur-sm ${
              compact
                ? "left-1.5 top-1.5 px-1.5 py-0.5 text-[7px] tracking-[0.04em] sm:left-2 sm:top-2 sm:text-[8px]"
                : "left-3 top-3 px-2.5 py-1 text-[10px] tracking-wide"
            }`}
            data-testid="profile-inventory-card-status"
          >
            {stone.materialStatus === "unconfirmed"
              ? compact
                ? "Confirm"
                : "Material to confirm"
              : compact
                ? "Collection"
                : "Current collection"}
          </span>
          <ShareButton
            destination={
              buildProfilePublicItemPath({
                profileBasePath: profileShareDestination,
                itemType: "inventory",
                itemSlug: stone.slug,
                imageIndex: leadShareIndex,
                contentBlocks,
              }) || profileShareDestination
            }
            title={stoneShareTitle}
            text={stoneShareText}
            imageUrl={inventorySocialPreviewImageUrl(stone, leadShareIndex)}
            size="icon"
            label=""
            className={`absolute rounded-full border-white/25 bg-black/70 p-0 text-white hover:bg-black focus-visible:ring-inset ${
              compact
                ? "right-1.5 top-1.5 h-8 w-8 [&_svg]:!h-3.5 [&_svg]:!w-3.5 after:absolute after:-inset-1 after:rounded-full after:content-[''] sm:right-2 sm:top-2 sm:h-9 sm:w-9"
                : "right-3 top-3"
            }`}
          />
          {stone.images.length > 1 ? (
            <span
              className={`pointer-events-none absolute rounded-full bg-black/65 font-semibold text-white ${
                compact
                  ? "bottom-1.5 right-1.5 px-1.5 py-0.5 text-[8px] leading-none sm:bottom-2 sm:right-2 sm:text-[9px]"
                  : "bottom-3 right-3 px-2.5 py-1 text-[11px]"
              }`}
              data-testid="profile-inventory-card-photo-count"
            >
              {stone.images.length} photos
            </span>
          ) : null}
        </div>
        <div
          className={`flex min-w-0 flex-1 flex-col ${compact ? "px-2 pb-2 pt-1.5 sm:p-3" : "p-4"}`}
        >
          {categoryLabel ? (
            <p
              className={`truncate font-bold uppercase tracking-wide text-[var(--brand-primary)]/60 ${
                compact ? "text-[8px] sm:text-[10px]" : "text-[11px]"
              }`}
            >
              {categoryLabel}
            </p>
          ) : null}
          {hasPublicStoneName ? (
            <p
              data-testid="profile-inventory-name"
              className={`font-extrabold !text-[#241d0f] ${
                compact
                  ? "line-clamp-2 min-h-7 text-xs leading-tight sm:min-h-0 sm:text-sm"
                  : "text-base"
              }`}
            >
              {stoneDisplayName}
            </p>
          ) : (
            <p
              data-testid="profile-inventory-availability"
              className={`font-semibold !text-[#4a4238] ${
                compact ? "text-[10px] leading-snug sm:text-xs" : "text-sm"
              }`}
            >
              {UNKNOWN_STONE_AVAILABILITY_COPY}
            </p>
          )}
          {stone.slabCounts?.length ? (
            <p
              className={`mt-1 font-bold text-[var(--brand-primary)] ${
                compact ? "hidden text-xs sm:block" : "text-sm"
              }`}
            >
              {stone.slabCounts.length === 1
                ? `Source slab count: ${stone.slabCounts[0]} ${
                    stone.slabCounts[0] === 1 ? "slab" : "slabs"
                  }`
                : `Source bundle counts: ${stone.slabCounts.join(", ")} slabs`}
            </p>
          ) : null}
          {!stone.hideFinishDetails && stone.materialStatus !== "unconfirmed" ? (
            <p
              className={`mt-1 text-xs font-medium !text-[#4a4238] ${
                compact ? "hidden sm:block" : ""
              }`}
            >
              {stone.finishes?.length
                ? stone.finishes.join(" · ")
                : `Finish details: ask ${displayName}`}
            </p>
          ) : null}
          {stone.materialStatus === "unconfirmed" ? (
            <span
              className={`mt-2 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 ${
                compact ? "hidden sm:inline-flex" : "inline-flex"
              }`}
            >
              {stoneConfirmationLabel(stone)}
            </span>
          ) : null}
          <div
            className={`grid grid-cols-2 ${
              compact ? "mt-auto gap-1 pt-1.5 sm:gap-2 sm:pt-3" : "mt-4 gap-2"
            }`}
            data-testid="profile-inventory-card-actions"
          >
            <button
              type="button"
              aria-label={
                hasPublicStoneName
                  ? `View details for ${stoneDisplayName}`
                  : "View stone selection details"
              }
              onClick={() => {
                setOpenStone(stone);
                setOpenImageIndex(0);
              }}
              className={`border border-[var(--brand-primary)]/20 font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary)] ${
                compact
                  ? "relative min-h-9 rounded-lg px-1 text-[9px] leading-none after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] sm:min-h-10 sm:px-3 sm:text-[11px]"
                  : "min-h-10 rounded-xl px-3 text-xs"
              }`}
            >
              {compact ? "Details" : "View details"}
            </button>
            <button
              type="button"
              aria-label={
                hasPublicStoneName
                  ? `Ask about ${stoneDisplayName}`
                  : "Ask about availability for this stone selection"
              }
              onClick={() =>
                startDirectConnect(
                  hasPublicStoneName ? stoneDisplayName : null,
                  "request_material",
                  stone.slug
                )
              }
              className={`border border-[var(--brand-accent)]/40 font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-accent)] ${
                compact
                  ? "relative min-h-9 rounded-lg px-1 text-[9px] leading-none after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] sm:min-h-10 sm:px-3 sm:text-[11px]"
                  : "min-h-10 rounded-xl px-3 text-xs"
              }`}
            >
              {compact
                ? "Ask"
                : hasPublicStoneName
                  ? `Ask about ${stoneDisplayName}`
                  : "Ask about availability"}
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div
      className={`wholesaler-public-profile flex min-h-full flex-col bg-[var(--brand-bg)] !text-stone-900 ${
        centeredBrandHeader ? "pt-14 sm:pt-[96px] md:pt-[112px]" : ""
      }`}
      // eslint-disable-next-line no-restricted-syntax -- sets CSS custom properties for per-business dynamic brand colors, not literal color values
      style={themeVars}
    >
      <header
        className={`${
          centeredBrandHeader
            ? "fixed inset-x-0 top-0 z-40 shadow-md"
            : "sticky top-0 z-20 shadow-sm"
        } border-b border-[var(--brand-primary)]/10 bg-[var(--brand-bg)]`}
      >
        <div
          className={`container mx-auto items-center px-3 md:px-8 ${
            centeredBrandHeader
              ? "grid h-14 grid-cols-[44px_1fr_auto] gap-1 md:h-[72px] md:grid-cols-[1fr_auto_1fr]"
              : "flex justify-between gap-3 py-2 md:py-3"
          }`}
        >
          {centeredBrandHeader ? (
            <>
              {isProfileHome ? (
                <span className="inline-flex h-10 w-10 justify-self-start" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={goBackWithinProfile}
                  aria-label={presentation.header?.backLabel || `Back within ${displayName}`}
                  title={presentation.header?.backLabel || `Back within ${displayName}`}
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
                  filterToCategory("all");
                  setInventorySearch("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center justify-center"
                aria-label={presentation.header?.homeLabel || `${displayName} home`}
              >
                <img
                  src={presentation.header?.logoUrl}
                  alt={presentation.header?.logoAlt || displayName}
                  className="h-auto w-[132px] sm:w-[164px] md:w-[204px]"
                />
              </button>
              <div className="flex items-center justify-self-end gap-2">
                {presentationYouTubeUrl ? (
                  <a
                    href={presentationYouTubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Watch ${displayName} on YouTube`}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#ff0000]/45 bg-black/10 text-[#ff0000] transition-colors hover:bg-[#ff0000]/20"
                  >
                    <Youtube className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Watch {displayName} on YouTube</span>
                  </a>
                ) : null}
                <ShareButton
                  destination={activePageShareDestination}
                  title={activePageShareTitle}
                  text={`Check out ${activePageShareTitle}`}
                  imageUrl={activePageSocialPreviewImageUrl}
                  size="icon"
                  label=""
                  className="rounded-full border-[var(--brand-primary)]/15 bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-surface)]"
                />
                <button
                  type="button"
                  onClick={() => startDirectConnect()}
                  aria-label={
                    presentation.header?.directConnectLabel || `Direct Connect with ${displayName}`
                  }
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
                  {stickySubtitle}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {presentationYouTubeUrl ? (
                  <a
                    href={presentationYouTubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Watch ${displayName} on YouTube`}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#ff0000]/45 bg-black/10 text-[#ff0000] transition-colors hover:bg-[#ff0000]/20"
                  >
                    <Youtube className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Watch {displayName} on YouTube</span>
                  </a>
                ) : null}
                <ShareButton
                  destination={activePageShareDestination}
                  title={activePageShareTitle}
                  text={`Check out ${activePageShareTitle} on TradeScout`}
                  imageUrl={activePageSocialPreviewImageUrl}
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
            centeredBrandHeader
              ? "hidden h-10 gap-4 px-3 pb-2 text-[11px] font-bold sm:flex md:gap-5 md:px-8 md:text-xs"
              : "hidden gap-5 px-5 pb-2 text-xs font-semibold md:flex md:px-8"
          }`}
        >
          {compactInventory && allInventoryStones.length > 0 ? (
            <button
              type="button"
              onClick={openFullInventory}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-[#16200b] shadow-sm"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Browse full inventory
            </button>
          ) : null}
          {(isLuxPresentation(premiumProductData?.presentation)
            ? [
                ["Light", "designed-with-light"],
                ["Materials", "material-chapters"],
                ["Showcase", "showcase"],
                ["Consult", "consult"],
              ]
            : premiumProductData?.presentation === "horizontal-luxury-showcase"
              ? [
                  ["Lookbook", "collection"],
                  ["Connect", "connect"],
                ]
              : premiumProductData
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
        className={`relative isolate overflow-hidden ${
          isIssaBuild
            ? // Landscape 16:9 film: mobile uses aspect-video (full horizontal scene).
              // Desktop keeps a cinematic stage with cover — never a tall portrait crop.
              "flex flex-col bg-black md:block md:h-[min(70svh,calc(100svh-var(--ts-profile-top-offset,0px)-4.5rem))] md:max-h-[78svh]"
            : brandShowcase
              ? "flex items-end bg-transparent py-8 md:min-h-[600px] md:items-center md:py-20"
              : "flex min-h-[min(690px,calc(100svh-150px))] items-end bg-[var(--brand-primary)] bg-cover bg-center py-8 md:min-h-[500px] md:items-center md:py-20"
        }`}
        data-testid="wholesaler-profile-hero"
      >
        {!heroVideo && heroImage ? (
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-center ${
              preserveHeroMedia || isIssaBuild ? "bg-transparent" : "bg-stone-950"
            } ${premiumProductData && !isIssaBuild ? "object-contain" : "object-cover"}`}
          />
        ) : null}
        {heroVideo && isIssaBuild ? (
          <div
            className="pointer-events-none relative aspect-video w-full shrink-0 overflow-hidden bg-black md:absolute md:inset-0 md:aspect-auto md:h-full"
            aria-hidden="true"
            data-testid="issa-hero-media"
          >
            {/*
              Asset is landscape (1280×720). Mobile frame matches aspect-video so
              object-cover shows the full room — not a vertical center-slice.
            */}
            <video
              ref={heroVideoRef}
              autoPlay={!prefersReducedMotion}
              muted
              loop
              playsInline
              preload="auto"
              poster={heroVideo.poster}
              onLoadedData={() => setIssaHeroReady(true)}
              onPlaying={() => setIssaHeroReady(true)}
              className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
                issaHeroReady || prefersReducedMotion ? "opacity-100" : "opacity-0"
              }`}
            >
              <source src={heroVideo.src} type="video/mp4" />
            </video>
            {!issaHeroReady && !prefersReducedMotion ? (
              <img
                src={heroVideo.poster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : null}
            {/* No full-bleed scrim on ISSA hero film — copy uses a translucent panel. */}
          </div>
        ) : null}
        {heroVideo && !isIssaBuild ? (
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
        {/* Profile-owned preserveMedia keeps source video or imagery unobscured. */}
        {!preserveHeroMedia && !isIssaBuild ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,14,8,0.22)_0%,rgba(20,14,8,0.54)_42%,rgba(20,14,8,0.96)_100%)] md:bg-[linear-gradient(90deg,rgba(20,14,8,0.82)_0%,rgba(20,14,8,0.5)_55%,rgba(20,14,8,0.26)_100%)]"
          />
        ) : null}
        <div
          className={`relative z-10 container mx-auto px-5 text-left ${
            isIssaBuild
              ? "w-full bg-[#0c0a08] py-6 md:absolute md:inset-0 md:flex md:flex-col md:justify-end md:bg-transparent md:px-10 md:pb-10 md:pt-0"
              : presentation.hero?.align === "left" || brandShowcase
                ? "md:px-8"
                : "md:px-6 md:text-center"
          }`}
        >
          <div
            className={
              isIssaBuild
                ? "md:max-w-2xl md:bg-black/45 md:p-6 md:backdrop-blur-sm lg:p-7"
                : undefined
            }
          >
            {heroEyebrow ? (
              isIssaBuild ? (
                <p
                  className={`mb-3 text-[10px] font-medium uppercase tracking-[0.36em] text-[var(--brand-accent)] md:mb-4 ${heroReveal(1)}`}
                >
                  {heroEyebrow}
                </p>
              ) : (
                <span
                  className={`mb-3 inline-block rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white md:mb-6 md:px-4 md:text-xs ${
                    brandShowcase
                      ? "border-white/40 bg-black/35"
                      : "border-white/25 bg-black/25 backdrop-blur-sm"
                  } ${heroReveal(1)}`}
                >
                  {heroEyebrow}
                </span>
              )
            ) : null}
            <h1
              className={`mb-3 max-w-[18ch] text-white md:mb-5 md:max-w-3xl md:leading-tight ${
                isIssaBuild
                  ? "font-editorial text-[2.75rem] font-medium leading-[0.98] tracking-[-0.02em] sm:text-5xl md:text-6xl"
                  : brandShowcase
                    ? `text-[2.2rem] font-bold leading-[1.02] [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] md:text-[2.7rem] md:leading-[0.96] ${DISPLAY_FONT}`
                    : `text-[2.55rem] font-bold leading-[0.98] [text-shadow:0_2px_18px_rgba(0,0,0,0.5)] md:mx-auto ${DISPLAY_FONT}`
              } ${heroReveal(2)}`}
            >
              {heroHeadline}
            </h1>
            {heroTeaser ? (
              <p
                className={`mb-5 max-w-[34rem] text-white md:mb-7 ${
                  isIssaBuild
                    ? "max-w-xl text-sm font-light leading-7 text-white/85 sm:text-base sm:leading-8"
                    : brandShowcase
                      ? "text-sm font-medium leading-relaxed [text-shadow:0_1px_6px_rgba(0,0,0,0.55)] md:text-base"
                      : "text-sm leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.65)] md:mx-auto md:text-lg"
                } ${heroReveal(3)}`}
              >
                {heroTeaser}
              </p>
            ) : null}
            <div
              className={`flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-3 ${
                isIssaBuild
                  ? "max-w-[36rem] items-start gap-4 sm:items-center"
                  : brandShowcase
                    ? "max-w-[38rem]"
                    : "md:justify-center"
              } ${heroReveal(4)}`}
            >
              {compactInventory && allInventoryStones.length > 0 ? (
                <button
                  type="button"
                  onClick={openFullInventory}
                  data-testid="profile-hero-inventory-cta"
                  className="group flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-accent)] bg-[#17100b] px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5 hover:bg-black focus-visible:ring-white/80 md:min-h-14 md:rounded-full md:py-3.5"
                >
                  Browse full inventory
                  <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : isLuxPresentation(premiumProductData?.presentation) ? (
                <>
                  <button
                    type="button"
                    onClick={() => startDirectConnect()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--brand-accent)]/70 bg-[var(--brand-accent)] px-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#17100b] transition hover:bg-[var(--brand-accent)]/90"
                  >
                    Start a consultation
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:text-white"
                  >
                    View installed work
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })
                    }
                    className={
                      isIssaBuild
                        ? "group flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-accent)] bg-[var(--brand-bg)]/92 px-6 py-3 text-sm font-extrabold text-[var(--brand-accent)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-bg)] md:min-h-14 md:rounded-full md:py-3.5"
                        : "flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-accent)] bg-white/12 px-7 py-3.5 text-sm font-extrabold text-[var(--brand-accent)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/20"
                    }
                  >
                    {isIssaBuild
                      ? "Lookbook"
                      : premiumProductData
                        ? "See the material"
                        : "Explore Inventory"}
                    {isIssaBuild ? (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => startDirectConnect()}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-ts-orange px-6 py-3 text-sm font-extrabold transition-colors md:min-h-14 md:rounded-full md:py-3.5 ${
                      brandShowcase || isIssaBuild
                        ? "bg-[var(--brand-bg)]/92 text-ts-orange shadow-sm hover:bg-[var(--brand-bg)]"
                        : "bg-white/12 text-ts-orange-light backdrop-blur-xl hover:bg-white/20"
                    }`}
                  >
                    Direct Connect
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {!isLuxuryMaterialHouse ? (
        <section
          className="border-b border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] py-5"
          aria-label="Trust and profile actions"
          data-testid="profile-trust-section"
        >
          <div className="container mx-auto max-w-3xl px-4 md:px-6">{trustActions}</div>
          {isIssaBuild && trustFacts.length > 0 ? (
            <div
              className="container mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary)]/75 md:px-6"
              data-testid="issa-trust-facts"
            >
              {trustFacts.map((fact, i) => (
                <span key={fact} className="inline-flex items-center">
                  {i > 0 ? (
                    <span className="mr-3 text-[var(--brand-primary)]/25" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {fact}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {isLuxuryMaterialHouse ? (
        premiumProductData?.luxuryHouse && luxuryHouseFeaturedProduct ? (
          <PremiumProductProfileSections
            profileName={displayName}
            product={luxuryHouseFeaturedProduct}
            products={luxuryHouseProducts}
            initialProductSlug={premiumSharedItem?.slug}
            initialPhotoIndex={premiumSharedItem?.imageIndex}
            data={premiumProductData}
            trustFacts={trustFacts}
            faqItems={faqItems}
            profileShareDestination={profileShareDestination}
            publicRouteContentBlocks={contentBlocks}
            platformBaseHref={platformBaseHref}
            onDirectConnect={startDirectConnectFromTarget}
            platformEngagement={
              <div data-testid="profile-trust-section">
                <div className="container mx-auto max-w-3xl px-4 md:px-6">{trustActions}</div>
              </div>
            }
          />
        ) : (
          <section
            className="bg-[var(--brand-bg)] px-4 py-16 text-center md:px-6"
            data-testid="luxury-material-house-unavailable"
          >
            <div className="mx-auto max-w-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-accent)]">
                Presentation unavailable
              </p>
              <h2 className={`mt-3 text-2xl font-bold text-[var(--brand-primary)] ${DISPLAY_FONT}`}>
                This material house cannot be shown right now.
              </h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-[var(--brand-primary)]/70">
                The Lux presentation is locked for this profile. Inventory browsing is not shown as
                a fallback.
              </p>
              <button
                type="button"
                onClick={() => startDirectConnect()}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 border-2 border-ts-orange bg-[var(--brand-primary)] px-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-ts-orange"
              >
                <MessageCircle className="h-4 w-4" />
                Direct Connect
              </button>
            </div>
          </section>
        )
      ) : premiumProductData && premiumProduct ? (
        <PremiumProductProfileSections
          profileName={displayName}
          product={premiumProduct}
          products={premiumInventoryStones}
          initialProductSlug={premiumSharedItem?.slug}
          initialPhotoIndex={premiumSharedItem?.imageIndex}
          data={premiumProductData}
          trustFacts={trustFacts}
          faqItems={faqItems}
          profileShareDestination={profileShareDestination}
          publicRouteContentBlocks={contentBlocks}
          platformBaseHref={platformBaseHref}
          onDirectConnect={startDirectConnectFromTarget}
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

          {guidedAudience ? (
            <section
              id="audience"
              className="scroll-mt-28 border-b border-[#241d0f]/10 bg-white py-6 md:py-10"
              data-testid="profile-audience-chooser"
            >
              <div className="container mx-auto px-4 md:px-6">
                <div className="mb-4 max-w-2xl md:mb-5">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--brand-accent)]">
                    Start with your project
                  </p>
                  <h2
                    className={`mt-1.5 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                  >
                    {audienceTitle}
                  </h2>
                </div>

                <div
                  role="tablist"
                  aria-label={`${displayName} customer types`}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  data-testid="profile-audience-tabs"
                >
                  {audiencePaths.map((path, index) => {
                    const Icon = path.icon;
                    const selected = index === activeAudienceIndex;
                    return (
                      <button
                        key={`${path.label}-${index}`}
                        id={`audience-tab-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls="audience-panel"
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setActiveAudienceIndex(index)}
                        onKeyDown={(event) => {
                          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                            return;
                          }
                          event.preventDefault();
                          const nextIndex =
                            event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? audiencePaths.length - 1
                                : (index +
                                    (event.key === "ArrowRight" ? 1 : -1) +
                                    audiencePaths.length) %
                                  audiencePaths.length;
                          setActiveAudienceIndex(nextIndex);
                          document.getElementById(`audience-tab-${nextIndex}`)?.focus();
                        }}
                        className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold leading-tight transition-colors sm:text-xs ${
                          selected
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                            : "border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] text-[var(--brand-primary)] hover:border-[var(--brand-accent)]/50"
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{path.label}</span>
                      </button>
                    );
                  })}
                </div>

                <article
                  id="audience-panel"
                  role="tabpanel"
                  aria-labelledby={`audience-tab-${activeAudienceIndex}`}
                  className="mt-3 grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] md:gap-5 md:p-6"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 md:h-10 md:w-10">
                        <ActiveAudienceIcon className="h-4 w-4 text-[var(--brand-primary)] md:h-5 md:w-5" />
                      </span>
                      <h3 className="text-base font-extrabold !text-[#241d0f] md:text-lg">
                        {activeAudiencePath.label}
                      </h3>
                    </div>
                    <p className="mt-2 max-w-2xl text-xs leading-relaxed !text-[#4a4238] md:mt-3 md:text-sm">
                      {activeAudiencePath.body}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4 md:gap-2">
                      {(
                        presentation.audience?.availableFacts || [
                          "Stone photos",
                          "Material categories",
                          "Confirmed finishes where listed",
                          "Source counts where listed",
                        ]
                      ).map((fact) => (
                        <span
                          key={fact}
                          className="flex-none rounded-full border border-[var(--brand-primary)]/15 bg-white px-2 py-1 text-[10px] font-semibold text-[var(--brand-primary)] md:px-3 md:text-[11px]"
                        >
                          {fact}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <details className="group rounded-xl border border-[#241d0f]/10 bg-white">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-accent)] [&::-webkit-details-marker]:hidden md:hidden">
                        <span>
                          {presentation.audience?.contextHeading || "Helpful context to include"}
                        </span>
                        <ChevronRight className="h-4 w-4 flex-none transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="hidden border-t border-[#241d0f]/10 p-3 group-open:block md:block md:border-0 md:p-4">
                        <p className="hidden text-[11px] font-extrabold uppercase tracking-[0.15em] text-[var(--brand-accent)] md:block">
                          {presentation.audience?.contextHeading || "Helpful context to include"}
                        </p>
                        <ul className="space-y-2 text-xs !text-[#4a4238] md:mt-3 md:text-sm">
                          {activeAudiencePath.review.map((detail) => (
                            <li key={detail} className="flex gap-2">
                              <span
                                className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--brand-accent)]"
                                aria-hidden="true"
                              />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                      <button
                        type="button"
                        onClick={openFullInventory}
                        className="min-h-11 rounded-xl border border-[var(--brand-primary)]/20 bg-white px-4 text-xs font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/5"
                      >
                        Browse all {allInventoryStones.length} stones
                      </button>
                      <button
                        type="button"
                        onClick={() => startDirectConnect(null, activeAudiencePath.requestType)}
                        className="min-h-12 rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-4 text-xs font-extrabold text-white shadow-sm transition hover:brightness-95"
                      >
                        {activeAudiencePath.actionLabel}
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {/* Live stone collection */}
          {inventoryCatalog.length > 0 ? (
            <section
              id="collection"
              className={`scroll-mt-28 bg-[var(--brand-bg)] ${
                compactInventory ? "border-t border-[#241d0f]/10 pt-10 md:pt-14" : "py-8 md:py-11"
              }`}
            >
              <div className="container mx-auto px-4 md:px-6">
                {featuredStones.length > 0 && !inventoryExpanded ? (
                  <div className="mb-0">
                    <div className="mb-5 max-w-2xl">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--brand-accent)] md:text-xs">
                        Featured stones
                      </p>
                      <h2
                        className={`mt-1.5 text-[1.7rem] font-extrabold leading-tight text-[var(--brand-primary)] md:text-4xl ${DISPLAY_FONT}`}
                      >
                        Stone worth building around.
                      </h2>
                    </div>
                    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
                      {featuredStones.map((offer, offerIndex) => {
                        const stone = offer.stone;
                        if (!stone) return null;
                        const stoneDisplayName = getStoneDisplayName(stone);
                        const leadShareIndex = profileInventoryShareIndexForDisplay(
                          stone.images,
                          stone.shareImageOrder,
                          0
                        );
                        return (
                          <article
                            key={offer.slug}
                            className="group flex w-[82vw] max-w-[320px] flex-none snap-start flex-col overflow-hidden rounded-xl border border-[#241d0f]/15 bg-white text-left shadow-[0_10px_30px_rgba(36,29,15,0.08)] transition duration-300 hover:-translate-y-1 hover:border-[var(--brand-accent)]/55 hover:shadow-[0_18px_40px_rgba(36,29,15,0.14)] sm:w-auto sm:max-w-none sm:rounded-2xl"
                            data-testid="profile-featured-product-card"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e5dc]">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenStone(stone);
                                  setOpenImageIndex(0);
                                }}
                                className="block h-full w-full"
                                aria-label={`View details for ${stoneDisplayName}`}
                              >
                                <img
                                  src={stone.images[0]}
                                  alt={stoneDisplayName}
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
                                destination={
                                  buildProfilePublicItemPath({
                                    profileBasePath: profileShareDestination,
                                    itemType: "inventory",
                                    itemSlug: stone.slug,
                                    imageIndex: leadShareIndex,
                                    contentBlocks,
                                  }) || profileShareDestination
                                }
                                title={stoneDisplayName}
                                text={`${stoneDisplayName} at ${displayName}`}
                                imageUrl={inventorySocialPreviewImageUrl(stone, leadShareIndex)}
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
                                {stoneDisplayName}
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
                                  onClick={() =>
                                    startDirectConnect(
                                      stoneDisplayName,
                                      "request_material",
                                      stone.slug
                                    )
                                  }
                                  className="min-h-10 rounded-xl border border-[var(--brand-accent)]/40 px-2 text-[10px] font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10 sm:text-xs"
                                >
                                  Ask about {stoneDisplayName}
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
                  compactInventory ? (
                    <div className="-mx-4 mt-0 md:-mx-6">
                      <button
                        type="button"
                        onClick={openFullInventory}
                        className="group relative flex min-h-[320px] w-full items-center justify-center overflow-hidden bg-[var(--brand-primary-dark)] px-7 py-10 text-center text-white sm:min-h-[340px] sm:px-10"
                      >
                        {inventoryBrowseCtaImage ? (
                          <img
                            src={inventoryBrowseCtaImage}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.025]"
                          />
                        ) : null}
                        <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,15,18,0.66)_0%,rgba(7,15,18,0.48)_58%,rgba(7,15,18,0.24)_100%)]" />
                        <span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-accent)]" />
                        <span className="relative z-10 flex min-w-0 max-w-[34rem] flex-col items-center">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-accent)] sm:text-xs">
                            {inventoryBrowseCtaEyebrow}
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
                        {inventoryDescription ? (
                          <p className="mt-2 text-sm leading-relaxed !text-[#4a4238] md:text-base">
                            {inventoryDescription}
                          </p>
                        ) : null}
                      </div>
                      {allInventoryStones.length === 1 ? (
                        <div className={SCROLL_ROW}>
                          {renderStoneCard(allInventoryStones[0], "high", SCROLL_CARD)}
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
                    <div
                      className="mb-6 flex flex-wrap items-end justify-between gap-3"
                      data-public-inventory-category={sharedInventoryCategory?.slug}
                    >
                      <div>
                        <h2
                          className={`mb-1 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
                        >
                          {sharedInventoryCategory?.name || inventoryTitle}
                        </h2>
                        {sharedInventoryCategory?.summary || inventoryDescription ? (
                          <p className="max-w-3xl text-sm !text-[#4a4238]">
                            {sharedInventoryCategory?.summary || inventoryDescription}
                          </p>
                        ) : null}
                        {sharedInventoryCategory ? (
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]/65">
                            {sharedInventoryCategory.itemCount} current{" "}
                            {sharedInventoryCategory.itemCount === 1 ? "selection" : "selections"}
                          </p>
                        ) : null}
                      </div>
                      {featuredStones.length > 0 ? (
                        <button
                          type="button"
                          onClick={showFeaturedInventory}
                          className="min-h-10 rounded-xl border border-[var(--brand-primary)]/15 px-4 text-xs font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-surface)]"
                        >
                          Show featured view
                        </button>
                      ) : null}
                    </div>

                    <div
                      className={`mb-6 rounded-2xl border border-[#241d0f]/15 bg-white p-3 shadow-sm md:p-4 ${
                        stickyInventoryControls
                          ? "sticky top-14 z-20 sm:top-[96px] md:top-[112px]"
                          : ""
                      }`}
                    >
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
                            onChange={(event) => filterToCategory(event.target.value)}
                            className="min-h-12 w-full appearance-none rounded-xl border border-[var(--brand-primary)]/15 !bg-white px-4 pr-10 text-sm font-semibold !text-stone-900 outline-none focus:border-[var(--brand-primary)]/50"
                          >
                            <option value="all">All stone ({allInventoryStones.length})</option>
                            {featuredCollectionSlugSet.size > 0 ? (
                              <option value="featured">
                                {featuredCollectionLabel} ({featuredCollectionSlugSet.size})
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
                              filterToCategory("all");
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

                    {hasInventoryFilters || compactInventory ? (
                      <>
                        <div
                          className={
                            compactInventory
                              ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5"
                              : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                          }
                        >
                          {displayedStones.map((stone, stoneIndex) =>
                            renderStoneCard(
                              stone,
                              stoneIndex < 4 ? "high" : stoneIndex < 8 ? "eager" : "lazy",
                              "",
                              compactInventory ? stoneCategoryBySlug.get(stone.slug) : undefined,
                              compactInventory
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
                              {sourceRequestsEnabled && normalizedInventorySearch
                                ? `${displayName} may be able to source it for your project.`
                                : `Try another spelling or send ${displayName} a request for help.`}
                            </p>
                            {sourceRequestsEnabled && normalizedInventorySearch ? (
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
                              onClick={() =>
                                setInventoryVisibleLimit((current) => current + inventoryPageStep)
                              }
                              className="rounded-xl bg-[var(--brand-primary)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-primary-dark)]"
                            >
                              Show {inventoryPageStep} more
                            </button>
                            <p className="text-xs text-[#241d0f]/75">
                              Showing {displayedStones.length} of {visibleStones.length}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="space-y-10">
                        {featuredCollectionSlugSet.size > 0 ? (
                          <div>
                            <div className="mb-3 flex items-end justify-between gap-3">
                              <h3 className="text-lg font-bold text-[var(--brand-primary)]">
                                {featuredCollectionLabel}
                              </h3>
                              <button
                                type="button"
                                onClick={() => filterToCategory("featured")}
                                className="text-sm font-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline"
                              >
                                View all
                              </button>
                            </div>
                            <div className={SCROLL_ROW}>
                              {allInventoryStones
                                .filter(
                                  (stone) =>
                                    featuredCollectionSlugSet.has(stone.slug) &&
                                    stone.materialStatus !== "unconfirmed"
                                )
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
                        {inventoryCatalog
                          .filter((category) => category.stones.length > 1)
                          .map((category) => (
                            <div key={category.categorySlug}>
                              <div className="mb-3 flex items-end justify-between gap-3">
                                <h3 className="text-lg font-bold text-[var(--brand-primary)]">
                                  {category.category}
                                </h3>
                                {category.stones.length > 12 ? (
                                  <button
                                    type="button"
                                    onClick={() => filterToCategory(category.categorySlug)}
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
                        {/* Categories with just one stone each get their own full
                          header + rail if left in the loop above -- a page of
                          single-item sections for e.g. Basalt, Onyx, etc. Group
                          them into one shared rail instead, tagged by category. */}
                        {(() => {
                          const singleStoneCategories = inventoryCatalog
                            .filter((category) => category.stones.length === 1)
                            .sort((a, b) => {
                              const aUnconfirmed = a.stones[0].materialStatus === "unconfirmed";
                              const bUnconfirmed = b.stones[0].materialStatus === "unconfirmed";
                              return aUnconfirmed === bUnconfirmed ? 0 : aUnconfirmed ? 1 : -1;
                            });
                          if (singleStoneCategories.length === 0) return null;
                          return (
                            <div>
                              <div className="mb-3 flex items-end justify-between gap-3">
                                <h3 className="text-lg font-bold text-[var(--brand-primary)]">
                                  More stone
                                </h3>
                              </div>
                              <div className={SCROLL_ROW}>
                                {singleStoneCategories.map((category) =>
                                  renderStoneCard(
                                    category.stones[0],
                                    "lazy",
                                    SCROLL_CARD,
                                    category.category
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })()}
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
              aria-label={
                openStoneDisplayName
                  ? `${openStoneDisplayName} photo gallery`
                  : "Stone selection photo gallery"
              }
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpenStone(null);
              }}
            >
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#0f0d09]">
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div>
                    {openStoneDisplayName ? (
                      <h3 className={`text-lg font-bold text-white sm:text-xl ${DISPLAY_FONT}`}>
                        {openStoneDisplayName}
                      </h3>
                    ) : (
                      <p
                        data-testid="profile-gallery-availability"
                        className="text-sm font-semibold text-white/80"
                      >
                        {UNKNOWN_STONE_AVAILABILITY_COPY}
                      </p>
                    )}
                    {openStoneDisplayName && !openStone.hideFinishDetails ? (
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
                      destination={
                        buildProfilePublicItemPath({
                          profileBasePath: profileShareDestination,
                          itemType: "inventory",
                          itemSlug: openStone.slug,
                          imageIndex: profileInventoryShareIndexForDisplay(
                            openStone.images,
                            openStone.shareImageOrder,
                            openImageIndex
                          ),
                          contentBlocks,
                        }) || profileShareDestination
                      }
                      title={openStoneDisplayName || "Current stone selection"}
                      text={
                        openStoneDisplayName
                          ? `${openStoneDisplayName} from ${displayName}`
                          : `View this stone selection from ${displayName} and request current availability.`
                      }
                      imageUrl={inventorySocialPreviewImageUrl(
                        openStone,
                        profileInventoryShareIndexForDisplay(
                          openStone.images,
                          openStone.shareImageOrder,
                          openImageIndex
                        )
                      )}
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
                      {presentation.media?.fallbackLogoUrl ? (
                        <img
                          src={presentation.media.fallbackLogoUrl}
                          alt={presentation.media.fallbackLogoAlt || ""}
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
                      alt={
                        openStoneDisplayName
                          ? `${openStoneDisplayName} ${openImageIndex + 1}`
                          : `Stone selection photo ${openImageIndex + 1}`
                      }
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
                      const stoneName = openStoneDisplayName || null;
                      const stoneSlug = openStone.slug;
                      setOpenStone(null);
                      startDirectConnect(stoneName, "request_material", stoneSlug);
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

          {/* Profile-owned story photography stays separate from the inventory catalog. */}
          {storyImages.length > 0 ? (
            <section className="bg-[#17130d] py-10 text-white md:py-16">
              <div className="container mx-auto px-4 md:px-6">
                <div className="mb-6 max-w-2xl md:mb-8">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
                    {presentation.story?.eyebrow || "From source to finished space"}
                  </p>
                  {presentation.story?.heading ? (
                    <h2
                      className={`text-3xl font-bold leading-tight text-white md:text-5xl ${DISPLAY_FONT}`}
                    >
                      {presentation.story.heading}
                    </h2>
                  ) : null}
                </div>
                <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:gap-4 md:px-0">
                  {storyImages.map((image) => (
                    <figure
                      key={image.src}
                      className="group relative aspect-[16/10] w-[84vw] max-w-[520px] flex-none snap-start overflow-hidden rounded-2xl bg-black sm:w-[62vw] md:w-[42vw]"
                    >
                      <img
                        src={image.src}
                        alt={image.alt || ""}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-5 pt-16">
                        <figcaption className="text-sm font-semibold text-white md:text-base">
                          {image.label || displayName}
                        </figcaption>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* Audience paths */}
          {!guidedAudience ? (
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
          ) : null}

          {/* Featured materials */}
          {featuredStones.length > 0 ? (
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
                  {featuredStones.map(({ stone }, index) => (
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
                          aria-label={`View details for ${getStoneDisplayName(stone)}`}
                        >
                          <img
                            src={stone.images[0]}
                            alt={getStoneDisplayName(stone)}
                            loading={index === 0 ? "eager" : "lazy"}
                            className="h-full w-full bg-stone-200 object-contain p-1 transition-transform duration-300 hover:scale-[1.02]"
                          />
                        </button>
                        <ShareButton
                          destination={
                            buildProfilePublicItemPath({
                              profileBasePath: profileShareDestination,
                              itemType: "inventory",
                              itemSlug: stone.slug,
                              imageIndex: profileInventoryShareIndexForDisplay(
                                stone.images,
                                stone.shareImageOrder,
                                0
                              ),
                              contentBlocks,
                            }) || profileShareDestination
                          }
                          title={getStoneDisplayName(stone)}
                          text={`${getStoneDisplayName(stone)} at ${displayName}`}
                          imageUrl={inventorySocialPreviewImageUrl(
                            stone,
                            profileInventoryShareIndexForDisplay(
                              stone.images,
                              stone.shareImageOrder,
                              0
                            )
                          )}
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
                          {getStoneDisplayName(stone)}
                        </h3>
                        <p className="mt-1 text-sm !text-[#4a4238]">
                          {stone.finishes?.length
                            ? stone.finishes.join(" · ")
                            : `Current ${displayName} inventory`}
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
                          onClick={() =>
                            startDirectConnect(
                              getStoneDisplayName(stone),
                              "request_material",
                              stone.slug
                            )
                          }
                          className="w-full rounded-xl border border-[var(--brand-accent)]/40 px-4 py-3 text-sm font-extrabold text-[var(--brand-accent)] transition-colors hover:bg-[var(--brand-accent)]/10"
                        >
                          Ask about {getStoneDisplayName(stone)}
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
                          destination={
                            buildProfilePublicItemPath({
                              profileBasePath: profileShareDestination,
                              itemType: "gallery",
                              itemSlug: item.slug,
                              contentBlocks,
                            }) || profileShareDestination
                          }
                          title={`${item.title} by ${displayName}`}
                          text={`View ${item.title} from ${displayName} on TradeScout`}
                          imageUrl={gallerySocialPreviewImageUrl(item)}
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
                <div className={faqDisclosure ? "space-y-2" : "space-y-6"}>
                  {faqItems.map((faq, i) =>
                    faqDisclosure ? (
                      <details
                        key={i}
                        data-testid="profile-faq-item"
                        className="group rounded-xl border border-[var(--brand-primary)]/10 bg-white px-4 py-1"
                      >
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold text-[var(--brand-primary)] [&::-webkit-details-marker]:hidden">
                          <span>{faq.question || "More information"}</span>
                          <ChevronRight className="h-4 w-4 flex-none transition-transform group-open:rotate-90" />
                        </summary>
                        {faq.answer ? (
                          <p className="border-t border-[var(--brand-primary)]/10 pb-4 pt-3 text-[#241d0f]/70">
                            {faq.answer}
                          </p>
                        ) : null}
                      </details>
                    ) : (
                      <div key={i} className="border-b border-[var(--brand-primary)]/10 pb-6">
                        {faq.question ? (
                          <p className="mb-2 font-semibold text-[var(--brand-primary)]">
                            {faq.question}
                          </p>
                        ) : null}
                        {faq.answer ? <p className="text-[#241d0f]/70">{faq.answer}</p> : null}
                      </div>
                    )
                  )}
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
                  {recommendationsDirectory
                    .slice(
                      0,
                      recommendationsExpanded
                        ? recommendationMaxVisible
                        : recommendationInitialLimit
                    )
                    .map((entry) => (
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
                {recommendationsDirectory.length > recommendationInitialLimit ? (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      aria-expanded={recommendationsExpanded}
                      onClick={() => setRecommendationsExpanded((expanded) => !expanded)}
                      className="min-h-11 rounded-xl border border-[var(--brand-primary)]/20 px-5 text-sm font-bold text-[var(--brand-primary)] transition-colors hover:bg-white"
                    >
                      {recommendationsExpanded
                        ? "Show fewer recommendations"
                        : `Show all ${Math.min(
                            recommendationsDirectory.length,
                            recommendationMaxVisible
                          )} recommendations`}
                    </button>
                  </div>
                ) : null}
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
              {operatingHoursText ? (
                <p className="mx-auto mb-8 max-w-xl text-sm font-semibold text-white/80">
                  {operatingHoursText}
                </p>
              ) : null}
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
        </>
      )}

      {/* Shared TradeScout theme chrome — always outside premium lookbook content. */}
      <footer className="bg-[#241d0f] py-10 text-white/70" data-testid="wholesaler-brand-footer">
        <div className="container mx-auto px-4 text-center text-sm md:px-6">
          <p className={`mb-2 text-lg font-bold text-white ${DISPLAY_FONT}`}>{displayName}</p>
          <a
            href={qualifyPublicProfileItemDestination("/", platformBaseHref)}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md px-2 font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Powered by TradeScout
          </a>
        </div>
      </footer>

      <ExpressDirectConnectPanel
        open={expressPanelOpen}
        onClose={() => setExpressPanelOpen(false)}
        profileSlug={profileSlug}
        platformBaseHref={platformBaseHref}
        businessName={displayName}
        businessAddress={businessAddress}
        hasViewerSession={hasViewerSession}
        allowCall={allowExpressCall}
        stayInProfile
        requestMode="materials"
        initialStoneName={expressStoneName}
        initialItemId={expressItemId}
        initialRequestType={expressRequestType}
        contactOperatorName={contactOperatorName || undefined}
        contactOperatorRole={contactOperatorRole || undefined}
      />
    </div>
  );
}
