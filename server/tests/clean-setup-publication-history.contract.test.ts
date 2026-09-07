import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyMigrationHashDisposition } from "../runtimeMigrationPolicy";

const sql = fs.readFileSync(path.resolve("migrations/0126_jw_stone_offer_publication.sql"), "utf8").replace(/\r\n?/g, "\n");
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const currentHashes = [hash(sql), hash(sql.replace(/\n/g, "\r\n"))];
const aliases = JSON.parse(fs.readFileSync(path.resolve("migrations/meta/_hash_aliases.json"), "utf8"))["0126_jw_stone_offer_publication.sql"] as string[];

describe("clean setup preserves completed business publication", () => {
  it("recognizes each actually recorded predecessor without replay or duplicate adoption", () => {
    expect(aliases).toHaveLength(2);
    for (const currentHash of currentHashes) for (const recordedHash of aliases) {
      expect(classifyMigrationHashDisposition({ currentHash, predecessorHashes: aliases, recordedHash, preexistingDatabase: true })).toBe("current");
    }
  });
  it("does not accept an unrelated future SQL change as the reviewed repair", () => {
    expect(classifyMigrationHashDisposition({ currentHash: hash(sql + "-- different repair"), predecessorHashes: aliases, recordedHash: aliases[0], preexistingDatabase: true })).toBe("adopt");
  });
  it("still refuses unknown history on an existing database", () => {
    expect(classifyMigrationHashDisposition({ currentHash: currentHashes[0], predecessorHashes: aliases, recordedHash: null, preexistingDatabase: true })).toBe("refuse");
    expect(classifyMigrationHashDisposition({ currentHash: currentHashes[0], predecessorHashes: aliases, recordedHash: "unrelated", preexistingDatabase: true })).toBe("refuse");
  });
  it("requires a declared predecessor and preserves fresh application behavior", () => {
    expect(classifyMigrationHashDisposition({ currentHash: currentHashes[0], predecessorHashes: [], recordedHash: aliases[0], preexistingDatabase: true })).toBe("apply");
    expect(classifyMigrationHashDisposition({ currentHash: currentHashes[0], predecessorHashes: aliases, recordedHash: null, preexistingDatabase: false })).toBe("apply");
  });
  it("retains all existing publication safety checks after the absent-target guard", () => {
    const guard = sql.indexOf("IF NOT EXISTS (SELECT 1 FROM profiles WHERE slug = 'jw-stone')");
    const ownership = sql.indexOf("SELECT profile.business_id");
    expect(guard).toBeGreaterThan(-1);
    expect(ownership).toBeGreaterThan(guard);
    expect(sql.slice(guard, ownership)).toContain("FROM bidrock_listings WHERE source_profile_slug = 'jw-stone'");
    expect(sql.slice(guard, ownership)).toContain("FROM stone_asset_passports");
    expect(sql.slice(guard, ownership)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/);
    for (const rule of ["jw_target_count <> 7", "jw_eligible_count <> 7", "inventory_row.held_quantity = 0", "listing_row.price_cents IS NULL", "confirmation_expires_at > NOW()", "account.verification_status = 'approved'"]) {
      expect(sql.slice(ownership)).toContain(rule);
    }
  });
});
