import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { PresencePlanError } from "../services/presencePlanService";
import { projectSupportedAboutTarget } from "../services/presenceAboutIntent";

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  authorize: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("../auth", async (original) => {
  const real = await original<typeof import("../auth")>();
  return {
    ...real,
    isAuthenticated: (req: any, res: any, next: any) =>
      req.header("x-test-principal")
        ? next()
        : res.status(401).json({ message: "Authentication required" }),
  };
});
vi.mock("../services/presenceAboutIntent", async (original) => {
  const real = await original<typeof import("../services/presenceAboutIntent")>();
  return {
    ...real,
    getOwnedPresenceAboutPreview: mocks.preview,
    authorizeOwnedPresenceAboutIntent: mocks.authorize,
    withdrawOwnedPresenceAboutIntent: mocks.withdraw,
  };
});
import { onboardingRouter } from "../routes/onboarding";

const owner = "synthetic-owner";
const origin = "http://presence.example";
const digest = "a".repeat(64);
const body = {
  expectedPlanId: "plan-1",
  expectedProfileId: "profile-1",
  expectedRevision: 1,
  expectedDigest: digest,
  expectedPlanHash: "b".repeat(64),
  decisionId: "decision-1",
  valueDigest: "c".repeat(64),
  contentBlocksDigest: "d".repeat(64),
  aboutBlockDigest: "e".repeat(64),
  aboutBlockId: "f".repeat(64),
  previewDigest: "0".repeat(64),
  replacementAcknowledged: true,
  idempotencyKey: randomUUID(),
};

function app() {
  const value = express();
  value.use(express.json());
  value.use((req, _res, next) => {
    const principal = req.header("x-test-principal");
    if (principal) (req as any).user = { id: principal };
    if (req.header("x-test-impersonating") === "true") {
      (req as any).requestAuthorityContext = { isImpersonating: true };
    }
    next();
  });
  value.use(onboardingRouter);
  return value;
}

function ownerPost(path: string, payload: unknown) {
  return request(app())
    .post(path)
    .set("Host", "presence.example")
    .set("Origin", origin)
    .set("x-test-principal", owner)
    .send(payload);
}

describe("supported hosted About target projection", () => {
  const base = {
    id: "profile-1",
    slug: "synthetic-woodworks",
    status: "published",
    contentBlocks: [
      { type: "siteTemplate", data: { id: "default" } },
      { type: "about", data: { body: "Current owner About" } },
    ],
  } as any;
  it("binds one explicit default About block and refuses ambiguous, missing, hidden or adapted content", () => {
    const ok = projectSupportedAboutTarget(base, {}, {});
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.target.currentText).toBe("Current owner About");
    expect(ok.target.field).toBe("body");
    expect(ok.target.aboutBlockId).toMatch(/^[a-f0-9]{64}$/);
    expect(
      projectSupportedAboutTarget(
        { ...base, contentBlocks: base.contentBlocks.slice(0, 1) },
        {},
        {}
      )
    ).toMatchObject({ ok: false, reason: "ABOUT_BLOCK_MISSING" });
    expect(
      projectSupportedAboutTarget(
        { ...base, contentBlocks: [...base.contentBlocks, base.contentBlocks[1]] },
        {},
        {}
      )
    ).toMatchObject({ ok: false, reason: "ABOUT_BLOCK_MULTIPLE" });
    expect(
      projectSupportedAboutTarget(
        {
          ...base,
          contentBlocks: [base.contentBlocks[0], { type: "about", data: { body: "A", text: "B" } }],
        },
        {},
        {}
      )
    ).toMatchObject({ ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" });
    expect(
      projectSupportedAboutTarget(base, { profileSections: { about: false } }, {})
    ).toMatchObject({ ok: false, reason: "ABOUT_HIDDEN" });
    expect(projectSupportedAboutTarget({ ...base, status: "draft" }, {}, {})).toMatchObject({
      ok: false,
      reason: "ABOUT_HIDDEN",
    });
    expect(projectSupportedAboutTarget({ ...base, slug: "jw-stone" }, {}, {})).toMatchObject({
      ok: false,
      reason: "UNSUPPORTED_TEMPLATE",
    });
    expect(projectSupportedAboutTarget(base, {}, { tradePartner: true })).toMatchObject({
      ok: false,
      reason: "UNSUPPORTED_TEMPLATE",
    });
  });
});

describe("private owner About authorization HTTP", () => {
  it("serves a private preview only to a principal outside impersonation", async () => {
    mocks.preview
      .mockReset()
      .mockResolvedValue({
        eligible: false,
        reason: "NO_APPROVED_ABOUT",
        publicationApplied: false,
      });
    expect((await request(app()).get("/api/presence/about/preview")).status).toBe(401);
    expect(
      (
        await request(app())
          .get("/api/presence/about/preview")
          .set("x-test-principal", owner)
          .set("x-test-impersonating", "true")
      ).status
    ).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
    const response = await request(app())
      .get("/api/presence/about/preview")
      .set("x-test-principal", owner);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.preview.publicationApplied).toBe(false);
    expect(mocks.preview).toHaveBeenCalledWith(expect.anything(), owner);
  });

  it("requires same-origin owner consent and strict server-bound input", async () => {
    mocks.authorize
      .mockReset()
      .mockResolvedValue({ id: "intent-1", status: "active", publicationApplied: false });
    const path = "/api/presence/about/intent";
    expect(
      (
        await request(app())
          .post(path)
          .set("Host", "presence.example")
          .set("Origin", origin)
          .send(body)
      ).status
    ).toBe(401);
    expect((await ownerPost(path, body).set("x-test-impersonating", "true")).status).toBe(409);
    expect(
      (
        await request(app())
          .post(path)
          .set("Host", "presence.example")
          .set("x-test-principal", owner)
          .send(body)
      ).status
    ).toBe(403);
    expect((await ownerPost(path, body).set("Origin", "https://unrelated.example")).status).toBe(
      403
    );
    expect((await ownerPost(path, { ...body, ownerUserId: "forged" })).status).toBe(400);
    expect((await ownerPost(path, { ...body, replacementAcknowledged: undefined })).status).toBe(
      400
    );
    expect(mocks.authorize).not.toHaveBeenCalled();
    const good = await ownerPost(path, body);
    expect(good.status).toBe(200);
    expect(good.body.intent).toMatchObject({ status: "active", publicationApplied: false });
    expect(mocks.authorize).toHaveBeenCalledWith(expect.anything(), {
      ownerUserId: owner,
      ...body,
    });
    mocks.authorize.mockRejectedValueOnce(
      new PresencePlanError("PRESENCE_ABOUT_PREVIEW_STALE", "Reload.", 409)
    );
    const stale = await ownerPost(path, body);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("PRESENCE_ABOUT_PREVIEW_STALE");
  });

  it("withdraws only the owner-supplied authorization identity and keeps the stable intent ID", async () => {
    mocks.withdraw
      .mockReset()
      .mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        status: "withdrawn",
        publicationApplied: false,
      });
    const path = "/api/presence/about/intent/withdraw";
    const payload = {
      intentId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: randomUUID(),
    };
    expect((await ownerPost(path, { ...payload, ownerUserId: "forged" })).status).toBe(400);
    expect((await ownerPost(path, payload)).body.intent).toMatchObject({
      id: payload.intentId,
      status: "withdrawn",
    });
    expect(mocks.withdraw).toHaveBeenCalledWith(owner, payload.intentId, payload.idempotencyKey);
  });
});
