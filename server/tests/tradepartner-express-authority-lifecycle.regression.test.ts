import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createExpressDirectConnectAuthority,
  ExpressContactAuthorityError,
} from "../routes/tradepartner-express";
import {
  ExpressDirectConnectContactReleaseError,
  ExpressDirectConnectAuthorityTransitionError,
  loadExpressDirectConnectReleasedContact,
  transitionExpressDirectConnectAuthority,
} from "../routes/direct-connect";

const now = new Date("2026-09-01T12:00:00.000Z");

const creationParams = {
  workRequestId: "request-1",
  requesterUserId: "requester-1",
  providerUserId: "provider-1",
  profileId: "profile-1",
  profileSlug: "public-profile",
  businessId: "business-1",
  title: "Call request for Example TradePartner",
  description: "Please call about the project estimate.",
  contactPreference: "call" as const,
  now,
};

const transitionRequestRow = {
  id: "request-1",
  createdByUserId: "requester-1",
  source: "direct_connect",
  sourceRefId: "profile-1",
};

function insertHarness(returningRows: any[][]) {
  const valuesCalls: any[] = [];
  const insert = vi.fn(() => ({
    values: vi.fn((values: any) => {
      valuesCalls.push(values);
      return {
        returning: vi.fn(async () => returningRows.shift() || []),
      };
    }),
  }));
  return { insert, valuesCalls };
}

function updateHarness(returningRows: any[][]) {
  const setCalls: any[] = [];
  const update = vi.fn(() => {
    const chain: any = {};
    chain.set = vi.fn((values: any) => {
      setCalls.push(values);
      return chain;
    });
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(async () => returningRows.shift() || []);
    return chain;
  });
  return { update, setCalls };
}

function authorityMetadata(
  permissionDisposition: "created_pending" | "created_released" | "accepted_reused",
  contactPreference: "platform_message" | "call" = "call",
  submissionConsent = false
) {
  const decisionScope = JSON.stringify({
    kind: "tradepartner_profile_express",
    workRequestId: "request-1",
    requesterUserId: "requester-1",
    providerUserId: "provider-1",
    profileId: "profile-1",
    profileSlug: "public-profile",
    businessId: "business-1",
    contactPreference,
  });
  return {
    source: "tradepartner_profile",
    connectionMode: "express",
    profileId: "profile-1",
    businessId: "business-1",
    businessSlug: "public-profile",
    authorityGate: "decision_card",
    sourceDecisionCardId: "decision-card-1",
    contactPermissionId: "permission-1",
    intent: "hire",
    decisionScope,
    contactPreference,
    ...(submissionConsent
      ? {
          contactConsent: "request_submission",
          contactReleaseState: "released",
          contactGateState: "released",
        }
      : { contactGateState: "pending_provider_response" }),
    permissionDisposition,
  };
}

function authorityRow(
  metadata: ReturnType<typeof authorityMetadata>,
  permissionStatus: "pending" | "accepted" = "pending"
) {
  return {
    decision_card_id: "decision-card-1",
    decision_card_user_id: "requester-1",
    decision_card_status: "active",
    decision_card_intent: "hire",
    decision_card_scope: metadata.decisionScope,
    contact_permission_id: "permission-1",
    permission_requester_id: "requester-1",
    permission_target_user_id: "provider-1",
    permission_status: permissionStatus,
    permission_authority_gate: "decision_card",
    permission_decision_card_id: "decision-card-1",
    permission_intent: "hire",
    permission_decision_scope: metadata.decisionScope,
    permission_cooldown_until: null,
  };
}

function transitionTx(args?: {
  disposition?: "created_pending" | "created_released" | "accepted_reused";
  permissionStatus?: "pending" | "accepted";
  updateRows?: any[][];
}) {
  const disposition = args?.disposition || "created_pending";
  const metadata = authorityMetadata(disposition);
  const execute = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ metadata }] })
    .mockResolvedValueOnce({
      rows: [authorityRow(metadata, args?.permissionStatus || "pending")],
    });
  const inserts = insertHarness([]);
  const updates = updateHarness(
    args?.updateRows || [[{ id: "permission-1" }], [{ id: "decision-card-1" }]]
  );
  return {
    tx: { execute, insert: inserts.insert, update: updates.update },
    execute,
    inserts,
    updates,
    metadata,
  };
}

