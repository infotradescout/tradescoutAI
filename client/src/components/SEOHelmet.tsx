import { useEffect } from "react";
import { useLocation } from "wouter";
import { formatTradeScoutTitle, TRADESCOUT_BRAND_NAME } from "@shared/brand";

interface SEOHelmetProps {
  title?: string;
  /** Business-led Open Graph/X title. The browser title remains TradeScout-branded. */
  socialTitle?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  structuredData?: Record<string, any>;
  noIndex?: boolean;
  /** Keep the robots directive emitted by SSR while crawl truth is unresolved. */
  preserveRobots?: boolean;
  /** Keep a deliberately shareable query (for example ?stone=...) in canonical/OG URLs. */
  preserveCanonicalQuery?: boolean;
}

export function SEOHelmet({
  title = "TradeScout | Connection Without Compromise",
  socialTitle,
  description = "TradeScout helps people find trusted local help, make decisions, and move work forward. Connection without compromise.",
  keywords = "scout, local helper, local businesses, direct connect, exchange, business profiles, local services, local products, trusted providers",
  canonical,
  ogType = "website",
  ogImage = "/tradescout-social-preview.png?v=12",
  structuredData,
  noIndex = false,
  preserveRobots = false,
  preserveCanonicalQuery = false,
}: SEOHelmetProps) {
  const [location] = useLocation();
  const currentUrl = normalizePublicUrl(
    stripUrlVariantsForCanonical(
      new URL(location, window.location.origin).toString(),
      preserveCanonicalQuery
    )
  );
  const finalCanonical = normalizePublicUrl(
    stripUrlVariantsForCanonical(canonical || currentUrl, preserveCanonicalQuery)
  );
  const ogImageUrl = resolveAssetUrl(ogImage, finalCanonical);
  const formattedTitle = formatTradeScoutTitle(title);
  const formattedSocialTitle = socialTitle?.trim() || formattedTitle;

  useEffect(() => {
    // Update document title
    document.title = formattedTitle;

    // Update meta tags
    updateMetaTag("description", description);
    updateMetaTag("keywords", keywords);
    if (!preserveRobots) {
      updateMetaTag("robots", noIndex ? "noindex, nofollow" : "index, follow");
    }

    // Open Graph
    updateMetaTag("og:title", formattedSocialTitle, "property");
    updateMetaTag("og:description", description, "property");
    updateMetaTag("og:type", ogType, "property");
    updateMetaTag("og:url", finalCanonical, "property");
    updateMetaTag("og:image", ogImageUrl, "property");
    updateMetaTag("og:site_name", TRADESCOUT_BRAND_NAME, "property");

    // Twitter Card
    updateMetaTag("twitter:card", "summary_large_image", "name");
    updateMetaTag("twitter:title", formattedSocialTitle, "name");
    updateMetaTag("twitter:description", description, "name");
    updateMetaTag("twitter:image", ogImageUrl, "name");
    updateMetaTag("twitter:site", "@TradeScout", "name");

    // Additional SEO tags
    // Use the currently-applied theme token (set by ThemeContext/applyTheme) without hardcoding hex.
    // If tokens are unavailable, fall back to a safe named color.
    const themeColor =
      typeof window !== "undefined"
        ? getComputedStyle(document.documentElement)
            .getPropertyValue("--ts-surface-strong")
            .trim() || "black"
        : "black";
    updateMetaTag("theme-color", themeColor, "name");
    updateMetaTag("apple-mobile-web-app-title", TRADESCOUT_BRAND_NAME, "name");

    // Canonical link
    updateCanonicalLink(finalCanonical);

    // Structured data
    if (structuredData) {
      updateStructuredData(structuredData);
    }

    // Clean up function
    return () => {
      // Remove structured data script if it exists
      const existingScript = document.querySelector(
        'script[type="application/ld+json"][data-react-helmet]'
      );
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [
    formattedTitle,
    formattedSocialTitle,
    description,
    keywords,
    currentUrl,
    finalCanonical,
    ogType,
    ogImageUrl,
    structuredData,
    noIndex,
    preserveRobots,
    preserveCanonicalQuery,
  ]);

  return null;
}

function updateMetaTag(name: string, content: string, attribute: "name" | "property" = "name") {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("data-managed-by", "seo-helmet");
  meta.content = content;
}

function updateCanonicalLink(href: string) {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}

function normalizePublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return parsed.toString();

    const canonicalHost =
      host === "thetradescout.com" ||
      host === "www.thetradescout.com" ||
      host === "tradescoutai.onrender.com";

    if (canonicalHost) {
      parsed.protocol = "https:";
      parsed.hostname = "www.thetradescout.com";
      parsed.port = "";
      return parsed.toString();
    }

    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return url;
  }
}

