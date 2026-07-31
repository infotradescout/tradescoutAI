// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { parseClaimQuery } from "./claim-my-business";

describe("claim-my-business browser query routing", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("reads the scoped onboarding businessId from real browser history when Wouter returns pathname", () => {
    window.history.replaceState(
      {},
      "",
      "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1"
    );

    const params = parseClaimQuery("/claim-my-business");

    expect(params.get("source")).toBe("outcome_onboarding_match");
    expect(params.get("businessId")).toBe("directory-1");
  });

  it("preserves a query-scoped duplicate resolution handoff", () => {
    window.history.replaceState(
      {},
      "",
      "/claim-my-business?source=outcome_onboarding_match&q=Acme+Works"
    );

    const params = parseClaimQuery("/claim-my-business");
    expect(params.get("source")).toBe("outcome_onboarding_match");
    expect(params.get("q")).toBe("Acme Works");
  });
});
