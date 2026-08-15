/** Partner-neutral planning catalog. Full source URLs stay in the internal evidence ledger. */
export const BUILDING_CATALOG_REVIEWED_ON = "2026-08-15" as const;

export const BUILDING_CATALOG_SOURCE_IDS = [
  "kit-capabilities",
  "frame-systems",
  "building-accessories",
  "roof-families",
  "additions",
  "hangar-openings",
  "hybrid-system",
  "tube-leg-guide",
] as const;

export type BuildingCatalogSourceId = (typeof BUILDING_CATALOG_SOURCE_IDS)[number];

export type BuildingUseId =
  | "barndominium"
  | "home-with-shop"
  | "garage-workshop"
  | "agricultural"
  | "commercial-industrial"
  | "arena"
  | "hangar"
  | "mini-storage"
  | "greenhouse"
  | "community-recreation"
  | "special-use";

export type BuildingSystemId =
  | "open-web-truss"
  | "tapered-clearspan"
  | "modular-rigid-frame"
  | "straight-column-clearspan"
  | "hybrid-web-truss"
  | "tube-leg-open-web"
  | "light-gauge-steel";

export type BuildingRoofId =
  | "gable"
  | "single-slope"
  | "gambrel"
  | "monitor"
  | "hip"
  | "asymmetrical";

export type BuildingColorId =
  | "polar-white"
  | "sandstone"
  | "sage"
  | "charcoal"
  | "bronze"
  | "black"
  | "rustic-red"
  | "gallery-blue";

export type BuildingOpeningTypeId =
  | "walk-door"
  | "overhead-door"
  | "roll-up-door"
  | "sliding-door"
  | "dutch-door"
  | "window"
  | "louver"
  | "framed-opening"
  | "hangar-bifold"
  | "hangar-hydraulic"
  | "hangar-stack"
  | "skylight";

export type BuildingAttachmentTypeId =
  | "lean-to"
  | "porch"
  | "canopy-carport"
  | "enclosed-addition"
  | "eave-extension"
  | "connected-building"
  | "breezeway";

export type BuildingAccessoryTypeId =
  | "cupola"
  | "shutters"
  | "insulation"
  | "wainscot"
  | "wall-light"
  | "eave-light"
  | "upgraded-roof-panel"
  | "interior-i-beam"
  | "bar-joist"
  | "gutters-downspouts"
  | "lightning-protection"
  | "ridge-vent"
  | "soffit"
  | "horse-stalls"
  | "dormer"
  | "mezzanine-second-floor"
  | "alternate-exterior-finish"
  | "vaulted-ceiling-clips";

export type BuildingWall = "front" | "right" | "rear" | "left";
export type BuildingSurface = BuildingWall | "roof" | "whole-building";

type CatalogEntry<Id extends string> = {
  id: Id;
  label: string;
  description: string;
  sourceIds: readonly BuildingCatalogSourceId[];
};

export type PublishedPlanningRange = {
  min?: number;
  max?: number;
  unit: "ft" | "rise-per-12";
  meaning: "published" | "published-typical";
  note: string;
};

export const BUILDING_USES = [
  {
    id: "barndominium",
    label: "Home or barndominium shell",
    description:
      "A residential shell whose interior plan, code path, and utilities are confirmed separately.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "home-with-shop",
    label: "Home with shop",
    description: "Residential and workshop zones in one planning footprint.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "garage-workshop",
    label: "Garage or workshop",
    description: "Vehicle, equipment, fabrication, hobby, or service space.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "agricultural",
    label: "Agricultural building",
    description: "Storage, livestock, equipment, or other farm use.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "commercial-industrial",
    label: "Commercial or industrial",
    description:
      "Business, warehouse, production, or other occupancy requiring professional review.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "arena",
    label: "Arena",
    description: "A long-span riding or event enclosure.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "hangar",
    label: "Aircraft hangar",
    description: "Aircraft enclosure with a specifically placed and engineered hangar opening.",
    sourceIds: ["kit-capabilities", "hangar-openings"],
  },
  {
    id: "mini-storage",
    label: "Mini-storage",
    description: "Repeated storage bays and circulation planned to local requirements.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "greenhouse",
    label: "Greenhouse",
    description: "Protected growing space with envelope and ventilation needs confirmed by quote.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "community-recreation",
    label: "Community or recreation building",
    description: "Assembly, recreation, worship, or community use.",
    sourceIds: ["kit-capabilities"],
  },
  {
    id: "special-use",
    label: "Other special-use structure",
    description: "A custom use to describe in the request notes.",
    sourceIds: ["kit-capabilities"],
  },
] as const satisfies readonly CatalogEntry<BuildingUseId>[];

