/* eslint-disable @typescript-eslint/no-non-null-assertion -- Canonical geometry is built only after explicit completeness guards. */
import type { SteelHomeBuildingDesign } from "./projectModel";
import {
  BUILDING_ACCESSORIES,
  BUILDING_ATTACHMENTS,
  BUILDING_COLORS,
  BUILDING_OPENINGS,
  BUILDING_ROOFS,
  BUILDING_SYSTEMS,
  BUILDING_USES,
  getBuildingAccessory,
  getBuildingAttachment,
  getBuildingColor,
  getBuildingOpening,
  getBuildingRoof,
  getBuildingSystem,
  getBuildingUse,
  isRoofSupportedBySystem,
  type BuildingAccessoryTypeId,
  type BuildingAttachmentTypeId,
  type BuildingColorId,
  type BuildingOpeningTypeId,
  type BuildingRoofId,
  type BuildingSurface,
  type BuildingSystemId,
  type BuildingUseId,
  type BuildingWall,
} from "./buildingCatalog";

export const BUILDING_PLANNER_EXTENSION_VERSION = 1 as const;
export const BUILDING_PLANNER_EXTENSION_SCHEMA = "metal-building-planner" as const;

export type BuildingRoofDetails = {
  singleSlopeHighSide: "left" | "right" | null;
  monitorWidthFt: number | null;
  monitorHeightFt: number | null;
  gambrelBreakInsetFt: number | null;
  secondaryPitchRise12: number | null;
  asymmetricalRidgeOffsetFt: number | null;
  hipCenteredEqualPitchAccepted: boolean;
};

export type BuildingOpeningPlacement = {
  id: string;
  typeId: BuildingOpeningTypeId | null;
  surface: BuildingWall | "roof" | null;
  /** Width along a wall, or X dimension on a roof. */
  widthFt: number | null;
  /** Height on a wall, or Z dimension on a roof. */
  heightFt: number | null;
  /** Distance from the left edge of the selected wall in its named elevation. */
  offsetFt: number | null;
  /** Height above finished floor; ignored for roof openings. */
  sillHeightFt: number | null;
  /** Roof-plan X coordinate from the left wall. */
  roofXFt: number | null;
  /** Roof-plan Z coordinate from the front wall. */
  roofZFt: number | null;
};

export type BuildingAttachmentPlacement = {
  id: string;
  typeId: BuildingAttachmentTypeId | null;
  wall: BuildingWall | null;
  offsetFt: number | null;
  widthFt: number | null;
  projectionFt: number | null;
  /** Null deliberately means footprint-only; the planner never guesses it. */
  eaveHeightFt: number | null;
  roofPitchRise12: number | null;
};

export type BuildingAccessoryPlacement = {
  id: string;
  typeId: BuildingAccessoryTypeId | null;
  surface: BuildingSurface | null;
  /** Wall offset or roof X coordinate. */
  offsetFt: number | null;
  /** Roof Z coordinate; null for wall and whole-building requirements. */
  secondaryOffsetFt: number | null;
  elevationFt: number | null;
};

export type BuildingUnresolvedCatalogItem = {
  /** Stable field path so a replacement selection can clear the exact retired value. */
  path: string;
  savedId: string;
  label: string;
};

export type BuildingPlannerExtensionV1 = {
  version: typeof BUILDING_PLANNER_EXTENSION_VERSION;
  useId: BuildingUseId | null;
  systemId: BuildingSystemId | null;
  widthFt: number | null;
  lengthFt: number | null;
  eaveHeightFt: number | null;
  roofId: BuildingRoofId | null;
  roofPitchRise12: number | null;
  roofDetails: BuildingRoofDetails;
  colors: {
    wall: BuildingColorId | null;
    roof: BuildingColorId | null;
    trim: BuildingColorId | null;
  };
  openings: BuildingOpeningPlacement[];
  attachments: BuildingAttachmentPlacement[];
  accessories: BuildingAccessoryPlacement[];
  /** Unknown/retired saved choices stay visible and request-blocking until resolved. */
  unresolvedCatalogItems: BuildingUnresolvedCatalogItem[];
  notes: string;
};

export type BuildingPlannerPersistenceEnvelope = {
  schema: typeof BUILDING_PLANNER_EXTENSION_SCHEMA;
  version: typeof BUILDING_PLANNER_EXTENSION_VERSION;
  state: BuildingPlannerExtensionV1;
};

export type BuildingDiagnostic = {
  code: string;
  severity: "blocker" | "warning" | "review";
  message: string;
  objectId?: string;
};

export type MeasuredPoint2 = { xFt: number; heightFt: number };
export type MeasuredPoint3 = { xFt: number; yFt: number; zFt: number };

export type MeasuredRoofSurface = {
  id: string;
  vertices: MeasuredPoint3[];
};

export type MeasuredBuildingOpening = BuildingOpeningPlacement & {
  typeId: BuildingOpeningTypeId;
  surface: BuildingWall | "roof";
};

export type MeasuredBuildingAttachment = BuildingAttachmentPlacement & {
  typeId: BuildingAttachmentTypeId;
  wall: BuildingWall;
  footprint: MeasuredPoint3[];
  verticalResolved: boolean;
  /** Exact single-plane roof from the entered outer eave and pitch; null is footprint-only. */
  roofSurface: MeasuredPoint3[] | null;
};

export type MeasuredBuildingAccessory = BuildingAccessoryPlacement & {
  typeId: BuildingAccessoryTypeId;
  surface: BuildingSurface;
};

export type BuildingMeasuredScene = {
  ready: boolean;
  requestReady: boolean;
  fingerprint: string;
  shell: null | {
    widthFt: number;
    lengthFt: number;
    eaveHeightFt: number;
    roofId: BuildingRoofId;
    roofPitchRise12: number;
    roofProfile: MeasuredPoint2[];
    roofSurfaces: MeasuredRoofSurface[];
    wallColorHex: string | null;
    roofColorHex: string | null;
    trimColorHex: string | null;
  };
  openings: MeasuredBuildingOpening[];
  attachments: MeasuredBuildingAttachment[];
  accessories: MeasuredBuildingAccessory[];
  diagnostics: BuildingDiagnostic[];
};

export type BuildingPlannerRequest = {
  kind: "metal-building-planning-request";
  /** Notes make this a private project handoff; do not reuse as a public-share payload. */
  visibility: "private-project-handoff";
  quoteRequired: true;
  sceneFingerprint: string;
  use: string;
  structuralSystem: string;
  shell: string;
  roof: string;
  colors: string[];
  openings: string[];
  attachments: string[];
  accessories: string[];
  notes: string;
  qualifications: readonly string[];
};

export type BuildingPlannerRequestReadiness = {
  requestReady: boolean;
  sceneFingerprint: string;
  blockers: BuildingDiagnostic[];
  reviewItems: BuildingDiagnostic[];
};

const EMPTY_ROOF_DETAILS: BuildingRoofDetails = {
  singleSlopeHighSide: null,
  monitorWidthFt: null,
  monitorHeightFt: null,
  gambrelBreakInsetFt: null,
  secondaryPitchRise12: null,
  asymmetricalRidgeOffsetFt: null,
  hipCenteredEqualPitchAccepted: false,
};

export function createEmptyBuildingPlannerExtension(): BuildingPlannerExtensionV1 {
  return {
    version: BUILDING_PLANNER_EXTENSION_VERSION,
    useId: null,
    systemId: null,
    widthFt: null,
    lengthFt: null,
    eaveHeightFt: null,
    roofId: null,
    roofPitchRise12: null,
    roofDetails: { ...EMPTY_ROOF_DETAILS },
    colors: { wall: null, roof: null, trim: null },
    openings: [],
    attachments: [],
    accessories: [],
    unresolvedCatalogItems: [],
    notes: "",
  };
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function finiteNonnegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function isCatalogId<T extends string>(value: unknown, entries: readonly { id: T }[]): value is T {
  return typeof value === "string" && entries.some((entry) => entry.id === value);
}

function cleanId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .trim()
    .slice(0, 60)
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  return cleaned || fallback;
}

