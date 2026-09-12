import fs from "node:fs";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../auth", () => ({ isAuthenticated: (req: any, res: any, next: any) => req.user ? next() : res.status(401).json({ message: "Authentication required" }) }));
import { createHomeIdentityRouter } from "../routes/home-identity";
import { HomeIdentityError } from "../services/homeIdentityService";
const load = vi.fn();
const save = vi.fn();
function app(authenticated = true) {
  const instance = express(); instance.use(express.json());
  instance.use((req: any, _res, next) => { if (authenticated) req.user = { id: "session-owner" }; next(); });
  instance.use(createHomeIdentityRouter({ load, save })); return instance;
}

describe("canonical property edit transport", () => {
  beforeEach(() => vi.clearAllMocks());
  it("is mounted by the real Homes route owner", () => {
    const source = fs.readFileSync("server/routes/homes.ts", "utf8");
    expect(source).toContain('import { homeIdentityRouter } from "./home-identity"');
    expect(source).toContain("router.use(homeIdentityRouter)");
    expect(source).toContain("export const homesRouter = router");
  });
  it("requires authentication before either read or save", async () => {
    await request(app(false)).get("/api/homes/property/identity").expect(401);
    await request(app(false)).patch("/api/homes/property/identity").send({}).expect(401);
    expect(load).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it("gets authority from the session, never a body or query owner", async () => {
    save.mockResolvedValue({ identity: { id: "property" }, revision: "a".repeat(64) });
    const payload = { revision: "a".repeat(64), changes: { nickname: "Renamed" }, ownerUserId: "body-attacker" };
    const response = await request(app()).patch("/api/homes/property/identity?userId=query-attacker").send(payload).expect(200);
    expect(save).toHaveBeenCalledWith("session-owner", "property", payload);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
  it.each([[404, "HOME_NOT_FOUND"], [409, "PROPERTY_CHANGED"], [400, "PROPERTY_COUNTY_MISMATCH"]])("preserves actionable %s errors without fake success", async (status, code) => {
    save.mockRejectedValue(new HomeIdentityError(Number(status), String(code), "Safe error", { countyFips: "Choose a county" }));
    const response = await request(app()).patch("/api/homes/property/identity").send({}).expect(Number(status));
    expect(response.body).toEqual({ message: "Safe error", code, fieldErrors: { countyFips: "Choose a county" } });
  });
  it("does not expose SQL errors", async () => {
    load.mockRejectedValue(new Error("SQL credentials and private property contents"));
    const response = await request(app()).get("/api/homes/property/identity").expect(500);
    expect(response.body.message).not.toContain("credentials");
    expect(response.body.code).toBe("PROPERTY_UNAVAILABLE");
  });
});
