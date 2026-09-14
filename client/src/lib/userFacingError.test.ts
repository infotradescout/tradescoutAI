import { afterEach, describe, expect, it, vi } from "vitest";
import { formatUserFacingErrorMessage } from "./userFacingError";

afterEach(() => vi.unstubAllEnvs());

describe("operator mutation errors shown in production", () => {
  it.each([500, 422])(
    "withholds SQL/stack details even when the response status is %s",
    (status) => {
      vi.stubEnv("DEV", false);
      const error = Object.assign(
        new Error("SQL exception in admin_audit_log at save (server.ts:24)"),
        { status, requestId: "fixture-reference" }
      );
      expect(
        formatUserFacingErrorMessage(error, "Unable to save the staff reply. Please try again.")
      ).toBe("Unable to save the staff reply. Please try again. (Ref: fixture-reference)");
    }
  );
  it("preserves the actionable safe eligibility rejection", () => {
    vi.stubEnv("DEV", false);
    const message =
      "This provider does not meet this request's county, trade, verification, or public trust requirements.";
    expect(
      formatUserFacingErrorMessage(
        { status: 422, message },
        "Unable to invite this provider. Please try again."
      )
    ).toBe(message);
  });
});
