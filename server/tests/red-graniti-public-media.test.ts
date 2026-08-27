import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  RED_GRANITI_PUBLIC_MEDIA_BYTES,
  RED_GRANITI_PUBLIC_MEDIA_FILE_COUNT,
  resolveRedGranitiPublicMediaObjectKey,
} from "@shared/redGranitiPublicMedia";
import { registerRedGranitiPublicMediaRoutes } from "../routes/red-graniti-public-media";

const knownImage = "/images/businesses/red-graniti/source/home-hero.svg";

describe("R.E.D. Graniti server-side public media", () => {
  it("maps only pinned legacy URLs into the isolated R2 namespace", () => {
    expect(resolveRedGranitiPublicMediaObjectKey(knownImage)).toBe(
      "public-media/images/businesses/red-graniti/source/home-hero.svg"
    );
    expect(resolveRedGranitiPublicMediaObjectKey(`${knownImage}?v=4`)).toBeTruthy();
    expect(
      resolveRedGranitiPublicMediaObjectKey(
        "/images/businesses/red-graniti/source/not-in-manifest.svg"
      )
    ).toBeNull();
    expect(
      resolveRedGranitiPublicMediaObjectKey(
        "/images/businesses/red-graniti/source/%2e%2e/private.svg"
      )
    ).toBeNull();
    expect(RED_GRANITI_PUBLIC_MEDIA_FILE_COUNT).toBe(11);
    expect(RED_GRANITI_PUBLIC_MEDIA_BYTES).toBe(2433960);
  });

  it("preserves GET and HEAD URLs while delegating bytes to R2", async () => {
    const calls: Array<{ method: string; key: string }> = [];
    const app = express();
    registerRedGranitiPublicMediaRoutes(app, {
      stream: async ({ req, res, key }) => {
        calls.push({ method: req.method, key });
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.status(200).send(req.method === "HEAD" ? undefined : "<svg/>");
        return "served";
      },
    });
    app.use((_req, res) => res.status(404).end());

    const getResponse = await request(app).get(knownImage);
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers["content-type"]).toContain("image/svg+xml");
    expect(getResponse.headers["cache-control"]).toContain("immutable");

    const headResponse = await request(app).head(knownImage);
    expect(headResponse.status).toBe(200);
    expect(headResponse.text).toBeUndefined();
    expect(calls.map((call) => call.method)).toEqual(["GET", "HEAD"]);
  });

  it("does not expose unlisted or traversal-like paths", async () => {
    const app = express();
    registerRedGranitiPublicMediaRoutes(app, {
      stream: async () => {
        throw new Error("unlisted paths must never reach storage");
      },
    });
    app.use((_req, res) => res.status(404).end());

    await request(app).get("/images/businesses/red-graniti/source/not-in-manifest.svg").expect(404);
    await request(app)
      .get("/images/businesses/red-graniti/source/%252e%252e/private.svg")
      .expect(404);
  });
});
