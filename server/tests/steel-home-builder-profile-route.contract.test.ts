import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildSteelHomeBuilderPath,
  resolveSteelHomeBuilderPathname,
  resolveSteelHomeBuilderRoute,
  STEEL_HOME_BUILDER_ROUTE_SLUGS,
} from "../../shared/steelHomeBuilderRoutes";

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
    expect(routeSource.indexOf("serveSteelHomeBuilderProfileRoute")).toBeLessThan(
      routeSource.indexOf("resolvePublicProfileItemRequest")
    );
  });
});
