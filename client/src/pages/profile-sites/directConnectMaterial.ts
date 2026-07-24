/**
 * Direct Connect material identity for profile surfaces.
 * Prefer stable itemId (slug); itemName remains for human-readable copy.
 */
export type DirectConnectMaterialTarget = {
  itemId: string;
  itemName: string;
};

export type DirectConnectTarget = string | DirectConnectMaterialTarget | null | undefined;

export type ResolvedDirectConnectMaterial = {
  itemId: string | null;
  itemName: string | null;
};

export function resolveDirectConnectMaterial(
  target: DirectConnectTarget
): ResolvedDirectConnectMaterial {
  if (target == null) return { itemId: null, itemName: null };
  if (typeof target === "string") {
    const itemName = target.trim() || null;
    return { itemId: null, itemName };
  }
  const itemId = String(target.itemId || "").trim() || null;
  const itemName = String(target.itemName || "").trim() || null;
  return { itemId, itemName };
}

/** Stable engagement / source-context key: slug when present, else display name. */
export function directConnectItemParam(material: ResolvedDirectConnectMaterial): string | null {
  return material.itemId || material.itemName;
}
