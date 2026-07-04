import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect intake contracts", () => {
  it("maps fix_improve intent to the correct guided prompt", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("fix_improve: {");
    expect(source).toContain("Tell us what needs done.");
    expect(source).toContain("What needs done?");
  });

  it("maps vehicle_service intent to the correct guided prompt", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("vehicle_service: {");
    expect(source).toContain("What vehicle service or repair do you need?");
    expect(source).toContain("What vehicle?");
  });

  it("keeps offer_services language provider-safe and not contractor-first", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("offer_services: {");
    expect(source).toContain("Offer your services");
    expect(source).not.toContain("Contractor-only signup");
  });

  it("preserves review-before-contact copy in intake flow", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("Check the request before you send it.");
    expect(source).toContain("Review your request before sending it.");
    expect(source).toContain("Choose who can receive this request");
  });

  it("renders a request review card once required intent details are complete", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain('const reviewCardReady = completeness.level !== "too_vague";');
    expect(source).toContain("Request details review");
    expect(source).toContain("reviewCardReady && (");
  });

  it("adds request ready finalization state before sharing", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("Ready to submit");
    expect(source).toContain("Submit when ready");
    expect(source).toContain("Edit request");
    expect(source).toContain("Check the request before you send it.");
  });

  it("evaluates request completeness with user-facing quality states", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("function evaluateRequestCompleteness");
    expect(source).toContain("Ready to share");
    expect(source).toContain("Needs one more detail");
    expect(source).toContain("Add more detail before review");
  });

  it("keeps submit payload contract with expected request fields", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("title: title.trim()");
    expect(source).toContain("description: description.trim()");
    expect(source).toContain("category: activeRequestMeta.category");
    expect(source).toContain("payload.countyFips = defaultCountyFips");
    expect(source).toContain("payload.stateCode = stateCode.trim().toUpperCase()");
    expect(source).toContain("payload.homeContextIntent = dispatch.homeContextIntent");
    expect(source).toContain("payload.homeId = dispatch.homeId.trim()");
    expect(source).toContain("payload.assetComponentType = dispatch.assetComponentType");
  });

  it("adds optional HomeID asset linking controls without blocking request flow", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("Save to HomeID");
    expect(source).toContain(
      "Save it so the next repair starts with this history already on file."
    );
    expect(source).not.toContain("How should this request use home details?");
    expect(source).toContain("Use saved home details");
    expect(source).toContain("Skip for now");
    expect(source).toContain("handleSkipAndAutoRoute");
  });

  it("builds a canonical direct connect request and routing readiness state after finalization", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("const canonicalRequest: CanonicalDirectConnectRequest = {");
    expect(source).toContain("routingReadiness");
    expect(source).toContain('sourceSurface: "direct_connect"');
  });
});
