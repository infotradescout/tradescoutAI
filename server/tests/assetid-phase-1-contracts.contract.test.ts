import { describe, expect, it } from "vitest";

type HomeIdRecord = {
  homeId: string;
  recordType: "home";
  listingId?: string | null;
};

type HomeScoutAction = {
  actionId: string;
  homeId?: string;
  type: "listing" | "seller_intent" | "direct_connect_request";
};

type DirectConnectRequest = {
  requestId: string;
  homeId?: string;
};

type HomeEvent = {
  eventId: string;
  homeId: string;
  eventType: "job_completed";
  verificationStatus: "proposed" | "pending" | "verified";
  visibility: "private_owner_only" | "buyer_packet" | "public_home_profile";
  sourceType: "direct_connect";
  sourceId: string;
};

type HomeEvidence = {
  evidenceId: string;
  homeId: string;
  eventId: string;
  evidenceType: "receipt" | "invoice";
  amount: number;
  providerId: string;
  occurredAt: string;
  sourceId: string;
  visibility: "private_owner_only" | "transfers_with_home" | "buyer_packet" | "does_not_transfer";
};

type Authority = {
  homeId: string;
  subjectId: string;
  role: "builder_of_record" | "owner";
  status: "active" | "closed";
  startedAt: string;
  endedAt?: string;
};

function validateHomeScoutAction(action: HomeScoutAction) {
  return Boolean(action.homeId && action.homeId.trim().length > 0);
}

function attachDirectConnectToHome(req: DirectConnectRequest) {
  if (!req.homeId) throw new Error("homeId required");
  return {
    sourceType: "direct_connect" as const,
    sourceId: req.requestId,
    homeId: req.homeId,
  };
}

function proposeJobCompletedEvent(args: {
  homeId: string;
  requestId: string;
  visibility?: HomeEvent["visibility"];
}): HomeEvent {
  return {
    eventId: "evt_1",
    homeId: args.homeId,
    eventType: "job_completed",
    verificationStatus: "proposed",
    visibility: args.visibility ?? "private_owner_only",
    sourceType: "direct_connect",
    sourceId: args.requestId,
  };
}

function linkEvidenceToEvent(args: {
  homeId: string;
  eventId: string;
  evidenceType: "receipt" | "invoice";
  amount: number;
  providerId: string;
  occurredAt: string;
  sourceId: string;
  visibility?: HomeEvidence["visibility"];
}): HomeEvidence {
  return {
    evidenceId: "evi_1",
    homeId: args.homeId,
    eventId: args.eventId,
    evidenceType: args.evidenceType,
    amount: args.amount,
    providerId: args.providerId,
    occurredAt: args.occurredAt,
    sourceId: args.sourceId,
    visibility: args.visibility ?? "private_owner_only",
  };
}

function transferBuilderToHomeowner(args: {
  homeId: string;
  builderAuthority: Authority;
  homeownerId: string;
  transferAt: string;
}) {
  const closedBuilder: Authority = {
    ...args.builderAuthority,
    status: "closed",
    endedAt: args.transferAt,
  };
  const homeownerAuthority: Authority = {
    homeId: args.homeId,
    subjectId: args.homeownerId,
    role: "owner",
    status: "active",
    startedAt: args.transferAt,
  };
  return {
    transferType: "builder_to_homeowner" as const,
    homeId: args.homeId,
    closedBuilder,
    homeownerAuthority,
  };
}

function buildTransferPacket(evidence: HomeEvidence[]) {
  return evidence.filter(
    (e) => e.visibility === "transfers_with_home" || e.visibility === "buyer_packet"
  );
}

