import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  getJwStonePricingSourceMode,
  readApprovedJwStonePricingImport,
} from "./jwStonePricingImport";
import {
  JW_STONE_PRICING_DRIVE_FILE_ID,
  JW_STONE_PRICING_DRIVE_FOLDER_ID,
  JW_STONE_PRICING_WORKSHEET,
  jwStonePriceKey,
} from "@shared/jwStoneMemberPricing";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED_XML_BYTES = 20 * 1024 * 1024;
const MAX_WORKBOOK_XML_FILES = 200;
const MAX_WORKBOOK_ARCHIVE_FILES = 300;
const MAX_UNCOMPRESSED_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_PRICE_ROWS = 500;
const DEFAULT_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export const JW_STONE_PRICING_HEADERS = Object.freeze([
  "Stone Name",
  "Landed Cost $/Sq. Ft.",
  "Slab Price $/Sq. Ft.",
  "Bundle Price $/Sq. Ft.",
] as const);
export const JW_STONE_PRICING_QUANTITY_HEADER = "Bundle Minimum Slabs";

export type JwStoneDrivePriceRow = Readonly<{
  stoneName: string;
  stoneKey: string;
  landedCostCents: number | null;
  slabPriceCents: number;
  bundlePriceCents: number;
  bundleMinSlabs?: number;
}>;

export type JwStonePricingSnapshot = Readonly<{
  sourceUpdatedAt: string;
  prices: readonly JwStoneDrivePriceRow[];
}>;

export type JwStoneDriveFileMetadata = Readonly<{
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: readonly string[];
  trashed?: boolean;
  size?: string;
}>;

type DrivePricingConfig = Readonly<{
  folderId: string;
  fileId: string;
  cacheMs: number;
  requestTimeoutMs: number;
}>;

let accessTokenCache: { expiresAt: number; token: string } | null = null;
let cachedSnapshot: { expiresAt: number; value: JwStonePricingSnapshot } | null = null;
let pendingSnapshot: Promise<JwStonePricingSnapshot> | null = null;

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function drivePricingConfig(): DrivePricingConfig {
  return {
    folderId:
      String(process.env.JW_STONE_DRIVE_FOLDER_ID || "").trim() || JW_STONE_PRICING_DRIVE_FOLDER_ID,
    fileId:
      String(process.env.JW_STONE_DRIVE_PRICING_FILE_ID || "").trim() ||
      JW_STONE_PRICING_DRIVE_FILE_ID,
    cacheMs: positiveInteger(process.env.JW_STONE_DRIVE_PRICING_CACHE_MS, DEFAULT_CACHE_MS),
    requestTimeoutMs: positiveInteger(
      process.env.JW_STONE_DRIVE_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS
    ),
  };
}

type ServiceAccountCredentials = Readonly<{
  client_email: string;
  private_key: string;
}>;

function validateServiceAccountCredentials(value: unknown): ServiceAccountCredentials {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  if (
    typeof record.client_email !== "string" ||
    !record.client_email.trim() ||
    typeof record.private_key !== "string" ||
    !record.private_key.includes("PRIVATE KEY")
  ) {
    throw new Error("JW Stone Drive service-account credentials are incomplete");
  }
  return {
    client_email: record.client_email.trim(),
    private_key: record.private_key,
  };
}

function parseServiceAccountCredentials(): ServiceAccountCredentials | null {
  const encoded = String(process.env.JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 || "").trim();
  if (!encoded) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("JW Stone Drive service-account credentials are invalid");
  }
  return validateServiceAccountCredentials(parsed);
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function configuredServiceAccount(): Promise<ServiceAccountCredentials | null> {
  const inline = parseServiceAccountCredentials();
  if (inline) return inline;
  const credentialsPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (!credentialsPath) return null;
  try {
    return validateServiceAccountCredentials(JSON.parse(await readFile(credentialsPath, "utf8")));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("JW Stone Drive application credentials are invalid");
    }
    throw new Error("JW Stone Drive application credentials are unavailable");
  }
}

async function requestOAuthToken(body: URLSearchParams, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`JW Stone Drive token request failed (${response.status})`);
    const payload = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    const token = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
    if (!token) throw new Error("JW Stone Drive token response is invalid");
    const expiresIn = positiveInteger(payload.expires_in, 3600);
    accessTokenCache = {
      token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
    };
    return token;
  } finally {
    clearTimeout(timeout);
  }
}

