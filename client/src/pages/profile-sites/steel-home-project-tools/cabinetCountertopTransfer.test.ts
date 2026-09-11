import { describe, expect, it } from "vitest";
import { createCabinetPlannerModule } from "./cabinetPlannerModel";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import { EMPTY_TRANSFER_OPTIONS, proposeCabinetCountertopTransfer, transferUnionArea } from "./cabinetCountertopTransfer";
import { createCabinetTransferTestDraft, TRANSFER_TEST_OPTIONS } from "./cabinetCountertopTransfer.fixture";
import { COUNTERTOP_TRANSFER_BACKUP_KEY, equalCountertopSnapshots, loadCountertopTransferBackup, saveCountertopTransferBackup } from "./countertopTransferBackup";
import { buildCountertopStudioShareUrl, parseCountertopStudioShareUrl } from "./countertopStudioShare";

function fixture() {
  const draft = createCabinetTransferTestDraft();
  const options = { ...TRANSFER_TEST_OPTIONS };
  return { draft, options, run: () => proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, options) };
}
describe("Measured cabinet-to-countertop transfer", () => {
  it("copies the exact L footprint, room and independently entered island overhangs", () => {
    const { run } = fixture(); const result = run();
    expect(result.problems).toEqual([]);
    expect(result.next).toMatchObject({ layout: "l-shape", wallAIn: 144, wallBIn: 96, wallDepthIn: 25.5,
      roomWidthIn: 180, roomDepthIn: 156, roomWallHeightIn: 108,
      finishedTopHeightIn: 36, topThicknessIn: 1.5,
      islandLengthIn: 66, islandWidthIn: 48, islandLeftOffsetIn: 58.5, islandBackOffsetIn: 82.5,
      measurementsReviewed: false });
    expect(result.supports).toHaveLength(3);
    expect(result.excluded.map(r => r.id)).toEqual(["upper"]);
  });
  it("does not mutate either design or import upper cabinets as countertop supports", () => {
    const { draft, run } = fixture(); const original = structuredClone(draft);
    const result = run(); expect(draft).toEqual(original); expect(result.next).not.toBe(draft.countertops);
    expect(result.supports.some(r => r.id === "upper")).toBe(false);
    expect(result.next!.stoneId).toBe(draft.countertops.stoneId);
    expect(result.next!.texturePhotoKey).toBe(draft.countertops.texturePhotoKey);
    expect(result.next!.notes).toBe(draft.countertops.notes);
    expect(result.next!.edge).toBe("Eased"); expect(result.next!.backsplash).toBe("4-inch");
  });
  it("keeps template selections but clears old opening positions and review approval", () => {
    const { run } = fixture(); const next = run().next!;
    expect(next).toMatchObject({ sink: "Single-bowl undermount", sinkRun: "", sinkPositionIn: null, sinkFrontPositionIn: null, sinkTemplateWidthIn: 30, sinkTemplateDepthIn: 18, measurementsReviewed: false });
    expect(next.otherCutouts[0]).toMatchObject({ id: "faucet-1", widthIn: 1.5, depthIn: 1.5, run: "", positionIn: null, frontPositionIn: null });
  });
  it("round-trips the proposed design exactly through the existing saved format", () => {
    const next = fixture().run().next!;
    expect(reconcileSteelHomeProjectDraft(JSON.parse(JSON.stringify({ countertops: next }))).countertops).toEqual(next);
  });
  it("supports straight runs without requiring island overhangs", () => {
    const { draft, options, run } = fixture();
    draft.cabinets.planner.modules = [draft.cabinets.planner.modules[0]];
    Object.assign(options, { islandWestIn: null, islandEastIn: null, islandNorthIn: null, islandSouthIn: null });
    expect(run().next).toMatchObject({ layout: "straight", island: false, waterfall: "None", islandLeftOffsetIn: null, islandBackOffsetIn: null });
  });
  it("supports an exact U footprint without replacing east-wall coordinates", () => {
    const { draft, run } = fixture();
    draft.cabinets.planner.modules[0].widthIn = 180;
    draft.cabinets.planner.modules.push({ ...createCabinetPlannerModule("base-cabinet", "east"), surface: "east", offsetIn: 24, widthIn: 72 });
    expect(run().next).toMatchObject({ layout: "u-shape", wallAIn: 180, wallBIn: 96, wallCIn: 96 });
  });
  it("accepts multiple adjoining island modules only when their union is a filled rectangle", () => {
    const { draft, run } = fixture(); const island = draft.cabinets.planner.modules[2];
    island.widthIn = 30;
    draft.cabinets.planner.modules.push({ ...island, id: "island-2", offsetIn: 90 });
    expect(run().next!.islandLengthIn).toBe(66);
  });
  it("does not import unmeasured room or automatically choose thickness and overhang", () => {
    const { draft } = fixture();
    expect(proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, EMPTY_TRANSFER_OPTIONS).next).toBeNull();
    draft.cabinets.planner.shell.widthIn = null;
    expect(proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, TRANSFER_TEST_OPTIONS).next).toBeNull();
    expect(proposeCabinetCountertopTransfer(createEmptySteelHomeProjectDraft().cabinets, draft.countertops, TRANSFER_TEST_OPTIONS).next).toBeNull();
  });
  it("rejects an internal gap instead of covering an appliance space", () => {
    const { draft, run } = fixture(); const north = draft.cabinets.planner.modules[0];
    north.widthIn = 60;
    draft.cabinets.planner.modules.push({ ...north, id: "north-2", widthIn: 54, offsetIn: 90 }, { ...createCabinetPlannerModule("appliance", "range"), offsetIn: 60, heightIn: 36 });
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("gap");
  });
  it("rejects shifted runs rather than relocating cabinets to the countertop origin", () => {
    const { draft, run } = fixture(); draft.cabinets.planner.modules = [{ ...draft.cabinets.planner.modules[0], offsetIn: 12 }];
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("offset");
  });
  it("rejects a missing L corner", () => {
    const { draft, run } = fixture(); draft.cabinets.planner.modules[0].offsetIn = 24;
    draft.cabinets.planner.modules[0].widthIn = 120;
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("corner");
  });
  it("rejects right-only L and south-facing layouts without reflecting the room", () => {
    const { draft, run } = fixture(); draft.cabinets.planner.modules[1].surface = "east";
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("right-return-only");
    draft.cabinets.planner.modules = [{ ...draft.cabinets.planner.modules[0], surface: "south" }];
    expect(run().next).toBeNull();
  });
  it("rejects fractional run measurements that legacy storage would round", () => {
    const { draft, run } = fixture(); draft.cabinets.planner.modules[0].widthIn = 144.125;
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("rounded or clamped");
  });
  it("rejects fractional top depths that legacy storage would round", () => {
    const { options, run } = fixture(); options.frontOverhangIn = 1.125;
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("wallDepthIn");
  });
  it("rejects mixed cabinet-top heights and depths rather than leveling or widening them", () => {
    const { draft, run } = fixture(); draft.cabinets.planner.modules[1].heightIn = 32;
    expect(run().problems.join(" ")).toContain("heights");
    draft.cabinets.planner.modules[1].heightIn = 34.5; draft.cabinets.planner.modules[1].depthIn = 20;
    expect(run().problems.join(" ")).toContain("depths");
  });
  it("rejects separate islands and holes in island supports", () => {
    const { draft, run } = fixture(); const island = draft.cabinets.planner.modules[2]; island.widthIn = 24;
    draft.cabinets.planner.modules.push({ ...island, id: "another-island", offsetIn: 96 });
    expect(run().next).toBeNull(); expect(run().problems.join(" ")).toContain("one filled rectangle");
  });
  it("rejects overhangs outside the room or overlapping another countertop", () => {
    const { draft, options, run } = fixture(); draft.cabinets.planner.modules[2].roomDepthOffsetIn = 112;
    options.islandSouthIn = 24; expect(run().next).toBeNull();
    draft.cabinets.planner.modules[2].roomDepthOffsetIn = 30; options.islandNorthIn = 12;
    expect(run().problems.join(" ")).toContain("overlaps a wall countertop");
  });
  it.each([NaN, Infinity, -1, 24.125])("rejects invalid front overhang %s", value => {
    const { options, run } = fixture(); options.frontOverhangIn = value;
    expect(run().next).toBeNull();
  });
  it("keeps unreviewed source measurements visibly unreviewed in the target", () => {
    const { draft, run } = fixture(); draft.cabinets.planner.shell.measurementsReviewed = false;
    expect(run().next!.measurementsReviewed).toBe(false);
    expect(run().warnings.join(" ")).toContain("not been reviewed");
  });
  it("union area does not count overlaps twice or cover gaps", () => {
    const r = (x1: number, x2: number) => ({ id: "r", label: "r", x1, x2, z1: 0, z2: 10 });
    expect(transferUnionArea([r(0, 20), r(10, 30)])).toBe(300);
    expect(transferUnionArea([r(0, 10), r(20, 30)])).toBe(200);
  });
});

