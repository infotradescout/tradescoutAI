import { describe, expect, it } from "vitest";
import { validateAction } from "./actionValidation";

describe("actionValidation", () => {
  it("allows pre-scout setup navigation", () => {
    const action = validateAction({
      type: "NAVIGATE",
      label: "Create account",
      to: "/pre-scout-setup?mode=create",
    });

    expect(action).toEqual({
      type: "NAVIGATE",
      label: "Create account",
      to: "/pre-scout-setup?mode=create",
      path: "/pre-scout-setup?mode=create",
    });
  });

  it("allows auth provider callback routes", () => {
    const action = validateAction({
      type: "NAVIGATE",
      label: "Continue with Google",
      to: "/api/auth/google",
    });

    expect(action).toEqual({
      type: "NAVIGATE",
      label: "Continue with Google",
      to: "/api/auth/google",
      path: "/api/auth/google",
    });
  });

  it("blocks unallowlisted internal routes", () => {
    const action = validateAction({
      type: "NAVIGATE",
      label: "Unknown route",
      to: "/totally-unknown-route",
    });

    expect(action).toBeNull();
  });
});
