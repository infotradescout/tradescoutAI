export const DIRECT_CONNECT_FUNNEL_ORDER = [
  "direct_connect_request_started",
  "direct_connect_request_review_opened",
  "direct_connect_request_submitted",
  "direct_connect_visible_to_contractors",
  "direct_connect_contractor_action_started",
  "direct_connect_requester_reply_viewed",
] as const;

export type DirectConnectFunnelStage = (typeof DIRECT_CONNECT_FUNNEL_ORDER)[number];

const FUNNEL_STAGE_INDEX = new Map<string, number>(
  DIRECT_CONNECT_FUNNEL_ORDER.map((eventType, index) => [eventType, index])
);

const FUNNEL_EVENT_ALIASES = new Map<string, DirectConnectFunnelStage>([
  ["direct_connect_request_visible_to_contractors", "direct_connect_visible_to_contractors"],
  ["direct_connect_request_submitted_after_home_record_skip", "direct_connect_request_submitted"],
  ["homeid_direct_connect_request_submitted", "direct_connect_request_submitted"],
]);

export type DirectConnectFunnelEventRow = {
  identityKey: string;
  eventType: string;
  createdAt: Date;
};

export type ExistingDirectConnectFunnelStall = {
  identityKey: string;
  startedAt: Date;
  funnelStep?: string | null;
};

export type DirectConnectFunnelStall = {
  identityKey: string;
  funnelStep: DirectConnectFunnelStage;
  startedAt: Date;
  stepReachedAt: Date;
};

export function normalizeDirectConnectFunnelEvent(
  eventType: string
): DirectConnectFunnelStage | null {
  const alias = FUNNEL_EVENT_ALIASES.get(eventType);
  if (alias) return alias;
  return FUNNEL_STAGE_INDEX.has(eventType) ? (eventType as DirectConnectFunnelStage) : null;
}

function buildStallKey(
  identityKey: string,
  startedAt: Date,
  funnelStep: string | null | undefined
): string {
  return `${identityKey}::${startedAt.getTime()}::${funnelStep || "legacy"}`;
}

/**
 * Finds the highest funnel stage reached within each request attempt. A new
 * request_started event begins a new attempt. The clock starts when that stage
 * is first reached; duplicate telemetry cannot postpone a real stall.
 */
export function computeDirectConnectFunnelStalls(params: {
  events: DirectConnectFunnelEventRow[];
  alreadyStalled: ExistingDirectConnectFunnelStall[];
  windowMs: number;
  now: Date;
}): DirectConnectFunnelStall[] {
  const { events, alreadyStalled, windowMs, now } = params;
  if (!Number.isFinite(windowMs) || windowMs < 0 || Number.isNaN(now.getTime())) return [];

  const alreadyStalledKeys = new Set(
    alreadyStalled.flatMap((entry) => {
      if (!entry.identityKey || Number.isNaN(entry.startedAt.getTime())) return [];
      return entry.funnelStep
        ? [buildStallKey(entry.identityKey, entry.startedAt, entry.funnelStep)]
        : DIRECT_CONNECT_FUNNEL_ORDER.map((step) =>
            buildStallKey(entry.identityKey, entry.startedAt, step)
          );
    })
  );

  const byIdentity = new Map<string, DirectConnectFunnelEventRow[]>();
  for (const row of events) {
    const canonical = normalizeDirectConnectFunnelEvent(String(row.eventType || ""));
    if (!canonical || !row.identityKey || Number.isNaN(row.createdAt.getTime())) continue;
    const list = byIdentity.get(row.identityKey) || [];
    list.push({ ...row, eventType: canonical });
    byIdentity.set(row.identityKey, list);
  }

  const stalls: DirectConnectFunnelStall[] = [];

  for (const [identityKey, identityRows] of byIdentity) {
    const rows = [...identityRows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const starts = rows.filter(
      (row) => row.eventType === "direct_connect_request_started"
    );

    for (let attemptIndex = 0; attemptIndex < starts.length; attemptIndex += 1) {
      const started = starts[attemptIndex];
      const nextStarted = starts[attemptIndex + 1];
      const attemptEnd = nextStarted?.createdAt.getTime() ?? Number.POSITIVE_INFINITY;
      const attemptRows = rows.filter(
        (row) =>
          row.createdAt.getTime() >= started.createdAt.getTime() &&
          row.createdAt.getTime() < attemptEnd
      );

      let highestStageIndex = 0;
      let highestStageReachedAt = started.createdAt;
      for (const row of attemptRows) {
        const stageIndex = FUNNEL_STAGE_INDEX.get(row.eventType);
        if (stageIndex === undefined) continue;
        if (stageIndex > highestStageIndex) {
          highestStageIndex = stageIndex;
          highestStageReachedAt = row.createdAt;
        }
      }

      // Requester reply viewed is the final measured stage; no next-stage stall.
      if (highestStageIndex >= DIRECT_CONNECT_FUNNEL_ORDER.length - 1) continue;
      if (now.getTime() - highestStageReachedAt.getTime() < windowMs) continue;

      const funnelStep = DIRECT_CONNECT_FUNNEL_ORDER[highestStageIndex];
      if (alreadyStalledKeys.has(buildStallKey(identityKey, started.createdAt, funnelStep))) {
        continue;
      }

      stalls.push({
        identityKey,
        funnelStep,
        startedAt: started.createdAt,
        stepReachedAt: highestStageReachedAt,
      });
    }
  }

  return stalls;
}