function cleanWall(value: unknown): BuildingWall | null {
  return value === "front" || value === "right" || value === "rear" || value === "left"
    ? value
    : null;
}

function cleanSurface(value: unknown): BuildingSurface | null {
  const wall = cleanWall(value);
  if (wall) return wall;
  return value === "roof" || value === "whole-building" ? value : null;
}

export function sanitizeBuildingPlannerExtension(value: unknown): BuildingPlannerExtensionV1 {
  if (!value || typeof value !== "object") return createEmptyBuildingPlannerExtension();
  const candidate = value as Partial<BuildingPlannerExtensionV1>;
  const details =
    candidate.roofDetails && typeof candidate.roofDetails === "object"
      ? candidate.roofDetails
      : EMPTY_ROOF_DETAILS;
  const colors =
    candidate.colors && typeof candidate.colors === "object"
      ? candidate.colors
      : { wall: null, roof: null, trim: null };
  const unresolvedByPath = new Map<string, BuildingUnresolvedCatalogItem>();
  const rememberUnresolved = (path: string, savedId: unknown, label: string) => {
    if (typeof savedId !== "string" || !savedId.trim()) return;
    const cleanPath = path
      .trim()
      .slice(0, 120)
      .replace(/[^a-zA-Z0-9_.-]/g, "-");
    const cleanSavedId = savedId.trim().slice(0, 120);
    if (!cleanPath || !cleanSavedId) return;
    unresolvedByPath.set(cleanPath, { path: cleanPath, savedId: cleanSavedId, label });
  };
  for (const raw of Array.isArray(candidate.unresolvedCatalogItems)
    ? candidate.unresolvedCatalogItems.slice(0, 100)
    : []) {
    if (!raw || typeof raw !== "object") continue;
    rememberUnresolved(
      raw.path,
      raw.savedId,
      typeof raw.label === "string" ? raw.label.slice(0, 120) : "Saved catalog choice"
    );
  }

  const useId = isCatalogId(candidate.useId, BUILDING_USES) ? candidate.useId : null;
  const systemId = isCatalogId(candidate.systemId, BUILDING_SYSTEMS) ? candidate.systemId : null;
  const roofId = isCatalogId(candidate.roofId, BUILDING_ROOFS) ? candidate.roofId : null;
  const wallColor = isCatalogId(colors.wall, BUILDING_COLORS) ? colors.wall : null;
  const roofColor = isCatalogId(colors.roof, BUILDING_COLORS) ? colors.roof : null;
  const trimColor = isCatalogId(colors.trim, BUILDING_COLORS) ? colors.trim : null;
  if (typeof candidate.useId === "string" && !useId)
    rememberUnresolved("useId", candidate.useId, "Building use");
  if (typeof candidate.systemId === "string" && !systemId)
    rememberUnresolved("systemId", candidate.systemId, "Structural system");
  if (typeof candidate.roofId === "string" && !roofId)
    rememberUnresolved("roofId", candidate.roofId, "Roof family");
  if (typeof colors.wall === "string" && !wallColor)
    rememberUnresolved("colors.wall", colors.wall, "Wall color");
  if (typeof colors.roof === "string" && !roofColor)
    rememberUnresolved("colors.roof", colors.roof, "Roof color");
  if (typeof colors.trim === "string" && !trimColor)
    rememberUnresolved("colors.trim", colors.trim, "Trim color");
  if (useId) unresolvedByPath.delete("useId");
  if (systemId) unresolvedByPath.delete("systemId");
  if (roofId) unresolvedByPath.delete("roofId");
  if (wallColor) unresolvedByPath.delete("colors.wall");
  if (roofColor) unresolvedByPath.delete("colors.roof");
  if (trimColor) unresolvedByPath.delete("colors.trim");

  const openingIds = new Set<string>();
  const openings = (Array.isArray(candidate.openings) ? candidate.openings : [])
    .slice(0, 60)
    .flatMap((raw, index): BuildingOpeningPlacement[] => {
      if (!raw || typeof raw !== "object") return [];
      const requestedId = cleanId(raw.id, `opening-${index + 1}`);
      let id = requestedId;
      let suffix = index + 1;
      while (openingIds.has(id)) {
        id = `${requestedId}-${suffix}`;
        suffix += 1;
      }
      openingIds.add(id);
      const typeId = isCatalogId(raw.typeId, BUILDING_OPENINGS) ? raw.typeId : null;
      if (typeof raw.typeId === "string" && !typeId)
        rememberUnresolved(`openings.${id}.typeId`, raw.typeId, `Opening ${index + 1} type`);
      if (typeId) unresolvedByPath.delete(`openings.${id}.typeId`);
      return [
        {
          id,
          typeId,
          surface: cleanWall(raw.surface) || (raw.surface === "roof" ? ("roof" as const) : null),
          widthFt: finitePositive(raw.widthFt),
          heightFt: finitePositive(raw.heightFt),
          offsetFt: finiteNonnegative(raw.offsetFt),
          sillHeightFt: finiteNonnegative(raw.sillHeightFt),
          roofXFt: finiteNonnegative(raw.roofXFt),
          roofZFt: finiteNonnegative(raw.roofZFt),
        },
      ];
    });

  const attachmentIds = new Set<string>();
  const attachments = (Array.isArray(candidate.attachments) ? candidate.attachments : [])
    .slice(0, 30)
    .flatMap((raw, index): BuildingAttachmentPlacement[] => {
      if (!raw || typeof raw !== "object") return [];
      const requestedId = cleanId(raw.id, `attachment-${index + 1}`);
      let id = requestedId;
      let suffix = index + 1;
      while (attachmentIds.has(id)) {
        id = `${requestedId}-${suffix}`;
        suffix += 1;
      }
      attachmentIds.add(id);
      const typeId = isCatalogId(raw.typeId, BUILDING_ATTACHMENTS) ? raw.typeId : null;
      if (typeof raw.typeId === "string" && !typeId)
        rememberUnresolved(`attachments.${id}.typeId`, raw.typeId, `Attachment ${index + 1} type`);
      if (typeId) unresolvedByPath.delete(`attachments.${id}.typeId`);
      return [
        {
          id,
          typeId,
          wall: cleanWall(raw.wall),
          offsetFt: finiteNonnegative(raw.offsetFt),
          widthFt: finitePositive(raw.widthFt),
          projectionFt: finitePositive(raw.projectionFt),
          eaveHeightFt: finitePositive(raw.eaveHeightFt),
          roofPitchRise12: finitePositive(raw.roofPitchRise12),
        },
      ];
    });

  const accessoryIds = new Set<string>();
  const accessories = (Array.isArray(candidate.accessories) ? candidate.accessories : [])
    .slice(0, 60)
    .flatMap((raw, index): BuildingAccessoryPlacement[] => {
      if (!raw || typeof raw !== "object") return [];
      const requestedId = cleanId(raw.id, `accessory-${index + 1}`);
      let id = requestedId;
      let suffix = index + 1;
      while (accessoryIds.has(id)) {
        id = `${requestedId}-${suffix}`;
        suffix += 1;
      }
      accessoryIds.add(id);
      const typeId = isCatalogId(raw.typeId, BUILDING_ACCESSORIES) ? raw.typeId : null;
      if (typeof raw.typeId === "string" && !typeId)
        rememberUnresolved(`accessories.${id}.typeId`, raw.typeId, `Accessory ${index + 1} type`);
      if (typeId) unresolvedByPath.delete(`accessories.${id}.typeId`);
      return [
        {
          id,
          typeId,
          surface: cleanSurface(raw.surface),
          offsetFt: finiteNonnegative(raw.offsetFt),
          secondaryOffsetFt: finiteNonnegative(raw.secondaryOffsetFt),
          elevationFt: finiteNonnegative(raw.elevationFt),
        },
      ];
    });

  for (const path of unresolvedByPath.keys()) {
    const [collection, id] = path.split(".");
    if (collection === "openings" && id && !openingIds.has(id)) unresolvedByPath.delete(path);
    if (collection === "attachments" && id && !attachmentIds.has(id)) unresolvedByPath.delete(path);
    if (collection === "accessories" && id && !accessoryIds.has(id)) unresolvedByPath.delete(path);
  }

  return {
    version: BUILDING_PLANNER_EXTENSION_VERSION,
    useId,
    systemId,
    widthFt: finitePositive(candidate.widthFt),
    lengthFt: finitePositive(candidate.lengthFt),
    eaveHeightFt: finitePositive(candidate.eaveHeightFt),
    roofId,
    roofPitchRise12: finitePositive(candidate.roofPitchRise12),
    roofDetails: {
      singleSlopeHighSide:
        details.singleSlopeHighSide === "left" || details.singleSlopeHighSide === "right"
          ? details.singleSlopeHighSide
          : null,
      monitorWidthFt: finitePositive(details.monitorWidthFt),
      monitorHeightFt: finitePositive(details.monitorHeightFt),
      gambrelBreakInsetFt: finitePositive(details.gambrelBreakInsetFt),
      secondaryPitchRise12: finitePositive(details.secondaryPitchRise12),
      asymmetricalRidgeOffsetFt: finitePositive(details.asymmetricalRidgeOffsetFt),
      hipCenteredEqualPitchAccepted: details.hipCenteredEqualPitchAccepted === true,
    },
    colors: {
      wall: wallColor,
      roof: roofColor,
      trim: trimColor,
    },
    openings,
    attachments,
    accessories,
    unresolvedCatalogItems: Array.from(unresolvedByPath.values()),
    notes: typeof candidate.notes === "string" ? candidate.notes.trim().slice(0, 2000) : "",
  };
}

