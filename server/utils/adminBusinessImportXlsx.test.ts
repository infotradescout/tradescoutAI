import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseXlsxImport } from "./adminBusinessImportXlsx";

describe("adminBusinessImportXlsx", () => {
  it("parses multi-sheet workbooks and keeps phone + pads county fips", async () => {
    const wb = new ExcelJS.Workbook();

    const sheet1 = wb.addWorksheet("Contractors");
    sheet1.addRows([
      ["Contractor Directory Export"], // title row should be ignored
      [""],
      ["Company Name", "Business Email", "County FIPS", "State", "Phone"],
      ["Acme Plumbing", "hello@acmeplumbing.com", 12033, "FL", "(850) 555-1234"],
    ]);

    // Sheet2 uses a numeric fips without leading zeros; we should pad it to 5.
    const sheet2 = wb.addWorksheet("Vendors");
    sheet2.addRows([
      ["Name", "Email", "FIPS", "State Code", "Phone Number"],
      ["Zero County Test", "z@z.com", 1234, "AL", 2055559876],
    ]);

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseXlsxImport(buf);

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

  it("rejects files that only pretend to be XLSX workbooks", async () => {
    await expect(parseXlsxImport(Buffer.from("not an xlsx file"))).rejects.toThrow(
      "not a valid XLSX"
    );
  });

  it("rejects workbooks above the fixed decompression-risk boundary", async () => {
    await expect(parseXlsxImport(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow(
      "10 MB security limit"
    );
  });
});
