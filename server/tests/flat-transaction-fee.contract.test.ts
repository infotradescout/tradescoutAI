import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("flat TradeScout transaction fee contracts", () => {
  it("uses a flat $1 fee in the payment service instead of percentage platform fees", () => {
    const source = read("server/payment-service.ts");

    expect(source).toContain(
      "TRADESCOUT_FLAT_PLATFORM_TRANSACTION_FEE = TRADESCOUT_TRANSACTION_FEE_USD"
    );
    expect(source).toContain("not lead sales, paid access, or percentage take rates");
    expect(source).toContain("const platformFee = TRADESCOUT_FLAT_PLATFORM_TRANSACTION_FEE");
    expect(source).not.toContain("amount * 0.025");
    expect(source).not.toContain('config.platformFeeType === "percentage"');
  });

  it("uses a flat $1 fee for the legacy marketplace payment intent route", () => {
    const source = read("server/routes.ts");
    const block = source.slice(source.indexOf('"/api/create-payment-intent"'));

    expect(block.slice(0, 1600)).toContain("const platformFee = TRADESCOUT_TRANSACTION_FEE_CENTS");
    expect(block.slice(0, 1600)).toContain("Flat $1 TradeScout transaction fee");
    expect(block.slice(0, 1600)).toContain("TRADESCOUT_TRANSACTION_FEE_MODEL");
    expect(block.slice(0, 1600)).not.toContain("listingPrice * 0.05");
  });

  it("centralizes the fee policy for current and future platform purchases", () => {
    const policy = read("shared/platformRevenue.ts");
    const schema = read("shared/schema.ts");
    const procurement = read("server/routes/procurement.ts");
    const zeroBaseFee = read("server/routes/zero-base-fee-inspection.ts");
    const inspectionIntelligence = read("server/routes/inspection-intelligence.ts");

    expect(policy).toContain("TRADESCOUT_TRANSACTION_FEE_USD = 1");
    expect(policy).toContain("TRADESCOUT_TRANSACTION_FEE_CENTS = 100");
    expect(policy).toContain("every on-platform purchase");
    expect(schema).toContain('}).default("fixed")');
    expect(schema).toContain('default("1.0000")');
    expect(procurement).toContain("TRADESCOUT_TRANSACTION_FEE_CENTS");
    expect(procurement).toContain("TRADESCOUT_TRANSACTION_FEE_MODEL");
    expect(procurement).toContain("sellerAmountCents");
    expect(zeroBaseFee).toContain("TRADESCOUT_TRANSACTION_FEE_CENTS");
    expect(zeroBaseFee).toContain("TRADESCOUT_TRANSACTION_FEE_MODEL");
    expect(inspectionIntelligence).toContain("TRADESCOUT_TRANSACTION_FEE_USD");
    expect(inspectionIntelligence).toContain("TRADESCOUT_TRANSACTION_FEE_MODEL");
    expect(inspectionIntelligence).not.toContain('platform_fee_type: "percentage"');
    expect(inspectionIntelligence).not.toContain('platform_fee_value: "0.025"');
  });

  it("documents transaction fees as revenue without lead selling or paid ranking", () => {
    const scoutAudit = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");
    const financeAudit = read("docs/audits/FINANCE_DASHBOARD_REBUILD_AUDIT.md");

    expect(scoutAudit).toContain("flat `$1.00` TradeScout transaction fee");
    expect(scoutAudit).toContain("instead of selling access, leads, or paid ranking");
    expect(financeAudit).toContain("flat $1 transaction fee paid to TradeScout");
    expect(financeAudit).toContain("not paid access, paid ranking, lead selling");
    expect(financeAudit).toContain("| enforced |");
  });
});
