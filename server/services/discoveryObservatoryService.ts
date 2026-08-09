import { createHash, randomUUID } from "node:crypto";
import {
  DISCOVERY_ACTION_EVENT,
  DISCOVERY_DELIVERY_EVENT,
  DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
  DISCOVERY_EXPERIMENT_STATE_EVENT,
  DISCOVERY_INTERNAL_SEARCH_EVENT,
  DISCOVERY_OBSERVATION_EVENT,
  DISCOVERY_OUTCOME_EVENT,
  DISCOVERY_WAVE_1_EXPERIMENTS,
  sanitizeDiscoveryObservation,
  type DiscoveryEntityRef,
  type DiscoveryEntryLinkage,
  type DiscoveryEvidenceStrength,
  type DiscoveryObservation,
  type DiscoveryQualityRow,
  validateDiscoveryRecords,
} from "@shared/discoveryObservatory";

export type ObservatoryQueryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

export type DiscoveryEventWriter = (
  eventType: string,
  data: Record<string, unknown>
) => Promise<void>;

type DiscoveryJourneyContext = {
  journeyId: string;
  workRequestId: string;
  entity: DiscoveryEntityRef;
  entityKey: string;
  entryRequestId?: string;
  entryLinkage: DiscoveryEntryLinkage;
  actionOccurredAt: string;
};

type SourceState = {
  source: string;
  status: "current" | "unavailable";
  observedAt: string | null;
  ageSeconds: number | null;
  detail: string;
};

const ENTRY_LINK_MAX_LOOKBACK_DAYS = 30;
const ENTRY_LINK_MAX_LOOKBACK_MS = ENTRY_LINK_MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
const ENTITY_INTELLIGENCE_TEMPORARY_EXCEPTION = {
  id: "EXC-2026-08-09-001",
  owner: "TradeScout Platform Engineering",
  removalDate: "2026-09-30",
} as const;

function recordValue(raw: unknown): Record<string, any> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
}

