import { describe, expect, it } from "vitest";
import { createCabinetTransferTestDraft, TRANSFER_TEST_OPTIONS } from "./cabinetCountertopTransfer.fixture";
import { proposeCabinetCountertopTransfer } from "./cabinetCountertopTransfer";

describe("Finished countertop layer and recorded room objects", () => {
  it("blocks a top hitting a window even when its cabinet fits underneath", () => {
    const draft = createCabinetTransferTestDraft();
    draft.cabinets.planner.modules = draft.cabinets.planner.modules.filter(m => m.kind !== "wall-cabinet");
    draft.cabinets.planner.shellItems = [{ id: "window", label: "Low window", kind: "window", wall: "north", offsetIn: 30, widthIn: 30, heightIn: 48, elevationIn: 35, depthIn: 4 }];
    const result = proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, TRANSFER_TEST_OPTIONS);
    expect(result.next).toBeNull(); expect(result.problems.join(" ")).toContain("finished countertop intersects");
  });
  it("does not invent an overlap when a measured window starts above the top", () => {
    const draft = createCabinetTransferTestDraft();
    draft.cabinets.planner.modules = draft.cabinets.planner.modules.filter(m => m.kind !== "wall-cabinet");
    draft.cabinets.planner.shellItems = [{ id: "window", label: "High window", kind: "window", wall: "north", offsetIn: 30, widthIn: 30, heightIn: 36, elevationIn: 42, depthIn: 4 }];
    expect(proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, TRANSFER_TEST_OPTIONS).next).not.toBeNull();
  });
  it("blocks an island overhang intersecting a recorded projecting obstacle", () => {
    const draft = createCabinetTransferTestDraft();
    draft.cabinets.planner.shellItems = [{ id: "obstacle", label: "South projection", kind: "obstacle", wall: "south", offsetIn: 66, widthIn: 30, heightIn: 72, elevationIn: 0, depthIn: 30 }];
    const result = proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, TRANSFER_TEST_OPTIONS);
    expect(result.next).toBeNull(); expect(result.problems.join(" ")).toContain("South projection");
  });
});
