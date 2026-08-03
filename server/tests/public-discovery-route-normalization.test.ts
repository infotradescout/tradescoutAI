import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { publicDiscoveryRouteNormalization } from "../publicDiscoveryRouteNormalization";

function createApp() {
  const app = express();
  app.use(publicDiscoveryRouteNormalization);
  app.use((req, res) => res.status(204).set("X-Reached-SPA", req.path).end());
  return app;
}

describe("public discovery route normalization", () => {
  it.each(["GET", "HEAD"] as const)(
    "redirects the HomeScout alias to its client-owned canonical route for %s",
    async (method) => {
      const response = await request(createApp())
        [method.toLowerCase() as "get" | "head"]("/HomeScout-Listings/?county=22063")
        .set("Host", "evil.example")
        .set("X-Forwarded-Host", "attacker.example")
        .set("X-Forwarded-Proto", "http");

      expect(response.status).toBe(308);
      expect(response.headers.location).toBe("/exchange/real-estate?county=22063");
    }
  );

  it.each([
    ["/COMMUNITY-FEED", "/community-feed"],
    ["/find-local-businesses/", "/find-local-businesses"],
    ["/Direct-Connect/?mode=post", "/direct-connect?mode=post"],
  ])("normalizes mapped variants without losing query state: %s", async (source, target) => {
    const response = await request(createApp()).get(source);

    expect(response.status).toBe(308);
    expect(response.headers.location).toBe(target);
  });

  it.each(["/community-feed", "/find-local-businesses", "/direct-connect", "/about"])(
    "passes the exact canonical route through to the SPA: %s",
    async (pathname) => {
      const response = await request(createApp()).get(pathname);

      expect(response.status).toBe(204);
      expect(response.headers["x-reached-spa"]).toBe(pathname);
    }
  );

  it("does not claim unrelated routes", async () => {
    const response = await request(createApp()).get("/exchange?tab=services");

    expect(response.status).toBe(204);
    expect(response.headers["x-reached-spa"]).toBe("/exchange");
  });

  it("does not redirect non-navigation methods", async () => {
    const response = await request(createApp()).post("/Direct-Connect/");

    expect(response.status).toBe(204);
    expect(response.headers["x-reached-spa"]).toBe("/Direct-Connect/");
  });
});
