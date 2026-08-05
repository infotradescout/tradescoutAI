import reconciliationManifest from "./jwStoneInventoryReconciliation.json";

export type JwStoneReconciliationColorDirection =
  | "soft-light"
  | "warm-earthy"
  | "cool-serene"
  | "deep-dramatic"
  | "bold-expressive";

export type GeneratedJwStoneRecord = {
  categorySlug: string;
  name: string;
  slug: string;
  images: string[];
  sourceFolders?: string[];
  sourceFileIds: string[];
  slabCounts?: number[];
  shareImageOrder?: number[];
  finishes?: string[];
};

type NamedMerge = {
  targetSlug: string;
  sourceFileIds: string[];
  slabCounts?: number[];
};

type ReconciledAddition = {
  categorySlug: string;
  name: string;
  slug: string;
  colorDirection: JwStoneReconciliationColorDirection;
  sourceFileIds: string[];
  slabCounts?: number[];
  finishes?: string[];
  /** ISO day/datetime when the stone arrived; feeds 14-day New Arrivals. */
  arrivedAt?: string;
};

type AnonymousBundle = Omit<ReconciledAddition, "categorySlug" | "name"> & {
  evidenceKey: string;
};

export type JwStoneInventoryReconciliationManifest = {
  namedMerges: NamedMerge[];
  namedAdditions: ReconciledAddition[];
  anonymousBundles: AnonymousBundle[];
};

export const JW_STONE_INVENTORY_RECONCILIATION =
  reconciliationManifest as JwStoneInventoryReconciliationManifest;

const SYNTHETIC_BATCH_SLUG = /^trending-selection-\d+$/;

function cloneRecord(record: GeneratedJwStoneRecord): GeneratedJwStoneRecord {
  return {
    ...record,
    images: [...record.images],
    sourceFolders: record.sourceFolders ? [...record.sourceFolders] : undefined,
    sourceFileIds: [...record.sourceFileIds],
    slabCounts: record.slabCounts ? [...record.slabCounts] : undefined,
    shareImageOrder: record.shareImageOrder ? [...record.shareImageOrder] : undefined,
    finishes: record.finishes ? [...record.finishes] : undefined,
  };
}

function mergeCounts(current: number[] | undefined, added: number[] | undefined) {
  const counts = [...new Set([...(current ?? []), ...(added ?? [])])].sort((a, b) => a - b);
  return counts.length ? counts : undefined;
}

/**
 * Replaces the old file-order batches with the reviewed photo-to-selection map.
 * Every unidentified source photo must be consumed exactly once. A missing,
 * repeated, or newly introduced photo fails closed instead of silently mixing
 * unrelated stones into one public card.
 */
export function reconcileJwStoneGeneratedInventory(
  generated: readonly GeneratedJwStoneRecord[],
  manifest: JwStoneInventoryReconciliationManifest = JW_STONE_INVENTORY_RECONCILIATION
): GeneratedJwStoneRecord[] {
  const sourceImageCount = generated.reduce((total, record) => total + record.images.length, 0);
  const syntheticBatches = generated.filter((record) => SYNTHETIC_BATCH_SLUG.test(record.slug));
  const reconciled = generated
    .filter((record) => !SYNTHETIC_BATCH_SLUG.test(record.slug))
    .map(cloneRecord);

  const unidentifiedAssets = new Map<string, { image: string }>();
  for (const batch of syntheticBatches) {
    if (batch.images.length !== batch.sourceFileIds.length) {
      throw new Error(`JW Stone synthetic batch has mismatched photo metadata: ${batch.slug}`);
    }
    batch.sourceFileIds.forEach((sourceFileId, index) => {
      if (unidentifiedAssets.has(sourceFileId)) {
        throw new Error(
          `JW Stone unidentified photo is repeated in source batches: ${sourceFileId}`
        );
      }
      unidentifiedAssets.set(sourceFileId, { image: batch.images[index] });
    });
  }

  const consumed = new Set<string>();
  const takeAssets = (sourceFileIds: readonly string[]) =>
    sourceFileIds.map((sourceFileId) => {
      const asset = unidentifiedAssets.get(sourceFileId);
      if (!asset) {
        throw new Error(`JW Stone reconciliation references an unknown photo: ${sourceFileId}`);
      }
      if (consumed.has(sourceFileId)) {
        throw new Error(`JW Stone reconciliation assigns one photo twice: ${sourceFileId}`);
      }
      consumed.add(sourceFileId);
      return { sourceFileId, image: asset.image };
    });

  for (const merge of manifest.namedMerges) {
    const target = reconciled.find((record) => record.slug === merge.targetSlug);
    if (!target) {
      throw new Error(`JW Stone reconciliation target is missing: ${merge.targetSlug}`);
    }
    const assets = takeAssets(merge.sourceFileIds);
    const firstAddedImageIndex = target.images.length;
    target.images.push(...assets.map((asset) => asset.image));
    target.sourceFileIds.push(...assets.map((asset) => asset.sourceFileId));
    target.slabCounts = mergeCounts(target.slabCounts, merge.slabCounts);
    if (target.shareImageOrder) {
      target.shareImageOrder.push(...assets.map((_asset, index) => firstAddedImageIndex + index));
    }
  }

  for (const addition of manifest.namedAdditions) {
    const assets = takeAssets(addition.sourceFileIds);
    reconciled.push({
      categorySlug: addition.categorySlug,
      name: addition.name,
      slug: addition.slug,
      images: assets.map((asset) => asset.image),
      sourceFileIds: assets.map((asset) => asset.sourceFileId),
      slabCounts: addition.slabCounts ? [...addition.slabCounts] : undefined,
      finishes: addition.finishes ? [...addition.finishes] : undefined,
    });
  }

  manifest.anonymousBundles.forEach((bundle, index) => {
    const assets = takeAssets(bundle.sourceFileIds);
    const ordinal = String(index + 1).padStart(2, "0");
    reconciled.push({
      categorySlug: "unconfirmed",
      name: `Trending Selection ${ordinal}`,
      slug: bundle.slug,
      images: assets.map((asset) => asset.image),
      sourceFileIds: assets.map((asset) => asset.sourceFileId),
      slabCounts: bundle.slabCounts ? [...bundle.slabCounts] : undefined,
      finishes: bundle.finishes ? [...bundle.finishes] : undefined,
    });
  });

  if (consumed.size !== unidentifiedAssets.size) {
    const missing = [...unidentifiedAssets.keys()].filter(
      (sourceFileId) => !consumed.has(sourceFileId)
    );
    throw new Error(`JW Stone reconciliation leaves photos unassigned: ${missing.join(", ")}`);
  }

  const reconciledImageCount = reconciled.reduce(
    (total, record) => total + record.images.length,
    0
  );
  if (reconciledImageCount !== sourceImageCount) {
    throw new Error(
      `JW Stone reconciliation changed the photo count: ${sourceImageCount} -> ${reconciledImageCount}`
    );
  }

  const allSourceFileIds = reconciled.flatMap((record) => record.sourceFileIds);
  if (new Set(allSourceFileIds).size !== allSourceFileIds.length) {
    throw new Error("JW Stone reconciliation leaves duplicate source photos in the catalog");
  }

  return reconciled;
}
