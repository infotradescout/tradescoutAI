import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { derivePresencePlan } from "../services/presencePlan";
import { PresencePlanError } from "../services/presencePlanService";
import { projectReviewablePresenceFacts } from "../services/presenceFactReview";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("../services/presenceFactReview", async (original) => {
  const real = await original<typeof import("../services/presenceFactReview")>();
  return {
    ...real,
    getOwnedPresenceFactReview: mocks.read,
    submitOwnedPresenceFactDecision: mocks.decide,
  };
});
import { onboardingRouter } from "../routes/onboarding";

const businessId = "business-facts-1";
const profileId = "profile-facts-1";
const ownerUserId = "owner-facts-1";
const source = "https://works.example/services?private=token";

function outcome(sourceUrl = source) {
  return {
    kind: "business_profile",
    businessId,
    profileId,
    provenance: {
      evidence: {
        name: "Owner business",
        notes: "Private owner note",
        services: ["Owner service"],
        links: [sourceUrl],
        photoUrls: [],
      },
      enrichment: {
        source: "selective_intelligence_profile_enrichment",
        analyzer: "test_analyzer",
        output: {
          description: { text: "Services include Cabinetry.", sourceUrls: [sourceUrl] },
          about: { text: "Made-to-fit woodwork.", sourceUrls: [sourceUrl] },
          services: [{ name: "Cabinetry", sourceUrls: [sourceUrl] }],
          license: "Never review or publish",
        },
      },
    },
  };
}

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

describe("private Presence fact projection", () => {
  it("allowlists only cited enrichment and strips query data from owner navigation refs", () => {
    const facts = projectReviewablePresenceFacts(outcome());
    expect(facts.map((fact) => fact.factKey)).toEqual(["description", "about", "service:0"]);
    expect(facts.map((fact) => fact.value)).toEqual([
      "Services include Cabinetry.",
      "Made-to-fit woodwork.",
      "Cabinetry",
    ]);
    expect(facts.every((fact) => fact.sourceRefs[0] === "https://works.example/services")).toBe(
      true
    );
    expect(facts.every((fact) => fact.sourceVerificationLimited)).toBe(true);
    expect(JSON.stringify(facts)).not.toContain("private=token");
    expect(JSON.stringify(facts)).not.toContain("Private owner note");
    expect(JSON.stringify(facts)).not.toContain("Never review or publish");
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: outcome(),
      externalWebsiteUrl: null,
    });
    expect(JSON.stringify(plan)).not.toContain("Services include Cabinetry.");
    expect(JSON.stringify(plan)).not.toContain("Made-to-fit woodwork.");
  });

  it("rejects a claim when any citation is missing, invented, or unsafe", () => {
    const candidate = outcome();
    candidate.provenance.enrichment.output.description.sourceUrls.push("https://invented.example/");
    candidate.provenance.enrichment.output.about.sourceUrls = [];
    candidate.provenance.enrichment.output.services[0].sourceUrls = ["http://localhost/private"];
    expect(projectReviewablePresenceFacts(candidate)).toEqual([]);
    const wrongSource = outcome("https://different.example/work");
    wrongSource.provenance.enrichment.output.services[0].sourceUrls = [source];
    expect(projectReviewablePresenceFacts(wrongSource).map((fact) => fact.factKey)).toEqual([
      "description",
      "about",
    ]);
  });

  it("binds digest to the exact value and full citation, not the public display URL", () => {
    const first = projectReviewablePresenceFacts(outcome());
    const same = projectReviewablePresenceFacts(outcome());
    expect(first.map((fact) => fact.valueDigest)).toEqual(same.map((fact) => fact.valueDigest));
    const changedSource = projectReviewablePresenceFacts(
      outcome("https://works.example/services?private=changed")
    );
    expect(changedSource[0].sourceRefs).toEqual(first[0].sourceRefs);
    expect(changedSource[0].sourceVerificationLimited).toBe(true);
    expect(changedSource[0].valueDigest).not.toBe(first[0].valueDigest);
    const changedValue = outcome();
    changedValue.provenance.enrichment.output.services[0].name = "Shelving";
    expect(projectReviewablePresenceFacts(changedValue)[2].valueDigest).not.toBe(
      first[2].valueDigest
    );
    expect(
      projectReviewablePresenceFacts(outcome("https://works.example/services"))[0]
        .sourceVerificationLimited
    ).toBe(false);
  });

  it("accepts cited owner-uploaded object photos without leaking an object URL as a new contact link", () => {
    const previous = process.env.PUBLIC_WEB_URL;
    process.env.PUBLIC_WEB_URL = "https://preview.tradescout.example/app";
    try {
      const value = outcome();
      value.provenance.evidence.links = [];
      value.provenance.evidence.photoUrls = ["/objects/work-photo.jpg"];
      const ref = "https://preview.tradescout.example/objects/work-photo.jpg";
      value.provenance.enrichment.output.description.sourceUrls = [ref];
      value.provenance.enrichment.output.about.sourceUrls = [ref];
      value.provenance.enrichment.output.services[0].sourceUrls = [ref];
      expect(projectReviewablePresenceFacts(value)).toHaveLength(3);
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_WEB_URL;
      else process.env.PUBLIC_WEB_URL = previous;
    }
  });
});

