export type ImportParseMeta = {
  looksLikeHeader: boolean;
  headers: string[];
  delimiter: string;
};

export function detectImportDelimiter(input: string): string {
  const sample = String(input || "").slice(0, 4000);
  const comma = (sample.match(/,/g) || []).length;
  const semi = (sample.match(/;/g) || []).length;
  const tab = (sample.match(/\t/g) || []).length;
  const pipe = (sample.match(/\|/g) || []).length;
  if (tab >= comma && tab >= pipe && tab >= semi && tab > 0) return "\t";
  if (pipe >= comma && pipe >= semi && pipe > 0) return "|";
  if (semi >= comma && semi > 0) return ";";
  return ",";
}

function normalizeHeaderKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function parseDelimitedImport(
  input: string,
  delimiter: string
): { records: Array<Record<string, string>>; meta: ImportParseMeta } {
  const normalized = String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    while (row.length > 0 && row[row.length - 1] === "") row.pop();
    if (row.length > 0) rows.push(row);
    row = [];
  };

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = normalized[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }
    field += ch;
  }

  pushField();
  pushRow();

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

  if (!rows.length) {
    return {
      records: [],
      meta: { looksLikeHeader: false, headers: defaultHeaders, delimiter },
    };
  }

  const headerRowRaw = rows[0];
  const headerRow = headerRowRaw.map((h) => normalizeHeaderKey(h));

  const looksLikeHeader = (() => {
    if (headerRow.length < 2) return false;

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
    const headerHasEmailValue = headerRowRaw.some((v) => String(v || "").includes("@"));
    if (headerHintCount >= 2 && !headerHasEmailValue) {
      return true;
    }

    const nextRow = rows.length > 1 ? rows[1] : [];
    const peek = (idx: number) =>
      typeof nextRow[idx] === "string" ? nextRow[idx].trim() : String(nextRow[idx] ?? "").trim();

    const isEmailValue = (value: string) => value.includes("@") && value.includes(".");
    const isFipsValue = (value: string) => /^[0-9]{5}$/.test(value);
    const isPhoneValue = (value: string) => value.replace(/\D/g, "").length >= 10;

    let score = 0;
    let hasStrongSignal = false;

    for (let i = 0; i < headerRow.length; i++) {
      const key = headerRow[i] || "";
      const sample = peek(i);
      if (!key) continue;

      const keyIsEmail =
        key === "email" ||
        key.endsWith("_email") ||
        key.includes("email") ||
        key === "invitee_email";
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

    if (rows.length === 1) {
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

    return hasStrongSignal && score >= 2;
  })();

  const headers = looksLikeHeader ? headerRow : defaultHeaders;
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  const records = dataRows
    .map((cols) => {
      const rec: Record<string, string> = {};
      for (let idx = 0; idx < headers.length; idx++) {
        const key = headers[idx] || `col_${idx}`;
        rec[key] =
          typeof cols[idx] === "string" ? cols[idx].trim() : String(cols[idx] ?? "").trim();
      }
      return rec;
    })
    .filter((r) => Object.values(r).some((v) => String(v || "").trim().length > 0));

  return { records, meta: { looksLikeHeader, headers, delimiter } };
}
