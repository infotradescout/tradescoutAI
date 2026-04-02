import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import scoutNormalizeRouter from "../routes/scout-normalize";
import { normalizeScoutInteraction } from "../services/scoutNormalization";

describe("scout normalization service", () => {
  it('normalizes "Need someone to replace a water heater in Ponchatoula"', () => {
    const result = normalizeScoutInteraction(
      "Need someone to replace a water heater in Ponchatoula"
    );

    expect(result.interaction_type).toBe("service_request");
    expect(result.intent).toBe("hire_provider");
    expect(result.domain).toBe("home_services");
    expect(result.location.city).toBe("Ponchatoula");
    expect(result.location.state).toBe("LA");
    expect(result.entities.service_type).toBe("plumbing");
    expect(result.entities.project_type).toBe("water_heater_replacement");
    expect(result.routing_tags).toEqual(
      expect.arrayContaining([
        "service_request",
        "home_services",
        "water_heater_replacement",
        "ponchatoula",
      ])
    );
  });

  it('normalizes "Who’s the best realtor in Covington?"', () => {
    const result = normalizeScoutInteraction("Who’s the best realtor in Covington?");

    expect(result.interaction_type).toBe("recommendation_request");
    expect(result.intent).toBe("find_provider");
    expect(result.domain).toBe("local_business");
    expect(result.location.city).toBe("Covington");
    expect(result.location.state).toBe("LA");
    expect(result.entities.business_type).toBe("real_estate");
    expect(result.entities.person_type).toBe("realtor");
    expect(result.routing_tags).toEqual(
      expect.arrayContaining(["recommendation_request", "local_business", "realtor", "covington"])
    );
  });

  it('normalizes "Selling a utility trailer in Hammond"', () => {
    const result = normalizeScoutInteraction("Selling a utility trailer in Hammond");

    expect(result.interaction_type).toBe("marketplace_listing");
    expect(result.intent).toBe("sell_item");
    expect(result.domain).toBe("marketplace");
    expect(result.location.city).toBe("Hammond");
    expect(result.location.state).toBe("LA");
    expect(result.entities.item_type).toBe("utility_trailer");
    expect(result.routing_tags).toEqual(
      expect.arrayContaining(["marketplace_listing", "marketplace", "utility_trailer", "hammond"])
    );
  });

  it('normalizes "Anybody know when the fair starts in Amite?"', () => {
    const result = normalizeScoutInteraction("Anybody know when the fair starts in Amite?");

    expect(result.interaction_type).toBe("information_request");
    expect(result.intent).toBe("get_information");
    expect(result.domain).toBe("events");
    expect(result.location.city).toBe("Amite");
    expect(result.location.state).toBe("LA");
    expect(result.entities.event_type).toBe("fair");
    expect(result.routing_tags).toEqual(
      expect.arrayContaining(["information_request", "events", "fair", "amite"])
    );
  });
});

describe("scout normalize route", () => {
  it("returns structured normalization JSON for valid requests on /api/scout/normalize", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/scout", scoutNormalizeRouter);

    const res = await request(app)
      .post("/api/scout/normalize")
      .send({ raw_text: "Need someone to replace a water heater in Ponchatoula" });

    expect(res.status).toBe(200);
    expect(res.body.interaction_type).toBe("service_request");
    expect(res.body.intent).toBe("hire_provider");
    expect(res.body.domain).toBe("home_services");
    expect(res.body.entities?.project_type).toBe("water_heater_replacement");
    expect(res.body.location?.city).toBe("Ponchatoula");
    expect(res.body.routing_tags).toEqual(
      expect.arrayContaining([
        "service_request",
        "home_services",
        "water_heater_replacement",
        "ponchatoula",
      ])
    );
  });

  it("returns structured normalization JSON for valid requests on /normalize", async () => {
    const app = express();
    app.use(express.json());
    app.use("/", scoutNormalizeRouter);

    const res = await request(app)
      .post("/normalize")
      .send({ raw_text: "Who’s the best realtor in Covington?" });

    expect(res.status).toBe(200);
    expect(res.body.interaction_type).toBe("recommendation_request");
    expect(res.body.intent).toBe("find_provider");
    expect(res.body.domain).toBe("local_business");
    expect(res.body.entities?.person_type).toBe("realtor");
    expect(res.body.location?.city).toBe("Covington");
    expect(res.body.routing_tags).toEqual(
      expect.arrayContaining(["recommendation_request", "local_business", "realtor", "covington"])
    );
  });

  it("returns 400 when raw_text is missing", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/scout", scoutNormalizeRouter);

    const res = await request(app).post("/api/scout/normalize").send({});

    expect(res.status).toBe(400);
    expect(String(res.body?.error || "")).toContain("Invalid request");
  });

  it("keeps text as a backward-compatible alias", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/scout", scoutNormalizeRouter);

    const res = await request(app)
      .post("/api/scout/normalize")
      .send({ text: "Selling a utility trailer in Hammond" });

    expect(res.status).toBe(200);
    expect(res.body.interaction_type).toBe("marketplace_listing");
    expect(res.body.entities?.item_type).toBe("utility_trailer");
  });
});
