import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("storage contract extraction", () => {
  it("keeps the public IStorage barrel while moving the contract out of the implementation", () => {
    const storageSource = read("server/storage.ts");
    const contractSource = read("server/storage/contracts.ts");

    expect(storageSource).toMatch(
      /import type\s*\{[^}]*\bIStorage\b[^}]*\}\s*from "\.\/storage\/contracts";/
    );
    expect(storageSource).toContain('export type { IStorage } from "./storage/contracts";');
    expect(storageSource).not.toContain("export interface IStorage {");
    expect(contractSource).toContain("export interface IStorage {");
    expect(contractSource).toContain("getUser(id: string): Promise<User | undefined>;");
    expect(contractSource).toContain("leaveHOAWithReason(params:");
  });

  it("retains the DatabaseStorage runtime exports", async () => {
    const storageModule = await import("../storage");

    expect(typeof storageModule.DatabaseStorage).toBe("function");
    expect(storageModule.storage).toBeInstanceOf(storageModule.DatabaseStorage);
    for (const method of [
      "getMarketplaceListings",
      "upsertHomeScoutListingFromSource",
      "createCommunityPost",
      "getContractors",
      "getMonthlyLeaderboard",
      "createCrmContact",
      "getDailyDeals",
    ]) {
      expect(typeof (storageModule.storage as any)[method], method).toBe("function");
    }
  }, 15_000);

  it("keeps extracted implementations out of the root storage file", () => {
    const storageSource = read("server/storage.ts");

    expect(storageSource).not.toContain("async getMarketplaceListings(");
    expect(storageSource).not.toContain("async createCommunityPost(");
    expect(storageSource).not.toContain("async getContractors(");
    expect(storageSource).not.toContain("async getMonthlyLeaderboard(");
    expect(storageSource).not.toContain("async createCrmContact(");
    expect(read("server/storage/repositories/marketplace-and-homescout.ts")).toContain(
      "async getMarketplaceListings("
    );
    expect(read("server/storage/repositories/social-and-leaderboards.ts")).toContain(
      "async createCommunityPost("
    );
    expect(read("server/storage/repositories/social-and-leaderboards.ts")).toContain(
      "async getContractors("
    );
    expect(read("server/storage/repositories/crm-and-deals.ts")).toContain(
      "async createCrmContact("
    );
  });
});
