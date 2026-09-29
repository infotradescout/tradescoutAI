// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PresenceOperatorSummary, unreadWorkSummary } from "./AdminHome";

const observedAt = "2026-09-29T21:00:00.000Z";
type PresenceHealth = NonNullable<ComponentProps<typeof PresenceOperatorSummary>["health"]>;

function sampleHealth(): PresenceHealth {
  return {
    available: true,
    observedAt,
    lastSuccessfulTickAt: "2026-09-29T20:59:30.000Z",
    dueBacklogCount: 0,
    oldestDueAt: null,
    reminderAutomationStatus: "healthy" as const,
    activeTasks: {
      waitingCustomer: { select_site_path: 3, confirm_facts: 2, total: 5 },
      retrying: { select_site_path: 1, confirm_facts: 1, total: 2 },
      terminalAttention: { select_site_path: 0, confirm_facts: 1, total: 1 },
      totalActive: 8,
    },
  };
}

function render(
  health: PresenceHealth | undefined,
  queryState: "loading" | "error" | "ready" = "ready"
) {
  return renderToStaticMarkup(<PresenceOperatorSummary health={health} queryState={queryState} />);
}

function row(markup: string, testId: string) {
  const result = markup.match(new RegExp(`<div data-testid="${testId}"[^>]*>(.*?)</div>`));
  if (!result) throw new Error(`missing ${testId}`);
  return result[1];
}

describe("Presence operator summary", () => {
  it("keeps customer tasks and reminder retries out of the operator inbox", () => {
    vi.setSystemTime(new Date(observedAt));
    try {
      const markup = render(sampleHealth());

      expect(row(markup, "presence-healthy")).toContain("Healthy — reminder automation only");
      expect(row(markup, "presence-healthy")).toContain(
        "The customer reminder scheduler completed recently for both task types."
      );
      expect(row(markup, "presence-healthy")).toContain("Due reminder attempts: 0.");
      expect(row(markup, "presence-healthy")).toContain("does not measure onboarding completeness");
      expect(row(markup, "presence-waiting-customer")).toContain(">5</span>");
      expect(row(markup, "presence-waiting-customer")).toContain(
        "3 site path; 2 fact confirmation"
      );
      expect(row(markup, "presence-automation-retrying")).toContain(">2</span>");
      expect(row(markup, "presence-automation-retrying")).toContain("Automation will retry:");
      expect(row(markup, "presence-human-exception")).toContain(">1 / 8</span>");
      expect(row(markup, "presence-human-exception")).toContain(
        "Automatic reminders stopped after the retry limit. Informational; no operator case or action is available here."
      );
      expect(row(markup, "presence-human-exception")).not.toContain("text-amber-200");
      expect(row(markup, "presence-needs-authorization")).toContain("Not instrumented");
      expect(row(markup, "presence-dangerous-action")).toContain("Not instrumented");
      expect(markup).not.toContain("<button");
      expect(markup).not.toContain(" href=");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not turn unavailable or loading counts into zero", () => {
    for (const queryState of ["loading", "error", "ready"] as const) {
      const markup = render(undefined, queryState);
      expect(row(markup, "presence-healthy")).toContain("Unknown");
      expect(row(markup, "presence-waiting-customer")).toContain("Unknown");
      expect(row(markup, "presence-automation-retrying")).toContain("Unknown");
      expect(row(markup, "presence-human-exception")).toContain("Unknown");
      expect(markup).not.toContain("0 / 0");
    }
  });

  it("marks a stale snapshot as degraded and withholds its task counts", () => {
    vi.setSystemTime(new Date("2026-09-29T21:03:00.000Z"));
    try {
      const markup = render(sampleHealth());
      expect(row(markup, "presence-healthy")).toContain("Degraded");
      expect(row(markup, "presence-healthy")).toContain("Due reminder attempts: unknown.");
      expect(row(markup, "presence-waiting-customer")).toContain("Unknown");
      expect(row(markup, "presence-human-exception")).toContain("Unknown");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not call reminder automation healthy without a valid successful run", () => {
    vi.setSystemTime(new Date(observedAt));
    try {
      const health = sampleHealth();
      health.lastSuccessfulTickAt = "invalid";
      const markup = render(health);
      expect(row(markup, "presence-healthy")).toContain("Degraded");
      expect(row(markup, "presence-waiting-customer")).toContain(">5</span>");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an unfinished due backlog alongside a recent scheduler success", () => {
    vi.setSystemTime(new Date(observedAt));
    try {
      const health = sampleHealth();
      health.dueBacklogCount = 3;
      health.oldestDueAt = "2026-09-29T20:55:00.000Z";
      const markup = render(health);
      const healthyRow = row(markup, "presence-healthy");
      expect(healthyRow).toContain(">Healthy</span>");
      expect(healthyRow).toContain("Due reminder attempts: 3; oldest due");
      expect(healthyRow).toContain(new Date(health.oldestDueAt).toLocaleString());
      expect(healthyRow).not.toContain("operator case");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not present missing, invalid, or stale due backlog as a numeric count", () => {
    vi.setSystemTime(new Date(observedAt));
    try {
      const health = sampleHealth();
      health.dueBacklogCount = undefined;
      expect(row(render(health), "presence-healthy")).toContain("Due reminder attempts: unknown.");
      health.dueBacklogCount = -1;
      expect(row(render(health), "presence-healthy")).toContain("Due reminder attempts: unknown.");
      health.dueBacklogCount = 3;
      health.oldestDueAt = "invalid";
      expect(row(render(health), "presence-healthy")).toContain(
        "Due reminder attempts: 3; oldest due unknown."
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("withholds inconsistent counts instead of inflating a human exception queue", () => {
    vi.setSystemTime(new Date(observedAt));
    try {
      const health = sampleHealth();
      if (!health.activeTasks) throw new Error("missing synthetic tasks");
      health.activeTasks.totalActive = 7;
      const markup = render(health);
      expect(row(markup, "presence-human-exception")).toContain("Unknown");
      expect(row(markup, "presence-waiting-customer")).toContain("Unknown");
      expect(markup).not.toContain("1 / 7");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("operator inbox count availability", () => {
  it("shows unknown rather than a healthy zero when legacy counts fail", () => {
    expect(
      unreadWorkSummary(
        {
          degraded: true,
          countsAvailable: false,
          totalUnread: 0,
          byTool: {},
          presenceTaskHealth: { available: false },
        },
        "ready"
      )
    ).toEqual({
      count: null,
      detail: "Admin queue counts unavailable",
      tone: "warning",
    });
    expect(
      unreadWorkSummary({ degraded: true, totalUnread: 0, byTool: {} }, "ready").count
    ).toBeNull();
    expect(unreadWorkSummary({ totalUnread: 0 }, "error").count).toBeNull();
  });

  it("keeps valid unread counts independent of a Presence-only outage", () => {
    expect(
      unreadWorkSummary(
        {
          degraded: true,
          countsAvailable: true,
          totalUnread: 4,
          byTool: { verification: 4 },
          presenceTaskHealth: { available: false },
        },
        "ready"
      )
    ).toEqual({
      count: 4,
      detail: "Across role-visible admin queues",
      tone: "warning",
    });
    expect(unreadWorkSummary({ countsAvailable: true, totalUnread: 0 }, "ready")).toEqual({
      count: 0,
      detail: "Across role-visible admin queues",
      tone: "good",
    });
  });
});
