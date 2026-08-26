export const JW_STONE_ROOT_SEO = Object.freeze({
  title: "Natural Stone Slabs in Pensacola | JW Stone",
  description:
    "Browse granite, marble, quartzite, onyx, soapstone, basalt, and engineered quartz slabs from JW Stone in Pensacola. Request current pricing or availability.",
  supportingLine:
    "Natural stone and engineered quartz slabs in Pensacola for Gulf Coast projects.",
});

export type JwStoneMaterialSeo = Readonly<{
  sourceSlug: string;
  publicSlug: string;
  label: string;
  title: string;
  summary: string;
  leadItemSlug: string;
}>;

export const JW_STONE_MATERIAL_SEO: readonly JwStoneMaterialSeo[] = Object.freeze([
  {
    sourceSlug: "granite",
    publicSlug: "granite",
    label: "Granite",
    title: "Granite Slabs in Pensacola | JW Stone",
    summary:
      "Browse named granite slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "black-dunes",
  },
  {
    sourceSlug: "marble",
    publicSlug: "marble",
    label: "Marble",
    title: "Marble Slabs in Pensacola | JW Stone",
    summary:
      "Browse named marble slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "calacatta-vaguili",
  },
  {
    sourceSlug: "quartzite",
    publicSlug: "quartzite",
    label: "Quartzite",
    title: "Quartzite Slabs in Pensacola | JW Stone",
    summary:
      "Browse named quartzite slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "cristalita-blue",
  },
  {
    sourceSlug: "quartz",
    publicSlug: "engineered-quartz",
    label: "Engineered Quartz",
    title: "Engineered Quartz Slabs in Pensacola | JW Stone",
    summary:
      "Browse named engineered quartz slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "aj-quartz",
  },
  {
    sourceSlug: "onyx",
    publicSlug: "onyx",
    label: "Onyx",
    title: "Onyx Slabs in Pensacola | JW Stone",
    summary:
      "Browse onyx slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "honey-onyx",
  },
  {
    sourceSlug: "soapstone",
    publicSlug: "soapstone",
    label: "Soapstone",
    title: "Soapstone Slabs in Pensacola | JW Stone",
    summary:
      "Browse soapstone slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "marina-black-soapstone",
  },
  {
    sourceSlug: "basalt",
    publicSlug: "basalt",
    label: "Basalt",
    title: "Basalt Slabs in Pensacola | JW Stone",
    summary:
      "Browse basalt slab selections from JW Stone in Pensacola, compare real material photographs, and request current pricing or availability for Gulf Coast projects.",
    leadItemSlug: "matrix-basalt",
  },
]);

export function getJwStoneMaterialSeo(value: unknown): JwStoneMaterialSeo | null {
  const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!slug) return null;
  return (
    JW_STONE_MATERIAL_SEO.find(
      (material) => material.sourceSlug === slug || material.publicSlug === slug
    ) || null
  );
}

export function buildJwStoneMaterialDescription(
  material: JwStoneMaterialSeo,
  itemCount?: number | null
): string {
  const count = Number.isFinite(itemCount) && Number(itemCount) > 0 ? Math.trunc(Number(itemCount)) : 0;
  if (!count) return material.summary;
  const selectionLabel = count === 1 ? "selection" : "selections";
  return `${material.summary} Explore ${count} published ${selectionLabel}.`;
}

export function buildJwStoneItemSeo(args: {
  name: string;
  materialLabel?: string | null;
}): { title: string; description: string } {
  const name = String(args.name || "").trim();
  const material = String(args.materialLabel || "").trim();
  const materialPhrase = material ? ` ${material.toLowerCase()}` : " stone";
  return {
    title: `${name} Stone Slab in Pensacola | JW Stone`,
    description:
      `View ${name}${materialPhrase} at JW Stone in Pensacola. ` +
      "Compare the published slab photos and request current pricing or availability for your project.",
  };
}