describe("Express Direct Connect formal authority creation", () => {
  it("creates requester-owned Decision Card, accepted permission, and linked audit event", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const inserts = insertHarness([
      [{ id: "decision-card-1" }],
      [{ id: "notification-1" }],
      [{ id: "permission-1" }],
    ]);

    const result = await createExpressDirectConnectAuthority(
      { execute, insert: inserts.insert },
      creationParams
    );

    expect(result).toMatchObject({
      sourceDecisionCardId: "decision-card-1",
      contactPermissionId: "permission-1",
      contactRequestNotificationId: "notification-1",
      intent: "hire",
      contactGateState: "released",
      permissionDisposition: "created_released",
    });
    expect(JSON.parse(result.decisionScope)).toEqual({
      kind: "tradepartner_profile_express",
      workRequestId: "request-1",
      requesterUserId: "requester-1",
      providerUserId: "provider-1",
      profileId: "profile-1",
      profileSlug: "public-profile",
      businessId: "business-1",
      contactPreference: "call",
    });
    expect(inserts.valuesCalls[0]).toMatchObject({
      userId: "requester-1",
      status: "active",
      intent: "hire",
      decisionScope: result.decisionScope,
    });
    expect(inserts.valuesCalls[1]).toMatchObject({
      userId: "provider-1",
      type: "new_project_request",
      metadata: expect.objectContaining({
        workRequestId: "request-1",
        sourceDecisionCardId: "decision-card-1",
        contactPreference: "call",
      }),
    });
    expect(inserts.valuesCalls[2]).toMatchObject({
      requesterId: "requester-1",
      targetUserId: "provider-1",
      status: "accepted",
      lastRequestType: "call",
      lastRequestNotificationId: "notification-1",
      authorityGate: "decision_card",
      sourceDecisionCardId: "decision-card-1",
      decisionScope: result.decisionScope,
    });
    expect(inserts.valuesCalls[3]).toMatchObject({
      contactPermissionId: "permission-1",
      eventType: "requester_consent_granted",
      fromStatus: null,
      toStatus: "accepted",
      sourceDecisionCardId: "decision-card-1",
    });
  });

  it("reuses an accepted pair without overwriting it and records the new scoped card", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "accepted-permission", status: "accepted" }] });
    const inserts = insertHarness([
      [{ id: "decision-card-accepted" }],
      [{ id: "notification-accepted" }],
    ]);

    const result = await createExpressDirectConnectAuthority(
      { execute, insert: inserts.insert },
      creationParams
    );

    expect(result).toMatchObject({
      contactPermissionId: "accepted-permission",
      contactGateState: "released",
      permissionDisposition: "accepted_reused",
    });
    expect(inserts.valuesCalls).toHaveLength(3);
    expect(inserts.valuesCalls[2]).toMatchObject({
      contactPermissionId: "accepted-permission",
      eventType: "express_authority_reused",
      fromStatus: "accepted",
      toStatus: "accepted",
      sourceDecisionCardId: "decision-card-accepted",
    });
  });

  it("persists platform-message intent using the contact permission column contract", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const inserts = insertHarness([
      [{ id: "decision-card-message" }],
      [{ id: "notification-message" }],
      [{ id: "permission-message" }],
    ]);

    await createExpressDirectConnectAuthority(
      { execute, insert: inserts.insert },
      { ...creationParams, contactPreference: "platform_message" }
    );

    expect(inserts.valuesCalls[2]).toMatchObject({
      lastRequestType: "message",
      lastRequestNotificationId: "notification-message",
    });
  });

  it.each([
    ["blocked", null, "EXPRESS_CONTACT_BLOCKED"],
    ["pending", null, "EXPRESS_CONTACT_ALREADY_PENDING"],
    ["declined", null, "EXPRESS_CONTACT_PREVIOUSLY_DECLINED"],
    ["accepted", "2026-09-02T12:00:00.000Z", "EXPRESS_CONTACT_COOLDOWN_ACTIVE"],
  ])("fails closed for an existing %s pair", async (status, cooldownUntil, code) => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "permission-1", status, cooldown_until: cooldownUntil }],
      });
    const inserts = insertHarness([]);

    await expect(
      createExpressDirectConnectAuthority({ execute, insert: inserts.insert }, creationParams)
    ).rejects.toMatchObject<Partial<ExpressContactAuthorityError>>({ code });
    expect(inserts.insert).not.toHaveBeenCalled();
  });
});

