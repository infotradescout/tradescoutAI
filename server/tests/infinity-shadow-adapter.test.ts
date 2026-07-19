import { afterEach, describe, expect, it } from "vitest";

import {
  mirrorInfinityConversion,
  mirrorInfinitySelectiveInheritance,
  mirrorInfinityTouch,
} from "../integrations/infinityShadow";
import {
  filterTradeScoutInheritanceCandidates,
  tradeScoutSelectiveInheritancePolicy,
} from "../integrations/infinitySelectiveInheritance";

const saved = {
  apiUrl: process.env.INFINITY_API_URL,
  apiKey: process.env.INFINITY_API_KEY,
  tenantId: process.env.INFINITY_TENANT_ID,
  programId: process.env.INFINITY_PROGRAM_ID,
};

afterEach(() => {
  process.env.INFINITY_API_URL = saved.apiUrl;
  process.env.INFINITY_API_KEY = saved.apiKey;
  process.env.INFINITY_TENANT_ID = saved.tenantId;
  process.env.INFINITY_PROGRAM_ID = saved.programId;
});

describe("Infinity shadow adapter", () => {
  it("stays disabled and fail-open without complete configuration", async () => {
    delete process.env.INFINITY_API_URL;
    delete process.env.INFINITY_API_KEY;
    delete process.env.INFINITY_TENANT_ID;
    delete process.env.INFINITY_PROGRAM_ID;

    await expect(
      mirrorInfinityTouch({
        affiliateTag: "REAL2026ABCD12",
        canonicalPath: "/profile/example",
        source: "universal_ref",
        carrier: "path_segment",
      })
    ).resolves.toBe("disabled");
    await expect(
      mirrorInfinityConversion({
        conversionEventId: "event-1",
        conversionType: "signup_completed",
        targetPath: "/profile/example",
        targetId: "example",
        attributionProofId: "proof-1",
      })
    ).resolves.toBe("disabled");
    await expect(
      mirrorInfinitySelectiveInheritance({
        evaluationId: "inheritance-1",
        profileId: "example",
        targetVersion: "profile-v1",
        candidates: [],
      })
    ).resolves.toBe("disabled");
  });

  it("declares a fail-closed profile policy without bypassing contact or trust law", () => {
    const policy = tradeScoutSelectiveInheritancePolicy("tenant-tradescout");
    expect(policy.defaultAction).toBe("exclude");
    expect(policy.fields.find((field) => field.field === "credentials")?.action).toBe("inherit");
    for (const protectedField of ["directConnect", "contactAccess", "ranking", "trustScore"]) {
      expect(policy.fields.find((field) => field.field === protectedField)?.action).toBe("exclude");
    }

    const candidates = filterTradeScoutInheritanceCandidates("tenant-tradescout", [
      {
        field: "credentials",
        value: ["License A"],
        sourceKind: "owner_verified",
        sourceReference: "owner:credential",
        evidenceDigest: "sha256:credential",
        observedAt: "2026-07-19T15:00:00.000Z",
        confidence: 1,
        verified: true,
      },
      {
        field: "directConnect",
        value: { bypass: true },
        sourceKind: "product_record",
        sourceReference: "private:contact",
        evidenceDigest: "sha256:contact",
        observedAt: "2026-07-19T15:00:00.000Z",
        confidence: 1,
        verified: true,
      },
    ]);
    expect(candidates.map((candidate) => candidate.field)).toEqual(["credentials"]);
  });
});
