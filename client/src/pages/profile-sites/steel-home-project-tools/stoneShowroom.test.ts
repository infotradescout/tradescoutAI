import { describe, expect, it } from "vitest";
import { createStoneShowroomSceneDesign, getStoneShowroomRoom } from "./stoneShowroom";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import { getCountertopPlannerRequestReadiness } from "./countertopPlannerModel";
import {
  buildCountertopStudioShareUrl,
  parseCountertopStudioShareUrl,
} from "./countertopStudioShare";

describe("example rooms stay outside measured drafts and requests", () => {
  it("does not populate project measurements, floor quantities or fabrication readiness", () => {
    const draft = { ...createEmptySteelHomeProjectDraft().countertops, stoneId: "cristallo" };
    const before = structuredClone(draft);
    const scene = createStoneShowroomSceneDesign(draft, { floorStone: true });
    expect(scene.island).toBe(true);
    expect(scene.floorStone).toBe(true);
    expect(scene.roomWidthIn).toBe(192);
    expect(draft).toEqual(before);
    expect(getCountertopPlannerRequestReadiness(draft, "fabricator").ready).toBe(false);
    const shared = parseCountertopStudioShareUrl(
      buildCountertopStudioShareUrl(
        draft,
        "https://example.com/u/steel-home-packages/builders/countertops"
      )!
    );
    expect(shared).toMatchObject({
      measurementsReviewed: false,
      roomWidthIn: null,
      floorStone: false,
      island: false,
    });
  });
  it("never transfers customer cutout coordinates into a different example room", () => {
    const draft = {
      ...createEmptySteelHomeProjectDraft().countertops,
      room: "Primary bathroom" as const,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 118,
      sinkFrontPositionIn: 12,
      showSeams: true,
    };
    const scene = createStoneShowroomSceneDesign(draft);
    expect(getStoneShowroomRoom(draft.room)).toBe("bathroom");
    expect(scene).toMatchObject({
      wallAIn: 84,
      island: false,
      sink: "None",
      sinkRun: "",
      sinkPositionIn: null,
      otherCutouts: [],
      showSeams: false,
    });
    expect(draft.sinkPositionIn).toBe(118);
    expect(getStoneShowroomRoom("Guest bathroom")).toBe("bathroom");
    expect(getStoneShowroomRoom("Living room")).toBe("living");
  });
});
