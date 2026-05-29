import { describe, expect, it } from "vitest";

type HomeComponent = {
  componentId: string;
  homeId: string;
  category: "paint" | "appliance" | "roofing" | "hvac" | "plumbing" | "electrical" | "flooring";
  label: string;
  details: Record<string, string>;
};

type MaintenanceSchedule = {
  scheduleId: string;
  homeId: string;
  componentId: string;
  maintenanceType: string;
  recommendedIntervalDays: number;
  lastCompletedAt?: string;
  nextDueAt?: string;
};

type InspectionFinding = {
  findingId: string;
  homeId: string;
  componentId: string;
  severity: "low" | "medium" | "high";
  status: "open" | "remediation_requested" | "remediated";
  summary: string;
  evidenceIds: string[];
};

type HomeEvidence = {
  evidenceId: string;
  homeId: string;
  eventId?: string;
  kind: "inspection_report" | "invoice" | "receipt" | "photo" | "warranty";
  sourceId: string;
  visibility:
    | "private_owner_only"
    | "shared_with_service_provider"
    | "buyer_packet"
    | "transfers_with_home";
};

type DirectConnectRequest = {
  requestId: string;
  homeId: string;
  componentId?: string;
  findingId?: string;
  intent: "inspect" | "maintain" | "repair" | "replace" | "remediate";
};

type HomeContextPacket = {
  packetId: string;
  homeId: string;
  requestId: string;
  createdByUserId: string;
  sharedWithProviderId?: string;
  includedComponentIds: string[];
  includedEventIds: string[];
  includedEvidenceIds: string[];
  includedFindingIds: string[];
  expiresAt: string;
};

type ProposedHomeEvent = {
  eventId: string;
  homeId: string;
  eventType: "service_completed";
  verificationStatus: "proposed" | "verified";
  providerId: string;
  occurredAt: string;
  amount: number;
  evidenceIds: string[];
};

function createMaintenanceSchedule(args: {
  homeId: string;
  componentId: string;
  maintenanceType: string;
  intervalDays: number;
  lastCompletedAt?: string;
}) {
  const nextDueAt = args.lastCompletedAt
    ? new Date(
        Date.parse(args.lastCompletedAt) + args.intervalDays * 24 * 60 * 60 * 1000
      ).toISOString()
    : undefined;
  const schedule: MaintenanceSchedule = {
    scheduleId: "ms_1",
    homeId: args.homeId,
    componentId: args.componentId,
    maintenanceType: args.maintenanceType,
    recommendedIntervalDays: args.intervalDays,
    lastCompletedAt: args.lastCompletedAt,
    nextDueAt,
  };
  return schedule;
}

function createRemediationOpportunity(finding: InspectionFinding) {
  return {
    opportunityId: `remediate_${finding.findingId}`,
    homeId: finding.homeId,
    sourceFindingId: finding.findingId,
    intent: "remediate" as const,
    status: "ready_for_request" as const,
  };
}

function closeFindingWithEvidence(args: {
  finding: InspectionFinding;
  remediationEvidenceIds: string[];
}) {
  return {
    ...args.finding,
    status: "remediated" as const,
    evidenceIds: [...args.finding.evidenceIds, ...args.remediationEvidenceIds],
  };
}

function createRequestFromHomeContext(args: {
  homeId: string;
  componentId?: string;
  findingId?: string;
  intent: DirectConnectRequest["intent"];
}) {
  if (!args.componentId && !args.findingId) {
    throw new Error("componentId or findingId required");
  }
  const request: DirectConnectRequest = {
    requestId: "dc_req_1",
    homeId: args.homeId,
    componentId: args.componentId,
    findingId: args.findingId,
    intent: args.intent,
  };
  return request;
}

function createHomeContextPacket(args: {
  homeId: string;
  requestId: string;
  createdByUserId: string;
  includedComponentIds?: string[];
  includedEventIds?: string[];
  includedEvidenceIds?: string[];
  includedFindingIds?: string[];
  expiresAt: string;
}): HomeContextPacket {
  return {
    packetId: "hcp_1",
    homeId: args.homeId,
    requestId: args.requestId,
    createdByUserId: args.createdByUserId,
    includedComponentIds: args.includedComponentIds ?? [],
    includedEventIds: args.includedEventIds ?? [],
    includedEvidenceIds: args.includedEvidenceIds ?? [],
    includedFindingIds: args.includedFindingIds ?? [],
    expiresAt: args.expiresAt,
  };
}