describe("AssetID Phase 1 contracts", () => {
  it("HomeID can exist without HomeScout listing", () => {
    const record: HomeIdRecord = { homeId: "home_123", recordType: "home", listingId: null };
    expect(record.homeId).toBeTruthy();
    expect(record.recordType).toBe("home");
    expect(record.listingId ?? null).toBeNull();
  });

  it("HomeScout action must reference HomeID", () => {
    const invalidAction: HomeScoutAction = { actionId: "act_1", type: "listing" };
    const validAction: HomeScoutAction = { actionId: "act_2", type: "listing", homeId: "home_123" };
    expect(validateHomeScoutAction(invalidAction)).toBe(false);
    expect(validateHomeScoutAction(validAction)).toBe(true);
  });

  it("Direct Connect request can attach to HomeID", () => {
    const req: DirectConnectRequest = { requestId: "dc_1", homeId: "home_123" };
    const link = attachDirectConnectToHome(req);
    expect(link.homeId).toBe("home_123");
    expect(link.sourceType).toBe("direct_connect");
    expect(link.sourceId).toBe("dc_1");
  });

  it("Completed job cycle proposes HomeID event", () => {
    const event = proposeJobCompletedEvent({ homeId: "home_123", requestId: "dc_1" });
    expect(event.eventType).toBe("job_completed");
    expect(event.verificationStatus).toBe("proposed");
    expect(event.visibility).not.toBe("public_home_profile");
    expect(event.sourceType).toBe("direct_connect");
    expect(event.sourceId).toBe("dc_1");
  });

  it("Receipt/invoice evidence links to HomeID event", () => {
    const event = proposeJobCompletedEvent({ homeId: "home_123", requestId: "dc_1" });
    const evidence = linkEvidenceToEvent({
      homeId: "home_123",
      eventId: event.eventId,
      evidenceType: "invoice",
      amount: 4200,
      providerId: "biz_9",
      occurredAt: "2026-05-28T00:00:00.000Z",
      sourceId: "invoice_77",
    });
    expect(evidence.homeId).toBe("home_123");
    expect(evidence.eventId).toBe(event.eventId);
    expect(evidence.amount).toBe(4200);
    expect(evidence.providerId).toBe("biz_9");
    expect(evidence.occurredAt).toBe("2026-05-28T00:00:00.000Z");
    expect(evidence.sourceId).toBe("invoice_77");
  });

  it("Authority transfer builder -> homeowner succeeds", () => {
    const builderAuthority: Authority = {
      homeId: "home_123",
      subjectId: "builder_1",
      role: "builder_of_record",
      status: "active",
      startedAt: "2026-01-01T00:00:00.000Z",
    };
    const transfer = transferBuilderToHomeowner({
      homeId: "home_123",
      builderAuthority,
      homeownerId: "user_2",
      transferAt: "2026-05-28T00:00:00.000Z",
    });
    expect(transfer.transferType).toBe("builder_to_homeowner");
    expect(transfer.homeId).toBe("home_123");
    expect(transfer.closedBuilder.status).toBe("closed");
    expect(transfer.homeownerAuthority.status).toBe("active");
    expect(transfer.homeownerAuthority.subjectId).toBe("user_2");
  });

  it("Private evidence excluded from transfer packet by default", () => {
    const evidence: HomeEvidence[] = [
      linkEvidenceToEvent({
        homeId: "home_123",
        eventId: "evt_1",
        evidenceType: "receipt",
        amount: 100,
        providerId: "biz_a",
        occurredAt: "2026-05-01T00:00:00.000Z",
        sourceId: "receipt_private",
        visibility: "private_owner_only",
      }),
      linkEvidenceToEvent({
        homeId: "home_123",
        eventId: "evt_1",
        evidenceType: "invoice",
        amount: 200,
        providerId: "biz_b",
        occurredAt: "2026-05-02T00:00:00.000Z",
        sourceId: "invoice_transfer",
        visibility: "transfers_with_home",
      }),
      linkEvidenceToEvent({
        homeId: "home_123",
        eventId: "evt_1",
        evidenceType: "invoice",
        amount: 300,
        providerId: "biz_c",
        occurredAt: "2026-05-03T00:00:00.000Z",
        sourceId: "invoice_buyer_packet",
        visibility: "buyer_packet",
      }),
    ];
    const packet = buildTransferPacket(evidence);
    expect(packet.map((e) => e.sourceId)).toContain("invoice_transfer");
    expect(packet.map((e) => e.sourceId)).toContain("invoice_buyer_packet");
    expect(packet.map((e) => e.sourceId)).not.toContain("receipt_private");
  });
});
