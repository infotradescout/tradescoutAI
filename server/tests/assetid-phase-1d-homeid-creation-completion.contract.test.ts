import { describe, expect, it } from "vitest";

type HomeType =
  | "single_family"
  | "townhome"
  | "condo"
  | "duplex"
  | "triplex_fourplex"
  | "multi_family"
  | "manufactured_home"
  | "mobile_home"
  | "new_build"
  | "land_lot"
  | "commercial_residential_mixed"
  | "rental_unit"
  | "other";

type CreatorRole =
  | "homeowner"
  | "builder"
  | "realtor"
  | "property_manager"
  | "admin"
  | "homescout_sale_flow";

type HomeAuthorityRole =
  | "owner"
  | "pending_owner"
  | "builder_of_record"
  | "agent_delegate"
  | "property_manager"
  | "admin";

type AuthorityStatus = "active" | "closed";

type HomeIdAuthority = {
  subjectId: string;
  role: HomeAuthorityRole;
  status: AuthorityStatus;
};

type HomeIdRecord = {
  homeId: string;
  homeType: HomeType;
  creatorRole: CreatorRole;
  authorities: HomeIdAuthority[];
};

type CompletionSection =
  | "identity"
  | "authority"
  | "coreFacts"
  | "systems"
  | "maintenance"
  | "evidence"
  | "visibility"
  | "transfer";

type CompletionProgress = Record<CompletionSection, boolean>;

type RequestPrompt = {
  promptType: "request_service" | "add_record" | "upload_evidence";
  reason: string;
  suggestedIntent: "inspect" | "maintain" | "repair" | "remediate" | "document";
};

type LinkedRequestPacket = {
  homeId: string;
  selectedFieldKeys: string[];
};

type ProposedEvidenceUpdate = {
  homeId: string;
  sourceRequestId: string;
  verificationStatus: "proposed" | "verified";
  fillsSections: CompletionSection[];
};

const SECTION_WEIGHTS: Record<CompletionSection, number> = {
  identity: 15,
  authority: 15,
  coreFacts: 15,
  systems: 15,
  maintenance: 10,
  evidence: 10,
  visibility: 10,
  transfer: 10,
};

const REQUIRED_BY_HOME_TYPE: Record<HomeType, string[]> = {
  single_family: ["roof", "hvac", "water_heater", "foundation", "permits", "appliances"],
  townhome: ["roof", "hvac", "water_heater", "hoa_docs", "appliances"],
  condo: ["hoa_docs", "unit_systems", "shared_systems", "insurance_docs", "appliances"],
  duplex: ["roof", "hvac", "water_heater", "electrical_panel", "permits"],
  triplex_fourplex: ["roof", "hvac", "water_heater", "electrical_panel", "permits"],
  multi_family: ["roof", "hvac", "water_heater", "electrical_panel", "permits"],
  manufactured_home: ["vin_or_serial", "title_docs", "lot_land_relationship", "tie_downs"],
  mobile_home: ["vin_or_serial", "title_docs", "lot_land_relationship", "skirting", "tie_downs"],
  new_build: ["builder_record", "permits", "warranties", "subcontractors", "inspection_milestones"],
  land_lot: ["parcel_apn", "county_context", "zoning_context"],
  commercial_residential_mixed: ["permits", "inspection_milestones", "occupancy_docs"],
  rental_unit: ["property_manager_authority", "tenant_safe_visibility", "service_history"],
  other: ["custom_core_facts"],
};

function createHomeId(args: {
  homeId: string;
  homeType?: HomeType;
  creatorRole: CreatorRole;
  creatorSubjectId: string;
}): HomeIdRecord {
  if (!args.homeType) throw new Error("homeType required");

  const roleFromCreator: Record<CreatorRole, HomeAuthorityRole> = {
    homeowner: "pending_owner",
    builder: "builder_of_record",
    realtor: "agent_delegate",
    property_manager: "property_manager",
    admin: "admin",
    homescout_sale_flow: "pending_owner",
  };

  return {
    homeId: args.homeId,
    homeType: args.homeType,
    creatorRole: args.creatorRole,
    authorities: [
      {
        subjectId: args.creatorSubjectId,
        role: roleFromCreator[args.creatorRole],
        status: "active",
      },
    ],
  };
}

function requiredChecklistForHomeType(homeType: HomeType) {
  return REQUIRED_BY_HOME_TYPE[homeType];
}

