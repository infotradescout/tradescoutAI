import { describe, expect, it, vi } from "vitest";
import {
  PROFILE_REQUEST_SOURCE,
  ProfileRequestDecisionError,
  ProfileRequestDecisionService,
  createProfileRequestSessionNonce,
  hashProfileRequestSessionBinding,
  type ProfileRequestDecisionDatabase,
  type ProfileRequestDecisionQueryClient,
} from "../services/profileRequestDecisionService";

const target = {
  profileId: "profile-1",
  profileSlug: "example-business",
  businessId: "business-1",
  ownerUserId: "owner-1",
};

function lockedRow(overrides: Record<string, unknown> = {}) {
  return {
    decision_id: "decision-1",
    session_binding_hash: "a".repeat(64),
    authority_gate: "decision_card",
    source: "tradepartner_profile",
    target_profile_id: "profile-1",
    target_profile_slug: "example-business",
    target_business_id: "business-1",
    target_owner_user_id: "owner-1",
    decision_scope: "profile:profile-1:request",
    request_payload: { email: "visitor@example.com", message: "Please help with this project." },
    status: "pending",
    consumed_at: null,
    is_fresh: true,
    profile_id: "profile-1",
    profile_slug: "example-business",
    profile_status: "published",
    profile_role_context: "business_owner",
    profile_owner_user_id: "owner-1",
    business_id: "business-1",
    business_name: "Example Business",
    business_status: "active",
    business_owner_user_id: "owner-1",
    business_claim_status: "claimed",
    business_sources: [],
    public_discovery_enabled: true,
    profile_data: {},
    owner_user_id: "owner-1",
    owner_provider: "local",
    owner_preferences: {},
    owner_verified_badge: true,
    owner_verification_status: "verified",
    owner_phone: "8505550100",
    owner_email: "owner@example.com",
    ...overrides,
  };
}

