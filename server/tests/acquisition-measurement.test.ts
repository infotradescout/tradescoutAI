import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  issueDiscoveryAttributionToken,
  verifyDiscoveryAttributionToken,
} from "../utils/discoveryAttribution";
import {
  ACQUISITION_ACTIVATION_COMPLETED_EVENT,
  ACQUISITION_REGISTRATION_COMPLETED_EVENT,
  isNewSocialRegistrationUser,
  recordServerConfirmedActivation,
  recordServerConfirmedRegistration,
  stageAcquisitionDiscoverySession,
} from "../services/acquisitionMeasurement";

process.env.DISCOVERY_ATTRIBUTION_SECRET = "acquisition-measurement-test-secret";

function makeAttributedRequest() {
  const token = issueDiscoveryAttributionToken({
    businessSlug: "business-a",
    entityType: "business_profile",
    canonicalRoute: "/u/business-a",
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
  });
  if (!token) throw new Error("Expected signed discovery token");
  const verified = verifyDiscoveryAttributionToken(token);
  if (!verified) throw new Error("Expected verified discovery token");

  const req = {
    headers: {},
    session: {
      referralAttribution: {
        referralCode: "REAL2026ABCD12",
        source: "universal_ref",
        attributedAt: "2026-08-23T11:00:00.000Z",
      },
    },
    body: {
      email: "private@example.com",
      phone: "555-0100",
      firstName: "Private",
      lastName: "Person",
    },
  } as any;
  stageAcquisitionDiscoverySession({
    req,
    discoveryAttributionToken: token,
    verifiedAttribution: verified,
    safeEvent: {
      type: "discovery_landing",
      sourceHint: "chatgpt",
      referrerClass: "chatgpt",
    },
    milestone: "landing",
  });
  return req;
}