export type BuildingSystemCatalogEntry = CatalogEntry<BuildingSystemId> & {
  widthRange: PublishedPlanningRange;
  eaveHeightRange?: PublishedPlanningRange;
  supportedRoofs: readonly BuildingRoofId[];
  interiorColumns: "none" | "possible";
};

export const BUILDING_SYSTEMS: readonly BuildingSystemCatalogEntry[] = [
  {
    id: "open-web-truss",
    label: "Open-web clearspan truss",
    description:
      "Clear interior span with published dimensional guidance; other sizes may be requested.",
    widthRange: {
      min: 12,
      max: 100,
      unit: "ft",
      meaning: "published",
      note: "Published clearspan width is 12–100 ft; other sizes may be available by request.",
    },
    eaveHeightRange: {
      min: 8,
      max: 20,
      unit: "ft",
      meaning: "published",
      note: "Published sidewall height is 8–20 ft; other heights may be available by request.",
    },
    supportedRoofs: ["gable", "single-slope", "gambrel", "monitor", "hip", "asymmetrical"],
    interiorColumns: "none",
    sourceIds: ["frame-systems"],
  },
  {
    id: "tapered-clearspan",
    label: "Tapered rigid-frame clearspan",
    description: "Long clearspan rigid frame with no planned interior column line.",
    widthRange: {
      min: 40,
      max: 150,
      unit: "ft",
      meaning: "published-typical",
      note: "Published typical width is 40–150 ft; final capability requires a quote.",
    },
    supportedRoofs: ["gable", "single-slope", "asymmetrical"],
    interiorColumns: "none",
    sourceIds: ["frame-systems"],
  },
  {
    id: "modular-rigid-frame",
    label: "Modular rigid frame",
    description:
      "Multiple structural spans with planned interior column lines for very wide buildings.",
    widthRange: {
      min: 80,
      max: 300,
      unit: "ft",
      meaning: "published-typical",
      note: "Published overall widths are 80–300+ ft with individual 40–80 ft spans.",
    },
    supportedRoofs: ["gable", "single-slope"],
    interiorColumns: "possible",
    sourceIds: ["frame-systems"],
  },
  {
    id: "straight-column-clearspan",
    label: "Straight-column clearspan",
    description: "Straight-wall rigid frame within its published span guidance.",
    widthRange: {
      min: 20,
      max: 60,
      unit: "ft",
      meaning: "published",
      note: "Published clearspan width is 20–60 ft.",
    },
    supportedRoofs: ["gable", "single-slope"],
    interiorColumns: "none",
    sourceIds: ["frame-systems"],
  },
  {
    id: "hybrid-web-truss",
    label: "Hybrid steel truss / wood secondary framing",
    description:
      "Structural steel web trusses combined with wood secondary framing; dimensions require review.",
    widthRange: {
      unit: "ft",
      meaning: "published-typical",
      note: "No universal public dimensional limit is asserted; request a project-specific review.",
    },
    supportedRoofs: ["gable", "single-slope", "gambrel", "monitor", "hip", "asymmetrical"],
    interiorColumns: "none",
    sourceIds: ["hybrid-system"],
  },
  {
    id: "tube-leg-open-web",
    label: "Open-web tube-leg frame",
    description:
      "Straight tube-leg home frame intended to keep interior and exterior wall planes clear; final configuration requires review.",
    widthRange: {
      min: 12,
      max: 60,
      unit: "ft",
      meaning: "published",
      note: "Published home widths are 12–60 ft; larger/custom configurations require written review.",
    },
    supportedRoofs: ["gable", "single-slope", "gambrel", "monitor", "hip", "asymmetrical"],
    interiorColumns: "none",
    sourceIds: ["tube-leg-guide"],
  },
  {
    id: "light-gauge-steel",
    label: "Light-gauge steel frame",
    description:
      "Cold-formed light-gauge steel framing; no universal public dimensional limit is asserted.",
    widthRange: {
      unit: "ft",
      meaning: "published-typical",
      note: "Dimensions and roof compatibility require a project-specific written review.",
    },
    supportedRoofs: ["gable", "single-slope", "gambrel", "monitor", "hip", "asymmetrical"],
    interiorColumns: "possible",
    sourceIds: ["tube-leg-guide"],
  },
];

