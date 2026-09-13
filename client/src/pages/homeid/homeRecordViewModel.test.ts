import { describe, expect, it } from "vitest";
import { HOME_SECTIONS, PACKAGE_HOME_ID, resolveHomeView } from "./homeWorkspaceModel";
import { rows, readRecordDetail, readRecordPersistence, recordTab, recordHref, selectRecordProject, savedProjectStage, groupedSystems, safeEvidenceHref, documentDownloadHref, buildTimelineHref } from "./homeRecordViewModel";
import { launchWorkspaceModel, listCount, savedCount, recordedNumber, scopeConfirmation, taskStatusCount, collectPartnerTargets } from "./launchWorkspaceModel";

describe("record workspace navigation and data boundaries", () => {
  it.each(HOME_SECTIONS)("preserves the $id record section and selected project", ({ id }) => {
    const href = recordHref(PACKAGE_HOME_ID, id, "project&second=wrong");
    const url = new URL(href, "https://example.invalid");
    expect(url.searchParams.get("homeId")).toBe(PACKAGE_HOME_ID);
    expect(url.searchParams.get("projectId")).toBe("project&second=wrong");
    expect(url.searchParams.has("second")).toBe(false);
    expect(recordTab(url.search)).toBe(id);
    expect(resolveHomeView(url.search, PACKAGE_HOME_ID)).toBe("record");
  });
  it("never substitutes a different project for a missing selected ID", () => {
    const project = { id: "one", title: "One" };
    expect(selectRecordProject([project], "missing")).toBeNull();
    expect(selectRecordProject([project], "one")).toBe(project);
    expect(selectRecordProject([project], null)).toBe(project);
    expect(selectRecordProject([], null)).toBeNull();
  });
  it("uses only a saved project stage, not a location or project category", () => {
    expect(savedProjectStage({ id: "p", status: "planning", metadata: { address1: "Somewhere", propertyAssigned: true } })).toBeNull();
    expect(savedProjectStage({ id: "p", metadata: { currentStage: "Engineering" } })).toBe("Engineering");
    expect(savedProjectStage(null)).toBeNull();
  });
  it("retains unknown system categories without upgrading review status", () => {
    const systems = [{ id: "stone", type: "natural_stone", label: "Stone", status: "needs_review" as const }, { id: "custom", type: "solar", label: "Solar", status: "unknown" as const }];
    const groups = groupedSystems(systems);
    expect(groups.flatMap((group) => group.items)).toEqual(expect.arrayContaining(systems));
    expect(groups.find((group) => group.name === "Other systems")?.items).toEqual([systems[1]]);
    expect(groups.flatMap((group) => group.items).find((item) => item.id === "stone")?.status).toBe("needs_review");
  });
  it("distinguishes failed/malformed collections from real emptiness", () => {
    expect(rows({ projects: [] }, "projects")).toEqual([]);
    for (const projects of [null, undefined, 4, [null], ["not a project"]]) expect(() => rows({ projects }, "projects")).toThrow();
    expect(() => readRecordDetail({ home: { id: "wrong" }, records: [], documents: [], appliances: [] }, "wanted")).toThrow();
    expect(() => readRecordPersistence({ persistence: { propertyDetails: [], requestPackets: [], evidence: [] } })).toThrow();
    expect(() => readRecordPersistence({ persistence: { propertyDetails: [{ id: "bad" }], requestPackets: [], components: [], evidence: [] } })).toThrow();
  });
  it.each(["javascript:alert(1)", "data:text/html,<h1>bad</h1>", "//evil.example/path", "/\\evil.example", "https://user:pass@example.com/file", "https://example.com/\nfile", "relative/path"])("does not create an unsafe or ambiguous evidence link: %s", (value) => {
    expect(safeEvidenceHref(value)).toBeNull();
  });
  it("keeps authenticated document downloads and project timelines tied to their owner records", () => {
    expect(documentDownloadHref("home/one", "doc?two")).toBe("/api/homes/home%2Fone/documents/doc%3Ftwo/download");
    const link = new URL(buildTimelineHref("home", "project&other=1"), "https://example.invalid");
    expect(link.searchParams.get("projectId")).toBe("project&other=1");
    expect(link.searchParams.has("other")).toBe(false);
    expect(safeEvidenceHref("/api/homes/home/documents/doc/download")).toBe("/api/homes/home/documents/doc/download");
    expect(safeEvidenceHref("https://example.com/manual.pdf")).toBe("https://example.com/manual.pdf");
  });
});