function toIso(raw: unknown): string | null {
  const parsed = new Date(String(raw ?? ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function evidenceTimeMs(
  value: unknown,
  precision: unknown,
  boundary: "start" | "end" = "start"
): number | null {
  const text = String(value || "");
  if (precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const start = Date.parse(`${text}T00:00:00.000Z`);
    if (Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== text) return null;
    return boundary === "end" ? start + 24 * 60 * 60 * 1000 - 1 : start;
  }
  if (precision !== "instant") return null;
  const parsed = new Date(text).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function journeyEventTimeMs(row: DiscoveryQualityRow): number | null {
  const parsed = new Date(
    String(row.data.occurredAt || row.data.observedAt || row.data.assignedAt || row.createdAt || "")
  ).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function distinct(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function collapseRowsByIdentity(
  rows: DiscoveryQualityRow[],
  identity: (row: DiscoveryQualityRow) => string
): DiscoveryQualityRow[] {
  const unique = new Map<string, DiscoveryQualityRow>();
  for (const row of rows) {
    const key = identity(row);
    if (!unique.has(key)) unique.set(key, row);
  }
  return Array.from(unique.values());
}

function observationFingerprint(observation: DiscoveryObservation): string {
  const normalizedEvidence = {
    observedAt: observation.observedAt,
    observedAtPrecision: observation.observedAtPrecision,
    sourceFreshUntil: observation.sourceFreshUntil,
    sourceFreshUntilPrecision: observation.sourceFreshUntilPrecision,
    source: observation.source,
    surface: observation.surface,
    query: observation.query,
    queryEvidenceState: observation.queryEvidenceState,
    resultState: observation.resultState,
    entity: observation.entity,
    citedUrl: observation.citedUrl || null,
    rank: observation.rank || null,
    location: observation.location,
    device: observation.device,
    provenance: observation.provenance,
    outsideEntity: observation.outsideEntity || null,
    causalInference: observation.causalInference,
  };
  return createHash("sha256").update(JSON.stringify(normalizedEvidence)).digest("hex");
}

function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function entryLinkageStrength(linkage: DiscoveryEntryLinkage): DiscoveryEvidenceStrength {
  if (linkage === "server_observed_match") return "direct_server_observed";
  if (linkage === "client_correlated_unverified") return "client_correlated_unverified";
  return "unknown_unavailable";
}

export function classifyDiscoverySurface(row: Record<string, any>) {
  const profileData = recordValue(row.profile_data ?? row.profileData);
  const status = String(row.status || "unknown");
  const publicEnabled = row.public_discovery_enabled ?? row.publicDiscoveryEnabled;
  const description = String(profileData.description || row.headline || "").trim();
  const services = Array.isArray(profileData.services)
    ? profileData.services.filter((value: unknown) => String(value || "").trim()).length
    : 0;
  const updatedAt = new Date(String(row.updated_at ?? row.updatedAt ?? ""));
  const stale =
    !Number.isNaN(updatedAt.getTime()) &&
    updatedAt.getTime() < Date.now() - 180 * 24 * 60 * 60 * 1000;

  let classification:
    | "useful_eligible"
    | "eligible_weak"
    | "duplicate"
    | "stale"
    | "unsupported"
    | "thin_placeholder"
    | "private_prohibited" = "eligible_weak";
  let reason = "Public entity has some evidence but needs a stronger verified answer surface.";

  if (
    publicEnabled === false ||
    ["draft", "suspended", "archived", "private", "removed", "inactive", "unpublished"].includes(
      status
    )
  ) {
    classification = "private_prohibited";
    reason = "Not eligible for public discovery under current visibility or status.";
  } else if (row.duplicate_of) {
    classification = "duplicate";
    reason = "Canonical ownership points to another public surface.";
  } else if (stale) {
    classification = "stale";
    reason = "Public facts have not been refreshed within 180 days.";
  } else if (/\b(?:lorem ipsum|coming soon|placeholder|test business)\b/i.test(description)) {
    classification = "thin_placeholder";
    reason = "Content contains placeholder or coming-soon language.";
  } else if (!description && services === 0 && !row.headline) {
    classification = "thin_placeholder";
    reason = "No verified description, headline, or service list is available.";
  } else if (!profileData.category && services === 0) {
    classification = "unsupported";
    reason = "No service/category evidence supports a useful query answer.";
  } else if (description.length >= 80 && (services > 0 || row.headline)) {
    classification = "useful_eligible";
    reason = "Public, fact-bearing, and specific enough to answer a customer query.";
  }

  return {
    entityType: String(row.entity_type || row.entityType || "business"),
    entityId: String(row.id || ""),
    slug: String(row.slug || ""),
    name: String(row.name || row.display_name || row.displayName || row.slug || "Unknown"),
    classification,
    reason,
    updatedAt: toIso(row.updated_at ?? row.updatedAt),
  };
}

export function buildLivingDiscoveryQueries(surfaces: Array<Record<string, any>>) {
  const candidates: Array<Record<string, unknown>> = [];
  for (const row of surfaces) {
    const status = String(row.status || "").toLowerCase();
    if (
      row.public_discovery_enabled === false ||
      row.publicDiscoveryEnabled === false ||
      !["active", "published"].includes(status)
    ) {
      continue;
    }
    const data = recordValue(row.profile_data ?? row.profileData);
    const name = String(row.name || row.display_name || "").trim();
    const category = String(data.category || "").trim();
    const city = String(data.city || "").trim();
    const state = String(data.stateCode || data.state_code || "")
      .trim()
      .toUpperCase();
    const location = [city, state].filter(Boolean).join(", ");
    const services = Array.isArray(data.services)
      ? data.services
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (name) {
      candidates.push({
        query: `\"${name}\" TradeScout`,
        source: "current_public_entity",
        entitySlug: row.slug,
        intent: "exact_brand",
      });
    }
    if (category && location) {
      candidates.push({
        query: `${category} in ${location}`,
        source: "current_public_entity",
        entitySlug: row.slug,
        intent: "service_location",
      });
    }
    for (const service of services) {
      candidates.push({
        query: `Who can help with ${service}${location ? ` in ${location}` : ""}?`,
        source: "current_public_entity",
        entitySlug: row.slug,
        intent: "project_question",
      });
    }
  }

  const requirementQuestions = [
    {
      query: "What permit is required for residential work in Tangipahoa Parish?",
      source: "authoritative_local_requirement_question",
      authorityUrl: "https://tangipahoa.org/permits/",
      intent: "permit_requirement",
    },
    {
      query: "Which Tangipahoa Parish planning rules apply before a local project begins?",
      source: "authoritative_local_requirement_question",
      authorityUrl: "https://tangipahoa.org/government/planning/",
      intent: "planning_requirement",
    },
    {
      query: "When does Louisiana require an onsite wastewater installer for a project?",
      source: "authoritative_local_requirement_question",
      authorityUrl: "https://ldh.la.gov/page/onsite-wastewater-installers-workshop",
      intent: "wastewater_requirement",
    },
  ];

  const seen = new Set<string>();
  return [...candidates, ...requirementQuestions].filter((item) => {
    const key = String(item.query).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankDiscoveryExperiments(args: {
  observations: DiscoveryQualityRow[];
  classifications: Array<Record<string, any>>;
  marketPages: Array<Record<string, any>>;
  zeroResultQueries: Array<{ query: string; count: number; lastObservedAt: string }>;
  now: Date;
}) {
  const freshJrsObservations = args.observations.filter((row) => {
    const entity = recordValue(row.data.entity);
    const freshUntil = evidenceTimeMs(
      row.data.sourceFreshUntil,
      row.data.sourceFreshUntilPrecision,
      "end"
    );
    return (
      entity.slug === "jrs-auto-glass" && freshUntil !== null && freshUntil >= args.now.getTime()
    );
  });
  const freshJrsNotObserved = freshJrsObservations.filter(
    (row) => row.data.resultState === "not_observed"
  ).length;
  const weakSurfaceCount = args.classifications.filter((row) =>
    ["eligible_weak", "thin_placeholder", "unsupported"].includes(String(row.classification))
  ).length;
  const weakMarketPageCount = args.marketPages.filter(
    (row) => row.classification === "eligible_weak"
  ).length;
  const zeroResultDemand = args.zeroResultQueries.reduce((sum, item) => sum + item.count, 0);

  const scored = DISCOVERY_WAVE_1_EXPERIMENTS.map((definition) => {
    if (definition.experimentId === "wave1-non-jw-transfer-jrs") {
      return {
        ...definition,
        score: freshJrsNotObserved
          ? 100 + freshJrsNotObserved
          : freshJrsObservations.length
            ? 45
            : 10,
        currentBaseline: freshJrsObservations.length
          ? `${freshJrsObservations.length} fresh stored JR's Auto Glass outside observation(s), including ${freshJrsNotObserved} not-observed result(s). Location/device gaps remain explicit.`
          : "No fresh stored non-JW exact-brand observation; baseline unavailable.",
        scoringEvidence: {
          freshOutsideObservations: freshJrsObservations.length,
          notObserved: freshJrsNotObserved,
        },
      };
    }
    if (definition.experimentId === "wave1-eligible-weak-market-page") {
      return {
        ...definition,
        score: 8 + Math.min(80, weakSurfaceCount * 3 + weakMarketPageCount * 4),
        currentBaseline:
          weakSurfaceCount || weakMarketPageCount
            ? `${weakSurfaceCount} current weak entity surface(s) and ${weakMarketPageCount} eligible-weak market page(s). Target still requires predeclaration.`
            : "No current eligible-weak target is available in connected snapshot data.",
        scoringEvidence: { weakSurfaceCount, weakMarketPageCount },
      };
    }
    return {
      ...definition,
      score: 6 + Math.min(80, zeroResultDemand * 5),
      currentBaseline: zeroResultDemand
        ? `${zeroResultDemand} privacy-safe zero-result search occurrence(s) across ${args.zeroResultQueries.length} current phrase(s).`
        : "No current privacy-safe zero-result search evidence; baseline unavailable.",
      scoringEvidence: {
        zeroResultDemand,
        distinctZeroResultQueries: args.zeroResultQueries.length,
      },
    };
  });

  return scored
    .sort(
      (left, right) =>
        right.score - left.score || left.experimentId.localeCompare(right.experimentId)
    )
    .map((item, index) => ({ ...item, rank: (index + 1) as 1 | 2 | 3 }));
}

export class DiscoveryObservatoryService {
  constructor(
    private readonly queryable: ObservatoryQueryable,
    private readonly writeEvent: DiscoveryEventWriter,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async captureObservation(raw: unknown) {
    const now = this.clock();
    const normalized = sanitizeDiscoveryObservation(raw, {
      observationId: "obs-normalizing",
      recordedAt: now,
      now,
    });
    if (!normalized) throw new Error("INVALID_DISCOVERY_OBSERVATION");
    const observation: DiscoveryObservation = {
      ...normalized,
      observationId: `obs-${observationFingerprint(normalized).slice(0, 40)}`,
    };
    await this.queryable.query("select pg_advisory_xact_lock(hashtext($1))", [
      observation.observationId,
    ]);
    const existing = await this.queryable.query(
      `select data
         from events
        where event_type = 'discovery_observation'
          and data->>'observationId' = $1
        limit 1`,
      [observation.observationId]
    );
    if (existing.rows.length) {
      return {
        observation: recordValue(existing.rows[0]?.data) as DiscoveryObservation,
        created: false as const,
      };
    }
    await this.writeEvent(DISCOVERY_OBSERVATION_EVENT, observation as any);
    return { observation, created: true as const };
  }

  async resolveEntryRequestLinkage(
    entryRequestId: string | null | undefined,
    businessSlug: string,
    actionOccurredAt: Date = this.clock()
  ): Promise<DiscoveryEntryLinkage> {
    const entryId = String(entryRequestId || "").trim();
    if (!entryId) return "unknown_unavailable";
    try {
      const result = await this.queryable.query(
        `select id
           from events
          where event_type = 'discovery_landing'
            and data->>'entryRequestId' = $1
            and data->>'businessSlug' = $2
            and created_at <= $3::timestamptz
            and created_at >= $4::timestamptz
          order by created_at desc
          limit 1`,
        [
          entryId,
          businessSlug,
          actionOccurredAt.toISOString(),
          new Date(actionOccurredAt.getTime() - ENTRY_LINK_MAX_LOOKBACK_MS).toISOString(),
        ]
      );
      return result.rows.length > 0 ? "server_observed_match" : "client_correlated_unverified";
    } catch {
      return "unknown_unavailable";
    }
  }

  async recordRequestAction(args: {
    workRequestId: string;
    businessSlug?: string | null;
    businessId?: string | null;
    entity?: DiscoveryEntityRef;
    entityKey?: string | null;
    entryRequestId?: string | null;
    source?: "tradepartner_express_direct_connect" | "primary_direct_connect";
    occurredAt?: Date;
  }): Promise<DiscoveryJourneyContext> {
    const occurredAt = args.occurredAt ?? this.clock();
    const legacyBusinessSlug = String(args.businessSlug || "")
      .trim()
      .toLowerCase();
    const entity: DiscoveryEntityRef = args.entity || {
      type: "business",
      ...(args.businessId ? { id: args.businessId } : {}),
      ...(legacyBusinessSlug ? { slug: legacyBusinessSlug } : {}),
    };
    const entityIdentity = String(entity.slug || entity.id || "").trim();
    const entityKey =
      String(args.entityKey || "").trim() ||
      (entityIdentity ? `${entity.type}:${entityIdentity}` : "");
    if (!entityKey || (entity.type !== "platform" && !entityIdentity)) {
      throw new Error("DISCOVERY_ACTION_ENTITY_REQUIRED");
    }
    const entryBusinessSlug =
      legacyBusinessSlug ||
      String(entity.slug || "")
        .trim()
        .toLowerCase();
    const entryLinkage = entryBusinessSlug
      ? await this.resolveEntryRequestLinkage(args.entryRequestId, entryBusinessSlug, occurredAt)
      : "unknown_unavailable";
    const context: DiscoveryJourneyContext = {
      journeyId: `dc:${args.workRequestId}`,
      workRequestId: args.workRequestId,
      entity,
      entityKey,
      ...(args.entryRequestId ? { entryRequestId: args.entryRequestId } : {}),
      entryLinkage,
      actionOccurredAt: occurredAt.toISOString(),
    };
    await this.writeEvent(DISCOVERY_ACTION_EVENT, {
      type: DISCOVERY_ACTION_EVENT,
      recordId: `action-${randomUUID()}`,
      stage: "request_submitted",
      journeyId: context.journeyId,
      workRequestId: context.workRequestId,
      entity: context.entity,
      entityKey: context.entityKey,
      occurredAt: occurredAt.toISOString(),
      source: args.source || "tradepartner_express_direct_connect",
      evidenceStrength: "direct_server_observed",
      entryLinkage,
      entryEvidenceStrength: entryLinkageStrength(entryLinkage),
      entryLinkMaxLookbackDays: ENTRY_LINK_MAX_LOOKBACK_DAYS,
      ...(context.entryRequestId ? { entryRequestId: context.entryRequestId } : {}),
    });
    return context;
  }

  private async findJourneyContext(workRequestId: string): Promise<DiscoveryJourneyContext | null> {
    try {
      const result = await this.queryable.query(
        `select data, created_at
           from events
          where event_type = 'discovery_action'
            and data->>'workRequestId' = $1
          order by created_at asc
          limit 1`,
        [workRequestId]
      );
      const data = recordValue(result.rows[0]?.data);
      const entity = recordValue(data.entity);
      const actionOccurredAt = toIso(data.occurredAt || result.rows[0]?.created_at);
      const entityType = ["business", "profile", "market_page", "platform"].includes(
        String(entity.type)
      )
        ? (String(entity.type) as DiscoveryEntityRef["type"])
        : "business";
      const normalizedEntity: DiscoveryEntityRef = {
        type: entityType,
        ...(entity.id ? { id: String(entity.id) } : {}),
        ...(entity.slug ? { slug: String(entity.slug) } : {}),
      };
      const entityIdentity = String(normalizedEntity.slug || normalizedEntity.id || "").trim();
      const entityKey =
        String(data.entityKey || "").trim() ||
        (entityIdentity ? `${normalizedEntity.type}:${entityIdentity}` : "");
      if (
        !data.journeyId ||
        !actionOccurredAt ||
        !entityKey ||
        (normalizedEntity.type !== "platform" && !entityIdentity)
      ) {
        return null;
      }
      return {
        journeyId: String(data.journeyId),
        workRequestId,
        entity: normalizedEntity,
        entityKey,
        ...(data.entryRequestId ? { entryRequestId: String(data.entryRequestId) } : {}),
        entryLinkage: [
          "server_observed_match",
          "client_correlated_unverified",
          "unknown_unavailable",
        ].includes(String(data.entryLinkage))
          ? (String(data.entryLinkage) as DiscoveryEntryLinkage)
          : "unknown_unavailable",
        actionOccurredAt,
      };
    } catch {
      return null;
    }
  }

  async recordJourneyOutcome(args: {
    workRequestId: string;
    kind: "provider_response" | "requester_verified_complete";
    state: string;
    actorAuthority:
      | "server_delivery_system"
      | "authenticated_assigned_provider"
      | "authenticated_requester";
    occurredAt?: Date;
    details?: Record<string, string | number | boolean | null>;
  }): Promise<boolean> {
    const context = await this.findJourneyContext(args.workRequestId);
    if (!context) return false;
    const occurredAt = args.occurredAt ?? this.clock();
    if (occurredAt.getTime() < new Date(context.actionOccurredAt).getTime()) return false;
    await this.writeEvent(DISCOVERY_OUTCOME_EVENT, {
      type: DISCOVERY_OUTCOME_EVENT,
      recordId: `outcome-${randomUUID()}`,
      outcomeKind: args.kind,
      outcomeState: args.state,
      journeyId: context.journeyId,
      workRequestId: context.workRequestId,
      entity: context.entity,
      entityKey: context.entityKey,
      occurredAt: occurredAt.toISOString(),
      actorAuthority: args.actorAuthority,
      evidenceStrength: "direct_server_observed",
      entryLinkage: context.entryLinkage,
      ...(args.details ? { details: args.details } : {}),
    });
    return true;
  }

  async recordProviderDeliveryAttempt(args: {
    workRequestId: string;
    state: string;
    details?: Record<string, string | number | boolean | null>;
    occurredAt?: Date;
  }): Promise<boolean> {
    const context = await this.findJourneyContext(args.workRequestId);
    if (!context) return false;
    const occurredAt = args.occurredAt ?? this.clock();
    if (occurredAt.getTime() < new Date(context.actionOccurredAt).getTime()) return false;
    await this.writeEvent(DISCOVERY_DELIVERY_EVENT, {
      type: DISCOVERY_DELIVERY_EVENT,
      recordId: `delivery-${randomUUID()}`,
      stage: "provider_notification_attempted",
      deliveryState: args.state,
      journeyId: context.journeyId,
      workRequestId: context.workRequestId,
      entity: context.entity,
      entityKey: context.entityKey,
      occurredAt: occurredAt.toISOString(),
      actorAuthority: "server_delivery_system",
      evidenceStrength: "direct_server_observed",
      correctTargetSelected: true,
      reachedCorrectHuman: "unknown_unavailable",
      ...(args.details ? { details: args.details } : {}),
    });
    return true;
  }

  async captureExperimentState(raw: unknown, actorUserId: string) {
    const input = recordValue(raw);
    const experiment = DISCOVERY_WAVE_1_EXPERIMENTS.find(
      (item) => item.experimentId === String(input.experimentId || "")
    );
    const state = String(input.state || "");
    const ownerDecisionRef = String(input.ownerDecisionRef || "")
      .trim()
      .slice(0, 160);
    if (!experiment || !["approved", "rejected", "paused", "rolled_back"].includes(state)) {
      throw new Error("INVALID_DISCOVERY_EXPERIMENT_STATE");
    }
    if (!ownerDecisionRef) throw new Error("OWNER_DECISION_REFERENCE_REQUIRED");
    const occurredAt = this.clock().toISOString();
    const payload = {
      type: DISCOVERY_EXPERIMENT_STATE_EVENT,
      recordId: `experiment-state-${randomUUID()}`,
      experimentId: experiment.experimentId,
      state,
      ownerDecisionRef,
      actorUserId,
      occurredAt,
      note:
        String(input.note || "")
          .trim()
          .slice(0, 500) || undefined,
    };
    await this.writeEvent(DISCOVERY_EXPERIMENT_STATE_EVENT, payload);
    return payload;
  }

  async predeclareExperimentAssignment(raw: unknown, actorUserId: string) {
    const input = recordValue(raw);
    const experiment = DISCOVERY_WAVE_1_EXPERIMENTS.find(
      (item) => item.experimentId === String(input.experimentId || "")
    );
    const entityKey = String(input.entityKey || "")
      .trim()
      .slice(0, 160);
    const variant = String(input.variant || "")
      .trim()
      .slice(0, 80);
    const ownerDecisionRef = String(input.ownerDecisionRef || "")
      .trim()
      .slice(0, 160);
    const entityMatch = entityKey.match(
      /^(business|profile|market_page|platform|internal_query):([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/
    );
    if (!experiment || !entityMatch || !variant || !ownerDecisionRef) {
      throw new Error("INVALID_DISCOVERY_EXPERIMENT_ASSIGNMENT");
    }

    const lockKey = `${experiment.experimentId}|${entityKey}`;
    await this.queryable.query("select pg_advisory_xact_lock(hashtext($1))", [lockKey]);
    const existing = await this.queryable.query(
      `select data
         from events
        where event_type = 'discovery_experiment_assignment'
          and data->>'experimentId' = $1
          and data->>'entityKey' = $2
        limit 1`,
      [experiment.experimentId, entityKey]
    );
    if (existing.rows.length) {
      const stored = recordValue(existing.rows[0]?.data);
      if (stored.variant === variant && stored.ownerDecisionRef === ownerDecisionRef) {
        return { assignment: stored, created: false as const };
      }
      throw new Error("CONFLICTING_DISCOVERY_EXPERIMENT_ASSIGNMENT");
    }

    const approval = await this.queryable.query(
      `select data
         from events
        where event_type = 'discovery_experiment_state'
          and data->>'experimentId' = $1
        order by data->>'occurredAt' desc, created_at desc, id desc
        limit 1`,
      [experiment.experimentId]
    );
    const latestDecision = recordValue(approval.rows[0]?.data);
    if (
      latestDecision.state !== "approved" ||
      latestDecision.ownerDecisionRef !== ownerDecisionRef
    ) {
      throw new Error("DISCOVERY_EXPERIMENT_OWNER_APPROVAL_REQUIRED");
    }

    const assignedAt = this.clock().toISOString();
    const payload = {
      type: DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
      recordId: `experiment-assignment-${randomUUID()}`,
      experimentId: experiment.experimentId,
      entityKey,
      entity: { type: entityMatch[1], slug: entityMatch[2] },
      variant,
      ownerDecisionRef,
      actorUserId,
      assignedAt,
    };
    await this.writeEvent(DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT, payload);
    return { assignment: payload, created: true as const };
  }

  async getSnapshot(windowDays = 30) {
    const safeWindow = Math.max(1, Math.min(180, Math.trunc(windowDays) || 30));
    const now = this.clock();
    const from = new Date(now.getTime() - safeWindow * 24 * 60 * 60 * 1000);
    const sourceStates: SourceState[] = [];

    const eventResult = await this.queryable.query(
      `select id, event_type, data, created_at
           from events
         where event_type = any($1::text[])
          and (
            created_at >= $2
            or event_type = any($3::text[])
          )
        order by created_at asc`,
      [
        [
          DISCOVERY_OBSERVATION_EVENT,
          "discovery_landing",
          DISCOVERY_ACTION_EVENT,
          DISCOVERY_DELIVERY_EVENT,
          DISCOVERY_OUTCOME_EVENT,
          DISCOVERY_INTERNAL_SEARCH_EVENT,
          DISCOVERY_EXPERIMENT_STATE_EVENT,
          DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
        ],
        from,
        [DISCOVERY_EXPERIMENT_STATE_EVENT, DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT],
      ]
    );
    const eventRows: DiscoveryQualityRow[] = eventResult.rows.map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      data: recordValue(row.data),
      createdAt: row.created_at,
    }));
    sourceStates.push({
      source: "TradeScout event ledger",
      status: "current",
      observedAt: now.toISOString(),
      ageSeconds: 0,
      detail: `${eventRows.length} independent rows: windowed journey evidence plus all-time experiment lifecycle.`,
    });

    let surfaces: any[] = [];
    try {
      const surfaceResult = await this.queryable.query(
        `select 'business'::text as entity_type, id, slug, name, status, claim_status,
                public_discovery_enabled,
                jsonb_build_object(
                  'category', profile_data->'category',
                  'services', profile_data->'services',
                  'city', profile_data->'city',
                  'stateCode', profile_data->'stateCode',
                  'description', profile_data->'description'
                ) as profile_data,
                updated_at, null::text as headline,
                null::text as display_name
           from businesses
          where public_discovery_enabled = true
             or updated_at >= $1
          union all
         select 'profile'::text as entity_type, id, slug, display_name as name, status,
                null::text as claim_status,
                true as public_discovery_enabled, '{}'::jsonb as profile_data, updated_at, headline,
                display_name
           from profiles
          where status in ('active', 'published')
             or updated_at >= $1`,
        [new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)]
      );
      surfaces = surfaceResult.rows;
      sourceStates.push({
        source: "Current public-entity tables (temporary exception)",
        status: "current",
        observedAt: now.toISOString(),
        ageSeconds: 0,
        detail: `${surfaces.length} current business/profile candidates read without contact fields. ${ENTITY_INTELLIGENCE_TEMPORARY_EXCEPTION.id} is owned by ${ENTITY_INTELLIGENCE_TEMPORARY_EXCEPTION.owner} and expires ${ENTITY_INTELLIGENCE_TEMPORARY_EXCEPTION.removalDate}; replace this read-time classification with a scheduled snapshot.`,
      });
    } catch (error) {
      sourceStates.push({
        source: "Current public-entity tables (temporary exception)",
        status: "unavailable",
        observedAt: null,
        ageSeconds: null,
        detail: `Source unavailable: ${error instanceof Error ? error.message : "query failed"}`,
      });
    }

    let marketPages: any[] = [];
    try {
      const marketResult = await this.queryable.query(
        `select 'county'::text as kind, trade_slug, state_code, county_slug as location_slug,
                business_count, updated_at
           from ts_seo_trade_county_pages
          union all
         select 'city'::text as kind, trade_slug, state_code, city_slug as location_slug,
                business_count, updated_at
           from ts_seo_trade_city_pages`,
        []
      );
      marketPages = marketResult.rows.map((row) => ({
        ...row,
        classification: Number(row.business_count) >= 2 ? "useful_eligible" : "eligible_weak",
        reason:
          Number(row.business_count) >= 2
            ? "Current snapshot contains at least two eligible businesses."
            : "Eligible snapshot exists but has only one supporting business.",
      }));
      const latest = marketPages
        .map((row) => new Date(row.updated_at))
        .filter((value) => !Number.isNaN(value.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      sourceStates.push({
        source: "SEO market-page snapshots",
        status: "current",
        observedAt: latest?.toISOString() || now.toISOString(),
        ageSeconds: latest ? Math.max(0, Math.round((now.getTime() - latest.getTime()) / 1000)) : 0,
        detail: `${marketPages.length} precomputed eligible market pages; never a live fan-out join.`,
      });
    } catch (error) {
      sourceStates.push({
        source: "SEO market-page snapshots",
        status: "unavailable",
        observedAt: null,
        ageSeconds: null,
        detail: `Snapshot unavailable: ${error instanceof Error ? error.message : "query failed"}`,
      });
    }

    let crawlerRequestCount: number | null = null;
    try {
      const crawlerResult = await this.queryable.query(
        `select coalesce(sum(request_count), 0)::int as request_count,
                max(bucket_start) as observed_at
           from crawler_request_hourly_rollups
          where bucket_start >= $1`,
        [from]
      );
      crawlerRequestCount = Number(crawlerResult.rows[0]?.request_count || 0);
      const observedAt = toIso(crawlerResult.rows[0]?.observed_at);
      sourceStates.push({
        source: "Crawler request rollups",
        status: "current",
        observedAt,
        ageSeconds: observedAt
          ? Math.max(0, Math.round((now.getTime() - new Date(observedAt).getTime()) / 1000))
          : null,
        detail: "Supporting crawl telemetry only; it does not count as reach or outcome.",
      });
    } catch (error) {
      sourceStates.push({
        source: "Crawler request rollups",
        status: "unavailable",
        observedAt: null,
        ageSeconds: null,
        detail: `Crawler telemetry unavailable: ${error instanceof Error ? error.message : "query failed"}`,
      });
    }

    for (const external of ["Google Search Console", "Bing Webmaster Tools", "Google Maps APIs"]) {
      sourceStates.push({
        source: external,
        status: "unavailable",
        observedAt: null,
        ageSeconds: null,
        detail: "No connected source in this Wave 1 lane; values remain unknown rather than zero.",
      });
    }

    const byType = (type: string) => eventRows.filter((row) => row.eventType === type);
    const observations = collapseRowsByIdentity(byType(DISCOVERY_OBSERVATION_EVENT), (row) =>
      String(row.data.observationId || row.id)
    );
    const freshObservations = observations.filter((row) => {
      const freshUntil = evidenceTimeMs(
        row.data.sourceFreshUntil,
        row.data.sourceFreshUntilPrecision,
        "end"
      );
      return freshUntil !== null && freshUntil >= now.getTime();
    });
    const staleObservationCount = observations.length - freshObservations.length;
    const observedReach = freshObservations.filter(
      (row) => row.data.resultState === "observed"
    ).length;
    const reachUnavailable =
      freshObservations.filter((row) => row.data.resultState === "unavailable").length +
      staleObservationCount;
    const entries = byType("discovery_landing");
    const actions = byType(DISCOVERY_ACTION_EVENT);
    const outcomes = byType(DISCOVERY_OUTCOME_EVENT);
    const actionTimeByRequest = new Map<string, number>();
    for (const action of actions) {
      const requestId = String(action.data.workRequestId || "");
      const occurredAt = journeyEventTimeMs(action);
      if (!requestId || occurredAt === null) continue;
      const previous = actionTimeByRequest.get(requestId);
      if (previous === undefined || occurredAt < previous) {
        actionTimeByRequest.set(requestId, occurredAt);
      }
    }
    const temporallyValidOutcomes = outcomes.filter((row) => {
      const requestId = String(row.data.workRequestId || "");
      const actionTime = actionTimeByRequest.get(requestId);
      const outcomeTime = journeyEventTimeMs(row);
      return actionTime !== undefined && outcomeTime !== null && outcomeTime >= actionTime;
    });
    const entryIds = distinct(entries.map((row) => String(row.data.entryRequestId || row.id)));
    const entrySourceMap = new Map<
      string,
      {
        sourceHint: string | null;
        referrerHost: string | null;
        entryIds: Set<string>;
      }
    >();
    for (const entry of entries) {
      const sourceHint = String(entry.data.sourceHint || "").trim() || null;
      const referrerHost = String(entry.data.referrerHost || "").trim() || null;
      const key = `${sourceHint || "unavailable"}|${referrerHost || "unavailable"}`;
      const previous = entrySourceMap.get(key);
      const ids = previous?.entryIds || new Set<string>();
      ids.add(String(entry.data.entryRequestId || entry.id));
      entrySourceMap.set(key, { sourceHint, referrerHost, entryIds: ids });
    }
    const requestIds = distinct(actions.map((row) => String(row.data.workRequestId || "")));
    const verifiedEntryIdsWithAction = distinct(
      actions
        .filter((row) => row.data.entryLinkage === "server_observed_match")
        .map((row) => String(row.data.entryRequestId || ""))
    );
    const providerResponseIds = distinct(
      temporallyValidOutcomes
        .filter((row) => row.data.outcomeKind === "provider_response")
        .map((row) => String(row.data.workRequestId || ""))
    );
    const providerResponseTimes = new Map<string, number>();
    for (const response of temporallyValidOutcomes.filter(
      (row) => row.data.outcomeKind === "provider_response"
    )) {
      const requestId = String(response.data.workRequestId || "");
      const occurredAt = journeyEventTimeMs(response);
      if (!requestId || occurredAt === null) continue;
      const previous = providerResponseTimes.get(requestId);
      if (previous === undefined || occurredAt < previous)
        providerResponseTimes.set(requestId, occurredAt);
    }
    const verifiedOutcomeIds = distinct(
      temporallyValidOutcomes
        .filter((row) => {
          if (row.data.outcomeKind !== "requester_verified_complete") return false;
          const requestId = String(row.data.workRequestId || "");
          const responseAt = providerResponseTimes.get(requestId);
          const completedAt = journeyEventTimeMs(row);
          return responseAt !== undefined && completedAt !== null && completedAt >= responseAt;
        })
        .map((row) => String(row.data.workRequestId || ""))
    );
    const unverifiedActionCount = distinct(
      actions
        .filter((row) => row.data.entryLinkage !== "server_observed_match")
        .map((row) => String(row.data.workRequestId || row.id))
    ).length;

    const entryIdsBySlug = new Map<string, Set<string>>();
    const actionIdsBySlug = new Map<string, Set<string>>();
    const serverMatchedEntryIds = new Set<string>();
    for (const entry of entries) {
      const slug = String(entry.data.businessSlug || "");
      if (slug) {
        const ids = entryIdsBySlug.get(slug) || new Set<string>();
        ids.add(String(entry.data.entryRequestId || entry.id));
        entryIdsBySlug.set(slug, ids);
      }
    }
    for (const action of actions) {
      const entity = recordValue(action.data.entity);
      const slug = String(entity.slug || "");
      if (slug) {
        const ids = actionIdsBySlug.get(slug) || new Set<string>();
        ids.add(String(action.data.workRequestId || action.id));
        actionIdsBySlug.set(slug, ids);
      }
      if (action.data.entryLinkage === "server_observed_match" && action.data.entryRequestId) {
        serverMatchedEntryIds.add(String(action.data.entryRequestId));
      }
    }
    const unclaimedDemand = surfaces
      .filter((surface) => String(surface.claim_status || "") === "unclaimed")
      .map((surface) => ({
        entityId: String(surface.id),
        slug: String(surface.slug),
        name: String(surface.name || surface.slug),
        entryCount: entryIdsBySlug.get(String(surface.slug))?.size || 0,
        actionCount: actionIdsBySlug.get(String(surface.slug))?.size || 0,
        grain: "distinct_entry_and_work_request_ids",
      }))
      .filter((row) => row.entryCount > 0 || row.actionCount > 0)
      .sort(
        (left, right) => right.actionCount - left.actionCount || right.entryCount - left.entryCount
      );

    const entryWithoutActionMap = new Map<
      string,
      {
        canonicalRoute: string;
        businessSlug: string;
        entryIds: Set<string>;
        oldestAt: string;
        newestAt: string;
      }
    >();
    for (const entry of entries) {
      const entryId = String(entry.data.entryRequestId || "");
      if (entryId && serverMatchedEntryIds.has(entryId)) continue;
      const canonicalRoute = String(entry.data.canonicalRoute || "unknown");
      const businessSlug = String(entry.data.businessSlug || "unknown");
      const key = `${businessSlug}|${canonicalRoute}`;
      const occurredAt = String(entry.data.ts || entry.createdAt);
      const previous = entryWithoutActionMap.get(key);
      const unmatchedIds = previous?.entryIds || new Set<string>();
      unmatchedIds.add(entryId || entry.id);
      entryWithoutActionMap.set(key, {
        canonicalRoute,
        businessSlug,
        entryIds: unmatchedIds,
        oldestAt:
          !previous || new Date(occurredAt) < new Date(previous.oldestAt)
            ? occurredAt
            : previous.oldestAt,
        newestAt:
          !previous || new Date(occurredAt) > new Date(previous.newestAt)
            ? occurredAt
            : previous.newestAt,
      });
    }

    const outsideSourceMap = new Map<
      string,
      {
        source: string;
        surface: string;
        observedHost: string | null;
        count: number;
        relationship: "unknown";
      }
    >();
    const explicitCompetitorMap = new Map<
      string,
      { name: string; count: number; relationship: "competitor" }
    >();
    for (const observation of observations) {
      if (observation.data.resultState !== "observed") continue;
      let observedHost: string | null = null;
      try {
        observedHost = observation.data.citedUrl
          ? new URL(String(observation.data.citedUrl)).hostname.toLowerCase()
          : null;
      } catch {
        observedHost = null;
      }
      const source = String(observation.data.source || "unknown");
      const surface = String(observation.data.surface || "unknown");
      const sourceKey = `${source}|${surface}|${observedHost || "unknown"}`;
      const previousSource = outsideSourceMap.get(sourceKey);
      outsideSourceMap.set(sourceKey, {
        source,
        surface,
        observedHost,
        count: (previousSource?.count || 0) + 1,
        relationship: "unknown",
      });
      const outsideEntity = recordValue(observation.data.outsideEntity);
      if (outsideEntity.relationship === "competitor" && outsideEntity.name) {
        const name = String(outsideEntity.name);
        const previous = explicitCompetitorMap.get(name.toLowerCase());
        explicitCompetitorMap.set(name.toLowerCase(), {
          name,
          count: (previous?.count || 0) + 1,
          relationship: "competitor",
        });
      }
    }

    const internalSearchRows = byType(DISCOVERY_INTERNAL_SEARCH_EVENT);
    const zeroResultMap = new Map<
      string,
      { query: string; count: number; lastObservedAt: string }
    >();
    for (const row of internalSearchRows.filter((item) => Number(item.data.resultCount) === 0)) {
      const query = String(row.data.query || "");
      if (!query) continue;
      const previous = zeroResultMap.get(query);
      const observedAt = String(row.data.observedAt || row.createdAt);
      zeroResultMap.set(query, {
        query,
        count: (previous?.count || 0) + 1,
        lastObservedAt:
          !previous || new Date(observedAt) > new Date(previous.lastObservedAt)
            ? observedAt
            : previous.lastObservedAt,
      });
    }

    const classifications = surfaces.map(classifyDiscoverySurface);
    const zeroResultQueries = Array.from(zeroResultMap.values()).sort((a, b) => b.count - a.count);
    const qualityIssues = validateDiscoveryRecords(eventRows, now);
    const latestExperimentStates = new Map<string, DiscoveryQualityRow>();
    for (const stateRow of byType(DISCOVERY_EXPERIMENT_STATE_EVENT)) {
      const experimentId = String(stateRow.data.experimentId || "");
      if (!experimentId) continue;
      const previous = latestExperimentStates.get(experimentId);
      if (!previous || (journeyEventTimeMs(stateRow) ?? 0) >= (journeyEventTimeMs(previous) ?? 0)) {
        latestExperimentStates.set(experimentId, stateRow);
      }
    }
    const assignmentCountByExperiment = new Map<string, number>();
    for (const assignment of byType(DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT)) {
      const experimentId = String(assignment.data.experimentId || "");
      if (!experimentId) continue;
      assignmentCountByExperiment.set(
        experimentId,
        (assignmentCountByExperiment.get(experimentId) || 0) + 1
      );
    }
    const rankedExperiments = rankDiscoveryExperiments({
      observations,
      classifications,
      marketPages,
      zeroResultQueries,
      now,
    }).map((experiment) => {
      const latestState = latestExperimentStates.get(experiment.experimentId)?.data;
      return {
        ...experiment,
        currentState: latestState?.state || "proposed_unapproved",
        latestOwnerDecisionRef: latestState?.ownerDecisionRef || null,
        latestDecisionAt: latestState?.occurredAt || null,
        assignmentCount: assignmentCountByExperiment.get(experiment.experimentId) || 0,
      };
    });
    return {
      generatedAt: now.toISOString(),
      window: { days: safeWindow, from: from.toISOString(), to: now.toISOString() },
      semantics: {
        observation: "Outside-surface result independently recorded.",
        entry: "Actual TradeScout platform landing.",
        action: "Deliberate customer attempt.",
        outcome: "Provider response/completion state; never inferred from an action.",
        experiment: "Predeclared assignment plus one controlled change.",
      },
      aggregation: {
        method: "distinct_identifiers_from_independent_queries",
        joinMultiplication: false,
      },
      funnel: [
        {
          stage: "reach",
          label: "Independently observed reach",
          count: observedReach,
          denominator: observations.length,
          denominatorLabel: "outside observations assessed",
          ratePercent: rate(observedReach, observations.length),
          unknownUnavailable: reachUnavailable,
        },
        {
          stage: "entry",
          label: "TradeScout entries",
          count: entryIds.length,
          denominator: observedReach,
          denominatorLabel: "observed reach; cross-surface causation unavailable",
          ratePercent: null,
          unknownUnavailable: observedReach,
        },
        {
          stage: "request",
          label: "Direct Connect requests",
          count: requestIds.length,
          denominator: entryIds.length,
          denominatorLabel: "unique entries",
          ratePercent: rate(verifiedEntryIdsWithAction.length, entryIds.length),
          rateNumerator: verifiedEntryIdsWithAction.length,
          unknownUnavailable: unverifiedActionCount,
        },
        {
          stage: "provider_response",
          label: "Provider responses",
          count: providerResponseIds.length,
          denominator: requestIds.length,
          denominatorLabel: "unique requests",
          ratePercent: rate(providerResponseIds.length, requestIds.length),
          unknownUnavailable: Math.max(0, requestIds.length - providerResponseIds.length),
        },
        {
          stage: "verified_outcome",
          label: "Requester-verified outcomes",
          count: verifiedOutcomeIds.length,
          denominator: providerResponseIds.length,
          denominatorLabel: "requests with a provider response",
          ratePercent: rate(verifiedOutcomeIds.length, providerResponseIds.length),
          unknownUnavailable: Math.max(0, providerResponseIds.length - verifiedOutcomeIds.length),
        },
      ],
      sourceStates,
      observations: observations.map((row) => {
        const observedAt = evidenceTimeMs(
          row.data.observedAt,
          row.data.observedAtPrecision,
          "start"
        );
        const freshUntil = evidenceTimeMs(
          row.data.sourceFreshUntil,
          row.data.sourceFreshUntilPrecision,
          "end"
        );
        return {
          id: row.id,
          ...row.data,
          ageSeconds:
            observedAt === null
              ? null
              : Math.max(0, Math.round((now.getTime() - observedAt) / 1000)),
          freshnessState:
            freshUntil !== null && freshUntil >= now.getTime() ? "current" : "stale_or_unavailable",
        };
      }),
      operatingViews: {
        entrySourceHints: Array.from(entrySourceMap.values())
          .map(({ entryIds: ids, ...row }) => ({
            ...row,
            entryCount: ids.size,
            grain: "distinct_entry_request_or_event_ids",
            evidenceBoundary: "Landing-carried hint; not independent reach or causal attribution.",
          }))
          .sort((left, right) => right.entryCount - left.entryCount),
        unclaimedDemand,
        entriesWithoutActions: Array.from(entryWithoutActionMap.values())
          .map(({ entryIds, ...row }) => ({
            ...row,
            entryCount: entryIds.size,
            grain: "distinct_entry_request_or_event_ids",
          }))
          .sort((left, right) => right.entryCount - left.entryCount),
        repeatedOutsideSources: Array.from(outsideSourceMap.values())
          .filter((row) => row.count >= 2)
          .sort((left, right) => right.count - left.count),
        repeatedExplicitCompetitors: Array.from(explicitCompetitorMap.values())
          .filter((row) => row.count >= 2)
          .sort((left, right) => right.count - left.count),
        caveat:
          "Outside hosts remain relationship=unknown. A competitor label appears only when explicitly recorded by an operator.",
      },
      zeroResultQueries,
      livingQueries: buildLivingDiscoveryQueries(surfaces),
      classifications,
      marketPages,
      supportingTelemetry: {
        crawlerRequestCount,
        caveat:
          "Crawler counts support diagnostics only and never substitute for reach, action, or outcome.",
      },
      quality: {
        status: qualityIssues.length ? "attention_required" : "pass",
        checkedRecordCount: eventRows.length,
        issues: qualityIssues,
        guarantees: [
          "unique record ids",
          "stable normalized observation identity with replay collapse",
          "journey and entity references",
          "no future timestamps beyond five-minute tolerance",
          "landing precedes linked action within a thirty-day lookback",
          "action precedes counted delivery and outcome events",
          "one experiment assignment per entity",
          "assignment before attributed event",
          "explicit outside-source freshness and timestamp precision",
          "distinct independent aggregation without join multiplication",
        ],
      },
      experiments: rankedExperiments,
    };
  }
}
