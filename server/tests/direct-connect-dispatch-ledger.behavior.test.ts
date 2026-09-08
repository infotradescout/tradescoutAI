import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendDispatchEvent,
  snapshotDispatchCandidate,
} from "../services/directConnectDispatchLedgerService";

const state = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../db", () => ({ db: { execute: state.execute } }));

const writers = [
  {
    name: "candidate snapshot",
    constraint: "direct_connect_dispatch_candidates_request_id_fkey",
    write: () =>
      snapshotDispatchCandidate({
        requestId: "legacy-request",
        contractorId: "eligible-contractor",
        eligibility: { status: "eligible", eligible: true },
        territoryMatched: true,
        categoryMatched: true,
        verificationState: "verified",
        profileReadiness: "ready",
        contactEligibility: false,
        trustState: "measured",
      }),
  },
  {
    name: "dispatch event",
    constraint: "direct_connect_dispatch_events_request_id_fkey",
    write: () =>
      appendDispatchEvent({
        requestId: "legacy-request",
        actorType: "requester",
        actorId: "request-owner",
        eventType: "request_route_ready",
      }),
  },
];

describe.each(writers)("legacy work-request $name", ({ constraint, write }) => {
  beforeEach(() => state.execute.mockReset());

  function missingParent(overrides = {}) {
    return Object.assign(new Error("Foreign key constraint failed"), {
      code: "23503",
      constraint,
      detail:
        'Key (request_id)=(legacy-request) is not present in table "direct_connect_dispatch_requests".',
      ...overrides,
    });
  }

  it.each([false, true])(
    "tolerates only an absent optional ledger parent without inventing authority (wrapped=%s)",
    async (wrapped) => {
      const native = missingParent();
      const error = wrapped ? new Error("Drizzle query failed", { cause: native }) : native;
      state.execute.mockRejectedValueOnce(error);
      await expect(write()).resolves.toBeUndefined();
      // No synthesized parent, retry, contact release, or notification follows.
      expect(state.execute).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    { code: "42501" },
    { constraint: "direct_connect_dispatch_candidates_contractor_id_fkey" },
    { detail: 'Key (contractor_id) is not present in table "contractors".' },
  ])("propagates non-parent database failures: %j", async (overrides) => {
    const error = new Error("Drizzle query failed", { cause: missingParent(overrides) });
    state.execute.mockRejectedValueOnce(error);
    await expect(write()).rejects.toBe(error);
    expect(state.execute).toHaveBeenCalledTimes(1);
  });

  it("propagates a cyclic cause instead of looping or accepting an unknown failure", async () => {
    const error = new Error("Unknown query failure") as Error & { cause?: unknown };
    error.cause = error;
    state.execute.mockRejectedValueOnce(error);
    await expect(write()).rejects.toBe(error);
    expect(state.execute).toHaveBeenCalledTimes(1);
  });
});
