import { describe, expect, it } from "vitest";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import {
  EMPTY_COUNTERTOP_PLANNER_EXTENSION,
  addCountertopPlannerExtensionToShareUrl,
  getCountertopPlannerDiagnostics,
  getCountertopPlannerExtensionSnapshot,
  getCountertopPlannerOpeningSchedule,
  getCountertopPlannerPlacementProblems,
  getCountertopPlannerRequestReadiness,
  parseCountertopPlannerExtensionFromShareUrl,
  reconcileCountertopPlannerExtension,
  withCountertopPlannerExtension,
} from "./countertopPlannerModel";

describe("truthful countertop planner extension", () => {
  it("starts every recovered spatial measurement unresolved", () => {
    const design = createEmptySteelHomeProjectDraft().countertops;

    expect(getCountertopPlannerExtensionSnapshot(design)).toEqual(
      EMPTY_COUNTERTOP_PLANNER_EXTENSION
    );
    expect(getCountertopPlannerDiagnostics(design).map((item) => item.id)).toEqual([
      "surface-measurements-review",
      "room-width",
      "room-depth",
      "wall-height",
      "top-height",
      "top-thickness",
    ]);
  });

  it("snaps entered measurements to an eighth inch and rejects non-numbers", () => {
    expect(
      reconcileCountertopPlannerExtension({
        roomWidthIn: 143.94,
        finishedTopHeightIn: Number.NaN,
        topThicknessIn: 1.49,
      })
    ).toMatchObject({
      roomWidthIn: 144,
      finishedTopHeightIn: null,
      topThicknessIn: 1.5,
    });
  });

  it("keeps generic sinks and cooktops as non-dimensional coordination points", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "straight" as const,
      wallAIn: 144,
      wallDepthIn: 30,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 48,
      sinkFrontPositionIn: 14,
      cooktop: "36-inch cooktop cutout" as const,
      cooktopRun: "main" as const,
      cooktopPositionIn: 96,
      cooktopFrontPositionIn: 14,
    };

    expect(getCountertopPlannerOpeningSchedule(design)).toMatchObject([
      {
        id: "sink",
        widthIn: null,
        depthIn: null,
        planningWidthIn: 2,
        representation: "coordination-point",
        templateStatus: "unresolved",
      },
      {
        id: "cooktop",
        widthIn: null,
        depthIn: null,
        planningWidthIn: 2,
        representation: "coordination-point",
        templateStatus: "unresolved",
      },
    ]);
    expect(getCountertopPlannerPlacementProblems(design)).toEqual([]);
  });

  it("turns a sink or cooktop into a dimensional opening only after both template values exist", () => {
    const base = {
      ...createEmptySteelHomeProjectDraft().countertops,
      sink: "Double-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 60,
      sinkFrontPositionIn: 13,
    };
    const partial = withCountertopPlannerExtension(base, { sinkTemplateWidthIn: 32.5 });
    expect(getCountertopPlannerOpeningSchedule(partial)[0]).toMatchObject({
      representation: "coordination-point",
      widthIn: null,
      depthIn: null,
    });

    const measured = withCountertopPlannerExtension(partial, { sinkTemplateDepthIn: 19.25 });
    expect(getCountertopPlannerOpeningSchedule(measured)[0]).toMatchObject({
      representation: "template-opening",
      widthIn: 32.5,
      depthIn: 19.25,
      planningWidthIn: 32.5,
    });
  });

  it("uses only the selected nominal width for a full-depth range gap", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      cooktop: "36-inch range gap" as const,
      cooktopRun: "main" as const,
      cooktopPositionIn: 60,
    };

    expect(getCountertopPlannerOpeningSchedule(design)[0]).toMatchObject({
      representation: "full-depth-gap",
      templateStatus: "not-needed",
      widthIn: 36,
      depthIn: null,
      planningWidthIn: 36,
      requiresFrontPosition: false,
    });
  });

  it("retains inside-corner safety and requires a name for custom coordination intent", () => {
    const starter = createEmptySteelHomeProjectDraft().countertops;
    const insideCorner = {
      ...starter,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 20,
      sinkFrontPositionIn: 12,
    };
    expect(getCountertopPlannerPlacementProblems(insideCorner)).toContain(
      "Sink — Single-bowl undermount overlaps the shared inside-corner zone on main run."
    );

    const unnamedPoint = withCountertopPlannerExtension(
      {
        ...starter,
        otherCutouts: [
          {
            id: "other-1",
            type: "Other opening" as const,
            label: "",
            run: "main" as const,
            positionIn: 80,
            frontPositionIn: 12,
            widthIn: null,
            depthIn: null,
          },
        ],
      },
      { measurementsReviewed: true }
    );
    expect(getCountertopPlannerPlacementProblems(unnamedPoint)).toContain(
      "Other opening needs a name."
    );
    expect(getCountertopPlannerRequestReadiness(unnamedPoint, "fabricator").ready).toBe(false);
  });

  it("keeps island and room geometry unresolved until each required measurement is entered", () => {
    const design = withCountertopPlannerExtension(
      {
        ...createEmptySteelHomeProjectDraft().countertops,
        island: true,
      },
      {
        measurementsReviewed: true,
        roomWidthIn: 168,
        roomDepthIn: 216,
        roomWallHeightIn: 108,
        finishedTopHeightIn: 36,
        topThicknessIn: 1.25,
        islandLeftOffsetIn: 42,
      }
    );

    expect(getCountertopPlannerDiagnostics(design).map((item) => item.id)).toEqual(["island-back"]);
  });

  it("round-trips only public measurement fields in a share URL", () => {
    const design = withCountertopPlannerExtension(createEmptySteelHomeProjectDraft().countertops, {
      measurementsReviewed: true,
      roomWidthIn: 144,
      roomDepthIn: 192,
      finishedTopHeightIn: 36,
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
    });
    const url = addCountertopPlannerExtensionToShareUrl(
      "https://example.com/u/steel-home-packages/builders/countertops?studio=safe",
      design
    );

    expect(url).not.toContain("notes");
    expect(parseCountertopPlannerExtensionFromShareUrl(url)).toMatchObject({
      measurementsReviewed: true,
      roomWidthIn: 144,
      roomDepthIn: 192,
      finishedTopHeightIn: 36,
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
    });
  });

  it("keeps stone and fabricator request readiness independent", () => {
    const starter = createEmptySteelHomeProjectDraft().countertops;
    expect(getCountertopPlannerRequestReadiness(starter, "stone")).toEqual({
      ready: false,
      problems: ["Choose a named JW Stone surface."],
    });
    expect(
      getCountertopPlannerRequestReadiness(
        { ...starter, stoneId: "not-a-catalog-surface" },
        "stone"
      )
    ).toEqual({
      ready: false,
      problems: ["Choose a named JW Stone surface."],
    });
    expect(getCountertopPlannerRequestReadiness(starter, "fabricator")).toEqual({
      ready: false,
      problems: [
        "Review the main run, active returns, wall-top depth, and enabled island dimensions.",
      ],
    });

    const reviewedWithGenericSink = withCountertopPlannerExtension(
      {
        ...starter,
        stoneId: "cristallo",
        sink: "Single-bowl undermount",
        sinkRun: "main",
        sinkPositionIn: 48,
        sinkFrontPositionIn: 12,
      },
      { measurementsReviewed: true }
    );
    expect(getCountertopPlannerRequestReadiness(reviewedWithGenericSink, "stone")).toEqual({
      ready: true,
      problems: [],
    });
    expect(getCountertopPlannerRequestReadiness(reviewedWithGenericSink, "fabricator")).toEqual({
      ready: true,
      problems: [],
    });
  });
});
