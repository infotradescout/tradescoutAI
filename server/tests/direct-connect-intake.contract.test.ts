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
    expect(source).toContain("Review before sharing. Contact stays gated until you approve.");
    expect(source).toContain("Choose who gets this request");
  });

  it("renders a request review card once required intent details are complete", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("const reviewCardReady = hasRequiredAnswers;");
    expect(source).toContain("Request Review Card");
    expect(source).toContain("reviewCardReady && (");
  });
});
