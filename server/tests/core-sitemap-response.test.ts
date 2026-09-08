import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { profilesRouter } from "../routes/profiles";

describe("public core sitemap response", () => {
  it("submits the existing discovery destinations and excludes the retired contractor alias", async () => {
    const app = express();
    app.use(profilesRouter);
    const response = await request(app).get("/sitemap-core.xml");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/xml");
    const urls = Array.from(
      response.text.matchAll(/<loc>([^<]+)<\/loc>/g),
      (match) => new URL(match[1]).pathname
    );
    for (const route of [
      "/find-local-businesses",
      "/tangipahoa",
      "/for-businesses",
      "/trade-up-for-trade-schools",
    ]) {
      expect(urls).toContain(route);
    }
    expect(urls).not.toContain("/contractors/apply");
    expect(urls).not.toContain("/landing");
    expect(urls.some((url) => url === "/exchange" || url.startsWith("/exchange/"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
