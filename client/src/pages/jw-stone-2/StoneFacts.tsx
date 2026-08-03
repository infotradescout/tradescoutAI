import type { JwStone2InventoryItem } from "@/features/jw-stone-2/types";

type StoneFactsProps = {
  item: JwStone2InventoryItem;
  includeColor?: boolean;
  compact?: boolean;
};

const COLOR_LABELS = {
  all: "All current selections",
  "warm-neutrals": "Warm neutrals",
  "cool-lights": "Cool & light",
  "deep-dramatic": "Deep & dramatic",
  "green-earth": "Green & earth",
  "mixed-palette": "Mixed palette",
} as const;

export function sourceCountLabel(item: JwStone2InventoryItem) {
  if (!item.sourceSlabCounts?.length) return null;
  return item.sourceSlabCounts.map((count) => `${count} slabs recorded`).join(" / ");
}

export function StoneFacts({ item, includeColor = false, compact = false }: StoneFactsProps) {
  const facts = [
    includeColor ? { label: "Color direction", value: COLOR_LABELS[item.colorDirection] } : null,
    item.material ? { label: "Material", value: item.material.name } : null,
    item.verifiedFinishLabel
      ? {
          label: item.verifiedFinishes.length > 1 ? "Verified finishes" : "Verified finish",
          value: item.verifiedFinishLabel,
        }
      : null,
    item.dimensions ? { label: "Dimensions", value: item.dimensions.value } : null,
    item.sourceSlabCounts?.length
      ? { label: "Recorded quantity", value: sourceCountLabel(item) }
      : null,
    item.availability ? { label: "Availability", value: item.availability.value } : null,
    item.translucency ? { label: "Translucency", value: item.translucency.value } : null,
    item.origin ? { label: "Origin", value: item.origin.country } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact?.value));

  if (!facts.length) return null;

  return (
    <dl className={compact ? "jw2-facts jw2-facts--compact" : "jw2-facts"}>
      {facts.map((fact) => (
        <div className="jw2-fact" key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