export function createBuildingPlannerPersistenceEnvelope(
  state: BuildingPlannerExtensionV1
): BuildingPlannerPersistenceEnvelope {
  return {
    schema: BUILDING_PLANNER_EXTENSION_SCHEMA,
    version: BUILDING_PLANNER_EXTENSION_VERSION,
    state: sanitizeBuildingPlannerExtension(state),
  };
}

export function restoreBuildingPlannerPersistenceEnvelope(
  value: unknown
): BuildingPlannerExtensionV1 {
  if (!value || typeof value !== "object") return createEmptyBuildingPlannerExtension();
  const envelope = value as Partial<BuildingPlannerPersistenceEnvelope>;
  if (
    envelope.schema !== BUILDING_PLANNER_EXTENSION_SCHEMA ||
    envelope.version !== BUILDING_PLANNER_EXTENSION_VERSION
  ) {
    return createEmptyBuildingPlannerExtension();
  }
  return sanitizeBuildingPlannerExtension(envelope.state);
}

function addDiagnostic(
  diagnostics: BuildingDiagnostic[],
  code: string,
  severity: BuildingDiagnostic["severity"],
  message: string,
  objectId?: string
) {
  diagnostics.push({ code, severity, message, ...(objectId ? { objectId } : {}) });
}

function wallLength(wall: BuildingWall, widthFt: number, lengthFt: number): number {
  return wall === "front" || wall === "rear" ? widthFt : lengthFt;
}

function buildRoofProfile(state: BuildingPlannerExtensionV1): MeasuredPoint2[] | null {
  const { widthFt, eaveHeightFt, roofId, roofPitchRise12, roofDetails } = state;
  if (!widthFt || !eaveHeightFt || !roofId || !roofPitchRise12) return null;
  const rise = (runFt: number, pitch = roofPitchRise12) => (runFt * pitch) / 12;
  if (roofId === "single-slope") {
    if (!roofDetails.singleSlopeHighSide) return null;
    const high = eaveHeightFt + rise(widthFt);
    return roofDetails.singleSlopeHighSide === "left"
      ? [
          { xFt: 0, heightFt: high },
          { xFt: widthFt, heightFt: eaveHeightFt },
        ]
      : [
          { xFt: 0, heightFt: eaveHeightFt },
          { xFt: widthFt, heightFt: high },
        ];
  }
  if (roofId === "asymmetrical") {
    const ridgeX = roofDetails.asymmetricalRidgeOffsetFt;
    const secondPitch = roofDetails.secondaryPitchRise12;
    if (!ridgeX || !secondPitch || ridgeX >= widthFt) return null;
    const leftRidgeHeight = eaveHeightFt + rise(ridgeX);
    const rightRidgeHeight = eaveHeightFt + rise(widthFt - ridgeX, secondPitch);
    if (Math.abs(leftRidgeHeight - rightRidgeHeight) > 0.05) return null;
    return [
      { xFt: 0, heightFt: eaveHeightFt },
      { xFt: ridgeX, heightFt: (leftRidgeHeight + rightRidgeHeight) / 2 },
      { xFt: widthFt, heightFt: eaveHeightFt },
    ];
  }
  if (roofId === "gambrel") {
    const inset = roofDetails.gambrelBreakInsetFt;
    const upperPitch = roofDetails.secondaryPitchRise12;
    if (!inset || !upperPitch || inset >= widthFt / 2) return null;
    const breakHeight = eaveHeightFt + rise(inset);
    const ridgeHeight = breakHeight + rise(widthFt / 2 - inset, upperPitch);
    return [
      { xFt: 0, heightFt: eaveHeightFt },
      { xFt: inset, heightFt: breakHeight },
      { xFt: widthFt / 2, heightFt: ridgeHeight },
      { xFt: widthFt - inset, heightFt: breakHeight },
      { xFt: widthFt, heightFt: eaveHeightFt },
    ];
  }
  if (roofId === "monitor") {
    const monitorWidth = roofDetails.monitorWidthFt;
    const monitorHeight = roofDetails.monitorHeightFt;
    if (!monitorWidth || !monitorHeight || monitorWidth >= widthFt) return null;
    const left = (widthFt - monitorWidth) / 2;
    const right = left + monitorWidth;
    const shoulder = eaveHeightFt + rise(left);
    const monitorEave = shoulder + monitorHeight;
    return [
      { xFt: 0, heightFt: eaveHeightFt },
      { xFt: left, heightFt: shoulder },
      { xFt: left, heightFt: monitorEave },
      { xFt: widthFt / 2, heightFt: monitorEave + rise(monitorWidth / 2) },
      { xFt: right, heightFt: monitorEave },
      { xFt: right, heightFt: shoulder },
      { xFt: widthFt, heightFt: eaveHeightFt },
    ];
  }
  return [
    { xFt: 0, heightFt: eaveHeightFt },
    { xFt: widthFt / 2, heightFt: eaveHeightFt + rise(widthFt / 2) },
    { xFt: widthFt, heightFt: eaveHeightFt },
  ];
}

