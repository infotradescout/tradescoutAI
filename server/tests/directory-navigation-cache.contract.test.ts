import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listActiveTradeScopes: vi.fn(async () => [{ tradeSlug: "electrician", businessCount: 12 }]),
}));

vi.mock("../db", () => ({ db: {} }));
vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../publicationRules", () => ({
  getPublicationRules: vi.fn(async () => ({})),
}));
vi.mock("../services/seoDirectoryNavigationService", () => ({
  listActiveTradeScopes: mocks.listActiveTradeScopes,
  listActiveTradeStateScopes: vi.fn(async () => []),
  listActiveTradeCountyScopes: vi.fn(async () => []),
  listActiveCountyTradeScopes: vi.fn(async () => []),
}));

import { businessDirectoryPublicRouter } from "../routes/business-directory-public";

function buildApp() {
  const app = express();
  app.use(businessDirectoryPublicRouter);
  return app;
}

describe("directory navigation response cache", () => {
  it("responds to every request while reusing the cached plain payload", async () => {
    const app = buildApp();
    const first = await request(app)
      .get("/api/public/seo/directory-navigation")
      .timeout({ response: 500, deadline: 1_000 });
    const second = await request(app)
      .get("/api/public/seo/directory-navigation")
      .timeout({ response: 500, deadline: 1_000 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual({
      scope: "trades",
      trades: [{ tradeSlug: "electrician", businessCount: 12 }],
    });
    expect(second.body).toEqual(first.body);
    expect(mocks.listActiveTradeScopes).toHaveBeenCalledTimes(1);
  });
});
