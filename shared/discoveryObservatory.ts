/**
 * Shared TradeScout discovery-observatory contract.
 *
 * Meanings are deliberately narrow:
 * - observation: an independently recorded result on an outside surface
 * - entry: an actual TradeScout landing (the existing discovery_landing event)
 * - action: a deliberate customer attempt recorded by the server
 * - outcome: provider response or requester-confirmed completion, never inferred from an action
 * - experiment: a predeclared assignment plus exactly one controlled change
 */

export const DISCOVERY_OBSERVATION_EVENT = "discovery_observation" as const;
export const DISCOVERY_ACTION_EVENT = "discovery_action" as const;
export const DISCOVERY_DELIVERY_EVENT = "discovery_delivery" as const;
export const DISCOVERY_OUTCOME_EVENT = "discovery_outcome" as const;
export const DISCOVERY_INTERNAL_SEARCH_EVENT = "discovery_internal_search" as const;
export const DISCOVERY_EXPERIMENT_STATE_EVENT = "discovery_experiment_state" as const;
export const DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT = "discovery_experiment_assignment" as const;

export const DISCOVERY_OBSERVATORY_EVENT_TYPES = [
  DISCOVERY_OBSERVATION_EVENT,
  "discovery_landing",
  DISCOVERY_ACTION_EVENT,
  DISCOVERY_DELIVERY_EVENT,
  DISCOVERY_OUTCOME_EVENT,
  DISCOVERY_INTERNAL_SEARCH_EVENT,
  DISCOVERY_EXPERIMENT_STATE_EVENT,
  DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
] as const;

export type DiscoveryEvidenceStrength =
  | "direct_server_observed"
  | "client_correlated_unverified"
  | "unknown_unavailable";

export type DiscoveryEntryLinkage =
  | "server_observed_match"
  | "client_correlated_unverified"
  | "unknown_unavailable";

export type DiscoveryTimestampPrecision = "day" | "instant";

export type DiscoveryEntityRef = {
  type: "business" | "profile" | "market_page" | "platform";
  id?: string;
  slug?: string;
};

export type DiscoveryObservation = {
  type: typeof DISCOVERY_OBSERVATION_EVENT;
  observationId: string;
  observedAt: string;
  observedAtPrecision: DiscoveryTimestampPrecision;
  recordedAt: string;
  sourceFreshUntil: string;
  sourceFreshUntilPrecision: DiscoveryTimestampPrecision;
  source: string;
  surface: string;
  query: string | null;
  queryEvidenceState: "known" | "unknown" | "unavailable";
  resultState: "observed" | "not_observed" | "unavailable";
  entity: DiscoveryEntityRef;
  citedUrl?: string;
  rank?: number;
  location: string | null;
  device: string | null;
  provenance: {
    method: "operator_manual" | "permitted_web_search" | "connected_source";
    collector: string;
    evidenceRef?: string;
  };
  outsideEntity?: {
    name: string;
    relationship: "competitor" | "other" | "unknown";
  };
  causalInference: "none";
};

export type DiscoveryQualityRow = {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  createdAt: string | Date;
};

export type DiscoveryQualityIssue = {
  code:
    | "duplicate_record_id"
    | "future_timestamp"
    | "missing_journey_reference"
    | "missing_entity_reference"
    | "orphan_outcome"
    | "missing_source_freshness"
    | "missing_timestamp_precision"
    | "duplicate_observation_identity"
    | "event_before_action"
    | "duplicate_experiment_assignment"
    | "event_before_experiment_assignment";
  recordId: string;
  detail: string;
};

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_SOURCE_FRESHNESS_MS = 180 * 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanIdentifier(raw: unknown): string | null {
  const value = cleanText(raw, 128);
  return IDENTIFIER_PATTERN.test(value) ? value : null;
}

function cleanSlug(raw: unknown): string | null {
  const value = cleanText(raw, 128).toLowerCase();
  return SLUG_PATTERN.test(value) ? value : null;
}

function cleanIso(raw: unknown, now: Date): string | null {
  const value = cleanText(raw, 40);
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return null;
  return parsed.toISOString();
}

type NormalizedEvidenceTimestamp = {
  value: string;
  precision: DiscoveryTimestampPrecision;
  startMs: number;
  endMs: number;
};