function completionScore(progress: CompletionProgress) {
  return (Object.keys(SECTION_WEIGHTS) as CompletionSection[]).reduce((sum, key) => {
    return sum + (progress[key] ? SECTION_WEIGHTS[key] : 0);
  }, 0);
}

function isTransferReady(progress: CompletionProgress) {
  return completionScore(progress) === 100;
}

function isBuilderHandoffReady(args: {
  progress: CompletionProgress;
  authorities: HomeIdAuthority[];
}) {
  const hasBuilder = args.authorities.some(
    (a) => a.role === "builder_of_record" && a.status === "active"
  );
  const hasOwner = args.authorities.some((a) => a.role === "owner" && a.status === "active");
  return hasBuilder && !hasOwner && isTransferReady(args.progress);
}

function isListingReady(args: { progress: CompletionProgress; authorities: HomeIdAuthority[] }) {
  const hasDelegate = args.authorities.some(
    (a) => (a.role === "agent_delegate" || a.role === "property_manager") && a.status === "active"
  );
  const hasPermanentOwner = args.authorities.some(
    (a) => a.role === "owner" && a.status === "active"
  );
  return hasDelegate && !hasPermanentOwner && completionScore(args.progress) >= 50;
}

function createRequestPromptForIncompleteItem(item: string): RequestPrompt {
  if (item.includes("service") || item.includes("inspection") || item.includes("remediation")) {
    return {
      promptType: "request_service",
      reason: `${item} is incomplete`,
      suggestedIntent: item.includes("inspection") ? "inspect" : "maintain",
    };
  }
  if (item.includes("warranty") || item.includes("receipt") || item.includes("permit")) {
    return {
      promptType: "upload_evidence",
      reason: `${item} evidence is missing`,
      suggestedIntent: "document",
    };
  }
  return {
    promptType: "add_record",
    reason: `${item} record is missing`,
    suggestedIntent: "document",
  };
}

function createLinkedRequestPacket(args: {
  homeId: string;
  selectedFieldKeys: string[];
  allHomeFieldKeys: string[];
}): LinkedRequestPacket {
  const allowedKeys = args.selectedFieldKeys.filter((k) => args.allHomeFieldKeys.includes(k));
  return { homeId: args.homeId, selectedFieldKeys: allowedKeys };
}

function proposeEvidenceUpdateFromCompletedRequest(args: {
  homeId: string;
  sourceRequestId: string;
  fillsSections: CompletionSection[];
}): ProposedEvidenceUpdate {
  return {
    homeId: args.homeId,
    sourceRequestId: args.sourceRequestId,
    verificationStatus: "proposed",
    fillsSections: args.fillsSections,
  };
}

function buyerPacketReadiness(args: {
  transferSectionComplete: boolean;
  visibilitySectionComplete: boolean;
  privateOwnerOnlyShared: boolean;
}) {
  if (!args.transferSectionComplete || !args.visibilitySectionComplete) return false;
  return !args.privateOwnerOnlyShared;
}