function profileHeightAt(profile: MeasuredPoint2[], xFt: number): number {
  const x = Math.max(profile[0]?.xFt ?? 0, Math.min(profile.at(-1)?.xFt ?? 0, xFt));
  for (let index = 1; index < profile.length; index += 1) {
    const left = profile[index - 1];
    const right = profile[index];
    if (x <= right.xFt) {
      if (right.xFt === left.xFt) return Math.max(left.heightFt, right.heightFt);
      const amount = (x - left.xFt) / (right.xFt - left.xFt);
      return left.heightFt + (right.heightFt - left.heightFt) * amount;
    }
  }
  return profile.at(-1)?.heightFt ?? 0;
}

function buildRoofSurfaces(
  state: BuildingPlannerExtensionV1,
  profile: MeasuredPoint2[]
): MeasuredRoofSurface[] {
  const width = state.widthFt!;
  const length = state.lengthFt!;
  if (state.roofId === "hip") {
    const eave = state.eaveHeightFt!;
    const ridgeHeight = profileHeightAt(profile, width / 2);
    const ridgeInset = Math.min(length / 2, width / 2);
    const frontRidge = ridgeInset;
    const rearRidge = length - ridgeInset;
    return [
      {
        id: "hip-left",
        vertices: [
          { xFt: 0, yFt: eave, zFt: 0 },
          { xFt: width / 2, yFt: ridgeHeight, zFt: frontRidge },
          { xFt: width / 2, yFt: ridgeHeight, zFt: rearRidge },
          { xFt: 0, yFt: eave, zFt: length },
        ],
      },
      {
        id: "hip-right",
        vertices: [
          { xFt: width, yFt: eave, zFt: 0 },
          { xFt: width, yFt: eave, zFt: length },
          { xFt: width / 2, yFt: ridgeHeight, zFt: rearRidge },
          { xFt: width / 2, yFt: ridgeHeight, zFt: frontRidge },
        ],
      },
      {
        id: "hip-front",
        vertices: [
          { xFt: 0, yFt: eave, zFt: 0 },
          { xFt: width, yFt: eave, zFt: 0 },
          { xFt: width / 2, yFt: ridgeHeight, zFt: frontRidge },
        ],
      },
      {
        id: "hip-rear",
        vertices: [
          { xFt: 0, yFt: eave, zFt: length },
          { xFt: width / 2, yFt: ridgeHeight, zFt: rearRidge },
          { xFt: width, yFt: eave, zFt: length },
        ],
      },
    ];
  }

  const surfaces: MeasuredRoofSurface[] = [];
  for (let index = 1; index < profile.length; index += 1) {
    const left = profile[index - 1];
    const right = profile[index];
    if (left.xFt === right.xFt) continue;
    surfaces.push({
      id: `roof-plane-${index}`,
      vertices: [
        { xFt: left.xFt, yFt: left.heightFt, zFt: 0 },
        { xFt: right.xFt, yFt: right.heightFt, zFt: 0 },
        { xFt: right.xFt, yFt: right.heightFt, zFt: length },
        { xFt: left.xFt, yFt: left.heightFt, zFt: length },
      ],
    });
  }
  return surfaces;
}

export function getSceneWallRoofHeight(
  scene: BuildingMeasuredScene,
  wall: BuildingWall,
  offsetFt: number
): number | null {
  if (!scene.shell) return null;
  const { widthFt, lengthFt, eaveHeightFt, roofId, roofPitchRise12, roofProfile } = scene.shell;
  if (wall === "front") return profileHeightAt(roofProfile, offsetFt);
  if (wall === "rear") return profileHeightAt(roofProfile, widthFt - offsetFt);
  if (roofId === "hip") {
    const run = Math.min(Math.max(0, offsetFt), Math.max(0, lengthFt - offsetFt), widthFt / 2);
    return eaveHeightFt + (run * roofPitchRise12) / 12;
  }
  return profileHeightAt(roofProfile, wall === "left" ? 0 : widthFt);
}

export function getSceneRoofHeightAtPoint(
  scene: BuildingMeasuredScene,
  xFt: number,
  zFt: number
): number | null {
  if (!scene.shell) return null;
  const heights: number[] = [];
  for (const surface of scene.shell.roofSurfaces) {
    for (let index = 1; index < surface.vertices.length - 1; index += 1) {
      const [a, b, c] = [surface.vertices[0], surface.vertices[index], surface.vertices[index + 1]];
      const denominator = (b.zFt - c.zFt) * (a.xFt - c.xFt) + (c.xFt - b.xFt) * (a.zFt - c.zFt);
      if (Math.abs(denominator) < 1e-8) continue;
      const weightA =
        ((b.zFt - c.zFt) * (xFt - c.xFt) + (c.xFt - b.xFt) * (zFt - c.zFt)) / denominator;
      const weightB =
        ((c.zFt - a.zFt) * (xFt - c.xFt) + (a.xFt - c.xFt) * (zFt - c.zFt)) / denominator;
      const weightC = 1 - weightA - weightB;
      if (weightA >= -1e-6 && weightB >= -1e-6 && weightC >= -1e-6) {
        heights.push(weightA * a.yFt + weightB * b.yFt + weightC * c.yFt);
      }
    }
  }
  return heights.length > 0 ? Math.max(...heights) : null;
}

function openingRect(opening: BuildingOpeningPlacement) {
  return {
    left: opening.offsetFt!,
    right: opening.offsetFt! + opening.widthFt!,
    bottom: opening.sillHeightFt!,
    top: opening.sillHeightFt! + opening.heightFt!,
  };
}

