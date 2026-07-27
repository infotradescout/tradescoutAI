import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect internal notifications contracts", () => {
  it("persists durable internal notification records", () => {
    const source = read("migrations/0115_direct_connect_ledger_foundation.sql");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS direct_connect_notifications");
    expect(source).toContain("notification_type text NOT NULL");
    expect(source).toContain("recipient_role text NOT NULL");
    expect(source).toContain("status text NOT NULL DEFAULT 'unread'");
    expect(source).toContain("priority text NOT NULL DEFAULT 'normal'");
    expect(source).toContain("metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb");
  });

  it("enforces idempotency for duplicate event delivery", () => {
    const migration = read("migrations/0115_direct_connect_ledger_foundation.sql");
    const service = read("server/services/directConnectDispatchLedgerService.ts");
    expect(migration).toContain("direct_connect_notifications_idempotency_idx");
    expect(service).toContain("ON CONFLICT (");
    expect(service).toContain("DO NOTHING");
  });

  it("exposes internal notifications read APIs", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/notifications"');
    expect(source).toContain('"/api/direct-connect/notifications/:notificationId/read"');
    expect(source).toContain('"/api/direct-connect/notifications/read-all"');
    expect(source).toContain('"/api/direct-connect/notifications/:notificationId/archive"');
    expect(source).toContain("unreadDirectConnectNotificationCount");
    expect(source).toContain("pendingActionKey");
  });

  it("contains requester and business action-oriented notification keys", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("review_business_response");
    expect(source).toContain("approve_contact");
    expect(source).toContain("review_estimate");
    expect(source).toContain("respond_to_payment_request");
    expect(source).toContain("review_schedule");
    expect(source).toContain("review_change_order");
    expect(source).toContain("respond_to_completion_request");
    expect(source).toContain("review_invoice");

    expect(source).toContain("view_routed_request");
    expect(source).toContain("wait_for_contact_approval");
    expect(source).toContain("create_estimate");
    expect(source).toContain("revise_estimate");
    expect(source).toContain("resolve_punch_item");
    expect(source).toContain("send_invoice");
    expect(source).toContain("review_invoice_dispute");
  });

  it("keeps language trust-safe and avoids lead-selling phrasing", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("A local business responded");
    expect(source).toContain("They are asking to contact you");
    expect(source).toContain("Contact released");

    const lowered = source.toLowerCase();
    expect(lowered).not.toContain("lead selling");
    expect(lowered).not.toContain("buy lead");
    expect(lowered).not.toContain("boosted placement");
    expect(lowered).not.toContain("featured placement");
    expect(lowered).not.toContain("paid priority");
  });
});
