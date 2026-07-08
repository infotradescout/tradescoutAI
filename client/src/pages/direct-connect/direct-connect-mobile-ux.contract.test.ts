import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Direct Connect mobile composer hierarchy", () => {
  it("keeps the composer as the primary first task on mobile", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('data-testid="direct-connect-mobile-composer"');
    expect(source).toContain("What do you need help with?");
    expect(source).toContain("Describe the job. You can review before anything is sent.");
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

    expect(source).toContain("What happens next");
    expect(source).toContain("No one is contacted until you send.");
    expect(source).toContain("Review request");
    expect(source).toContain("Send when ready");
    expect(source).not.toContain(">Continue<");
  });

  it("removes first-screen system sludge from the request task", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const mobileComposerSource = source.slice(
      source.indexOf('data-testid="direct-connect-mobile-composer"'),
      source.indexOf("<Sheet open={showDispatchSheet}")
    );

    expect(mobileComposerSource).not.toContain("Autofilled:");
    expect(mobileComposerSource).not.toContain("Clear autofill");
    expect(mobileComposerSource).not.toContain("location profile");
    expect(mobileComposerSource).not.toContain("autofill snapshot");
    expect(mobileComposerSource).not.toContain("Start your request.");
    expect(mobileComposerSource).not.toContain("Start a local work request.");
    expect(mobileComposerSource).toContain("Using your saved details.");
    expect(mobileComposerSource).toContain("Edit");
  });

  it("puts the main request input before secondary project classification", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const mobileComposerSource = source.slice(
      source.indexOf('data-testid="direct-connect-mobile-composer"'),
      source.indexOf("<Sheet open={showDispatchSheet}")
    );
    const mainQuestionIndex = mobileComposerSource.indexOf("What do you need help with?");
    const projectTypeIndex = mobileComposerSource.indexOf("Project type");

    expect(mainQuestionIndex).toBeGreaterThan(-1);
    expect(projectTypeIndex).toBeGreaterThan(-1);
    expect(mainQuestionIndex).toBeLessThan(projectTypeIndex);
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
