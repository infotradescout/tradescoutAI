import generatedJwStoneInventory from "../client/src/data/jwStoneInventory.generated.json";
import {
  JW_STONE_PROFILE_SLUG,
  resolveJwStoneInventoryNamePresentation,
} from "@shared/jwStonePresentation";

export type ExpressStoneSelection = {
  itemId: string;
  stoneName: string;
};

export type ExpressStoneSelectionValidation =
  | { success: true; selections: ExpressStoneSelection[] }
  | {
      success: false;
      reason:
        | "too_many"
        | "unsupported_profile"
        | "duplicate_item"
        | "unknown_or_unnamed_item"
        | "stone_name_mismatch";
    };

const jwStoneCanonicalNamedInventory = (() => {
  const registry = new Map<string, string>();
  for (const item of generatedJwStoneInventory) {
    const itemId = String(item.slug || "").trim();
    const presentation = resolveJwStoneInventoryNamePresentation({
      slug: itemId,
      name: item.name,
    });
    if (itemId && presentation.nameStatus === "source" && presentation.displayName) {
      registry.set(itemId, presentation.displayName);
    }
  }
  return registry;
})();

/**
 * A plural JW handoff is all-or-nothing: item IDs come from the inventory
 * registry and labels are re-derived there instead of trusting public input.
 */
export function validateExpressStoneSelections(args: {
  profileSlug: unknown;
  stoneSelections?: readonly ExpressStoneSelection[];
}): ExpressStoneSelectionValidation {
  const submitted = args.stoneSelections || [];
  if (submitted.length > 24) return { success: false, reason: "too_many" };

  const profileSlug = String(args.profileSlug || "")
    .trim()
    .toLowerCase();
  if (profileSlug !== JW_STONE_PROFILE_SLUG) {
    return submitted.length
      ? { success: false, reason: "unsupported_profile" }
      : { success: true, selections: [] };
  }

  const seenItemIds = new Set<string>();
  const selections: ExpressStoneSelection[] = [];
  for (const selection of submitted) {
    if (seenItemIds.has(selection.itemId)) {
      return { success: false, reason: "duplicate_item" };
    }
    seenItemIds.add(selection.itemId);

    const canonicalStoneName = jwStoneCanonicalNamedInventory.get(selection.itemId);
    if (!canonicalStoneName) {
      return { success: false, reason: "unknown_or_unnamed_item" };
    }
    if (selection.stoneName !== canonicalStoneName) {
      return { success: false, reason: "stone_name_mismatch" };
    }
    selections.push({
      itemId: selection.itemId,
      stoneName: canonicalStoneName,
    });
  }

  return { success: true, selections };
}