function getProviderVisibleHomeContext(args: {
  packet: HomeContextPacket;
  allEvidence: HomeEvidence[];
}) {
  const packetEvidence = args.allEvidence.filter((e) =>
    args.packet.includedEvidenceIds.includes(e.evidenceId)
  );
  const providerSafeEvidence = packetEvidence.filter(
    (e) =>
      e.visibility === "shared_with_service_provider" ||
      e.visibility === "buyer_packet" ||
      e.visibility === "transfers_with_home"
  );
  return {
    packetId: args.packet.packetId,
    homeId: args.packet.homeId,
    requestId: args.packet.requestId,
    includedComponentIds: args.packet.includedComponentIds,
    includedFindingIds: args.packet.includedFindingIds,
    evidence: providerSafeEvidence,
  };
}

function proposeCompletedJobEvent(args: {
  homeId: string;
  providerId: string;
  occurredAt: string;
  amount: number;
  evidenceIds: string[];
}): ProposedHomeEvent {
  return {
    eventId: "evt_service_1",
    homeId: args.homeId,
    eventType: "service_completed",
    verificationStatus: "proposed",
    providerId: args.providerId,
    occurredAt: args.occurredAt,
    amount: args.amount,
    evidenceIds: args.evidenceIds,
  };
}

function buildBuyerPacket(args: { findings: InspectionFinding[]; evidence: HomeEvidence[] }) {
  const remediatedFindingIds = new Set(
    args.findings.filter((f) => f.status === "remediated").map((f) => f.findingId)
  );
  const transferSafeEvidence = args.evidence.filter(
    (e) => e.visibility === "buyer_packet" || e.visibility === "transfers_with_home"
  );
  return {
    remediatedFindingIds: [...remediatedFindingIds],
    evidenceIds: transferSafeEvidence.map((e) => e.evidenceId),
  };
}