function normalizeEvidenceTimestamp(
  raw: unknown,
  precisionRaw: unknown,
  now: Date,
  allowFuture: boolean
): NormalizedEvidenceTimestamp | null {
  const value = cleanText(raw, 40);
  const precision = cleanText(precisionRaw, 16);
  if (precision === "day") {
    if (!DAY_PATTERN.test(value)) return null;
    const startMs = Date.parse(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(startMs) ||
      new Date(startMs).toISOString().slice(0, 10) !== value ||
      (!allowFuture && value > now.toISOString().slice(0, 10))
    ) {
      return null;
    }
    return {
      value,
      precision,
      startMs,
      endMs: startMs + 24 * 60 * 60 * 1000 - 1,
    };
  }

  if (precision !== "instant" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = new Date(value);
  const milliseconds = parsed.getTime();
  if (
    Number.isNaN(milliseconds) ||
    (!allowFuture && milliseconds > now.getTime() + FUTURE_TOLERANCE_MS)
  ) {
    return null;
  }
  return {
    value: parsed.toISOString(),
    precision,
    startMs: milliseconds,
    endMs: milliseconds,
  };
}

function safeHttpUrl(raw: unknown): string | undefined {
  const value = cleanText(raw, 500);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeEntity(raw: unknown): DiscoveryEntityRef | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const type = cleanText(record.type, 32);
  if (!["business", "profile", "market_page", "platform"].includes(type)) return null;
  const id = cleanIdentifier(record.id);
  const slug = cleanSlug(record.slug);
  if (type !== "platform" && !id && !slug) return null;
  return {
    type: type as DiscoveryEntityRef["type"],
    ...(id ? { id } : {}),
    ...(slug ? { slug } : {}),
  };
}

/** Reject likely private contact details before a search term reaches analytics. */
export function sanitizeDiscoveryQuery(raw: unknown): string | null {
  const value = cleanText(raw, 160);
  if (!value || value.length < 2) return null;
  if (/^(?:unknown|unavailable|n\/?a|none)$/i.test(value)) return null;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return null;
  if (/(?:https?:\/\/|www\.)/i.test(value)) return null;
  if (/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(value)) return null;
  return value;
}

export function sanitizeDiscoveryObservation(
  raw: unknown,
  options: { observationId: string; recordedAt?: Date; now?: Date }
): DiscoveryObservation | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const now = options.now ?? new Date();
  const recordedAtDate = options.recordedAt ?? now;
  const observationId = cleanIdentifier(options.observationId);
  const observedAt = normalizeEvidenceTimestamp(
    input.observedAt,
    input.observedAtPrecision,
    now,
    false
  );
  const sourceFreshUntil = normalizeEvidenceTimestamp(
    input.sourceFreshUntil,
    input.sourceFreshUntilPrecision,
    now,
    true
  );
  const source = cleanText(input.source, 80);
  const surface = cleanText(input.surface, 80);
  const queryEvidenceState = cleanText(input.queryEvidenceState, 24);
  const query = sanitizeDiscoveryQuery(input.query);
  const resultState = cleanText(input.resultState, 32);
  const entity = sanitizeEntity(input.entity);
  const location = input.location == null ? null : cleanText(input.location, 120) || null;
  const device = input.device == null ? null : cleanText(input.device, 80) || null;
  const provenanceRaw =
    input.provenance && typeof input.provenance === "object"
      ? (input.provenance as Record<string, unknown>)
      : {};
  const method = cleanText(provenanceRaw.method, 40);
  const collector = cleanText(provenanceRaw.collector, 80);
  const outsideEntityRaw =
    input.outsideEntity && typeof input.outsideEntity === "object"
      ? (input.outsideEntity as Record<string, unknown>)
      : null;
  const outsideEntityName = cleanText(outsideEntityRaw?.name, 120);
  const outsideEntityRelationship = cleanText(outsideEntityRaw?.relationship, 20);

  if (
    !observationId ||
    !observedAt ||
    !sourceFreshUntil ||
    sourceFreshUntil.endMs < observedAt.startMs ||
    sourceFreshUntil.startMs - observedAt.startMs > MAX_SOURCE_FRESHNESS_MS ||
    !source ||
    !surface ||
    !["known", "unknown", "unavailable"].includes(queryEvidenceState) ||
    (queryEvidenceState === "known" && !query) ||
    (queryEvidenceState !== "known" && query !== null) ||
    !entity ||
    !["observed", "not_observed", "unavailable"].includes(resultState) ||
    !["operator_manual", "permitted_web_search", "connected_source"].includes(method) ||
    !collector
  ) {
    return null;
  }

  const rankValue = Number(input.rank);
  const rank = Number.isInteger(rankValue) && rankValue > 0 && rankValue <= 100 ? rankValue : null;
  return {
    type: DISCOVERY_OBSERVATION_EVENT,
    observationId,
    observedAt: observedAt.value,
    observedAtPrecision: observedAt.precision,
    recordedAt: recordedAtDate.toISOString(),
    sourceFreshUntil: sourceFreshUntil.value,
    sourceFreshUntilPrecision: sourceFreshUntil.precision,
    source,
    surface,
    query: queryEvidenceState === "known" ? query : null,
    queryEvidenceState: queryEvidenceState as DiscoveryObservation["queryEvidenceState"],
    resultState: resultState as DiscoveryObservation["resultState"],
    entity,
    ...(safeHttpUrl(input.citedUrl) ? { citedUrl: safeHttpUrl(input.citedUrl) } : {}),
    ...(rank ? { rank } : {}),
    location,
    device,
    provenance: {
      method: method as DiscoveryObservation["provenance"]["method"],
      collector,
      ...(cleanText(provenanceRaw.evidenceRef, 200)
        ? { evidenceRef: cleanText(provenanceRaw.evidenceRef, 200) }
        : {}),
    },
    ...(outsideEntityName && ["competitor", "other", "unknown"].includes(outsideEntityRelationship)
      ? {
          outsideEntity: {
            name: outsideEntityName,
            relationship: outsideEntityRelationship as "competitor" | "other" | "unknown",
          },
        }
      : {}),
    causalInference: "none",
  };
}

