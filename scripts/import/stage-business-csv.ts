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
  parseCsv,
  parseTradeCategories,
} from "./utils";

function resolveDelimiter(input: string): string {
  const key = String(input || "comma").toLowerCase();
  if (key === "tab" || key === "\\t") return "\t";
  if (key === "pipe" || key === "|") return "|";
  return ",";
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

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  const records = parseCsv(content, delimiter);

  if (!records.length) {
    throw new Error("No records parsed from CSV");
  }

  const rows = records
    .map((record) => {
      const name = getFirstValue(record, [
        "business_name",
        "name",
        "company_name",
        "company",
        "legal_name",
      ]);
      if (!name) return null;

      const stateCode = getFirstValue(record, ["state_code", "state", "st"]).toUpperCase();
      const countyFips = getFirstValue(record, ["county_fips", "fips", "countyfips"]);
      const countyName = getFirstValue(record, ["county_name", "county"]);
      const phone = normalizePhone(
        getFirstValue(record, ["phone", "phone_number", "business_phone", "contact_phone"])
      );
      const email = normalizeEmail(
        getFirstValue(record, ["email", "business_email", "contact_email", "owner_email"])
      );
      const website = normalizeWebsite(getFirstValue(record, ["website", "url", "site"]));
      const externalId = getFirstValue(record, ["external_id", "source_id", "id"]);
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

      return {
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
      } as any;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!rows.length) {
    throw new Error("No stageable rows found (missing business names)");
  }

  const chunkSize = 250;
  for (let idx = 0; idx < rows.length; idx += chunkSize) {
    const chunk = rows.slice(idx, idx + chunkSize);
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
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        batchId,
        source,
        inputRows: records.length,
        stagedRows: rows.length,
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
