import { useEffect } from "react";
import { canonicalPublicOrigin } from "@/lib/canonicalPublicOrigin";

interface LocalBusinessSEOProps {
  contractor?: {
    companyName: string;
    website?: string;
    about?: string;
    yearsInBusiness?: number;
    verifiedLicensed?: boolean;
    verifiedInsured?: boolean;
    canonicalBusinessProfileUrl?: string | null;
  };
  location?: {
    state?: string;
    county?: string;
  };
}

function getPublicOriginForStructuredData() {
  return canonicalPublicOrigin(typeof window === "undefined" ? undefined : window.location.origin);
}

/**
 * Component to inject local business structured data for individual provider profiles
 * Helps with local SEO and Google My Business integration
 */
export function LocalBusinessSEO({ contractor, location }: LocalBusinessSEOProps) {
  useEffect(() => {
    if (!contractor) return;

    const canonicalBusinessProfileUrl =
      typeof contractor.canonicalBusinessProfileUrl === "string" &&
      contractor.canonicalBusinessProfileUrl.trim().length > 0
        ? contractor.canonicalBusinessProfileUrl.trim()
        : null;
    const publicOrigin = getPublicOriginForStructuredData();
    const publicUrl = canonicalBusinessProfileUrl
      ? canonicalBusinessProfileUrl.startsWith("http")
        ? canonicalBusinessProfileUrl
        : `${publicOrigin}${canonicalBusinessProfileUrl}`
      : window.location.href;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: contractor.companyName,
      description: contractor.about || undefined,
      url: publicUrl,
      sameAs: contractor.website ? [contractor.website] : undefined,
      areaServed:
        location?.state || location?.county
          ? {
              "@type": "AdministrativeArea",
              name: [location?.county, location?.state].filter(Boolean).join(", "),
            }
          : undefined,
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
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Local Services",
    areaServed:
      location?.state || location?.county
        ? {
            "@type": "AdministrativeArea",
            name: [location?.county, location?.state].filter(Boolean).join(", "),
          }
        : undefined,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Published local services",
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service,
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
