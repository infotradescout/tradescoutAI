import ExcelJS from "exceljs";

const MAX_XLSX_BYTES = 10 * 1024 * 1024;
const MAX_XLSX_SHEETS = 50;
const MAX_XLSX_ROWS = 100_000;
const MAX_XLSX_COLUMNS = 256;
const MAX_XLSX_CELLS = 2_000_000;

export type ImportXlsxSheetMeta = {
  sheetName: string;
  looksLikeHeader: boolean;
  headers: string[];
  rows: number;
};

export type ImportXlsxParseMeta = {
  kind: "xlsx";
  sheets: ImportXlsxSheetMeta[];
};

function normalizeHeaderKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function coerceCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function normalizeDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function isRowEmpty(row: unknown[]): boolean {
  if (!Array.isArray(row)) return true;
  return row.every((cell) => String(cell ?? "").trim().length === 0);
}

function looksLikeHeaderRow(headerRow: string[], nextRow: string[] | null): boolean {
  if (headerRow.length < 2) return false;

  // Fast-path: if the first row contains multiple known header keys, treat it as headers even if
  // the next row is sparse/blank (common in multi-sheet workbooks with inconsistent coverage).
  const headerHintKeys = new Set([
    "email",
    "owner_email",
    "invitee_email",
    "business_name",
    "company_name",
    "company",
    "name",
    "phone",
    "phone_number",
    "tel",
    "telephone",
    "website",
    "url",
    "county_fips",
    "fips",
    "state_code",
    "state",
    "address",
    "street",
    "city",
    "zip",
    "zip_code",
  ]);
  const headerHintCount = headerRow.filter((h) => {
    if (!h) return false;
    if (headerHintKeys.has(h)) return true;
    if (h.includes("email")) return true;
    if (h.includes("phone") || h.includes("tel")) return true;
    if (h.includes("county") && h.includes("fips")) return true;
    if (h.includes("business") && h.includes("name")) return true;
    return false;
  }).length;
  const headerHasEmailValue = headerRow.some((v) => v.includes("@") && v.includes("."));
  if (headerHintCount >= 2 && !headerHasEmailValue) return true;
  if (!nextRow) {
    // Single-row sheets: fall back to key hint matching.
    return headerRow.some((h) =>
      [
        "email",
        "business_name",
        "company_name",
        "name",
        "company",
        "phone",
        "county_fips",
        "fips",
        "state_code",
        "website",
      ].includes(h)
    );
  }

  const isEmailValue = (value: string) => value.includes("@") && value.includes(".");
  const isFipsValue = (value: string) => /^[0-9]{5}$/.test(value);
  const isPhoneValue = (value: string) => value.replace(/\D/g, "").length >= 10;

  let score = 0;
  let hasStrongSignal = false;

  for (let i = 0; i < headerRow.length; i++) {
    const key = headerRow[i] || "";
    const sample = nextRow[i] || "";
    if (!key) continue;

    const keyIsEmail =
      key === "email" || key.endsWith("_email") || key.includes("email") || key === "invitee_email";
    const keyIsName =
      key === "business_name" ||
      key === "company_name" ||
      key === "company" ||
      key === "trade_name" ||
      key === "dba" ||
      key === "legal_name" ||
      key === "name";
    const keyIsFips = key === "county_fips" || key === "fips" || key.includes("county_fips");
    const keyIsPhone =
      key === "phone" || key.endsWith("_phone") || key.includes("phone") || key === "tel";

    if (keyIsEmail) {
      hasStrongSignal = true;
      if (sample && isEmailValue(sample)) score += 2;
      continue;
    }
    if (keyIsFips) {
      hasStrongSignal = true;
      if (sample && isFipsValue(sample)) score += 1;
      continue;
    }
    if (keyIsPhone) {
      if (sample && isPhoneValue(sample)) score += 1;
      continue;
    }
    if (keyIsName) {
      if (sample && !isEmailValue(sample)) score += 1;
    }
  }

  return hasStrongSignal && score >= 2;
}

