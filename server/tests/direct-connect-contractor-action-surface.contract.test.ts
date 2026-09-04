import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect contractor action surface contracts", () => {
  it("keeps contractor-visible routed request list and detail endpoints", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/contractor/requests"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id"');
  });

  it("keeps contractor action CTA endpoints in place", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/respond"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/request-contact"');
  });

  it("emits contractor action started analytics on contractor response", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      'logDirectConnectFunnelEvent("direct_connect_contractor_action_started"'
    );
    expect(source).toContain("recordContractorResponse({");
  });

  it("preserves contact gate by requiring response before requesting contact", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      "Submit an interested or need_more_info response before requesting contact."
    );
    expect(source).toContain('nextState: "contractor_requested"');
  });

  it("keeps requester contact redacted in contractor request detail payload", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("requesterContact");
  });

  it("blocks non-eligible/non-provider actors from unauthorized contractor action paths", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('message: "Assignment not found"');
    expect(source).toContain(
      'message: "Only registered providers (contractors or businesses) can express interest."'
    );
  });

  it("uses human empty-state copy in contractor dashboard when no routed requests exist", () => {
    const source = read("client/src/pages/contractor-dashboard.tsx");
    expect(source).toContain(
      "No routed requests yet. When a matching local request appears, it will show here."
    );
    expect(source).not.toContain("eligibility_state");
    expect(source).not.toContain("direct_connect_dispatch_candidates");
  });
});
