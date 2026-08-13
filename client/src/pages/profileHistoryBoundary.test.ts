import { describe, expect, it } from "vitest";
import { buildSteelHomeBuilderPath } from "@shared/steelHomeBuilderRoutes";
import {
  createProfileHistoryBoundaryState,
  isProfileHistoryBoundaryState,
} from "./profileHistoryBoundary";

const BOUNDARY_KEY = "__tradeScoutProfileHistoryBoundary";
const PROFILE_SLUG = "steel-home-packages";

describe("public profile history boundary", () => {
  it("keeps Back and Forward inside the Steel Home directory and all three builder URLs", () => {
    const directoryState = createProfileHistoryBoundaryState(
      { entry: "directory" },
      BOUNDARY_KEY,
      PROFILE_SLUG
    );
    const entries = [
      { pathname: "/u/steel-home-packages", state: directoryState },
      ...(["countertops", "cabinets", "building"] as const).map((builder) => ({
        pathname: buildSteelHomeBuilderPath(builder),
        state: createProfileHistoryBoundaryState({ entry: builder }, BOUNDARY_KEY, PROFILE_SLUG),
      })),
    ];

    expect(entries.map((entry) => entry.pathname)).toEqual([
      "/u/steel-home-packages",
      "/u/steel-home-packages/builders/countertops",
      "/u/steel-home-packages/builders/cabinets",
      "/u/steel-home-packages/builders/metal-buildings",
    ]);
    for (const entry of entries) {
      expect(isProfileHistoryBoundaryState(entry.state, BOUNDARY_KEY, PROFILE_SLUG)).toBe(true);
    }
  });

  it("still detects the unguarded external-entry sentinel and preserves unrelated history state", () => {
    const originalState = Object.freeze({ wouter: "existing-router-state" });
    const guardedState = createProfileHistoryBoundaryState(
      originalState,
      BOUNDARY_KEY,
      PROFILE_SLUG
    );

    expect(guardedState).toEqual({
      wouter: "existing-router-state",
      [BOUNDARY_KEY]: PROFILE_SLUG,
    });
    expect(originalState).toEqual({ wouter: "existing-router-state" });
    expect(isProfileHistoryBoundaryState(null, BOUNDARY_KEY, PROFILE_SLUG)).toBe(false);
    expect(isProfileHistoryBoundaryState({}, BOUNDARY_KEY, PROFILE_SLUG)).toBe(false);
    expect(isProfileHistoryBoundaryState(guardedState, BOUNDARY_KEY, "another-profile")).toBe(
      false
    );
  });
});
