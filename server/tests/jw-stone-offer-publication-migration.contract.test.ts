import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(process.cwd(), "migrations/0126_jw_stone_offer_publication.sql");

describe("JW Stone offer-only publication migration contract", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  it("targets exactly the canonical seven-lot fixture and fails closed", () => {
    expect(migration).toContain("jw-stone-confirmed-stock-2026-08-20-v1");
    expect(migration).toContain("target_count <> 7");
    expect(migration).toContain("eligible_count <> 7");
    expect(migration).toContain("inventory_update_count <> 7");
    expect(migration).toContain("listing_update_count <> 7");
    expect(migration).toContain("listing_row.source_profile_slug = 'jw-stone'");
  });

  it("requires current, unheld seller stock with publication authority", () => {
    expect(migration).toContain("account.verification_status = 'approved'");
    expect(migration).toContain("business_profile.verification_status = 'approved'");
    expect(migration).toContain("entitlement.product_key = 'bidrock'");
    expect(migration).toContain("entitlement.status = 'active'");
    expect(migration).toContain("inventory_row.lifecycle_status = 'available'");
    expect(migration).toContain("inventory_row.held_quantity = 0");
    expect(migration).toContain("listing_row.confirmation_expires_at > NOW()");
    expect(migration).toContain("listing_row.last_confirmed_at + INTERVAL '45 days' > NOW()");
  });

  it("publishes private-offer inventory without price or auction activation", () => {
    expect(migration).toContain("listing_row.price_unit IS NULL");
    expect(migration).toContain("listing_row.price_cents IS NULL");
    expect(migration).toContain("auction.status IN ('scheduled', 'live', 'extended', 'ended')");
    expect(migration).toContain("public_availability_status = 'published_current'");
    expect(migration).toContain("SET status = 'active'");
    expect(migration).toContain("private_offer_without_asking_price");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+bidrock_auctions/i);
    expect(migration).not.toMatch(/opening_bid_cents\s*=/i);
    expect(migration).not.toMatch(/price_cents\s*=\s*[0-9]/i);
  });
});
