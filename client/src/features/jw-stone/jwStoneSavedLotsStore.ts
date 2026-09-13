/** Public lot references only: never persist price, stock counts, location or cost. */
export const JW_STONE_SAVED_LOTS_KEY = "tradescout:jw-stone:saved-lots:v1";
export const JW_STONE_SAVED_LOTS_MAX = 50;
export type JwStoneSavedLot = Readonly<{ id: string; stoneName: string }>;
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type SavedLotsSnapshot = Readonly<{
  lots: readonly JwStoneSavedLot[];
  restored: boolean;
  persisted: boolean;
  notice: string;
}>;
export function savedJwStoneLot(value: unknown): JwStoneSavedLot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = typeof row.stoneName === "string" ? row.stoneName : row.materialName;
  if (typeof row.id !== "string" || !/^stone_[a-f0-9]{32}$/.test(row.id) || typeof name !== "string") return null;
  const stoneName = name.trim();
  if (!stoneName || stoneName.length > 160 || /[\u0000-\u001f\u007f]/.test(stoneName)) return null;
  return { id: row.id, stoneName };
}
export function normalizeJwStoneSavedLots(value: unknown): JwStoneSavedLot[] {
  if (!Array.isArray(value)) return [];
  const result: JwStoneSavedLot[] = [];
  const seen = new Set<string>();
  for (const row of value.slice(0, 500)) {
    const lot = savedJwStoneLot(row);
    if (!lot || seen.has(lot.id)) continue;
    seen.add(lot.id); result.push(lot);
    if (result.length === JW_STONE_SAVED_LOTS_MAX) break;
  }
  return result;
}
/** A missing public listing is not evidence that a lot was sold. */
export function jwStoneSavedLotStatus(id: string, listedIds: ReadonlySet<string> | null) {
  return listedIds === null ? "unknown" : listedIds.has(id) ? "listed" : "not_listed";
}
export function jwStoneLotInquiry(value: unknown): string {
  const lot = savedJwStoneLot(value);
  if (!lot) throw new Error("A valid JW Stone inventory lot is required.");
  return `Please confirm availability, current pricing, and pickup or delivery for ${lot.stoneName}.\nExact inventory lot: ${lot.id}\nSlabs requested: please confirm with me.`;
}
export function createJwStoneSavedLotsStore(storage: StoragePort | null) {
  let snapshot: SavedLotsSnapshot = { lots: [], restored: false, persisted: true, notice: "" };
  let ephemeral = false;
  const listeners = new Set<() => void>();
  function publish(next: SavedLotsSnapshot) {
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next; listeners.forEach(listener => listener());
  }
  function read(): SavedLotsSnapshot {
    if (!storage) return { ...snapshot, restored: true, persisted: false, notice: "This browser cannot store saved inventory lots." };
    try {
      const raw = storage.getItem(JW_STONE_SAVED_LOTS_KEY);
      if (raw === null) return { lots: [], restored: true, persisted: true, notice: "" };
      const value = JSON.parse(raw);
      if (value?.version !== 1 || !Array.isArray(value.lots)) throw new Error("Unsupported saved lots");
      const lots = normalizeJwStoneSavedLots(value.lots);
      return { lots, restored: true, persisted: true, notice: lots.length === value.lots.length ? "" : "Some invalid saved lot references could not be restored." };
    } catch { return { ...snapshot, restored: true, persisted: false, notice: "Saved inventory lots could not be read. Existing browser data has not been replaced." }; }
  }
  function latest() { return ephemeral ? snapshot : read(); }
  function write(lots: readonly JwStoneSavedLot[]) {
    const safe = normalizeJwStoneSavedLots(lots);
    let persisted = false;
    try {
      if (storage && read().persisted) {
        storage.setItem(JW_STONE_SAVED_LOTS_KEY, JSON.stringify({ version: 1, lots: safe }));
        persisted = true;
      }
    } catch { /* Keep this visit's changes without claiming a durable save. */ }
    ephemeral = !persisted;
    publish({ lots: safe, restored: true, persisted, notice: persisted ? "" : "These saved-lot changes last for this visit only; browser storage could not be updated." });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() { if (!ephemeral) publish(read()); },
    toggle(value: unknown) {
      const lot = savedJwStoneLot(value);
      if (!lot) { publish({ ...latest(), notice: "This inventory lot could not be saved." }); return; }
      const current = latest();
      if (current.lots.some(item => item.id === lot.id)) { write(current.lots.filter(item => item.id !== lot.id)); return; }
      if (current.lots.length >= JW_STONE_SAVED_LOTS_MAX) { publish({ ...current, notice: "You can save up to 50 inventory lots. Remove one before adding another." }); return; }
      write([...current.lots, lot]);
    },
    remove(id: string) { write(latest().lots.filter(lot => lot.id !== id)); },
    clear() { write([]); },
  };
}
