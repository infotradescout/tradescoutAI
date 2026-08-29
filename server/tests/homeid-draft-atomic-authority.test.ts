import { describe, expect, it, vi } from "vitest";
import {
  createHomeIdPacketDraftWithTransaction,
  persistHomeIdFullGraphWithTransaction,
  submitHomeIdPacketDraftWithTransaction,
  type HomeIdPacketDraftCreateAdapter,
  type HomeIdPacketDraftCreateInput,
  type HomeIdPacketDraftSubmitAdapter,
} from "../services/homeIdPacketAuthority";

const NOW = new Date("2026-08-29T12:00:00.000Z");
const USER_ID = "user_1";
const HOME_ID = "home_1";
const PACKET_ID = "packet_1";

const detail = {
  id: "detail_1",
  category: "roof",
  note: "Roof replaced in 2024",
  status: "known" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  savedAt: "2026-08-01T00:00:00.000Z",
};

const graph = {
  packet: {
    id: PACKET_ID,
    requestType: "repair",
    selectedDetailIds: [detail.id],
    missingHelpfulInfo: [],
    missingHelpfulInfoCount: 0,
    status: "ready_for_handoff" as const,
    createdAt: "2026-08-01T00:00:00.000Z",
    savedAt: "2026-08-01T00:00:00.000Z",
  },
  selectedDetails: [detail],
};

const authority = () => ({ ok: true as const, userId: USER_ID, homeId: HOME_ID, graph });

const createInput = (overrides: Partial<HomeIdPacketDraftCreateInput> = {}) => ({
  userId: USER_ID,
  title: "Roof repair for HomeID",
  description: "Review the saved roof context before this request becomes live.",
  category: "repair",
  homeId: HOME_ID,
  packetId: PACKET_ID,
  claimedSelectedDetailIds: [detail.id],
  readinessState: "ready_for_handoff",
  homeContextIntent: "update_from_request",
  autoRoute: false,
  now: NOW,
  ...overrides,
});

type DraftState = {
  requests: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  timelineRecords: Array<Record<string, any>>;
};

async function atomic<T>(state: DraftState, work: (working: DraftState) => Promise<T>): Promise<T> {
  const working = structuredClone(state);
  const result = await work(working);
  state.requests = working.requests;
  state.events = working.events;
  state.timelineRecords = working.timelineRecords;
  return result;
}

function createAdapter(
  state: DraftState,
  options: {
    authority?: ReturnType<typeof authority> | { ok: false; reason: any };
    failEvent?: boolean;
  } = {}
): HomeIdPacketDraftCreateAdapter {
  return {
    resolveAuthority: vi.fn(async () => options.authority ?? authority()),
    insertRequest: vi.fn(async (values) => {
      const request = { ...values, id: `request_${state.requests.length + 1}` };
      state.requests.push(request);
      return request;
    }),
    insertLifecycleEvent: vi.fn(async (event) => {
      if (options.failEvent) throw new Error("event insert failed");
      state.events.push(event);
    }),
  };
}

function submitAdapter(
  state: DraftState,
  options: {
    nextGraph?: typeof graph;
    failEventType?: string;
    hasAssignments?: boolean;
    failTimeline?: boolean;
  } = {}
): HomeIdPacketDraftSubmitAdapter {
  return {
    lockRequest: async (requestId) =>
      (state.requests.find((request) => request.id === requestId) as any) || null,
    hasAssignments: async () => options.hasAssignments === true,
    listLifecycleEvents: async (requestId) =>
      state.events.filter((event) => event.workRequestId === requestId) as any,
    resolveAuthority: async () => ({
      ok: true,
      userId: USER_ID,
      homeId: HOME_ID,
      graph: options.nextGraph ?? graph,
    }),
    insertLifecycleEvent: async (event) => {
      if (event.type === options.failEventType) throw new Error(`${event.type} insert failed`);
      state.events.push(event);
    },
    countSubmissionTimelineRecords: async ({ requestId }) =>
      state.timelineRecords.filter((record) => record.requestId === requestId).length,
    insertSubmissionTimelineRecord: async (record) => {
      if (options.failTimeline) throw new Error("timeline insert failed");
      state.timelineRecords.push(record);
    },
    transitionDraftToOpen: async ({ requestId }) => {
      const request = state.requests.find((candidate) => candidate.id === requestId);
      if (!request || request.status !== "draft") return false;
      request.status = "open";
      request.scope = "community";
      request.visibility = "community";
      return true;
    },
  };
}

