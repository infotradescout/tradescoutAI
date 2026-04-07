import { describe, expect, it } from "vitest";
import { sanitizeScoutUserFacingText } from "../scout/userFacingSanitizer";

describe("sanitizeScoutUserFacingText", () => {
  it("respects explicit empty fallback when caller disables replacement text", () => {
    const result = sanitizeScoutUserFacingText("", { fallback: "" });
    expect(result.text).toBe("");
    expect(result.flags).toContain("empty_replaced");
  });

  it("uses default fallback when fallback option is undefined", () => {
    const result = sanitizeScoutUserFacingText("");
    expect(result.text).toBe("Let's keep this practical and local.");
  });
});
