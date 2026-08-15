import { getCatalogItemById } from "@/features/jw-stone/catalog";
import type {
  CountertopCutoutRun,
  CountertopOpeningScheduleItem,
  SteelHomeCountertopDesign,
} from "./projectModel";

/**
 * Measurements the recovered v9 draft never stored. Every value is nullable on purpose: a
 * missing field means "not measured", never a hidden industry default.
 */
export type CountertopPlannerExtension = {
  /**
   * Legacy drafts always contain numeric run values. They are starter values until the user
   * explicitly confirms that the visible run, depth, and enabled-island dimensions were entered
   * or reviewed for this project.
   */
  measurementsReviewed: boolean;
  roomWidthIn: number | null;
  roomDepthIn: number | null;
  roomWallHeightIn: number | null;
  finishedTopHeightIn: number | null;
  topThicknessIn: number | null;
  islandLeftOffsetIn: number | null;
  islandBackOffsetIn: number | null;
  sinkTemplateWidthIn: number | null;
  sinkTemplateDepthIn: number | null;
  cooktopTemplateWidthIn: number | null;
  cooktopTemplateDepthIn: number | null;
};

export type CountertopPlannerDesignInput = SteelHomeCountertopDesign &
  Partial<CountertopPlannerExtension>;

export type CountertopPlannerDesign = SteelHomeCountertopDesign & CountertopPlannerExtension;

export type CountertopPlannerOpeningScheduleItem = CountertopOpeningScheduleItem & {
  representation: "coordination-point" | "template-opening" | "full-depth-gap";
  templateStatus: "not-needed" | "unresolved" | "entered";
};

export type CountertopPlannerDiagnostic = {
  id: string;
  label: string;
  scope: "scene" | "opening";
};

export type CountertopPlannerRequestIntent = "stone" | "fabricator";

export type CountertopPlannerRequestReadiness = {
  ready: boolean;
  problems: string[];
};

export const EMPTY_COUNTERTOP_PLANNER_EXTENSION: Readonly<CountertopPlannerExtension> =
  Object.freeze({
    measurementsReviewed: false,
    roomWidthIn: null,
    roomDepthIn: null,
    roomWallHeightIn: null,
    finishedTopHeightIn: null,
    topThicknessIn: null,
    islandLeftOffsetIn: null,
    islandBackOffsetIn: null,
    sinkTemplateWidthIn: null,
    sinkTemplateDepthIn: null,
    cooktopTemplateWidthIn: null,
    cooktopTemplateDepthIn: null,
  });

export const COUNTERTOP_PLANNER_MEASUREMENTS_SHARE_PARAM = "measure" as const;

const snapToEighth = (value: number) => Number((Math.round(value * 8) / 8).toFixed(3));

function optionalMeasurement(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(minimum, snapToEighth(value)));
}

export function reconcileCountertopPlannerExtension(
  input: Partial<CountertopPlannerExtension> | null | undefined
): CountertopPlannerExtension {
  return {
    measurementsReviewed: input?.measurementsReviewed === true,
    roomWidthIn: optionalMeasurement(input?.roomWidthIn, 24, 1_200),
    roomDepthIn: optionalMeasurement(input?.roomDepthIn, 24, 1_200),
    roomWallHeightIn: optionalMeasurement(input?.roomWallHeightIn, 48, 240),
    finishedTopHeightIn: optionalMeasurement(input?.finishedTopHeightIn, 12, 72),
    topThicknessIn: optionalMeasurement(input?.topThicknessIn, 0.25, 6),
    islandLeftOffsetIn: optionalMeasurement(input?.islandLeftOffsetIn, -600, 1_200),
    islandBackOffsetIn: optionalMeasurement(input?.islandBackOffsetIn, -120, 1_200),
    sinkTemplateWidthIn: optionalMeasurement(input?.sinkTemplateWidthIn, 0.125, 96),
    sinkTemplateDepthIn: optionalMeasurement(input?.sinkTemplateDepthIn, 0.125, 72),
    cooktopTemplateWidthIn: optionalMeasurement(input?.cooktopTemplateWidthIn, 0.125, 96),
    cooktopTemplateDepthIn: optionalMeasurement(input?.cooktopTemplateDepthIn, 0.125, 72),
  };
}

