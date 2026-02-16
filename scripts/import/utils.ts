export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const token of argv) {
    if (!token.startsWith("--")) continue;
    const [key, ...rest] = token.slice(2).split("=");
    if (!key) continue;
    args[key] = rest.length ? rest.join("=") : "true";
  }
  return args;
}

export function normalizeName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeWebsite(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function slugify(value: string): string {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "listing";
}

export function parseCsv(content: string, delimiter: string): Array<Record<string, string>> {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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
  if (row.length > 0 && row.some((cell) => cell !== "")) pushRow();
  if (rows.length < 2) return [];

  const normalizeHeader = (value: string): string =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");

  const headers = rows[0].map(normalizeHeader);
  const records: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const current = rows[i];
    const record: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      record[key] = String(current[col] ?? "").trim();
    }
    records.push(record);
  }
  return records;
}

export function getFirstValue(
  record: Record<string, string>,
  keys: string[],
  defaultValue = ""
): string {
  for (const key of keys) {
    const value = String(record[key] || "").trim();
    if (value) return value;
  }
  return defaultValue;
}

export function parseTradeCategories(value: string): string[] {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[;,|]/g)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 20);
}
