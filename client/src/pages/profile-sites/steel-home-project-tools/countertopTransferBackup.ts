import { reconcileSteelHomeProjectDraft, type SteelHomeCountertopDesign } from "./projectModel";

export const COUNTERTOP_TRANSFER_BACKUP_KEY = "tradescout:countertop-cabinet-import:backup:v1";
export type CountertopTransferBackup = {
  version: 1;
  createdAt: string;
  previous: SteelHomeCountertopDesign;
  imported: SteelHomeCountertopDesign;
};
type StoragePort = Pick<Storage, "getItem" | "setItem">;
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export const equalCountertopSnapshots = (a: unknown, b: unknown) => stable(a) === stable(b);

/** Read-only recovery data. The project draft remains the only active design authority. */
export function loadCountertopTransferBackup(storage: StoragePort | null): CountertopTransferBackup | null {
  try {
    const raw = storage?.getItem(COUNTERTOP_TRANSFER_BACKUP_KEY);
    if (!raw || raw.length > 100_000) return null;
    const value = JSON.parse(raw) as Partial<CountertopTransferBackup>;
    if (value.version !== 1 || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !value.previous || !value.imported) return null;
    const previous = reconcileSteelHomeProjectDraft({ countertops: value.previous }).countertops;
    const imported = reconcileSteelHomeProjectDraft({ countertops: value.imported }).countertops;
    // Do not quietly restore an unknown schema, missing catalog photo, or changed measurement.
    if (!equalCountertopSnapshots(previous, value.previous) || !equalCountertopSnapshots(imported, value.imported)) return null;
    return { version: 1, createdAt: value.createdAt, previous, imported };
  } catch { return null; }
}

/** A failed backup prevents import. Neither this function nor its key updates the active draft. */
export function saveCountertopTransferBackup(
  storage: StoragePort | null,
  previous: SteelHomeCountertopDesign,
  imported: SteelHomeCountertopDesign
): CountertopTransferBackup | null {
  if (!storage) return null;
  const record: CountertopTransferBackup = { version: 1, createdAt: new Date().toISOString(), previous, imported };
  const encoded = JSON.stringify(record);
  if (encoded.length > 100_000) return null;
  const previousCanonical = reconcileSteelHomeProjectDraft({ countertops: previous }).countertops;
  const importedCanonical = reconcileSteelHomeProjectDraft({ countertops: imported }).countertops;
  if (!equalCountertopSnapshots(previous, previousCanonical) || !equalCountertopSnapshots(imported, importedCanonical)) return null;
  try {
    storage.setItem(COUNTERTOP_TRANSFER_BACKUP_KEY, encoded);
    return storage.getItem(COUNTERTOP_TRANSFER_BACKUP_KEY) === encoded ? record : null;
  } catch { return null; }
}