describe("Express Direct Connect provider authority transition", () => {
  it("atomically accepts the linked permission, completes the card, and records gate release", async () => {
    const harness = transitionTx();

    const result = await transitionExpressDirectConnectAuthority(harness.tx, {
      requestRow: transitionRequestRow,
      providerUserId: "provider-1",
      decision: "accept",
      now,
    });

    expect(result).toEqual({
      sourceDecisionCardId: "decision-card-1",
      contactPermissionId: "permission-1",
      contactPreference: "call",
      fromContactGateState: "pending_provider_response",
      contactGateState: "accepted",
      contactReleased: true,
    });
    expect(harness.updates.setCalls[0]).toMatchObject({
      status: "accepted",
      respondedBy: "provider-1",
      respondedAt: now,
      responseReason: "express_assignment_accepted",
    });
    expect(harness.updates.setCalls[1]).toMatchObject({
      status: "completed",
      decidedAt: now,
    });
    expect(harness.inserts.valuesCalls[0]).toMatchObject({
      eventType: "accepted",
      fromStatus: "pending",
      toStatus: "accepted",
    });
    expect(harness.inserts.valuesCalls[1]).toMatchObject({
      workRequestId: "request-1",
      type: "updated",
      metadata: expect.objectContaining({
        kind: "contact_authority_transition",
        contactGateState: "accepted",
        contactReleased: true,
      }),
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|tel:/i);
  });


  it("keeps requester-consented contact released while the provider responds", async () => {
    const metadata = authorityMetadata("created_released", "call", true);
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ metadata }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorityRow(metadata, "accepted"),
            decision_card_status: "active",
            decision_card_decided_at: null,
            permission_responded_at: now,
            permission_responded_by: "requester-1",
          },
        ],
      });
    const inserts = insertHarness([]);
    const updates = updateHarness([[{ id: "decision-card-1" }]]);

    const result = await transitionExpressDirectConnectAuthority(
      { execute, insert: inserts.insert, update: updates.update },
      {
        requestRow: transitionRequestRow,
        providerUserId: "provider-1",
        decision: "accept",
        now,
      }
    );

    expect(result).toMatchObject({
      fromContactGateState: "released",
      contactGateState: "accepted",
      contactReleased: true,
    });
    expect(updates.setCalls).toHaveLength(1);
    expect(updates.setCalls[0]).toMatchObject({ status: "completed" });
    expect(inserts.valuesCalls[0]).toMatchObject({
      eventType: "provider_accepted_after_requester_consent",
      fromStatus: "accepted",
      toStatus: "accepted",
    });
  });

  it("declines without releasing contact, archives the card, and records the closed gate", async () => {
    const harness = transitionTx();

    const result = await transitionExpressDirectConnectAuthority(harness.tx, {
      requestRow: transitionRequestRow,
      providerUserId: "provider-1",
      decision: "decline",
      declineReason: "Unavailable this week",
      now,
    });

    expect(result).toMatchObject({
      contactGateState: "provider_declined",
      contactReleased: false,
    });
    expect(harness.updates.setCalls[0]).toMatchObject({
      status: "declined",
      respondedBy: "provider-1",
      responseReason: "Unavailable this week",
    });
    expect(harness.updates.setCalls[1]).toMatchObject({ status: "archived", decidedAt: now });
    expect(harness.inserts.valuesCalls[0]).toMatchObject({
      eventType: "declined",
      fromStatus: "pending",
      toStatus: "declined",
    });
    expect(harness.inserts.valuesCalls[1].metadata).toMatchObject({
      contactGateState: "provider_declined",
      contactReleased: false,
    });
  });

  it("does not downgrade an accepted pair when its new scoped request is declined", async () => {
    const harness = transitionTx({
      disposition: "accepted_reused",
      permissionStatus: "accepted",
      updateRows: [[{ id: "decision-card-1" }]],
    });

    const result = await transitionExpressDirectConnectAuthority(harness.tx, {
      requestRow: transitionRequestRow,
      providerUserId: "provider-1",
      decision: "decline",
      now,
    });

    expect(result).toMatchObject({
      fromContactGateState: "pending_provider_response",
      contactGateState: "provider_declined",
      contactReleased: false,
    });
    expect(harness.updates.update).toHaveBeenCalledTimes(1);
    expect(harness.updates.setCalls[0]).toMatchObject({ status: "archived", decidedAt: now });
    expect(harness.inserts.valuesCalls[0]).toMatchObject({
      eventType: "express_scope_declined_existing_relationship",
      fromStatus: "accepted",
      toStatus: "accepted",
    });
  });

  it("rejects a provider that does not match the durable request scope", async () => {
    const metadata = authorityMetadata("created_pending");
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ metadata }] });
    const inserts = insertHarness([]);
    const updates = updateHarness([]);

    await expect(
      transitionExpressDirectConnectAuthority(
        { execute, insert: inserts.insert, update: updates.update },
        {
          requestRow: transitionRequestRow,
          providerUserId: "wrong-provider",
          decision: "accept",
          now,
        }
      )
    ).rejects.toMatchObject<Partial<ExpressDirectConnectAuthorityTransitionError>>({
      code: "EXPRESS_AUTHORITY_SCOPE_MISMATCH",
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(updates.update).not.toHaveBeenCalled();
    expect(inserts.insert).not.toHaveBeenCalled();
  });

  it("rejects authority metadata that does not match the work request profile lineage", async () => {
    const metadata = authorityMetadata("created_pending");
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ metadata }] });

    await expect(
      transitionExpressDirectConnectAuthority(
        { execute, insert: vi.fn(), update: vi.fn() },
        {
          requestRow: { ...transitionRequestRow, sourceRefId: "different-profile" },
          providerUserId: "provider-1",
          decision: "accept",
          now,
        }
      )
    ).rejects.toMatchObject<Partial<ExpressDirectConnectAuthorityTransitionError>>({
      code: "EXPRESS_AUTHORITY_SCOPE_MISMATCH",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejects a contact channel that differs from the durable Decision Card scope", async () => {
    const metadata = authorityMetadata("created_pending", "call");
    metadata.contactPreference = "platform_message";
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ metadata }] });

    await expect(
      transitionExpressDirectConnectAuthority(
        { execute, insert: vi.fn(), update: vi.fn() },
        {
          requestRow: transitionRequestRow,
          providerUserId: "provider-1",
          decision: "accept",
          now,
        }
      )
    ).rejects.toMatchObject<Partial<ExpressDirectConnectAuthorityTransitionError>>({
      code: "EXPRESS_AUTHORITY_SCOPE_MISMATCH",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("throws on a permission transition conflict so the surrounding transaction rolls back", async () => {
    const harness = transitionTx({ updateRows: [[], [{ id: "decision-card-1" }]] });
    let durableAssignmentStatus = "invited";

    const fakeTransaction = async (work: (tx: any) => Promise<void>) => {
      let stagedAssignmentStatus = durableAssignmentStatus;
      const tx = {
        ...harness.tx,
        stageAssignment(status: string) {
          stagedAssignmentStatus = status;
        },
      };
      await work(tx);
      durableAssignmentStatus = stagedAssignmentStatus;
    };

    await expect(
      fakeTransaction(async (tx) => {
        tx.stageAssignment("accepted");
        await transitionExpressDirectConnectAuthority(tx, {
          requestRow: transitionRequestRow,
          providerUserId: "provider-1",
          decision: "accept",
          now,
        });
      })
    ).rejects.toMatchObject<Partial<ExpressDirectConnectAuthorityTransitionError>>({
      code: "EXPRESS_AUTHORITY_UPDATE_CONFLICT",
    });
    expect(durableAssignmentStatus).toBe("invited");
  });

  it("keeps the full acceptance lifecycle outside best-effort response catches", () => {
    const source =
      fs.readFileSync(path.resolve(process.cwd(), "server/routes/direct-connect.ts"), "utf8") +
      fs.readFileSync(
        path.resolve(process.cwd(), "server/routes/direct-connect/authority.ts"),
        "utf8"
      );
    const routeStart = source.indexOf('"/api/direct-connect/assignments/:id/respond"');
    const routeEnd = source.indexOf(
      '"/api/direct-connect/requests/:id/express-interest"',
      routeStart
    );
    const route = source.slice(routeStart, routeEnd);
    const acceptTransition = route.indexOf(
      "authorityTransition = await transitionExpressDirectConnectAuthority(tx, {"
    );
    const acceptLifecycleEnd = route.indexOf("} else {", acceptTransition);
    const acceptLifecycle = route.slice(acceptTransition, acceptLifecycleEnd);

    expect(acceptTransition).toBeGreaterThanOrEqual(0);
    expect(acceptLifecycleEnd).toBeGreaterThan(acceptTransition);
    expect(acceptLifecycle).toContain("await proposeAccountingAutomationFromDirectConnect(tx, {");
    expect(acceptLifecycle).toContain('type: "provider_accepted"');
    expect(acceptLifecycle).not.toContain("try {");
    expect(route).not.toContain("Failed to create or link conversation for assignment");
    expect(source).not.toContain("accounting automation proposal skipped");
    expect(source).toContain("EXPRESS_AUTHORITY_UPDATE_CONFLICT");
    expect(route).not.toMatch(/phone\s*:/i);
    expect(route).not.toMatch(/email\s*:/i);
    expect(route).not.toContain("tel:");
  });

  it("rolls back a staged acceptance when a later lifecycle write fails", async () => {
    const harness = transitionTx();
    let durableAssignmentStatus = "invited";
    let durableConversationId: string | null = null;

    const fakeTransaction = async (work: (tx: any) => Promise<void>) => {
      let stagedAssignmentStatus = durableAssignmentStatus;
      let stagedConversationId = durableConversationId;
      const tx = {
        ...harness.tx,
        stageAssignment(status: string) {
          stagedAssignmentStatus = status;
        },
        stageConversation(id: string) {
          stagedConversationId = id;
        },
      };
      await work(tx);
      durableAssignmentStatus = stagedAssignmentStatus;
      durableConversationId = stagedConversationId;
    };

    await expect(
      fakeTransaction(async (tx) => {
        tx.stageAssignment("accepted");
        await transitionExpressDirectConnectAuthority(tx, {
          requestRow: transitionRequestRow,
          providerUserId: "provider-1",
          decision: "accept",
          now,
        });
        tx.stageConversation("conversation-1");
        throw new Error("simulated accounting event failure");
      })
    ).rejects.toThrow("simulated accounting event failure");
    expect(durableAssignmentStatus).toBe("invited");
    expect(durableConversationId).toBeNull();
  });
});

