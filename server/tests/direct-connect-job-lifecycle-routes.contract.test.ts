import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { describe, expect, it } from "vitest";
import {
  type DirectConnectJobLifecycleRouteDependencies,
  registerDirectConnectJobLifecycleRoutes,
} from "../routes/direct-connect/job-lifecycle";

const EXPECTED_ROUTES = [
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/estimates"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/line-items"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId"],
  ["patch", "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/send"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId"],
  [
    "post",
    "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId/respond",
  ],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/start-work"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints"],
  ["patch", "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/change-orders"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/change-orders"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/ready-for-punchout"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items"],
  ["patch", "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/completion-request"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/completion-request/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/invoices"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId"],
  ["patch", "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/send"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/respond"],
  ["post", "/api/direct-connect/jobs/:jobWorkspaceId/receipts"],
  ["get", "/api/direct-connect/jobs/:jobWorkspaceId/receipts/:receiptId"],
] as const;

describe("Direct Connect job lifecycle route extraction", () => {
  it("registers the exact method/path sequence with authentication first", () => {
    const registrations: Array<{
      method: string;
      routePath: string;
      handlers: unknown[];
    }> = [];
    const register =
      (method: string) =>
      (routePath: string, ...handlers: unknown[]) => {
        registrations.push({ method, routePath, handlers });
      };
    const app = {
      get: register("get"),
      post: register("post"),
      patch: register("patch"),
    } as unknown as Express;
    const isAuthenticated = () => undefined;

    registerDirectConnectJobLifecycleRoutes(app, {
      isAuthenticated,
    } as DirectConnectJobLifecycleRouteDependencies);

    expect(registrations.map(({ method, routePath }) => [method, routePath])).toEqual(
      EXPECTED_ROUTES
    );
    expect(registrations).toHaveLength(35);
    for (const registration of registrations) {
      expect(registration.handlers[0]).toBe(isAuthenticated);
      expect(registration.handlers).toHaveLength(2);
      expect(typeof registration.handlers[1]).toBe("function");
    }
  });

  it("keeps the monolith as a single registrar call instead of duplicate inline routes", () => {
    const rootSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/direct-connect.ts"),
      "utf8"
    );

    expect(rootSource).toContain(
      'import { registerDirectConnectJobLifecycleRoutes } from "./direct-connect/job-lifecycle";'
    );
    expect(rootSource.match(/registerDirectConnectJobLifecycleRoutes\(app, \{/g)).toHaveLength(1);
    expect(rootSource).not.toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/line-items"'
    );
    expect(rootSource).not.toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/receipts/:receiptId"'
    );
  });
});
