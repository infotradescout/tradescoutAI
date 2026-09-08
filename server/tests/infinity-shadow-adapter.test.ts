import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mirrorInfinityConversion, mirrorInfinityTouch } from "../integrations/infinityShadow";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Infinity shadow adapter", () => {
  it("stays disabled and fail-open without complete configuration", async () => {
    vi.stubEnv("INFINITY_API_URL", "");
    vi.stubEnv("INFINITY_API_KEY", "");
    vi.stubEnv("INFINITY_TENANT_ID", "");
    vi.stubEnv("INFINITY_PROGRAM_ID", "");
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);

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
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("retains attribution touch and conversion delivery without exporting private input fields", async () => {
    vi.stubEnv("INFINITY_API_URL", "https://infinity.example.test");
    vi.stubEnv("INFINITY_API_KEY", "synthetic-test-key");
    vi.stubEnv("INFINITY_TENANT_ID", "tenant-tradescout");
    vi.stubEnv("INFINITY_PROGRAM_ID", "program-test");
    const fetchStub = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchStub);
    const privateInput = { email: "private@example.test", ip: "192.0.2.1", paymentValue: 100 };

    await expect(
      mirrorInfinityTouch({
        ...privateInput,
        affiliateTag: "REAL2026ABCD12",
        canonicalPath: "/profile/example",
        source: "universal_ref",
        carrier: "path_segment",
      })
    ).resolves.toBe("sent");
    await expect(
      mirrorInfinityConversion({
        ...privateInput,
        conversionEventId: "event-1",
        conversionType: "signup_completed",
        targetPath: "/profile/example",
        targetId: "private-account-id",
        attributionProofId: "proof-1",
      })
    ).resolves.toBe("sent");

    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(fetchStub.mock.calls.map(([url]) => url)).toEqual([
      "https://infinity.example.test/v1/attribution-touches",
      "https://infinity.example.test/v1/conversion-evidence",
    ]);
    const touch = JSON.parse(fetchStub.mock.calls[0][1].body);
    expect(touch).toEqual({
      programId: "program-test",
      partnerId: "REAL2026ABCD12",
      carrier: "path_segment",
      target: {
        object: {
          tenantId: "tenant-tradescout",
          objectType: "tradescout_route",
          objectId: createHash("sha256").update("/profile/example").digest("hex").slice(0, 32),
        },
        canonicalPath: "/profile/example",
      },
      evidence: { affiliateTag: "REAL2026ABCD12", source: "universal_ref" },
    });
    expect(JSON.parse(fetchStub.mock.calls[1][1].body)).toEqual({
      object: {
        tenantId: "tenant-tradescout",
        objectType: "tradescout_conversion",
        objectId: createHash("sha256").update("private-account-id").digest("hex").slice(0, 32),
      },
      eventType: "signup_completed",
      occurredAt: expect.any(String),
      attributionProofId: "proof-1",
    });
    expect(fetchStub.mock.calls[1][1].headers["idempotency-key"]).toBe("tradescout:event-1");
  });
});