function confirmationHarness(row = lockedRow()) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const client: ProfileRequestDecisionQueryClient = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.includes("SELECT") && sql.includes("profile_request_decision_proofs decision")) {
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("UPDATE public.profile_request_decision_proofs")) {
        return { rows: [{ id: "decision-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }) as ProfileRequestDecisionQueryClient["query"],
    release: vi.fn(),
  };
  const database: ProfileRequestDecisionDatabase = {
    query: vi.fn() as ProfileRequestDecisionDatabase["query"],
    connect: vi.fn(async () => client),
  };
  return { service: new ProfileRequestDecisionService(database), client, queries };
}

describe("ProfileRequestDecisionService", () => {
  it("creates opaque one-time proof material without persisting the bearer proof", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const database = {
      query,
      connect: vi.fn(),
    } as unknown as ProfileRequestDecisionDatabase;
    const service = new ProfileRequestDecisionService(database, { ttlMs: 60_000 });

    const result = await service.stage({
      sessionBindingHash: "a".repeat(64),
      target,
      requestPayload: { email: "visitor@example.com" },
    });

    expect(result.decisionProof).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const values = query.mock.calls[0]?.[1] as unknown[];
    expect(values[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(values[0]).not.toBe(result.decisionProof);
    expect(values.slice(1, 9)).toEqual([
      "a".repeat(64),
      "decision_card",
      "tradepartner_profile",
      "profile-1",
      "example-business",
      "business-1",
      "owner-1",
      "profile:profile-1:request",
    ]);
    expect(JSON.parse(String(values[9]))).toEqual({ email: "visitor@example.com" });
  });

  it("uses a secret-keyed browser-session binding", () => {
    const nonce = createProfileRequestSessionNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const first = hashProfileRequestSessionBinding(nonce, "secret-a");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(hashProfileRequestSessionBinding(nonce, "secret-a")).toBe(first);
    expect(hashProfileRequestSessionBinding(nonce, "secret-b")).not.toBe(first);
  });

  it("locks proof, profile, business, and owner before finalizing and consumes once", async () => {
    const { service, client, queries } = confirmationHarness();
    const finalize = vi.fn(async (_client, decision) => {
      expect(_client).toBe(client);
      expect(decision.target).toMatchObject({
        profileId: "profile-1",
        profileRoleContext: "business_owner",
        businessId: "business-1",
        ownerUserId: "owner-1",
      });
      return { workRequestId: "request-1", requesterUserId: "requester-1" };
    });

    const result = await service.confirm(
      {
        decisionProof: "proof-value",
        sessionBindingHash: "a".repeat(64),
        source: PROFILE_REQUEST_SOURCE,
        targetProfileSlug: "EXAMPLE-BUSINESS",
      },
      finalize
    );

    expect(result.workRequestId).toBe("request-1");
    expect(finalize).toHaveBeenCalledTimes(1);
    const lockQuery = queries.find(({ sql }) => sql.includes("FOR UPDATE"))?.sql || "";
    expect(lockQuery).toContain("FOR UPDATE OF decision, profile, business, owner_account");
    expect(lockQuery).toContain("profile.role_context AS profile_role_context");
    expect(lockQuery).toContain("business.id = profile.business_id");
    expect(lockQuery).toContain("owner_account.id = business.owner_user_id");
    const consumeQuery = queries.find(({ sql }) =>
      sql.includes("UPDATE public.profile_request_decision_proofs")
    )?.sql;
    expect(consumeQuery).toContain("request_payload = '{}'::jsonb");
    expect(consumeQuery).toContain("consumed_at IS NULL");
    expect(queries.at(-1)?.sql).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["session", { session_binding_hash: "b".repeat(64) }, "SESSION_MISMATCH"],
    ["source", { source: "another_source" }, "SOURCE_MISMATCH"],
    ["target profile", { profile_slug: "other-profile" }, "TARGET_MISMATCH"],
    ["target business", { business_id: "business-2" }, "TARGET_MISMATCH"],
    ["target owner", { owner_user_id: "owner-2" }, "TARGET_MISMATCH"],
    ["replay", { status: "confirmed", consumed_at: new Date() }, "PROOF_ALREADY_USED"],
  ])("fails closed for a %s mismatch", async (_label, overrides, code) => {
    const { service, queries } = confirmationHarness(lockedRow(overrides));
    const finalize = vi.fn(async () => ({ workRequestId: "request-1" }));

    await expect(
      service.confirm(
        {
          decisionProof: "proof-value",
          sessionBindingHash: "a".repeat(64),
          source: PROFILE_REQUEST_SOURCE,
          targetProfileSlug: "example-business",
        },
        finalize
      )
    ).rejects.toMatchObject({ code });

    expect(finalize).not.toHaveBeenCalled();
    expect(queries.at(-1)?.sql).toBe("ROLLBACK");
  });

  it("deletes an expired proof without invoking finalization", async () => {
    const { service, queries } = confirmationHarness(lockedRow({ is_fresh: false }));
    const finalize = vi.fn(async () => ({ workRequestId: "request-1" }));

    await expect(
      service.confirm(
        {
          decisionProof: "proof-value",
          sessionBindingHash: "a".repeat(64),
          source: PROFILE_REQUEST_SOURCE,
          targetProfileSlug: "example-business",
        },
        finalize
      )
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProfileRequestDecisionError>>({
        code: "PROOF_EXPIRED",
      })
    );

    expect(finalize).not.toHaveBeenCalled();
    expect(queries.some(({ sql }) => sql.startsWith("DELETE FROM"))).toBe(true);
    expect(queries.at(-1)?.sql).toBe("COMMIT");
  });

  it("rolls back without consuming proof when finalization fails", async () => {
    const { service, queries } = confirmationHarness();

    await expect(
      service.confirm(
        {
          decisionProof: "proof-value",
          sessionBindingHash: "a".repeat(64),
          source: PROFILE_REQUEST_SOURCE,
          targetProfileSlug: "example-business",
        },
        async () => {
          throw new Error("work request insert failed");
        }
      )
    ).rejects.toThrow("work request insert failed");

    expect(
      queries.some(({ sql }) => sql.includes("UPDATE public.profile_request_decision_proofs"))
    ).toBe(false);
    expect(queries.at(-1)?.sql).toBe("ROLLBACK");
  });

  it("drains expired state in SKIP LOCKED batches", async () => {
    const counts = [2, 2, 1];
    const query = vi.fn(async () => {
      const count = counts.shift() || 0;
      return {
        rows: Array.from({ length: count }, (_, index) => ({ id: String(index) })),
        rowCount: count,
      };
    });
    const database = {
      query,
      connect: vi.fn(),
    } as unknown as ProfileRequestDecisionDatabase;
    const service = new ProfileRequestDecisionService(database, { confirmedRetentionMs: 60_000 });

    await expect(service.drainExpired({ batchSize: 2 })).resolves.toBe(5);
    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[0]?.[0])).toContain("FOR UPDATE SKIP LOCKED");
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'pending'");
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'confirmed'");
  });
});
