import { describe, expect, it } from "vitest";
import ScoutProactiveWatchdog, {
  type UserSuccessSnapshot,
  type WatchdogObjectiveSnapshot,
} from "../services/scoutProactiveWatchdog";

const NOW = new Date("2026-03-08T20:00:00.000Z");

function buildSnapshot(overrides?: Partial<UserSuccessSnapshot>): UserSuccessSnapshot {
  return {
    userId: "watch-user-1",
    role: "homeowner",
    countyFips: "48201",
    lastActiveAt: "2026-03-08T18:00:00.000Z",
    objectives: [
      {
        id: "obj-1",
        title: "Roof repair",
        intentClass: "work_request",
        status: "active",
        completionPct: 45,
        updatedAt: "2026-03-08T18:00:00.000Z",
        route: "/direct-connect",
      },
    ],
    events: [
      { type: "session_start", occurredAt: "2026-03-08T17:30:00.000Z" },
      { type: "action_executed", occurredAt: "2026-03-08T17:40:00.000Z" },
      { type: "objective_updated", occurredAt: "2026-03-08T17:50:00.000Z" },
    ],
    ...overrides,
  };
}

describe("ScoutProactiveWatchdog", () => {
  it("computes inactivity hours from latest event/objective timestamp", () => {
    const snapshot = buildSnapshot();
    const hours = ScoutProactiveWatchdog.computeInactivityHours(snapshot, NOW);

    expect(hours).toBe(2);
  });

  it("returns high inactivity when no timestamps exist", () => {
    const snapshot = buildSnapshot({
      lastActiveAt: undefined,
      objectives: [
        { id: "x", title: "x", status: "active", completionPct: 0, updatedAt: "", route: "/scout" },
      ],
      events: [],
    });

    const hours = ScoutProactiveWatchdog.computeInactivityHours(snapshot, NOW);
    expect(hours).toBe(999);
  });

  it("builds engagement breakdown with bounded scores", () => {
    const snapshot = buildSnapshot();
    const inactivity = ScoutProactiveWatchdog.computeInactivityHours(snapshot, NOW);
    const breakdown = ScoutProactiveWatchdog.computeEngagementBreakdown(snapshot, inactivity, NOW, {
      inactivityThresholdHours: 48,
      staleObjectiveHours: 72,
      interventionCap: 3,
    });

    expect(breakdown.activityScore).toBeGreaterThan(0);
    expect(breakdown.objectiveScore).toBeGreaterThan(0);
    expect(breakdown.executionScore).toBeGreaterThan(0);
    expect(breakdown.consistencyScore).toBeGreaterThan(0);
  });

  it("rolls up engagement score deterministically", () => {
    const first = ScoutProactiveWatchdog.rollupEngagementScore({
      activityScore: 80,
      objectiveScore: 70,
      executionScore: 60,
      consistencyScore: 65,
    });
    const second = ScoutProactiveWatchdog.rollupEngagementScore({
      activityScore: 80,
      objectiveScore: 70,
      executionScore: 60,
      consistencyScore: 65,
    });

    expect(first).toBe(second);
    expect(first).toBeGreaterThan(60);
  });

  it("generates continue_project intervention after 48h inactivity", () => {
    const snapshot = buildSnapshot({
      lastActiveAt: "2026-03-05T10:00:00.000Z",
      objectives: [
        {
          id: "obj-2",
          title: "Kitchen remodel",
          intentClass: "work_request",
          status: "active",
          completionPct: 62,
          updatedAt: "2026-03-05T10:00:00.000Z",
          route: "/direct-connect",
        },
      ],
      events: [],
    });

    const result = ScoutProactiveWatchdog.evaluate(snapshot, NOW);

    expect(result.needsIntervention).toBe(true);
    expect(result.interventions.some((i) => i.type === "continue_project")).toBe(true);
    expect(result.inactivityHours).toBeGreaterThanOrEqual(48);
  });

  it("adds unblock intervention when failures are repeated", () => {
    const snapshot = buildSnapshot({
      events: [
        { type: "action_failed", occurredAt: "2026-03-08T18:00:00.000Z" },
        { type: "action_failed", occurredAt: "2026-03-08T18:05:00.000Z" },
        { type: "action_failed", occurredAt: "2026-03-08T18:10:00.000Z" },
      ],
    });

    const result = ScoutProactiveWatchdog.evaluate(snapshot, NOW);
    expect(result.interventions.some((i) => i.type === "unblock_action")).toBe(true);
  });

  it("includes objective refresh for paused objectives", () => {
    const paused: WatchdogObjectiveSnapshot = {
      id: "obj-paused",
      title: "Community safety post",
      status: "paused",
      completionPct: 20,
      updatedAt: "2026-03-07T10:00:00.000Z",
      route: "/community",
    };

    const snapshot = buildSnapshot({
      objectives: [paused],
      events: [],
      lastActiveAt: "2026-03-07T10:00:00.000Z",
    });

    const result = ScoutProactiveWatchdog.evaluate(snapshot, NOW);
    expect(result.interventions.some((i) => i.type === "objective_refresh")).toBe(true);
  });

  it("caps interventions by configuration", () => {
    const snapshot = buildSnapshot({
      lastActiveAt: "2026-03-05T10:00:00.000Z",
      objectives: [
        {
          id: "obj-3",
          title: "Exterior paint",
          status: "active",
          completionPct: 50,
          updatedAt: "2026-03-05T08:00:00.000Z",
          route: "/direct-connect",
        },
        {
          id: "obj-4",
          title: "HOA complaint",
          status: "paused",
          completionPct: 10,
          updatedAt: "2026-03-05T08:00:00.000Z",
          route: "/community",
        },
      ],
      events: [
        { type: "action_failed", occurredAt: "2026-03-05T09:00:00.000Z" },
        { type: "action_failed", occurredAt: "2026-03-05T09:30:00.000Z" },
      ],
    });

    const result = ScoutProactiveWatchdog.evaluate(snapshot, NOW, { interventionCap: 2 });
    expect(result.interventions.length).toBeLessThanOrEqual(2);
  });

  it("prioritizes interventions by score and urgency", () => {
    const sorted = ScoutProactiveWatchdog.prioritizeInterventions([
      {
        id: "a",
        type: "success_nudge",
        priority: 40,
        urgency: "low",
        title: "A",
        body: "A",
        ctaLabel: "A",
        ctaRoute: "/a",
        reason: "a",
      },
      {
        id: "b",
        type: "continue_project",
        priority: 90,
        urgency: "high",
        title: "B",
        body: "B",
        ctaLabel: "B",
        ctaRoute: "/b",
        reason: "b",
      },
    ]);

    expect(sorted[0].id).toBe("b");
  });

  it("builds contextual next steps from interventions and objectives", () => {
    const snapshot = buildSnapshot();
    const result = ScoutProactiveWatchdog.evaluate(snapshot, NOW);

    expect(result.nextSteps.length).toBeGreaterThan(0);
    expect(result.nextSteps[0].length).toBeGreaterThan(5);
  });

  it("returns low intervention pressure when engagement is high", () => {
    const snapshot = buildSnapshot({
      events: [
        { type: "session_start", occurredAt: "2026-03-08T19:00:00.000Z" },
        { type: "action_executed", occurredAt: "2026-03-08T19:10:00.000Z" },
        { type: "objective_updated", occurredAt: "2026-03-08T19:20:00.000Z" },
        { type: "objective_completed", occurredAt: "2026-03-08T19:40:00.000Z" },
      ],
      objectives: [
        {
          id: "obj-5",
          title: "Fence repair",
          status: "completed",
          completionPct: 100,
          updatedAt: "2026-03-08T19:40:00.000Z",
          route: "/direct-connect",
        },
      ],
      lastActiveAt: "2026-03-08T19:45:00.000Z",
    });

    const result = ScoutProactiveWatchdog.evaluate(snapshot, NOW);
    expect(result.engagementBand).toBe("high");
    expect(result.engagementScore).toBeGreaterThanOrEqual(70);
  });
});