describe("package planning never invents counts or approvals", () => {
  it("keeps missing arrays unknown and saved empty arrays zero", () => {
    const missing = launchWorkspaceModel({ id: "project" });
    expect(listCount(missing.launchTasks)).toBe("Not recorded");
    expect(listCount(missing.scopeMatrix)).toBe("Not recorded");
    expect(listCount(missing.packageLevels)).toBe("Not recorded");
    expect(listCount(missing.partnerTargets)).toBe("Not recorded");
    const empty = launchWorkspaceModel({ metadata: { launchBoard: { tasks: [] }, partnerPipeline: { primaryTargets: [] }, packageExecution: { anchorScopeMatrix: [], packageLevels: [] } } });
    expect(listCount(empty.launchTasks)).toBe("0"); expect(listCount(empty.scopeMatrix)).toBe("0");
    expect(listCount(empty.packageLevels)).toBe("0"); expect(listCount(empty.partnerTargets)).toBe("0");
  });
  it("rejects malformed operational data instead of rendering a default dashboard", () => {
    expect(() => launchWorkspaceModel({ metadata: { launchBoard: { tasks: "17" } } })).toThrow();
    expect(() => launchWorkspaceModel({ metadata: { packageExecution: { anchorScopeMatrix: [null] } } })).toThrow();
  });
  it("counts explicit task statuses rather than stale board totals", () => {
    const model = launchWorkspaceModel({ metadata: { launchBoard: { completedCount: 17, tasks: [{ status: "completed" }, { status: "blocked" }, { title: "No status" }] } } });
    expect(taskStatusCount(model.launchTasks, ["complete", "completed", "done"])).toBe("1");
    expect(taskStatusCount(model.launchTasks, ["blocked"])).toBe("1");
    expect(taskStatusCount(null, ["completed"])).toBe("Not recorded");
  });
  it("does not count included or category-covered scope as written confirmation", () => {
    const model = launchWorkspaceModel({ metadata: { packageExecution: { anchorScopeMatrix: [{ status: "confirmed" }, { status: "included" }, { status: "covered" }, {}] } } });
    expect(scopeConfirmation(model)).toBe("1/4");
    expect(scopeConfirmation(launchWorkspaceModel({}))).toBe("Not recorded");
  });
  it("preserves every primary/backup/incentive category entry", () => {
    const entries = collectPartnerTargets([{ lane: "one", slug: "company", backupSlug: "backup", incentiveSlug: "incentive" }, { lane: "two", slug: "company" }]);
    expect(entries).toHaveLength(4);
    expect(entries?.filter((item) => item.slug === "company")).toHaveLength(2);
  });
  it.each([undefined, null, "", false, -1, NaN])("does not fabricate a planning example from %s", (value) => {
    expect(recordedNumber(value, "currency")).toBe("Not recorded");
    expect(recordedNumber(value, "area")).toBe("Not recorded");
  });
  it("preserves real zeros rather than substituting example values", () => {
    expect(savedCount(0)).toBe("0"); expect(savedCount(null)).toBe("Not recorded");
    expect(recordedNumber(0, "currency")).toBe("$0");
    expect(recordedNumber(0, "percent")).toBe("0%");
    expect(recordedNumber(0, "area")).toBe("0 sq ft");
  });
});
