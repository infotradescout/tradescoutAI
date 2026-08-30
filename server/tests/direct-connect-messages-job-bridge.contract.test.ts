import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Direct Connect Messages job bridge", () => {
  it("resolves accepted Direct Connect jobs from a Messages thread without opening new contact", () => {
    const routeSource = read("server/routes/direct-connect.ts");

    expect(routeSource).toContain('"/api/direct-connect/messages/threads/:threadId/job"');
    expect(routeSource).toContain("Thread not available for this user");
    expect(routeSource).toContain("a.status = 'accepted'");
    expect(routeSource).toContain("getJobWorkspaceByRequestId(requestId)");
    expect(routeSource).toContain("buildMessageJobAssist");
    expect(routeSource).toContain("learningSignals");
    expect(routeSource).toContain("primaryAction");
    expect(routeSource).toContain("getReleasedRequesterContactForProvider({");
    expect(routeSource).toContain("contactGateState:");
    expect(routeSource).toContain("releasedContact,");
    expect(routeSource).not.toContain("messages/threads/:threadId/job/share");
  });

  it("renders the accepted job lane inside Messages using existing Direct Connect summaries", () => {
    const panelSource = read("client/src/components/messages/MessagesPanel.tsx");

    expect(panelSource).toContain("/api/direct-connect/messages/threads/");
    expect(panelSource).toContain('data-testid="direct-connect-thread-job-panel"');
    expect(panelSource).toContain("Accepted job");
    expect(panelSource).toContain("Next step");
    expect(panelSource).toContain("Autofill context");
    expect(panelSource).toContain("directConnectJobActionMutation");
    expect(panelSource).toContain("Open Direct Connect job");
    expect(panelSource).toContain("allowedLifecycleActions");
    expect(panelSource).toContain('data-testid="direct-connect-released-contact"');
    expect(panelSource).toContain("Contact stays private until the homeowner explicitly approves");
    expect(panelSource).toContain("Contact released by homeowner");
  });
});
