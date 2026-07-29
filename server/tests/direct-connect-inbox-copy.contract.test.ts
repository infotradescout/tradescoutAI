import { describe, expect, it } from "vitest";
import {
  buildDirectConnectInboxDisplay,
  formatDirectConnectInboxTime,
  getDirectConnectInboxStatusLabel,
} from "../../client/src/pages/direct-connect/directConnectInboxCopy";

const helpers = {
  buildDirectConnectInboxDisplay,
  formatDirectConnectInboxTime,
  getDirectConnectInboxStatusLabel,
};

describe("Direct Connect inbox copy contract", () => {
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
    expect(helpers.formatDirectConnectInboxTime(yesterdayTimestamp, now)).toBe("Updated yesterday");
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
