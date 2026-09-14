import {
  resolveCountertopPlannerDesign,
  type CountertopPlannerDesignInput,
} from "./countertopPlannerModel";

export type StoneShowroomRoom = "kitchen" | "bathroom" | "living";

export function getStoneShowroomRoom(
  room: CountertopPlannerDesignInput["room"]
): StoneShowroomRoom {
  if (room === "Primary bathroom" || room === "Guest bathroom") return "bathroom";
  if (room === "Living room") return "living";
  return "kitchen";
}

/** Render-only example geometry. Never send this object to draft storage or request readiness. */
export function createStoneShowroomSceneDesign(
  input: CountertopPlannerDesignInput,
  options: { floorStone?: boolean; room?: CountertopPlannerDesignInput["room"] } = {}
) {
  const selectedRoom = options.room ?? input.room;
  const room = getStoneShowroomRoom(selectedRoom);
  return resolveCountertopPlannerDesign({
    ...input,
    room: selectedRoom,
    included: false,
    layout: "straight",
    wallAIn: room === "bathroom" ? 84 : room === "living" ? 108 : 144,
    wallBIn: 0,
    wallCIn: 0,
    wallDepthIn: room === "living" ? 20 : 25.5,
    island: room === "kitchen",
    islandLengthIn: 84,
    islandWidthIn: 42,
    islandLeftOffsetIn: 30,
    islandBackOffsetIn: 72,
    floorStone: options.floorStone === true,
    roomWidthIn: room === "bathroom" ? 120 : 192,
    roomDepthIn: room === "bathroom" ? 120 : 168,
    roomWallHeightIn: 108,
    finishedTopHeightIn: room === "living" ? 28 : 36,
    topThicknessIn: 1.25,
    // Examples never inherit customer openings, seams, or their measurement coordinates.
    measurementsReviewed: true,
    sink: "None",
    sinkRun: "",
    sinkPositionIn: null,
    sinkFrontPositionIn: null,
    cooktop: "None",
    cooktopRun: "",
    cooktopPositionIn: null,
    cooktopFrontPositionIn: null,
    sinkTemplateWidthIn: null,
    sinkTemplateDepthIn: null,
    cooktopTemplateWidthIn: null,
    cooktopTemplateDepthIn: null,
    otherCutouts: [],
    showSeams: false,
  });
}
