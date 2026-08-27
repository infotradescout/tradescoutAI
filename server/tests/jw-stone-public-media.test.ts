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

describe("JW Stone server-side public media", () => {
  it("maps only pinned legacy URLs into the isolated R2 namespace", () => {
    expect(resolveJwStonePublicMediaObjectKey(knownImage)).toBe(
      "public-media/images/businesses/jw-stone/inventory-source/16XiKXpuST1VEIuUn5jhX9RH9rAYq86jG.webp"
    );
    expect(resolveJwStonePublicMediaObjectKey(`${knownImage}?v=4`)).toBeTruthy();
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

  it("preserves GET and HEAD URLs while delegating bytes to R2", async () => {
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
