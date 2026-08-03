import { describe, expect, it } from "vitest";
import {
  createContractorStructuredData,
  createLocalBusinessStructuredData,
  createOrganizationStructuredData,
  createServiceStructuredData,
} from "../../client/src/components/SEOHelmet";
import { createServiceCategoryStructuredData } from "../../client/src/components/SEOLocalBusiness";
import {
  canonicalPublicOrigin,
  TRADESCOUT_PUBLIC_ORIGIN,
} from "../../client/src/lib/canonicalPublicOrigin";

describe("public structured-data truth contracts", () => {
  it("keeps platform organization schema free of invented contact and identity facts", () => {
    const organization = JSON.parse(JSON.stringify(createOrganizationStructuredData()));

    expect(organization).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "TradeScout",
      url: TRADESCOUT_PUBLIC_ORIGIN,
    });
    expect(organization.address).toBeUndefined();
    expect(organization.contactPoint).toBeUndefined();
    expect(organization.sameAs).toBeUndefined();
    expect(organization.potentialAction).toBeUndefined();
  });

  it("omits absent service facts while retaining source-backed values", () => {
    const absent = createServiceStructuredData({
      name: "Roof repair",
      description: "A published service",
      category: "Roofing",
    });
    const sourceBacked = createServiceStructuredData({
      name: "Direct Connect",
      description: "A TradeScout workflow",
      category: "Local requests",
      provider: "TradeScout",
      areaServed: "Tangipahoa Parish, LA",
    });

    expect(JSON.parse(JSON.stringify(absent))).toEqual({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Roof repair",
      description: "A published service",
      category: "Roofing",
    });
    expect(JSON.parse(JSON.stringify(sourceBacked))).toMatchObject({
      provider: { name: "TradeScout", url: TRADESCOUT_PUBLIC_ORIGIN },
      areaServed: "Tangipahoa Parish, LA",
    });
  });

  it("omits invented contractor facts and retains source-backed place data", () => {
    const absent = JSON.parse(
      JSON.stringify(createContractorStructuredData({ id: "42", name: "Example Provider" }))
    );
    const sourceBacked = JSON.parse(
      JSON.stringify(
        createLocalBusinessStructuredData({
          slug: "example-provider",
          name: "Example Provider",
          countyName: "Tangipahoa",
          stateCode: "LA",
          website: "https://example.test",
        })
      )
    );

    expect(absent.address).toBeUndefined();
    expect(absent.areaServed).toBeUndefined();
    expect(absent.priceRange).toBeUndefined();
    expect(absent.hasCredential).toBeUndefined();
    expect(sourceBacked.address).toBeUndefined();
    expect(sourceBacked.areaServed).toMatchObject({
      "@type": "AdministrativeArea",
      name: "Tangipahoa, LA",
    });
    expect(sourceBacked.sameAs).toEqual(["https://example.test"]);
  });

  it("builds catalogs from executed source arrays without fake prices", () => {
    const empty = JSON.parse(JSON.stringify(createServiceCategoryStructuredData([])));
    const populated = JSON.parse(
      JSON.stringify(
        createServiceCategoryStructuredData(["Roof repair"], {
          county: "Tangipahoa",
          state: "LA",
        })
      )
    );

    expect(empty.areaServed).toBeUndefined();
    expect(empty.hasOfferCatalog.itemListElement).toEqual([]);
    expect(populated.areaServed).toMatchObject({
      "@type": "AdministrativeArea",
      name: "Tangipahoa, LA",
    });
    expect(populated.hasOfferCatalog.itemListElement).toHaveLength(1);
    expect(populated.hasOfferCatalog.itemListElement[0].itemOffered.name).toBe("Roof repair");
    expect(populated.hasOfferCatalog.itemListElement[0]).not.toHaveProperty("price");
  });

  it("pins public metadata origins despite hostile runtime or proxy inputs", () => {
    expect(canonicalPublicOrigin("https://evil.example")).toBe(TRADESCOUT_PUBLIC_ORIGIN);
    expect(canonicalPublicOrigin("http://attacker.example:8080")).toBe(TRADESCOUT_PUBLIC_ORIGIN);
    expect(canonicalPublicOrigin("not a URL")).toBe(TRADESCOUT_PUBLIC_ORIGIN);
    expect(canonicalPublicOrigin("ftp://localhost/resource")).toBe(TRADESCOUT_PUBLIC_ORIGIN);
    expect(canonicalPublicOrigin("ws://127.0.0.1:5173")).toBe(TRADESCOUT_PUBLIC_ORIGIN);
    expect(canonicalPublicOrigin("javascript://localhost")).toBe(TRADESCOUT_PUBLIC_ORIGIN);
    expect(canonicalPublicOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });
});
