import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("LA Plumbing public copy persistence", () => {
  it("keeps the customer request label and useful search description canonical", () => {
    const migration = read("migrations/0114_la_plumbing_public_copy_invariant.sql");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION enforce_la_plumbing_public_copy()");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF slug, cta_config, seo_meta ON profiles");
    expect(migration).toContain("WHERE slug = 'la-plumbing-solutions'");
    expect(migration).toContain("to_jsonb('Start a Request'::text)");
    expect(migration).toContain(
      "Residential and commercial plumbing repairs, drains, water heaters, gas, backflow, renovations, and new construction from Hammond, Louisiana."
    );
    expect(migration).not.toContain("See residential and commercial work from LA Plumbing Solutions.");
    expect(migration).not.toContain("Direct Connect");
  });
});
