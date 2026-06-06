import express from "express";
import { rateLimit } from "express-rate-limit";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createPostgresRateLimitStore } from "./postgresRateLimitStore";
import { readPositiveIntegerEnv } from "./rateLimitConfig";

type Bucket = {
  hits: number;
  resetAt: Date;
};

function createFakePool() {
  const buckets = new Map<string, Bucket>();

  return {
    buckets,
    async query(sql: string, params: unknown[] = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("insert into rate_limit_buckets")) {
        const key = String(params[0] || "");
        const windowMs = Number(params[1] || 60_000);
        const now = Date.now();
        const existing = buckets.get(key);
        const active = existing && existing.resetAt.getTime() > now;
        const next: Bucket = active
          ? { hits: existing.hits + 1, resetAt: existing.resetAt }
          : { hits: 1, resetAt: new Date(now + windowMs) };
        buckets.set(key, next);
        return { rows: [{ hits: next.hits, reset_at: next.resetAt }] };
      }

      if (normalized.startsWith("update rate_limit_buckets")) {
        const key = String(params[0] || "");
        const existing = buckets.get(key);
        if (existing) {
          buckets.set(key, { ...existing, hits: Math.max(existing.hits - 1, 0) });
        }
        return { rows: [] };
      }

      if (normalized.startsWith("delete from rate_limit_buckets where bucket_key")) {
        buckets.delete(String(params[0] || ""));
        return { rows: [] };
      }

      return { rows: [] };
    },
  };
}

describe("Direct Connect rate-limit hardening", () => {
  afterEach(() => {
    delete process.env.DIRECT_CONNECT_CREATE_LIMIT_15M;
  });

  it("falls back to sane positive defaults when env knobs are missing or invalid", () => {
    expect(readPositiveIntegerEnv("DIRECT_CONNECT_CREATE_LIMIT_15M", 12)).toBe(12);

    process.env.DIRECT_CONNECT_CREATE_LIMIT_15M = "0";
    expect(readPositiveIntegerEnv("DIRECT_CONNECT_CREATE_LIMIT_15M", 12)).toBe(12);

    process.env.DIRECT_CONNECT_CREATE_LIMIT_15M = "not-a-number";
    expect(readPositiveIntegerEnv("DIRECT_CONNECT_CREATE_LIMIT_15M", 12)).toBe(12);

    process.env.DIRECT_CONNECT_CREATE_LIMIT_15M = "25";
    expect(readPositiveIntegerEnv("DIRECT_CONNECT_CREATE_LIMIT_15M", 12)).toBe(25);
  });

  it("allows normal requests, blocks excess requests, and isolates actors and buckets", async () => {
    const pool = createFakePool();
    const app = express();
    app.use(express.json());

    const keyGenerator = (req: express.Request) => `u:${req.get("x-test-user") || "anon"}`;
    const createLimiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      message: {
        message: "Too many Direct Connect requests. Please slow down and try again shortly.",
        code: "DIRECT_CONNECT_RATE_LIMITED",
      },
      store: createPostgresRateLimitStore({
        pool: pool as unknown as Pool,
        prefix: "rl:direct_connect:create",
      }),
    });
    const workflowLimiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      message: {
        message: "Too many Direct Connect actions. Please slow down and try again shortly.",
        code: "DIRECT_CONNECT_RATE_LIMITED",
      },
      store: createPostgresRateLimitStore({
        pool: pool as unknown as Pool,
        prefix: "rl:direct_connect:workflow",
      }),
    });

    app.post("/api/direct-connect/requests", createLimiter, (_req, res) => res.json({ ok: true }));
    app.post("/api/direct-connect/requests/:id/route", workflowLimiter, (_req, res) =>
      res.json({ ok: true })
    );

    await request(app)
      .post("/api/direct-connect/requests")
      .set("x-test-user", "requester-1")
      .expect(200);
    await request(app)
      .post("/api/direct-connect/requests")
      .set("x-test-user", "requester-1")
      .expect(200);

    const blocked = await request(app)
      .post("/api/direct-connect/requests")
      .set("x-test-user", "requester-1")
      .expect(429);
    expect(blocked.body).toEqual({
      message: "Too many Direct Connect requests. Please slow down and try again shortly.",
      code: "DIRECT_CONNECT_RATE_LIMITED",
    });

    await request(app)
      .post("/api/direct-connect/requests")
      .set("x-test-user", "requester-2")
      .expect(200);

    await request(app)
      .post("/api/direct-connect/requests/request-1/route")
      .set("x-test-user", "requester-1")
      .expect(200);

    expect(pool.buckets.get("rl:direct_connect:create:u:requester-1")?.hits).toBe(3);
    expect(pool.buckets.get("rl:direct_connect:create:u:requester-2")?.hits).toBe(1);
    expect(pool.buckets.get("rl:direct_connect:workflow:u:requester-1")?.hits).toBe(1);
  });
});
