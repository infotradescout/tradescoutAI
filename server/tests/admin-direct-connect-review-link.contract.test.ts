import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const sectionBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) return "";
  return source.slice(startIndex, endIndex);
};

describe("admin direct-connect 'Review request' link", () => {
  it("keeps the beta super-admin notification pointed at /admin/direct-connect-requests?requestId=", () => {
    const oversightSource = read("server/services/directConnectBetaOversight.ts");
    expect(oversightSource).toContain("/admin/direct-connect-requests?requestId=");
    expect(oversightSource).toContain('actionText: "Review request"');
  });

  it("serves an operator-gated, read-only endpoint for the specific request behind that link", () => {
    const routes = read("server/routes/direct-connect.ts");
    expect(routes).toContain('"/api/admin/direct-connect/requests/:id"');

    const detailHandler = sectionBetween(
      routes,
      '"/api/admin/direct-connect/requests/:id"',
      '"/api/direct-connect/inbox"'
    );
    expect(detailHandler).toContain("isAuthenticated,");
    expect(detailHandler).toContain("isDirectConnectOperator,");

    // Read-only: must not mutate lifecycle state or trigger notifications while an
    // admin is only looking at a request.
    expect(detailHandler).not.toContain("notificationService.createNotification");
    expect(detailHandler).not.toContain(".insert(workRequestEvents)");
    expect(detailHandler).not.toContain(".insert(workRequestAssignments)");
    expect(detailHandler).not.toContain(".update(workRequests)");
  });

  it("resolves the originating business/profile and requester onto the detail response", () => {
    const routes = read("server/routes/direct-connect.ts");
    const detailHandler = sectionBetween(
      routes,
      '"/api/admin/direct-connect/requests/:id"',
      '"/api/direct-connect/inbox"'
    );
    expect(detailHandler).toContain("originatingProfile");
    expect(detailHandler).toContain("storage.getUser(String(request.createdByUserId))");
    expect(detailHandler).toContain("conversationId");
  });

  it("renders the actual request instead of only the manual-creation form when requestId is present", () => {
    const page = read("client/src/pages/admin-direct-connect-requests.tsx");
    expect(page).toContain("useSearch");
    expect(page).toContain("requestId");
    expect(page).toContain("AdminDirectConnectRequestDetail");
    expect(page).toContain("AdminDirectConnectRequestCard");

    const detailComponent = read("client/src/components/admin/AdminDirectConnectRequestDetail.tsx");
    expect(detailComponent).toContain("/api/admin/direct-connect/requests/${requestId}");
  });
});
