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

const capDescription = (description: string) =>
  description.length <= 160 ? description : `${description.slice(0, 159).trimEnd()}…`;

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
    const cardByKey = new Map(
      STEEL_HOME_PACKAGES_PROFILE_CONTENT.tools.cards.map((card) => [card.key, card] as const)
    );
    const expected = Object.fromEntries(
      (Object.keys(STEEL_HOME_BUILDER_ROUTE_SLUGS) as Array<
        keyof typeof STEEL_HOME_BUILDER_ROUTE_SLUGS
      >).map((builder) => {
        const card = cardByKey.get(builder);
        if (!card) throw new Error(`Missing planner card for ${builder}`);
        return [
          builder,
          {
            title: `${card.title} | TradeScout`,
            description: capDescription(card.body),
            canonical: `${origin}${buildSteelHomeBuilderPath(builder)}`,
          },
        ];
      })
    ) as Record<
      keyof typeof STEEL_HOME_BUILDER_ROUTE_SLUGS,
      { title: string; description: string; canonical: string }
    >;

    expect(new Set(Object.values(expected).map((item) => item.title)).size).toBe(3);
    expect(new Set(Object.values(expected).map((item) => item.canonical)).size).toBe(3);

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
