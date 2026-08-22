import { describe, expect, it } from "vitest";
import {
  hasActionableBusinessVerificationFields,
  resolveBusinessVerificationFieldState,
} from "./businessVerificationState";

describe("business verification owner field state", () => {
  it("keeps required pending fields without evidence actionable", () => {
    expect(
      resolveBusinessVerificationFieldState({
        required: true,
        status: "pending",
        hasEvidence: false,
      })
    ).toMatchObject({ state: "pending", actionable: true });
  });

  it("treats pending fields with evidence as submitted", () => {
    expect(
      resolveBusinessVerificationFieldState({
        required: true,
        status: "pending",
        hasEvidence: true,
      })
    ).toMatchObject({ state: "submitted", actionable: false });
  });

  it("keeps submitted and approved fields non-actionable", () => {
    expect(
      resolveBusinessVerificationFieldState({
        required: true,
        status: "submitted",
        hasEvidence: true,
      })
    ).toMatchObject({ state: "submitted", actionable: false });
    expect(
      resolveBusinessVerificationFieldState({
        required: true,
        status: "approved",
        hasEvidence: true,
      })
    ).toMatchObject({ state: "approved", actionable: false });
  });

  it("keeps rejected required fields actionable and preserves the reason", () => {
    expect(
      resolveBusinessVerificationFieldState({
        required: true,
        status: "rejected",
        hasEvidence: true,
        rejectionReason: "Upload a current registration document.",
      })
    ).toMatchObject({
      state: "rejected",
      actionable: true,
      rejectionReason: "Upload a current registration document.",
    });
  });

  it("reports aggregate action-needed state only when a required field is actionable", () => {
    const pending = resolveBusinessVerificationFieldState({
      required: true,
      status: "pending",
      hasEvidence: false,
    });
    const submitted = resolveBusinessVerificationFieldState({
      required: true,
      status: "submitted",
      hasEvidence: true,
    });
    const approved = resolveBusinessVerificationFieldState({
      required: true,
      status: "approved",
      hasEvidence: true,
    });

    expect(hasActionableBusinessVerificationFields([pending, submitted, approved])).toBe(true);
    expect(hasActionableBusinessVerificationFields([submitted, approved])).toBe(false);
  });
});
