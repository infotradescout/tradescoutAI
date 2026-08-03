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
  instance.set("trust proxy", 1);
  instance.use(antiScrapeShield);
  instance.all("*", (_req, res) => res.status(200).send("ok"));
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

describe("anti-scrape access for public profile discovery", () => {
  it("allows the exact public profile-name search for discovery clients", async () => {
    process.env.NODE_ENV = "production";
    const response = await request(app())
      .get("/api/profiles/public-search?query=Dean")
      .set("X-Forwarded-For", "192.0.2.88")
      .set("User-Agent", "curl/8.10.1");

    expect(response.status).toBe(200);
    expect(response.headers["x-scout-guard"]).toBe("enabled");
  });

  it("keeps private profile APIs blocked for scraping clients", async () => {
    process.env.NODE_ENV = "production";
    const response = await request(app())
      .get("/api/profiles/private-profile-id")
      .set("X-Forwarded-For", "192.0.2.89")
      .set("User-Agent", "curl/8.10.1");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Automated scraping is blocked." });
  });

  it("allows the route's trailing slash but limits discovery bypasses to reads", async () => {
    process.env.NODE_ENV = "production";
    const instance = app();
    const headers = {
      "X-Forwarded-For": "192.0.2.90",
      "User-Agent": "curl/8.10.1",
    };

    const trailingSlash = await request(instance)
      .get("/api/profiles/public-search/?query=Dean")
      .set(headers);
    const writeAttempt = await request(instance).post("/api/profiles/public-search").set(headers);

    expect(trailingSlash.status).toBe(200);
    expect(trailingSlash.headers["x-scout-guard"]).toBe("enabled");
    expect(writeAttempt.status).toBe(403);
  });

  it("keeps one rate bucket when the caller rotates User-Agent", async () => {
    process.env.NODE_ENV = "production";
    const instance = app();

    for (let requestIndex = 0; requestIndex < 50; requestIndex += 1) {
      const response = await request(instance)
        .get("/api/profiles/public-search?query=Dean")
        .set("X-Forwarded-For", "192.0.2.91")
        .set("User-Agent", `curl/rotated-${requestIndex}`);
      expect(response.status).toBe(200);
    }

    const limited = await request(instance)
      .get("/api/profiles/public-search?query=Dean")
      .set("X-Forwarded-For", "192.0.2.91")
      .set("User-Agent", "curl/rotated-over-limit");
    expect(limited.status).toBe(429);
  });

  it("ignores spoofed forwarding prefixes at the trusted proxy boundary", async () => {
    process.env.NODE_ENV = "production";
    const instance = app();

    for (let requestIndex = 0; requestIndex < 50; requestIndex += 1) {
      const response = await request(instance)
        .get("/api/profiles/public-search?query=Dean")
        .set("X-Forwarded-For", `198.51.100.${requestIndex}, 192.0.2.92`)
        .set("User-Agent", "curl/8.10.1");
      expect(response.status).toBe(200);
    }

    const limited = await request(instance)
      .get("/api/profiles/public-search?query=Dean")
      .set("X-Forwarded-For", "198.51.100.250, 192.0.2.92")
      .set("User-Agent", "curl/8.10.1");
    expect(limited.status).toBe(429);
  });
});
