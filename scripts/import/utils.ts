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

export function normalizeCsvHeader(value: string): string {
  // Keep this identical across parseCsv + streamCsvFile so staging behaves the same in both modes.
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "") // BOM
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export async function streamCsvFile(params: {
  absolutePath: string;
  delimiter: string;
  onRecord: (record: Record<string, string>) => Promise<void> | void;
  maxRecords?: number;
}): Promise<{ parsedRecords: number }> {
  const fs = await import("fs");

  const delimiter = params.delimiter;
  let headers: string[] | null = null;

  let parsedRecords = 0;
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const hasAnyCell = (cells: string[]) => cells.some((cell) => String(cell || "").trim() !== "");

  const emitRow = async () => {
    while (row.length > 0 && row[row.length - 1] === "") row.pop();
    if (row.length === 0 || !hasAnyCell(row)) {
      row = [];
      return;
    }

    if (!headers) {
      headers = row.map(normalizeCsvHeader);
      row = [];
      return;
    }

    const record: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      record[key] = String(row[col] ?? "").trim();
    }

    parsedRecords++;
    await params.onRecord(record);
    row = [];
  };

  const stream = fs.createReadStream(params.absolutePath, { encoding: "utf8" });
  for await (const chunk of stream as any) {
    const text = String(chunk || "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          const next = text[i + 1];
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
      if (ch === "\r") {
        // ignore, we normalize to \n
        continue;
      }
      if (ch === delimiter) {
        pushField();
        continue;
      }
      if (ch === "\n") {
        pushField();
        await emitRow();
        if (params.maxRecords != null && parsedRecords >= params.maxRecords) {
          stream.close();
          return { parsedRecords };
        }
        continue;
      }
      field += ch;
    }
  }

  // Flush last row.
  pushField();
  if (row.length > 0 && hasAnyCell(row)) {
    await emitRow();
  }

  return { parsedRecords };
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
