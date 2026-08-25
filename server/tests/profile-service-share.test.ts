import { describe, expect, it } from "vitest";
import {
  buildProfileServicePath,
  buildProfileServiceUrl,
  createProfileServiceShareMetadata,
  listFactBearingProfileServices,
  listProfileServiceItems,
  resolveProfileServiceRoute,
} from "@shared/profileServiceShare";

const serviceBlocks = [
  {
    type: "localServiceProfile",
    data: {
      heroImage: "/images/local-service/hero.jpg",
      services: [
        {
          title: "Drain clearing and diagnostics",
          description:
            "Locate the cause of a blocked or slow drain, explain the findings, and identify the least disruptive next step.",
        },
        {
          title: "Water heater installation",
          description:
            "Plan and install tank or tankless water-heating equipment around the property, demand, utilities, and replacement conditions.",
        },
      ],
    },
  },
  {
    type: "services",
    data: {
      items: ["Granite", "Marble", "Quartzite"],
    },
  },
] as const;

describe("profile service share", () => {
  it("publishes only services with a meaningful description", () => {
    const all = listProfileServiceItems(serviceBlocks);
    const publicServices = listFactBearingProfileServices(serviceBlocks);

    expect(all).toHaveLength(5);
    expect(publicServices).toHaveLength(2);
    expect(publicServices.map((service) => service.slug)).toEqual([
      "drain-clearing-and-diagnostics",
      "water-heater-installation",
    ]);
    expect(publicServices.every((service) => service.imageUrl === "/images/local-service/hero.jpg")).toBe(
      true
    );
  });

  it("builds same-host platform and custom-domain service paths", () => {
    expect(
      buildProfileServicePath({
        profileBasePath: "/u/local-plumber",
        serviceSlug: "drain-clearing-and-diagnostics",
      })
    ).toBe("/u/local-plumber/services/drain-clearing-and-diagnostics");
    expect(
      buildProfileServicePath({
        profileBasePath: "/",
        serviceSlug: "drain-clearing-and-diagnostics",
      })
    ).toBe("/landing/service/drain-clearing-and-diagnostics");
    expect(
      buildProfileServiceUrl({
        profileUrl: "https://plumber.example/",
        serviceSlug: "drain-clearing-and-diagnostics",
      })
    ).toBe("https://plumber.example/landing/service/drain-clearing-and-diagnostics");
  });

  it("resolves only the expected service namespace", () => {
    expect(
      resolveProfileServiceRoute({
        pathname: "/u/local-plumber/services/drain-clearing-and-diagnostics",
        profileBasePath: "/u/local-plumber",
      })
    ).toEqual({
      serviceSlug: "drain-clearing-and-diagnostics",
      canonicalPath: "/u/local-plumber/services/drain-clearing-and-diagnostics",
    });
    expect(
      resolveProfileServiceRoute({
        pathname: "/landing/service/drain-clearing-and-diagnostics",
        profileBasePath: "/",
      })
    ).toEqual({
      serviceSlug: "drain-clearing-and-diagnostics",
      canonicalPath: "/landing/service/drain-clearing-and-diagnostics",
    });
    expect(
      resolveProfileServiceRoute({
        pathname: "/u/local-plumber/services/not/one-page",
        profileBasePath: "/u/local-plumber",
      })
    ).toBeNull();
  });

  it("creates exact service metadata without direct-contact leakage", () => {
    const metadata = createProfileServiceShareMetadata({
      profileName: "Local Plumbing",
      profileUrl: "https://www.thetradescout.com/u/local-plumber",
      assetOrigin: "https://www.thetradescout.com",
      contentBlocks: [
        {
          type: "localServiceProfile",
          data: {
            services: [
              {
                title: "Leak repair",
                description:
                  "Find and repair the source of the leak. Call 985-555-0100 or email repair@example.com before work begins.",
              },
            ],
          },
        },
      ],
      serviceSlug: "leak-repair",
    });

    expect(metadata).toMatchObject({
      itemType: "service",
      itemTitle: "Leak repair",
      canonical: "https://www.thetradescout.com/u/local-plumber/services/leak-repair",
    });
    expect(metadata?.description).toContain("Continue through TradeScout");
    expect(metadata?.description).not.toMatch(/985-555-0100|repair@example\.com/i);
  });
});
