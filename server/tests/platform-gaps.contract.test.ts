/**
 * Contract tests for platform-wide gap fixes:
 * 1. HOA 501 endpoints — typeof guards removed, methods called directly
 * 2. Decision card analytics — real DB queries replacing all-zeros stub
 * 3. Affiliate monthly stats and topPerformingLinks — real aggregates
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const HOA_FILE = path.resolve(__dirname, "../routes/hoa.ts");
const AUTHORITY_FILE = path.resolve(__dirname, "../routes/authority-operations.ts");
const STORAGE_FILE = path.resolve(__dirname, "../storage.ts");
const STORAGE_CONTRACT_FILE = path.resolve(__dirname, "../storage/contracts.ts");

const hoaContent = fs.readFileSync(HOA_FILE, "utf8");
const authorityContent = fs.readFileSync(AUTHORITY_FILE, "utf8");
const storageContent = fs.readFileSync(STORAGE_FILE, "utf8");
const storageContractContent = fs.readFileSync(STORAGE_CONTRACT_FILE, "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// HOA 501 endpoint fixes
// ─────────────────────────────────────────────────────────────────────────────

describe("HOA 501 endpoint fixes", () => {
  it("createHOABoardTransferVote calls storage.createHOABoardTransferVote directly (no typeof guard)", () => {
    expect(hoaContent).toContain("storage.createHOABoardTransferVote({");
    expect(hoaContent).not.toContain('typeof create !== "function"');
    expect(hoaContent).not.toContain("Board transfer votes are not implemented");
  });

  it("recordHoaFeeCollection calls storage.recordHoaFeeCollection directly (no typeof guard)", () => {
    expect(hoaContent).toContain("storage.recordHoaFeeCollection({");
    expect(hoaContent).not.toContain('typeof recordHoaFeeCollection !== "function"');
    expect(hoaContent).not.toContain("HOA fee ledger collection is not implemented");
  });

  it("leaveHOA calls storage.leaveHOAWithReason directly (no typeof guard)", () => {
    expect(hoaContent).toContain("storage.leaveHOAWithReason({");
    expect(hoaContent).not.toContain('typeof leaveWithReason === "function"');
    expect(hoaContent).not.toContain("HOA leave is not implemented");
  });

  it("IStorage interface declares all four HOA method signatures", () => {
    // Find the IStorage interface block
    const ifaceIdx = storageContractContent.indexOf("interface IStorage {");
    expect(ifaceIdx).toBeGreaterThan(-1);
    const ifaceBlock = storageContractContent.slice(ifaceIdx);

    expect(ifaceBlock).toContain("recordHoaFeeCollection(");
    expect(ifaceBlock).toContain("createHOABoardTransferVote(");
    expect(ifaceBlock).toContain("leaveHOA(");
    expect(ifaceBlock).toContain("leaveHOAWithReason(");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision card analytics
// ─────────────────────────────────────────────────────────────────────────────

describe("Decision card analytics — real DB queries", () => {
  it("imports decisionCards from shared schema", () => {
    expect(authorityContent).toContain("decisionCards");
  });

  it("imports count and lt from drizzle-orm", () => {
    expect(authorityContent).toContain("count,");
    expect(authorityContent).toContain("lt,");
  });

  it("decision-card-metrics endpoint sets available: true", () => {
    const endpointIdx = authorityContent.indexOf("/decision-card-metrics");
    expect(endpointIdx).toBeGreaterThan(-1);
    const block = authorityContent.slice(endpointIdx, endpointIdx + 2500);
    expect(block).toContain("available: true");
    expect(block).not.toContain("available: false");
  });

  it("decision-card-metrics queries totalShown from decisionCards", () => {
    const endpointIdx = authorityContent.indexOf("/decision-card-metrics");
    const block = authorityContent.slice(endpointIdx, endpointIdx + 2500);
    expect(block).toContain("totalShown");
    expect(block).toContain("from(decisionCards)");
  });

  it("decision-card-metrics computes 7-day trend with prior period comparison", () => {
    const endpointIdx = authorityContent.indexOf("/decision-card-metrics");
    const block = authorityContent.slice(endpointIdx, endpointIdx + 2500);
    expect(block).toContain("sevenDaysAgo");
    expect(block).toContain("fourteenDaysAgo");
    expect(block).toContain("shown_7d_change");
  });

  it("decision-card-metrics computes guidanceDistribution by intent", () => {
    const endpointIdx = authorityContent.indexOf("/decision-card-metrics");
    const block = authorityContent.slice(endpointIdx, endpointIdx + 2500);
    expect(block).toContain("guidanceDistribution");
    expect(block).toContain("groupBy(decisionCards.intent)");
  });

  it("decision-card-metrics computes completionRate from decidedAt", () => {
    const endpointIdx = authorityContent.indexOf("/decision-card-metrics");
    const block = authorityContent.slice(endpointIdx, endpointIdx + 2500);
    expect(block).toContain("completionRate");
    expect(block).toContain("decidedAt");
  });

  it("no longer returns hardcoded zero message", () => {
    expect(authorityContent).not.toContain("Decision card analytics are not yet available");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Affiliate monthly stats and topPerformingLinks
// ─────────────────────────────────────────────────────────────────────────────

describe("Affiliate monthly stats and topPerformingLinks — real aggregates", () => {
  it("getAffiliateDashboard imports count and sum from drizzle-orm", () => {
    // count and sum should be in the drizzle-orm import block
    const importIdx = storageContent.indexOf('} from "drizzle-orm";');
    const importBlock = storageContent.slice(0, importIdx + 20);
    expect(importBlock).toContain("count,");
    expect(importBlock).toContain("sum,");
  });

  it("getAffiliateDashboard computes monthly stats from affiliateTracking with monthStart filter", () => {
    const fnIdx = storageContent.indexOf("async getAffiliateDashboard(");
    expect(fnIdx).toBeGreaterThan(-1);
    const block = storageContent.slice(fnIdx, fnIdx + 3000);
    expect(block).toContain("monthStart");
    expect(block).toContain("monthlyStats");
    expect(block).not.toContain("Monthly stats (placeholder for now)");
  });

  it("getAffiliateDashboard computes real monthly clicks, referrals, conversions, earnings", () => {
    const fnIdx = storageContent.indexOf("async getAffiliateDashboard(");
    const block = storageContent.slice(fnIdx, fnIdx + 3000);
    expect(block).toContain("monthlyClicks");
    expect(block).toContain("monthlyReferrals");
    expect(block).toContain("monthlyEarnings");
    expect(block).toContain("monthlyConversions");
    expect(block).toContain("conversionRate");
  });

  it("getAffiliateDashboard computes topPerformingLinks from affiliateTracking grouped by sourceUrl", () => {
    const fnIdx = storageContent.indexOf("async getAffiliateDashboard(");
    const block = storageContent.slice(fnIdx, fnIdx + 3000);
    expect(block).toContain("topLinks");
    expect(block).toContain("groupBy(affiliateTracking.sourceUrl)");
    expect(block).toContain("ninetyDaysAgo");
    expect(block).not.toContain("topPerformingLinks: [], // To be implemented");
  });

  it("topPerformingLinks includes sourceUrl, clicks, conversions, totalCommission", () => {
    const fnIdx = storageContent.indexOf("async getAffiliateDashboard(");
    const block = storageContent.slice(fnIdx, fnIdx + 3600);
    expect(block).toContain("sourceUrl: l.sourceUrl");
    expect(block).toContain("clicks: Number(l.clicks)");
    expect(block).toContain("conversions: Number(l.conversions)");
    expect(block).toContain("totalCommission: Number(l.totalCommission");
  });
});
