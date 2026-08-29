import { describe, expect, it, vi } from "vitest";
import {
  finalizeConfirmedAnonymousProfileRequest,
  type StagedProfileRequestPayload,
} from "../services/profileRequestConfirmation";
import {
  ProfileRequestDecisionError,
  type LockedProfileRequestDecision,
  type ProfileRequestDecisionQueryClient,
} from "../services/profileRequestDecisionService";

const payload: StagedProfileRequestPayload = {
  name: "Alex Smith",
  email: "Alex@Example.com",
  phone: "850-555-0100",
  requestType: "request_quote",
  message: "Please quote this kitchen renovation project.",
  stoneName: null,
  serviceName: "Kitchen renovation",
  itemId: null,
  stoneSelections: [],
  updatesOptIn: false,
  discoveryEntryRequestId: "entry-1",
};

function decision(overrides: Partial<LockedProfileRequestDecision["target"]> = {}) {
  return {
    decisionId: "decision-1",
    requestPayload: payload,
    decisionScope: "profile:profile-1:request",
    target: {
      profileId: "profile-1",
      profileSlug: "example-business",
      profileStatus: "published",
      profileOwnerUserId: "owner-1",
      businessId: "business-1",
      businessName: "Example Business",
      businessStatus: "active",
      businessOwnerUserId: "owner-1",
      businessClaimStatus: "claimed",
      businessSources: [],
      publicDiscoveryEnabled: true,
      profileData: { notificationEmail: "requests@example-business.test" },
      ownerUserId: "owner-1",
      ownerProvider: "local",
      ownerPreferences: { publicProfileIds: ["profile-1"] },
      ownerVerifiedBadge: true,
      ownerVerificationStatus: "approved",
      ownerPhone: "8505550199",
      ownerEmail: "owner@example-business.test",
      ...overrides,
    },
  } satisfies LockedProfileRequestDecision;
}

describe("confirmed anonymous profile request", () => {
  it("resolves the requester only inside confirmation and writes one private routed request", async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client: ProfileRequestDecisionQueryClient = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        if (sql.includes("FROM public.users") && sql.includes("lower(email)")) {
          return { rows: [{ id: "requester-1", email: "alex@example.com" }] };
        }
        if (sql.includes("INSERT INTO public.work_requests")) {
          return { rows: [{ id: "request-1", status: "routed" }] };
        }
        return { rows: [], rowCount: 1 };
      }) as ProfileRequestDecisionQueryClient["query"],
      release: vi.fn(),
    };

    const result = await finalizeConfirmedAnonymousProfileRequest(client, decision());

    expect(result).toMatchObject({
      workRequestId: "request-1",
      requesterUserId: "requester-1",
      requesterWasCreated: false,
      target: {
        profileId: "profile-1",
        businessId: "business-1",
        ownerUserId: "owner-1",
        notificationEmail: "requests@example-business.test",
        deliveryCustody: "business",
      },
    });
    expect(queries[0]?.sql).toContain("FROM public.users");
    expect(queries[0]?.sql).toContain("FOR UPDATE");
    expect(queries.some(({ sql }) => sql.includes("UPDATE public.users"))).toBe(false);

    const workInsert = queries.find(({ sql }) => sql.includes("INSERT INTO public.work_requests"));
    expect(workInsert?.sql).toContain("'personal'");
    expect(workInsert?.sql).toContain("'private'");
    expect(workInsert?.sql).toContain("'guided'");
    expect(workInsert?.sql).toContain("'none'");
    expect(workInsert?.values).toEqual([
      "requester-1",
      "Quote request for Example Business",
      payload.message,
      "profile-1",
    ]);

    const eventInsert = queries.find(({ sql }) =>
      sql.includes("INSERT INTO public.work_request_events")
    );
    const createdMetadata = JSON.parse(String(eventInsert?.values?.[2]));
    expect(createdMetadata).toMatchObject({
      authorityGate: "decision_card",
      sourceDecisionProofId: "decision-1",
      decisionScope: "profile:profile-1:request",
      entryRequestId: "entry-1",
    });
    expect(JSON.stringify(createdMetadata)).not.toContain("Alex@Example.com");
    expect(JSON.stringify(createdMetadata)).not.toContain("850-555-0100");
  });

  it("creates a provisional requester only after the locked confirmation callback begins", async () => {
    const queries: string[] = [];
    const client: ProfileRequestDecisionQueryClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("FROM public.users") && sql.includes("lower(email)")) {
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO public.users")) {
          return { rows: [{ id: "requester-new", email: "alex@example.com" }] };
        }
        if (sql.includes("INSERT INTO public.work_requests")) {
          return { rows: [{ id: "request-new", status: "routed" }] };
        }
        return { rows: [], rowCount: 1 };
      }) as ProfileRequestDecisionQueryClient["query"],
      release: vi.fn(),
    };

    const result = await finalizeConfirmedAnonymousProfileRequest(client, decision());

    expect(result.requesterWasCreated).toBe(true);
    expect(queries.findIndex((sql) => sql.includes("FROM public.users"))).toBeLessThan(
      queries.findIndex((sql) => sql.includes("INSERT INTO public.users"))
    );
    expect(queries.findIndex((sql) => sql.includes("INSERT INTO public.users"))).toBeLessThan(
      queries.findIndex((sql) => sql.includes("INSERT INTO public.work_requests"))
    );
  });

  it("fails closed before requester lookup when mutable target authority changed", async () => {
    const client: ProfileRequestDecisionQueryClient = {
      query: vi.fn() as ProfileRequestDecisionQueryClient["query"],
      release: vi.fn(),
    };

    await expect(
      finalizeConfirmedAnonymousProfileRequest(
        client,
        decision({ profileStatus: "draft", publicDiscoveryEnabled: false })
      )
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProfileRequestDecisionError>>({ code: "AUTHORITY_CHANGED" })
    );
    expect(client.query).not.toHaveBeenCalled();
  });

  it("rejects malformed staged payload before touching requester state", async () => {
    const client: ProfileRequestDecisionQueryClient = {
      query: vi.fn() as ProfileRequestDecisionQueryClient["query"],
      release: vi.fn(),
    };
    const malformed = decision();
    malformed.requestPayload = { email: "not-an-email" };

    await expect(finalizeConfirmedAnonymousProfileRequest(client, malformed)).rejects.toEqual(
      expect.objectContaining<Partial<ProfileRequestDecisionError>>({ code: "INVALID_PROOF" })
    );
    expect(client.query).not.toHaveBeenCalled();
  });
});
