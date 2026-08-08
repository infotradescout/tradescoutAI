import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DISCOVERY_ACTION_EVENT,
  DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
  DISCOVERY_OBSERVATION_EVENT,
  DISCOVERY_OUTCOME_EVENT,
  sanitizeDiscoveryInternalSearch,
  sanitizeDiscoveryObservation,
  validateDiscoveryRecords,
  type DiscoveryQualityRow,
} from "../../shared/discoveryObservatory";
import {
  DiscoveryObservatoryService,
  rankDiscoveryExperiments,
  type ObservatoryQueryable,
} from "../services/discoveryObservatoryService";

const NOW = new Date("2026-08-08T16:45:03.000Z");
const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), "utf8");

function observationInput(overrides: Record<string, unknown> = {}) {
  return {
    observedAt: "2026-08-08T16:00:00.000Z",
    observedAtPrecision: "instant",
    sourceFreshUntil: "2026-09-05T16:00:00.000Z",
    sourceFreshUntilPrecision: "instant",
    source: "web_search",
    surface: "web_search",
    queryEvidenceState: "known",
    query: "local roofer TradeScout",
    resultState: "observed",
    entity: { type: "business", slug: "local-roofer" },
    location: null,
    device: null,
    provenance: { method: "operator_manual", collector: "test" },
    ...overrides,
  };
}

function observation(overrides: Record<string, unknown> = {}) {
  return sanitizeDiscoveryObservation(observationInput(overrides), {
    observationId: "obs-test-1",
    recordedAt: NOW,
    now: NOW,
  });
}

