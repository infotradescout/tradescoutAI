import fs from "fs/promises";
import path from "path";

export async function loadJsonRecordsFromConfig(
  config: Record<string, unknown> | undefined,
  configKey: string
): Promise<Array<Record<string, unknown>>> {
  const filePath = typeof config?.[configKey] === "string" ? String(config[configKey]).trim() : "";
  if (!filePath) {
    throw new Error(`Missing required adapter config "${configKey}" (file path)`);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absPath, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object"
    );
  }

  if (Array.isArray((parsed as any)?.records)) {
    return (parsed as any).records.filter(
      (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object"
    );
  }

  throw new Error(`Unsupported JSON shape in "${filePath}". Expected array or { records: [] }`);
}

export function toDateValue(input: unknown): Date | null {
  if (!input) return null;
  const value = input instanceof Date ? input : new Date(String(input));
  return Number.isFinite(value.getTime()) ? value : null;
}

export function toStringValue(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}
