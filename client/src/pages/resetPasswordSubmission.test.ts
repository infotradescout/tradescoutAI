import { describe, expect, it } from "vitest";
import { prepareResetPasswordSubmission } from "./resetPasswordSubmission";

describe("reset password submission", () => {
  it("uses the token returned by code verification when the URL has no token", () => {
    expect(
      prepareResetPasswordSubmission({
        urlToken: "",
        verifiedToken: "verified-code-token",
        newPassword: "temporary-password",
        confirmPassword: "temporary-password",
      })
    ).toEqual({
      ok: true,
      value: {
        token: "verified-code-token",
        newPassword: "temporary-password",
      },
    });
  });

  it("reports a confirmation mismatch before submitting", () => {
    expect(
      prepareResetPasswordSubmission({
        urlToken: "email-link-token",
        verifiedToken: "",
        newPassword: "temporary-password",
        confirmPassword: "different-password",
      })
    ).toEqual({ ok: false, message: "Passwords do not match." });
  });

  it("reports a missing reset session", () => {
    expect(
      prepareResetPasswordSubmission({
        urlToken: "",
        verifiedToken: "",
        newPassword: "temporary-password",
        confirmPassword: "temporary-password",
      })
    ).toEqual({
      ok: false,
      message: "Your reset session is missing. Request a new link or code.",
    });
  });
});
