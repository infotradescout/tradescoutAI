import { describe, expect, it } from "vitest";
import { readResetPasswordParam } from "./resetPasswordLocation";

describe("reset password location params", () => {
  it("reads a prefilled email from the browser query", () => {
    expect(readResetPasswordParam("email", "?email=profile-account%40example.test")).toBe(
      "profile-account@example.test"
    );
  });

  it("preserves a nested JW Stone profile-account continuation", () => {
    expect(readResetPasswordParam("next", "?next=%2Fu%2Fjw-stone%3FprofileAccount%3D1")).toBe(
      "/u/jw-stone?profileAccount=1"
    );
  });

  it("returns an empty value when the parameter is absent", () => {
    expect(readResetPasswordParam("token", "?next=%2Fjw-stone")).toBe("");
  });
});
