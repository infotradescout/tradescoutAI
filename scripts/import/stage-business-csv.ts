import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "../../server/db";
import { listingImportStaging } from "../../shared/schema";
import {
  getFirstValue,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeWebsite,
  parseArgs,
  parseTradeCategories,
  streamCsvFile,
} from "./utils";

function resolveDelimiter(input: string): string {
  const key = String(input || "comma").toLowerCase();
  if (key === "tab" || key === "\\t") return "\t";
  if (key === "pipe" || key === "|") return "|";
  return ",";
}

function extractStateCodeFromLooseAddress(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // Common patterns:
  // - "Pensacola, FL 32501"
  // - "..., Pensacola, FL 32501"
  // - "..., FL"
  const match = raw.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?$/);
  return match?.[1] || "";
}

function extractGoogleCid(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const cid = url.searchParams.get("cid");
    if (cid) return cid.trim();
  } catch {
    // ignore
  }
  const cidMatch = raw.match(/[?&]cid=(\d{6,})\b/);
  return cidMatch?.[1] || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = String(args.file || "").trim();
  if (!filePath) {
    throw new Error("Missing --file=/absolute/or/relative/path.csv");
  }

  const batchId = String(args.batch || `batch_${Date.now()}`)
    .trim()
    .slice(0, 64);
  const source = String(args.source || "csv_import")
    .trim()
    .toLowerCase()
    .slice(0, 64);
  const delimiter = resolveDelimiter(String(args.delimiter || "comma"));
  const chunkSizeRaw = Number.parseInt(String(args.chunkSize || "1000"), 10);
  const chunkSize = Number.isFinite(chunkSizeRaw)
    ? Math.max(50, Math.min(chunkSizeRaw, 5000))
    : 1000;
  const maxRowsRaw = args.maxRows ? Number.parseInt(String(args.maxRows), 10) : null;
  const maxRows =
    maxRowsRaw != null && Number.isFinite(maxRowsRaw) ? Math.max(1, maxRowsRaw) : undefined;

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  let inputRows = 0;
  let stagedRows = 0;
  let buffer: any[] = [];

  const flush = async () => {
    if (!buffer.length) return;
    const chunk = buffer;
    buffer = [];
    await db
      .insert(listingImportStaging)
      .values(chunk)
      .onConflictDoNothing({
        target: [
          listingImportStaging.batchId,
          listingImportStaging.source,
          listingImportStaging.externalId,
        ],
      });
  };

  await streamCsvFile({
    absolutePath,
    delimiter,
    maxRecords: maxRows,
    onRecord: async (record) => {
      inputRows++;

      const name = getFirstValue(record, [
        "business_name",
        "name",
        "company_name",
        "company",
        "legal_name",
      ]);
      if (!name) return;

      const stateCodeRaw = getFirstValue(record, ["state_code", "state", "st"]).toUpperCase();
      const municipality = getFirstValue(record, ["municipality", "city_state_zip", "city"]);
      const fulladdress = getFirstValue(record, ["fulladdress", "full_address", "address"]);
      const stateCode =
        stateCodeRaw ||
        extractStateCodeFromLooseAddress(municipality) ||
        extractStateCodeFromLooseAddress(fulladdress);
      const countyFips = getFirstValue(record, ["county_fips", "fips", "countyfips"]);
      const countyName = getFirstValue(record, ["county_name", "county"]);
      const phone = normalizePhone(
        getFirstValue(record, ["phone", "phone_number", "business_phone", "contact_phone"])
      );
      const email = normalizeEmail(
        getFirstValue(record, ["email", "business_email", "contact_email", "owner_email"])
      );
      const website = normalizeWebsite(getFirstValue(record, ["website", "url", "site"]));
      const googleMapsUrl = getFirstValue(record, ["google_maps_url", "google_maps", "maps_url"]);
      const externalId =
        getFirstValue(record, ["external_id", "source_id", "id"]) ||
        extractGoogleCid(googleMapsUrl);
      const latRaw = getFirstValue(record, ["lat", "latitude"]);
      const lngRaw = getFirstValue(record, ["lng", "longitude", "lon"]);
      const tradeCategories = parseTradeCategories(
        getFirstValue(record, ["trade_categories", "categories", "services"])
      );

      const normalizedName = normalizeName(name);
      const dedupeKey = [
        normalizedName,
        stateCode || "_",
        countyFips || "_",
        phone || "_",
        website || "_",
      ].join("|");

      const lat = latRaw ? Number(latRaw) : null;
      const lng = lngRaw ? Number(lngRaw) : null;

      buffer.push({
        id: randomUUID(),
        batchId,
        source,
        externalId: externalId || null,
        name,
        normalizedName,
        phone: phone || null,
        email: email || null,
        website: website || null,
        stateCode: stateCode || null,
        countyFips: countyFips || null,
        countyName: countyName || null,
        lat: lat != null && Number.isFinite(lat) ? String(lat) : null,
        lng: lng != null && Number.isFinite(lng) ? String(lng) : null,
        tradeCategories,
        dedupeKey,
        rawPayload: record,
        status: "pending",
      } as any);

      stagedRows++;
      if (buffer.length >= chunkSize) {
        await flush();
      }
    },
  });

  await flush();

  console.log(
    JSON.stringify(
      {
        ok: true,
        batchId,
        source,
        inputRows,
        stagedRows,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[stage-business-csv] failed:", error);
  process.exit(1);
});
