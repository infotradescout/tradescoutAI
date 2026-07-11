import { useEffect } from "react";
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
} from "lucide-react";

/**
 * Premium "quarry-direct confidence" theme for wholesale / supplier profiles
 * (natural stone, building materials, distributors, etc.) — see ideas.md for
 * the design philosophy this implements. Distinct from the default dark
 * ProfileSiteView card layout used by service contractors.
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

type WholesalerProfileThemeProps = {
  displayName: string;
  headline: string | null;
  contentBlocks: ContentBlock[];
  categories: string[];
  serviceAreas: string[];
  contactReason?: string | null;
  hasViewerSession: boolean;
  isSuperAdminViewer: boolean;
  directConnectHref: string;
  preScoutCreateHref: string;
  preScoutSignInHref: string;
  recommendationsDirectory?: RecommendationEntry[];
  recommendationDirectorySummary?: RecommendationDirectorySummary;
};

function useWholesalerThemeFonts() {
  useEffect(() => {
    const id = "wholesaler-theme-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Poppins:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

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
  contactReason,
  hasViewerSession,
  isSuperAdminViewer,
  directConnectHref,
  preScoutCreateHref,
  preScoutSignInHref,
  recommendationsDirectory = [],
  recommendationDirectorySummary,
}: WholesalerProfileThemeProps) {
  useWholesalerThemeFonts();

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

  const ctaHref = hasViewerSession ? directConnectHref : preScoutCreateHref;

  return (
    <div
      className="min-h-screen bg-white text-[#241d0f]"
      style={{ fontFamily: '"Poppins", sans-serif' }}
    >
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-[#0e3a5c]/10 bg-white/95 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 md:px-6">
          <div>
            <span
              className="block text-xl font-bold leading-tight text-[#0e3a5c] md:text-2xl"
              style={{ fontFamily: '"Playfair Display", serif' }}
            >
              {displayName}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b3892b]">
              Wholesale Supplier
            </p>
          </div>
          <Link href={ctaHref}>
            <button className="rounded-full bg-[#0e3a5c] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0e3a5c]/90">
              Request Quote
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0e3a5c] via-[#0e3a5c] to-[#08283f] py-16 md:py-24">
        <div className="container mx-auto grid grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-6">
          <div>
            {categories.length > 0 ? (
              <span className="mb-5 inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                {categories.slice(0, 3).join(" · ")}
              </span>
            ) : null}
            <h1
              className="mb-5 text-4xl font-bold leading-tight text-white md:text-6xl"
              style={{ fontFamily: '"Playfair Display", serif' }}
            >
              {headline || `Quarry-direct sourcing from ${displayName}`}
            </h1>
            {aboutText ? (
              <p className="mb-8 max-w-xl whitespace-pre-wrap text-lg text-white/85">{aboutText}</p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={ctaHref}>
                <button className="flex items-center justify-center gap-2 rounded-full bg-[#b3892b] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#b3892b]/90">
                  {isSuperAdminViewer ? "Open Direct Connect" : "Request Volume Quote"}
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

          <div className="hidden md:block">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/70">
                Our Guarantee
              </p>
              <h3
                className="mb-6 border-b border-white/20 pb-6 text-2xl font-bold text-white"
                style={{ fontFamily: '"Playfair Display", serif' }}
              >
                Best Pricing, Availability &amp; Delivery
              </h3>
              <div className="space-y-4 text-sm text-white/85">
                {serviceAreas.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 flex-shrink-0 text-[#b3892b]" />
                    <span>Serving {serviceAreas.slice(0, 4).join(", ")}</span>
                  </div>
                ) : null}
                {inventoryItems.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 flex-shrink-0 text-[#b3892b]" />
                    <span>{inventoryItems.length}+ product lines in stock</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 flex-shrink-0 text-[#b3892b]" />
                  <span>Direct logistics, on-time delivery</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inventory / services */}
      {inventoryItems.length > 0 ? (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2
                className="mb-3 text-3xl font-bold text-[#0e3a5c] md:text-4xl"
                style={{ fontFamily: '"Playfair Display", serif' }}
              >
                Inventory &amp; Materials
              </h2>
              <p className="text-[#241d0f]/70">
                Direct sourcing, bulk availability, hands-on quality control
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {inventoryItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border-2 border-[#0e3a5c]/10 bg-gradient-to-br from-[#f7f4ec] to-[#f0ebdf]/50 p-6 shadow-sm"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0e3a5c]/10">
                    <Package className="h-6 w-6 text-[#0e3a5c]" />
                  </div>
                  <p className="font-semibold text-[#241d0f]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Gallery */}
      {galleryImages.length > 0 ? (
        <section className="bg-[#f7f4ec] py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <h2
              className="mb-8 text-center text-3xl font-bold text-[#0e3a5c] md:text-4xl"
              style={{ fontFamily: '"Playfair Display", serif' }}
            >
              Showroom &amp; Inventory
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {galleryImages.slice(0, 9).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${displayName} inventory ${i + 1}`}
                  className="h-48 w-full rounded-xl object-cover shadow-md"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {faqItems.length > 0 ? (
        <section className="py-16 md:py-24">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <h2
              className="mb-8 text-center text-3xl font-bold text-[#0e3a5c] md:text-4xl"
              style={{ fontFamily: '"Playfair Display", serif' }}
            >
              Frequently Asked
            </h2>
            <div className="space-y-6">
              {faqItems.map((faq, i) => (
                <div key={i} className="border-b border-[#0e3a5c]/10 pb-6">
                  {faq.question ? (
                    <p className="mb-2 font-semibold text-[#0e3a5c]">{faq.question}</p>
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
        <section className="bg-[#f7f4ec] py-16 md:py-24">
          <div className="container mx-auto max-w-3xl px-4 md:px-6">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h2
                className="text-3xl font-bold text-[#0e3a5c] md:text-4xl"
                style={{ fontFamily: '"Playfair Display", serif' }}
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
                  className="rounded-xl border-2 border-[#0e3a5c]/10 bg-white p-5 shadow-sm"
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
                        <span className="rounded-full bg-[#0e3a5c]/10 px-3 py-1 text-xs font-semibold text-[#0e3a5c]">
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
                      <span className="text-sm font-semibold text-[#0e3a5c] underline underline-offset-2">
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
      <section className="bg-[#0e3a5c] py-16 md:py-24">
        <div className="container mx-auto px-4 text-center md:px-6">
          <h2
            className="mb-4 text-3xl font-bold text-white md:text-4xl"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            Ready to Partner?
          </h2>
          <p className="mx-auto mb-4 max-w-xl text-white/80">
            Contact {displayName} for wholesale accounts, volume quotes, or partnership inquiries.
          </p>
          <div className="mx-auto mb-10 flex max-w-md items-center justify-center gap-2 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[#b3892b]" />
            <span>
              Contact is protected to prevent spam
              {contactReason ? ` (${contactReason.toLowerCase()})` : "."}
            </span>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href={ctaHref}>
              <button className="flex items-center justify-center gap-2 rounded-full bg-[#b3892b] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#b3892b]/90">
                <MessageCircle className="h-5 w-5" />
                {isSuperAdminViewer ? "Open Direct Connect" : "Start Direct Connect"}
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
          <p
            className="mb-2 text-lg font-bold text-white"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            {displayName}
          </p>
          <p>Quarry-direct supplier. Guaranteed best pricing, availability &amp; delivery.</p>
        </div>
      </footer>
    </div>
  );
}
