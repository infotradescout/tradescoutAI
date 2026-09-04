import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile booking exact-Profile lineage migration", () => {
  it("adds explicit deletion-safe lineage and canonical release authority", () => {
    const migration = read("migrations/0128_profile_booking_request_profile_lineage.sql");

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS profile_id varchar");
    expect(migration).toContain("profile_booking_requests_profile_id_fk");
    expect(migration).toContain("REFERENCES profiles(id)");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS lineage_kind varchar NOT NULL");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS publicly_released boolean NOT NULL");
    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).toContain("profile_booking_requests_lineage_consistency_check");
    expect(migration).toContain("idx_profile_booking_requests_profile");
    expect(migration).toContain("WHERE profile_id IS NOT NULL");
    expect(migration).toContain("tradescout-schema:0128:v4");
    expect(migration).not.toContain("ON DELETE SET NULL");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION enforce_profile_booking_request_lineage_immutability()"
    );
    expect(migration).toContain(
      "CREATE TRIGGER profile_booking_requests_lineage_immutability_trigger"
    );
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OF profile_id, lineage_kind, owner_user_id, requester_user_id"
    );
    expect(migration).toContain("NEW.lineage_kind = 'exact_profile'");
    expect(migration).toContain("owner_user_id = NEW.owner_user_id");
    expect(migration).toContain("Exact booking Profile must belong to the booking owner");
    const triggerDefinition = migration.slice(
      migration.indexOf("CREATE TRIGGER profile_booking_requests_lineage_immutability_trigger"),
      migration.indexOf("COMMENT ON COLUMN profile_booking_requests.profile_id")
    );
    expect(triggerDefinition).not.toContain("payment_status");
    expect(triggerDefinition).not.toContain("payment_intent_id");
    expect(triggerDefinition).not.toContain("status,");
  });

  it("registers 0128 at the coordinated journal position", () => {
    const journal = JSON.parse(read("migrations/meta/_journal.json"));
    expect(journal.entries).toContainEqual(
      expect.objectContaining({
        idx: 131,
        tag: "0128_profile_booking_request_profile_lineage",
        breakpoints: false,
      })
    );
  });

  it("keeps shared Drizzle schema aligned with the canonical migration", () => {
    const schema = read("shared/schema.ts");
    const bookingTable = schema.slice(
      schema.indexOf("export const profileBookingRequests"),
      schema.indexOf("export const materialLists")
    );

    expect(bookingTable).toContain('profileId: varchar("profile_id")');
    expect(bookingTable).toContain('references(() => profiles.id, { onDelete: "restrict" })');
    expect(bookingTable).toContain('lineageKind: varchar("lineage_kind"');
    expect(bookingTable).toContain("profile_booking_requests_lineage_consistency_check");
    expect(bookingTable).toContain('index("idx_profile_booking_requests_profile")');
    expect(bookingTable).toContain(".where(sql`${table.profileId} IS NOT NULL`)");
    expect(schema).toContain('publiclyReleased: boolean("publicly_released")');
  });
});
