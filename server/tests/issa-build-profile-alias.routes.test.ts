import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { profilesRouter } from "../routes/profiles";
import { registerTradePartnerExpressRoutes } from "../routes/tradepartner-express";

const app = express();
app.use(express.json());
app.use(profilesRouter);

const directConnectApp = express();
directConnectApp.use(express.json());
registerTradePartnerExpressRoutes(directConnectApp);

describe("ISSA Build legacy API aliases", () => {
  it.each([
    [
      "/api/u/honey-onyx?stone=multi-green-onyx&photo=3",
      "/api/u/issa-build?stone=multi-green-onyx&photo=3",
    ],
    [
      "/api/u/honey%2Donyx?stone=multi-green-onyx&photo=3",
      "/api/u/issa-build?stone=multi-green-onyx&photo=3",
    ],
    ["/api/u/honey-onyx/views?window=30", "/api/u/issa-build/views?window=30"],
    [
      "/api/u/honey-onyx/trust-actions?source=profile",
      "/api/u/issa-build/trust-actions?source=profile",
    ],
    ["/api/p/honey-onyx?stone=honey-onyx&photo=2", "/api/u/issa-build?stone=honey-onyx&photo=2"],
  ])("redirects GET %s to its canonical ISSA Build API path", async (source, target) => {
    const response = await request(app).get(source);
    expect(response.status).toBe(301);
    expect(response.headers.location).toBe(target);
  });

  it("uses a method-preserving redirect for legacy trust-action writes", async () => {
    const response = await request(app)
      .post("/api/u/honey-onyx/trust-actions/like?source=profile")
      .send({});

    expect(response.status).toBe(308);
    expect(response.headers.location).toBe("/api/u/issa-build/trust-actions/like?source=profile");
  });

  it.each([
    [
      "/api/tradepartner-profiles/honey-onyx/express-contact/reveal?source=profile",
      "/api/tradepartner-profiles/issa-build/express-contact/reveal?source=profile",
    ],
    [
      "/api/tradepartner-profiles/honey-onyx/express-request?stone=multi-green-onyx",
      "/api/tradepartner-profiles/issa-build/express-request?stone=multi-green-onyx",
    ],
    [
      "/api/tradepartner-profiles/honey%2Donyx/express-request?stone=multi-green-onyx",
      "/api/tradepartner-profiles/issa-build/express-request?stone=multi-green-onyx",
    ],
  ])("preserves method and source context for Direct Connect alias %s", async (source, target) => {
    const response = await request(directConnectApp).post(source).send({ marker: "preserved" });

    expect(response.status).toBe(308);
    expect(response.headers.location).toBe(target);
  });
});