export function resolveCountertopPlannerDesign(
  design: CountertopPlannerDesignInput
): CountertopPlannerDesign {
  return {
    ...design,
    ...reconcileCountertopPlannerExtension(design),
  };
}

export function withCountertopPlannerExtension(
  design: CountertopPlannerDesignInput,
  values: Partial<CountertopPlannerExtension>
): CountertopPlannerDesign {
  return resolveCountertopPlannerDesign({ ...design, ...values });
}

/** Safe to persist or place in a public share snapshot: it contains measurements only. */
export function getCountertopPlannerExtensionSnapshot(
  design: CountertopPlannerDesignInput
): CountertopPlannerExtension {
  return reconcileCountertopPlannerExtension(design);
}

type CountertopPlannerExtensionShareSnapshot = {
  v: 1;
  mr: boolean;
  rw: number | null;
  rd: number | null;
  wh: number | null;
  th: number | null;
  tt: number | null;
  ix: number | null;
  iz: number | null;
  sw: number | null;
  sd: number | null;
  cw: number | null;
  cd: number | null;
};

export function addCountertopPlannerExtensionToShareUrl(
  shareUrl: string,
  design: CountertopPlannerDesignInput
): string {
  const values = getCountertopPlannerExtensionSnapshot(design);
  const snapshot: CountertopPlannerExtensionShareSnapshot = {
    v: 1,
    mr: values.measurementsReviewed,
    rw: values.roomWidthIn,
    rd: values.roomDepthIn,
    wh: values.roomWallHeightIn,
    th: values.finishedTopHeightIn,
    tt: values.topThicknessIn,
    ix: values.islandLeftOffsetIn,
    iz: values.islandBackOffsetIn,
    sw: values.sinkTemplateWidthIn,
    sd: values.sinkTemplateDepthIn,
    cw: values.cooktopTemplateWidthIn,
    cd: values.cooktopTemplateDepthIn,
  };
  const url = new URL(shareUrl, "https://tradescout.local");
  url.searchParams.set(COUNTERTOP_PLANNER_MEASUREMENTS_SHARE_PARAM, JSON.stringify(snapshot));
  return url.toString();
}

export function parseCountertopPlannerExtensionFromShareUrl(
  href: string
): CountertopPlannerExtension | null {
  try {
    const url = new URL(href, "https://tradescout.local");
    const raw = url.searchParams.get(COUNTERTOP_PLANNER_MEASUREMENTS_SHARE_PARAM);
    if (!raw || raw.length > 1_000) return null;
    const value = JSON.parse(raw) as Partial<CountertopPlannerExtensionShareSnapshot>;
    if (!value || typeof value !== "object" || value.v !== 1) return null;
    return reconcileCountertopPlannerExtension({
      measurementsReviewed: value.mr,
      roomWidthIn: value.rw,
      roomDepthIn: value.rd,
      roomWallHeightIn: value.wh,
      finishedTopHeightIn: value.th,
      topThicknessIn: value.tt,
      islandLeftOffsetIn: value.ix,
      islandBackOffsetIn: value.iz,
      sinkTemplateWidthIn: value.sw,
      sinkTemplateDepthIn: value.sd,
      cooktopTemplateWidthIn: value.cw,
      cooktopTemplateDepthIn: value.cd,
    });
  } catch {
    return null;
  }
}

export function hasResolvedCountertopRoomShell(design: CountertopPlannerDesignInput): boolean {
  const plan = resolveCountertopPlannerDesign(design);
  return Boolean(plan.roomWidthIn && plan.roomDepthIn && plan.roomWallHeightIn);
}

export function hasResolvedCountertopIslandPosition(design: CountertopPlannerDesignInput): boolean {
  const plan = resolveCountertopPlannerDesign(design);
  return !plan.island || (plan.islandLeftOffsetIn !== null && plan.islandBackOffsetIn !== null);
}

function completeTemplate(widthIn: number | null, depthIn: number | null) {
  return widthIn !== null && depthIn !== null;
}

const RUN_LABELS: Record<CountertopCutoutRun, string> = {
  main: "Main run",
  "left-return": "Left return",
  "right-return": "Right return",
  island: "Island",
};

