// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStagedDirectConnectEntryContext } from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import { prepareScoutCountyDraftHandoff } from "./ScoutOS";
import type { ScoutAction } from "./state";

const countyDraftAction: ScoutAction = {
  type: "NAVIGATE",
  label: "Draft a request for my county",
  to: "/direct-connect?source=scout",
  payload: { countyFips: "04013" },
};

describe("Scout county draft handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("stages the validated county in this tab and returns only an opaque work-area URL", () => {
    const result = prepareScoutCountyDraftHandoff(countyDraftAction);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;

    const url = new URL(result.url, window.location.origin);
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("source")).toBe("scout");
    expect(url.searchParams.get("staged")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.has("county")).toBe(false);
    expect(url.searchParams.has("title")).toBe(false);
    expect(readStagedDirectConnectEntryContext(result.url)).toEqual({
      countyFips: "04013",
      stateCode: "AZ",
      source: "scout",
    });
  });

  it("does not stage other Scout actions or nearby Direct Connect URLs", () => {
    expect(
      prepareScoutCountyDraftHandoff({ ...countyDraftAction, to: "/direct-connect/pros" })
    ).toEqual({ kind: "not_applicable" });
    expect(
      prepareScoutCountyDraftHandoff({
        ...countyDraftAction,
        to: "/direct-connect?source=scout&county=04013",
      })
    ).toEqual({ kind: "not_applicable" });
    expect(
      prepareScoutCountyDraftHandoff({ ...countyDraftAction, type: "NOOP" })
    ).toEqual({ kind: "not_applicable" });
    expect(window.sessionStorage.length).toBe(0);
  });

  it("fails closed for missing, malformed, or unknown county identities", () => {
    for (const countyFips of [undefined, "4013", "04013?next=/messages", "99999"]) {
      expect(
        prepareScoutCountyDraftHandoff({
          ...countyDraftAction,
          payload: { countyFips },
        })
      ).toEqual({ kind: "unavailable" });
    }
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does not open a profile-county fallback when browser storage rejects staging", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(prepareScoutCountyDraftHandoff(countyDraftAction)).toEqual({ kind: "unavailable" });
    expect(window.sessionStorage.length).toBe(0);
  });
});
