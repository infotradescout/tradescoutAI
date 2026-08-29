import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  JW_STONE_PUBLIC_MEDIA_BYTES,
  JW_STONE_PUBLIC_MEDIA_FILE_COUNT,
  resolveJwStonePublicMediaObjectKey,
} from "@shared/jwStonePublicMedia";
import { registerJwStonePublicMediaRoutes } from "../routes/jw-stone-public-media";

const knownImage =
  "/images/businesses/jw-stone/inventory-source/16XiKXpuST1VEIuUn5jhX9RH9rAYq86jG.webp";
const brokenWhiteCollageImage =
  "/images/businesses/jw-stone/color-collage/01-white.webp";
const verifiedWhiteReplacementKey =
  "public-media/images/businesses/jw-stone/inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp";
const verticalColorSlivers = [
  "rhino-white.webp",
  "galaxy-white.webp",
  "dueto.webp",
  "versace.webp",
  "honey-onyx.webp",
  "fusion-brown.webp",
  "gold-macaubas.webp",
  "giallo-ornamental.webp",
  "amazonic-green.webp",
  "marbella-green.webp",
  "blue-dream.webp",
  "blue-bahia.webp",
  "bronzonite.webp",
  "chocolate-brown.webp",
  "titanium-black-leathered.webp",
  "preto-sao-gabriel.webp",
].map((fileName) => `/images/businesses/jw-stone/color-slivers/${fileName}`);

describe("JW Stone server-side public media", () => {
  it("maps only pinned legacy URLs into the isolated R2 namespace", () => {
    expect(resolveJwStonePublicMediaObjectKey(knownImage)).toBe(
      "public-media/images/businesses/jw-stone/inventory-source/16XiKXpuST1VEIuUn5jhX9RH9rAYq86jG.webp"
    );
    expect(resolveJwStonePublicMediaObjectKey(`${knownImage}?v=4`)).toBeTruthy();
    expect(resolveJwStonePublicMediaObjectKey(brokenWhiteCollageImage)).toBe(
      verifiedWhiteReplacementKey
    );
    expect(
      resolveJwStonePublicMediaObjectKey(`${brokenWhiteCollageImage}?v=face-truth-1&delivery=full-2`)
    ).toBe(verifiedWhiteReplacementKey);
    expect(
      resolveJwStonePublicMediaObjectKey(
        "/images/businesses/jw-stone/inventory-source/not-in-manifest.webp"
      )
    ).toBeNull();
    expect(
      resolveJwStonePublicMediaObjectKey("/images/businesses/jw-stone/%2e%2e/private/secret.webp")
    ).toBeNull();
    expect(JW_STONE_PUBLIC_MEDIA_FILE_COUNT).toBe(899);
    expect(JW_STONE_PUBLIC_MEDIA_BYTES).toBe(175020735);
  });

  it("pins every reviewed slab-only vertical color image to production storage", () => {
    expect(verticalColorSlivers).toHaveLength(16);
    expect(verticalColorSlivers.some((path) => path.includes("trending-selection-"))).toBe(false);

    for (const publicPath of verticalColorSlivers) {
      expect(resolveJwStonePublicMediaObjectKey(publicPath)).toBe(`public-media${publicPath}`);
      expect(resolveJwStonePublicMediaObjectKey(`${publicPath}?v=slab-core-spectrum-3`)).toBe(
        `public-media${publicPath}`
      );
    }
  });

  it("preserves GET and HEAD URLs while delegating bytes to server storage", async () => {
    const calls: Array<{ method: string; key: string }> = [];
    const app = express();
    registerJwStonePublicMediaRoutes(app, {
      stream: async ({ req, res, key }) => {
        calls.push({ method: req.method, key });
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.status(200).send(req.method === "HEAD" ? undefined : Buffer.from("stone"));
        return "served";
      },
    });
    app.use((_req, res) => res.status(404).end());

    const getResponse = await request(app).get(knownImage);
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers["content-type"]).toContain("image/webp");
    expect(getResponse.headers["cache-control"]).toContain("immutable");

    const headResponse = await request(app).head(knownImage);
    expect(headResponse.status).toBe(200);
    expect(headResponse.text).toBeUndefined();
    expect(calls.map((call) => call.method)).toEqual(["GET", "HEAD"]);
    expect(new Set(calls.map((call) => call.key))).toEqual(
      new Set([
        "public-media/images/businesses/jw-stone/inventory-source/16XiKXpuST1VEIuUn5jhX9RH9rAYq86jG.webp",
      ])
    );
  });

  it("serves the legacy broken white collage URL from the verified replacement object", async () => {
    const calls: string[] = [];
    const app = express();
    registerJwStonePublicMediaRoutes(app, {
      stream: async ({ res, key }) => {
        calls.push(key);
        res.setHeader("Content-Type", "image/webp");
        res.status(200).send(Buffer.from("verified-white-stone"));
        return "served";
      },
    });
    app.use((_req, res) => res.status(404).end());

    const response = await request(app).get(
      `${brokenWhiteCollageImage}?v=face-truth-1&delivery=full-2`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(Buffer.from("verified-white-stone"));
    expect(calls).toEqual([verifiedWhiteReplacementKey]);
  });

  it("does not expose unlisted or traversal-like paths", async () => {
    const app = express();
    registerJwStonePublicMediaRoutes(app, {
      stream: async () => {
        throw new Error("unlisted paths must never reach storage");
      },
    });
    app.use((_req, res) => res.status(404).end());

    await request(app)
      .get("/images/businesses/jw-stone/inventory-source/not-in-manifest.webp")
      .expect(404);
    await request(app)
      .get("/images/businesses/jw-stone/%252e%252e/private/secret.webp")
      .expect(404);
  });
});