function rectanglesOverlap(a: ReturnType<typeof openingRect>, b: ReturnType<typeof openingRect>) {
  return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

function attachmentFootprint(
  attachment: BuildingAttachmentPlacement,
  widthFt: number,
  lengthFt: number
): MeasuredPoint3[] {
  const start = attachment.offsetFt!;
  const end = start + attachment.widthFt!;
  const projection = attachment.projectionFt!;
  if (attachment.wall === "front") {
    return [
      { xFt: start, yFt: 0, zFt: 0 },
      { xFt: end, yFt: 0, zFt: 0 },
      { xFt: end, yFt: 0, zFt: -projection },
      { xFt: start, yFt: 0, zFt: -projection },
    ];
  }
  if (attachment.wall === "rear") {
    const physicalStart = widthFt - end;
    const physicalEnd = widthFt - start;
    return [
      { xFt: physicalStart, yFt: 0, zFt: lengthFt },
      { xFt: physicalStart, yFt: 0, zFt: lengthFt + projection },
      { xFt: physicalEnd, yFt: 0, zFt: lengthFt + projection },
      { xFt: physicalEnd, yFt: 0, zFt: lengthFt },
    ];
  }
  if (attachment.wall === "left") {
    return [
      { xFt: 0, yFt: 0, zFt: start },
      { xFt: -projection, yFt: 0, zFt: start },
      { xFt: -projection, yFt: 0, zFt: end },
      { xFt: 0, yFt: 0, zFt: end },
    ];
  }
  const physicalStart = lengthFt - end;
  const physicalEnd = lengthFt - start;
  return [
    { xFt: widthFt, yFt: 0, zFt: physicalStart },
    { xFt: widthFt, yFt: 0, zFt: physicalEnd },
    { xFt: widthFt + projection, yFt: 0, zFt: physicalEnd },
    { xFt: widthFt + projection, yFt: 0, zFt: physicalStart },
  ];
}

function attachmentRoofSurface(
  attachment: BuildingAttachmentPlacement,
  footprint: MeasuredPoint3[]
): MeasuredPoint3[] | null {
  if (
    !attachment.wall ||
    !attachment.eaveHeightFt ||
    !attachment.roofPitchRise12 ||
    !attachment.projectionFt
  ) {
    return null;
  }
  const connectionHeight =
    attachment.eaveHeightFt + (attachment.projectionFt * attachment.roofPitchRise12) / 12;
  const isHostPoint = (point: MeasuredPoint3) => {
    if (attachment.wall === "front") return point.zFt === 0;
    if (attachment.wall === "rear")
      return point.zFt > 0 && point.zFt !== Math.max(...footprint.map((item) => item.zFt));
    if (attachment.wall === "left") return point.xFt === 0;
    return point.xFt > 0 && point.xFt !== Math.max(...footprint.map((item) => item.xFt));
  };
  return footprint.map((point) => ({
    ...point,
    yFt: isHostPoint(point) ? connectionHeight : attachment.eaveHeightFt!,
  }));
}

function stableFingerprint(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `building-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildBuildingMeasuredScene(
  input: BuildingPlannerExtensionV1
): BuildingMeasuredScene {
  const state = sanitizeBuildingPlannerExtension(input);
  const diagnostics: BuildingDiagnostic[] = [];
  for (const unresolved of state.unresolvedCatalogItems) {
    addDiagnostic(
      diagnostics,
      "catalog-reference-unresolved",
      "blocker",
      `${unresolved.label} “${unresolved.savedId}” is no longer in the current catalog. Remove it or choose a current replacement.`,
      unresolved.path
    );
  }
  if (!state.useId)
    addDiagnostic(diagnostics, "use-required", "blocker", "Choose the building use.");
  if (!state.systemId)
    addDiagnostic(
      diagnostics,
      "system-required",
      "blocker",
      "Choose a structural system to evaluate."
    );
  if (!state.widthFt)
    addDiagnostic(diagnostics, "width-required", "blocker", "Enter the measured planning width.");
  if (!state.lengthFt)
    addDiagnostic(diagnostics, "length-required", "blocker", "Enter the measured planning length.");
  if (!state.eaveHeightFt)
    addDiagnostic(
      diagnostics,
      "eave-height-required",
      "blocker",
      "Enter the measured eave height."
    );
  if (!state.roofId)
    addDiagnostic(diagnostics, "roof-required", "blocker", "Choose a roof family.");
  if (!state.roofPitchRise12)
    addDiagnostic(
      diagnostics,
      "roof-pitch-required",
      "blocker",
      "Enter roof rise per 12 inches of run."
    );

  if (state.widthFt && state.widthFt < 8)
    addDiagnostic(
      diagnostics,
      "width-invalid",
      "blocker",
      "Width must be at least 8 ft for this planner."
    );
  if (state.lengthFt && state.lengthFt < 8)
    addDiagnostic(
      diagnostics,
      "length-invalid",
      "blocker",
      "Length must be at least 8 ft for this planner."
    );
  if (state.eaveHeightFt && state.eaveHeightFt < 6)
    addDiagnostic(
      diagnostics,
      "eave-height-invalid",
      "blocker",
      "Eave height must be at least 6 ft."
    );
  if (state.roofPitchRise12 && state.roofPitchRise12 > 12)
    addDiagnostic(
      diagnostics,
      "roof-pitch-invalid",
      "blocker",
      "Roof pitch cannot exceed 12:12 in this planner."
    );

  const system = getBuildingSystem(state.systemId);
  if (system && state.roofId && !isRoofSupportedBySystem(system.id, state.roofId)) {
    addDiagnostic(
      diagnostics,
      "roof-system-incompatible",
      "blocker",
      `${getBuildingRoof(state.roofId)?.label ?? "This roof"} is not in the published planning set for ${system.label}. Choose another combination or request custom review.`
    );
  }
  if (system && state.widthFt) {
    const { min, max, meaning, note } = system.widthRange;
    if ((min && state.widthFt < min) || (max && state.widthFt > max)) {
      addDiagnostic(
        diagnostics,
        "width-outside-published-range",
        meaning === "published" ? "warning" : "review",
        note
      );
    }
  }
  if (system?.eaveHeightRange && state.eaveHeightFt) {
    const { min, max, note } = system.eaveHeightRange;
    if ((min && state.eaveHeightFt < min) || (max && state.eaveHeightFt > max)) {
      addDiagnostic(diagnostics, "height-outside-published-range", "warning", note);
    }
  }

  if (state.roofId === "single-slope" && !state.roofDetails.singleSlopeHighSide) {
    addDiagnostic(
      diagnostics,
      "single-slope-side-required",
      "blocker",
      "Choose the single-slope high side."
    );
  }
  if (state.roofId === "monitor") {
    if (!state.roofDetails.monitorWidthFt)
      addDiagnostic(diagnostics, "monitor-width-required", "blocker", "Enter the monitor width.");
    if (!state.roofDetails.monitorHeightFt)
      addDiagnostic(diagnostics, "monitor-height-required", "blocker", "Enter the monitor rise.");
    if (
      state.widthFt &&
      state.roofDetails.monitorWidthFt &&
      state.roofDetails.monitorWidthFt >= state.widthFt
    ) {
      addDiagnostic(
        diagnostics,
        "monitor-width-invalid",
        "blocker",
        "Monitor width must be less than shell width."
      );
    }
  }
  if (state.roofId === "gambrel") {
    if (!state.roofDetails.gambrelBreakInsetFt)
      addDiagnostic(
        diagnostics,
        "gambrel-break-required",
        "blocker",
        "Enter the gambrel break inset."
      );
    if (!state.roofDetails.secondaryPitchRise12)
      addDiagnostic(
        diagnostics,
        "gambrel-upper-pitch-required",
        "blocker",
        "Enter the gambrel upper pitch."
      );
    if (
      state.widthFt &&
      state.roofDetails.gambrelBreakInsetFt &&
      state.roofDetails.gambrelBreakInsetFt >= state.widthFt / 2
    ) {
      addDiagnostic(
        diagnostics,
        "gambrel-break-invalid",
        "blocker",
        "Gambrel break inset must be less than half the shell width."
      );
    }
  }
  if (state.roofId === "asymmetrical") {
    if (!state.roofDetails.asymmetricalRidgeOffsetFt)
      addDiagnostic(
        diagnostics,
        "asymmetrical-ridge-required",
        "blocker",
        "Enter the ridge offset from the left wall."
      );
    if (!state.roofDetails.secondaryPitchRise12)
      addDiagnostic(
        diagnostics,
        "asymmetrical-pitch-required",
        "blocker",
        "Enter the right roof-plane pitch."
      );
    if (
      state.widthFt &&
      state.roofDetails.asymmetricalRidgeOffsetFt &&
      state.roofDetails.asymmetricalRidgeOffsetFt >= state.widthFt
    ) {
      addDiagnostic(
        diagnostics,
        "asymmetrical-ridge-invalid",
        "blocker",
        "Ridge offset must lie inside the shell width."
      );
    }
    if (
      state.widthFt &&
      state.roofPitchRise12 &&
      state.roofDetails.asymmetricalRidgeOffsetFt &&
      state.roofDetails.secondaryPitchRise12
    ) {
      const leftRise = (state.roofDetails.asymmetricalRidgeOffsetFt * state.roofPitchRise12) / 12;
      const rightRise =
        ((state.widthFt - state.roofDetails.asymmetricalRidgeOffsetFt) *
          state.roofDetails.secondaryPitchRise12) /
        12;
      if (Math.abs(leftRise - rightRise) > 0.05) {
        addDiagnostic(
          diagnostics,
          "asymmetrical-planes-disconnected",
          "blocker",
          "The two entered roof pitches do not meet at one ridge height. Adjust the ridge offset or second pitch."
        );
      }
    }
  }
  if (state.roofId === "hip" && !state.roofDetails.hipCenteredEqualPitchAccepted) {
    addDiagnostic(
      diagnostics,
      "hip-assumption-required",
      "blocker",
      "Confirm the centered, equal-pitch hip planning assumption or choose another roof."
    );
  }

  const profile = buildRoofProfile(state);
  const shellReady = Boolean(
    state.widthFt &&
    state.lengthFt &&
    state.eaveHeightFt &&
    state.roofId &&
    state.roofPitchRise12 &&
    profile &&
    !diagnostics.some((diagnostic) =>
      [
        "width-invalid",
        "length-invalid",
        "eave-height-invalid",
        "roof-pitch-invalid",
        "single-slope-side-required",
        "monitor-width-required",
        "monitor-height-required",
        "monitor-width-invalid",
        "gambrel-break-required",
        "gambrel-upper-pitch-required",
        "gambrel-break-invalid",
        "asymmetrical-ridge-required",
        "asymmetrical-pitch-required",
        "asymmetrical-ridge-invalid",
        "asymmetrical-planes-disconnected",
        "hip-assumption-required",
      ].includes(diagnostic.code)
    )
  );

  const shell = shellReady
    ? {
        widthFt: state.widthFt!,
        lengthFt: state.lengthFt!,
        eaveHeightFt: state.eaveHeightFt!,
        roofId: state.roofId!,
        roofPitchRise12: state.roofPitchRise12!,
        roofProfile: profile!,
        roofSurfaces: buildRoofSurfaces(state, profile!),
        wallColorHex: getBuildingColor(state.colors.wall)?.hex ?? null,
        roofColorHex: getBuildingColor(state.colors.roof)?.hex ?? null,
        trimColorHex: getBuildingColor(state.colors.trim)?.hex ?? null,
      }
    : null;

  const measuredOpenings: MeasuredBuildingOpening[] = [];
  for (const opening of state.openings) {
    const catalog = getBuildingOpening(opening.typeId);
    if (!catalog) {
      addDiagnostic(
        diagnostics,
        "opening-type-required",
        "blocker",
        "Choose an opening type.",
        opening.id
      );
      continue;
    }
    if (!opening.surface) {
      addDiagnostic(
        diagnostics,
        "opening-surface-required",
        "blocker",
        "Choose the opening surface.",
        opening.id
      );
      continue;
    }
    if (!catalog.surfaces.includes(opening.surface)) {
      addDiagnostic(
        diagnostics,
        "opening-surface-incompatible",
        "blocker",
        `${catalog.label} cannot be placed on the selected surface.`,
        opening.id
      );
      continue;
    }
    if (!opening.widthFt || !opening.heightFt) {
      addDiagnostic(
        diagnostics,
        "opening-size-required",
        "blocker",
        "Enter opening width and height.",
        opening.id
      );
      continue;
    }
    if (opening.surface === "roof") {
      if (opening.roofXFt === null || opening.roofZFt === null) {
        addDiagnostic(
          diagnostics,
          "roof-opening-position-required",
          "blocker",
          "Enter roof X and Z coordinates.",
          opening.id
        );
        continue;
      }
      if (
        shell &&
        (opening.roofXFt < 0 ||
          opening.roofZFt < 0 ||
          opening.roofXFt + opening.widthFt > shell.widthFt ||
          opening.roofZFt + opening.heightFt > shell.lengthFt)
      ) {
        addDiagnostic(
          diagnostics,
          "roof-opening-outside-shell",
          "blocker",
          "The roof opening crosses the roof-plan boundary.",
          opening.id
        );
        continue;
      }
      measuredOpenings.push({ ...opening, typeId: catalog.id, surface: "roof" });
      continue;
    }
    if (opening.offsetFt === null || opening.sillHeightFt === null) {
      addDiagnostic(
        diagnostics,
        "wall-opening-position-required",
        "blocker",
        "Enter wall offset and sill height.",
        opening.id
      );
      continue;
    }
    if (shell) {
      const span = wallLength(opening.surface, shell.widthFt, shell.lengthFt);
      const cornerClearance = 0.5;
      if (
        opening.offsetFt < cornerClearance ||
        opening.offsetFt + opening.widthFt > span - cornerClearance
      ) {
        addDiagnostic(
          diagnostics,
          "wall-opening-outside-shell",
          "blocker",
          `The opening must stay at least ${cornerClearance} ft from both wall corners.`,
          opening.id
        );
        continue;
      }
      const leftHeight = getSceneWallRoofHeight(
        {
          ready: true,
          requestReady: false,
          fingerprint: "",
          shell,
          openings: [],
          attachments: [],
          accessories: [],
          diagnostics: [],
        },
        opening.surface,
        opening.offsetFt
      );
      const rightHeight = getSceneWallRoofHeight(
        {
          ready: true,
          requestReady: false,
          fingerprint: "",
          shell,
          openings: [],
          attachments: [],
          accessories: [],
          diagnostics: [],
        },
        opening.surface,
        opening.offsetFt + opening.widthFt
      );
      if (
        leftHeight !== null &&
        rightHeight !== null &&
        opening.sillHeightFt + opening.heightFt > Math.min(leftHeight, rightHeight) - 0.25
      ) {
        addDiagnostic(
          diagnostics,
          "wall-opening-above-roof",
          "blocker",
          "The opening extends above the roof line or required top clearance.",
          opening.id
        );
        continue;
      }
    }
    measuredOpenings.push({ ...opening, typeId: catalog.id, surface: opening.surface });
  }

  for (let leftIndex = 0; leftIndex < measuredOpenings.length; leftIndex += 1) {
    const left = measuredOpenings[leftIndex];
    if (left.surface === "roof") continue;
    for (let rightIndex = leftIndex + 1; rightIndex < measuredOpenings.length; rightIndex += 1) {
      const right = measuredOpenings[rightIndex];
      if (right.surface !== left.surface) continue;
      if (rectanglesOverlap(openingRect(left), openingRect(right))) {
        addDiagnostic(
          diagnostics,
          "wall-openings-overlap",
          "blocker",
          "Two openings overlap on the same wall.",
          right.id
        );
      }
    }
  }

  const measuredAttachments: MeasuredBuildingAttachment[] = [];
  for (const attachment of state.attachments) {
    const catalog = getBuildingAttachment(attachment.typeId);
    if (!catalog) {
      addDiagnostic(
        diagnostics,
        "attachment-type-required",
        "blocker",
        "Choose an attachment type.",
        attachment.id
      );
      continue;
    }
    if (
      !attachment.wall ||
      attachment.offsetFt === null ||
      !attachment.widthFt ||
      !attachment.projectionFt
    ) {
      addDiagnostic(
        diagnostics,
        "attachment-footprint-required",
        "blocker",
        "Choose a wall and enter attachment offset, width, and projection.",
        attachment.id
      );
      continue;
    }
    if (shell) {
      const span = wallLength(attachment.wall, shell.widthFt, shell.lengthFt);
      if (attachment.offsetFt < 0 || attachment.offsetFt + attachment.widthFt > span) {
        addDiagnostic(
          diagnostics,
          "attachment-outside-wall",
          "blocker",
          "The attachment footprint extends beyond its host wall.",
          attachment.id
        );
        continue;
      }
      const verticalResolved =
        !catalog.requiresVerticalGeometry ||
        Boolean(attachment.eaveHeightFt && attachment.roofPitchRise12);
      if (!verticalResolved) {
        addDiagnostic(
          diagnostics,
          "attachment-vertical-unresolved",
          "review",
          "Footprint only — height and roof connection unresolved.",
          attachment.id
        );
      }
      if (verticalResolved && attachment.roofPitchRise12 && attachment.roofPitchRise12 > 12) {
        addDiagnostic(
          diagnostics,
          "attachment-pitch-invalid",
          "blocker",
          "Attachment roof pitch cannot exceed 12:12 in this planner.",
          attachment.id
        );
        continue;
      }
      if (
        verticalResolved &&
        attachment.eaveHeightFt &&
        attachment.roofPitchRise12 &&
        attachment.projectionFt
      ) {
        const connectionHeight =
          attachment.eaveHeightFt + (attachment.projectionFt * attachment.roofPitchRise12) / 12;
        const leftHostHeight = getSceneWallRoofHeight(
          {
            ready: true,
            requestReady: false,
            fingerprint: "",
            shell,
            openings: [],
            attachments: [],
            accessories: [],
            diagnostics: [],
          },
          attachment.wall,
          attachment.offsetFt
        );
        const rightHostHeight = getSceneWallRoofHeight(
          {
            ready: true,
            requestReady: false,
            fingerprint: "",
            shell,
            openings: [],
            attachments: [],
            accessories: [],
            diagnostics: [],
          },
          attachment.wall,
          attachment.offsetFt + attachment.widthFt
        );
        if (
          leftHostHeight !== null &&
          rightHostHeight !== null &&
          connectionHeight > Math.min(leftHostHeight, rightHostHeight) - 0.25
        ) {
          addDiagnostic(
            diagnostics,
            "attachment-connection-above-roof",
            "blocker",
            "The entered attachment eave and pitch place its connection above the host roof line.",
            attachment.id
          );
          continue;
        }
      }
      const footprint = attachmentFootprint(attachment, shell.widthFt, shell.lengthFt);
      measuredAttachments.push({
        ...attachment,
        typeId: catalog.id,
        wall: attachment.wall,
        footprint,
        verticalResolved,
        roofSurface: verticalResolved ? attachmentRoofSurface(attachment, footprint) : null,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < measuredAttachments.length; leftIndex += 1) {
    const left = measuredAttachments[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < measuredAttachments.length; rightIndex += 1) {
      const right = measuredAttachments[rightIndex];
      if (left.wall !== right.wall) continue;
      const leftEnd = left.offsetFt! + left.widthFt!;
      const rightEnd = right.offsetFt! + right.widthFt!;
      if (left.offsetFt! < rightEnd && leftEnd > right.offsetFt!) {
        addDiagnostic(
          diagnostics,
          "attachments-overlap",
          "blocker",
          "Two attachment footprints overlap along the same host wall.",
          right.id
        );
      }
    }
  }

  const measuredAccessories: MeasuredBuildingAccessory[] = [];
  for (const accessory of state.accessories) {
    const catalog = getBuildingAccessory(accessory.typeId);
    if (!catalog) {
      addDiagnostic(
        diagnostics,
        "accessory-type-required",
        "blocker",
        "Choose an accessory type.",
        accessory.id
      );
      continue;
    }
    const expectedSurface = catalog.placement;
    const placementMatches =
      accessory.surface &&
      (expectedSurface === "whole-building"
        ? accessory.surface === "whole-building"
        : expectedSurface === "roof"
          ? accessory.surface === "roof"
          : cleanWall(accessory.surface) !== null);
    if (!placementMatches) {
      addDiagnostic(
        diagnostics,
        "accessory-placement-required",
        "blocker",
        `Choose a valid ${expectedSurface.replace("-", " ")} placement for ${catalog.label}.`,
        accessory.id
      );
      continue;
    }
    if (expectedSurface !== "whole-building" && accessory.offsetFt === null) {
      addDiagnostic(
        diagnostics,
        "accessory-offset-required",
        "blocker",
        "Enter the accessory placement offset.",
        accessory.id
      );
      continue;
    }
    if (expectedSurface === "roof" && accessory.secondaryOffsetFt === null) {
      addDiagnostic(
        diagnostics,
        "roof-accessory-z-required",
        "blocker",
        "Enter the roof accessory Z coordinate from the front wall.",
        accessory.id
      );
      continue;
    }
    if (expectedSurface === "wall" && accessory.elevationFt === null) {
      addDiagnostic(
        diagnostics,
        "wall-accessory-height-required",
        "blocker",
        "Enter the wall accessory height above the floor.",
        accessory.id
      );
      continue;
    }
    if (shell && expectedSurface === "roof") {
      if (
        accessory.offsetFt! < 0 ||
        accessory.offsetFt! > shell.widthFt ||
        accessory.secondaryOffsetFt! < 0 ||
        accessory.secondaryOffsetFt! > shell.lengthFt ||
        getSceneRoofHeightAtPoint(
          {
            ready: true,
            requestReady: false,
            fingerprint: "",
            shell,
            openings: [],
            attachments: [],
            accessories: [],
            diagnostics: [],
          },
          accessory.offsetFt!,
          accessory.secondaryOffsetFt!
        ) === null
      ) {
        addDiagnostic(
          diagnostics,
          "roof-accessory-outside-shell",
          "blocker",
          "The roof accessory marker lies outside the measured roof.",
          accessory.id
        );
        continue;
      }
    }
    if (shell && expectedSurface === "wall") {
      const wall = cleanWall(accessory.surface)!;
      const span = wallLength(wall, shell.widthFt, shell.lengthFt);
      const roofHeight = getSceneWallRoofHeight(
        {
          ready: true,
          requestReady: false,
          fingerprint: "",
          shell,
          openings: [],
          attachments: [],
          accessories: [],
          diagnostics: [],
        },
        wall,
        accessory.offsetFt!
      );
      if (
        accessory.offsetFt! < 0 ||
        accessory.offsetFt! > span ||
        roofHeight === null ||
        accessory.elevationFt! > roofHeight
      ) {
        addDiagnostic(
          diagnostics,
          "wall-accessory-outside-shell",
          "blocker",
          "The wall accessory marker lies outside the measured elevation.",
          accessory.id
        );
        continue;
      }
    }
    measuredAccessories.push({
      ...accessory,
      typeId: catalog.id,
      surface: accessory.surface!,
    });
  }

  if (!state.colors.wall || !state.colors.roof || !state.colors.trim) {
    addDiagnostic(
      diagnostics,
      "colors-unselected",
      "review",
      "Finish colors are not selected; exact profiles, coatings, and availability remain quote-required."
    );
  }
  addDiagnostic(
    diagnostics,
    "professional-review-required",
    "review",
    "Planning geometry only. Field conditions, foundation, framing, local code, wind, snow, seismic loads, supplier availability, and engineering require professional review."
  );

  const fingerprint = stableFingerprint({
    shell,
    openings: measuredOpenings,
    attachments: measuredAttachments,
    accessories: measuredAccessories,
  });
  const blocker = diagnostics.some((diagnostic) => diagnostic.severity === "blocker");
  return {
    ready: shell !== null,
    requestReady: shell !== null && !blocker,
    fingerprint,
    shell,
    openings: measuredOpenings,
    attachments: measuredAttachments,
    accessories: measuredAccessories,
    diagnostics,
  };
}

export function getBuildingPlannerRequestReadiness(
  input: BuildingPlannerExtensionV1
): BuildingPlannerRequestReadiness {
  const scene = buildBuildingMeasuredScene(input);
  return {
    requestReady: scene.requestReady,
    sceneFingerprint: scene.fingerprint,
    blockers: scene.diagnostics.filter((diagnostic) => diagnostic.severity === "blocker"),
    reviewItems: scene.diagnostics.filter((diagnostic) => diagnostic.severity !== "blocker"),
  };
}

const LEGACY_USE_MAP: Record<NonNullable<BuildingUseId>, SteelHomeBuildingDesign["use"]> = {
  barndominium: "home-shell",
  "home-with-shop": "home-and-shop",
  "garage-workshop": "garage-or-workshop",
  agricultural: "other",
  "commercial-industrial": "other",
  arena: "other",
  hangar: "other",
  "mini-storage": "other",
  greenhouse: "other",
  "community-recreation": "other",
  "special-use": "other",
};

const LEGACY_COLOR_MAP: Record<BuildingColorId, SteelHomeBuildingDesign["wallColor"]> = {
  "polar-white": "warm-white",
  sandstone: "sand",
  sage: "sage",
  charcoal: "slate",
  bronze: "bronze",
  black: "black",
  "rustic-red": "bronze",
  "gallery-blue": "slate",
};

/**
 * Explicit migration only. Callers must opt in because legacy drafts contain
 * historical defaults that must never become unchosen planner selections.
 */
export function createBuildingPlannerExtensionFromLegacy(
  legacy: SteelHomeBuildingDesign,
  options?: { treatLegacyValuesAsExplicit?: boolean }
): BuildingPlannerExtensionV1 {
  if (options?.treatLegacyValuesAsExplicit !== true) return createEmptyBuildingPlannerExtension();
  const useMap: Record<SteelHomeBuildingDesign["use"], BuildingUseId> = {
    "home-shell": "barndominium",
    "home-and-shop": "home-with-shop",
    "garage-or-workshop": "garage-workshop",
    other: "special-use",
  };
  const colorMap: Record<SteelHomeBuildingDesign["wallColor"], BuildingColorId> = {
    "warm-white": "polar-white",
    sand: "sandstone",
    sage: "sage",
    slate: "charcoal",
    bronze: "bronze",
    black: "black",
  };
  const roofMap: Record<SteelHomeBuildingDesign["roofStyle"], BuildingRoofId> = {
    gable: "gable",
    "single-slope": "single-slope",
    monitor: "monitor",
  };
  return {
    ...createEmptyBuildingPlannerExtension(),
    useId: useMap[legacy.use],
    widthFt: legacy.widthFt,
    lengthFt: legacy.lengthFt,
    eaveHeightFt: legacy.eaveHeightFt,
    roofId: roofMap[legacy.roofStyle],
    roofPitchRise12: Number.parseFloat(legacy.roofPitch),
    colors: {
      wall: colorMap[legacy.wallColor],
      roof: colorMap[legacy.roofColor],
      trim: colorMap[legacy.trimColor],
    },
    notes: legacy.notes,
  };
}

export function projectBuildingExtensionToLegacy(
  input: BuildingPlannerExtensionV1,
  fallback: SteelHomeBuildingDesign
): SteelHomeBuildingDesign {
  const state = sanitizeBuildingPlannerExtension(input);
  const pitchOptions: SteelHomeBuildingDesign["roofPitch"][] = [
    "2:12",
    "3:12",
    "4:12",
    "5:12",
    "6:12",
  ];
  const exactPitch = state.roofPitchRise12 ? `${state.roofPitchRise12}:12` : "";
  const roofStyle: SteelHomeBuildingDesign["roofStyle"] =
    state.roofId === "single-slope" || state.roofId === "monitor"
      ? state.roofId
      : state.roofId === "gable"
        ? "gable"
        : fallback.roofStyle;
  const firstPorch = state.attachments.find((attachment) => attachment.typeId === "porch");
  return {
    ...fallback,
    included: true,
    use: state.useId ? LEGACY_USE_MAP[state.useId] : fallback.use,
    widthFt: state.widthFt ?? fallback.widthFt,
    lengthFt: state.lengthFt ?? fallback.lengthFt,
    eaveHeightFt: state.eaveHeightFt ?? fallback.eaveHeightFt,
    roofStyle,
    roofPitch: pitchOptions.includes(exactPitch as SteelHomeBuildingDesign["roofPitch"])
      ? (exactPitch as SteelHomeBuildingDesign["roofPitch"])
      : fallback.roofPitch,
    wallColor: state.colors.wall ? LEGACY_COLOR_MAP[state.colors.wall] : fallback.wallColor,
    roofColor: state.colors.roof ? LEGACY_COLOR_MAP[state.colors.roof] : fallback.roofColor,
    trimColor: state.colors.trim ? LEGACY_COLOR_MAP[state.colors.trim] : fallback.trimColor,
    garageDoors: state.openings.filter((opening) =>
      [
        "overhead-door",
        "roll-up-door",
        "sliding-door",
        "hangar-bifold",
        "hangar-hydraulic",
        "hangar-stack",
      ].includes(opening.typeId ?? "")
    ).length,
    walkDoors: state.openings.filter((opening) =>
      ["walk-door", "dutch-door"].includes(opening.typeId ?? "")
    ).length,
    windows: state.openings.filter((opening) => opening.typeId === "window").length,
    porch: firstPorch ? (firstPorch.wall === "front" ? "front" : "side") : "none",
    porchDepthFt: firstPorch?.projectionFt ?? 0,
    notes: state.notes,
  };
}

function formatNumber(value: number | null): string {
  return value === null
    ? "unresolved"
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildBuildingPlannerRequest(
  input: BuildingPlannerExtensionV1
): BuildingPlannerRequest | null {
  const state = sanitizeBuildingPlannerExtension(input);
  const scene = buildBuildingMeasuredScene(state);
  if (!scene.requestReady || !scene.shell) return null;
  return {
    kind: "metal-building-planning-request",
    visibility: "private-project-handoff",
    quoteRequired: true,
    sceneFingerprint: scene.fingerprint,
    use: getBuildingUse(state.useId)?.label ?? "Unresolved",
    structuralSystem: getBuildingSystem(state.systemId)?.label ?? "Unresolved",
    shell: `${formatNumber(state.widthFt)} × ${formatNumber(state.lengthFt)} × ${formatNumber(state.eaveHeightFt)} ft eave`,
    roof: `${getBuildingRoof(state.roofId)?.label ?? "Unresolved"}, ${formatNumber(state.roofPitchRise12)}:12`,
    colors: (["wall", "roof", "trim"] as const).flatMap((key) => {
      const color = getBuildingColor(state.colors[key]);
      return color ? [`${key}: ${color.label}`] : [];
    }),
    openings: scene.openings.map(
      (opening) =>
        `${getBuildingOpening(opening.typeId)?.label ?? opening.typeId}: ${formatNumber(opening.widthFt)} × ${formatNumber(opening.heightFt)} ft on ${opening.surface}`
    ),
    attachments: scene.attachments.map(
      (attachment) =>
        `${getBuildingAttachment(attachment.typeId)?.label ?? attachment.typeId}: ${formatNumber(attachment.widthFt)} × ${formatNumber(attachment.projectionFt)} ft on ${attachment.wall}; ${attachment.verticalResolved ? `eave ${formatNumber(attachment.eaveHeightFt)} ft` : "vertical geometry unresolved"}`
    ),
    accessories: scene.accessories.map((accessory) => {
      const placement =
        accessory.surface === "whole-building"
          ? "whole building"
          : accessory.surface === "roof"
            ? `roof at X ${formatNumber(accessory.offsetFt)} ft, Z ${formatNumber(accessory.secondaryOffsetFt)} ft`
            : `${accessory.surface} at ${formatNumber(accessory.offsetFt)} ft, height ${formatNumber(accessory.elevationFt)} ft`;
      return `${getBuildingAccessory(accessory.typeId)?.label ?? accessory.typeId}: ${placement}`;
    }),
    notes: state.notes,
    qualifications: [
      "Quote required; no product, availability, delivery, installation, or price is promised by this plan.",
      "Dimensions are planning intent pending field verification, engineering, foundation design, and local code review.",
      "Wind, snow, seismic, occupancy, fire, and supplier requirements must be confirmed by qualified professionals.",
    ],
  };
}