export type BuildingRoofCatalogEntry = CatalogEntry<BuildingRoofId> & {
  requiredDetailKeys: readonly string[];
};

export const BUILDING_ROOFS = [
  {
    id: "gable",
    label: "Gable",
    description: "Centered ridge with two equal roof planes.",
    requiredDetailKeys: [],
    sourceIds: ["roof-families"],
  },
  {
    id: "single-slope",
    label: "Single slope",
    description: "One roof plane; identify the high side.",
    requiredDetailKeys: ["singleSlopeHighSide"],
    sourceIds: ["frame-systems", "roof-families"],
  },
  {
    id: "gambrel",
    label: "Gambrel",
    description: "Two slopes on each side; break inset and upper pitch must be entered.",
    requiredDetailKeys: ["gambrelBreakInsetFt", "secondaryPitchRise12"],
    sourceIds: ["roof-families"],
  },
  {
    id: "monitor",
    label: "Monitor",
    description: "Raised center roof; monitor width and rise must be entered.",
    requiredDetailKeys: ["monitorWidthFt", "monitorHeightFt"],
    sourceIds: ["roof-families"],
  },
  {
    id: "hip",
    label: "Hip",
    description:
      "Slopes on all sides; the planner requires acceptance of a centered equal-pitch assumption.",
    requiredDetailKeys: ["hipCenteredEqualPitchAccepted"],
    sourceIds: ["roof-families"],
  },
  {
    id: "asymmetrical",
    label: "Asymmetrical gable",
    description: "Offset ridge; ridge offset and second roof-plane pitch must be entered.",
    requiredDetailKeys: ["asymmetricalRidgeOffsetFt", "secondaryPitchRise12"],
    sourceIds: ["additions"],
  },
] as const satisfies readonly BuildingRoofCatalogEntry[];

export const BUILDING_COLORS = [
  { id: "polar-white", label: "Polar white", hex: "#e8e6dd" },
  { id: "sandstone", label: "Sandstone", hex: "#c4ad87" },
  { id: "sage", label: "Sage", hex: "#78877a" },
  { id: "charcoal", label: "Charcoal", hex: "#4d5758" },
  { id: "bronze", label: "Bronze", hex: "#665243" },
  { id: "black", label: "Black", hex: "#242625" },
  { id: "rustic-red", label: "Rustic red", hex: "#7d372f" },
  { id: "gallery-blue", label: "Gallery blue", hex: "#365669" },
] as const satisfies readonly { id: BuildingColorId; label: string; hex: `#${string}` }[];

export type BuildingOpeningCatalogEntry = CatalogEntry<BuildingOpeningTypeId> & {
  surfaces: readonly (BuildingWall | "roof")[];
  clearanceNote: string;
};

export const BUILDING_OPENINGS = [
  ["walk-door", "Walk door", ["front", "right", "rear", "left"]],
  ["overhead-door", "Overhead sectional door", ["front", "right", "rear", "left"]],
  ["roll-up-door", "Roll-up door", ["front", "right", "rear", "left"]],
  ["sliding-door", "Sliding door", ["front", "right", "rear", "left"]],
  ["dutch-door", "Dutch door", ["front", "right", "rear", "left"]],
  ["window", "Window", ["front", "right", "rear", "left"]],
  ["louver", "Louver", ["front", "right", "rear", "left"]],
  ["framed-opening", "Framed opening", ["front", "right", "rear", "left"]],
  ["hangar-bifold", "Bifold hangar opening", ["front", "rear"]],
  ["hangar-hydraulic", "Hydraulic hangar opening", ["front", "rear"]],
  ["hangar-stack", "Stack hangar opening", ["front", "rear"]],
  ["skylight", "Skylight", ["roof"]],
].map(([id, label, surfaces]) => ({
  id,
  label,
  surfaces,
  description: `${label} placed by measured size and location.`,
  clearanceNote:
    "Final framing, trim, operation, and structural clearances require engineering review.",
  sourceIds: id.toString().startsWith("hangar-")
    ? (["hangar-openings"] as const)
    : (["building-accessories"] as const),
})) as BuildingOpeningCatalogEntry[];

export type BuildingAttachmentCatalogEntry = CatalogEntry<BuildingAttachmentTypeId> & {
  requiresVerticalGeometry: boolean;
};

