import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";
import { registerProfilePublicMediaRoutes } from "../routes/profile-public-media";

const precisionHero = "/images/profiles/precision-aerial/hero-reel.mp4";

describe("profile public media Release B compatibility", () => {
  it("maps exact pinned paths, including aliases, and rejects traversal", () => {
    expect(resolveProfilePublicMediaObjectKey(precisionHero)).toBe(
      "public-media/images/profiles/precision-aerial/hero-reel.mp4"
    );
    expect(resolveProfilePublicMediaObjectKey("/images/businesses/issa-build/slabs/2.jpg")).toBe(
      "public-media/images/businesses/jw-stone/inventory/onyx/honey-onyx/2.jpg"
    );
    expect(resolveProfilePublicMediaObjectKey(`${precisionHero}?v=1`)).toBeTruthy();
    expect(
      resolveProfilePublicMediaObjectKey("/images/profiles/precision-aerial/missing.jpg")
    ).toBeNull();
    expect(resolveProfilePublicMediaObjectKey("/images/profiles/%2e%2e/private.jpg")).toBeNull();
    for (const unsafe of [
      "/images/profiles/precision-aerial%2fhero-reel.mp4",
      "/images/profiles/precision-aerial%2Fhero-reel.mp4",
      "/images/profiles/precision-aerial%5chero-reel.mp4",
      "/images/profiles/precision-aerial%5Chero-reel.mp4",
      "/images/profiles/precision-aerial%252fhero-reel.mp4",
      "/images/profiles/precision-aerial/%E0%A4%A",
      "/images/profiles/Precision-Aerial/hero-reel.mp4",
    ]) {
      expect(resolveProfilePublicMediaObjectKey(unsafe)).toBeNull();
    }
  });

  it("serves GET and HEAD from storage when ready", async () => {
    const methods: string[] = [];
    const app = express();
    registerProfilePublicMediaRoutes(app, {
      stream: async ({ req, res }) => {
        methods.push(req.method);
        res
          .type("video/mp4")
          .status(200)
          .send(req.method === "HEAD" ? undefined : Buffer.from("video"));
        return "served";
      },
    });
    app.use((_req, res) => res.status(404).end());
    await request(app).get(precisionHero).expect(200);
    await request(app).head(precisionHero).expect(200);
    expect(methods).toEqual(["GET", "HEAD"]);
  });

  it.each(["not_found", "unconfigured", "error"] as const)(
    "fails truthfully without a static fallback on %s",
    async (result) => {
      const app = express();
      registerProfilePublicMediaRoutes(app, {
        stream: async () => result,
      });
      app.get(precisionHero, (_req, res) => res.status(200).send("static"));
      await request(app)
        .get(precisionHero)
        .expect("Cache-Control", "no-store")
        .expect(502, "Public media is temporarily unavailable");
    }
  );

  it("fails truthfully when the storage reader throws", async () => {
    const app = express();
    registerProfilePublicMediaRoutes(app, {
      stream: async () => {
        throw new Error("storage unavailable");
      },
    });
    app.get(precisionHero, (_req, res) => res.status(200).send("static"));
    await request(app)
      .get(precisionHero)
      .expect("Cache-Control", "no-store")
      .expect(502, "Public media is temporarily unavailable");
  });

  it("does not fall through to static media for a failed HEAD request", async () => {
    const app = express();
    registerProfilePublicMediaRoutes(app, { stream: async () => "not_found" });
    app.head(precisionHero, (_req, res) => res.status(200).end());
    await request(app).head(precisionHero).expect("Cache-Control", "no-store").expect(502);
  });

  it("lets unknown image paths continue to the static shell", async () => {
    const app = express();
    registerProfilePublicMediaRoutes(app, {
      stream: async () => {
        throw new Error("unknown paths must not reach storage");
      },
    });
    app.get("/images/shell/logo.png", (_req, res) => res.status(200).send("shell"));
    await request(app).get("/images/shell/logo.png").expect(200, "shell");
  });
});
