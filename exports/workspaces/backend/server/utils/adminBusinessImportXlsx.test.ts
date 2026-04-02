import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsxImport } from "./adminBusinessImportXlsx";

describe("adminBusinessImportXlsx", () => {
  it("parses multi-sheet workbooks and keeps phone + pads county fips", () => {
    const wb = XLSX.utils.book_new();

    const sheet1 = XLSX.utils.aoa_to_sheet([
      ["Contractor Directory Export"], // title row should be ignored
      [""],
      ["Company Name", "Business Email", "County FIPS", "State", "Phone"],
      ["Acme Plumbing", "hello@acmeplumbing.com", 12033, "FL", "(850) 555-1234"],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet1, "Contractors");

    // Sheet2 uses a numeric fips without leading zeros; we should pad it to 5.
    const sheet2 = XLSX.utils.aoa_to_sheet([
      ["Name", "Email", "FIPS", "State Code", "Phone Number"],
      ["Zero County Test", "z@z.com", 1234, "AL", 2055559876],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet2, "Vendors");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const parsed = parseXlsxImport(buf);

    expect(parsed.meta.kind).toBe("xlsx");
    expect(parsed.meta.sheets.length).toBe(2);
    expect(parsed.records.length).toBe(2);

    const first = parsed.records.find((r) => r.import_sheet === "Contractors")!;
    expect(first.company_name).toBe("Acme Plumbing");
    expect(first.business_email).toBe("hello@acmeplumbing.com");
    expect(first.county_fips).toBe("12033");
    expect(first.phone).toBe("(850) 555-1234");
    expect(first.import_sheet_row).toBe("4");

    const second = parsed.records.find((r) => r.import_sheet === "Vendors")!;
    expect(second.fips).toBe("01234");
    expect(second.phone_number).toBe("2055559876");
  });
});