export const BUILDING_ATTACHMENTS = [
  {
    id: "lean-to",
    label: "Lean-to",
    description: "Attached sloped-roof bay placed along one wall.",
    requiresVerticalGeometry: true,
    sourceIds: ["frame-systems"],
  },
  {
    id: "porch",
    label: "Porch",
    description: "Covered exterior area placed along one wall.",
    requiresVerticalGeometry: true,
    sourceIds: ["building-accessories"],
  },
  {
    id: "canopy-carport",
    label: "Canopy or carport",
    description: "Open-sided roof attachment placed along one wall.",
    requiresVerticalGeometry: true,
    sourceIds: ["additions"],
  },
  {
    id: "enclosed-addition",
    label: "Enclosed addition",
    description: "Enclosed attached footprint whose roof connection must be entered.",
    requiresVerticalGeometry: true,
    sourceIds: ["additions"],
  },
  {
    id: "eave-extension",
    label: "Eave extension",
    description: "Roof extension measured from one wall plane.",
    requiresVerticalGeometry: true,
    sourceIds: ["additions"],
  },
  {
    id: "connected-building",
    label: "Connected building",
    description: "A second building footprint connected at a different height or roof line.",
    requiresVerticalGeometry: true,
    sourceIds: ["tube-leg-guide"],
  },
  {
    id: "breezeway",
    label: "Breezeway",
    description: "A roofed connection footprint between building volumes.",
    requiresVerticalGeometry: true,
    sourceIds: ["tube-leg-guide"],
  },
] as const satisfies readonly BuildingAttachmentCatalogEntry[];

export type BuildingAccessoryCatalogEntry = CatalogEntry<BuildingAccessoryTypeId> & {
  placement: "whole-building" | "wall" | "roof";
};

export const BUILDING_ACCESSORIES = [
  ["cupola", "Cupola", "roof"],
  ["shutters", "Shutters", "wall"],
  ["insulation", "Insulation", "whole-building"],
  ["wainscot", "Wainscot", "whole-building"],
  ["wall-light", "Wall light", "wall"],
  ["eave-light", "Eave light", "wall"],
  ["upgraded-roof-panel", "Upgraded roof panel", "whole-building"],
  ["interior-i-beam", "Interior I-beam", "whole-building"],
  ["bar-joist", "Bar joist", "whole-building"],
  ["gutters-downspouts", "Gutters and downspouts", "whole-building"],
  ["lightning-protection", "Lightning protection", "whole-building"],
  ["ridge-vent", "Ridge vent", "roof"],
  ["soffit", "Soffit", "whole-building"],
  ["horse-stalls", "Horse stalls", "whole-building"],
  ["dormer", "Dormer requirement", "roof"],
  ["mezzanine-second-floor", "Mezzanine or second floor", "whole-building"],
  ["alternate-exterior-finish", "Alternate exterior finish", "whole-building"],
  ["vaulted-ceiling-clips", "Vaulted-ceiling clips", "whole-building"],
].map(([id, label, placement]) => ({
  id,
  label,
  placement,
  description: `${label} requirement for written-quote review.`,
  sourceIds: [
    [
      "dormer",
      "mezzanine-second-floor",
      "alternate-exterior-finish",
      "vaulted-ceiling-clips",
    ].includes(id)
      ? "tube-leg-guide"
      : "building-accessories",
  ] as BuildingCatalogSourceId[],
})) as BuildingAccessoryCatalogEntry[];

function byId<Id extends string, Entry extends { id: Id }>(
  entries: readonly Entry[],
  id: Id | null
) {
  return id === null ? undefined : entries.find((entry) => entry.id === id);
}

export const getBuildingUse = (id: BuildingUseId | null) => byId(BUILDING_USES, id);
export const getBuildingSystem = (id: BuildingSystemId | null) => byId(BUILDING_SYSTEMS, id);
export const getBuildingRoof = (id: BuildingRoofId | null) => byId(BUILDING_ROOFS, id);
export const getBuildingColor = (id: BuildingColorId | null) => byId(BUILDING_COLORS, id);
export const getBuildingOpening = (id: BuildingOpeningTypeId | null) => byId(BUILDING_OPENINGS, id);
export const getBuildingAttachment = (id: BuildingAttachmentTypeId | null) =>
  byId(BUILDING_ATTACHMENTS, id);
export const getBuildingAccessory = (id: BuildingAccessoryTypeId | null) =>
  byId(BUILDING_ACCESSORIES, id);

export function isRoofSupportedBySystem(
  systemId: BuildingSystemId | null,
  roofId: BuildingRoofId | null
): boolean {
  if (!systemId || !roofId) return false;
  return getBuildingSystem(systemId)?.supportedRoofs.includes(roofId) === true;
}