describe("discovery observation contract", () => {
  it("preserves a genuinely unknown query without fake text", () => {
    expect(observation({ queryEvidenceState: "unknown", query: null })).toMatchObject({
      query: null,
      queryEvidenceState: "unknown",
    });
    expect(observation({ queryEvidenceState: "known", query: "unknown" })).toBeNull();
    expect(observation({ queryEvidenceState: "unknown", query: "invented" })).toBeNull();
  });

  it("rejects future observations and requires source freshness", () => {
    expect(observation({ observedAt: "2026-08-09T16:00:00.000Z" })).toBeNull();
    expect(observation({ sourceFreshUntil: null })).toBeNull();
    expect(observation({ sourceFreshUntil: "2027-08-08T16:00:00.000Z" })).toBeNull();
    expect(observation()?.sourceFreshUntil).toBe("2026-09-05T16:00:00.000Z");
  });

  it("preserves day-only evidence without inventing a midnight instant", () => {
    expect(
      observation({
        observedAt: "2026-08-08",
        observedAtPrecision: "day",
        sourceFreshUntil: "2026-09-05",
        sourceFreshUntilPrecision: "day",
      })
    ).toMatchObject({
      observedAt: "2026-08-08",
      observedAtPrecision: "day",
      sourceFreshUntil: "2026-09-05",
      sourceFreshUntilPrecision: "day",
    });
    expect(
      observation({
        observedAt: "2026-08-09",
        observedAtPrecision: "day",
        sourceFreshUntil: "2026-09-05",
        sourceFreshUntilPrecision: "day",
      })
    ).toBeNull();
    expect(observation({ observedAt: "2026-08-08", observedAtPrecision: "instant" })).toBeNull();
  });

  it("accepts the non-seed Wave 1 evidence bundle through the shared capture contract", () => {
    const bundle = JSON.parse(
      read(
        "artifacts/evidence/2026-08-08-tradescout-discovery-observatory-wave1/external-observations.json"
      )
    );
    expect(bundle).toMatchObject({ runtimeSeed: false, automaticImport: false });
    const captures = bundle.observations.map((item: unknown, index: number) =>
      sanitizeDiscoveryObservation(item, {
        observationId: `bundle-observation-${index}`,
        recordedAt: NOW,
        now: NOW,
      })
    );
    expect(captures.every(Boolean)).toBe(true);
  });

  it("serializes identical observation replays while preserving material differences", async () => {
    const stored = new Map<string, Record<string, unknown>>();
    let writes = 0;
    let locked = false;
    const waiters: Array<() => void> = [];
    const acquire = async () => {
      if (!locked) {
        locked = true;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
    };
    const release = () => {
      const next = waiters.shift();
      if (next) next();
      else locked = false;
    };
    const createService = () =>
      new DiscoveryObservatoryService(
        {
          query: async (text, values = []) => {
            if (text.includes("pg_advisory_xact_lock")) {
              await acquire();
              return { rows: [] };
            }
            if (text.includes("discovery_observation")) {
              const existing = stored.get(String(values[0]));
              if (existing) release();
              return { rows: existing ? [{ data: existing }] : [] };
            }
            return { rows: [] };
          },
        },
        async (_eventType, data) => {
          writes += 1;
          stored.set(String(data.observationId), data);
          release();
        },
        () => NOW
      );

    const identical = observationInput();
    const replayResults = await Promise.all([
      createService().captureObservation(identical),
      createService().captureObservation({ ...identical }),
    ]);
    expect(writes).toBe(1);
    expect(replayResults.map((result) => result.created).sort()).toEqual([false, true]);
    expect(replayResults[0].observation.observationId).toBe(
      replayResults[1].observation.observationId
    );

    const distinctResult = await createService().captureObservation(
      observationInput({ resultState: "not_observed" })
    );
    expect(distinctResult.created).toBe(true);
    expect(distinctResult.observation.observationId).not.toBe(
      replayResults[0].observation.observationId
    );
    expect(writes).toBe(2);
  });

  it("drops private first-party query shapes", () => {
    expect(
      sanitizeDiscoveryInternalSearch({
        type: "discovery_internal_search",
        query: "person@example.com",
        resultCount: 0,
        observedAt: "2026-08-08T16:00:00.000Z",
      })
    ).toBeNull();
    expect(
      sanitizeDiscoveryInternalSearch({
        type: "discovery_internal_search",
        query: "glass repair",
        resultCount: 0,
        observedAt: "2026-08-08T16:00:00.000Z",
        stateCode: "LA",
      })
    ).toMatchObject({ query: "glass repair", resultCount: 0, stateCode: "LA" });
  });
});

describe("record grain and attribution integrity", () => {
  it("detects duplicates, future time, broken refs, orphan outcomes, and assignment order", () => {
    const rows: DiscoveryQualityRow[] = [
      {
        id: "duplicate",
        eventType: DISCOVERY_OBSERVATION_EVENT,
        data: { observedAt: "2026-08-09T16:00:00.000Z" },
        createdAt: NOW,
      },
      {
        id: "duplicate",
        eventType: DISCOVERY_ACTION_EVENT,
        data: { workRequestId: "work-1", occurredAt: NOW.toISOString() },
        createdAt: NOW,
      },
      {
        id: "outcome",
        eventType: DISCOVERY_OUTCOME_EVENT,
        data: {
          journeyId: "dc:work-2",
          workRequestId: "work-2",
          entity: { slug: "provider" },
          occurredAt: NOW.toISOString(),
        },
        createdAt: NOW,
      },
      {
        id: "action-before-check",
        eventType: DISCOVERY_ACTION_EVENT,
        data: {
          journeyId: "dc:work-3",
          workRequestId: "work-3",
          entity: { slug: "provider" },
          occurredAt: "2026-08-08T16:30:00.000Z",
        },
        createdAt: "2026-08-08T16:30:00.000Z",
      },
      {
        id: "outcome-before-action",
        eventType: DISCOVERY_OUTCOME_EVENT,
        data: {
          journeyId: "dc:work-3",
          workRequestId: "work-3",
          entity: { slug: "provider" },
          occurredAt: "2026-08-08T16:29:00.000Z",
        },
        createdAt: "2026-08-08T16:29:00.000Z",
      },
      {
        id: "assignment-1",
        eventType: DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
        data: {
          experimentId: "experiment-1",
          entityKey: "business:provider",
          assignedAt: "2026-08-08T16:30:00.000Z",
        },
        createdAt: "2026-08-08T16:30:00.000Z",
      },
      {
        id: "assignment-2",
        eventType: DISCOVERY_EXPERIMENT_ASSIGNMENT_EVENT,
        data: {
          experimentId: "experiment-1",
          entityKey: "business:provider",
          assignedAt: "2026-08-08T16:31:00.000Z",
        },
        createdAt: "2026-08-08T16:31:00.000Z",
      },
      {
        id: "before",
        eventType: "discovery_landing",
        data: {
          experimentId: "experiment-1",
          entityKey: "business:provider",
          occurredAt: "2026-08-08T16:00:00.000Z",
        },
        createdAt: "2026-08-08T16:00:00.000Z",
      },
    ];
    const codes = validateDiscoveryRecords(rows, NOW).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "duplicate_record_id",
        "future_timestamp",
        "missing_source_freshness",
        "missing_journey_reference",
        "missing_entity_reference",
        "orphan_outcome",
        "event_before_action",
        "duplicate_experiment_assignment",
        "event_before_experiment_assignment",
      ])
    );
  });

  it("requires a recorded owner approval before an atomic assignment", async () => {
    const service = new DiscoveryObservatoryService(
      {
        query: async (text) => {
          if (text.includes("discovery_experiment_state")) return { rows: [] };
          return { rows: [] };
        },
      },
      async () => undefined,
      () => NOW
    );
    await expect(
      service.predeclareExperimentAssignment(
        {
          experimentId: "wave1-non-jw-transfer-jrs",
          entityKey: "business:jrs-auto-glass",
          variant: "one-fact-block",
          ownerDecisionRef: "owner-review-1",
        },
        "admin-1"
      )
    ).rejects.toThrow("DISCOVERY_EXPERIMENT_OWNER_APPROVAL_REQUIRED");
  });

  it("requires the latest owner decision to be the matching approval", async () => {
    const service = new DiscoveryObservatoryService(
      {
        query: async (text) => {
          if (text.includes("discovery_experiment_state")) {
            return {
              rows: [
                {
                  data: {
                    experimentId: "wave1-non-jw-transfer-jrs",
                    state: "paused",
                    ownerDecisionRef: "owner-review-1",
                  },
                },
              ],
            };
          }
          return { rows: [] };
        },
      },
      async () => undefined,
      () => NOW
    );
    await expect(
      service.predeclareExperimentAssignment(
        {
          experimentId: "wave1-non-jw-transfer-jrs",
          entityKey: "business:jrs-auto-glass",
          variant: "one-fact-block",
          ownerDecisionRef: "owner-review-1",
        },
        "admin-1"
      )
    ).rejects.toThrow("DISCOVERY_EXPERIMENT_OWNER_APPROVAL_REQUIRED");
  });

  it("serializes concurrent identical retries into one assignment", async () => {
    let assignment: Record<string, unknown> | null = null;
    let writes = 0;
    let locked = false;
    const waiters: Array<() => void> = [];
    const acquire = async () => {
      if (!locked) {
        locked = true;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
    };
    const release = () => {
      const next = waiters.shift();
      if (next) next();
      else locked = false;
    };
    const createService = () =>
      new DiscoveryObservatoryService(
        {
          query: async (text) => {
            if (text.includes("pg_advisory_xact_lock")) {
              await acquire();
              return { rows: [] };
            }
            if (text.includes("discovery_experiment_state")) {
              return {
                rows: [
                  {
                    data: {
                      experimentId: "wave1-non-jw-transfer-jrs",
                      state: "approved",
                      ownerDecisionRef: "owner-review-1",
                    },
                  },
                ],
              };
            }
            if (text.includes("discovery_experiment_assignment")) {
              const rows = assignment ? [{ data: assignment }] : [];
              if (assignment) release();
              return { rows };
            }
            return { rows: [] };
          },
        },
        async (_eventType, data) => {
          writes += 1;
          assignment = data;
          release();
        },
        () => NOW
      );
    const request = {
      experimentId: "wave1-non-jw-transfer-jrs",
      entityKey: "business:jrs-auto-glass",
      variant: "one-fact-block",
      ownerDecisionRef: "owner-review-1",
    };
    const results = await Promise.all([
      createService().predeclareExperimentAssignment(request, "admin-1"),
      createService().predeclareExperimentAssignment(request, "admin-1"),
    ]);
    expect(writes).toBe(1);
    expect(results.map((result) => result.created).sort()).toEqual([false, true]);
    expect(results[0].assignment).toEqual(results[1].assignment);
  });

  it("rejects a conflicting retry after an entity is assigned", async () => {
    const service = new DiscoveryObservatoryService(
      {
        query: async (text) => {
          if (text.includes("discovery_experiment_state")) {
            return {
              rows: [
                {
                  data: { state: "approved", ownerDecisionRef: "owner-review-1" },
                },
              ],
            };
          }
          if (text.includes("discovery_experiment_assignment")) {
            return {
              rows: [
                {
                  data: { variant: "control", ownerDecisionRef: "owner-review-1" },
                },
              ],
            };
          }
          return { rows: [] };
        },
      },
      async () => undefined,
      () => NOW
    );
    await expect(
      service.predeclareExperimentAssignment(
        {
          experimentId: "wave1-non-jw-transfer-jrs",
          entityKey: "business:jrs-auto-glass",
          variant: "one-fact-block",
          ownerDecisionRef: "owner-review-1",
        },
        "admin-1"
      )
    ).rejects.toThrow("CONFLICTING_DISCOVERY_EXPERIMENT_ASSIGNMENT");
  });
});