describe("Express Direct Connect accepted-provider contact release", () => {
  const acceptedAssignment = {
    id: "assignment-1",
    workRequestId: "request-1",
    responderUserId: "provider-1",
    status: "accepted",
  };

  it.each(["suggested", "declined"] as const)(
    "does not release contact for a %s assignment",
    async (status) => {
      const execute = vi.fn();
      await expect(
        loadExpressDirectConnectReleasedContact(
          { execute },
          {
            assignmentRow: { ...acceptedAssignment, status },
            requestRow: transitionRequestRow,
            providerUserId: "provider-1",
          }
        )
      ).rejects.toMatchObject<Partial<ExpressDirectConnectContactReleaseError>>({
        code: "EXPRESS_CONTACT_NOT_RELEASED",
      });
      expect(execute).not.toHaveBeenCalled();
    }
  );

  it("hides an accepted assignment from a sibling provider", async () => {
    const execute = vi.fn();
    await expect(
      loadExpressDirectConnectReleasedContact(
        { execute },
        {
          assignmentRow: acceptedAssignment,
          requestRow: transitionRequestRow,
          providerUserId: "sibling-provider",
        }
      )
    ).rejects.toMatchObject<Partial<ExpressDirectConnectContactReleaseError>>({
      status: 404,
      code: "EXPRESS_ASSIGNMENT_NOT_FOUND",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects request-id guessing that does not match the accepted assignment", async () => {
    const execute = vi.fn();
    await expect(
      loadExpressDirectConnectReleasedContact(
        { execute },
        {
          assignmentRow: acceptedAssignment,
          requestRow: { ...transitionRequestRow, id: "guessed-request" },
          providerUserId: "provider-1",
        }
      )
    ).rejects.toMatchObject<Partial<ExpressDirectConnectContactReleaseError>>({
      status: 404,
      code: "EXPRESS_ASSIGNMENT_NOT_FOUND",
    });
    expect(execute).not.toHaveBeenCalled();
  });


  it("releases name and phone for a requester-consented invited assignment", async () => {
    const metadata = authorityMetadata("created_released", "call", true);
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ metadata }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorityRow(metadata, "accepted"),
            decision_card_status: "active",
            decision_card_decided_at: null,
            permission_responded_at: now,
            permission_responded_by: "requester-1",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: "consent-event-1" }] })
      .mockResolvedValueOnce({
        rows: [{ first_name: "Alex", last_name: "Requester", phone: "404-555-0100" }],
      });

    const result = await loadExpressDirectConnectReleasedContact(
      { execute },
      {
        assignmentRow: { ...acceptedAssignment, status: "invited" },
        requestRow: transitionRequestRow,
        providerUserId: "provider-1",
      }
    );

    expect(result).toEqual({
      assignmentId: "assignment-1",
      workRequestId: "request-1",
      requesterUserId: "requester-1",
      contactPreference: "call",
      contactGateState: "released",
      name: "Alex Requester",
      phone: "404-555-0100",
    });
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("releases the requested contact for an exact accepted legacy authority", async () => {
    const metadata = authorityMetadata("created_pending");
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ metadata }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorityRow(metadata, "accepted"),
            decision_card_status: "completed",
            decision_card_decided_at: now,
            permission_responded_at: now,
            permission_responded_by: "provider-1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            metadata: {
              decision: "accept",
              decisionScope: metadata.decisionScope,
              contactReleased: true,
              contactPreference: "call",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ first_name: "Alex", last_name: "Requester", phone: "404-555-0100" }],
      });

    const result = await loadExpressDirectConnectReleasedContact(
      { execute },
      {
        assignmentRow: acceptedAssignment,
        requestRow: transitionRequestRow,
        providerUserId: "provider-1",
      }
    );

    expect(result).toEqual({
      assignmentId: "assignment-1",
      workRequestId: "request-1",
      requesterUserId: "requester-1",
      contactPreference: "call",
      contactGateState: "accepted",
      name: "Alex Requester",
      phone: "404-555-0100",
    });
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("returns the minimum contact for platform-message requests", async () => {
    const metadata = authorityMetadata("created_pending", "platform_message");
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ metadata }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorityRow(metadata, "accepted"),
            decision_card_status: "completed",
            decision_card_decided_at: now,
            permission_responded_at: now,
            permission_responded_by: "provider-1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            metadata: {
              decision: "accept",
              decisionScope: metadata.decisionScope,
              contactReleased: true,
              contactPreference: "platform_message",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ first_name: "Alex", last_name: "Requester", phone: "404-555-0100" }],
      });

    const result = await loadExpressDirectConnectReleasedContact(
      { execute },
      {
        assignmentRow: acceptedAssignment,
        requestRow: transitionRequestRow,
        providerUserId: "provider-1",
      }
    );

    expect(result).toEqual({
      assignmentId: "assignment-1",
      workRequestId: "request-1",
      requesterUserId: "requester-1",
      contactPreference: "platform_message",
      contactGateState: "accepted",
      name: "Alex Requester",
      phone: "404-555-0100",
    });
    expect(execute).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(result)).not.toMatch(/email|@|tel:/i);
  });

  it("never reads raw contact when the linked permission is not accepted", async () => {
    const metadata = authorityMetadata("created_pending");
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ metadata }] })
      .mockResolvedValueOnce({ rows: [authorityRow(metadata, "pending")] });

    await expect(
      loadExpressDirectConnectReleasedContact(
        { execute },
        {
          assignmentRow: acceptedAssignment,
          requestRow: transitionRequestRow,
          providerUserId: "provider-1",
        }
      )
    ).rejects.toMatchObject<Partial<ExpressDirectConnectContactReleaseError>>({
      code: "EXPRESS_CONTACT_AUTHORITY_INVALID",
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("keeps raw contact out of broad staff oversight and list payloads", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/direct-connect.ts"),
      "utf8"
    );
    const adminStart = source.indexOf('"/api/admin/direct-connect/requests/:id"');
    const adminEnd = source.indexOf('"/api/direct-connect/inbox"', adminStart);
    const adminDetail = source.slice(adminStart, adminEnd);
    const releaseStart = source.indexOf('"/api/direct-connect/assignments/:id/contact"');
    const releaseEnd = source.indexOf(
      '"/api/direct-connect/assignments/:id/respond"',
      releaseStart
    );
    const releaseRoute = source.slice(releaseStart, releaseEnd);

    expect(adminDetail).toContain('contactVisibility: "withheld"');
    expect(adminDetail).toContain("redactContactDetails(String(request.description");
    expect(adminDetail).not.toContain("email: requester.email");
    expect(adminDetail).not.toContain("phone: (requester");
    expect(adminDetail).not.toContain("metadata: e.metadata");
    expect(releaseRoute).toContain("isAuthenticated,");
    expect(releaseRoute).toContain("loadExpressDirectConnectReleasedContact(tx, {");
    expect(releaseRoute).toContain("requesterContact:");
  });
});
