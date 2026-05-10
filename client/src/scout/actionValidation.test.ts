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

  it("allows Scout homeowner and Supply Run workspace routes", () => {
    for (const to of ["/homes", "/vehicles", "/messages", "/utilities/supply-run"]) {
      const action = validateAction({
        type: "NAVIGATE",
        label: "Open",
        to,
      });

      expect(action?.to).toBe(to);
    }
  });

  it("allows tool calls that the Scout action router owns", () => {
    const action = validateAction({
      type: "CALL_TOOL",
      label: "Helpful",
      payload: { name: "ads.feedback", adId: "ad_1", rating: "helpful" },
    });

    expect(action?.type).toBe("CALL_TOOL");
  });
});