function stripUrlVariantsForCanonical(url: string, preserveSearch = false) {
  try {
    const parsed = new URL(url);
    if (!preserveSearch) parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function resolveAssetUrl(assetPath: string, baseUrl: string) {
  try {
    return normalizePublicUrl(new URL(assetPath, baseUrl).toString());
  } catch {
    return assetPath;
  }
}

function getCanonicalOrigin() {
  return normalizePublicUrl(window.location.origin);
}

function updateStructuredData(data: Record<string, any>) {
  // Remove existing structured data
  const existingScript = document.querySelector(
    'script[type="application/ld+json"][data-react-helmet]'
  );
  if (existingScript) {
    existingScript.remove();
  }

  // Add new structured data
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-react-helmet", "true");
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// Structured data generators
export const createWebsiteStructuredData = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TradeScout",
  description:
    "Scout, TradeScout's local search and summary surface, connects people with verified local businesses, Exchange items, community context, and guided local action.",
  url: getCanonicalOrigin(),
  potentialAction: {
    "@type": "SearchAction",
    target: `${getCanonicalOrigin()}/direct-connect?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
  sameAs: [
    "https://facebook.com/tradescout",
    "https://twitter.com/tradescout",
    "https://linkedin.com/company/tradescout",
  ],
});

export const createFAQStructuredData = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

export const createOrganizationStructuredData = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TradeScout",
  description:
    "Platform connecting residents, businesses, organizations, sellers, and local providers",
  url: getCanonicalOrigin(),
  logo: `${getCanonicalOrigin()}/icon-512.png?v=10`,
  image: `${getCanonicalOrigin()}/icon-512.png?v=10`,
  address: {
    "@type": "PostalAddress",
    addressCountry: "US",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-800-TRADESCOUT",
    contactType: "customer service",
    availableLanguage: ["English"],
  },
  potentialAction: [
    {
      "@type": "SearchAction",
      target: `${getCanonicalOrigin()}/direct-connect?search={search_term_string}`,
      "query-input": "required name=search_term_string",
      description: "Find local businesses",
    },
    {
      "@type": "InteractAction",
      target: `${getCanonicalOrigin()}/scout`,
      description: "Start a protected request",
    },
  ],
  sameAs: [
    "https://facebook.com/tradescout",
    "https://twitter.com/tradescout",
    "https://linkedin.com/company/tradescout",
  ],
});

export const createServiceStructuredData = (service: {
  name: string;
  description: string;
  category: string;
  areaServed?: string;
  provider?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name: service.name,
  description: service.description,
  category: service.category,
  provider: {
    "@type": "Organization",
    name: service.provider || "TradeScout",
    url: getCanonicalOrigin(),
  },
  areaServed: service.areaServed || "United States",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Local Business Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Local service requests",
        },
      },
    ],
  },
});

export const createContractorStructuredData = (contractor: {
  id: string;
  name: string;
  description?: string;
  recommendationCount?: number;
  location?: string;
  trades?: string[];
  verified?: boolean;
  canonicalBusinessProfileUrl?: string | null;
}) => {
  const origin = getCanonicalOrigin();
  const canonicalBusinessProfileUrl =
    typeof contractor.canonicalBusinessProfileUrl === "string" &&
    contractor.canonicalBusinessProfileUrl.trim().length > 0
      ? contractor.canonicalBusinessProfileUrl.trim()
      : null;
  const publicUrl = canonicalBusinessProfileUrl
    ? canonicalBusinessProfileUrl.startsWith("http")
      ? canonicalBusinessProfileUrl
      : `${origin}${canonicalBusinessProfileUrl}`
    : `${origin}/contractors/${contractor.id}`;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": publicUrl,
    name: contractor.name,
    description: contractor.description,
    url: publicUrl,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: contractor.location,
      addressCountry: "US",
    },
    hasCredential: contractor.verified
      ? {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "Professional Certification",
          name: "Verified Local Provider",
        }
      : undefined,
    serviceType: contractor.trades || [],
    areaServed: contractor.location || "Local Area",
  };
};

export const createLocalBusinessStructuredData = (biz: {
  slug: string;
  name: string;
  description?: string | null;
  countyName?: string | null;
  stateCode?: string | null;
  website?: string | null;
  category?: string | null;
  verifiedLabel?: string | null;
}) => {
  const origin = getCanonicalOrigin();
  const url = `${origin}/business/${encodeURIComponent(String(biz.slug || ""))}`;
  const hasPlace = Boolean(biz.countyName && biz.stateCode);

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    description: biz.description || undefined,
    url,
    category: biz.category || undefined,
    areaServed: hasPlace ? [`${biz.countyName}, ${biz.stateCode}`] : undefined,
    address: hasPlace
      ? {
          "@type": "PostalAddress",
          addressLocality: biz.countyName || undefined,
          addressRegion: biz.stateCode || undefined,
          addressCountry: "US",
        }
      : undefined,
    sameAs: biz.website ? [biz.website] : undefined,
    hasCredential: biz.verifiedLabel
      ? {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "Verification",
          name: biz.verifiedLabel,
        }
      : undefined,
  };
};

export const createBreadcrumbStructuredData = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: `${getCanonicalOrigin()}${item.url}`,
  })),
});

export const createPlaceStructuredData = (county: {
  name: string;
  state: string;
  stateCode: string;
  fipsCode: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Place",
  name: `${county.name}, ${county.stateCode}`,
  areaServed: {
    "@type": "AdministrativeArea",
    name: county.name,
    areaType: "County",
    containedIn: {
      "@type": "State",
      name: county.state,
      addressCountry: "US",
    },
  },
  url: normalizePublicUrl(stripUrlVariantsForCanonical(window.location.href)),
  identifier: county.fipsCode,
});

export const createAdministrativeAreaStructuredData = (area: {
  name: string;
  areaType: string;
  state: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "AdministrativeArea",
  name: area.name,
  areaType: area.areaType,
  containedIn: {
    "@type": "State",
    name: area.state,
    addressCountry: "US",
  },
});

// Deprecated duplicate; use the top-level createFAQStructuredData instead
