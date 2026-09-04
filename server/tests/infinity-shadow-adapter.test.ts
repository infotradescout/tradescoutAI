import { afterEach, describe, expect, it } from "vitest";

import { mirrorInfinityConversion, mirrorInfinityTouch } from "../integrations/infinityShadow";

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
  });
});
