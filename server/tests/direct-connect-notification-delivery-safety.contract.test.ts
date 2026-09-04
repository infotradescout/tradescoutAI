import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const directConnectNotificationBlocks = (source: string) =>
  Array.from(source.matchAll(/notificationService\.createNotification\(\{[\s\S]*?\n\s*\}\);/g)).map(
    (match) => match[0]
  );

describe("direct connect notification/email delivery safety contracts", () => {
  it("keeps submitted/routed provider notifications scoped to platform inbox and safe copy", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('type: "new_project_request"');
    expect(source).toContain('title: "New Direct Connect request"');
    expect(source).toContain('actionUrl: "/direct-connect/inbox"');
    expect(source).toContain('actionText: "View in Direct Connect"');
    expect(source).toContain(
      "message: `You have a new Direct Connect request: ${requestRow.title}`"
    );
  });

  it("notifies only eligible assigned provider userIds on routed visibility", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("const notifyUserIds = new Set<string>();");
    expect(source).toContain("if (candidate?.userId) notifyUserIds.add(candidate.userId);");
    expect(source).toContain("if (a.responderUserId) {");
    expect(source).toContain("notifyUserIds.add(String(a.responderUserId));");
  });

  it("keeps contractor-action requester notifications contact-gated and platform-contained", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('type: isAccept ? "dc_provider_accepted" : "dc_provider_declined"');
    expect(source).toContain("title: isAccept");
    expect(source).toContain("actionUrl:");
    expect(source).toContain("`/messages?thread=${encodeURIComponent(String(convId))}`");
    expect(source).toContain("await recordContractorResponse({");
    expect(source).toContain(
      'contactRequestState: responseType === "interested" ? "contractor_requested" : "locked"'
    );
  });

  it("preserves contact gate release checks before any contact-release capability", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      'canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved"'
    );
    expect(source).toContain("requesterContact");
  });

  it("keeps draft and HomeID preview artifact paths out of production-style routing notifications", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/requests/:id/submit-homeid-draft"');
    expect(source).toContain('type: "homeid_draft_submitted"');
    expect(source).toContain(
      'if (type === "homeid_draft_created") homeIdDraftCreatedByRequest.add(key);'
    );
    expect(source).not.toContain(
      "Failed to send notifications for routed request on submit-homeid-draft"
    );
  });

  it("uses human-readable lifecycle/internal notification copy and avoids raw workflow enums", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("Request shared");
    expect(source).toContain("Waiting for local businesses");
    expect(source).toContain("A local business responded");
    expect(source).toContain("They are asking to contact you");
    expect(source).toContain("Contact released");
    expect(source).not.toContain("single_family");
    expect(source).not.toContain("pending_outcome");
    expect(source).not.toContain("Prepared from HomeID handoff preview");
  });

  it("keeps lead-selling, paid-priority, and ranking-advantage language out of notification maps", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts").toLowerCase();
    expect(source).not.toContain("lead selling");
    expect(source).not.toContain("buy lead");
    expect(source).not.toContain("paid priority");
    expect(source).not.toContain("featured placement");
    expect(source).not.toContain("boosted placement");
  });

  it("keeps notification eligibility independent of paid/featured/subscription ranking fields", () => {
    const source = read("shared/directConnectRoutingSpine.ts");
    expect(source).toContain('paymentStatus?: "paid" | "unpaid" | "none";');
    expect(source).toContain("featuredPlacement?: boolean;");
    expect(source).toContain('subscriptionLevel?: "free" | "pro" | "enterprise" | "none";');
    expect(source).toContain('return { status: "eligible", eligible: true };');
  });

  it("keeps Direct Connect notification payloads free of premature contact leakage", () => {
    const source = read("server/routes/direct-connect.ts");
    const blocks = directConnectNotificationBlocks(source).filter((block) =>
      /Direct Connect|dc_provider|new_project_request|provider/.test(block)
    );

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toMatch(
        /phone|email|address|contactInfo|homeownerContact|providerPhone|providerEmail/i
      );
      expect(block).not.toMatch(/\$\{[^}]*\.(phone|email|address|contactInfo)[^}]*\}/i);
    }
  });
});
