import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("document accounting-lineage backfill migration", () => {
  it("atomically classifies standalone and profile-offer acct groups without merging them", () => {
    const migration = read("migrations/0130_document_standalone_lineage_backfill.sql");

    expect(migration).toContain("DO $$");
    expect(migration).toContain("LOCK TABLE documents IN ACCESS EXCLUSIVE MODE");
    expect(migration).toContain("left(legacy_document.job_id, 5) = 'acct_'");
    expect(migration).toContain("left(legacy_document.job_id, length('acct_profile_order_')) =");
    expect(migration).toContain("legacy_document.type IS DISTINCT FROM 'RECEIPT'");
    expect(migration).toContain("IS DISTINCT FROM 'profile_offer_purchase'");
    expect(migration).toContain("legacy_document.payload ->> 'profileOfferPurchaseId'");
    expect(migration).toContain("legacy_document.payload ->> 'profileOfferId'");
    expect(migration).toContain("legacy_document.payload ->> 'buyerUserId'");
    expect(migration).toContain("legacy_document.payload ->> 'sellerUserId'");
    expect(migration).toContain("jsonb_typeof(legacy_document.payload -> 'profileOfferId')");
    expect(migration).toContain("IS DISTINCT FROM 'string'");
    expect(migration).toContain("length(btrim(legacy_document.payload ->> 'buyerUserId')) > 256");
    expect(migration).toContain("nullif(");
    expect(migration).toContain("'acct_profile_order_' || left(");
    expect(migration).toContain("'{accountingGroupId}'");
    expect(migration).toContain("to_jsonb(job_id)");
    expect(migration).toContain("'{lineageKind}'");
    expect(migration).toContain("'\"profile_offer_purchase\"'::jsonb");
    expect(migration).toContain("'\"standalone_accounting\"'::jsonb");
    expect(migration).toContain("job_id = NULL");
    expect(migration).toContain(
      "left(job_id, length('acct_profile_order_')) <> 'acct_profile_order_'"
    );
    expect(migration).not.toContain("LIKE 'acct_");
    expect(migration).not.toMatch(/WHERE\s+job_id\s+IS\s+NULL/i);
  });

  it("fails preflight on ambiguous prefix/source/lineage or payload provenance", () => {
    const migration = read("migrations/0130_document_standalone_lineage_backfill.sql");

    expect(migration).toContain("payload ? 'accountingGroupId'");
    expect(migration).toContain("IS DISTINCT FROM legacy_document.job_id");
    expect(migration).toContain("permissions ? 'lineageKind'");
    expect(migration).toContain("permissions ->> 'source' = 'profile_offer_purchase'");
    expect(migration).toContain("IS DISTINCT FROM 'standalone_accounting'");
    expect(migration).toContain("jsonb_typeof(legacy_document.payload)");
    expect(migration).toContain("jsonb_typeof(legacy_document.permissions)");
    expect(migration).toContain("FROM leads AS referenced_lead");
    expect(migration).toContain("document accounting lineage preflight failed");
    expect(migration).toContain("USING ERRCODE = '23514'");
    expect(migration).toContain("Do not overwrite or delete conflicting rows");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+documents/i);
  });

  it("installs and validates the canonical invariant before releasing the writer lock", () => {
    const migration = read("migrations/0130_document_standalone_lineage_backfill.sql");
    const updateOffset = migration.lastIndexOf("UPDATE documents");
    const addOffset = migration.indexOf(
      "ADD CONSTRAINT documents_job_id_no_synthetic_accounting_check"
    );
    const validateOffset = migration.indexOf(
      "VALIDATE CONSTRAINT documents_job_id_no_synthetic_accounting_check"
    );
    const blockEndOffset = migration.lastIndexOf("END $$;");

    expect(updateOffset).toBeGreaterThan(migration.indexOf("LOCK TABLE documents"));
    expect(addOffset).toBeGreaterThan(updateOffset);
    expect(validateOffset).toBeGreaterThan(addOffset);
    expect(blockEndOffset).toBeGreaterThan(validateOffset);
    expect(migration).toContain("CHECK (job_id IS NULL OR left(job_id, 5) <> 'acct_') NOT VALID");
    expect(migration).toContain("COMMENT ON CONSTRAINT");
    expect(migration).toContain("tradescout-schema:0130:v1");
  });

  it("registers 0130 after the coordinated 0129 journal entry", () => {
    const journal = JSON.parse(read("migrations/meta/_journal.json"));
    expect(journal.entries).toContainEqual(
      expect.objectContaining({
        idx: 133,
        tag: "0130_document_standalone_lineage_backfill",
        breakpoints: false,
      })
    );
  });
});