export async function parseXlsxImport(buffer: Buffer): Promise<{
  records: Array<Record<string, string>>;
  meta: ImportXlsxParseMeta;
}> {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new Error("The XLSX upload is empty or invalid.");
  }
  if (buffer.length > MAX_XLSX_BYTES) {
    throw new Error("The XLSX upload exceeds the 10 MB security limit.");
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    throw new Error("The uploaded file is not a valid XLSX workbook.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  if (workbook.worksheets.length > MAX_XLSX_SHEETS) {
    throw new Error(`The XLSX upload exceeds the ${MAX_XLSX_SHEETS}-sheet security limit.`);
  }
  const defaultHeaders = [
    "email",
    "business_name",
    "county_fips",
    "state_code",
    "phone",
    "website",
    "category",
    "services",
    "owner_first_name",
    "owner_last_name",
  ];

  const records: Array<Record<string, string>> = [];
  const sheets: ImportXlsxSheetMeta[] = [];
  let totalCells = 0;

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    if (worksheet.rowCount > MAX_XLSX_ROWS) {
      throw new Error(`Sheet "${sheetName}" exceeds the ${MAX_XLSX_ROWS}-row security limit.`);
    }

    const rows: string[][] = [];
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (row.cellCount > MAX_XLSX_COLUMNS) {
        throw new Error(
          `Sheet "${sheetName}" exceeds the ${MAX_XLSX_COLUMNS}-column security limit.`
        );
      }
      totalCells += row.cellCount;
      if (totalCells > MAX_XLSX_CELLS) {
        throw new Error(`The XLSX upload exceeds the ${MAX_XLSX_CELLS}-cell security limit.`);
      }

      rows.push(
        Array.from({ length: row.cellCount }, (_, columnIndex) =>
          row.getCell(columnIndex + 1).text.trim()
        )
      );
    }

    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Some admin spreadsheets include a title row or blank spacing before the header row.
    // Scan the first few rows for a header row that matches our heuristics.
    const scanLimit = Math.min(12, rows.length);
    let headerIndex = 0;
    let headerRow: string[] = [];
    let looksLikeHeader = false;

    for (let i = 0; i < scanLimit; i++) {
      const candidateRaw = Array.isArray(rows[i]) ? rows[i] : [];
      if (isRowEmpty(candidateRaw)) continue;

      const candidateHeader = candidateRaw.map((h) => normalizeHeaderKey(h));
      if (candidateHeader.length < 2) continue;

      let nextRow: string[] | null = null;
      for (let j = i + 1; j < rows.length; j++) {
        const maybe = Array.isArray(rows[j]) ? rows[j] : [];
        if (isRowEmpty(maybe)) continue;
        nextRow = maybe.map((v) => coerceCell(v));
        break;
      }

      if (looksLikeHeaderRow(candidateHeader, nextRow)) {
        headerIndex = i;
        headerRow = candidateHeader;
        looksLikeHeader = true;
        break;
      }
    }

    if (!looksLikeHeader) {
      const headerRaw = Array.isArray(rows[0]) ? rows[0] : [];
      headerRow = headerRaw.map((h) => normalizeHeaderKey(h));
    }

    const headers = looksLikeHeader ? headerRow : defaultHeaders;
    const dataRows = looksLikeHeader ? rows.slice(headerIndex + 1) : rows;
    const baseRowNumber = looksLikeHeader ? headerIndex + 2 : 1; // 1-based Excel row number

    let added = 0;
    for (let idx = 0; idx < dataRows.length; idx++) {
      const cols = Array.isArray(dataRows[idx]) ? dataRows[idx] : [];
      if (isRowEmpty(cols)) continue;
      const rec: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c] || `col_${c}`;
        const raw = coerceCell(cols[c]);
        if (key === "county_fips" || key === "fips" || key.endsWith("_fips")) {
          const digits = normalizeDigits(raw);
          rec[key] =
            digits.length > 0 && digits.length < 5 ? digits.padStart(5, "0") : digits || raw;
        } else {
          rec[key] = raw;
        }
      }

      // Preserve origin for debugging and later reconciliation.
      rec.import_sheet = sheetName;
      rec.import_sheet_row = String(baseRowNumber + idx);

      if (Object.values(rec).some((v) => String(v || "").trim().length > 0)) {
        records.push(rec);
        added++;
      }
    }

    sheets.push({
      sheetName,
      looksLikeHeader,
      headers,
      rows: added,
    });
  }

  return { records, meta: { kind: "xlsx", sheets } };
}
