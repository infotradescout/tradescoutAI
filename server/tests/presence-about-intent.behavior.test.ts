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
  apply: vi.fn(),
  complete: vi.fn(),
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
    applyOwnedPresenceAboutIntent: mocks.apply,
  };
});
vi.mock("../services/onboardingService", async (original) => {
  const real = await original<typeof import("../services/onboardingService")>();
  return { ...real, completeOutcomeOnboarding: mocks.complete };
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
  factKey: "about",
  decisionId: "decision-1",
  valueDigest: "c".repeat(64),
  contentBlocksDigest: "d".repeat(64),
  aboutBlockDigest: "e".repeat(64),
  aboutBlockId: "f".repeat(64),
  previewDigest: "0".repeat(64),
  targetMode: "replace",
  contentBlocksRevision: 1,
  publicationAcknowledged: true,
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
    contentBlocksRevision: 1,
    ownerUserId: "owner",
    businessId: "business",
    roleContext: "business_owner",
    publiclyReleased: true,
    seoMeta: {},
    contentBlocks: [
      { type: "siteTemplate", data: { id: "default" } },
      { type: "about", data: { body: "Current owner About" } },
    ],
  } as any;
  it("binds one default About or its first insertion and refuses ambiguous, hidden or adapted content", () => {
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
    ).toMatchObject({ ok: true, target: { targetMode: "create", currentText: "", field: "body" } });
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
    mocks.preview.mockReset().mockResolvedValue({
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
    const {
      targetMode: _mode,
      contentBlocksRevision: _revision,
      publicationAcknowledged: _acknowledged,
      ...legacyConsent
    } = body;
    expect((await ownerPost(path, legacyConsent)).status).toBe(400);
    expect((await ownerPost(path, { ...body, publicationAcknowledged: false })).status).toBe(400);
    expect((await ownerPost(path, { ...body, contentBlocksRevision: 0 })).status).toBe(400);
    expect((await ownerPost(path, { ...body, factKey: undefined })).status).toBe(400);
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
    mocks.withdraw.mockReset().mockResolvedValue({
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

  it("keeps first About consent bound to the actual approved description fact", async () => {
    mocks.authorize
      .mockReset()
      .mockResolvedValue({ id: "intent-description", status: "active", publicationApplied: false });
    const payload = {
      ...body,
      factKey: "description",
      targetMode: "create",
      replacementAcknowledged: false,
    };
    const consent = await ownerPost("/api/presence/about/intent", payload);
    expect(consent.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      ownerUserId: owner,
      ...payload,
    });
  });

  it("applies only same-origin owner intent identifiers and returns the durable receipt", async () => {
    const path = "/api/presence/about/intent/apply";
    const payload = { intentId: randomUUID(), idempotencyKey: randomUUID() };
    const receipt = {
      id: randomUUID(),
      profileId: "profile-1",
      targetMode: "create",
      contentBlocksRevision: 2,
      contentBlocksDigest: digest,
      appliedAt: "2026-09-30T14:00:00.000Z",
    };
    mocks.apply.mockReset().mockResolvedValue({
      id: payload.intentId,
      status: "applied",
      publicationApplied: true,
      receipt,
    });
    expect((await request(app()).post(path).send(payload)).status).toBe(401);
    expect((await ownerPost(path, payload).set("x-test-impersonating", "true")).status).toBe(409);
    expect(
      (
        await request(app())
          .post(path)
          .set("Host", "presence.example")
          .set("x-test-principal", owner)
          .send(payload)
      ).status
    ).toBe(403);
    expect((await ownerPost(path, payload).set("Origin", "https://unrelated.example")).status).toBe(
      403
    );
    expect((await ownerPost(path, { ...payload, ownerUserId: "forged" })).status).toBe(400);
    expect((await ownerPost(path, { ...payload, text: "Unapproved copy" })).status).toBe(400);
    expect((await ownerPost(path, { ...payload, intentId: "invalid-id" })).status).toBe(400);
    expect(mocks.apply).not.toHaveBeenCalled();
    const applied = await ownerPost(path, payload);
    expect(applied.status).toBe(200);
    expect(applied.headers["cache-control"]).toBe("private, no-store");
    expect(applied.body.intent).toEqual({
      id: payload.intentId,
      status: "applied",
      publicationApplied: true,
      receipt,
    });
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      ownerUserId: owner,
      ...payload,
    });
  });

  it.each([
    "PRESENCE_ABOUT_INTENT_STALE",
    "PRESENCE_ABOUT_INTENT_WITHDRAWN",
    "PRESENCE_ABOUT_INTENT_EXPIRED",
    "PRESENCE_ABOUT_FRESH_CONSENT_REQUIRED",
  ])("returns the backend %s conflict without a successful publication response", async (code) => {
    mocks.apply
      .mockReset()
      .mockRejectedValue(new PresencePlanError(code, "Reload current details.", 409));
    const result = await ownerPost("/api/presence/about/intent/apply", {
      intentId: randomUUID(),
      idempotencyKey: randomUUID(),
    });
    expect(result.status).toBe(409);
    expect(result.body.code).toBe(code);
    expect(result.body.intent).toBeUndefined();
  });

  it("returns onboarding profile snapshot conflicts as a reloadable 409", async () => {
    mocks.complete.mockReset().mockRejectedValue(
      Object.assign(new Error("Concurrent edit"), {
        code: "PROFILE_CONTENT_BLOCKS_STALE",
        status: 409,
      })
    );
    const result = await ownerPost("/api/onboarding/complete", {
      kind: "business_profile",
      goal: "Set up my business",
      business: {
        name: "Synthetic business",
        links: ["https://example.test"],
      },
    });
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("PROFILE_CONTENT_BLOCKS_STALE");
    expect(result.body.message).toContain("Reload");
    expect(result.body.message).toContain("draft is preserved");
  });
});
