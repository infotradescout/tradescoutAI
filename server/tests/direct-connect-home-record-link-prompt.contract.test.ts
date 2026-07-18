import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const shellPath = path.resolve(
  process.cwd(),
  "client/src/pages/direct-connect/DirectConnectShell.tsx"
);
const analyticsPath = path.resolve(process.cwd(), "client/src/lib/coreProductAnalytics.ts");

describe("direct connect home record link prompt conversion contract", () => {
  it("renders home-record prompt language and keeps skip path non-blocking", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    expect(source).toContain("Save to HomeID");
    expect(source).toContain(
      "Save it with your property or project so the next step starts with the right"
    );
    expect(source).toContain("Add HomeID details");
    expect(source).toContain("Use saved home details");
    expect(source).toContain("Create a home record");
    expect(source).toContain("Skip for now");
    expect(source).not.toContain("How should this request use home details?");
    expect(source).not.toContain("Advanced component IDs stay hidden in the default request flow.");
    expect(source).toContain("handleSkipAndAutoRoute");
  });

  it("tracks conversion events for prompt viewed, selections, skip, and submit-after-skip", () => {
    const shellSource = fs.readFileSync(shellPath, "utf8");
    const analyticsSource = fs.readFileSync(analyticsPath, "utf8");
    expect(shellSource).toContain("trackDirectConnectHomeRecordPromptViewed");
    expect(shellSource).toContain("trackDirectConnectHomeRecordLinkSelected");
    expect(shellSource).toContain("trackDirectConnectHomeRecordCreateSelected");
    expect(shellSource).toContain("trackDirectConnectHomeRecordSkipped");
    expect(shellSource).toContain("trackDirectConnectRequestSubmittedAfterHomeRecordSkip");
    expect(analyticsSource).toContain("direct_connect_home_record_prompt_viewed");
    expect(analyticsSource).toContain("direct_connect_home_record_link_selected");
    expect(analyticsSource).toContain("direct_connect_home_record_create_selected");
    expect(analyticsSource).toContain("direct_connect_home_record_skipped");
    expect(analyticsSource).toContain("direct_connect_request_submitted_after_home_record_skip");
  });

  it("keeps render coverage for existing-home and no-home states in request prep", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    expect(source).toContain("const hasExistingHomes = homes.length > 0;");
    expect(source).toContain('{hasExistingHomes ? "Select a saved home" : "No saved homes yet"}');
    expect(source).not.toContain("setSelectedHomeId(firstHomeId)");
    expect(source).toContain(
      'selectHomeRecordIntent("link_existing", "home_record_compact_link_selected")'
    );
    expect(source).toContain("function toCleanHomeLabel(home: any): string");
    expect(source).toContain('return nickname ? "My home" : "Saved home";');
    expect(source).toContain(
      "const [showHomeRecordDetails, setShowHomeRecordDetails] = useState(false);"
    );
    expect(source).toContain('showHomeRecordDetails && homeContextIntent === "link_existing"');
    expect(source).not.toContain("Existing component ID (optional)");
  });

  it("fires prompt viewed on render and keeps skip submission non-blocking", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    expect(source).toContain("const emitHomeRecordPromptViewed =");
    expect(source).toContain("trackDirectConnectHomeRecordPromptViewed({");
    expect(source).toContain("if (homeRecordPromptViewedRef.current) return;");
    expect(source).toContain(
      'emitHomeRecordPromptViewed("direct_connect_home_record_prompt_request_start")'
    );
    expect(source).toContain("sourceOverride ||");
    expect(source).toContain("trackDirectConnectRequestSubmittedAfterHomeRecordSkip({");
    expect(source).toContain('source: "direct_connect_submit_after_home_record_skip"');
    expect(source).toContain("createMutation.mutate({");
    expect(source).toContain("handleSkipAndAutoRoute");
  });

  it("keeps core request fields before home record controls", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    const requestTypeIndex = source.indexOf("What do you need?");
    const homeRecordIndex = source.indexOf("Save to HomeID");
    const requestPhotosIndex = source.indexOf("Request photos");
    expect(requestTypeIndex).toBeGreaterThan(-1);
    expect(requestPhotosIndex).toBeGreaterThan(-1);
    expect(homeRecordIndex).toBeGreaterThan(-1);
    expect(requestTypeIndex).toBeLessThan(homeRecordIndex);
    expect(requestPhotosIndex).toBeLessThan(homeRecordIndex);
  });
});
