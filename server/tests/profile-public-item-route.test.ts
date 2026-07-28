import { describe, expect, it } from "vitest";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemPath,
  buildProfilePublicItemUrl,
  isProfilePublicItemDestination,
  readProfilePublicItemRouteSegments,
  resolveProfilePublicItemRoute,
} from "@shared/profilePublicItemRoute";

const jwDiscovery = [
  {
    type: "publicDiscovery",
    data: {
      routes: {
        inventory: "stones",
        categories: "materials",
      },
    },
  },
];

describe("public Profile item routes", () => {
  it("uses generic routes by default and profile-owned route names when configured", () => {
    expect(readProfilePublicItemRouteSegments([])).toEqual({
      inventory: "inventory",
      gallery: "gallery",
      categories: "categories",
    });
    expect(readProfilePublicItemRouteSegments(jwDiscovery)).toEqual({
      inventory: "stones",
      gallery: "gallery",
      categories: "materials",
    });
  });

  it("builds owner-domain and TradeScout-scoped routes from the same contract", () => {
    expect(
      buildProfilePublicCategoryUrl({
        profileUrl: "https://jwstonelogistics.com/",
        categorySlug: "engineered-quartz",
        contentBlocks: jwDiscovery,
      })
    ).toBe("https://jwstonelogistics.com/materials/engineered-quartz");

    expect(
      buildProfilePublicItemUrl({
        profileUrl: "https://jwstonelogistics.com/",
        itemType: "inventory",
        itemSlug: "blue-mare",
        contentBlocks: jwDiscovery,
      })
    ).toBe("https://jwstonelogistics.com/stones/blue-mare");

    expect(
      buildProfilePublicItemUrl({
        profileUrl: "https://www.thetradescout.com/u/sample-supplier",
        itemType: "inventory",
        itemSlug: "blue-mare",
      })
    ).toBe("https://www.thetradescout.com/u/sample-supplier/inventory/blue-mare");

    expect(
      buildProfilePublicItemPath({
        profileBasePath: "/",
        itemType: "inventory",
        itemSlug: "blue-mare",
        imageIndex: 2,
        contentBlocks: jwDiscovery,
      })
    ).toBe("/stones/blue-mare?photo=3");
  });

  it("parses only the configured profile-owned namespace", () => {
    expect(
      resolveProfilePublicItemRoute({
        pathname: "/stones/blue-mare",
        profileBasePath: "/",
        contentBlocks: jwDiscovery,
      })
    ).toEqual({
      itemType: "inventory",
      itemSlug: "blue-mare",
      routeSegment: "stones",
    });
    expect(
      resolveProfilePublicItemRoute({
        pathname: "/u/sample/inventory/shared-slug",
        profileBasePath: "/u/sample",
      })
    ).toEqual({
      itemType: "inventory",
      itemSlug: "shared-slug",
      routeSegment: "inventory",
    });
    expect(
      resolveProfilePublicItemRoute({
        pathname: "/services/offer-1",
        profileBasePath: "/",
        contentBlocks: jwDiscovery,
      })
    ).toBeNull();
  });

  it("does not let unsafe or reserved configuration capture platform routes", () => {
    const unsafe = [
      {
        type: "publicDiscovery",
        data: { routes: { inventory: "api", gallery: "api" } },
      },
    ];
    expect(readProfilePublicItemRouteSegments(unsafe)).toEqual({
      inventory: "inventory",
      gallery: "gallery",
      categories: "categories",
    });
    expect(isProfilePublicItemDestination("/api/profile-1", unsafe)).toBe(false);
    expect(isProfilePublicItemDestination("/inventory/profile-1", unsafe)).toBe(true);
    expect(isProfilePublicItemDestination("//evil.example/inventory/item", unsafe)).toBe(false);
  });

  it("keeps all three namespaces distinct under adversarial configuration", () => {
    const collided = [
      {
        type: "publicDiscovery",
        data: {
          routes: {
            inventory: "categories",
            gallery: "profile-categories",
            categories: "profile-categories",
          },
        },
      },
    ];
    const routes = readProfilePublicItemRouteSegments(collided);
    expect(new Set(Object.values(routes)).size).toBe(3);
    expect(routes.inventory).not.toBe("p");
    expect(routes.gallery).not.toBe("r");
  });
});