function plannerRunLength(design: CountertopPlannerDesign, run: CountertopCutoutRun): number {
  if (run === "main") return design.wallAIn;
  if (run === "left-return") return design.wallBIn;
  if (run === "right-return") return design.wallCIn;
  return design.islandLengthIn;
}

function plannerRunDepth(design: CountertopPlannerDesign, run: CountertopCutoutRun): number {
  return run === "island" ? design.islandWidthIn : design.wallDepthIn;
}

function plannerRunLabel(run: CountertopCutoutRun | ""): string {
  return run ? RUN_LABELS[run] : "Placement needed";
}

/**
 * The base v9 model assigned made-up fixture sizes. This schedule only cuts geometry when a
 * manufacturer/template width and depth were actually entered. A range gap is the one exception:
 * its selected nominal width and the full saved run depth define the planning gap.
 */
export function getCountertopPlannerOpeningSchedule(
  designInput: CountertopPlannerDesignInput
): CountertopPlannerOpeningScheduleItem[] {
  const design = resolveCountertopPlannerDesign(designInput);
  const items: CountertopPlannerOpeningScheduleItem[] = [];

  if (design.sink !== "None") {
    const isApronFront = design.sink === "Farmhouse";
    const hasTemplate = completeTemplate(design.sinkTemplateWidthIn, design.sinkTemplateDepthIn);
    items.push({
      id: "sink",
      label: isApronFront ? "Sink — Farmhouse / apron-front" : `Sink — ${design.sink}`,
      placementKind: isApronFront ? "front-edge-opening" : "cutout",
      run: design.sinkRun,
      positionIn: design.sinkPositionIn,
      frontPositionIn: isApronFront ? null : design.sinkFrontPositionIn,
      requiresFrontPosition: !isApronFront,
      widthIn: hasTemplate ? design.sinkTemplateWidthIn : null,
      depthIn: hasTemplate ? design.sinkTemplateDepthIn : null,
      planningWidthIn: hasTemplate ? (design.sinkTemplateWidthIn ?? 2) : 2,
      representation: hasTemplate ? "template-opening" : "coordination-point",
      templateStatus: hasTemplate ? "entered" : "unresolved",
    });
  }

  if (design.cooktop !== "None") {
    const isRangeGap = /range gap/i.test(design.cooktop);
    const nominalWidth = Number.parseInt(design.cooktop, 10);
    const hasTemplate = completeTemplate(
      design.cooktopTemplateWidthIn,
      design.cooktopTemplateDepthIn
    );
    const enteredWidth = hasTemplate ? design.cooktopTemplateWidthIn : null;
    items.push({
      id: "cooktop",
      label: design.cooktop,
      placementKind: isRangeGap ? "full-depth-gap" : "cutout",
      run: design.cooktopRun,
      positionIn: design.cooktopPositionIn,
      frontPositionIn: isRangeGap ? null : design.cooktopFrontPositionIn,
      requiresFrontPosition: !isRangeGap,
      widthIn: isRangeGap ? (Number.isFinite(nominalWidth) ? nominalWidth : null) : enteredWidth,
      depthIn: isRangeGap ? null : hasTemplate ? design.cooktopTemplateDepthIn : null,
      planningWidthIn: isRangeGap
        ? Number.isFinite(nominalWidth)
          ? nominalWidth
          : 2
        : (enteredWidth ?? 2),
      representation: isRangeGap
        ? "full-depth-gap"
        : hasTemplate
          ? "template-opening"
          : "coordination-point",
      templateStatus: isRangeGap ? "not-needed" : hasTemplate ? "entered" : "unresolved",
    });
  }

  for (const cutout of design.otherCutouts) {
    const hasTemplate = completeTemplate(cutout.widthIn, cutout.depthIn);
    items.push({
      id: cutout.id,
      label:
        cutout.type === "Other opening" && cutout.label
          ? `Other opening — ${cutout.label}`
          : cutout.type,
      placementKind: "cutout",
      run: cutout.run,
      positionIn: cutout.positionIn,
      frontPositionIn: cutout.frontPositionIn,
      requiresFrontPosition: true,
      widthIn: hasTemplate ? cutout.widthIn : null,
      depthIn: hasTemplate ? cutout.depthIn : null,
      planningWidthIn: hasTemplate ? (cutout.widthIn ?? 2) : 2,
      representation: hasTemplate ? "template-opening" : "coordination-point",
      templateStatus: hasTemplate ? "entered" : "unresolved",
    });
  }

  return items;
}