async function serviceAccountAccessToken(
  credentials: ServiceAccountCredentials,
  timeoutMs: number
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: DRIVE_READONLY_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(credentials.private_key))}`;
  return requestOAuthToken(
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    timeoutMs
  );
}

async function driveAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }
  const config = drivePricingConfig();
  const credentials = await configuredServiceAccount();
  if (credentials) return serviceAccountAccessToken(credentials, config.requestTimeoutMs);

  const refreshToken = String(process.env.JW_STONE_DRIVE_REFRESH_TOKEN || "").trim();
  if (refreshToken) {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) {
      throw new Error("JW Stone Drive OAuth credentials are incomplete");
    }
    return requestOAuthToken(
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      config.requestTimeoutMs
    );
  }
  throw new Error("JW Stone Drive authorization is not configured");
}

export async function getJwStoneDriveIdentityEmail(): Promise<string> {
  const serviceAccount = await configuredServiceAccount();
  if (serviceAccount) return serviceAccount.client_email;

  const config = drivePricingConfig();
  const token = await driveAccessToken();
  const about = await driveJson<{ user?: { emailAddress?: unknown } }>({
    url: "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)",
    token,
    timeoutMs: config.requestTimeoutMs,
    resource: "identity",
  });
  const email = typeof about.user?.emailAddress === "string" ? about.user.emailAddress.trim() : "";
  if (!email || !email.includes("@")) {
    throw new Error("JW Stone Drive identity response is invalid");
  }
  return email;
}
async function authorizedDriveRequest<T>(args: {
  url: string;
  token: string;
  timeoutMs: number;
  consume: (response: Response) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch(args.url, {
      headers: { Authorization: `Bearer ${args.token}` },
      signal: controller.signal,
    });
    return await args.consume(response);
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function driveJson<T>(args: {
  url: string;
  token: string;
  timeoutMs: number;
  resource: string;
}): Promise<T> {
  return authorizedDriveRequest({
    ...args,
    consume: async (response) => {
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`JW Stone pricing ${args.resource} request failed (${response.status})`);
      }
      return (await response.json()) as T;
    },
  });
}

async function driveWorkbook(args: {
  url: string;
  token: string;
  timeoutMs: number;
}): Promise<Buffer> {
  return authorizedDriveRequest({
    ...args,
    consume: async (response) => {
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`JW Stone pricing workbook request failed (${response.status})`);
      }
      const contentLength = Number(response.headers.get("content-length") || "0");
      if (contentLength > MAX_WORKBOOK_BYTES) {
        throw new Error("JW Stone pricing workbook exceeds the security limit");
      }
      if (!response.body) {
        const fallback = Buffer.from(await response.arrayBuffer());
        if (fallback.length > MAX_WORKBOOK_BYTES) {
          throw new Error("JW Stone pricing workbook exceeds the security limit");
        }
        return fallback;
      }

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          total += chunk.length;
          if (total > MAX_WORKBOOK_BYTES) {
            throw new Error("JW Stone pricing workbook exceeds the security limit");
          }
          chunks.push(chunk);
        }
      } finally {
        reader.releaseLock();
      }
      return Buffer.concat(chunks, total);
    },
  });
}

export function validateJwStoneDriveFileMetadata(
  metadata: JwStoneDriveFileMetadata,
  expected: { folderId: string; fileId: string }
): void {
  if (metadata.id !== expected.fileId) throw new Error("JW Stone pricing file identity changed");
  if (metadata.trashed === true) throw new Error("JW Stone pricing file is in trash");
  if (!metadata.parents?.includes(expected.folderId)) {
    throw new Error("JW Stone pricing file is outside the approved Drive folder");
  }
  if (metadata.mimeType !== XLSX_MIME && metadata.mimeType !== GOOGLE_SHEET_MIME) {
    throw new Error("JW Stone pricing file type is unsupported");
  }
  const modifiedAt = new Date(metadata.modifiedTime);
  if (Number.isNaN(modifiedAt.getTime())) {
    throw new Error("JW Stone pricing file has no valid modification time");
  }
  if (metadata.size && positiveInteger(metadata.size, 0) > MAX_WORKBOOK_BYTES) {
    throw new Error("JW Stone pricing workbook exceeds the security limit");
  }
}

function cellCurrencyNumber(cell: ExcelJS.Cell, label: string, optional = false): number | null {
  const raw = cell.value;
  if (raw == null || (typeof raw === "string" && !raw.trim())) {
    if (optional) return null;
    throw new Error(`${label} is required`);
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(`${label} must be a numeric value`);
  }
  if (raw <= 0 || raw > 100_000) throw new Error(`${label} is outside the accepted range`);
  const cents = Math.round(raw * 100);
  if (Math.abs(raw * 100 - cents) > 0.000001) {
    throw new Error(`${label} cannot have more than two decimal places`);
  }
  return cents;
}

function workbookLooksLikeXlsx(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

async function loadPricingWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const zip = await JSZip.loadAsync(buffer);
  const archiveEntries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (archiveEntries.length > MAX_WORKBOOK_ARCHIVE_FILES) {
    throw new Error("JW Stone pricing workbook has too many archive parts");
  }
  let declaredUncompressedBytes = 0;
  for (const entry of archiveEntries) {
    const declaredSize = Number(
      (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize || 0
    );
    if (Number.isFinite(declaredSize) && declaredSize > 0) {
      declaredUncompressedBytes += declaredSize;
      if (declaredUncompressedBytes > MAX_UNCOMPRESSED_ARCHIVE_BYTES) {
        throw new Error("JW Stone pricing workbook expands beyond the security limit");
      }
    }
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (originalError) {
    // The current owner-created workbook uses the valid SpreadsheetML `x:`
    // namespace prefix. ExcelJS 4 rejects that form, so normalize only that
    // namespace in a bounded in-memory copy and retry without mutating Drive.
    const workbookEntry = zip.file("xl/workbook.xml");
    if (!workbookEntry) throw originalError;
    const workbookXml = await workbookEntry.async("string");
    if (!/<x:workbook\b/.test(workbookXml)) throw originalError;

    const xmlEntries = Object.values(zip.files).filter(
      (entry) => !entry.dir && entry.name.startsWith("xl/") && entry.name.endsWith(".xml")
    );
    if (xmlEntries.length > MAX_WORKBOOK_XML_FILES) {
      throw new Error("JW Stone pricing workbook has too many XML parts");
    }
    let uncompressedBytes = 0;
    for (const entry of xmlEntries) {
      const xml = await entry.async("string");
      uncompressedBytes += Buffer.byteLength(xml, "utf8");
      if (uncompressedBytes > MAX_UNCOMPRESSED_XML_BYTES) {
        throw new Error("JW Stone pricing workbook expands beyond the security limit");
      }
      let normalizedXml = xml
        .replace(/xmlns:x=("[^"]+"|'[^']+')/g, "xmlns=$1")
        .replace(/<(\/?)x:/g, "<$1");
      if (entry.name.startsWith("xl/worksheets/")) {
        // The owner export also emits an absolute table relationship that
        // ExcelJS cannot resolve. Tables are presentation metadata; prices
        // come only from the worksheet cells and exact headers below.
        normalizedXml = normalizedXml.replace(/<tableParts\b[\s\S]*?<\/tableParts>/g, "");
      }
      zip.file(entry.name, normalizedXml);
    }
    const normalized = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    if (normalized.length > MAX_WORKBOOK_BYTES) {
      throw new Error("JW Stone pricing workbook exceeds the security limit");
    }
    const compatibleWorkbook = new ExcelJS.Workbook();
    await compatibleWorkbook.xlsx.load(normalized);
    return compatibleWorkbook;
  }
}

export async function parseJwStonePricingWorkbook(
  buffer: Buffer,
  sourceUpdatedAt: string
): Promise<JwStonePricingSnapshot> {
  if (!Buffer.isBuffer(buffer) || !workbookLooksLikeXlsx(buffer)) {
    throw new Error("JW Stone pricing workbook is not a valid XLSX file");
  }
  if (buffer.length > MAX_WORKBOOK_BYTES) {
    throw new Error("JW Stone pricing workbook exceeds the security limit");
  }
  const updatedAt = new Date(sourceUpdatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error("JW Stone pricing source modification time is invalid");
  }

  const workbook = await loadPricingWorkbook(buffer);
  const sheet = workbook.getWorksheet(JW_STONE_PRICING_WORKSHEET);
  if (!sheet) throw new Error(`Required worksheet "${JW_STONE_PRICING_WORKSHEET}" is missing`);
  if (sheet.rowCount < 2 || sheet.rowCount - 1 > MAX_PRICE_ROWS) {
    throw new Error("JW Stone pricing worksheet row count is invalid");
  }

  const header = sheet.getRow(1);
  JW_STONE_PRICING_HEADERS.forEach((expected, index) => {
    if (header.getCell(index + 1).text.trim() !== expected) {
      throw new Error(`JW Stone pricing header ${index + 1} does not match the contract`);
    }
  });
  const quantityHeader = header.getCell(5).text.trim();
  if (quantityHeader && quantityHeader !== JW_STONE_PRICING_QUANTITY_HEADER) {
    throw new Error("JW Stone pricing quantity header does not match the contract");
  }

  const seenKeys = new Set<string>();
  const prices: JwStoneDrivePriceRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = [1, 2, 3, 4, 5].map((column) => row.getCell(column).value);
    if (values.every((value) => value == null || String(value).trim() === "")) continue;

    const stoneName = row.getCell(1).text.trim().replace(/\s+/g, " ");
    const stoneKey = jwStonePriceKey(stoneName);
    if (!stoneName || !stoneKey) throw new Error(`Pricing row ${rowNumber} has no stone name`);
    if (stoneName.length > 180) throw new Error(`Pricing row ${rowNumber} stone name is too long`);
    if (seenKeys.has(stoneKey)) throw new Error(`Pricing row ${rowNumber} duplicates a stone name`);

    const landedCostCents = cellCurrencyNumber(
      row.getCell(2),
      `Pricing row ${rowNumber} landed cost`,
      true
    );
    const slabPriceCents = cellCurrencyNumber(
      row.getCell(3),
      `Pricing row ${rowNumber} slab price`
    );
    const bundlePriceCents = cellCurrencyNumber(
      row.getCell(4),
      `Pricing row ${rowNumber} bundle price`
    );
    const quantity = row.getCell(5).value;
    const hasQuantity = quantity != null && String(quantity).trim() !== "";
    if (
      hasQuantity &&
      (!quantityHeader ||
        typeof quantity !== "number" ||
        !Number.isInteger(quantity) ||
        quantity < 2 ||
        quantity > 999)
    ) {
      throw new Error(`Pricing row ${rowNumber} has an invalid bundle minimum`);
    }
    seenKeys.add(stoneKey);
    prices.push(
      Object.freeze({
        stoneName,
        stoneKey,
        landedCostCents,
        slabPriceCents: slabPriceCents as number,
        bundlePriceCents: bundlePriceCents as number,
        ...(hasQuantity ? { bundleMinSlabs: quantity as number } : {}),
      })
    );
  }
  if (!prices.length) throw new Error("JW Stone pricing worksheet has no price rows");

  return Object.freeze({
    sourceUpdatedAt: updatedAt.toISOString(),
    prices: Object.freeze(prices),
  });
}

async function fetchDrivePricingSnapshot(): Promise<JwStonePricingSnapshot> {
  const config = drivePricingConfig();
  const token = await driveAccessToken();
  const filePath = encodeURIComponent(config.fileId);
  const metadataUrl =
    `https://www.googleapis.com/drive/v3/files/${filePath}` +
    "?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,parents,trashed,size";
  const metadata = await driveJson<JwStoneDriveFileMetadata>({
    url: metadataUrl,
    token,
    timeoutMs: config.requestTimeoutMs,
    resource: "metadata",
  });
  validateJwStoneDriveFileMetadata(metadata, config);

  const contentUrl =
    metadata.mimeType === GOOGLE_SHEET_MIME
      ? `https://www.googleapis.com/drive/v3/files/${filePath}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
      : `https://www.googleapis.com/drive/v3/files/${filePath}?alt=media&supportsAllDrives=true`;
  const workbook = await driveWorkbook({
    url: contentUrl,
    token,
    timeoutMs: config.requestTimeoutMs,
  });
  return parseJwStonePricingWorkbook(workbook, metadata.modifiedTime);
}

export async function getJwStonePricingSnapshot(options?: {
  forceRefresh?: boolean;
  now?: number;
}): Promise<JwStonePricingSnapshot> {
  const now = options?.now ?? Date.now();
  if (!options?.forceRefresh && cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot.value;
  }
  if (pendingSnapshot) return pendingSnapshot;

  pendingSnapshot = (
    getJwStonePricingSourceMode() === "approved_import"
      ? Promise.resolve(readApprovedJwStonePricingImport())
      : fetchDrivePricingSnapshot()
  )
    .then((value) => {
      cachedSnapshot = { expiresAt: Date.now() + drivePricingConfig().cacheMs, value };
      return value;
    })
    .finally(() => {
      pendingSnapshot = null;
    });
  return pendingSnapshot;
}

export function resetJwStoneDrivePricingCacheForTests(): void {
  cachedSnapshot = null;
  pendingSnapshot = null;
  accessTokenCache = null;
}