describe("disposable Direct Connect proof", () => {
  it("records entry, request, unknown delivery reach, provider response, and verified completion", async () => {
    const rows: DiscoveryQualityRow[] = [
      {
        id: "entry",
        eventType: "discovery_landing",
        data: {
          entryRequestId: "entry-proof",
          businessSlug: "disposable-provider",
          canonicalRoute: "/business/disposable-provider",
          ts: NOW.toISOString(),
        },
        createdAt: NOW,
      },
    ];
    const queryable: ObservatoryQueryable = {
      async query(text, values = []) {
        if (text.includes("event_type = 'discovery_landing'")) {
          return {
            rows:
              values[0] === "entry-proof" && values[1] === "disposable-provider"
                ? [{ id: "entry" }]
                : [],
          };
        }
        if (text.includes("event_type = 'discovery_action'")) {
          const row = rows.find(
            (item) =>
              item.eventType === DISCOVERY_ACTION_EVENT && item.data.workRequestId === values[0]
          );
          return { rows: row ? [{ data: row.data }] : [] };
        }
        return { rows: [] };
      },
    };
    const service = new DiscoveryObservatoryService(
      queryable,
      async (eventType, data) =>
        rows.push({ id: `row-${rows.length}`, eventType, data, createdAt: NOW }),
      () => NOW
    );
    const context = await service.recordRequestAction({
      workRequestId: "work-proof",
      businessSlug: "disposable-provider",
      entryRequestId: "entry-proof",
    });
    expect(context.entryLinkage).toBe("server_observed_match");
    await service.recordProviderDeliveryAttempt({
      workRequestId: "work-proof",
      state: "queued",
    });
    await service.recordJourneyOutcome({
      workRequestId: "work-proof",
      kind: "provider_response",
      state: "accepted",
      actorAuthority: "authenticated_assigned_provider",
    });
    await service.recordJourneyOutcome({
      workRequestId: "work-proof",
      kind: "requester_verified_complete",
      state: "completed",
      actorAuthority: "authenticated_requester",
    });
    const delivery = rows.find((row) => row.eventType === "discovery_delivery");
    const outcomes = rows.filter((row) => row.eventType === DISCOVERY_OUTCOME_EVENT);
    expect(delivery?.data).toMatchObject({
      stage: "provider_notification_attempted",
      reachedCorrectHuman: "unknown_unavailable",
    });
    expect(outcomes.map((row) => row.data.outcomeKind)).toEqual([
      "provider_response",
      "requester_verified_complete",
    ]);
    expect(validateDiscoveryRecords(rows, NOW)).toEqual([]);
  });

  it("labels an unmatched client-carried entry id as unverified", async () => {
    const service = new DiscoveryObservatoryService(
      { query: async () => ({ rows: [] }) },
      async () => undefined,
      () => NOW
    );
    expect(await service.resolveEntryRequestLinkage("client-only", "provider")).toBe(
      "client_correlated_unverified"
    );
  });

  it("links only a same-business landing that predates the action within thirty days", async () => {
    let landingCreatedAt = new Date("2026-08-08T16:46:00.000Z");
    const service = new DiscoveryObservatoryService(
      {
        query: async (text, values = []) => {
          if (!text.includes("discovery_landing")) return { rows: [] };
          const actionAt = new Date(String(values[2]));
          const lookbackStart = new Date(String(values[3]));
          const inWindow =
            landingCreatedAt.getTime() <= actionAt.getTime() &&
            landingCreatedAt.getTime() >= lookbackStart.getTime();
          return { rows: inWindow ? [{ id: "entry" }] : [] };
        },
      },
      async () => undefined,
      () => NOW
    );
    expect(await service.resolveEntryRequestLinkage("entry", "provider", NOW)).toBe(
      "client_correlated_unverified"
    );
    landingCreatedAt = new Date("2026-07-01T16:45:03.000Z");
    expect(await service.resolveEntryRequestLinkage("entry", "provider", NOW)).toBe(
      "client_correlated_unverified"
    );
    landingCreatedAt = new Date("2026-08-07T16:45:03.000Z");
    expect(await service.resolveEntryRequestLinkage("entry", "provider", NOW)).toBe(
      "server_observed_match"
    );
  });

  it("refuses to write delivery or outcomes timestamped before their action", async () => {
    const writes: Array<{ eventType: string; data: Record<string, unknown> }> = [];
    const service = new DiscoveryObservatoryService(
      {
        query: async (text) =>
          text.includes("discovery_action")
            ? {
                rows: [
                  {
                    data: {
                      journeyId: "dc:work-chronology",
                      workRequestId: "work-chronology",
                      entity: { slug: "provider" },
                      occurredAt: NOW.toISOString(),
                      entryLinkage: "server_observed_match",
                    },
                  },
                ],
              }
            : { rows: [] },
      },
      async (eventType, data) => writes.push({ eventType, data }),
      () => NOW
    );
    const beforeAction = new Date(NOW.getTime() - 1);
    expect(
      await service.recordProviderDeliveryAttempt({
        workRequestId: "work-chronology",
        state: "queued",
        occurredAt: beforeAction,
      })
    ).toBe(false);
    expect(
      await service.recordJourneyOutcome({
        workRequestId: "work-chronology",
        kind: "provider_response",
        state: "accepted",
        actorAuthority: "authenticated_assigned_provider",
        occurredAt: beforeAction,
      })
    ).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("deduped snapshot and current-evidence experiment ranking", () => {
  it("dedupes funnel grain and exposes all operating views", async () => {
    const eventRows = [
      {
        id: "entry-1",
        event_type: "discovery_landing",
        data: {
          entryRequestId: "same-entry",
          businessSlug: "unclaimed-provider",
          canonicalRoute: "/business/unclaimed-provider",
        },
        created_at: NOW,
      },
      {
        id: "entry-2",
        event_type: "discovery_landing",
        data: {
          entryRequestId: "same-entry",
          businessSlug: "unclaimed-provider",
          canonicalRoute: "/business/unclaimed-provider",
        },
        created_at: NOW,
      },
      {
        id: "action-1",
        event_type: DISCOVERY_ACTION_EVENT,
        data: {
          journeyId: "dc:work-1",
          workRequestId: "work-1",
          entryRequestId: "same-entry",
          entryLinkage: "server_observed_match",
          entity: { slug: "unclaimed-provider" },
          occurredAt: NOW.toISOString(),
        },
        created_at: NOW,
      },
      {
        id: "action-2",
        event_type: DISCOVERY_ACTION_EVENT,
        data: {
          journeyId: "dc:work-1",
          workRequestId: "work-1",
          entity: { slug: "unclaimed-provider" },
          occurredAt: NOW.toISOString(),
        },
        created_at: NOW,
      },
      {
        id: "action-second-request-same-entry",
        event_type: DISCOVERY_ACTION_EVENT,
        data: {
          journeyId: "dc:work-1b",
          workRequestId: "work-1b",
          entryRequestId: "same-entry",
          entryLinkage: "server_observed_match",
          entity: { slug: "unclaimed-provider" },
          occurredAt: NOW.toISOString(),
        },
        created_at: NOW,
      },
      {
        id: "response-1",
        event_type: DISCOVERY_OUTCOME_EVENT,
        data: {
          journeyId: "dc:work-1",
          workRequestId: "work-1",
          outcomeKind: "provider_response",
          entity: { slug: "unclaimed-provider" },
          occurredAt: NOW.toISOString(),
        },
        created_at: NOW,
      },
      {
        id: "response-2",
        event_type: DISCOVERY_OUTCOME_EVENT,
        data: {
          journeyId: "dc:work-1",
          workRequestId: "work-1",
          outcomeKind: "provider_response",
          entity: { slug: "unclaimed-provider" },
          occurredAt: NOW.toISOString(),
        },
        created_at: NOW,
      },
      {
        id: "action-temporal-orphan",
        event_type: DISCOVERY_ACTION_EVENT,
        data: {
          journeyId: "dc:work-2",
          workRequestId: "work-2",
          entity: { slug: "claimed-provider" },
          occurredAt: NOW.toISOString(),
        },
        created_at: NOW,
      },
      {
        id: "response-before-action",
        event_type: DISCOVERY_OUTCOME_EVENT,
        data: {
          journeyId: "dc:work-2",
          workRequestId: "work-2",
          outcomeKind: "provider_response",
          entity: { slug: "claimed-provider" },
          occurredAt: "2026-08-08T16:44:00.000Z",
        },
        created_at: "2026-08-08T16:44:00.000Z",
      },
      {
        id: "not-observed-1",
        event_type: DISCOVERY_OBSERVATION_EVENT,
        data: {
          observationId: "stable-not-observed-1",
          source: "web_search",
          surface: "web_search",
          resultState: "not_observed",
          sourceFreshUntil: "2026-09-01T00:00:00.000Z",
          sourceFreshUntilPrecision: "instant",
          citedUrl: "https://outside.example/result",
          observedAt: NOW.toISOString(),
          observedAtPrecision: "instant",
        },
        created_at: NOW,
      },
      {
        id: "not-observed-2",
        event_type: DISCOVERY_OBSERVATION_EVENT,
        data: {
          observationId: "stable-not-observed-2",
          source: "web_search",
          surface: "web_search",
          resultState: "not_observed",
          sourceFreshUntil: "2026-09-01T00:00:00.000Z",
          sourceFreshUntilPrecision: "instant",
          citedUrl: "https://outside.example/result",
          outsideEntity: { name: "Explicit Name", relationship: "competitor" },
          observedAt: NOW.toISOString(),
          observedAtPrecision: "instant",
        },
        created_at: NOW,
      },
      {
        id: "not-observed-retry",
        event_type: DISCOVERY_OBSERVATION_EVENT,
        data: {
          observationId: "stable-not-observed-1",
          source: "web_search",
          surface: "web_search",
          resultState: "not_observed",
          sourceFreshUntil: "2026-09-01T00:00:00.000Z",
          sourceFreshUntilPrecision: "instant",
          citedUrl: "https://outside.example/result",
          observedAt: NOW.toISOString(),
          observedAtPrecision: "instant",
        },
        created_at: NOW,
      },
    ];
    const queryable: ObservatoryQueryable = {
      async query(text) {
        if (text.includes("event_type = any")) return { rows: eventRows };
        if (text.includes("from businesses") && text.includes("union all"))
          return {
            rows: [
              {
                entity_type: "business",
                id: "business-1",
                slug: "unclaimed-provider",
                name: "Unclaimed Provider",
                status: "active",
                claim_status: "unclaimed",
                public_discovery_enabled: true,
                profile_data: {
                  category: "roofing",
                  description:
                    "A sufficiently specific public description for a real roofing service in a local market.",
                  services: ["repair"],
                },
                updated_at: NOW,
              },
            ],
          };
        if (text.includes("ts_seo_trade_county_pages")) return { rows: [] };
        if (text.includes("crawler_request_hourly_rollups"))
          return { rows: [{ request_count: 0, observed_at: NOW }] };
        return { rows: [] };
      },
    };
    const snapshot: any = await new DiscoveryObservatoryService(
      queryable,
      async () => undefined,
      () => NOW
    ).getSnapshot(30);
    expect(snapshot.funnel.find((row: any) => row.stage === "entry").count).toBe(1);
    const requestStage = snapshot.funnel.find((row: any) => row.stage === "request");
    expect(requestStage.count).toBe(3);
    expect(requestStage.rateNumerator).toBe(1);
    expect(requestStage.denominator).toBe(1);
    expect(snapshot.funnel.find((row: any) => row.stage === "provider_response").count).toBe(1);
    expect(snapshot.quality.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "event_before_action" })])
    );
    expect(snapshot.aggregation.joinMultiplication).toBe(false);
    expect(snapshot.observations).toHaveLength(2);
    expect(snapshot.quality.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duplicate_observation_identity" })])
    );
    expect(snapshot.operatingViews.unclaimedDemand).toEqual([
      expect.objectContaining({ slug: "unclaimed-provider", entryCount: 1, actionCount: 2 }),
    ]);
    expect(snapshot.operatingViews).toEqual(
      expect.objectContaining({
        entrySourceHints: expect.any(Array),
        entriesWithoutActions: expect.any(Array),
        repeatedOutsideSources: expect.any(Array),
        repeatedExplicitCompetitors: expect.any(Array),
      })
    );
    expect(snapshot.operatingViews.entrySourceHints).toEqual([
      expect.objectContaining({ entryCount: 1, sourceHint: null, referrerHost: null }),
    ]);
    expect(snapshot.operatingViews.repeatedOutsideSources).toEqual([]);
    expect(snapshot.operatingViews.repeatedExplicitCompetitors).toEqual([]);
    expect(snapshot.experiments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentState: "proposed_unapproved",
          assignmentCount: 0,
          intendedCustomerAction: expect.any(String),
        }),
      ])
    );
  });

  it("scores and ranks templates from current evidence", () => {
    const queue = rankDiscoveryExperiments({
      observations: [
        {
          id: "obs",
          eventType: DISCOVERY_OBSERVATION_EVENT,
          data: {
            resultState: "not_observed",
            sourceFreshUntil: "2026-09-01T00:00:00.000Z",
            sourceFreshUntilPrecision: "instant",
            entity: { slug: "jrs-auto-glass" },
          },
          createdAt: NOW,
        },
      ],
      classifications: [],
      marketPages: [],
      zeroResultQueries: [],
      now: NOW,
    });
    expect(queue[0].experimentId).toBe("wave1-non-jw-transfer-jrs");
    expect(queue[0].score).toBeGreaterThan(100);
    expect(queue.map((item) => item.rank)).toEqual([1, 2, 3]);
  });
});

describe("admin-only and lifecycle wiring", () => {
  it("mounts behind authentication and super-admin middleware", () => {
    expect(read("server/routes/admin-discovery-observatory.ts")).toContain(
      "router.use(isAuthenticated, isSuperAdmin)"
    );
    expect(read("server/routes/admin.ts")).toContain(
      'app.use("/api/admin/discovery-observatory", adminDiscoveryObservatoryRouter)'
    );
    const service = read("server/services/discoveryObservatoryService.ts");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("DISCOVERY_EXPERIMENT_OWNER_APPROVAL_REQUIRED");
  });

  it("records actual responses and verified completion while preserving unknown delivery reach", () => {
    expect(read("server/routes/tradepartner-express.ts")).toContain(
      "recordProviderDeliveryAttempt"
    );
    const direct = read("server/routes/direct-connect.ts");
    expect(direct).toContain('kind: "provider_response"');
    expect(direct).toContain('actorAuthority: "authenticated_assigned_provider"');
    expect(direct).toContain('kind: "requester_verified_complete"');
    expect(read("server/services/discoveryObservatoryService.ts")).toContain(
      'reachedCorrectHuman: "unknown_unavailable"'
    );
  });
});
