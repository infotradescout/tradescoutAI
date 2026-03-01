import { useEffect } from "react";

interface LocalBusinessSEOProps {
  contractor?: {
    companyName: string;
    website?: string;
    about?: string;
    yearsInBusiness?: number;
    verifiedLicensed?: boolean;
    verifiedInsured?: boolean;
  };
  location?: {
    state?: string;
    county?: string;
  };
}

function normalizePublicOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return parsed.toString().replace(/\/$/, "");

    const canonicalHost =
      host === "thetradescout.com" ||
      host === "www.thetradescout.com" ||
      host === "tradescoutai.onrender.com";

    if (canonicalHost) {
      parsed.protocol = "https:";
      parsed.hostname = "www.thetradescout.com";
      parsed.port = "";
      return parsed.toString().replace(/\/$/, "");
    }

    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return origin.replace(/\/$/, "");
  }
}

function getPublicOriginForStructuredData() {
  if (typeof window === "undefined") return "https://www.thetradescout.com";
  return normalizePublicOrigin(window.location.origin);
}

/**
 * Component to inject local business structured data for individual contractor profiles
 * Helps with local SEO and Google My Business integration
 */
export function LocalBusinessSEO({ contractor, location }: LocalBusinessSEOProps) {
  useEffect(() => {
    if (!contractor) return;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: contractor.companyName,
      description:
        contractor.about || `Professional home improvement services by ${contractor.companyName}`,
      url: window.location.href,
      sameAs: contractor.website ? [contractor.website] : undefined,
      address: {
        "@type": "PostalAddress",
        addressRegion: location?.state || "US",
        addressLocality: location?.county || "Local Area",
        addressCountry: "US",
      },
      priceRange: "$$",
      paymentAccepted: ["Cash", "Credit Card", "Check", "Financing"],
      currenciesAccepted: "USD",
      areaServed: {
        "@type": "GeoCircle",
        geoMidpoint: {
          "@type": "GeoCoordinates",
          addressRegion: location?.state,
          addressLocality: location?.county,
        },
        geoRadius: "50000",
      },
      serviceType: "Home Improvement Contractor",
      hasCredential: contractor.verifiedLicensed
        ? {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "Professional License",
            recognizedBy: {
              "@type": "Organization",
              name: "State Licensing Board",
            },
          }
        : undefined,
      makesOffer: {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Home Improvement Services",
          description:
            "Professional contractor services including renovations, repairs, and installations",
        },
        areaServed: location?.county || "Local Area",
      },
    };

    // Create and inject structured data
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [contractor, location]);

  return null;
}

/**
 * Enhanced structured data for service categories
 * Helps with service-specific searches and AI model understanding
 */
export function createServiceCategoryStructuredData(
  services: string[],
  location?: { state?: string; county?: string }
) {
  const publicOrigin = getPublicOriginForStructuredData();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Home Improvement Services",
    provider: {
      "@type": "Organization",
      name: "TradeScout",
      url: publicOrigin,
    },
    areaServed: {
      "@type": "Place",
      addressRegion: location?.state || "United States",
      addressLocality: location?.county,
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Home Improvement Services",
      itemListElement: services.map((service, index) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service,
          serviceType: "Home Improvement",
        },
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "USD",
          price: "0",
          description: "Free quotes available",
        },
      })),
    },
  };
}

/**
 * Generate job posting structured data for contractors browsing job requests.
 */
export function createJobPostingStructuredData(
  projectType: string,
  location?: { state?: string; county?: string }
) {
  const publicOrigin = getPublicOriginForStructuredData();
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: `${projectType} Project Available`,
    description: `Homeowner seeking qualified contractor for ${projectType.toLowerCase()} services`,
    hiringOrganization: {
      "@type": "Organization",
      name: "TradeScout",
      sameAs: publicOrigin,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressRegion: location?.state || "US",
        addressLocality: location?.county,
        addressCountry: "US",
      },
    },
    employmentType: "CONTRACTOR",
    workHours: "Flexible",
    qualifications: [
      "Licensed and insured contractor",
      "Proven experience in home improvement",
      "Good communication skills",
      "Professional references available",
    ],
    responsibilities: [
      "Provide accurate project estimates",
      "Complete work to professional standards",
      "Maintain clear communication with homeowner",
      "Follow safety protocols",
    ],
  };
}
