import { describe, expect, it, vi } from "vitest";
import {
  assertDirectConnectAssignmentRecipient,
  buildDirectConnectSubmissionContact,
  bindDirectConnectExplicitRecipient,
  loadDirectConnectSubmittedContact,
} from "../routes/direct-connect/authority";

const receipt = buildDirectConnectSubmissionContact({
  workRequestId: "request-1",
  requesterUserId: "sender-1",
  name: "Jordan Example",
  phone: "+1 (225) 555-0100",
});
function fixture() {
  const assignmentRow: any = {
    id: "assignment-1",
    work_request_id: "request-1",
    responder_user_id: "business-owner-1",
    status: "invited",
    score_snapshot: { submissionContactRecipientUserId: "business-owner-1" },
  };
  const requestRow: any = {
    id: "request-1",
    created_by_user_id: "sender-1",
    source: "direct_connect",
    status: "routed",
  };
  const event: any = {
    actor_user_id: "sender-1",
    metadata: {
      source: "tradepartner_profile",
      contactPreference: "platform_message",
      submissionContact: { ...receipt },
    },
  };
  const tx = { execute: vi.fn(async () => ({ rows: [event] })) };
  return { tx, event, params: { assignmentRow, requestRow, providerUserId: "business-owner-1" } };
}

describe("request-specific submission contact", () => {
  it.each(["platform_message", "call"])(
    "gives the invited business the submitted name and phone for %s without approving general contact",
    async (preference) => {
      const { tx, event, params } = fixture();
      event.metadata.contactPreference = preference;
      expect(await loadDirectConnectSubmittedContact(tx, params)).toMatchObject({
        assignmentId: "assignment-1",
        requesterUserId: "sender-1",
        name: "Jordan Example",
        phone: "+12255550100",
        contactPreference: preference,
        contactGateState: "submission_consented",
      });
      expect(tx.execute).toHaveBeenCalledTimes(1);
    }
  );

  it.each(["", "unrelated-user", "sender-1"])(
    "denies non-recipients before reading contact: %s",
    async (providerUserId) => {
      const { tx, params } = fixture();
      await expect(
        loadDirectConnectSubmittedContact(tx, { ...params, providerUserId })
      ).rejects.toMatchObject({ status: 404 });
      expect(tx.execute).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["version", 2],
    ["source", "admin_submission"],
    ["workRequestId", "other-request"],
    ["requesterUserId", "other-sender"],
    ["name", ""],
    ["phone", "555"],
  ])("rejects a present receipt with invalid %s", async (key, value) => {
    const { tx, event, params } = fixture();
    event.metadata.submissionContact[key] = value;
    await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
      code: "REQUEST_CONTACT_CONSENT_INVALID",
    });
  });

  it("does not use a malformed present receipt as permission for legacy fallback", async () => {
    const { tx, event, params } = fixture();
    event.metadata.submissionContact = null;
    await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
      code: "REQUEST_CONTACT_CONSENT_INVALID",
    });
  });

  it("uses legacy handling only when no submission receipt exists", async () => {
    const { tx, event, params } = fixture();
    delete event.metadata.submissionContact;
    expect(await loadDirectConnectSubmittedContact(tx, params)).toBeNull();
  });

  it.each(["declined", "withdrawn", "cancelled"])(
    "denies inactive %s assignments",
    async (status) => {
      const { tx, params } = fixture();
      params.assignmentRow.status = status;
      await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
        code: "REQUEST_CONTACT_CONSENT_INVALID",
      });
    }
  );

  it.each(["cancelled", "draft"])("denies contact from a %s request", async (status) => {
    const { tx, params } = fixture();
    params.requestRow.status = status;
    await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
      code: "REQUEST_CONTACT_CONSENT_INVALID",
    });
  });

  it("rejects a receipt copied to a different receiving assignment or created by another actor", async () => {
    const { tx, event, params } = fixture();
    params.assignmentRow.score_snapshot.submissionContactRecipientUserId = "other-business";
    await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
      code: "REQUEST_CONTACT_CONSENT_INVALID",
    });
    params.assignmentRow.score_snapshot.submissionContactRecipientUserId = params.providerUserId;
    event.actor_user_id = "admin-1";
    await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
      code: "REQUEST_CONTACT_CONSENT_INVALID",
    });
  });

  it.each(["contractor", "worker"])(
    "requires the canonical %s account and never transfers the receipt to a new owner",
    async (kind) => {
      const { tx, params } = fixture();
      params.assignmentRow[`${kind}_id`] = `${kind}-1`;
      params.assignmentRow[`${kind}_owner_id`] = params.providerUserId;
      expect(await loadDirectConnectSubmittedContact(tx, params)).toMatchObject({
        phone: receipt.phone,
      });
      params.assignmentRow[`${kind}_owner_id`] = "new-owner";
      expect(() =>
        assertDirectConnectAssignmentRecipient(params.assignmentRow, params.providerUserId)
      ).toThrow("Assignment not found");
      expect(() =>
        assertDirectConnectAssignmentRecipient(params.assignmentRow, "new-owner")
      ).toThrow("Assignment not found");
    }
  );

  it("returns the captured contact without reading later profile values", async () => {
    const { tx, params } = fixture();
    const result = await loadDirectConnectSubmittedContact(tx, params);
    expect(result?.phone).toBe(receipt.phone);
    expect(result?.name).toBe(receipt.name);
    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty("email");
  });

  it("grants an existing board assignment contact only after explicit requester selection, preserving its metadata", async () => {
    const { tx, params } = fixture();
    params.assignmentRow.score_snapshot = {
      routingMode: "self_selected",
      reasons: ["Provider volunteered"],
    };
    await expect(loadDirectConnectSubmittedContact(tx, params)).rejects.toMatchObject({
      code: "REQUEST_CONTACT_CONSENT_INVALID",
    });
    const assignment = { ...params.assignmentRow, requester_user_id: "sender-1" };
    const bindingTx = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [assignment] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...assignment,
              score_snapshot: {
                ...assignment.score_snapshot,
                submissionContactRecipientUserId: "business-owner-1",
              },
            },
          ],
        }),
    };
    const changed = await bindDirectConnectExplicitRecipient(bindingTx, {
      workRequestId: "request-1",
      requesterUserId: "sender-1",
      providerUserId: "business-owner-1",
    });
    expect(changed).toHaveLength(1);
    expect(changed[0].score_snapshot).toMatchObject({
      routingMode: "self_selected",
      reasons: ["Provider volunteered"],
      submissionContactRecipientUserId: "business-owner-1",
    });
    params.assignmentRow = changed[0];
    expect(await loadDirectConnectSubmittedContact(tx, params)).toMatchObject({
      name: receipt.name,
      phone: receipt.phone,
    });
    bindingTx.execute.mockReset().mockResolvedValue({ rows: changed });
    expect(
      await bindDirectConnectExplicitRecipient(bindingTx, {
        workRequestId: "request-1",
        requesterUserId: "sender-1",
        providerUserId: "business-owner-1",
      })
    ).toEqual([]);
    expect(bindingTx.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    { requester: "other-sender", binding: undefined },
    { requester: "sender-1", binding: "other-business" },
  ])(
    "rejects unrelated owners and conflicting receipt bindings: %o",
    async ({ requester, binding }) => {
      const { params } = fixture();
      const assignment = {
        ...params.assignmentRow,
        requester_user_id: "sender-1",
        score_snapshot: binding ? { submissionContactRecipientUserId: binding } : {},
      };
      const tx = { execute: vi.fn().mockResolvedValue({ rows: [assignment] }) };
      await expect(
        bindDirectConnectExplicitRecipient(tx, {
          workRequestId: "request-1",
          requesterUserId: requester,
          providerUserId: "business-owner-1",
        })
      ).rejects.toThrow();
      expect(tx.execute).toHaveBeenCalledTimes(1);
    }
  );
});
