import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");

function routeSource(marker: string, nextMarker: string): string {
  const start = source.indexOf(marker);
  const end = source.indexOf(nextMarker, start + marker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("public detail route terminal status contract", () => {
  const routes = [
    ['app.get("/promo/:slug"', "// HomeScout property detail pages"],
    ['app.get("/homescout/listings/:listingId"', "// Handmade product detail pages"],
    ['app.get("/handmade/products/:productId"', "// Fixed-price profile services"],
    ['app.get("/services/:offerId"', "// Exchange listing detail pages"],
    ['app.get("/exchange/:category/:listingId"', "// Exchange pages:"],
  ] as const;

  for (const [marker, nextMarker] of routes) {
    it(`${marker} returns 404 for unavailable content and 500 for render failures`, () => {
      const route = routeSource(marker, nextMarker);
      expect(route).toContain("sendPublicPageNotFound");
      expect(route).toContain("sendPublicPageRenderFailure");
      expect(route).not.toContain("sendFile");
    });
  }
});
