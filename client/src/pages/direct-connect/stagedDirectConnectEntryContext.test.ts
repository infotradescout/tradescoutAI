/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDirectConnectEntryFallbackHref,
  readStagedDirectConnectEntryContext,
  resolveDirectConnectEntryContext,
  stageDirectConnectEntryContext,
} from "./stagedDirectConnectEntryContext";
import type { DirectConnectEntryContext } from "./directConnectEntryContext";

function storedKey(): string {
  const key = window.sessionStorage.key(0);
  if (!key) throw new Error("Expected a staged Direct Connect record");
  return key;
}

describe("stagedDirectConnectEntryContext", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("round trips sanitized project context through an opaque tab-scoped token", () => {
    const path = stageDirectConnectEntryContext({
      title: "Steel home package",
      description: "40 × 60 shell with owner-selected cabinets",
      location: "Natalbany, LA 70451",
      countyFips: "22105",
      stateCode: "la",
      subjectType: "service",
      source: "steel_home_project_review",
    });

    expect(path).toMatch(/^\/direct-connect\?staged=[a-f0-9]{64}$/);
    expect(path).not.toContain("Steel");
    expect(path).not.toContain("Natalbany");
    expect(readStagedDirectConnectEntryContext(path)).toEqual({
      countyFips: "22105",
      stateCode: "LA",
      source: "steel_home_project_review",
      title: "Steel home package",
      description: "40 × 60 shell with owner-selected cabinets",
      location: "Natalbany, LA 70451",
      subjectType: "service",
    });
  });

  it("uses staging on the same origin but never stages or leaks context across origins", () => {
    const sameOriginDestination = `${window.location.origin}/direct-connect?source=profile`;
    const sameOriginPath = stageDirectConnectEntryContext(
      { title: "Same-origin private project" },
      sameOriginDestination
    );
    expect(sameOriginPath).toMatch(/^\/direct-connect\?staged=[a-f0-9]{64}$/);
    expect(window.sessionStorage.length).toBe(1);

    window.sessionStorage.clear();
    const platformDestination =
      "https://www.thetradescout.com/direct-connect?title=Must%20not%20leak";
    const crossOriginPath = stageDirectConnectEntryContext(
      {
        title: "Must not leak",
        description: "Private measurements and jobsite details",
      },
      platformDestination
    );

    expect(getDirectConnectEntryFallbackHref(platformDestination)).toBe(
      "https://www.thetradescout.com/direct-connect"
    );
    expect(crossOriginPath).toBe("https://www.thetradescout.com/direct-connect");
    expect(crossOriginPath).not.toContain("?");
    expect(crossOriginPath).not.toContain("Must");
    expect(window.sessionStorage.length).toBe(0);
  });

  it("rejects changed tokens, corrupt records, and token-record mismatches", () => {
    const path = stageDirectConnectEntryContext({ title: "Original project" });
    const token = path.split("staged=")[1];
    const changedToken = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;

    expect(
      readStagedDirectConnectEntryContext(`/direct-connect?staged=${changedToken}`)
    ).toBeNull();

    window.sessionStorage.setItem(storedKey(), "{not valid json");
    expect(readStagedDirectConnectEntryContext(path)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);

    const secondPath = stageDirectConnectEntryContext({ title: "Second project" });
    const key = storedKey();
    const record = JSON.parse(window.sessionStorage.getItem(key) || "{}") as Record<
      string,
      unknown
    >;
    record.token = "0".repeat(64);
    window.sessionStorage.setItem(key, JSON.stringify(record));
    expect(readStagedDirectConnectEntryContext(secondPath)).toBeNull();
  });

  it("expires the staged context after ten minutes and removes it", () => {
    const path = stageDirectConnectEntryContext({ title: "Short-lived project" });

    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    expect(readStagedDirectConnectEntryContext(path)?.title).toBe("Short-lived project");

    vi.advanceTimersByTime(1);
    expect(readStagedDirectConnectEntryContext(path)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("enforces field bounds and drops invalid geography, budgets, enums, and unknown data", () => {
    const unsafeContext = {
      title: `  ${"T".repeat(200)}\u202E  `,
      description: `${"D".repeat(5_100)}\u0000`,
      targetName: "  Example\u0000 Builder  ",
      targetProviderId: "p".repeat(121),
      countyFips: "22-105",
      stateCode: "Louisiana",
      budgetMin: "$50,000",
      budgetMax: "500000.123",
      contextType: "admin",
      subjectType: "secret",
      hidden: "must never survive",
    } as unknown as DirectConnectEntryContext;
    const path = stageDirectConnectEntryContext(unsafeContext);

    const restored = readStagedDirectConnectEntryContext(path) as Record<string, unknown>;
    expect(Array.from(String(restored.title))).toHaveLength(160);
    expect(Array.from(String(restored.description))).toHaveLength(5_000);
    expect(restored.targetName).toBe("Example Builder");
    expect(restored).not.toHaveProperty("targetProviderId");
    expect(restored).not.toHaveProperty("countyFips");
    expect(restored).not.toHaveProperty("stateCode");
    expect(restored).not.toHaveProperty("budgetMin");
    expect(restored).not.toHaveProperty("budgetMax");
    expect(restored).not.toHaveProperty("contextType");
    expect(restored).not.toHaveProperty("subjectType");
    expect(restored).not.toHaveProperty("hidden");
  });

  it("prefers valid staged context and falls back to the existing query parser otherwise", () => {
    const stagedPath = stageDirectConnectEntryContext({
      title: "Private staged title",
      source: "steel_home_project_review",
    });
    const stagedToken = stagedPath.split("staged=")[1];
    const pathWithCompetingQuery = `/direct-connect?staged=${stagedToken}&title=Public%20query%20title`;

    expect(resolveDirectConnectEntryContext(pathWithCompetingQuery).title).toBe(
      "Private staged title"
    );

    window.sessionStorage.clear();
    expect(resolveDirectConnectEntryContext(pathWithCompetingQuery).title).toBe(
      "Public query title"
    );
    expect(
      resolveDirectConnectEntryContext(
        "/direct-connect?staged=invalid&title=Legacy%20query&state=la"
      )
    ).toMatchObject({ title: "Legacy query", stateCode: "LA" });
  });
});
