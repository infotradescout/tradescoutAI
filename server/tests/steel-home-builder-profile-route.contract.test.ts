import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildSteelHomeBuilderPath,
  resolveSteelHomeBuilderPathname,
  resolveSteelHomeBuilderRoute,
  STEEL_HOME_BUILDER_PAGE_METADATA,
  STEEL_HOME_BUILDER_ROUTE_SLUGS,
} from "../../shared/steelHomeBuilderRoutes";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT } from "../../shared/steelHomePackagesProfile";
import { buildSteelHomeBuilderProfilePageMetadata } from "../steelHomeBuilderProfileRoute";

describe("Steel Home builder URL contract", () => {
  it("owns exactly one stable share path for each builder", () => {
    expect(STEEL_HOME_BUILDER_ROUTE_SLUGS).toEqual({
      countertops: "countertops",
      cabinets: "cabinets",
      building: "metal-buildings",
    });
    expect(buildSteelHomeBuilderPath("countertops")).toBe(
      "/u/steel-home-packages/builders/countertops"
    );
    expect(buildSteelHomeBuilderPath("cabinets")).toBe("/u/steel-home-packages/builders/cabinets");
    expect(buildSteelHomeBuilderPath("building")).toBe(
      "/u/steel-home-packages/builders/metal-buildings"
    );
  });

  it("resolves only the three supported /u and /p builder paths", () => {
    for (const [builder, builderSlug] of Object.entries(STEEL_HOME_BUILDER_ROUTE_SLUGS)) {
      expect(resolveSteelHomeBuilderRoute("builders", builderSlug)).toBe(builder);
      expect(
        resolveSteelHomeBuilderPathname(
          `/u/steel-home-packages/builders/${builderSlug}?ref=share-link`
        )
      ).toBe(builder);
      expect(
        resolveSteelHomeBuilderPathname(`/p/steel-home-packages/builders/${builderSlug}`)
      ).toBe(builder);
    }

    expect(resolveSteelHomeBuilderRoute("builders", "unknown-builder")).toBeNull();
    expect(
      resolveSteelHomeBuilderPathname("/u/steel-home-packages/builders/unknown-builder")
    ).toBeNull();
    expect(resolveSteelHomeBuilderPathname("/u/another-profile/builders/countertops")).toBeNull();
  });

  it("defines distinct server metadata for every canonical builder URL", () => {
    const origin = "https://www.thetradescout.com";
    const expected = {
      countertops: {
        title: "Countertop Builder | TradeScout",
        description:
          "Choose real Quartzite, Engineered Quartz, Granite, and other surfaces, then plan the runs and gross countertop layout footprint. Backsplash and range-gap deduc…",
        canonical: `${origin}/u/steel-home-packages/builders/countertops`,
      },
      cabinets: {
        title: "Cabinet Builder | TradeScout",
        description: STEEL_HOME_PACKAGES_PROFILE_CONTENT.tools.cards[1].body,
        canonical: `${origin}/u/steel-home-packages/builders/cabinets`,
      },
      building: {
        title: "Metal Building Builder | TradeScout",
        description: STEEL_HOME_PACKAGES_PROFILE_CONTENT.tools.cards[2].body,
        canonical: `${origin}/u/steel-home-packages/builders/metal-buildings`,
      },
    } as const;

    for (const builder of Object.keys(expected) as Array<keyof typeof expected>) {
      expect(STEEL_HOME_BUILDER_PAGE_METADATA[builder]).toEqual({
        title: expected[builder].title,
        description: expected[builder].description,
      });
      expect(buildSteelHomeBuilderProfilePageMetadata(builder, origin)).toEqual({
        documentTitle: expected[builder].title,
        socialTitle: expected[builder].title,
        description: expected[builder].description,
        canonical: expected[builder].canonical,
        ogType: "website",
        robots: "noindex, nofollow",
      });
    }
    expect(
      STEEL_HOME_PACKAGES_PROFILE_CONTENT.tools.cards[0].body.startsWith(
        expected.countertops.description.slice(0, -1)
      )
    ).toBe(true);
  });

  it("uses one shared builder title and description source in server HTML and client hydration", () => {
    const serverSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/steelHomeBuilderProfileRoute.ts"),
      "utf8"
    );
    const clientSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/ProfileSiteView.tsx"),
      "utf8"
    );

    expect(serverSource).toContain("STEEL_HOME_BUILDER_PAGE_METADATA[builder]");
    expect(clientSource).toContain("STEEL_HOME_BUILDER_PAGE_METADATA[steelHomeBuilderRoute]");
    expect(clientSource).toContain("steelHomePageMetadata?.title || seoTitle");
    expect(clientSource).toContain("steelHomePageMetadata?.description ||");
    expect(clientSource).toContain("noIndex");
    for (const metadata of Object.values(STEEL_HOME_BUILDER_PAGE_METADATA)) {
      expect(metadata.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("runs the dedicated builder handler before generic profile item validation", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
    const routeStart = source.indexOf(
      '["/u/:slug/:collection/:itemSlug", "/p/:slug/:collection/:itemSlug"]'
    );
    const routeEnd = source.indexOf("// Public profile pages", routeStart);
    const routeSource = source.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(routeSource).toContain("serveSteelHomeBuilderProfileRoute");
    expect(routeSource).toContain("renderProfileHtml: buildPublicProfileHtml");
    expect(routeSource.indexOf("serveSteelHomeBuilderProfileRoute")).toBeLessThan(
      routeSource.indexOf("resolvePublicProfileItemRequest")
    );
  });
});
