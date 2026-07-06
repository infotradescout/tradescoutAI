import fs from "node:fs";
import path from "node:path";
import {
  parseArgs,
  parseCsv,
  getFirstValue,
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
} from "./utils";

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

function extractStateCodeFromLooseAddress(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const match = raw.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?$/);
  return match?.[1] || "";
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsvLine(values: unknown[]): string {
  return `${values.map(csvEscape).join(",")}\n`;
}

function buildIndustrySignal(record: Record<string, string>): string {
  return [
    getFirstValue(record, ["business_name", "name", "business_or_file_name", "company_name"]),
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

function shouldSkipFood(record: Record<string, string>, allowRetailFood: boolean): boolean {
  const signal = buildIndustrySignal(record);
  if (!signal) return false;
  const isFoodService = FOOD_SERVICE_PATTERNS.some((p) => p.test(signal));
  if (!isFoodService) return false;
  if (allowRetailFood && RETAIL_ALLOW_PATTERNS.some((p) => p.test(signal))) return false;
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = String(args.file || "").trim();
  if (!filePath) throw new Error("Missing --file path");

  const allowRetailFood = String(args.allowRetailFood || "true").toLowerCase() !== "false";
  const delimiter = String(args.delimiter || "comma").toLowerCase() === "tab" ? "\t" : ",";

  const inPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const outPath = path.resolve(
    process.cwd(),
    String(args.out || "artifacts/import/master_seed_filtered.csv")
  );
  const excludedPath = path.resolve(
    process.cwd(),
    String(args.excluded || "artifacts/import/master_seed_excluded_food.csv")
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.mkdirSync(path.dirname(excludedPath), { recursive: true });

  const raw = fs.readFileSync(inPath, "utf8");
  const records = parseCsv(raw, delimiter);

  const kept = fs.createWriteStream(outPath, { encoding: "utf8" });
  const excluded = fs.createWriteStream(excludedPath, { encoding: "utf8" });

  kept.write(
    toCsvLine([
      "business_name",
      "phone",
      "email",
      "website",
      "state_code",
      "municipality",
      "county_name",
      "trade_categories",
      "description",
      "source_id",
    ])
  );

  excluded.write(
    toCsvLine([
      "row_number",
      "business_name",
      "location_or_service_area",
      "menu_services_details",
      "raw_text",
      "reason",
    ])
  );

  let inputRows = 0;
  let keptRows = 0;
  let skippedFoodRows = 0;

  for (const record of records) {
    inputRows++;

    const name = getFirstValue(record, [
      "business_name",
      "name",
      "business_or_file_name",
      "company_name",
      "company",
      "legal_name",
    ]);
    if (!name) continue;

    if (shouldSkipFood(record, allowRetailFood)) {
      skippedFoodRows++;
      excluded.write(
        toCsvLine([
          inputRows,
          name,
          getFirstValue(record, ["location_or_service_area"]),
          getFirstValue(record, ["menu_services_details"]),
          getFirstValue(record, ["raw_text"]),
          "food-service-excluded",
        ])
      );
      continue;
    }

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
      getFirstValue(record, ["state_code", "state", "st"]).toUpperCase() ||
      extractStateCodeFromLooseAddress(municipality) ||
      extractStateCodeFromLooseAddress(fulladdress);
    const countyName = getFirstValue(record, ["county_name", "county"]);

    const phone = normalizePhone(
      getFirstValue(record, [
        "phone",
        "phone_number",
        "business_phone",
        "contact_phone",
        "phones_extracted",
        "contact_info",
      ])
    );
    const email = normalizeEmail(
      getFirstValue(record, [
        "email",
        "business_email",
        "contact_email",
        "owner_email",
        "emails_extracted",
        "contact_info",
      ])
    );
    const website = normalizeWebsite(
      getFirstValue(record, ["website", "url", "site", "urls_extracted"])
    );

    const tradeCategories = getFirstValue(record, [
      "trade_categories",
      "categories",
      "services",
      "menu_services_details",
    ]);
    const description = getFirstValue(record, ["description", "about", "summary", "raw_text"]);

    kept.write(
      toCsvLine([
        name,
        phone,
        email,
        website,
        stateCode,
        municipality,
        countyName,
        tradeCategories,
        description,
        getFirstValue(record, ["source_id", "external_id", "id", "seed_id"]),
      ])
    );
    keptRows++;
  }

  kept.end();
  excluded.end();

  console.log(
    JSON.stringify(
      {
        ok: true,
        inputRows,
        keptRows,
        skippedFoodRows,
        outPath,
        excludedPath,
      },
      null,
      2
    )
  );
}

main();
