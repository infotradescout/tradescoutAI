import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DiscoveryObservatoryService,
  type ObservatoryQueryable,
} from "../server/services/discoveryObservatoryService";
import { validateDiscoveryRecords, type DiscoveryQualityRow } from "../shared/discoveryObservatory";

const fixedNow = new Date("2026-08-08T16:45:03.000Z");
const rows: DiscoveryQualityRow[] = [
  {
    id: "event-entry-1",
    eventType: "discovery_landing",
    data: {
      type: "discovery_landing",
      entryRequestId: "entry-local-proof-1",
      businessSlug: "disposable-provider",
      canonicalRoute: "/business/disposable-provider",
      ts: "2026-08-08T16:44:00.000Z",
    },
    createdAt: "2026-08-08T16:44:00.000Z",
  },
];

const queryable: ObservatoryQueryable = {
  async query(text, values = []) {
    if (text.includes("event_type = 'discovery_landing'")) {
      const [entryRequestId, businessSlug, actionAt, lookbackStart] = values.map(String);
      return {
        rows: rows
          .filter(
            (row) =>
              row.eventType === "discovery_landing" &&
              row.data.entryRequestId === entryRequestId &&
              row.data.businessSlug === businessSlug &&
              new Date(String(row.createdAt)).getTime() <= new Date(actionAt).getTime() &&
              new Date(String(row.createdAt)).getTime() >= new Date(lookbackStart).getTime()
          )
          .map((row) => ({ id: row.id })),
      };
    }
    if (text.includes("event_type = 'discovery_action'")) {
      const workRequestId = String(values[0]);
      const row = rows.find(
        (candidate) =>
          candidate.eventType === "discovery_action" &&
          candidate.data.workRequestId === workRequestId
      );
      return { rows: row ? [{ data: row.data }] : [] };
    }
    return { rows: [] };
  },
};

let rowSequence = 1;
const service = new DiscoveryObservatoryService(
  queryable,
  async (eventType, data) => {
    rowSequence += 1;
    rows.push({
      id: `event-${rowSequence}`,
      eventType,
      data,
      createdAt: String(data.occurredAt || data.observedAt || fixedNow.toISOString()),
    });
  },
  () => fixedNow
);

const evidenceBundle = JSON.parse(
  readFileSync(
    path.resolve(
      process.cwd(),
      "artifacts/evidence/2026-08-08-tradescout-discovery-observatory-wave1/external-observations.json"
    ),
    "utf8"
  )
) as { runtimeSeed: boolean; automaticImport: boolean; observations: unknown[] };
assert.equal(evidenceBundle.runtimeSeed, false);
assert.equal(evidenceBundle.automaticImport, false);
for (const item of evidenceBundle.observations) await service.captureObservation(item);

const context = await service.recordRequestAction({
  workRequestId: "work-local-proof-1",
  businessSlug: "disposable-provider",
  businessId: "business-local-proof-1",
  entryRequestId: "entry-local-proof-1",
});
assert.equal(context.entryLinkage, "server_observed_match");

await service.recordProviderDeliveryAttempt({
  workRequestId: "work-local-proof-1",
  state: "target_delivery_queued_or_sent",
  details: { ownerNotificationStatus: "sent" },
});
await service.recordJourneyOutcome({
  workRequestId: "work-local-proof-1",
  kind: "provider_response",
  state: "accepted",
  actorAuthority: "authenticated_assigned_provider",
});
await service.recordJourneyOutcome({
  workRequestId: "work-local-proof-1",
  kind: "requester_verified_complete",
  state: "completed",
  actorAuthority: "authenticated_requester",
});

const issues = validateDiscoveryRecords(rows, fixedNow);
assert.deepEqual(issues, []);
const stages = rows.map((row) =>
  row.eventType === "discovery_outcome"
    ? row.data.outcomeKind
    : row.eventType === "discovery_delivery"
      ? row.data.stage
      : row.eventType
);
assert.deepEqual(stages, [
  "discovery_landing",
  "discovery_observation",
  "discovery_observation",
  "discovery_observation",
  "discovery_observation",
  "discovery_action",
  "provider_notification_attempted",
  "provider_response",
  "requester_verified_complete",
]);
assert.equal(
  rows.some(
    (row) =>
      JSON.stringify(row.data).includes("@") || /\d{3}-\d{3}-\d{4}/.test(JSON.stringify(row.data))
  ),
  false
);

console.log(
  JSON.stringify(
    {
      ok: true,
      disposable: true,
      externalCalls: 0,
      productionWrites: 0,
      providerNotifications: 0,
      entryLinkage: context.entryLinkage,
      capturedOperatorObservations: evidenceBundle.observations.length,
      observationPrecision: "day",
      stages,
      qualityIssues: issues.length,
    },
    null,
    2
  )
);
