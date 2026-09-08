import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createDirectConnectAdminQueueHandler } from "../routes/direct-connect/operations";

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
    expect(routes).toContain("createDirectConnectAdminQueueHandler(pool)");
    expect(operations).toContain('COUNT(DISTINCT wra.id)::int AS "assignmentCount"');
    expect(operations).toContain("nextOffset: hasMore ? offset + requests.length : null");
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

describe("canonical admin queue handler", () => {
  function appFor(query: ReturnType<typeof vi.fn>) {
    const app = express();
    app.get("/queue", createDirectConnectAdminQueueHandler({ query } as any));
    return app;
  }

  it("rejects invalid queue filters before querying", async () => {
    const query = vi.fn();
    expect((await request(appFor(query)).get("/queue?status=not-real")).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("parameterizes search and paginates using validated submitted identity", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "request-1",
          requesterName: "Saved Account",
          requesterEmail: "saved@example.invalid",
          requestContactMetadata: {
            source: "tradepartner_profile",
            connectionMode: "express",
            requesterContact: {
              name: "Submitted Person",
              email: "submitted@example.invalid",
              phone: "2255550198",
              consent: "share_with_selected_business",
            },
          },
        },
        { id: "request-2" },
      ],
    });
    const search = "name' OR 1=1 --";
    const response = await request(appFor(query)).get("/queue").query({
      status: "routed",
      search,
      limit: 1,
      offset: 4,
    });
    expect(response.status).toBe(200);
    expect(query.mock.calls[0][0]).not.toContain(search);
    expect(query.mock.calls[0][1]).toEqual(["routed", `%${search}%`, 2, 4]);
    expect(response.body).toEqual({
      requests: [
        {
          id: "request-1",
          requesterName: "Submitted Person",
          requesterEmail: "submitted@example.invalid",
        },
      ],
      hasMore: true,
      nextOffset: 5,
    });
    expect(response.text).not.toContain("2255550198");
    expect(response.text).not.toContain("requestContactMetadata");
  });

  it("does not replace malformed submitted identity with saved account contact", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "request-1",
          requesterName: "Saved Account",
          requesterEmail: "saved@example.invalid",
          requestContactMetadata: {
            source: "tradepartner_profile",
            connectionMode: "express",
            requesterContact: { name: "Forged Person", email: "forged@example.invalid" },
          },
        },
      ],
    });
    const response = await request(appFor(query)).get("/queue");
    expect(response.status).toBe(200);
    expect(response.body.requests).toEqual([
      { id: "request-1", requesterName: null, requesterEmail: null },
    ]);
    expect(response.body.hasMore).toBe(false);
    expect(response.body.nextOffset).toBeNull();
    expect(response.text).not.toContain("saved@example.invalid");
  });
});
