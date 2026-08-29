import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORK_REQUEST_EVENT_TYPES,
  workRequestEvents,
} from "../../shared/schema/workRequestEvents";

const EXPECTED_EVENT_TYPES = [
  "created",
  "updated",
  "sent_to_board",
  "routed",
  "status_changed",
  "exposure_mode_changed",
  "provider_suggested",
  "provider_invited",
  "provider_self_selected",
  "provider_accepted",
  "provider_declined",
  "provider_completed",
  "completed",
  "cancelled",
  "asset_linked",
  "homeid_draft_created",
  "homeid_draft_reviewed",
  "homeid_draft_submitted",
] as const;

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("work-request event type authority", () => {
  it("keeps the runtime column on the exact canonical 18-value vocabulary", () => {
    expect(WORK_REQUEST_EVENT_TYPES).toEqual(EXPECTED_EVENT_TYPES);
    expect(new Set(WORK_REQUEST_EVENT_TYPES).size).toBe(18);
    expect(workRequestEvents.type.enumValues).toEqual(EXPECTED_EVENT_TYPES);
  });

  it("extracts the table from the schema monolith without exceeding its budget", () => {
    const schemaSource = read("shared/schema.ts");
    expect(schemaSource).toContain('from "./schema/workRequestEvents"');
    expect(schemaSource).not.toContain('pgTable("work_request_events"');
    expect(fs.statSync(path.resolve(process.cwd(), "shared/schema.ts")).size).toBeLessThanOrEqual(
      420_744
    );
  });

  it("authorizes exactly the canonical values in the forward migration", () => {
    const migration = read("migrations/0128_work_request_event_types_authority.sql");
    const checkBody = migration.match(/CHECK \(type IN \(\s*([\s\S]*?)\s*\)\);/)?.[1] || "";
    const migrationTypes = Array.from(checkBody.matchAll(/'([a-z_]+)'/g), (match) => match[1]);
    expect(migrationTypes).toEqual(EXPECTED_EVENT_TYPES);
    expect(migration).toContain("final integration reserves HomeID as migration 0133");
  });

  it("preserves historical migration 0091 byte-for-byte", () => {
    const historical = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0091_dc_notification_types_and_self_select.sql")
    );
    expect(crypto.createHash("sha256").update(historical).digest("hex")).toBe(
      "1c91240833268a797827d609235e77fa081f447b3a6da66366ed9b0ba0510e39"
    );
  });
});
