import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
const analyticsSource = read("server/routes/analytics-routes.ts");
const routesSource = read("server/routes/direct-connect.ts");

describe("direct connect KPI funnel contracts", () => {
  it("locks the canonical requester funnel events from start through submit", () => {
    const requesterStages = [
      {
        stage: "request_started",
        event: "direct_connect_request_started",
        source: shellSource,
        evidence: 'type: "direct_connect_request_started"',
      },
      {
        stage: "prompt_viewed",
        event: "direct_connect_home_record_prompt_viewed",
        source: shellSource,
        evidence: "emitHomeRecordPromptViewed(",
      },
      {
        stage: "request_review_opened",
        event: "direct_connect_request_review_opened",
        source: shellSource,
        evidence: 'type: "direct_connect_request_review_opened"',
      },
      {
        stage: "request_submitted",
        event: "direct_connect_request_submitted",
        source: shellSource,
        evidence: 'type: "direct_connect_request_submitted"',
      },
    ] as const;

    for (const stage of requesterStages) {
      expect(stage.source, `${stage.stage} should emit ${stage.event}`).toContain(stage.evidence);
      expect(analyticsSource, `${stage.event} should stay in KPI allowlist`).toContain(
        `"${stage.event}"`
      );
    }
  });

  it("locks the server-side visibility and responder-action KPI events after submission", () => {
    expect(routesSource).toContain(
      'await storage.logEvent("direct_connect_request_visible_to_contractors"'
    );
    expect(routesSource).toContain('type: "direct_connect_request_visible_to_contractors"');
    expect(routesSource).toContain(
      'await storage.logEvent("direct_connect_contractor_action_started"'
    );
    expect(routesSource).toContain('type: "direct_connect_contractor_action_started"');

    expect(analyticsSource).toContain('"direct_connect_request_visible_to_contractors"');
    expect(analyticsSource).toContain('"direct_connect_contractor_action_started"');
  });

  it("documents the canonical business-action mapping without inventing a second event name", () => {
    expect(routesSource).toContain(
      'responderType: contractor ? "contractor" : "business_or_worker"'
    );
    expect(routesSource).not.toContain("direct_connect_business_action_started");
    expect(routesSource).not.toContain("business_action_started");
  });
});
