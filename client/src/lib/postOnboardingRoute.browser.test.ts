// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { getCurrentInternalPath } from "./postOnboardingRoute";

describe("getCurrentInternalPath", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("restores the query and fragment omitted by wouter's pathname hook", () => {
    window.history.replaceState({}, "", "/projects/project-77?tab=estimates#latest");
    expect(getCurrentInternalPath("/projects/project-77")).toBe(
      "/projects/project-77?tab=estimates#latest"
    );
  });

  it("does not borrow browser search state for a different memory-router pathname", () => {
    window.history.replaceState({}, "", "/scout?prompt=roof#result");
    expect(getCurrentInternalPath("/onboarding")).toBe("/onboarding");
  });
});
