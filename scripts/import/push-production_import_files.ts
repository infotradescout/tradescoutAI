import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

type LoginResult = { cookieHeader: string };

type ImportResponse = {
  dryRun: boolean;
  delimiter: "comma" | "tab" | "pipe";
  totals: {
    rows: number;
    createdUsers: number;
    updatedUsers: number;
    createdBusinesses: number;
    updatedBusinesses: number;
    createdUnclaimedBusinesses?: number;
    updatedUnclaimedBusinesses?: number;
    createdPublicProfiles?: number;
    activationPrepared: number;
    activationEmailed: number;
  };
};

function requireEnv(name: string): string {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function byteLen(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function normalizeNewlines(input: string): string {
  // Some scraped exports include NUL bytes; remove them before JSON/DB write.
  return input
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function readSetCookieHeader(res: Response): string {
  // Node fetch exposes multiple Set-Cookie headers via getSetCookie() (undici) in newer versions,
  // but to keep compatibility, parse raw.
  const anyHeaders: any = res.headers as any;
  const setCookies: string[] =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : (() => {
          const raw = res.headers.get("set-cookie");
          return raw ? [raw] : [];
        })();

  const parts = setCookies
    .map((c) =>
      String(c || "")
        .split(";", 1)[0]
        ?.trim()
    )
    .filter(Boolean);

  if (!parts.length) return "";
  return parts.join("; ");
}

async function login(baseUrl: string, email: string, password: string): Promise<LoginResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/auth/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Login failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const cookieHeader = readSetCookieHeader(res);
  if (!cookieHeader) {
    throw new Error("Login succeeded but no session cookie was returned (Set-Cookie missing).");
  }
  return { cookieHeader };
}

async function postImport(
  baseUrl: string,
  cookieHeader: string,
  payload: {
    content: string;
    source: string;
    dryRun: boolean;
    sendActivationEmails: boolean;
    includeActivationLinks: boolean;
    createPublicProfiles: boolean;
    defaultCountyFips?: string;
    defaultStateCode?: string;
  }
): Promise<ImportResponse> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/admin/businesses/import`;
  let lastErr = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return (await res.json()) as ImportResponse;
    }
    const text = await res.text().catch(() => "");
    lastErr = text.slice(0, 500);

    // Backoff on 429 and 5xx. Fail fast on auth/validation errors.
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      throw new Error(`Import failed (${res.status}): ${lastErr}`);
    }
    if (res.status === 429 || res.status >= 500) {
      const delayMs = Math.min(60_000, 1500 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    throw new Error(`Import failed (${res.status}): ${lastErr}`);
  }
  throw new Error(`Import failed (retries exceeded): ${lastErr}`);
}

function chunkCsvByBytes(csvText: string, maxBytes: number): string[] {
  const normalized = normalizeNewlines(csvText).trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  if (lines.length <= 1) return [normalized + "\n"];

  const header = lines[0];
  const data = lines.slice(1).filter((l) => l.trim().length > 0);

  const chunks: string[] = [];
  let current: string[] = [header];
  let currentBytes = byteLen(header) + 1;

  for (const line of data) {
    const lineBytes = byteLen(line) + 1;
    // If a single line is too large, still send it alone to avoid infinite loops.
    if (current.length > 1 && currentBytes + lineBytes > maxBytes) {
      chunks.push(current.join("\n") + "\n");
      current = [header, line];
      currentBytes = byteLen(header) + 1 + lineBytes;
      continue;
    }
    current.push(line);
    currentBytes += lineBytes;
    if (currentBytes > maxBytes && current.length === 2) {
      chunks.push(current.join("\n") + "\n");
      current = [header];
      currentBytes = byteLen(header) + 1;
    }
  }

  if (current.length > 1) {
    chunks.push(current.join("\n") + "\n");
  }
  return chunks;
}

async function main() {
  const baseUrl = String(process.env.IMPORT_BASE_URL || "https://www.thetradescout.com").trim();
  const email = String(
    process.env.IMPORT_ADMIN_EMAIL || process.env.MASTER_ADMIN_EMAIL || ""
  ).trim();
  const password = String(
    process.env.IMPORT_ADMIN_PASSWORD || process.env.MASTER_ADMIN_PASSWORD || ""
  ).trim();
  if (!email || !password) {
    throw new Error(
      "Missing admin creds. Set IMPORT_ADMIN_EMAIL + IMPORT_ADMIN_PASSWORD (or MASTER_ADMIN_EMAIL + MASTER_ADMIN_PASSWORD)."
    );
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const startAtArg = args.find((a) => a.startsWith("--start-at="));
  const startAtChunk = startAtArg
    ? Math.max(1, Number.parseInt(startAtArg.split("=", 2)[1] || "1", 10))
    : 1;
  const throttleArg = args.find((a) => a.startsWith("--throttle-ms="));
  const throttleMs = throttleArg
    ? Math.max(0, Number.parseInt(throttleArg.split("=", 2)[1] || "0", 10))
    : 250;

  const files = args.filter((arg) => !arg.startsWith("-"));
  if (files.length === 0) {
    throw new Error(
      "Usage: tsx scripts/import/push-production_import_files.ts <file1.csv> <file2.csv> ..."
    );
  }

  const { cookieHeader } = await login(baseUrl, email, password);

  // Production JSON body limit is intentionally small; keep chunks conservative to avoid 413s.
  const maxBytes = (() => {
    const raw = String(process.env.IMPORT_MAX_BYTES || "").trim();
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? Math.max(50_000, Math.min(900_000, n)) : 200_000;
  })();
  for (const filePathRaw of files) {
    const filePath = path.resolve(filePathRaw);
    const label = path.basename(filePath);
    const text = fs.readFileSync(filePath, "utf8");
    const chunks = chunkCsvByBytes(text, maxBytes);
    if (chunks.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[import] skip empty: ${label}`);
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(`[import] ${label}: ${chunks.length} chunk(s)`);

    let totals = {
      rows: 0,
      createdUsers: 0,
      updatedUsers: 0,
      createdBusinesses: 0,
      updatedBusinesses: 0,
      createdUnclaimedBusinesses: 0,
      updatedUnclaimedBusinesses: 0,
    };

    for (let i = 0; i < chunks.length; i++) {
      const chunkNo = i + 1;
      if (chunkNo < startAtChunk) continue;
      const chunk = chunks[i];
      const source = `file:${label}:chunk:${String(chunkNo).padStart(3, "0")}`;
      const res = await postImport(baseUrl, cookieHeader, {
        content: chunk,
        source,
        dryRun,
        sendActivationEmails: false,
        includeActivationLinks: false,
        createPublicProfiles: false,
      });

      totals.rows += res.totals.rows || 0;
      totals.createdUsers += res.totals.createdUsers || 0;
      totals.updatedUsers += res.totals.updatedUsers || 0;
      totals.createdBusinesses += res.totals.createdBusinesses || 0;
      totals.updatedBusinesses += res.totals.updatedBusinesses || 0;
      totals.createdUnclaimedBusinesses += res.totals.createdUnclaimedBusinesses || 0;
      totals.updatedUnclaimedBusinesses += res.totals.updatedUnclaimedBusinesses || 0;

      // eslint-disable-next-line no-console
      console.log(
        `[import]  - chunk ${chunkNo}/${chunks.length}: rows=${res.totals.rows} created_unclaimed=${res.totals.createdUnclaimedBusinesses ?? 0} updated_unclaimed=${res.totals.updatedUnclaimedBusinesses ?? 0}`
      );

      if (throttleMs > 0) {
        await new Promise((r) => setTimeout(r, throttleMs));
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[import] done ${label}: rows=${totals.rows} created_unclaimed=${totals.createdUnclaimedBusinesses} updated_unclaimed=${totals.updatedUnclaimedBusinesses}`
    );
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  process.exit(1);
});
