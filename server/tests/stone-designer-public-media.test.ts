import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { getCatalogItemById } from "../../client/src/features/jw-stone/catalog";
import { buildNamedStoneDesignerImageHref } from "../../client/src/pages/profile-sites/steel-home-project-tools/stoneDesignerImages";
import { resolveJwStonePublicMediaObjectKey } from "@shared/jwStonePublicMedia";
import { registerStoneDesignerImageRoutes } from "../routes/stone-designer-images";

function cristalloFixture() {
  const stone = getCatalogItemById("cristallo");
  const imageHref = stone?.images[0];
  const namedHref = stone?.shareSlug
    ? buildNamedStoneDesignerImageHref(stone.shareSlug, imageHref || "")
    : null;
  if (!stone || !imageHref || !namedHref) throw new Error("Expected named Cristallo fixture");
  return { stone, imageHref, namedHref };
}

describe("stone designer R2 image aliases", () => {
  it("serves named and legacy GET/HEAD aliases from the pinned public object", async () => {
    const fixture = cristalloFixture();
    const calls: Array<{ method: string; key: string; cacheControl?: string }> = [];
    const app = express();
    registerStoneDesignerImageRoutes(app, {
      stream: async ({ req, res, key, cacheControl }) => {
        calls.push({ method: req.method, key, cacheControl });
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", cacheControl || "no-store");
        res.status(200).send(req.method === "HEAD" ? undefined : Buffer.from("stone"));
        return "served";
      },
    });
    app.use((_req, res) => res.status(404).end());

    await request(app).get(fixture.namedHref).expect(200);
    await request(app).head(fixture.namedHref).expect(200);
    await request(app).get(`/images/stone-designer/${fixture.stone.id}/1.webp`).expect(200);

    expect(calls.map((call) => call.method)).toEqual(["GET", "HEAD", "GET"]);
    expect(new Set(calls.map((call) => call.key))).toEqual(
      new Set([resolveJwStonePublicMediaObjectKey(fixture.imageHref)])
    );
    expect(calls[0].cacheControl).toContain("immutable");
    expect(calls[2].cacheControl).toContain("stale-while-revalidate");
  });

  it("does not send malformed or unknown aliases to storage", async () => {
    const app = express();
    registerStoneDesignerImageRoutes(app, {
      stream: async () => {
        throw new Error("invalid aliases must not reach storage");
      },
    });
    app.use((_req, res) => res.status(404).end());

    await request(app).get("/images/stone-designer/unknown-stone/1.webp").expect(404);
    await request(app)
      .get("/images/stone-designer/named/cristallo/ph_0000000000000000.webp")
      .expect(404);
    await request(app).get("/images/stone-designer/%252e%252e/1.webp").expect(404);
  });
});