describe("Presence fact HTTP authority", () => {
  it("serves private values only to a signed-in, non-impersonating principal", async () => {
    mocks.read
      .mockReset()
      .mockResolvedValue({
        planId: "plan-1",
        businessId,
        profileId,
        revision: 1,
        evidenceDigest: "a".repeat(64),
        planHash: "b".repeat(64),
        facts: [],
      });
    expect((await request(app()).get("/api/presence/facts")).status).toBe(401);
    expect(
      (
        await request(app())
          .get("/api/presence/facts")
          .set("x-test-principal", ownerUserId)
          .set("x-test-impersonating", "true")
      ).status
    ).toBe(409);
    expect(mocks.read).not.toHaveBeenCalled();
    const owner = await request(app())
      .get("/api/presence/facts")
      .set("x-test-principal", ownerUserId);
    expect(owner.status).toBe(200);
    expect(owner.headers["cache-control"]).toBe("private, no-store");
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), ownerUserId);
  });

  it("takes the actor from authentication, validates strict input, and preserves stale/foreign denials", async () => {
    mocks.decide
      .mockReset()
      .mockResolvedValue({
        factKey: "service:0",
        valueDigest: "c".repeat(64),
        decision: "approve",
        decidedAt: new Date(),
      });
    const path = "/api/presence/facts/service:0/decision";
    const body = {
      expectedPlanId: "plan-1",
      expectedProfileId: profileId,
      expectedRevision: 1,
      expectedDigest: "a".repeat(64),
      expectedPlanHash: "b".repeat(64),
      valueDigest: "c".repeat(64),
      decision: "approve",
      idempotencyKey: randomUUID(),
    };
    expect((await request(app()).post(path).send(body)).status).toBe(401);
    expect(
      (
        await request(app())
          .post(path)
          .set("x-test-principal", ownerUserId)
          .set("x-test-impersonating", "true")
          .send(body)
      ).status
    ).toBe(409);
    expect(
      (
        await request(app())
          .post(path)
          .set("x-test-principal", ownerUserId)
          .send({ ...body, ownerUserId: "forged" })
      ).status
    ).toBe(400);
    expect(mocks.decide).not.toHaveBeenCalled();
    const good = await request(app()).post(path).set("x-test-principal", ownerUserId).send(body);
    expect(good.status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerUserId, factKey: "service:0", ...body })
    );
    mocks.decide.mockRejectedValueOnce(
      new PresencePlanError("PRESENCE_PLAN_STALE", "Refresh.", 409)
    );
    expect(
      (await request(app()).post(path).set("x-test-principal", ownerUserId).send(body)).status
    ).toBe(409);
    mocks.decide.mockRejectedValueOnce(
      new PresencePlanError("PRESENCE_OWNERSHIP_MISMATCH", "No.", 403)
    );
    expect(
      (await request(app()).post(path).set("x-test-principal", "foreign").send(body)).status
    ).toBe(403);
  });
});