describe("server-confirmed acquisition lifecycle projections", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("records standard and multi-profile completions once per user", async () => {
    const events: Record<string, unknown>[] = [];
    const uniqueKeys = new Set<string>();
    const affiliateEvents: unknown[] = [];
    const persistEventOnce = async (event: Record<string, unknown>) => {
      const key = String(event.registrationKey);
      if (uniqueKeys.has(key)) return false;
      uniqueKeys.add(key);
      events.push(event);
      return true;
    };

    const first = await recordServerConfirmedRegistration({
      req: makeAttributedRequest(),
      userId: "user-standard",
      flow: "standard",
      profileCount: 1,
      emailVerificationRequired: true,
      persistEventOnce,
      sessionAttribution: {
        referralCode: "REAL2026ABCD12",
        source: "universal_ref",
      },
      persistAffiliateConversion: async (event) => {
        affiliateEvents.push(event);
      },
      now: () => new Date("2026-08-23T12:00:00.000Z"),
    });
    const retry = await recordServerConfirmedRegistration({
      req: makeAttributedRequest(),
      userId: "user-standard",
      flow: "standard",
      profileCount: 1,
      emailVerificationRequired: true,
      persistEventOnce,
      sessionAttribution: {
        referralCode: "REAL2026ABCD12",
        source: "universal_ref",
      },
      persistAffiliateConversion: async (event) => {
        affiliateEvents.push(event);
      },
    });
    const multi = await recordServerConfirmedRegistration({
      req: { headers: {}, session: {}, body: { email: "never-store@example.com" } } as any,
      userId: "user-multi",
      flow: "multi_profile",
      profileCount: 3,
      emailVerificationRequired: false,
      persistEventOnce,
    });

    expect(first.eventRecorded).toBe(true);
    expect(retry.eventRecorded).toBe(false);
    expect(multi.eventRecorded).toBe(true);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.flow)).toEqual(["standard", "multi_profile"]);
    expect(events[0]).toMatchObject({
      type: ACQUISITION_REGISTRATION_COMPLETED_EVENT,
      serverConfirmed: true,
      attributionStatus: "verified_public_discovery",
      entitySlug: "business-a",
      businessSlug: "business-a",
      canonicalRoute: "/u/business-a",
      sourceHint: "chatgpt",
      referrerClass: "chatgpt",
    });
    expect(JSON.stringify(events)).not.toContain("private@example.com");
    expect(JSON.stringify(events)).not.toContain("never-store@example.com");
    expect(JSON.stringify(events)).not.toContain("555-0100");
    expect(affiliateEvents).toHaveLength(1);
  });

  it("stays fail-soft and emits no supplemental attribution when projection persistence fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const affiliatePersist = vi.fn();

    const result = await recordServerConfirmedRegistration({
      req: makeAttributedRequest(),
      userId: "user-db-failure",
      flow: "standard",
      profileCount: 1,
      emailVerificationRequired: false,
      persistEventOnce: async () => {
        throw new Error("events table unavailable");
      },
      sessionAttribution: { referralCode: "REAL2026ABCD12" },
      persistAffiliateConversion: affiliatePersist,
    });

    expect(result).toEqual({ eventRecorded: false, affiliateConversionRecorded: false });
    expect(affiliatePersist).not.toHaveBeenCalled();
  });

  it("records outcome-first activation once per user and links it to registration", async () => {
    const events: Record<string, unknown>[] = [];
    const uniqueKeys = new Set<string>();
    const persistEventOnce = async (event: Record<string, unknown>) => {
      const key = `${event.type}:${event.userId}`;
      if (uniqueKeys.has(key)) return false;
      uniqueKeys.add(key);
      events.push(event);
      return true;
    };

    const first = await recordServerConfirmedActivation({
      req: makeAttributedRequest(),
      userId: "user-activation",
      activationKind: "business_profile",
      resultClass: "public_profile_ready",
      hasRegistrationProjection: async () => true,
      persistEventOnce,
      now: () => new Date("2026-08-23T13:00:00.000Z"),
    });
    const retry = await recordServerConfirmedActivation({
      req: makeAttributedRequest(),
      userId: "user-activation",
      activationKind: "business_profile",
      resultClass: "public_profile_ready",
      hasRegistrationProjection: async () => true,
      persistEventOnce,
    });

    expect(first.eventRecorded).toBe(true);
    expect(retry.eventRecorded).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({
        type: ACQUISITION_ACTIVATION_COMPLETED_EVENT,
        serverConfirmed: true,
        userId: "user-activation",
        registrationKey: "user:user-activation",
        registrationProjectionStatus: "linked",
        activationKind: "business_profile",
        resultClass: "public_profile_ready",
        businessSlug: "business-a",
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("private@example.com");
    expect(JSON.stringify(events)).not.toContain("555-0100");
  });

  it("re-verifies a custom-domain token handoff for local and OAuth registration", async () => {
    const sourceRequest = makeAttributedRequest();
    const token = sourceRequest.session.acquisitionDiscoveryAttribution.token;
    const events: Record<string, unknown>[] = [];

    for (const [userId, flow] of [
      ["handoff-local", "standard"],
      ["handoff-google", "oauth_google"],
    ] as const) {
      const req = { headers: {}, session: {}, body: {} } as any;
      const result = await recordServerConfirmedRegistration({
        req,
        userId,
        flow,
        profileCount: 1,
        emailVerificationRequired: true,
        discoveryAttributionToken: token,
        persistEventOnce: async (event) => {
          events.push(event);
          return true;
        },
      });
      expect(result.eventRecorded).toBe(true);
      expect(req.session.acquisitionDiscoveryAttribution.entryRequestId).toBeTruthy();
    }

    expect(events).toHaveLength(2);
    expect(events.every((event) => event.entitySlug === "business-a")).toBe(true);
    expect(events.every((event) => event.attributionStatus === "verified_public_discovery")).toBe(
      true
    );
  });

  it("distinguishes new social accounts and avoids dangling registration links", async () => {
    expect(isNewSocialRegistrationUser({ _wasNewSocialUser: true })).toBe(true);
    expect(isNewSocialRegistrationUser({ _wasNewSocialUser: false })).toBe(false);
    expect(isNewSocialRegistrationUser({})).toBe(false);

    const events: Record<string, unknown>[] = [];
    await recordServerConfirmedActivation({
      req: makeAttributedRequest(),
      userId: "legacy-user-without-registration-projection",
      activationKind: "express_result",
      resultClass: "guided_result_ready",
      hasRegistrationProjection: async () => false,
      persistEventOnce: async (event) => {
        events.push(event);
        return true;
      },
    });

    expect(events[0]).toMatchObject({
      registrationProjectionStatus: "registration_missing",
    });
    expect(events[0]).not.toHaveProperty("registrationKey");
  });
});