export function sanitizeDiscoveryInternalSearch(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  if (input.type !== DISCOVERY_INTERNAL_SEARCH_EVENT) return null;
  const query = sanitizeDiscoveryQuery(input.query);
  const stateCode = cleanText(input.stateCode, 2).toUpperCase();
  const countyFips = cleanText(input.countyFips, 5);
  const tradeSlug = cleanSlug(input.tradeSlug);
  const resultCount = Number(input.resultCount);
  if (!query || !Number.isInteger(resultCount) || resultCount < 0 || resultCount > 1000)
    return null;
  if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) return null;
  if (countyFips && !/^\d{5}$/.test(countyFips)) return null;
  const observedAt = cleanIso(input.observedAt, new Date());
  if (!observedAt) return null;
  return {
    type: DISCOVERY_INTERNAL_SEARCH_EVENT,
    query,
    resultCount,
    observedAt,
    ...(stateCode ? { stateCode } : {}),
    ...(countyFips ? { countyFips } : {}),
    ...(tradeSlug ? { tradeSlug } : {}),
    source: "direct_connect_directory",
  };
}

function eventTime(row: DiscoveryQualityRow): Date {
  const candidate = String(
    row.data.occurredAt || row.data.observedAt || row.data.assignedAt || row.createdAt || ""
  );
  return new Date(candidate);
}

