import { beforeAll, describe, expect, it, vi } from "vitest";

type InboxCopyHelpers = {
  buildDirectConnectInboxDisplay: typeof import("../../client/src/pages/direct-connect/DirectConnectShell").buildDirectConnectInboxDisplay;
  formatDirectConnectInboxTime: typeof import("../../client/src/pages/direct-connect/DirectConnectShell").formatDirectConnectInboxTime;
  getDirectConnectInboxStatusLabel: typeof import("../../client/src/pages/direct-connect/DirectConnectShell").getDirectConnectInboxStatusLabel;
};

describe("Direct Connect inbox copy contract", () => {
  let helpers: InboxCopyHelpers;

  beforeAll(async () => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { href: "", pathname: "/" },
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ style: {} })),
      documentElement: { style: {} },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    helpers = await import("../../client/src/pages/direct-connect/DirectConnectShell");
  });

  it("maps assignment statuses to public-safe action-center labels", () => {
    expect(helpers.getDirectConnectInboxStatusLabel("suggested")).toBe("New opportunity");
    expect(helpers.getDirectConnectInboxStatusLabel("invited")).toBe("Invited");
    expect(helpers.getDirectConnectInboxStatusLabel("saved")).toBe("Saved opportunity");
    expect(helpers.getDirectConnectInboxStatusLabel("accepted")).toBe("Connected");
    expect(helpers.getDirectConnectInboxStatusLabel("declined")).toBe("Dismissed");
    expect(helpers.getDirectConnectInboxStatusLabel("expired")).toBe("Closed");
  });

  it("formats inbox timestamps as user-safe display copy", () => {
    const now = new Date(2026, 5, 15, 16);
    const todayTimestamp = new Date(2026, 5, 15, 10).toISOString();
    const yesterdayTimestamp = new Date(2026, 5, 14, 10).toISOString();
    const earlierTimestamp = new Date(2026, 5, 1, 10).toISOString();

    expect(helpers.formatDirectConnectInboxTime(todayTimestamp, now)).toBe("Updated today");
    expect(helpers.formatDirectConnectInboxTime(yesterdayTimestamp, now)).toBe(
      "Updated yesterday"
    );
    expect(helpers.formatDirectConnectInboxTime(earlierTimestamp, now)).toBe("Updated Jun 1");
  });

  it("keeps default inbox display out of system-level matching language", () => {
    const now = new Date(2026, 5, 15, 16);
    const display = helpers.buildDirectConnectInboxDisplay({
      status: "suggested",
      timestamp: new Date(2026, 5, 15, 10).toISOString(),
      now,
      scoreSnapshot: {
        score: 91,
        distanceMiles: 3.2,
        reasons: ["distanceMiles ranked well", "raw reasons should not show by default"],
        tradeMatch: true,
        recommendationCount: 2,
        responseRate: 0.9,
      },
    });

    const defaultCopy = [
      display.statusLabel,
      display.timeLabel,
      display.localContext,
      display.detailsLabel,
      display.detailsHeading,
    ]
      .filter(Boolean)
      .join(" ");

    for (const forbidden of [
      "Fit score",
      "distanceMiles",
      "reasons",
      "raw JSON",
      "debug",
      "system state",
      "scoring",
      "confidence",
      "recommendation engine",
      "3.2 mi away",
    ]) {
      expect(defaultCopy.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    expect(defaultCopy).toContain("New opportunity");
    expect(defaultCopy).toContain("Updated today");
    expect(defaultCopy).toContain("Nearby local reply");
    expect(defaultCopy).toContain("Match details");
    expect(defaultCopy).toContain("Local context");
    expect(display.detailRows).toEqual(
      expect.arrayContaining([
        "Strong local fit",
        "Nearby local reply",
        "Trade experience appears relevant",
        "Has local recommendations",
      ])
    );
  });
});
