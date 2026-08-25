import { describe, expect, it } from "vitest";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";

const localServiceBlocks = [
  {
    type: "localServiceProfile",
    data: {
      services: [
        {
          title: "Land clearing and site preparation",
          description:
            "Open overgrown or undeveloped ground and prepare the property for access, drainage, construction, or its next planned use.",
        },
        {
          title: "Demolition and property cleanup",
          description:
            "Document what must be removed, what must remain, access limits, disposal needs, and the condition required for the next phase.",
        },
      ],
    },
  },
] as const;

describe("automatic public profile service discovery", () => {
  it("enrolls fact-bearing services for a current or future platform profile", () => {
    expect(
      buildProfileSitemapUrls({
        profileSlug: "future-site-company",
        profileUrl: "https://www.thetradescout.com/u/future-site-company",
        contentBlocks: localServiceBlocks,
      })
    ).toEqual([
      "https://www.thetradescout.com/u/future-site-company/services/land-clearing-and-site-preparation",
      "https://www.thetradescout.com/u/future-site-company/services/demolition-and-property-cleanup",
    ]);
  });

  it("uses a same-host custom-domain service namespace", () => {
    expect(
      buildProfileSitemapUrls({
        profileSlug: "future-site-company",
        profileUrl: "https://sitecompany.example/",
        contentBlocks: localServiceBlocks,
      })
    ).toEqual([
      "https://sitecompany.example/landing/service/land-clearing-and-site-preparation",
      "https://sitecompany.example/landing/service/demolition-and-property-cleanup",
    ]);
  });

  it("does not create thin pages from title-only service tags", () => {
    expect(
      buildProfileSitemapUrls({
        profileSlug: "material-supplier",
        profileUrl: "https://www.thetradescout.com/u/material-supplier",
        contentBlocks: [
          {
            type: "services",
            data: { items: ["Granite", "Marble", "Quartzite"] },
          },
        ],
      })
    ).toEqual([]);
  });

  it("honors an explicit service-page opt-out", () => {
    expect(
      buildProfileSitemapUrls({
        profileSlug: "private-service-detail",
        profileUrl: "https://www.thetradescout.com/u/private-service-detail",
        contentBlocks: [
          ...localServiceBlocks,
          {
            type: "publicDiscovery",
            data: { sitemap: { services: false } },
          },
        ],
      })
    ).toEqual([]);
  });
});
