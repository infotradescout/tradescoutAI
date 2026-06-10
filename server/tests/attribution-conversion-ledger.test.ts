import { describe, expect, it } from "vitest";
import {
  recordAttributionConversionEvent,
  type AttributionConversionLedgerEvent,
} from "../utils/attributionConversionLedger";

describe("attribution conversion ledger", () => {
  it("records supported conversion when valid attribution session exists", async () => {
    const persisted: AttributionConversionLedgerEvent[] = [];

    const result = await recordAttributionConversionEvent({
      input: {
        sessionAttribution: {
          referralCode: "REAL2026ABCD12",
          source: "universal_ref",
          attributedAt: "2026-06-10T00:00:00.000Z",
        },
        conversionType: "signup_completed",
        targetPath: "/signup/complete",
      },
      persist: async (event) => {
        persisted.push(event);
      },
      now: () => new Date("2026-06-10T00:10:00.000Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.affiliateTag).toBe("REAL2026ABCD12");
    expect(result.event.conversionType).toBe("signup_completed");
    expect(result.event.status).toBe("recorded");
    expect(result.event.payoutEligible).toBe(false);
    expect(result.event.payoutCalculated).toBe(false);
    expect(result.event.paymentTriggered).toBe(false);
    expect(persisted).toHaveLength(1);
  });

  it("refuses conversion when attribution proof is missing", async () => {
    const result = await recordAttributionConversionEvent({
      input: {
        conversionType: "request_created",
      },
      persist: async () => {
        throw new Error("persist should not be called");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NO_ATTRIBUTION_PROOF");
  });

  it("refuses conversion for default-looking userNNNN affiliate tag", async () => {
    const result = await recordAttributionConversionEvent({
      input: {
        cookieAttributionTag: "user1234",
        conversionType: "claim_started",
      },
      persist: async () => {
        throw new Error("persist should not be called");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("DISALLOWED_DEFAULT_TAG");
  });

  it("refuses unsupported conversion type", async () => {
    const result = await recordAttributionConversionEvent({
      input: {
        cookieAttributionTag: "REAL2026ABCD12",
        conversionType: "untrusted_event",
      },
      persist: async () => {
        throw new Error("persist should not be called");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNSUPPORTED_CONVERSION_TYPE");
  });

  it("fails closed when payout/payment flags are requested as true", async () => {
    const result = await recordAttributionConversionEvent({
      input: {
        cookieAttributionTag: "REAL2026ABCD12",
        conversionType: "booking_request_started",
        payoutEligible: true,
      },
      persist: async () => {
        throw new Error("persist should not be called");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN_PAYOUT_FIELDS");
  });
});
