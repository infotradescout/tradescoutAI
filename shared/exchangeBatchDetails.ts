import type { ImportRow } from "./exchangeBatchRecovery";

type Photo = { name: string; size: number; type: string; webkitRelativePath?: string };
type Category = { id: string; name: string };
type Preview = { rows: ImportRow[]; errors: string[]; unusedPhotos: string[] };
type CsvRecord = { line: number; cells: string[] };
export type BatchDetailDependencies = {
  parseCsv: (text: string) => CsvRecord[];
  prepare: (text: string, photos: readonly Photo[], categories: readonly Category[]) => Preview;
  categorySlug: (name: string) => string | null;
  validate: (input: {
    category: string | null;
    imageCount: number;
    specs: Record<string, unknown>;
    sellerState: string;
    title: string;
    description: string;
  }) => { message: string } | null;
};
const reserved = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "externalListingId",
  "exchangeBatchFingerprint",
  "sellerId",
  "userId",
  "ownerId",
  "status",
  "isApproved",
  "isVerified",
  "isPromoted",
  "permissions",
  "role",
]);
const normalizeHeader = (value: string) =>
  value.trim().normalize("NFC").toLowerCase().replace(/[ -]/g, "_");
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const specKey = (column: string) =>
  column.slice(5).replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

/** Add optional spec_* CSV columns without changing the canonical single-listing path. */
export function prepareDetailedExchangeBatch(
  csv: string,
  photos: readonly Photo[],
  categories: readonly Category[],
  dependencies: BatchDetailDependencies
): Preview {
  let records: CsvRecord[];
  try {
    records = dependencies.parseCsv(csv);
  } catch (error) {
    return {
      rows: [],
      unusedPhotos: [],
      errors: [error instanceof Error ? error.message : "CSV could not be read."],
    };
  }
  if (!records.length) return dependencies.prepare(csv, photos, categories);
  const columns = records[0].cells.map(normalizeHeader);
  if (new Set(columns).size !== columns.length)
    return { rows: [], unusedPhotos: [], errors: ["CSV contains duplicate column names."] };
  const extensionIndexes = columns.flatMap((name, index) =>
    name === "specifications" || name.startsWith("spec_") ? [index] : []
  );
  if (extensionIndexes.length > 40)
    return {
      rows: [],
      unusedPhotos: [],
      errors: ["Use at most 40 additional specification columns."],
    };
  const extensions = new Set(extensionIndexes);
  const coreIndexes = columns.flatMap((_, index) => (extensions.has(index) ? [] : [index]));
  const emptyCore = records
    .slice(1)
    .find((record) => coreIndexes.every((index) => !(record.cells[index] || "").trim()));
  if (emptyCore)
    return {
      rows: [],
      unusedPhotos: [],
      errors: [`CSV line ${emptyCore.line} has specifications but no listing fields.`],
    };
  const coreCsv = records
    .map((record) => coreIndexes.map((index) => quote(record.cells[index] || "")).join(","))
    .join("\r\n");
  const preview = dependencies.prepare(coreCsv, photos, categories);
  if (!preview.errors.length && preview.rows.length !== records.length - 1) {
    return {
      rows: [],
      unusedPhotos: [],
      errors: ["CSV row alignment could not be verified. No listings will be submitted."],
    };
  }
  const categoriesById = new Map(categories.map((category) => [category.id, category.name]));
  preview.rows.forEach((row, index) => {
    const source = records[index + 1];
    if (!source) {
      row.errors.push("Could not match the CSV row.");
      return;
    }
    row.line = source.line;
    if (source.cells.length !== columns.length)
      row.errors.push(`Expected ${columns.length} columns; found ${source.cells.length}.`);
    const specifications: Record<string, unknown> = {
      ...((row.payload.specifications as Record<string, unknown>) || {}),
    };
    const provided = new Set<string>();
    const add = (key: string, value: unknown) => {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || reserved.has(key)) {
        row.errors.push(`Specification ${key} is not allowed.`);
        return;
      }
      if (provided.has(key)) {
        row.errors.push(`Specification ${key} is provided more than once.`);
        return;
      }
      if (
        !["string", "boolean", "number"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value))
      ) {
        row.errors.push(`Specification ${key} must be text, a number, or true/false.`);
        return;
      }
      if (String(value).length > 4000) {
        row.errors.push(`Specification ${key} is too long (maximum 4,000 characters).`);
        return;
      }
      // Attestations must be deliberate true/false values, never a truthy string "false".
      if (/attestation$/i.test(key) && typeof value !== "boolean") {
        row.errors.push(`Specification ${key} must be true or false.`);
        return;
      }
      provided.add(key);
      specifications[key] = value;
    };
    for (const columnIndex of extensionIndexes) {
      const column = columns[columnIndex],
        raw = (source.cells[columnIndex] || "").trim();
      if (!raw) continue;
      if (column === "specifications") {
        try {
          if (raw.length > 16000) throw new Error("too long");
          const value: unknown = JSON.parse(raw);
          if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.keys(value).length > 40
          )
            throw new Error("not a flat object");
          for (const [key, item] of Object.entries(value)) add(key, item);
        } catch {
          row.errors.push(
            "specifications must be a JSON object with at most 40 simple fields and 16,000 characters."
          );
        }
      } else {
        if (!/^spec_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(column)) {
          row.errors.push(`Invalid specification column: ${column}.`);
          continue;
        }
        const key = specKey(column);
        add(
          key,
          /attestation$/i.test(key)
            ? raw.toLowerCase() === "true"
              ? true
              : raw.toLowerCase() === "false"
                ? false
                : raw
            : raw
        );
      }
    }
    if (provided.size > 40) row.errors.push("Use at most 40 specifications per listing.");
    // Promote searchable vehicle/equipment fields into the existing top-level schema.
    for (const [sourceKey, targetKey] of [
      ["make", "brand"],
      ["model", "model"],
    ] as const) {
      const value = specifications[sourceKey];
      if (value === undefined || value === "") continue;
      if (row.payload[targetKey] && String(row.payload[targetKey]) !== String(value)) {
        row.errors.push(`${targetKey} and spec_${sourceKey} must agree.`);
      } else row.payload[targetKey] = String(value);
    }
    for (const key of ["year", "mileage"] as const) {
      const value = specifications[key];
      if (value === undefined || value === "") continue;
      const number = Number(value);
      if (
        !/^\d+$/.test(String(value)) ||
        !Number.isSafeInteger(number) ||
        (key === "year" ? number < 1000 || number > 3000 : number > 100000000)
      ) {
        row.errors.push(
          `spec_${key} must be a valid nonnegative whole number${key === "year" ? " from 1000 to 3000" : ""}.`
        );
      } else row.payload[key] = number;
    }
    row.payload.specifications = specifications;
    const category = dependencies.categorySlug(
      categoriesById.get(String(row.payload.categoryId || "")) || ""
    );
    const issue = dependencies.validate({
      category,
      imageCount: row.photoIndexes.length,
      specs: {
        ...specifications,
        ...(row.payload.brand ? { brand: row.payload.brand } : {}),
        ...(row.payload.model ? { model: row.payload.model } : {}),
      },
      sellerState: String(row.payload.state || ""),
      title: row.title,
      description: String(row.payload.description || ""),
    });
    if (issue) row.errors.push(issue.message);
  });
  return preview;
}
