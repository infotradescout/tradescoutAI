import { describe, expect, it } from "vitest";
import { detectImportDelimiter, parseDelimitedImport } from "./adminBusinessImportParser";

describe("adminBusinessImportParser", () => {
  it("detects headers like company_name + business_email and does not swap columns", () => {
    const csv = [
      "Company Name,Business Email,County FIPS,State",
      "Acme Plumbing,hello@acmeplumbing.com,12033,FL",
    ].join("\n");

    const delimiter = detectImportDelimiter(csv);
    expect(delimiter).toBe(",");

    const parsed = parseDelimitedImport(csv, delimiter);
    expect(parsed.meta.looksLikeHeader).toBe(true);
    expect(parsed.meta.headers).toContain("company_name");
    expect(parsed.meta.headers).toContain("business_email");

    expect(parsed.records.length).toBe(1);
    expect(parsed.records[0].company_name).toBe("Acme Plumbing");
    expect(parsed.records[0].business_email).toBe("hello@acmeplumbing.com");
    expect(parsed.records[0].county_fips).toBe("12033");
  });

  it("does not treat a data row as a header when the next row doesn't match header shapes", () => {
    const csv = ["Acme Plumbing,hello@acmeplumbing.com,12033,FL"].join("\n");
    const delimiter = detectImportDelimiter(csv);
    const parsed = parseDelimitedImport(csv, delimiter);

    // With a single row, we keep legacy hint matching conservative; this row should be treated as data.
    expect(parsed.records.length).toBe(1);
    expect(parsed.meta.looksLikeHeader).toBe(false);
    expect(parsed.records[0].email).toBe("Acme Plumbing");
    expect(parsed.records[0].business_name).toBe("hello@acmeplumbing.com");
  });
});
