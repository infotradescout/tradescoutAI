import { useEffect, useState } from "react";
import { Link } from "wouter";
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
  X,
} from "lucide-react";

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
  displayName: string;
  headline: string | null;
  contentBlocks: ContentBlock[];
  categories: string[];
  serviceAreas: string[];
  brandColors?: WholesalerBrandColors;
  contactReason?: string | null;
  hasViewerSession: boolean;
  isSuperAdminViewer: boolean;
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

const DIRECT_CONNECT_OPTIONS = [
  "Request material",
  "Match a project",
  "Ask about a bundle",
  "Schedule a showroom visit",
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
    ? block.data.items.filter((i: unknown): i is string => typeof i === "string")
    : [];
}

export default function WholesalerProfileTheme({
  displayName,
  headline,
  contentBlocks,
  categories,
  serviceAreas,
  brandColors,
  contactReason,
  hasViewerSession,
  directConnectHref,
  preScoutCreateHref,
  preScoutSignInHref,
  recommendationsDirectory = [],
  recommendationDirectorySummary,
}: WholesalerProfileThemeProps) {
  useWholesalerThemeFonts();

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
  const [activeCategorySlug, setActiveCategorySlug] = useState(
    inventoryCatalog[0]?.categorySlug || ""
  );
  const [openStone, setOpenStone] = useState<InventoryStone | null>(null);
  const activeCategory =
    inventoryCatalog.find((c) => c.categorySlug === activeCategorySlug) || inventoryCatalog[0];
  const heroImage =
    inventoryCatalog.flatMap((c) => c.stones).flatMap((s) => s.images)[0] || galleryImages[0];
  // The hero is a glance, not a read -- keep it to one sentence and let the
  // "Why Us" section carry the fuller story for anyone who scrolls that far.
  const heroTeaser = aboutText.split(/(?<=[.!?])\s+/)[0] || aboutText;

  const ctaHref = hasViewerSession ? directConnectHref : preScoutCreateHref;

  return (
    <div className="min-h-full text-[#241d0f]" style={themeVars}>
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-[var(--brand-primary)]/10 bg-[var(--brand-bg)]">
        <div className="container mx-auto flex items-center justify-between gap-4 px-5 py-5 md:px-8">
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
          <Link href={ctaHref}>
            <button className="rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-dark)]">
              Direct Connect
            </button>
          </Link>
        </div>
        <div className="scrollbar-hide flex gap-6 overflow-x-auto px-5 pb-3.5 text-xs font-semibold uppercase tracking-wide text-[#241d0f] [-ms-overflow-style:none] [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
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
        className="relative overflow-hidden bg-[var(--brand-primary)] bg-cover bg-center py-20 md:py-32"
        style={
          heroImage
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.72)), url(${heroImage})`,
              }
            : undefined
        }
      >
        <div className="container mx-auto px-4 text-center md:px-6">
          {categories.length > 0 ? (
            <span className="mb-6 inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
              {categories.slice(0, 3).join(" · ")}
            </span>
          ) : null}
          <h1
            className={`mx-auto mb-6 max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl ${DISPLAY_FONT}`}
          >
            {headline || "Hand-selected stone. Direct from the source."}
          </h1>
          {heroTeaser ? (
            <p className="mx-auto mb-10 max-w-xl text-lg text-white/85">{heroTeaser}</p>
          ) : null}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#collection">
              <button className="flex items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Explore Inventory
              </button>
            </a>
            <Link href={ctaHref}>
              <button className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
                Direct Connect
                <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
            {!hasViewerSession ? (
              <Link href={preScoutSignInHref}>
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
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm font-semibold text-[#241d0f] md:px-6">
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
            <div className="mb-6">
              <h2
                className={`mb-1 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
              >
                Live Stone Collection
              </h2>
              <p className="text-sm text-[#241d0f]/70">
                Sorted by material. Tap a stone to see the full gallery -- no pricing shown here.
              </p>
            </div>

            <div className={`${SCROLL_ROW} mb-6`}>
              {inventoryCatalog.map((cat) => {
                const active = cat.categorySlug === activeCategory?.categorySlug;
                return (
                  <button
                    key={cat.categorySlug}
                    onClick={() => setActiveCategorySlug(cat.categorySlug)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                        : "border-[var(--brand-primary)]/20 bg-[var(--brand-surface)] text-[#241d0f]/70 hover:border-[var(--brand-primary)]/40"
                    }`}
                  >
                    {cat.category}
                    <span className="ml-1.5 opacity-70">({cat.stones.length})</span>
                  </button>
                );
              })}
            </div>

            <div className={SCROLL_ROW}>
              {(activeCategory?.stones || []).map((stone) => (
                <button
                  key={stone.slug}
                  onClick={() => setOpenStone(stone)}
                  className={`${SCROLL_CARD} overflow-hidden rounded-xl border-2 border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] text-left shadow-sm transition-colors hover:border-[var(--brand-accent)]/40`}
                >
                  {stone.images[0] ? (
                    <img
                      src={stone.images[0]}
                      alt={stone.name}
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                  ) : null}
                  <div className="p-4">
                    <p className="font-semibold text-[#241d0f]">{stone.name}</p>
                    {stone.images.length > 1 ? (
                      <p className="mt-1 text-xs text-[#241d0f]/50">{stone.images.length} photos</p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : inventoryItems.length > 0 ? (
        <section id="collection" className="scroll-mt-28 bg-[var(--brand-bg)] py-10 md:py-14">
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

      {/* Stone gallery modal */}
      {openStone ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpenStone(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-xl font-bold text-[var(--brand-primary)] ${DISPLAY_FONT}`}>
                {openStone.name}
              </h3>
              <button
                onClick={() => setOpenStone(null)}
                aria-label="Close gallery"
                className="rounded-full p-2 text-[#241d0f]/60 hover:bg-black/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {openStone.images.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${openStone.name} ${i + 1}`}
                  className="w-full rounded-lg object-cover"
                />
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <Link href={ctaHref}>
                <button className="rounded-full bg-[var(--brand-accent)] px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
                  Ask about this stone
                </button>
              </Link>
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

      {/* Audience paths */}
      <section id="audience" className="scroll-mt-28 bg-[var(--brand-bg)] py-10 md:py-14">
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
                <Link key={i} href={ctaHref} className={SCROLL_CARD}>
                  <div className="h-full cursor-pointer rounded-xl border-2 border-[var(--brand-primary)]/10 bg-[var(--brand-surface)] p-6 shadow-sm transition-colors hover:border-[var(--brand-accent)]/40">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                      <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                    </div>
                    <p className="mb-2 font-semibold text-[#241d0f]">{path.label}</p>
                    <p className="text-sm text-[#241d0f]/70">{path.body}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured materials */}
      {galleryImages.length > 0 ? (
        <section id="materials" className="scroll-mt-28 bg-[var(--brand-surface)] py-10 md:py-14">
          <div className="container mx-auto px-4 md:px-6">
            <h2
              className={`mb-6 text-2xl font-bold text-[var(--brand-primary)] md:text-3xl ${DISPLAY_FONT}`}
            >
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
        <section className="bg-[var(--brand-bg)] py-10 md:py-14">
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
            <p className="mb-8 text-sm text-[#241d0f]/60">
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
                    <div className="text-xs text-[#241d0f]/50">
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
                    <p className="text-xs text-[#241d0f]/50">{entry.contractor.companyName}</p>
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
              <span
                key={option}
                className="rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/85"
              >
                {option}
              </span>
            ))}
          </div>
          <div className="mx-auto mb-10 flex max-w-md items-center justify-center gap-2 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[var(--brand-accent)]" />
            <span>
              Contact is protected to prevent spam
              {contactReason ? ` (${contactReason.toLowerCase()})` : "."} A team member reviews
              every request before it's sent.
            </span>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href={ctaHref}>
              <button className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90">
                <MessageCircle className="h-5 w-5" />
                Direct Connect
              </button>
            </Link>
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
    </div>
  );
}
