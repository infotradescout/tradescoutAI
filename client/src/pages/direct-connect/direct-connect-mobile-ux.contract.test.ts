import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Direct Connect mobile composer hierarchy", () => {
  it("keeps the composer as the primary first task on mobile", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('data-testid="direct-connect-mobile-composer"');
    expect(source).toContain("Tell local businesses what you need. Add photos on the next step.");
    expect(source).not.toContain("Want the directory instead?");
    expect(source).not.toContain("Calling opens from the profile after the contact gate.");
  });

  it("presents directory access as a secondary action below the describe step", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const ctaIndex = source.indexOf("Review request");
    const directoryIndex = source.indexOf("Prefer browsing first?");

    expect(ctaIndex).toBeGreaterThan(-1);
    expect(directoryIndex).toBeGreaterThan(ctaIndex);
    expect(source).toContain("Open directory");
    expect(source).toContain('navigate("/direct-connect/pros")');
  });

  it("uses compact app-flow language for progress and primary CTA", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('(["Describe", "Review", "Send"] as const)');
    expect(source).toContain("Review request");
    expect(source).toContain("Send when ready");
    expect(source).not.toContain(">Continue<");
  });

  it("does not add website-style or sensitive-content event paths", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const mobileComposerSource = source.slice(
      source.indexOf('data-testid="direct-connect-mobile-composer"'),
      source.indexOf("<Sheet open={showDispatchSheet}")
    );

    expect(mobileComposerSource).not.toMatch(/hero|marketing header|landing section|pitch/i);
    expect(mobileComposerSource).not.toMatch(/contact gate/i);
    expect(source).toContain("trackDirectConnectRequestStarted({");
    expect(source).toContain('type: "direct_connect_request_review_opened"');
    expect(source).toContain('type: "direct_connect_request_submitted"');
  });
});
