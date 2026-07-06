import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { db } from "../../server/db";
import { counties, listingImportStaging } from "../../shared/schema";
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

dotenv.config();

function normalizeCountyLookupValue(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/\b(county|parish|borough|census area|municipality|district)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildCountyLookup(): Promise<Map<string, { fips: string; name: string }>> {
  const rows = await db
    .select({
      fips: counties.fips,
      name: counties.name,
      stateCode: counties.stateCode,
    })
    .from(counties);
  const lookup = new Map<string, { fips: string; name: string }>();

  for (const row of rows) {
    const stateCode = String(row.stateCode || "")
      .trim()
      .toUpperCase();
    const countyName = String(row.name || "").trim();
    const fips = String(row.fips || "").trim();
    if (!stateCode || !countyName || !/^\d{5}$/.test(fips)) continue;

    const values = new Set([
      countyName.trim().toLowerCase(),
      normalizeCountyLookupValue(countyName),
    ]);
    for (const value of values) {
      if (!value) continue;
      lookup.set(`${stateCode}|${value}`, { fips, name: countyName });
    }

    if (stateCode === "FL" && normalizeCountyLookupValue(countyName) === "miami dade") {
      lookup.set("FL|dade", { fips, name: countyName });
    }
  }

  return lookup;
}

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

const FOOD_SERVICE_PATTERNS = [
  /\brestaurant\b/i,
  /\bfood\s*truck\b/i,
  /\bcafe\b/i,
  /\bdiner\b/i,
  /\bbistro\b/i,
  /\bcoffee\s*shop\b/i,
  /\bbakery\b/i,
  /\bpizzeria|pizza\b/i,
  /\bbar\b/i,
  /\bpub\b/i,
  /\bgrill\b/i,
  /\bcatering\b/i,
  /\bfood\s*service\b/i,
  /\bmenu\b/i,
  /\btaqueria|taco\b/i,
  /\bburger\b/i,
  /\bice\s*cream\b/i,
];

const RETAIL_ALLOW_PATTERNS = [
  /\bretail\b/i,
  /\bstore\b/i,
  /\bshop\b/i,
  /\bmarket\b/i,
  /\bgrocery\b/i,
  /\bconvenience\b/i,
  /\bsupermarket\b/i,
  /\boutlet\b/i,
  /\bwholesale\b/i,
  /\bdistributor\b/i,
  /\bboutique\b/i,
];

function buildIndustrySignal(record: Record<string, string>): string {
  return [
    getFirstValue(record, [
      "business_name",
      "name",
      "business_or_file_name",
      "company_name",
      "company",
      "legal_name",
    ]),
    getFirstValue(record, [
      "categories",
      "category",
      "trade_categories",
      "services",
      "menu_services_details",
    ]),
    getFirstValue(record, ["business_type", "industry", "vertical", "naics_description"]),
    getFirstValue(record, ["description", "about", "summary", "raw_text"]),
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
}

function shouldSkipForFoodPolicy(
  record: Record<string, string>,
  options: { excludeFood: boolean; allowRetailFood: boolean }
): { skip: boolean; reason: string } {
  if (!options.excludeFood) return { skip: false, reason: "disabled" };

  const signal = buildIndustrySignal(record);
  if (!signal) return { skip: false, reason: "no-signal" };

  const isFoodService = FOOD_SERVICE_PATTERNS.some((pattern) => pattern.test(signal));
  if (!isFoodService) return { skip: false, reason: "not-food-service" };

  const isRetail = RETAIL_ALLOW_PATTERNS.some((pattern) => pattern.test(signal));
  if (options.allowRetailFood && isRetail) {
    return { skip: false, reason: "food-retail-allowed" };
  }

  return { skip: true, reason: "food-service-excluded" };
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsvLine(values: unknown[]): string {
  return `${values.map(csvEscape).join(",")}\n`;
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
  const excludeFood = String(args.excludeFood || "true").toLowerCase() !== "false";
  const allowRetailFood = String(args.allowRetailFood || "true").toLowerCase() !== "false";
  const reportOnly = String(args.reportOnly || "false").toLowerCase() === "true";
  const requireCounty = String(args.requireCounty || "false").toLowerCase() === "true";
  const excludedReportPathRaw = String(args.excludedReport || "").trim();
  const excludedReportPath = excludedReportPathRaw
    ? path.isAbsolute(excludedReportPathRaw)
      ? excludedReportPathRaw
      : path.resolve(process.cwd(), excludedReportPathRaw)
    : "";

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  let inputRows = 0;
  let acceptedRows = 0;
  let stagedRows = 0;
  let skippedRows = 0;
  let skippedFoodRows = 0;
  let skippedMissingCountyRows = 0;
  let resolvedCountyRows = 0;
  let allowedRetailFoodRows = 0;
  let buffer: any[] = [];
  let excludedReportRows = 0;
  const countyLookup = await buildCountyLookup();

  const excludedReportStream = excludedReportPath
    ? fs.createWriteStream(excludedReportPath, { encoding: "utf8" })
    : null;

  if (excludedReportStream) {
    excludedReportStream.write(
      toCsvLine([
        "row_number",
        "reason",
        "business_name",
        "categories",
        "business_type",
        "industry",
        "description",
        "external_id",
        "website",
        "phone",
        "state_code",
        "county_name",
      ])
    );
  }

  const flush = async () => {
    if (!buffer.length) return;
    const chunk = buffer;
    buffer = [];
    const inserted = await db
      .insert(listingImportStaging)
      .values(chunk)
      .onConflictDoNothing({
        target: [
          listingImportStaging.batchId,
          listingImportStaging.source,
          listingImportStaging.externalId,
        ],
      })
      .returning({ id: listingImportStaging.id });
    stagedRows += inserted.length;
  };

  await streamCsvFile({
    absolutePath,
    delimiter,
    maxRecords: maxRows,
    onRecord: async (record) => {
      inputRows++;

      const foodPolicy = shouldSkipForFoodPolicy(record, { excludeFood, allowRetailFood });
      if (foodPolicy.reason === "food-retail-allowed") {
        allowedRetailFoodRows++;
      }
      if (foodPolicy.skip) {
        skippedRows++;
        skippedFoodRows++;
        if (excludedReportStream) {
          excludedReportRows++;
          excludedReportStream.write(
            toCsvLine([
              inputRows,
              foodPolicy.reason,
              getFirstValue(record, [
                "business_name",
                "name",
                "company_name",
                "company",
                "legal_name",
              ]),
              getFirstValue(record, ["categories", "category", "trade_categories", "services"]),
              getFirstValue(record, ["business_type"]),
              getFirstValue(record, ["industry", "vertical", "naics_description"]),
              getFirstValue(record, ["description", "about", "summary"]),
              getFirstValue(record, ["external_id", "source_id", "id"]),
              getFirstValue(record, ["website", "url", "site"]),
              getFirstValue(record, ["phone", "phone_number", "business_phone", "contact_phone"]),
              getFirstValue(record, ["state_code", "state", "st"]),
              getFirstValue(record, ["county_name", "county"]),
            ])
          );
        }
        return;
      }

      const name = getFirstValue(record, [
        "business_name",
        "name",
        "business_or_file_name",
        "company_name",
        "company",
        "legal_name",
      ]);
      if (!name) return;
      acceptedRows++;

      if (reportOnly) {
        return;
      }

      const stateCodeRaw = getFirstValue(record, ["state_code", "state", "st"]).toUpperCase();
      const municipality = getFirstValue(record, [
        "municipality",
        "city_state_zip",
        "city",
        "location_or_service_area",
      ]);
      const fulladdress = getFirstValue(record, [
        "fulladdress",
        "full_address",
        "address",
        "location_or_service_area",
      ]);
      const stateCode =
        stateCodeRaw ||
        extractStateCodeFromLooseAddress(municipality) ||
        extractStateCodeFromLooseAddress(fulladdress);
      const countyFips = getFirstValue(record, ["county_fips", "fips", "countyfips"]);
      const countyName = getFirstValue(record, ["county_name", "county"]);
      const resolvedCounty =
        countyFips && /^\d{5}$/.test(countyFips)
          ? { fips: countyFips, name: countyName }
          : stateCode && countyName
            ? countyLookup.get(`${stateCode}|${countyName.trim().toLowerCase()}`) ||
              countyLookup.get(`${stateCode}|${normalizeCountyLookupValue(countyName)}`) ||
              null
            : null;
      const resolvedCountyFips = resolvedCounty?.fips || "";
      const resolvedCountyName = resolvedCounty?.name || countyName;

      if (requireCounty && !resolvedCountyFips) {
        skippedRows++;
        skippedMissingCountyRows++;
        if (excludedReportStream) {
          excludedReportRows++;
          excludedReportStream.write(
            toCsvLine([
              inputRows,
              "county-unresolved",
              name,
              getFirstValue(record, ["categories", "category", "trade_categories", "services"]),
              getFirstValue(record, ["business_type"]),
              getFirstValue(record, ["industry", "vertical", "naics_description"]),
              getFirstValue(record, ["description", "about", "summary"]),
              getFirstValue(record, ["external_id", "source_id", "id"]),
              getFirstValue(record, ["website", "url", "site"]),
              getFirstValue(record, ["phone", "phone_number", "business_phone", "contact_phone"]),
              stateCode,
              countyName,
            ])
          );
        }
        return;
      }
      if (resolvedCountyFips) resolvedCountyRows++;

      const phone = normalizePhone(
        getFirstValue(record, [
          "phone",
          "phone_number",
          "business_phone",
          "contact_phone",
          "phones_extracted",
        ])
      );
      const email = normalizeEmail(
        getFirstValue(record, [
          "email",
          "business_email",
          "contact_email",
          "owner_email",
          "emails_extracted",
        ])
      );
      const website = normalizeWebsite(
        getFirstValue(record, ["website", "url", "site", "urls_extracted"])
      );
      const googleMapsUrl = getFirstValue(record, ["google_maps_url", "google_maps", "maps_url"]);
      const externalId =
        getFirstValue(record, ["external_id", "source_id", "id"]) ||
        extractGoogleCid(googleMapsUrl);
      const latRaw = getFirstValue(record, ["lat", "latitude"]);
      const lngRaw = getFirstValue(record, ["lng", "longitude", "lon"]);
      const tradeCategories = parseTradeCategories(
        getFirstValue(record, [
          "trade_categories",
          "categories",
          "services",
          "menu_services_details",
        ])
      );

      const normalizedName = normalizeName(name).slice(0, 255);
      const dedupeKey = [
        normalizedName,
        stateCode || "_",
        resolvedCountyFips || "_",
        phone || "_",
        website || "_",
      ]
        .join("|")
        .slice(0, 255);

      const lat = latRaw ? Number(latRaw) : null;
      const lng = lngRaw ? Number(lngRaw) : null;

      buffer.push({
        id: randomUUID(),
        batchId,
        source,
        externalId: externalId || null,
        name: name.slice(0, 255),
        normalizedName,
        phone: phone || null,
        email: (email || "").slice(0, 255) || null,
        website: website || null,
        stateCode: (stateCode || "").slice(0, 2) || null,
        countyFips: resolvedCountyFips || null,
        countyName: (resolvedCountyName || "").slice(0, 128) || null,
        lat: lat != null && Number.isFinite(lat) ? String(lat) : null,
        lng: lng != null && Number.isFinite(lng) ? String(lng) : null,
        tradeCategories,
        dedupeKey,
        rawPayload: record,
        status: "pending",
      } as any);

      if (buffer.length >= chunkSize) {
        await flush();
      }
    },
  });

  await flush();

  if (excludedReportStream) {
    await new Promise<void>((resolve, reject) => {
      excludedReportStream.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        batchId,
        source,
        inputRows,
        acceptedRows,
        stagedRows,
        skippedRows,
        skippedFoodRows,
        skippedMissingCountyRows,
        resolvedCountyRows,
        allowedRetailFoodRows,
        excludedReportRows,
        reportOnly,
        excludedReportPath: excludedReportPath || null,
        requireCounty,
        policy: {
          excludeFood,
          allowRetailFood,
        },
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
