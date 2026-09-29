import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ select: vi.fn(), groupBy: vi.fn() }));

vi.mock("../db", () => ({ db: { select: mock.select } }));

const observedAt = new Date("2026-09-29T12:00:00.000Z");

function runtimeState(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    lastAttemptAt: new Date(observedAt.getTime() - 60_000),
    lastSuccessfulTickAt: new Date(observedAt.getTime() - 2 * 60_000),
    lastFailureAt: new Date(observedAt.getTime() - 3 * 60_000),
    lastErrorCode: null,
    ...overrides,
  };
}

function queueSelectResults(...results: Array<unknown[]>) {
  const remaining = [...results];
  mock.select.mockImplementation(() => {
    const rows = remaining.shift();
    const result = Object.assign(Promise.resolve(rows), {
      groupBy: mock.groupBy.mockImplementation(() => Promise.resolve(rows)),
    });
    return { from: () => ({ where: () => result }) };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(observedAt);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Presence operator aggregate health", () => {
  it("groups only active customer tasks by kind and status and retains backlog fields", async () => {
    queueSelectResults(
      [runtimeState("site_path"), runtimeState("confirm_facts")],
      [
        { kind: "select_site_path", status: "waiting_customer", total: 7 },
        { kind: "confirm_facts", status: "waiting_customer", total: 4 },
        { kind: "confirm_facts", status: "retrying", total: 2 },
        { kind: "select_site_path", status: "terminal_attention", total: 3 },
      ],
      [{ total: 2, oldestDueAt: new Date(observedAt.getTime() - 60_000) }]
    );
    const { presenceCustomerTaskHealth } = await import("../services/presenceCustomerTasks");
    const health = await presenceCustomerTaskHealth();

    expect(health.activeTasks).toEqual({
      waitingCustomer: { select_site_path: 7, confirm_facts: 4, total: 11 },
      retrying: { select_site_path: 0, confirm_facts: 2, total: 2 },
      terminalAttention: { select_site_path: 3, confirm_facts: 0, total: 3 },
      totalActive: 16,
    });
    expect(health.terminalAttentionCount).toBe(3);
    expect(health.dueBacklogCount).toBe(2);
    expect(health.reminderAutomationStatus).toBe("healthy");
    expect(health.observedAt).toBe(observedAt.toISOString());
    expect(mock.select).toHaveBeenCalledTimes(3);
    expect(mock.groupBy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(health)).not.toMatch(/ownerUserId|businessId|profileId|factValue/);
  });

  it.each([
    {
      name: "one runtime that never succeeded",
      states: [
        runtimeState("site_path"),
        runtimeState("confirm_facts", {
          lastSuccessfulTickAt: null,
        }),
      ],
    },
    {
      name: "a failure after the latest success",
      states: [
        runtimeState("site_path"),
        runtimeState("confirm_facts", {
          lastFailureAt: new Date(observedAt.getTime() - 60_000),
          lastErrorCode: "PRESENCE_TASK_TICK_FAILED",
        }),
      ],
    },
    {
      name: "a success timestamp one minute in the future",
      states: [
        runtimeState("site_path"),
        runtimeState("confirm_facts", {
          lastSuccessfulTickAt: new Date(observedAt.getTime() + 60_000),
        }),
      ],
    },
    {
      name: "a success timestamp over two minutes in the future",
      states: [
        runtimeState("site_path"),
        runtimeState("confirm_facts", {
          lastSuccessfulTickAt: new Date(observedAt.getTime() + 3 * 60_000),
        }),
      ],
    },
    {
      name: "a success timestamp over 32 minutes old",
      states: [
        runtimeState("site_path"),
        runtimeState("confirm_facts", {
          lastSuccessfulTickAt: new Date(observedAt.getTime() - 33 * 60_000),
        }),
      ],
    },
  ])("marks automation degraded for $name", async ({ states }) => {
    queueSelectResults(states, [], [{ total: 0, oldestDueAt: null }]);
    const { presenceCustomerTaskHealth } = await import("../services/presenceCustomerTasks");
    const health = await presenceCustomerTaskHealth();
    expect(health.reminderAutomationStatus).toBe("degraded");
    expect(health.activeTasks.totalActive).toBe(0);
  });

  it("rejects a missing runtime row before representing zero work as healthy", async () => {
    queueSelectResults([runtimeState("site_path")]);
    const { presenceCustomerTaskHealth } = await import("../services/presenceCustomerTasks");
    await expect(presenceCustomerTaskHealth()).rejects.toThrow("Presence task runtime unavailable");
    expect(mock.select).toHaveBeenCalledTimes(1);
  });
});
