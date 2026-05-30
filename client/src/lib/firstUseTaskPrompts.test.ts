import { describe, expect, it } from "vitest";
import {
  resolveDirectConnectFirstUseTaskPrompt,
  resolveHomeIdFirstUseTaskPrompt,
  resolveScoutFirstUseTaskPrompt,
} from "@/lib/firstUseTaskPrompts";

describe("first-use task prompts", () => {
  it("resolves HomeID prompt progression", () => {
    expect(
      resolveHomeIdFirstUseTaskPrompt({
        hasSelectedHome: false,
        knownDetailsCount: 0,
        hasComponentLikeDetail: false,
      }).message
    ).toBe("Add one home detail.");

    expect(
      resolveHomeIdFirstUseTaskPrompt({
        hasSelectedHome: true,
        knownDetailsCount: 1,
        hasComponentLikeDetail: false,
      }).message
    ).toBe("Add a system or component.");

    expect(
      resolveHomeIdFirstUseTaskPrompt({
        hasSelectedHome: true,
        knownDetailsCount: 2,
        hasComponentLikeDetail: true,
      }).message
    ).toBe("Create request details when you need work done.");
  });

  it("resolves Direct Connect prompt progression", () => {
    expect(
      resolveDirectConnectFirstUseTaskPrompt({ requestCount: 0, hasHomeIdContext: false }).message
    ).toBe("Start a local work request.");

    expect(
      resolveDirectConnectFirstUseTaskPrompt({ requestCount: 1, hasHomeIdContext: true }).message
    ).toBe("Link a HomeID to keep this request attached to the right home.");
  });

  it("resolves Scout prompt progression", () => {
    expect(
      resolveScoutFirstUseTaskPrompt({ hasHomeIdUpdates: true, hasSavedContext: true }).message
    ).toBe("Review your HomeID updates.");

    expect(
      resolveScoutFirstUseTaskPrompt({ hasHomeIdUpdates: false, hasSavedContext: true }).message
    ).toBe("Review saved context.");

    expect(
      resolveScoutFirstUseTaskPrompt({ hasHomeIdUpdates: false, hasSavedContext: false }).message
    ).toBe("Start with HomeID or Direct Connect.");
  });
});