describe("Pre-import restore point", () => {
  function memory() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; }
  it("retains both complete snapshots across reloading without writing active project storage", () => {
    const { draft, run } = fixture(); const store = memory();
    expect(saveCountertopTransferBackup(store, draft.countertops, run().next!)).not.toBeNull();
    const backup = loadCountertopTransferBackup(store)!;
    expect(backup.previous).toEqual(draft.countertops); expect(backup.imported).toEqual(run().next);
    expect(store.getItem("tradescout:steel-home-project-tools:draft:v9")).toBeNull();
  });
  it("fails closed when the restore point cannot be stored", () => {
    const { draft, run } = fixture();
    expect(saveCountertopTransferBackup(null, draft.countertops, run().next!)).toBeNull();
    expect(saveCountertopTransferBackup({ getItem: () => null, setItem: () => { throw Error("full"); } }, draft.countertops, run().next!)).toBeNull();
  });
  it("rejects corrupted or unsupported restore data", () => {
    const store = memory(); store.setItem(COUNTERTOP_TRANSFER_BACKUP_KEY, '{"version":99}');
    expect(loadCountertopTransferBackup(store)).toBeNull();
    store.setItem(COUNTERTOP_TRANSFER_BACKUP_KEY, "not json"); expect(loadCountertopTransferBackup(store)).toBeNull();
  });
  it("does not include backup data or private notes in a shared plan", () => {
    const { run } = fixture(); const next = run().next!;
    const url = buildCountertopStudioShareUrl(next, "https://www.thetradescout.com/u/steel-home-packages/builders/countertops")!;
    const shared = parseCountertopStudioShareUrl(url)!;
    expect(shared.notes).toBe(""); expect(shared.wallAIn).toBe(144); expect(shared.sinkRun).toBe("");
    expect(url).not.toContain("backup"); expect(url).not.toContain("PRIVATE");
  });
  it("compares snapshot values independently of object property order", () => {
    expect(equalCountertopSnapshots({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(equalCountertopSnapshots({ a: 1 }, { a: 2 })).toBe(false);
  });
});
