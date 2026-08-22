/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { hasRenderableDirectConnectThreadJob } from "./MessagesPanel";

describe("MessagesPanel Direct Connect handoff", () => {
  it("rejects partial successful job payloads before the job card dereferences them", () => {
    expect(hasRenderableDirectConnectThreadJob({})).toBe(false);
    expect(
      hasRenderableDirectConnectThreadJob({
        request: { title: "Roof repair", description: "Inspect it", status: "in_progress" },
      })
    ).toBe(false);
    expect(
      hasRenderableDirectConnectThreadJob({
        viewerRole: "admin",
        request: { title: "Roof repair", description: "Inspect it", status: "in_progress" },
        job: { allowedLifecycleActions: [] },
        summaries: {
          estimates: { count: 0 },
          invoices: { count: 0 },
          schedules: { count: 0 },
          punch: { openCount: 0 },
          completion: {},
        },
      })
    ).toBe(false);
  });

  it("accepts the complete shape consumed by the Direct Connect job card", () => {
    expect(
      hasRenderableDirectConnectThreadJob({
        threadId: "thread-1",
        requestId: "request-1",
        jobWorkspaceId: null,
        viewerRole: "provider",
        request: {
          title: "Roof repair",
          description: "Inspect the flashing",
          status: "in_progress",
          createdAt: null,
        },
        assignment: { id: "assignment-1", status: "accepted" },
        job: { status: null, activeStage: null, allowedLifecycleActions: [] },
        summaries: {
          estimates: { count: 0, latestStatus: null },
          invoices: { count: 0, latestStatus: null },
          schedules: { count: 0, latestStatus: null },
          payments: { count: 0, latestStatus: null },
          punch: { count: 0, openCount: 0, latestStatus: null },
          completion: { latestStatus: null },
        },
      })
    ).toBe(true);
  });
});
