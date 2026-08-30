import { describe, expect, it } from "vitest";
import { isCorsNeutralPublicAssetRequest } from "../http/corsPolicy";

describe("public static CORS policy", () => {
  it("lets the offline shell respond without turning a disallowed Origin into HTTP 500", () => {
    expect(isCorsNeutralPublicAssetRequest("GET", "/offline.html")).toBe(true);
    expect(isCorsNeutralPublicAssetRequest("HEAD", "/offline.html")).toBe(true);
    expect(
      isCorsNeutralPublicAssetRequest("GET", "/profile-manifests/jrs-auto-glass.webmanifest")
    ).toBe(true);
    expect(
      isCorsNeutralPublicAssetRequest("GET", "/profile-app-icons/jrs-auto-glass/192.png")
    ).toBe(true);
  });

  it("does not weaken API or mutation CORS enforcement", () => {
    expect(isCorsNeutralPublicAssetRequest("GET", "/api/profile")).toBe(false);
    expect(isCorsNeutralPublicAssetRequest("POST", "/offline.html")).toBe(false);
    expect(isCorsNeutralPublicAssetRequest("OPTIONS", "/offline.html")).toBe(false);
  });
});
