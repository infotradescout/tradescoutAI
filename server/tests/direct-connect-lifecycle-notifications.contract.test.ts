import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect lifecycle notifications contracts", () => {
  it("creates durable lifecycle notification records", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS direct_connect_lifecycle_notifications");
    expect(source).toContain("recipient_type text NOT NULL");
    expect(source).toContain("recipient_id text NOT NULL");
    expect(source).toContain("lifecycle_status text NOT NULL");
    expect(source).toContain("message_text text NOT NULL");
    expect(source).toContain("is_read boolean NOT NULL DEFAULT false");
  });

  it("maps dispatch events to requester-safe lifecycle statuses", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("request_submitted");
    expect(source).toContain("request_shared");
    expect(source).toContain("request_route_ready");
    expect(source).toContain("request_route_blocked");
    expect(source).toContain("business_responded");
    expect(source).toContain("contact_requested");
    expect(source).toContain("contact_approved");
    expect(source).toContain("contact_denied");
    expect(source).toContain("contact_released");
    expect(source).toContain("request_closed");
  });

  it("surfaces lifecycle status fields in requester and contractor APIs", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("lifecycleStatus");
    expect(source).toContain("latestStatus");
    expect(source).toContain("unreadStatusCount");
  });

  it("uses plain lifecycle messaging copy and no lead-selling language", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("Request shared");
    expect(source).toContain("Waiting for local businesses");
    expect(source).toContain("A local business responded");
    expect(source).toContain("They are asking to contact you");
    expect(source).toContain("Contact approved");
    expect(source).toContain("Contact declined");
    expect(source).toContain("Contact released");
    expect(source).toContain("Request closed");

    const lowered = source.toLowerCase();
    expect(lowered).not.toContain("lead");
    expect(lowered).not.toContain("boosted");
    expect(lowered).not.toContain("featured");
    expect(lowered).not.toContain("premium");
  });

  it("keeps auth-required posting doctrine intact", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("AUTH_REQUIRED_TO_SHARE_REQUEST");
    expect(source).toContain("AUTH_REQUIRED_TO_VIEW_REQUESTS");
    expect(source).toContain("AUTH_REQUIRED_TO_VIEW_REQUEST_DETAIL");
    expect(source).toContain("AUTH_REQUIRED_TO_UPDATE_CONTACT_GATE");
  });
});