describe("AssetID Phase 1D HomeID creation and completion contracts", () => {
  it("1) HomeID creation requires home type", () => {
    expect(() =>
      createHomeId({
        homeId: "home_123",
        creatorRole: "homeowner",
        creatorSubjectId: "user_1",
      })
    ).toThrow("homeType required");

    const homeId = createHomeId({
      homeId: "home_123",
      homeType: "single_family",
      creatorRole: "homeowner",
      creatorSubjectId: "user_1",
    });
    expect(homeId.homeType).toBe("single_family");
  });

  it("2) Home type determines required completion checklist", () => {
    const singleFamily = requiredChecklistForHomeType("single_family");
    const condo = requiredChecklistForHomeType("condo");
    const newBuild = requiredChecklistForHomeType("new_build");

    expect(singleFamily).toContain("roof");
    expect(singleFamily).toContain("hvac");
    expect(condo).toContain("hoa_docs");
    expect(condo).toContain("shared_systems");
    expect(newBuild).toContain("builder_record");
    expect(newBuild).toContain("inspection_milestones");
  });

  it("3) completion score reaches 100 only when all required sections are satisfied", () => {
    const partial: CompletionProgress = {
      identity: true,
      authority: true,
      coreFacts: true,
      systems: true,
      maintenance: true,
      evidence: true,
      visibility: true,
      transfer: false,
    };
    const complete: CompletionProgress = {
      identity: true,
      authority: true,
      coreFacts: true,
      systems: true,
      maintenance: true,
      evidence: true,
      visibility: true,
      transfer: true,
    };
    expect(completionScore(partial)).toBe(90);
    expect(isTransferReady(partial)).toBe(false);
    expect(completionScore(complete)).toBe(100);
    expect(isTransferReady(complete)).toBe(true);
  });

  it("4) builder-created HomeID can become handoff-ready before homeowner claim", () => {
    const progress: CompletionProgress = {
      identity: true,
      authority: true,
      coreFacts: true,
      systems: true,
      maintenance: true,
      evidence: true,
      visibility: true,
      transfer: true,
    };
    const home = createHomeId({
      homeId: "home_123",
      homeType: "new_build",
      creatorRole: "builder",
      creatorSubjectId: "builder_1",
    });
    expect(isBuilderHandoffReady({ progress, authorities: home.authorities })).toBe(true);
  });

  it("5) realtor/property-manager-created HomeID can be listing-ready without permanent ownership authority", () => {
    const progress: CompletionProgress = {
      identity: true,
      authority: true,
      coreFacts: true,
      systems: true,
      maintenance: true,
      evidence: false,
      visibility: true,
      transfer: false,
    };
    const realtorHome = createHomeId({
      homeId: "home_realtor_1",
      homeType: "single_family",
      creatorRole: "realtor",
      creatorSubjectId: "agent_1",
    });
    const pmHome = createHomeId({
      homeId: "home_pm_1",
      homeType: "rental_unit",
      creatorRole: "property_manager",
      creatorSubjectId: "pm_1",
    });
    expect(isListingReady({ progress, authorities: realtorHome.authorities })).toBe(true);
    expect(isListingReady({ progress, authorities: pmHome.authorities })).toBe(true);
  });

  it("6) incomplete components can generate Direct Connect request prompts", () => {
    const waterHeaterMissingService = createRequestPromptForIncompleteItem("water_heater_service");
    const roofAgeUnknown = createRequestPromptForIncompleteItem("roof_inspection");
    const hvacWarrantyMissing = createRequestPromptForIncompleteItem("hvac_warranty");

    expect(waterHeaterMissingService.promptType).toBe("request_service");
    expect(roofAgeUnknown.suggestedIntent).toBe("inspect");
    expect(hvacWarrantyMissing.promptType).toBe("upload_evidence");
  });

  it("7) linked request context packet uses only selected HomeID fields", () => {
    const packet = createLinkedRequestPacket({
      homeId: "home_123",
      selectedFieldKeys: ["roof_age", "hvac_serial", "private_notes", "unknown_field"],
      allHomeFieldKeys: ["roof_age", "hvac_serial", "private_notes", "hoa_docs"],
    });
    expect(packet.selectedFieldKeys).toEqual(["roof_age", "hvac_serial", "private_notes"]);
    expect(packet.selectedFieldKeys).not.toContain("hoa_docs");
    expect(packet.selectedFieldKeys).not.toContain("unknown_field");
  });

  it("8) completed request can increase completion by proposing verified evidence", () => {
    const before: CompletionProgress = {
      identity: true,
      authority: true,
      coreFacts: true,
      systems: true,
      maintenance: false,
      evidence: false,
      visibility: true,
      transfer: false,
    };
    const proposal = proposeEvidenceUpdateFromCompletedRequest({
      homeId: "home_123",
      sourceRequestId: "dc_req_1",
      fillsSections: ["maintenance", "evidence"],
    });
    const after: CompletionProgress = {
      ...before,
      maintenance: true,
      evidence: true,
    };

    expect(proposal.verificationStatus).toBe("proposed");
    expect(completionScore(before)).toBe(70);
    expect(completionScore(after)).toBe(90);
  });

  it("9) private owner-only data does not count toward buyer packet readiness unless explicitly shared", () => {
    const notReady = buyerPacketReadiness({
      transferSectionComplete: true,
      visibilitySectionComplete: true,
      privateOwnerOnlyShared: true,
    });
    const ready = buyerPacketReadiness({
      transferSectionComplete: true,
      visibilitySectionComplete: true,
      privateOwnerOnlyShared: false,
    });
    expect(notReady).toBe(false);
    expect(ready).toBe(true);
  });
});
