import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("operational truth migrations", () => {
  it("quarantines unverifiable affiliate history and provides idempotent ledgers", () => {
    const migration = source("migrations/0127_affiliate_commission_approval_state.sql");
    expect(migration).toContain("commission_status = 'legacy_unverified'");
    expect(migration).toContain("commission_approved_by");
    expect(migration).toContain("commission_approval_reason");
    expect(migration).toContain("uq_affiliate_referrals_commission_reference");
    expect(migration).toContain("uq_wallet_affiliate_commission_credit");
    expect(migration).toContain("Intentionally no DEFAULT 'pending'");
    expect(migration).not.toMatch(
      /ALTER COLUMN commission_status SET DEFAULT|'pending'::[^\n]+DEFAULT/
    );
  });

  it("enforces one active assignment and durable paginated history", () => {
    const migration = source("migrations/0128_scout_file_assignments.sql");
    const service = source("server/services/scoutVisualFileSorting.ts");
    expect(migration).toContain("uq_scout_file_assignments_active_document");
    expect(migration).toContain("WHERE active = true");
    expect(migration).toContain("scout_file_assignment_events");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("MAX_SCOUT_BATCH_SIZE = 100");
    expect(service).toContain("LIMIT $2 OFFSET $3");
    expect(service).not.toContain("county_notes");
  });

  it("keeps the heatmap evidence-backed and bounded", () => {
    const service = source("server/services/scoutHeatmapIntelligence.ts");
    expect(service).toContain("MAX_SCOUT_COUNTIES");
    expect(service).toContain("getCountyFilesBatch(requested, 10)");
    expect(service).toContain('source: "database"');
    expect(service).not.toContain("Math.random");
    expect(service).not.toContain("generateTopContractors");
    expect(service).not.toContain("Promise.all(requested.map");
  });

  it("registers both migrations in order", () => {
    const journal = JSON.parse(source("migrations/meta/_journal.json"));
    const tags = journal.entries.slice(-2).map((entry: any) => entry.tag);
    expect(tags).toEqual([
      "0127_affiliate_commission_approval_state",
      "0128_scout_file_assignments",
    ]);
  });

  it("does not credit affiliate value in the payment path before approval", () => {
    const payment = source("server/payment-service.ts");
    const start = payment.indexOf("async trackAffiliateCommission");
    const end = payment.indexOf("// Create Stripe payment intent for contractor payments", start);
    const method = payment.slice(start, end);
    expect(method).not.toContain("storage.creditWallet");
    expect(method).not.toContain("storage.incrementAffiliateEarnings");
    expect(method).toContain("Pending commissions are deliberately non-spendable");
  });
});
