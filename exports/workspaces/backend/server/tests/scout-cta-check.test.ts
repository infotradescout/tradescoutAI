import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectActionMock, inferSituationMock } = vi.hoisted(() => ({
  selectActionMock: vi.fn(),
  inferSituationMock: vi.fn(),
}));

vi.mock("../scout/governor", () => ({
  selectAction: selectActionMock,
  inferSituation: inferSituationMock,
}));

import { checkCTAAuthority, setupScoutCTACheckRoutes } from "../routes/scout-cta-check";

describe("scout-cta-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inferSituationMock.mockResolvedValue({});
    selectActionMock.mockReturnValue({
      action: "COMPLY",
      authorityProof: { hasProof: true },
    });
  });

  it("returns COMPLY contract from authority check", async () => {
    const result = await checkCTAAuthority({
      action: "direct_connect",
      context: "community_post",
      contextId: "ctx-1",
      scope: "00123",
    });

    expect(result.allowed).toBe(true);
    expect(result.action).toBe("COMPLY");
    expect(result.ctaMode).toBe("show");
  });

  it("returns 400 when required fields are missing", async () => {
    const app = express();
    app.use(express.json());
    setupScoutCTACheckRoutes(app);

    const res = await request(app).post("/api/scout/cta-check").send({ action: "message" });

    expect(res.status).toBe(400);
    expect(String(res.body?.error || "")).toContain("Missing required fields");
  });

  it("fails safe to DEFER when authority check throws", async () => {
    inferSituationMock.mockRejectedValueOnce(new Error("governor unavailable"));

    const app = express();
    app.use(express.json());
    setupScoutCTACheckRoutes(app);

    const res = await request(app).post("/api/scout/cta-check").send({
      action: "message",
      context: "community_post",
      contextId: "ctx-2",
    });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
    expect(res.body.action).toBe("DEFER");
    expect(res.body.ctaMode).toBe("ask_scout");
  });
});
