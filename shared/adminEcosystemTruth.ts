export type EcosystemTruthState = "confirmed" | "attention" | "unknown" | "unavailable";

export type EcosystemTruthOwner = {
  id: string;
  label: string;
  owns: string;
  authority: string;
  workspacePath: string;
  state: EcosystemTruthState;
  summary: string;
  counts: Record<string, number | string | null>;
  findings: string[];
};

export type DecisionSource = {
  id: string;
  label: string;
  scope: string;
  authority: "governing_source" | "audit_evidence" | "operational_only";
  workspacePath: string | null;
};

export type DecisionProvenanceItem = {
  id: string;
  source: string;
  title: string;
  domain: string;
  decision: string;
  sourceReference: string;
  decidedAt: string | null;
  authority: "operational_only";
};

export type CommercialTermEvidenceState = "source_linked" | "partial" | "missing";

export type CommercialTermIndexItem = {
  id: string;
  domain: string;
  title: string;
  lifecycleStatus: string;
  recordedTerm: string;
  evidenceState: CommercialTermEvidenceState;
  effectiveAt: string | null;
  expiresAt: string | null;
  source: string;
  findings: string[];
};

export type OutcomeSourceCoverage = {
  id: string;
  label: string;
  authority: string;
  workspacePath: string;
  state: EcosystemTruthState;
  recordCount: number | null;
  linkedCount: number | null;
  unlinkedCount: number | null;
  latestAt: string | null;
  finding: string;
};

export type OutcomeTimelineItem = {
  id: string;
  sourceId: string;
  source: string;
  eventType: string;
  linkType: string | null;
  linkId: string | null;
  occurredAt: string | null;
  state: "linked" | "unlinked";
};

export type AdminEcosystemTruthReport = {
  generatedAt: string;
  revision: string | null;
  mode: "read_only";
  summary: {
    confirmedOwners: number;
    ownersNeedingAttention: number;
    decisionRecords: number | null;
    commercialRecordsNeedingEvidence: number | null;
    commercialConflicts: number | null;
    unlinkedOutcomeEvents: number | null;
  };
  owners: EcosystemTruthOwner[];
  decisionProvenance: {
    state: EcosystemTruthState;
    sources: DecisionSource[];
    items: DecisionProvenanceItem[];
    missingGovernanceFields: string[];
    findings: string[];
  };
  commercialTerms: {
    mode: "index_only";
    state: EcosystemTruthState;
    recordsReviewed: number | null;
    needsEvidence: number | null;
    conflicts: number | null;
    items: CommercialTermIndexItem[];
    findings: string[];
  };
  outcomeCoverage: {
    mode: "projection_only";
    state: EcosystemTruthState;
    sources: OutcomeSourceCoverage[];
    timeline: OutcomeTimelineItem[];
    findings: string[];
  };
  protections: string[];
};
