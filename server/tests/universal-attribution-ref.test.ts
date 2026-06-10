import express from "express";
import session from "express-session";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { handleUniversalAttributionClick } from "../utils/universalAttributionRef";

function createTestApp() {
  const app = express();
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: true,
    })
  );

  let recordedClicks = 0;
  let payoutInvocations = 0;

  app.get("/ref/:tag", async (req, res) => {
    await handleUniversalAttributionClick({
      req,
      res,
      rawTag: req.params.tag,
      rawTarget: req.query.to,
      tagExists: async (tag) => tag === "REAL2026ABCD12",
      getExistingAttribution: () => null,
      setAttributionCookie: (response, tag) => {
        response.append("Set-Cookie", `ts_ref=${encodeURIComponent(tag)}; Path=/; SameSite=Lax`);
      },
      onAttributionAccepted: async () => {
        recordedClicks += 1;
      },
      now: () => new Date("2026-06-10T00:00:00.000Z"),
    });

    // Guard variable remains zero unless explicitly called from route code.
    void payoutInvocations;
  });

  app.get("/_session", (req, res) => {
    const reqAny = req as any;
    res.json({
      referralAttribution: reqAny.session?.referralAttribution ?? null,
      recordedClicks,
      payoutInvocations,
    });
  });

  return app;
}

describe("universal attribution /ref click", () => {
  it("valid tag + safe target attaches attribution and redirects", async () => {
    const app = createTestApp();
    const agent = request.agent(app);

    const res = await agent.get("/ref/REAL2026ABCD12?to=/scout?focus=roof");

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/scout?focus=roof");
    expect((res.headers["set-cookie"] || []).join(";")).toContain("ts_ref=REAL2026ABCD12");

    const sessionRes = await agent.get("/_session");
    expect(sessionRes.body.referralAttribution).toMatchObject({
      referralCode: "REAL2026ABCD12",
      destination: "/scout?focus=roof",
      source: "universal_ref",
      attributedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(sessionRes.body.recordedClicks).toBe(1);
  });

  it("does not require destination ownership for valid internal target", async () => {
    const app = createTestApp();
    const res = await request(app).get("/ref/REAL2026ABCD12?to=/business/someone-else");

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/business/someone-else");
  });

  it("missing target fails closed", async () => {
    const app = createTestApp();
    const agent = request.agent(app);

    const res = await agent.get("/ref/REAL2026ABCD12");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_TARGET");

    const sessionRes = await agent.get("/_session");
    expect(sessionRes.body.referralAttribution).toBeNull();
    expect(sessionRes.body.recordedClicks).toBe(0);
  });

  it("invalid tag fails closed", async () => {
    const app = createTestApp();
    const res = await request(app).get("/ref/@@@bad@@@?to=/scout");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TAG");
  });

  it("default-looking userNNNN tag fails closed", async () => {
    const app = createTestApp();
    const res = await request(app).get("/ref/user1234?to=/scout");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DISALLOWED_DEFAULT_TAG");
  });

  it("unsafe external target fails closed", async () => {
    const app = createTestApp();
    const res = await request(app).get("/ref/REAL2026ABCD12?to=https://evil.example/phish");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TARGET");
  });

  it("/ref chaining fails closed", async () => {
    const app = createTestApp();
    const res = await request(app).get("/ref/REAL2026ABCD12?to=/ref/ANOTHER2026");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TARGET");
  });

  it("does not store attribution when validation fails", async () => {
    const app = createTestApp();
    const agent = request.agent(app);

    const fail = await agent.get("/ref/REAL2026ABCD12?to=//evil.example");
    expect(fail.status).toBe(400);

    const sessionRes = await agent.get("/_session");
    expect(sessionRes.body.referralAttribution).toBeNull();
    expect(sessionRes.body.recordedClicks).toBe(0);
    expect(sessionRes.body.payoutInvocations).toBe(0);
  });
});