async function seedDraft(state: DraftState) {
  const result = await atomic(state, (working) =>
    createHomeIdPacketDraftWithTransaction(createAdapter(working), createInput())
  );
  if (!result.ok) throw new Error(`seed failed: ${result.reason}`);
  return result;
}

const routingAttacks: Array<[string, Partial<HomeIdPacketDraftCreateInput>]> = [
  ["auto route", { autoRoute: true }],
  ["contractor target", { targetContractorIds: ["contractor_1"] }],
  ["provider target", { targetProviderIds: ["provider_1"] }],
  ["profile target", { targetProfileSlug: "crafted-target" }],
  ["target attribution", { discoveryAttributionToken: "crafted.token" }],
];

describe("HomeID draft transactional authority", () => {
  it.each(routingAttacks)(
    "rejects crafted %s fields before graph or request writes",
    async (_name, attack) => {
      const state: DraftState = { requests: [], events: [], timelineRecords: [] };
      const adapter = createAdapter(state);
      const result = await createHomeIdPacketDraftWithTransaction(adapter, createInput(attack));

      expect(result).toEqual({ ok: false, reason: "routing_targets_forbidden" });
      expect(adapter.resolveAuthority).not.toHaveBeenCalled();
      expect(adapter.insertRequest).not.toHaveBeenCalled();
      expect(state).toEqual({ requests: [], events: [], timelineRecords: [] });
    }
  );

  it("creates only a private personal draft and its immutable provenance event", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const result = await atomic(state, (working) =>
      createHomeIdPacketDraftWithTransaction(createAdapter(working), createInput())
    );

    expect(result).toMatchObject({ ok: true, draft: { status: "draft", audience: "requester" } });
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]).toMatchObject({
      status: "draft",
      scope: "personal",
      visibility: "private",
      shareToken: null,
    });
    expect(state.events.map((event) => event.type)).toEqual(["homeid_draft_created"]);
    expect(state.events[0].metadata).toMatchObject({
      source: "homeid_packet",
      homeId: HOME_ID,
      homePacketId: PACKET_ID,
      directConnectRequestId: "request_1",
    });
  });

  it("leaves no request behind when provenance cannot be established", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const adapter = createAdapter(state, {
      authority: { ok: false, reason: "invalid_packet_graph" },
    });
    const result = await atomic(state, (working) =>
      createHomeIdPacketDraftWithTransaction(
        { ...adapter, insertRequest: createAdapter(working).insertRequest },
        createInput()
      )
    );

    expect(result).toEqual({ ok: false, reason: "invalid_packet_graph" });
    expect(state).toEqual({ requests: [], events: [], timelineRecords: [] });
  });

  it("rolls back the request when the immutable created-event insert fails", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    await expect(
      atomic(state, (working) =>
        createHomeIdPacketDraftWithTransaction(
          createAdapter(working, { failEvent: true }),
          createInput()
        )
      )
    ).rejects.toThrow("event insert failed");
    expect(state).toEqual({ requests: [], events: [], timelineRecords: [] });
  });

  it("serializes concurrent submits into one transition and an identical stable retry", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const seeded = await seedDraft(state);
    const submitInput = {
      userId: USER_ID,
      requestId: seeded.draft.requestId,
      claimedHomeId: HOME_ID,
      claimedPacketId: PACKET_ID,
      claimedSelectedDetailIds: [detail.id],
      now: NOW,
    };
    let queue = Promise.resolve();
    const serialized = () => {
      const run = queue.then(() =>
        atomic(state, (working) =>
          submitHomeIdPacketDraftWithTransaction(submitAdapter(working), submitInput)
        )
      );
      queue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    };

    const [first, retry] = await Promise.all([serialized(), serialized()]);
    expect(first).toMatchObject({ ok: true, idempotent: false, status: "open" });
    expect(retry).toMatchObject({ ok: true, idempotent: true, status: "open" });
    expect(state.events.map((event) => event.type)).toEqual([
      "homeid_draft_created",
      "homeid_draft_reviewed",
      "homeid_draft_submitted",
    ]);
    expect(state.requests[0]).toMatchObject({
      status: "open",
      scope: "community",
      visibility: "community",
    });
    expect(state.timelineRecords).toHaveLength(1);
  });

  it("fails a conflicting retry closed without adding lifecycle events", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const seeded = await seedDraft(state);
    const valid = {
      userId: USER_ID,
      requestId: seeded.draft.requestId,
      claimedHomeId: HOME_ID,
      claimedPacketId: PACKET_ID,
      claimedSelectedDetailIds: [detail.id],
      now: NOW,
    };
    await atomic(state, (working) =>
      submitHomeIdPacketDraftWithTransaction(submitAdapter(working), valid)
    );
    const result = await atomic(state, (working) =>
      submitHomeIdPacketDraftWithTransaction(submitAdapter(working), {
        ...valid,
        claimedSelectedDetailIds: ["detail_other"],
      })
    );

    expect(result).toEqual({ ok: false, reason: "lifecycle_provenance_invalid" });
    expect(state.events).toHaveLength(3);
    expect(state.timelineRecords).toHaveLength(1);
  });

  it("rejects a graph changed after draft creation before any submit write", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const seeded = await seedDraft(state);
    const changedGraph = {
      ...graph,
      selectedDetails: [{ ...detail, note: "Roof details changed after draft creation" }],
    };
    const result = await atomic(state, (working) =>
      submitHomeIdPacketDraftWithTransaction(submitAdapter(working, { nextGraph: changedGraph }), {
        userId: USER_ID,
        requestId: seeded.draft.requestId,
        claimedHomeId: HOME_ID,
        claimedPacketId: PACKET_ID,
        claimedSelectedDetailIds: [detail.id],
      })
    );

    expect(result).toEqual({ ok: false, reason: "packet_graph_changed" });
    expect(state.requests[0].status).toBe("draft");
    expect(state.events.map((event) => event.type)).toEqual(["homeid_draft_created"]);
    expect(state.timelineRecords).toEqual([]);
  });

  it("rolls back reviewed state when the submitted-event insert fails", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const seeded = await seedDraft(state);
    await expect(
      atomic(state, (working) =>
        submitHomeIdPacketDraftWithTransaction(
          submitAdapter(working, { failEventType: "homeid_draft_submitted" }),
          {
            userId: USER_ID,
            requestId: seeded.draft.requestId,
            claimedHomeId: HOME_ID,
            claimedPacketId: PACKET_ID,
            claimedSelectedDetailIds: [detail.id],
          }
        )
      )
    ).rejects.toThrow("homeid_draft_submitted insert failed");
    expect(state.requests[0].status).toBe("draft");
    expect(state.events.map((event) => event.type)).toEqual(["homeid_draft_created"]);
    expect(state.timelineRecords).toEqual([]);
  });

  it("rejects a contaminated draft with a provider assignment before submit writes", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const seeded = await seedDraft(state);
    const result = await atomic(state, (working) =>
      submitHomeIdPacketDraftWithTransaction(
        submitAdapter(working, { hasAssignments: true }),
        {
          userId: USER_ID,
          requestId: seeded.draft.requestId,
          claimedHomeId: HOME_ID,
          claimedPacketId: PACKET_ID,
          claimedSelectedDetailIds: [detail.id],
        }
      )
    );

    expect(result).toEqual({ ok: false, reason: "draft_isolation_invalid" });
    expect(state.requests[0].status).toBe("draft");
    expect(state.events.map((event) => event.type)).toEqual(["homeid_draft_created"]);
    expect(state.timelineRecords).toEqual([]);
  });

  it("rolls back the live transition when the HomeID timeline write fails", async () => {
    const state: DraftState = { requests: [], events: [], timelineRecords: [] };
    const seeded = await seedDraft(state);
    await expect(
      atomic(state, (working) =>
        submitHomeIdPacketDraftWithTransaction(
          submitAdapter(working, { failTimeline: true }),
          {
            userId: USER_ID,
            requestId: seeded.draft.requestId,
            claimedHomeId: HOME_ID,
            claimedPacketId: PACKET_ID,
            claimedSelectedDetailIds: [detail.id],
          }
        )
      )
    ).rejects.toThrow("timeline insert failed");

    expect(state.requests[0]).toMatchObject({
      status: "draft",
      scope: "personal",
      visibility: "private",
    });
    expect(state.events.map((event) => event.type)).toEqual(["homeid_draft_created"]);
    expect(state.timelineRecords).toEqual([]);
  });
});

