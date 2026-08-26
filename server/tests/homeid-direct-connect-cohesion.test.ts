import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
const homeIdSource = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
const handoffSource = read("client/src/pages/direct-connect/homeIdComposerHandoff.ts");
const routesSource = read("server/routes/direct-connect.ts");
const notificationSafetySource = read(
  "server/tests/direct-connect-notification-delivery-safety.contract.test.ts"
);

describe("HomeID and Direct Connect cohesion contract", () => {
  it("keeps request creation action-first with HomeID below required request inputs", () => {
    const requestTypeIndex = shellSource.indexOf("What do you need?");
    const photosIndex = shellSource.indexOf("Request photos");
    const homeRecordIndex = shellSource.indexOf("Save to HomeID");

    expect(requestTypeIndex).toBeGreaterThan(-1);
    expect(photosIndex).toBeGreaterThan(-1);
    expect(homeRecordIndex).toBeGreaterThan(-1);
    expect(requestTypeIndex).toBeLessThan(homeRecordIndex);
    expect(photosIndex).toBeLessThan(homeRecordIndex);
  });

  it("keeps HomeID helpful, optional, and non-blocking during Direct Connect submit", () => {
    expect(shellSource).toContain("const [homeContextIntent, setHomeContextIntent] = useState<");
    expect(shellSource).toContain('prefillHomeIdHandoff?.homeContextIntent || "skip_for_now"');
    expect(shellSource).toContain(
      "Save it with your property or project so the next step starts with the right"
    );
    expect(shellSource).toContain("Add HomeID details");
    expect(shellSource).toContain("Skip for now");
    expect(shellSource).toContain("handleSkipAndAutoRoute");
    expect(shellSource).toContain("createMutation.mutate({");
    expect(shellSource).toContain("autoRoute: true");
    expect(shellSource).not.toMatch(/HomeID is required|Home record is required/);
  });

  it("presents HomeID after submit as secondary memory capture", () => {
    expect(shellSource).toContain("function getPostSubmitHomeIdMemoryCopy");
    expect(shellSource).toContain("Request sent");
    expect(shellSource).toContain("Your request is live.");
    expect(shellSource).toContain("Save this request to your HomeID so future work is easier.");
    expect(shellSource).toContain("Keep this request in HomeID");
    expect(shellSource).not.toContain("Attach/update HomeID");
    expect(shellSource).not.toContain("Create from request");
    expect(shellSource).toContain('params.get("offerHomeId") !== "1"');
    expect(shellSource).toContain('source: "direct_connect_submitted"');
  });

  it("creates, links, or updates HomeID from a request only after explicit user intent", () => {
    expect(routesSource).toContain("homeContextIntent: z");
    expect(routesSource).toContain('"link_existing"');
    expect(routesSource).toContain('"create_from_request"');
    expect(routesSource).toContain('"update_from_request"');
    expect(routesSource).toContain('"skip_for_now"');
    expect(shellSource).toContain(
      'if (dispatch?.homeContextIntent && dispatch.homeContextIntent !== "skip_for_now")'
    );
    expect(routesSource).toContain(
      'if (created?.id && String(body.homeContextIntent || "skip_for_now") !== "skip_for_now")'
    );
    expect(routesSource).toContain('homeContextIntent === "create_from_request"');
    expect(routesSource).toContain('homeContextIntent === "update_from_request"');
    expect(routesSource).toContain('homeContextIntent === "link_existing"');
  });

  it("keeps HomeID page copy aligned as durable memory feeding request action", () => {
    expect(homeIdSource).toContain(
      "HomeID remembers useful property history. Direct Connect starts the job when you"
    );
    expect(homeIdSource).toContain(
      "Saving this packet does not dispatch, route, charge, or contact a"
    );
    expect(homeIdSource).toContain("Review in Direct Connect");
    expect(homeIdSource).toContain(
      "Nothing is sent until you review this request and confirm the next step"
    );
    expect(handoffSource).toContain("resolveHomeIdComposerHandoff");
    expect(handoffSource).toContain("if (!packet) return null");
  });

  it("allows completed Direct Connect work to project into HomeID history", () => {
    expect(routesSource).toContain("appendHomeIdCompletedWorkEnrichmentFromDirectConnect");
    expect(routesSource).toContain("homeid:completed_work_enrichment");
    expect(routesSource).toContain("direct_connect_completed_work");
    expect(routesSource).toContain('["homeid", "completed_work", "direct_connect"]');
  });

  it("preserves contact gating and no-leakage safety for HomeID-linked requests", () => {
    expect(routesSource).toContain("homeownerContact: null");
    expect(routesSource).toContain("redactContactDetails");
    expect(routesSource).toContain("contact_gate_state");
    expect(notificationSafetySource).toContain(
      "keeps Direct Connect notification payloads free of premature contact leakage"
    );
  });

  it("preserves anonymous draft return with HomeID prompt state", () => {
    expect(shellSource).toContain("type DirectConnectDraftSnapshot = {");
    expect(shellSource).toContain("homeContextIntent?:");
    expect(shellSource).toContain("window.sessionStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY");
    expect(shellSource).toContain("window.localStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY");
    expect(shellSource).toContain("hydrateDirectConnectDraft");
    expect(shellSource).toContain("parsed.homeContextIntent ===");
    expect(shellSource).toContain("navigate(`/pre-scout-setup?mode=signin&next=${next}`)");
  });
});
