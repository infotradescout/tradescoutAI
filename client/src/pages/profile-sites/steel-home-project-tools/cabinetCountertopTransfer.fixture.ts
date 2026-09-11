import { createCabinetPlannerModule } from "./cabinetPlannerModel";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import type { TransferOptions } from "./cabinetCountertopTransfer";

/** Synthetic test data only; not imported by production components. */
export function createCabinetTransferTestDraft() {
  const draft = createEmptySteelHomeProjectDraft();
  draft.stateCode = "FL";
  draft.countyFips = "12033";
  draft.cabinets.notes = "SYNTHETIC outer cabinet notes";
  draft.cabinets.planner = {
    ...draft.cabinets.planner, starter: "kitchen", view: "plan", selectedModuleId: "north-run",
    shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
    notes: "SYNTHETIC measured cabinet notes",
    modules: [
      { ...createCabinetPlannerModule("base-cabinet", "north-run"), label: "North support run", widthIn: 144 },
      { ...createCabinetPlannerModule("base-cabinet", "west-run"), label: "West support run", surface: "west", offsetIn: 60, widthIn: 72 },
      { ...createCabinetPlannerModule("island", "island"), label: "Island support", offsetIn: 60, roomDepthOffsetIn: 84, widthIn: 60, depthIn: 36 },
      { ...createCabinetPlannerModule("wall-cabinet", "upper"), label: "Upper cabinet", offsetIn: 30 },
    ],
    presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: { "north-run": "doors", "west-run": "drawers", island: "drawers" } },
  };
  draft.countertops = {
    ...draft.countertops, room: "Kitchen", layout: "straight", wallAIn: 84, wallBIn: 96, wallCIn: 96,
    wallDepthIn: 25.5, island: true, islandLengthIn: 78, islandWidthIn: 42,
    islandLeftOffsetIn: 70, islandBackOffsetIn: 82,
    roomWidthIn: 200, roomDepthIn: 180, roomWallHeightIn: 108,
    finishedTopHeightIn: 36, topThicknessIn: 1.5, stoneId: "cristallo",
    edge: "Eased", backsplash: "4-inch", waterfall: "Left",
    sink: "Single-bowl undermount", sinkRun: "main", sinkPositionIn: 42, sinkFrontPositionIn: 12.75,
    sinkTemplateWidthIn: 30, sinkTemplateDepthIn: 18, cooktop: "None",
    otherCutouts: [{ id: "faucet-1", type: "Faucet hole", label: "SYNTHETIC fixture label", run: "main", positionIn: 70, frontPositionIn: 8, widthIn: 1.5, depthIn: 1.5 }],
    notes: "PRIVATE SYNTHETIC countertop notes", measurementsReviewed: true,
  };
  return reconcileSteelHomeProjectDraft(draft);
}
export const TRANSFER_TEST_OPTIONS: TransferOptions = {
  frontOverhangIn: 1.5, thicknessIn: 1.5,
  islandWestIn: 1.5, islandEastIn: 4.5, islandNorthIn: 1.5, islandSouthIn: 10.5,
};
