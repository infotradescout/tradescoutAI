import sourceNamesByDriveId from "@/data/jwStoneSourceNames.generated.json";
import reconciliation from "@/data/jwStoneInventoryReconciliation.json";

export type SlabDimension = Readonly<{
  widthIn: number;
  heightIn: number;
}>;

const SOURCE_NAMES = sourceNamesByDriveId as Readonly<Record<string, string>>;

const EVIDENCE_KEY_BY_SLUG: ReadonlyMap<string, string> = new Map(
  (reconciliation.anonymousBundles as ReadonlyArray<{ slug: string; evidenceKey: string }>).map(
    (bundle) => [bundle.slug, bundle.evidenceKey] as const
  )
);

/** Extract Drive file id from a JW inventory image path. */
export function driveIdFromInventoryImagePath(imagePath: string): string | null {
  const match = imagePath.match(/\/inventory-source\/([^/.]+)\./i);
  return match?.[1] ?? null;
}

/**
 * Parse slab inches from JW Drive filenames or reconciliation evidence keys.
 * Examples: `126x78`, `129.5”X80.5`, `126 x 79`, evidence `granite-126x76-6`.
 */
export function parseSlabDimension(text: string): SlabDimension | null {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[”″"']/g, "")
    .replace(/×/g, "x");

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const widthIn = Number(match[1]);
  const heightIn = Number(match[2]);
  if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn)) return null;
  if (widthIn < 20 || heightIn < 20 || widthIn > 220 || heightIn > 220) return null;

  return { widthIn, heightIn };
}

export function formatSlabDimension(dimension: SlabDimension): string {
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
  return `${format(dimension.widthIn)}×${format(dimension.heightIn)}"`;
}

/** Return dimensions only when this exact inventory photo's source filename records them. */
export function resolveSlabDimensionForInventoryImage(imagePath: string): SlabDimension | null {
  const driveId = driveIdFromInventoryImagePath(imagePath);
  if (!driveId) return null;
  const sourceName = SOURCE_NAMES[driveId];
  return sourceName ? parseSlabDimension(sourceName) : null;
}

function dimensionKey(dimension: SlabDimension): string {
  return `${dimension.widthIn}x${dimension.heightIn}`;
}

/**
 * Collect unique slab sizes evidenced by Drive source filenames for the stone's photos.
 * Falls back to anonymous reconciliation evidenceKey when filenames lack sizes.
 */
export function resolveSlabDimensionsLabel(args: {
  slug: string;
  images: readonly string[];
}): string | null {
  const seen = new Map<string, SlabDimension>();

  for (const image of args.images) {
    const driveId = driveIdFromInventoryImagePath(image);
    if (!driveId) continue;
    const sourceName = SOURCE_NAMES[driveId];
    if (!sourceName) continue;
    const dimension = parseSlabDimension(sourceName);
    if (!dimension) continue;
    seen.set(dimensionKey(dimension), dimension);
  }

  if (!seen.size) {
    const evidenceKey = EVIDENCE_KEY_BY_SLUG.get(args.slug);
    if (evidenceKey) {
      const fromEvidence = parseSlabDimension(evidenceKey);
      if (fromEvidence) seen.set(dimensionKey(fromEvidence), fromEvidence);
    }
  }

  if (!seen.size) return null;

  const labels = [...seen.values()]
    .sort((a, b) => b.widthIn * b.heightIn - a.widthIn * a.heightIn)
    .slice(0, 2)
    .map(formatSlabDimension);

  return labels.join(" · ");
}