type PersistenceState = { records: Array<Record<string, any>> };

async function atomicPersistence<T>(
  state: PersistenceState,
  work: (working: PersistenceState) => Promise<T>
) {
  const working = structuredClone(state);
  const result = await work(working);
  state.records = working.records;
  return result;
}

const persistenceInput = {
  userId: USER_ID,
  homeId: HOME_ID,
  propertyDetails: [detail],
  requestPackets: [graph.packet],
  now: NOW,
};

describe("HomeID full-graph persistence transaction", () => {
  it("rejects an invalid prospective graph before locking or writing", async () => {
    const lockOwnedHome = vi.fn(async () => true);
    const writeGraphRecord = vi.fn(async () => undefined);
    const result = await persistHomeIdFullGraphWithTransaction(
      {
        lockOwnedHome,
        listGraphRecords: async () => [],
        writeGraphRecord,
      },
      { ...persistenceInput, requestPackets: [{ id: PACKET_ID }] }
    );

    expect(result).toEqual({ ok: false, reason: "invalid_packet_graph" });
    expect(lockOwnedHome).not.toHaveBeenCalled();
    expect(writeGraphRecord).not.toHaveBeenCalled();
  });

  it("rolls back both authority records when the second write fails", async () => {
    const state: PersistenceState = { records: [] };
    await expect(
      atomicPersistence(state, (working) =>
        persistHomeIdFullGraphWithTransaction(
          {
            lockOwnedHome: async () => true,
            listGraphRecords: async () => [],
            writeGraphRecord: async (record) => {
              if (record.title.endsWith("request_packets")) throw new Error("packet write failed");
              working.records.push(record);
            },
          },
          persistenceInput
        )
      )
    ).rejects.toThrow("packet write failed");
    expect(state.records).toEqual([]);
  });

  it("writes the complete valid graph as one atomic persistence result", async () => {
    const state: PersistenceState = { records: [] };
    const result = await atomicPersistence(state, (working) =>
      persistHomeIdFullGraphWithTransaction(
        {
          lockOwnedHome: async () => true,
          listGraphRecords: async () => [],
          writeGraphRecord: async (record) => {
            working.records.push(record);
          },
        },
        persistenceInput
      )
    );

    expect(result).toMatchObject({ ok: true, persistence: { updatedAt: NOW.toISOString() } });
    expect(state.records.map((record) => record.title)).toEqual([
      "homeid:persistence:property_details",
      "homeid:persistence:request_packets",
    ]);
  });
});
