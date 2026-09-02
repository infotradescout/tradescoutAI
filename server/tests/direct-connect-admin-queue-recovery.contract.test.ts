import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Direct Connect admin queue recovery", () => {
  it("limits private request operations to ops and super admins", () => {
    const routes = read("server/routes/direct-connect.ts");
    const tools = read("client/src/admin/adminTools.tsx");

    expect(routes).toContain('requireRole(["ops_admin", "super_admin"])');
    expect(
      routes.match(/"\/api\/admin\/direct-connect\/requests"/g)?.length
    ).toBeGreaterThanOrEqual(2);
    expect(tools).toContain('id: "direct-connect-requests"');
    expect(tools).toContain('visibleIf: { roles: ["ops_admin", "super_admin"] }');
  });

  it("provides a searchable, paginated queue through the canonical admin surface", () => {
    const routes = read("server/routes/direct-connect.ts");
    const operations = read("server/routes/direct-connect/operations.ts");
    const page = read("client/src/pages/admin-direct-connect-requests.tsx");
    const queue = read("client/src/components/admin/AdminDirectConnectQueue.tsx");

    expect(operations).toContain("export const directConnectAdminQueueSchema = z.object({");
    expect(routes).toContain('COUNT(DISTINCT wra.id)::int AS "assignmentCount"');
    expect(routes).toContain("nextOffset: hasMore ? offset + requests.length : null");
    expect(page).toContain("<AdminDirectConnectQueue />");
    expect(page).toContain('params.get("view") === "create" ? "create" : "queue"');
    expect(queue).toContain('data-testid="admin-direct-connect-queue"');
    expect(queue).toContain("Search request, person, email, or business");
    expect(queue).toContain("Previous");
    expect(queue).toContain("Next");
  });

  it("does not show an email override that the server does not honor", () => {
    const route = read("server/routes/direct-connect.ts");
    const composer = read("client/src/components/admin/AdminDirectConnectRequestCard.tsx");

    expect(route).not.toContain("forceSetupEmail");
    expect(composer).not.toContain("forceSetupEmail");
    expect(composer).not.toContain("Force setup email");
  });
});