export function getCountertopPlannerOpeningFrontBounds(
  design: CountertopPlannerDesignInput,
  item: CountertopPlannerOpeningScheduleItem
): { minimum: number; maximum: number; surfaceDepth: number } | null {
  if (!item.run || !item.requiresFrontPosition) return null;
  const surfaceDepth = plannerRunDepth(design, item.run);
  const depthIn = item.depthIn ?? 0;
  const clearance = depthIn ? 1 : 1;
  return {
    minimum: depthIn / 2 + clearance,
    maximum: surfaceDepth - depthIn / 2 - clearance,
    surfaceDepth,
  };
}

function overlapOnRun(
  first: CountertopPlannerOpeningScheduleItem,
  second: CountertopPlannerOpeningScheduleItem
): boolean {
  if (
    first.run !== second.run ||
    first.positionIn === null ||
    second.positionIn === null ||
    !first.widthIn ||
    !second.widthIn
  ) {
    return false;
  }
  if (Math.abs(first.positionIn - second.positionIn) >= (first.widthIn + second.widthIn) / 2 + 3) {
    return false;
  }
  if (
    !first.requiresFrontPosition ||
    !second.requiresFrontPosition ||
    first.frontPositionIn === null ||
    second.frontPositionIn === null ||
    !first.depthIn ||
    !second.depthIn
  ) {
    return true;
  }
  return (
    Math.abs(first.frontPositionIn - second.frontPositionIn) <
    (first.depthIn + second.depthIn) / 2 + 3
  );
}

function isSmallDeckAccessory(item: CountertopPlannerOpeningScheduleItem): boolean {
  return (
    item.placementKind === "cutout" &&
    item.id !== "sink" &&
    item.id !== "cooktop" &&
    item.planningWidthIn <= 2 &&
    (item.depthIn ?? 0) <= 2
  );
}

function isObviousSinkAccessoryOverlap(
  first: CountertopPlannerOpeningScheduleItem,
  second: CountertopPlannerOpeningScheduleItem
): boolean | null {
  const sink = first.id === "sink" ? first : second.id === "sink" ? second : null;
  const accessory = sink === first ? second : sink === second ? first : null;
  if (!sink || !accessory || !isSmallDeckAccessory(accessory)) return null;
  if (
    sink.placementKind !== "cutout" ||
    sink.positionIn === null ||
    accessory.positionIn === null ||
    sink.frontPositionIn === null ||
    accessory.frontPositionIn === null ||
    !sink.widthIn ||
    !sink.depthIn ||
    !accessory.widthIn ||
    !accessory.depthIn
  ) {
    return false;
  }
  return (
    Math.abs(accessory.positionIn - sink.positionIn) < (sink.widthIn + accessory.widthIn) / 2 &&
    Math.abs(accessory.frontPositionIn - sink.frontPositionIn) <
      (sink.depthIn + accessory.depthIn) / 2
  );
}

