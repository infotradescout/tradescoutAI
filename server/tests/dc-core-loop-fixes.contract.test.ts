/**
 * Contract tests for the Direct Connect core loop fixes (Apr 2026).
 *
 * These tests verify the presence of the five gap-fix contracts in source code
 * without spinning up a live server or database.  They fail loudly if any of the
 * critical behaviours are accidentally removed.
 *
 * Gaps fixed:
 *   Gap 1 – Provider self-select (express-interest endpoint)
 *   Gap 2 – Completion notification to accepted providers
 *   Gap 3 – canMessage fallback uses requestId when threadId is missing
 *   Gap 4 – After accept, inbox navigates provider to conversation thread
 *   Gap 5 – Mobile "Open messages" button also uses requestId fallback
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

// ─── server-side contracts ────────────────────────────────────────────────────

describe("Gap 1 – Provider self-select endpoint", () => {
  const src = read("server/routes/direct-connect.ts");

  it("registers the express-interest route", () => {
    expect(src).toContain("/api/direct-connect/requests/:id/express-interest");
  });

  it("guards against non-provider users", () => {
    expect(src).toContain(
      "Only registered providers (contractors or businesses) can express interest."
    );
  });

  it("prevents requesters from expressing interest in their own request", () => {
    expect(src).toContain("You cannot respond to your own request.");
  });

  it("only allows interest on open or routed requests", () => {
    expect(src).toContain("This request is no longer accepting new responses.");
  });

  it("is idempotent – returns existing assignment when already assigned", () => {
    expect(src).toContain("alreadyAssigned: true");
    expect(src).toContain("alreadyAssigned: false");
  });

  it("creates a suggested assignment for the self-selecting provider", () => {
    expect(src).toContain("Provider expressed interest from board");
    expect(src).toContain('routingMode: "self_selected"');
  });

  it("logs a provider_self_selected event", () => {
    expect(src).toContain('type: "provider_self_selected" as const');
  });

  it("notifies the requester via dc_provider_interested notification", () => {
    expect(src).toContain("dc_provider_interested");
    expect(src).toContain("expressed interest in your request");
  });
});

describe("Gap 2 – Completion notification to accepted providers", () => {
  const src = read("server/routes/direct-connect/completion.ts");

  it("sends dc_request_completed notification after mark-complete", () => {
    expect(src).toContain("dc_request_completed");
    expect(src).toContain("Job marked complete");
    expect(src).toContain("The requester marked");
  });

  it("looks up accepted assignments to find provider user IDs", () => {
    expect(src).toContain("acceptedAssignments");
    expect(src).toContain("providerUserIds");
  });

  it("notifies all accepted providers (contractor + business paths)", () => {
    expect(src).toContain("Failed to notify provider of completion");
  });
});

describe("Gap 1 – Schema: provider_self_selected event type", () => {
  const schema = read("shared/schema.ts");
  const notificationSchema = read("shared/schema/notifications.ts");

  it("includes provider_self_selected in workRequestEvents type enum", () => {
    expect(schema).toContain('"provider_self_selected"');
  });

  it("includes DC notification types in notificationTypeEnum", () => {
    expect(notificationSchema).toContain('"dc_provider_accepted"');
    expect(notificationSchema).toContain('"dc_provider_declined"');
    expect(notificationSchema).toContain('"dc_provider_interested"');
    expect(notificationSchema).toContain('"dc_request_completed"');
  });

  it("includes routingMode in scoreSnapshot type", () => {
    expect(schema).toContain("routingMode?: string");
  });
});

// ─── client-side contracts ────────────────────────────────────────────────────

describe("Gap 4 – Inbox accept navigates to conversation thread", () => {
  const src = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
  const routeSrc = read("server/routes/direct-connect.ts");

  it("navigates to conversation after accept when conversationId is returned", () => {
    expect(src).toContain('variables?.decision === "accept" && data?.conversationId');
    expect(src).toContain("`/messages?thread=${encodeURIComponent(String(data.conversationId))}`");
  });

  it("sends requester accepted notifications to the same Messages thread", () => {
    expect(routeSrc).toContain("`/messages?thread=${encodeURIComponent(String(convId))}`");
    expect(routeSrc).toContain('actionText: isAccept ? "Open conversation" : "View request"');
  });
});

describe("Gap 3 & 5 – canMessage fallback uses requestId when threadId is missing", () => {
  const src = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

  it("falls back to requestId param when no threadId (handleOpenRequest)", () => {
    expect(src).toContain("`/messages?tab=requests&requestId=${encodeURIComponent(String(r.id))}`");
  });

  it("falls back to requestId in the desktop Open messages button", () => {
    // At least two occurrences of the fallback pattern
    const occurrences = (src.match(/messages\?tab=requests&requestId=/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

describe("Gap 1 – Board UI: Express Interest button for providers", () => {
  const src = read("client/src/pages/tasks.tsx");

  it("defines the expressInterestMutation", () => {
    expect(src).toContain("expressInterestMutation");
    expect(src).toContain("express-interest");
  });

  it("renders the Express Interest button for authenticated multi-county providers", () => {
    expect(src).toContain("Express interest");
    expect(src).toContain("isMultiCountyProvider");
  });

  it("shows a loading state while the mutation is pending", () => {
    expect(src).toContain("Sending...");
  });

  it("notifies the user of success or idempotency", () => {
    expect(src).toContain("Interest sent!");
    expect(src).toContain("Already in your inbox");
  });
});

describe("Migration 0091 – DC notification types and self-select event", () => {
  const sql = read("migrations/0091_dc_notification_types_and_self_select.sql");

  it("drops and recreates the work_request_events type check constraint", () => {
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS work_request_events_type_check");
    expect(sql).toContain("ADD CONSTRAINT work_request_events_type_check");
    expect(sql).toContain("provider_self_selected");
  });

  it("documents the new DC notification types", () => {
    expect(sql).toContain("dc_provider_accepted");
    expect(sql).toContain("dc_provider_interested");
    expect(sql).toContain("dc_request_completed");
  });
});
