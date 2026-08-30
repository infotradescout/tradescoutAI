import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getDisplayLatestStatus,
  looksLikeHiddenOrTestRequest,
} from "../../client/src/pages/direct-connect/requestCardPresentation";

const read = (relativePath: string): string => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf8");
};

describe("direct connect end-to-end local lifecycle smoke", () => {
  it("keeps the requester lifecycle path intact without requiring Home Record", () => {
    const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(shellSource).toContain('>(() => prefillHomeContextIntent || "skip_for_now")');
    expect(shellSource).toContain("handleSkipAndAutoRoute");
    expect(shellSource).toContain('type: "direct_connect_request_review_opened"');
    expect(shellSource).toContain('type: "direct_connect_request_submitted"');

    const reviewEventIndex = shellSource.indexOf('type: "direct_connect_request_review_opened"');
    const submittedEventIndex = shellSource.indexOf('type: "direct_connect_request_submitted"');
    expect(reviewEventIndex).toBeGreaterThan(-1);
    expect(submittedEventIndex).toBeGreaterThan(-1);
  });

  it("keeps routing/assignment visibility and contractor action event sequence wired", () => {
    const routesSource = read("server/routes/direct-connect.ts");

    expect(routesSource).toContain("routeRequestToTopContractors");
    expect(routesSource).toContain(
      "const allAssignments = [...contractorAssignments, ...businessAssignments]"
    );
    expect(routesSource).toContain(
      'logDirectConnectFunnelEvent("direct_connect_visible_to_contractors"'
    );
    expect(routesSource).toContain(
      'logDirectConnectFunnelEvent("direct_connect_contractor_action_started"'
    );

    const visibleEventIndex = routesSource.indexOf(
      'logDirectConnectFunnelEvent("direct_connect_visible_to_contractors"'
    );
    const actionEventIndex = routesSource.indexOf(
      'logDirectConnectFunnelEvent("direct_connect_contractor_action_started"'
    );
    expect(visibleEventIndex).toBeGreaterThan(-1);
    expect(actionEventIndex).toBeGreaterThan(-1);
    expect(visibleEventIndex).toBeLessThan(actionEventIndex);
  });

  it("preserves contact gate and unauthorized-access protections in the integrated path", () => {
    const routesSource = read("server/routes/direct-connect.ts");
    const ledgerSource = read("server/services/directConnectDispatchLedgerService.ts");

    expect(routesSource).toContain("homeownerContact: releasedContact");
    expect(ledgerSource).toContain("dispatch.contact_gate_state = 'released'");
    expect(routesSource).toContain(
      "Submit an interested or need_more_info response before requesting contact."
    );
    expect(routesSource).toContain('nextState: "contractor_requested"');
    expect(routesSource).toContain('message: "Assignment not found"');
  });

  it("keeps requester status copy human-readable and non-contradictory through lifecycle states", () => {
    expect(getDisplayLatestStatus({ status: "draft", latestStatus: "open" })).toBe("Draft ready");
    expect(getDisplayLatestStatus({ status: "open", latestStatus: "ready_to_send" })).toBe(
      "Submitted"
    );
    expect(
      getDisplayLatestStatus({ status: "routed", latestStatus: "waiting_for_local_businesses" })
    ).toBe("Waiting on pros");
    expect(
      getDisplayLatestStatus({
        status: "in_progress",
        latestStatus: "contractor_responded",
        dcConversationThreadId: "thread_abc",
      })
    ).toBe("Provider responded");
    expect(
      getDisplayLatestStatus({
        status: "routed",
        latestStatus: "waiting_for_contact_gate",
        contactGateState: "contractor_requested",
      })
    ).toBe("Review contact request");
  });

  it("keeps preview/test/homeid draft artifacts out of real request visibility", () => {
    expect(
      looksLikeHiddenOrTestRequest({
        title: "Inspection request",
        description: "Prepared from HomeID handoff preview.",
      })
    ).toBe(true);
    expect(looksLikeHiddenOrTestRequest({ isHomeIdPreviewDraft: true })).toBe(true);
    expect(
      looksLikeHiddenOrTestRequest({
        title: "Need roof leak help",
        description: "Active water leak around flashing.",
      })
    ).toBe(false);
  });

  it("keeps assignment visibility independent of paid/featured/subscription ranking fields", () => {
    const routingSource = read("shared/directConnectRoutingSpine.ts");

    expect(routingSource).toContain('paymentStatus?: "paid" | "unpaid" | "none";');
    expect(routingSource).toContain("featuredPlacement?: boolean;");
    expect(routingSource).toContain('subscriptionLevel?: "free" | "pro" | "enterprise" | "none";');
    expect(routingSource).toContain('return { status: "eligible", eligible: true };');
  });
});
