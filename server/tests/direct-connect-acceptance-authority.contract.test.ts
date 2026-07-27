import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/direct-connect.ts"),
  "utf8"
);

const routeStart = source.indexOf('"/api/direct-connect/assignments/:id/respond"');
const routeEnd = source.indexOf('"/api/direct-connect/requests/:id/express-interest"', routeStart);
const respondRoute = source.slice(routeStart, routeEnd);
const acceptStart = respondRoute.indexOf('if (decision === "accept") {');
const acceptEnd = respondRoute.indexOf("} else {\n            [updatedAssignment]", acceptStart);
const acceptBranch = respondRoute.slice(acceptStart, acceptEnd);

describe("Direct Connect provider acceptance authority contract", () => {
  it("commits acceptance, active conversation, request status, and binding event atomically", () => {
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(respondRoute).toContain("const result = await db.transaction(async (tx)");
    expect(acceptBranch).toContain(".update(workRequestAssignments)");
    expect(acceptBranch).toContain(".insert(conversations)");
    expect(acceptBranch).toContain(".update(workRequests)");
    expect(acceptBranch).toContain("await tx.insert(workRequestEvents).values");
    expect(acceptBranch).not.toContain("Failed to create or link conversation for assignment");
    expect(acceptBranch).not.toMatch(/try\s*\{/);
  });

  it("creates one request-scoped conversation and never reuses a participant-pair thread", () => {
    expect(acceptBranch).toContain('status: "active"');
    expect(acceptBranch).toContain("Never reuse a");
    expect(acceptBranch).not.toContain("const existing = await tx");
    expect(acceptBranch).not.toContain("eq(conversations.homeownerId");
    expect(acceptBranch).not.toContain("eq(conversations.contractorId");
  });

  it("binds the acceptance event to the exact assignment and provider form", () => {
    expect(acceptBranch).toContain('type: "provider_accepted"');
    expect(acceptBranch).toContain("assignmentId: String(updatedAssignment.id)");
    expect(acceptBranch).toContain("contractorId: isContractorAssignment ? contractor!.id : null");
    expect(acceptBranch).toContain(
      "isBusinessAssignment || isWorkerAssignment ? String(userId) : null"
    );
    expect(acceptBranch).toContain("workerId: isWorkerAssignment ? assignmentWorkerId : null");
    expect(acceptBranch).toContain("conversationId,");
  });
});
