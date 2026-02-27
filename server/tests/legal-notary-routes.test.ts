import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import legalNotaryRouter from "../routes/legal-notary-routes";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/legal/notary", legalNotaryRouter);
  return app;
}

describe("legal notary routes", () => {
  it("lists supported state summaries with Louisiana live", async () => {
    const app = createApp();
    const res = await request(app).get("/api/legal/notary/states");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const louisiana = res.body.find((state: any) => state.stateCode === "LA");
    expect(louisiana).toBeTruthy();
    expect(louisiana.status).toBe("live");
    expect(louisiana.mobileNotaryAvailable).toBe(true);
    expect(louisiana.remoteOnlineNotaryAllowed).toBe(true);
  });

  it("returns Louisiana policy details", async () => {
    const app = createApp();
    const res = await request(app).get("/api/legal/notary/states/LA");

    expect(res.status).toBe(200);
    expect(res.body.stateCode).toBe("LA");
    expect(Array.isArray(res.body.allowedServiceTypes)).toBe(true);
    expect(res.body.allowedServiceTypes).toContain("affidavit");
  });

  it("approves supported Louisiana intake paths", async () => {
    const app = createApp();
    const res = await request(app).post("/api/legal/notary/intake").send({
      stateCode: "LA",
      serviceType: "affidavit",
      documentType: "general_affidavit",
      signerCount: 1,
      serviceAddress1: "123 Main St",
      serviceCity: "Baton Rouge",
      serviceZipCode: "70801",
      preferredArrivalWindow: "2026-03-03 10:00-12:00",
    });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.status).toBe("approved_path");
  });

  it("routes restricted Louisiana document types to manual review", async () => {
    const app = createApp();
    const res = await request(app).post("/api/legal/notary/intake").send({
      stateCode: "LA",
      serviceType: "affidavit",
      documentType: "testament",
      signerCount: 1,
      serviceAddress1: "123 Main St",
      serviceCity: "Baton Rouge",
      serviceZipCode: "70801",
      preferredArrivalWindow: "2026-03-03 10:00-12:00",
    });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.status).toBe("manual_review");
  });

  it("returns unsupported for states without live policy", async () => {
    const app = createApp();
    const res = await request(app).post("/api/legal/notary/intake").send({
      stateCode: "TX",
      serviceType: "affidavit",
      documentType: "general_affidavit",
      signerCount: 1,
      serviceAddress1: "100 Congress Ave",
      serviceCity: "Austin",
      serviceZipCode: "78701",
      preferredArrivalWindow: "2026-03-03 10:00-12:00",
    });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.status).toBe("unsupported");
  });

  it("requires mobile appointment details for automated path", async () => {
    const app = createApp();
    const res = await request(app).post("/api/legal/notary/intake").send({
      stateCode: "LA",
      serviceType: "affidavit",
      documentType: "general_affidavit",
      signerCount: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.status).toBe("manual_review");
  });

  it("approves remote intake for Louisiana remote-eligible service types", async () => {
    const app = createApp();
    const res = await request(app).post("/api/legal/notary/intake").send({
      stateCode: "LA",
      deliveryMode: "remote",
      serviceType: "affidavit",
      documentType: "general_affidavit",
      signerCount: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.status).toBe("approved_path");
    expect(String(res.body.reason).toLowerCase()).toContain("remote notary");
  });

  it("routes non-remote-eligible services to manual review for remote mode", async () => {
    const app = createApp();
    const res = await request(app).post("/api/legal/notary/intake").send({
      stateCode: "LA",
      deliveryMode: "remote",
      serviceType: "real_estate_closing_package",
      documentType: "closing_packet",
      signerCount: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.status).toBe("manual_review");
  });
});
