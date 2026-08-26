import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBuilderProfile: vi.fn(),
  getCountyById: vi.fn(),
  getCountyByFips: vi.fn(),
  createBuilderProfile: vi.fn(),
  sendBuilderNotification: vi.fn(),
}));

vi.mock("../auth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = { id: "builder-user" };
    next();
  },
}));

vi.mock("../db", () => ({
  db: {},
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: mocks.getUser,
    getBuilderProfile: mocks.getBuilderProfile,
    getCountyById: mocks.getCountyById,
    getCountyByFips: mocks.getCountyByFips,
    createBuilderProfile: mocks.createBuilderProfile,
    sendBuilderNotification: mocks.sendBuilderNotification,
  },
}));

import communityBuilderRouter from "../routes/community-builder-routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/community-builder", communityBuilderRouter);
  return app;
}

describe("Community Builder profile activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBuilderProfile.mockResolvedValue(null);
    mocks.sendBuilderNotification.mockResolvedValue(undefined);
  });

  it("persists a verified canonical county id", async () => {
    mocks.getUser.mockResolvedValue({
      id: "builder-user",
      countyId: " county-1 ",
      countyFips: "01001",
      county: "Autauga County",
    });
    mocks.getCountyById.mockResolvedValue({ id: "county-1", fips: "01001" });
    mocks.createBuilderProfile.mockResolvedValue({ id: "builder-1", countyId: "county-1" });

    const response = await request(buildApp())
      .post("/api/community-builder/profile")
      .send({ businessName: "Local Builder" });

    expect(response.status).toBe(200);
    expect(mocks.getCountyById).toHaveBeenCalledWith("county-1");
    expect(mocks.getCountyByFips).not.toHaveBeenCalled();
    expect(mocks.createBuilderProfile).toHaveBeenCalledWith(
      "builder-user",
      "county-1",
      expect.objectContaining({ businessName: "Local Builder" })
    );
  });

  it("falls back from a stale county id to a verified FIPS match", async () => {
    mocks.getUser.mockResolvedValue({
      id: "builder-user",
      countyId: "stale-county",
      countyFips: "12033",
      county: "Escambia County",
    });
    mocks.getCountyById.mockResolvedValue(undefined);
    mocks.getCountyByFips.mockResolvedValue({ id: "canonical-county", fips: "12033" });
    mocks.createBuilderProfile.mockResolvedValue({
      id: "builder-1",
      countyId: "canonical-county",
    });

    const response = await request(buildApp()).post("/api/community-builder/profile").send({});

    expect(response.status).toBe(200);
    expect(mocks.getCountyById).toHaveBeenCalledWith("stale-county");
    expect(mocks.getCountyByFips).toHaveBeenCalledWith("12033");
    expect(mocks.createBuilderProfile).toHaveBeenCalledWith(
      "builder-user",
      "canonical-county",
      expect.any(Object)
    );
  });

  it("fails closed instead of writing a human-readable county into the FK", async () => {
    mocks.getUser.mockResolvedValue({
      id: "builder-user",
      countyId: "missing-county",
      countyFips: "99999",
      county: "Not A Canonical Id",
    });
    mocks.getCountyById.mockResolvedValue(undefined);
    mocks.getCountyByFips.mockResolvedValue(undefined);

    const response = await request(buildApp()).post("/api/community-builder/profile").send({});

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: "A verified county is required to activate Community Builder.",
      code: "COMMUNITY_BUILDER_COUNTY_REQUIRED",
      action: "Open Profile Settings and choose your county, then try again.",
    });
    expect(mocks.createBuilderProfile).not.toHaveBeenCalled();
  });
});
