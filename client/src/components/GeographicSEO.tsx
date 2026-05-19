/**
 * GeographicSEO - Component for location-based SEO optimization
 *
 * Handles city, county, and state-specific SEO to improve local search rankings
 * and help users find businesses and local providers in their specific geographic areas.
 */
import { formatTradeScoutTitle } from "@shared/brand";

interface GeographicSEOProps {
  state?: string;
  county?: string;
  serviceType?: string;
  contractorCount?: number;
}

export function GeographicSEO({ state, county, serviceType, contractorCount }: GeographicSEOProps) {
  const generateLocationStructuredData = () => {
    const locationData = {
      "@context": "https://schema.org",
      "@type": "Place",
      name: `${county ? `${county}, ` : ""}${state || "United States"}`,
      address: {
        "@type": "PostalAddress",
        addressRegion: state,
        addressLocality: county,
        addressCountry: "US",
      },
      containsPlace: {
        "@type": "LocalBusiness",
        name: "Home Improvement Businesses",
        description: `Professional ${serviceType || "home improvement"} businesses serving ${county ? `${county}, ` : ""}${state || "the United States"}`,
        serviceArea: {
          "@type": "GeoCircle",
          geoMidpoint: {
            "@type": "GeoCoordinates",
            addressRegion: state,
            addressLocality: county,
          },
          geoRadius: "50000",
        },
      },
    };

    return locationData;
  };

  const generateLocationTitle = () => {
    let title = "Find";

    if (serviceType) {
      title += ` ${serviceType} Providers`;
    } else {
      title += " Providers";
    }

    if (county && state) {
      title += ` in ${county}, ${state}`;
    } else if (state) {
      title += ` in ${state}`;
    }

    return formatTradeScoutTitle(`${title} | TradeScout`);
  };

  const generateLocationDescription = () => {
    let description = `Find verified ${serviceType || "home improvement"} businesses`;

    if (county && state) {
      description += ` in ${county}, ${state}`;
    } else if (state) {
      description += ` in ${state}`;
    }

    description += ". Get 3 free quotes from licensed and insured professionals.";

    if (contractorCount && contractorCount > 0) {
      description += ` ${contractorCount} provider${contractorCount !== 1 ? "s" : ""} available in your area.`;
    }

    return description;
  };

  // Inject location-specific meta tags
  React.useEffect(() => {
    // Update page title for location
    const originalTitle = document.title;
    document.title = generateLocationTitle();

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const originalDescription = metaDesc?.content;

    if (metaDesc) {
      metaDesc.content = generateLocationDescription();
    }

    // Inject location structured data
    const locationStructuredData = generateLocationStructuredData();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(locationStructuredData);
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      document.title = originalTitle;
      if (metaDesc && originalDescription) {
        metaDesc.content = originalDescription;
      }
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [state, county, serviceType, contractorCount]);

  return null;
}

/**
 * Service area coverage component for businesses and providers
 */
interface ServiceAreaSEOProps {
  contractor: {
    companyName: string;
    serviceAreas?: string[];
  };
  primaryLocation: {
    state: string;
    county?: string;
  };
}

export function ServiceAreaSEO({ contractor, primaryLocation }: ServiceAreaSEOProps) {
  React.useEffect(() => {
    const serviceAreaData = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: contractor.companyName,
      areaServed: [
        {
          "@type": "State",
          name: primaryLocation.state,
        },
        ...(primaryLocation.county
          ? [
              {
                "@type": "City",
                name: primaryLocation.county,
                containedInPlace: {
                  "@type": "State",
                  name: primaryLocation.state,
                },
              },
            ]
          : []),
        ...(contractor.serviceAreas?.map((area) => ({
          "@type": "Place",
          name: area,
        })) || []),
      ],
      serviceRadius: {
        "@type": "GeoCircle",
        geoRadius: "80467", // 50 miles in meters
        geoMidpoint: {
          "@type": "GeoCoordinates",
          addressRegion: primaryLocation.state,
          addressLocality: primaryLocation.county,
        },
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(serviceAreaData);
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [contractor, primaryLocation]);

  return null;
}

/**
 * Generate nearby location suggestions for SEO
 */
export function generateNearbyLocationSuggestions(
  currentLocation: { state?: string; county?: string },
  allLocations: { state: string; county: string; name: string }[]
): string[] {
  if (!currentLocation.state) return [];

  // Find locations in the same state
  const sameState = allLocations.filter((loc) => loc.state === currentLocation.state);

  // If we have a county, prioritize nearby counties
  if (currentLocation.county) {
    const otherCounties = sameState
      .filter((loc) => loc.county !== currentLocation.county)
      .slice(0, 8);

    return otherCounties.map((loc) => `${loc.name}, ${loc.state}`);
  }

  // Otherwise, suggest popular counties in the state
  return sameState.slice(0, 10).map((loc) => `${loc.name}, ${loc.state}`);
}

import React from "react";
