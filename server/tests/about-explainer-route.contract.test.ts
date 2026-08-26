import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/about-explainer-content.tsx"),
  "utf8"
);

describe("About explainer claims", () => {
  it("does not advertise unsupported external social publishing", () => {
    expect(source).not.toContain("socialIntegration");
    expect(source).not.toContain("Social publishing and external auto-sharing");
    expect(source).not.toContain("Dependable end-to-end automatic publishing");
  });

  it("preserves supported public product explanations", () => {
    expect(source).toContain("Decision calculators");
    expect(source).toContain("Publish and follow a local event");
    expect(source).toContain("Story Generator");
    expect(source).toContain("Share Hub and affiliate system");
  });
});
