import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shouldRenderDirectConnectSectionChrome } from "../../client/src/pages/direct-connect/directConnectRoutes";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);
const stagedContextSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/stagedDirectConnectEntryContext.ts"),
  "utf8"
);

describe("Direct Connect entry clarity contract", () => {
  it("shows one request surface instead of stacking first-use panels above it", () => {
    expect(shouldRenderDirectConnectSectionChrome("post")).toBe(false);
    expect(source).toContain(
      "const showSectionChrome = shouldRenderDirectConnectSectionChrome(activeSection)"
    );
    expect(source).toContain("{showSectionChrome ? (");
    expect(source).not.toContain('activeSection === "post" ? "hidden md:block" : ""');
  });

  it("never repurposes old activity, profile location, or the first HomeID as current intent", () => {
    expect(source).not.toContain('"composer_autofill"');
    expect(source).not.toContain('nextSources.push("Recent activity")');
    expect(source).not.toContain('nextSources.push("Location profile")');
    expect(source).not.toContain("setSelectedHomeId(firstHomeId)");
    expect(source).not.toContain("Autofilled:");
  });

  it("asks for an explicit broad request type and preserves deliberate entry context", () => {
    expect(source).toContain("What are you looking for?");
    expect(source).toContain("aria-pressed={requestType === key}");
    expect(source).toContain('"What do you need?"');
    expect(source).toContain("`Direct Connect with ${prefillTargetLabel}`");
    expect(source).toContain("A product or material");
    expect(source).toContain("Work or staffing");
    expect(source).toContain("window.location.pathname");
    expect(source).toContain("resolveDirectConnectEntryContext(directConnectLocation)");
    expect(stagedContextSource).toContain("readStagedDirectConnectEntryContext(path)");
    expect(stagedContextSource).toContain("parseDirectConnectEntryContext(path)");
    expect(stagedContextSource).toContain("sanitizeDirectConnectEntryContext(envelope.context)");
    expect(stagedContextSource).toContain("window.sessionStorage");
    expect(source).toContain("resolveDirectConnectComposerLocation(");
    expect(source).toContain("entryLocation={composerEntryLocation}");
    expect(source).toContain('prefillSubjectType === "product" ? "buy_sell"');
    expect(source).toContain("prefillSubjectType={requestPrefill?.subjectType}");
    expect(source).toContain("prefillLocation={requestPrefill?.location}");
    expect(source).toContain("prefillTiming={requestPrefill?.timing}");
    expect(source).toContain("What would you like to know or do with ${prefillTargetLabel}?");
    expect(source).not.toContain(">Project type</label>");
  });
});