export function getCountertopPlannerPlacementProblems(
  designInput: CountertopPlannerDesignInput
): string[] {
  const design = resolveCountertopPlannerDesign(designInput);
  const schedule = getCountertopPlannerOpeningSchedule(design);
  const problems: string[] = [];

  for (const item of schedule) {
    if (!item.run || item.positionIn === null) {
      problems.push(`${item.label} needs a location.`);
      continue;
    }
    const runLength = plannerRunLength(design, item.run);
    const endClearance = item.planningWidthIn / 2 + 2;
    if (item.positionIn < endClearance || item.positionIn > runLength - endClearance) {
      problems.push(
        `${item.label} is too close to the end of ${plannerRunLabel(item.run).toLowerCase()}.`
      );
    }
    if (
      item.run !== "island" &&
      design.layout !== "straight" &&
      item.positionIn < design.wallDepthIn + endClearance
    ) {
      problems.push(
        `${item.label} overlaps the shared inside-corner zone on ${plannerRunLabel(item.run).toLowerCase()}.`
      );
    }
    if (
      design.layout === "u-shape" &&
      item.run === "main" &&
      plannerRunLength(design, item.run) - item.positionIn < design.wallDepthIn + endClearance
    ) {
      problems.push(`${item.label} overlaps the shared inside-corner zone on the main run.`);
    }
    if (item.requiresFrontPosition) {
      const bounds = getCountertopPlannerOpeningFrontBounds(design, item);
      if (item.frontPositionIn === null) {
        problems.push(`${item.label} needs a center distance from the front edge.`);
      } else if (!bounds || bounds.maximum < bounds.minimum) {
        problems.push(`${item.label} cannot fit front to back on the selected surface.`);
      } else if (item.frontPositionIn < bounds.minimum || item.frontPositionIn > bounds.maximum) {
        problems.push(
          `${item.label} is too close to the front or back edge of ${plannerRunLabel(item.run).toLowerCase()}.`
        );
      }
    }
  }

  for (let firstIndex = 0; firstIndex < schedule.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < schedule.length; secondIndex += 1) {
      const first = schedule[firstIndex];
      const second = schedule[secondIndex];
      const sinkAccessoryOverlap = isObviousSinkAccessoryOverlap(first, second);
      if (sinkAccessoryOverlap === false) continue;
      if (overlapOnRun(first, second)) {
        problems.push(
          `${first.label} and ${second.label} overlap on ${plannerRunLabel(first.run).toLowerCase()}.`
        );
      }
    }
  }

  for (const cutout of design.otherCutouts) {
    if (cutout.type === "Other opening" && !cutout.label.trim()) {
      problems.push("Other opening needs a name.");
    }
  }

  return [...new Set(problems)];
}

export function getCountertopPlannerDiagnostics(
  designInput: CountertopPlannerDesignInput
): CountertopPlannerDiagnostic[] {
  const design = resolveCountertopPlannerDesign(designInput);
  const diagnostics: CountertopPlannerDiagnostic[] = [];
  const add = (id: string, label: string, scope: CountertopPlannerDiagnostic["scope"]) =>
    diagnostics.push({ id, label, scope });

  if (!design.measurementsReviewed) {
    add(
      "surface-measurements-review",
      "Countertop run, depth, and island dimensions are unreviewed starter values",
      "scene"
    );
  }
  if (design.roomWidthIn === null) add("room-width", "Room width not measured", "scene");
  if (design.roomDepthIn === null) add("room-depth", "Room depth not measured", "scene");
  if (design.roomWallHeightIn === null) add("wall-height", "Wall height not measured", "scene");
  if (design.finishedTopHeightIn === null)
    add("top-height", "Finished-top height not measured", "scene");
  if (design.topThicknessIn === null)
    add("top-thickness", "Finished top thickness not entered", "scene");
  if (design.island && design.islandLeftOffsetIn === null)
    add("island-left", "Island left-edge position not measured", "scene");
  if (design.island && design.islandBackOffsetIn === null)
    add("island-back", "Island back-edge position not measured", "scene");
  if (design.floorStone && !hasResolvedCountertopRoomShell(design))
    add("floor-shell", "Floor application needs all three room measurements", "scene");

  for (const item of getCountertopPlannerOpeningSchedule(design)) {
    if (item.templateStatus === "unresolved") {
      add(
        `${item.id}-template`,
        `${item.label} template size not entered — shown as a coordination point`,
        "opening"
      );
    }
  }

  return diagnostics;
}

/**
 * Shared request gate for the planner buttons and the parent request drawer. A generic fixture
 * coordination point is valid planning intent, so missing manufacturer templates do not block a
 * fabricator conversation. Unplaced intent and unreviewed starter measurements do.
 */
export function getCountertopPlannerRequestReadiness(
  designInput: CountertopPlannerDesignInput,
  intent: CountertopPlannerRequestIntent
): CountertopPlannerRequestReadiness {
  const design = resolveCountertopPlannerDesign(designInput);
  const problems: string[] = [];

  if (intent === "stone") {
    if (!getCatalogItemById(design.stoneId)) problems.push("Choose a named JW Stone surface.");
  } else {
    if (!design.measurementsReviewed) {
      problems.push(
        "Review the main run, active returns, wall-top depth, and enabled island dimensions."
      );
    }
    problems.push(...getCountertopPlannerPlacementProblems(design));
  }

  const uniqueProblems = [...new Set(problems)];
  return { ready: uniqueProblems.length === 0, problems: uniqueProblems };
}