function entityKey(data: Record<string, unknown>): string {
  const entity =
    data.entity && typeof data.entity === "object"
      ? (data.entity as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return cleanText(data.entityKey || entity.id || entity.slug, 160);
}

/**
 * Pure data-quality verifier used by both the dashboard and disposable proof.
 * It operates on independent event rows; no SQL joins means counts cannot be multiplied.
 */
export function validateDiscoveryRecords(
  rows: DiscoveryQualityRow[],
  now: Date = new Date()
): DiscoveryQualityIssue[] {
  const issues: DiscoveryQualityIssue[] = [];
  const ids = new Set<string>();
  const observationIds = new Set<string>();
  const actionTimes = new Map<string, Date>();
  const assignmentTimes = new Map<string, Date>();

  for (const row of rows) {
    if (ids.has(row.id)) {
      issues.push({
        code: "duplicate_record_id",
        recordId: row.id,
        detail: "Record id appeared more than once in the observatory input.",
      });
    }
    ids.add(row.id);

    const time = eventTime(row);
    if (!Number.isNaN(time.getTime()) && time.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      issues.push({
        code: "future_timestamp",
        recordId: row.id,
        detail: "Event timestamp is more than five minutes in the future.",
      });
    }

    if (row.eventType === DISCOVERY_OBSERVATION_EVENT && !row.data.sourceFreshUntil) {
      issues.push({
        code: "missing_source_freshness",
        recordId: row.id,
        detail: "Outside observations must declare when their source should be refreshed.",
      });
    }
    if (row.eventType === DISCOVERY_OBSERVATION_EVENT) {
      const observationId = cleanIdentifier(row.data.observationId);
      if (observationId) {
        if (observationIds.has(observationId)) {
          issues.push({
            code: "duplicate_observation_identity",
            recordId: row.id,
            detail: "Repeated normalized observation identity is collapsed from observatory rates.",
          });
        }
        observationIds.add(observationId);
      }
    }
    if (
      row.eventType === DISCOVERY_OBSERVATION_EVENT &&
      (!(["day", "instant"] as unknown[]).includes(row.data.observedAtPrecision) ||
        !(["day", "instant"] as unknown[]).includes(row.data.sourceFreshUntilPrecision))
    ) {
      issues.push({
        code: "missing_timestamp_precision",
        recordId: row.id,
        detail: "Outside observations must declare day or instant precision for both timestamps.",
      });
    }

    if (
      [DISCOVERY_ACTION_EVENT, DISCOVERY_DELIVERY_EVENT, DISCOVERY_OUTCOME_EVENT].includes(
        row.eventType as any
      )
    ) {
      if (!cleanIdentifier(row.data.journeyId)) {
        issues.push({
          code: "missing_journey_reference",
          recordId: row.id,
          detail: "Journey events require a stable journeyId.",
        });
      }
      if (!entityKey(row.data)) {
        issues.push({
          code: "missing_entity_reference",
          recordId: row.id,
          detail: "Journey events require an entity id or slug.",
        });
      }
    }

    if (row.eventType === DISCOVERY_ACTION_EVENT) {
      const requestId = cleanIdentifier(row.data.workRequestId);
      if (requestId && !Number.isNaN(time.getTime())) {
        const previous = actionTimes.get(requestId);
        if (!previous || time.getTime() < previous.getTime()) actionTimes.set(requestId, time);
      }
    }

    if (row.eventType === DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT) {
      const experimentId = cleanIdentifier(row.data.experimentId);
      const key = entityKey(row.data);
      if (experimentId && key) {
        const assignmentKey = `${experimentId}|${key}`;
        if (assignmentTimes.has(assignmentKey)) {
          issues.push({
            code: "duplicate_experiment_assignment",
            recordId: row.id,
            detail: "An entity may be assigned to an experiment only once.",
          });
        } else {
          assignmentTimes.set(assignmentKey, time);
        }
      }
    }
  }

  for (const row of rows) {
    if ([DISCOVERY_DELIVERY_EVENT, DISCOVERY_OUTCOME_EVENT].includes(row.eventType as any)) {
      const requestId = cleanIdentifier(row.data.workRequestId);
      const actionTime = requestId ? actionTimes.get(requestId) : undefined;
      if (!requestId || !actionTime) {
        issues.push({
          code: "orphan_outcome",
          recordId: row.id,
          detail: "Delivery/outcome has no request action with the same workRequestId in scope.",
        });
      } else {
        const time = eventTime(row);
        if (Number.isNaN(time.getTime()) || time.getTime() < actionTime.getTime()) {
          issues.push({
            code: "event_before_action",
            recordId: row.id,
            detail: "Delivery/outcome timestamp must be at or after its request action.",
          });
        }
      }
    }

    const experimentId = cleanIdentifier(row.data.experimentId);
    const key = entityKey(row.data);
    if (
      experimentId &&
      key &&
      row.eventType !== DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT &&
      row.eventType !== DISCOVERY_EXPERIMENT_STATE_EVENT
    ) {
      const assignmentTime = assignmentTimes.get(`${experimentId}|${key}`);
      const time = eventTime(row);
      if (!assignmentTime || assignmentTime.getTime() > time.getTime()) {
        issues.push({
          code: "event_before_experiment_assignment",
          recordId: row.id,
          detail: "Attributed events require a predeclared assignment at or before the event.",
        });
      }
    }
  }

  return issues;
}

export type DiscoveryExperimentDefinition = {
  rank: 1 | 2 | 3;
  experimentId: string;
  exactQuestion: string;
  currentBaseline: string;
  oneControlledChange: string;
  target: string;
  intendedCustomerAction: string;
  ownerAction: string;
  period: string;
  success: string;
  failure: string;
  rollback: string;
  evidenceBoundary: string;
  state: "proposed";
};

export const DISCOVERY_WAVE_1_EXPERIMENTS: DiscoveryExperimentDefinition[] = [
  {
    rank: 1,
    experimentId: "wave1-non-jw-transfer-jrs",
    exactQuestion:
      "Does one owner-approved, fact-bearing JR's Auto Glass profile improvement produce an independently observed exact-brand TradeScout result and a server-observed entry?",
    currentBaseline:
      "Computed from current stored outside observations; unavailable until a fresh non-JW exact-brand observation exists.",
    oneControlledChange:
      "Add one owner-approved fact-bearing SSR discovery block to the existing JR's Auto Glass profile; preserve routing, contact gating, and design.",
    target: "business:jrs-auto-glass",
    intendedCustomerAction:
      "Enter the JR's Auto Glass profile and submit its existing Direct Connect request.",
    ownerAction: "Owner reviews the proposed facts and explicitly approves or rejects publication.",
    period:
      "28 days after a separately approved publication, with weekly independent observations.",
    success:
      "At least one independently recorded observed result plus at least one same-business server entry; request and response remain reported separately.",
    failure:
      "No observed result or the page loses semantic/canonical parity, contains unapproved facts, or weakens contact gating.",
    rollback:
      "Remove only the controlled discovery block and keep the existing profile and buyer path.",
    evidenceBoundary:
      "Assignment does not prove ranking causation; location/device gaps and unavailable external consoles remain unknown.",
    state: "proposed",
  },
  {
    rank: 2,
    experimentId: "wave1-eligible-weak-market-page",
    exactQuestion:
      "Can one eligible but weak market page answer a real service-and-location query without creating a duplicate or thin page?",
    currentBaseline:
      "Select the highest-demand eligible-weak page from current snapshot data; baseline is unavailable until a predeclared target is chosen.",
    oneControlledChange:
      "Add one verified local fact module to one eligible page; do not add pages or alter eligibility/ranking rules.",
    target: "market_page:predeclare-from-current-snapshot",
    intendedCustomerAction:
      "Open one eligible business from the market page and start its existing request flow.",
    ownerAction:
      "Operator selects one eligible page and records the source and approval for every displayed fact.",
    period:
      "28 days after separate approval, compared with its prechange observation and entry baseline.",
    success:
      "Page remains unique, indexable, fact-bearing, and receives independently observed reach or qualified entry improvement.",
    failure:
      "Duplicate/thin classification, stale facts, indexability regression, or no qualified evidence improvement.",
    rollback: "Remove the single fact module; retain the eligible page and publication rules.",
    evidenceBoundary:
      "Crawler counts are supporting telemetry and cannot substitute for independent reach or downstream outcomes.",
    state: "proposed",
  },
  {
    rank: 3,
    experimentId: "wave1-zero-result-language",
    exactQuestion:
      "Does mapping one repeated zero-result customer phrase to an existing verified trade improve useful directory results?",
    currentBaseline:
      "Use the top privacy-safe zero-result query from current internal-search events; unavailable until enough current queries exist.",
    oneControlledChange:
      "Add one synonym mapping for one predeclared phrase to one existing trade; do not change provider eligibility or ordering.",
    target: "internal_query:predeclare-from-current-zero-results",
    intendedCustomerAction:
      "Open one relevant existing provider result and start its existing request flow.",
    ownerAction: "Operator verifies the phrase intent and target trade before assignment.",
    period: "14 days after separate approval, compared with the prior 14-day query baseline.",
    success:
      "Zero-result rate falls for the assigned phrase without increasing irrelevant-result review flags.",
    failure: "Results remain empty, become irrelevant, or leak private query content.",
    rollback: "Remove the single synonym mapping.",
    evidenceBoundary:
      "Search result count is an entry aid, not evidence of provider response or completed work.",
    state: "proposed",
  },
];
