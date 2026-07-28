import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/redisClient", () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  isRedisConfigured: vi.fn().mockReturnValue(false),
}));

import { antiScrapeShield } from "../middleware/antiScrape";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

function app() {
  const instance = express();
  instance.use(antiScrapeShield);
  instance.get("*", (_req, res) => res.status(200).send("ok"));
  return instance;
}

describe("anti-scrape limits for generated social previews", () => {
  it("rate-limits generated .png cards while leaving ordinary static images allowlisted", async () => {
    process.env.NODE_ENV = "production";
    const instance = app();
    const forwardedIp = "192.0.2.77";

    for (let requestIndex = 0; requestIndex < 100; requestIndex += 1) {
      const response = await request(instance)
        .get(`/images/social/card/example-${requestIndex}.png`)
        .set("X-Forwarded-For", forwardedIp)
        .set("User-Agent", "social-preview-regression-test");
      expect(response.status).toBe(200);
    }

    const limited = await request(instance)
      .get("/images/social/card/example-over-limit.png")
      .set("X-Forwarded-For", forwardedIp)
      .set("User-Agent", "social-preview-regression-test");
    expect(limited.status).toBe(429);

    const staticImage = await request(instance)
      .get("/images/brand/logo.png")
      .set("X-Forwarded-For", forwardedIp)
      .set("User-Agent", "social-preview-regression-test");
    expect(staticImage.status).toBe(200);
  });
});