describe("AssetID Phase 1B HomeID context contracts", () => {
  it("stores paint/material/component details as structured HomeID facts", () => {
    const paint: HomeComponent = {
      componentId: "cmp_paint_living_room",
      homeId: "home_123",
      category: "paint",
      label: "Living Room Paint",
      details: {
        brand: "Sherwin-Williams",
        code: "SW 7029",
        finish: "eggshell",
      },
    };
    expect(paint.homeId).toBe("home_123");
    expect(paint.category).toBe("paint");
    expect(paint.details.code).toBe("SW 7029");
  });

  it("stores recurring maintenance schedules tied to components", () => {
    const schedule = createMaintenanceSchedule({
      homeId: "home_123",
      componentId: "cmp_water_heater",
      maintenanceType: "water_heater_flush",
      intervalDays: 365,
      lastCompletedAt: "2026-02-18T00:00:00.000Z",
    });
    expect(schedule.homeId).toBe("home_123");
    expect(schedule.componentId).toBe("cmp_water_heater");
    expect(schedule.maintenanceType).toBe("water_heater_flush");
    expect(schedule.nextDueAt).toBe("2027-02-18T00:00:00.000Z");
  });

  it("inspection finding can create a remediation opportunity", () => {
    const finding: InspectionFinding = {
      findingId: "finding_termite_1",
      homeId: "home_123",
      componentId: "cmp_crawlspace",
      severity: "high",
      status: "open",
      summary: "Termite activity found in crawlspace",
      evidenceIds: ["evi_report_1"],
    };
    const opportunity = createRemediationOpportunity(finding);
    expect(opportunity.homeId).toBe("home_123");
    expect(opportunity.sourceFindingId).toBe("finding_termite_1");
    expect(opportunity.intent).toBe("remediate");
  });

  it("remediation completion can close an inspection finding with evidence", () => {
    const finding: InspectionFinding = {
      findingId: "finding_termite_1",
      homeId: "home_123",
      componentId: "cmp_crawlspace",
      severity: "high",
      status: "remediation_requested",
      summary: "Termite activity found in crawlspace",
      evidenceIds: ["evi_report_1"],
    };
    const remediated = closeFindingWithEvidence({
      finding,
      remediationEvidenceIds: ["evi_invoice_1", "evi_photo_after_1"],
    });
    expect(remediated.status).toBe("remediated");
    expect(remediated.evidenceIds).toContain("evi_invoice_1");
    expect(remediated.evidenceIds).toContain("evi_photo_after_1");
  });

  it("user can create a Direct Connect request from a HomeID component/finding", () => {
    const requestFromComponent = createRequestFromHomeContext({
      homeId: "home_123",
      componentId: "cmp_water_heater",
      intent: "maintain",
    });
    const requestFromFinding = createRequestFromHomeContext({
      homeId: "home_123",
      findingId: "finding_termite_1",
      intent: "remediate",
    });
    expect(requestFromComponent.homeId).toBe("home_123");
    expect(requestFromComponent.componentId).toBe("cmp_water_heater");
    expect(requestFromFinding.findingId).toBe("finding_termite_1");
  });

  it("HomeID-linked request creates a request-scoped context packet", () => {
    const packet = createHomeContextPacket({
      homeId: "home_123",
      requestId: "dc_req_1",
      createdByUserId: "user_1",
      includedComponentIds: ["cmp_water_heater"],
      includedFindingIds: ["finding_termite_1"],
      includedEvidenceIds: ["evi_photo_1"],
      expiresAt: "2026-06-30T00:00:00.000Z",
    });
    expect(packet.homeId).toBe("home_123");
    expect(packet.requestId).toBe("dc_req_1");
    expect(packet.includedComponentIds).toContain("cmp_water_heater");
    expect(packet.includedFindingIds).toContain("finding_termite_1");
  });

  it("provider receives only approved context packet, not full HomeID", () => {
    const packet = createHomeContextPacket({
      homeId: "home_123",
      requestId: "dc_req_1",
      createdByUserId: "user_1",
      includedComponentIds: ["cmp_water_heater"],
      includedEvidenceIds: ["evi_shared", "evi_private"],
      expiresAt: "2026-06-30T00:00:00.000Z",
    });
    const allEvidence: HomeEvidence[] = [
      {
        evidenceId: "evi_shared",
        homeId: "home_123",
        kind: "photo",
        sourceId: "photo_1",
        visibility: "shared_with_service_provider",
      },
      {
        evidenceId: "evi_private",
        homeId: "home_123",
        kind: "receipt",
        sourceId: "receipt_1",
        visibility: "private_owner_only",
      },
      {
        evidenceId: "evi_unrelated",
        homeId: "home_123",
        kind: "invoice",
        sourceId: "invoice_2",
        visibility: "shared_with_service_provider",
      },
    ];
    const providerView = getProviderVisibleHomeContext({ packet, allEvidence });
    expect(providerView.evidence.map((e) => e.evidenceId)).toContain("evi_shared");
    expect(providerView.evidence.map((e) => e.evidenceId)).not.toContain("evi_private");
    expect(providerView.evidence.map((e) => e.evidenceId)).not.toContain("evi_unrelated");
  });

  it("completed provider job can propose HomeID event update with provider/date/cost/evidence", () => {
    const proposedEvent = proposeCompletedJobEvent({
      homeId: "home_123",
      providerId: "biz_9",
      occurredAt: "2026-05-28T00:00:00.000Z",
      amount: 1200,
      evidenceIds: ["evi_invoice_1", "evi_photo_after_1"],
    });
    expect(proposedEvent.eventType).toBe("service_completed");
    expect(proposedEvent.verificationStatus).toBe("proposed");
    expect(proposedEvent.providerId).toBe("biz_9");
    expect(proposedEvent.amount).toBe(1200);
    expect(proposedEvent.evidenceIds).toContain("evi_invoice_1");
  });

  it("buyer packet can include remediated findings and transfer-safe maintenance records", () => {
    const findings: InspectionFinding[] = [
      {
        findingId: "finding_termite_1",
        homeId: "home_123",
        componentId: "cmp_crawlspace",
        severity: "high",
        status: "remediated",
        summary: "Termite activity found in crawlspace",
        evidenceIds: ["evi_report_1", "evi_treatment_1"],
      },
      {
        findingId: "finding_minor_1",
        homeId: "home_123",
        componentId: "cmp_roof",
        severity: "low",
        status: "open",
        summary: "Minor wear",
        evidenceIds: ["evi_roof_1"],
      },
    ];
    const evidence: HomeEvidence[] = [
      {
        evidenceId: "evi_treatment_1",
        homeId: "home_123",
        kind: "invoice",
        sourceId: "invoice_1",
        visibility: "transfers_with_home",
      },
      {
        evidenceId: "evi_private_1",
        homeId: "home_123",
        kind: "receipt",
        sourceId: "receipt_1",
        visibility: "private_owner_only",
      },
      {
        evidenceId: "evi_warranty_1",
        homeId: "home_123",
        kind: "warranty",
        sourceId: "warranty_1",
        visibility: "buyer_packet",
      },
    ];
    const buyerPacket = buildBuyerPacket({ findings, evidence });
    expect(buyerPacket.remediatedFindingIds).toContain("finding_termite_1");
    expect(buyerPacket.remediatedFindingIds).not.toContain("finding_minor_1");
    expect(buyerPacket.evidenceIds).toContain("evi_treatment_1");
    expect(buyerPacket.evidenceIds).toContain("evi_warranty_1");
    expect(buyerPacket.evidenceIds).not.toContain("evi_private_1");
  });
});
