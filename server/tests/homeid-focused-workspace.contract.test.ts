import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_SECTIONS, PACKAGE_HOME_ID, resolveHomeView } from "../../client/src/pages/homeid/homeWorkspaceModel";
import { LAUNCH_TABS } from "../../client/src/pages/homeid/launchWorkspaceModel";
const read = (file: string) => fs.readFileSync(file, "utf8");
const entry = read("client/src/pages/homes.tsx");
const record = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
const launch = read("client/src/pages/homeid/PropertyBlessingsLaunchWorkspace.tsx");
const model = read("client/src/pages/homeid/launchWorkspaceModel.ts");

describe("HomeID workspace feature preservation", () => {
  it("defaults to the property overview and keeps explicit package/passport links", () => {
    expect(entry).toContain("HomeOverview"); expect(entry).toContain("useSearch()");
    expect(resolveHomeView(`homeId=${PACKAGE_HOME_ID}`, PACKAGE_HOME_ID)).toBe("overview");
    expect(resolveHomeView("workspace=launch", PACKAGE_HOME_ID)).toBe("launch");
    expect(resolveHomeView("launchTab=scope", PACKAGE_HOME_ID)).toBe("launch");
    expect(resolveHomeView("mode=passport", PACKAGE_HOME_ID)).toBe("record");
  });
  it("retains all nine property sections and every existing save workflow", () => {
    expect(HOME_SECTIONS.map((item) => item.id)).toEqual(["overview", "property", "build", "systems", "documents", "timeline", "maintenance", "requests", "sale"]);
    for (const action of ["saveFact", "uploadDoc", "saveTimeline", "saveSchedule", "savePacket", "createHome"]) expect(record).toContain(`const ${action} = useMutation`);
    for (const action of ["Upload Documents", "Continue Planning", "Start a Request", "Open Build Timeline", "Open HomeScout", "Open in Direct Connect"]) expect(record).toContain(action);
  });
  it("separates real property editing, property creation, and note entry", () => {
    expect(record).toContain("HomeIdentityEditor"); expect(record).toContain("Edit address & details");
    expect(record).toContain("New property"); expect(record).toContain("Add a property note");
    expect(record).not.toContain("Add Property");
    expect(record).not.toContain("Known and source-backed");
  });
  it("retains all six specialist sections and their saved operational data", () => {
    expect(LAUNCH_TABS.map((item) => item.id)).toEqual(["control", "scope", "packages", "partners", "evidence", "release"]);
    for (const field of ["metadata.launchBoard", "metadata.partnerPipeline", "partnerPipeline.primaryTargets", "metadata.packageExecution", "packageExecution.anchorScopeMatrix", "packageExecution.packageLevels", "packageExecution.executionSteps", "metadata.sourceFilesUsed", "metadata.sourceFilesExcluded", "metadata.firstPackageQuoteTemplate", "metadata.builderHandoffTemplate", "metadata.ownershipActivationTemplate"]) expect(model).toContain(field);
    for (const action of ["Open full property passport", "Open saved scope request", "Open partner operations", "Builder Handoff Pack", "Ownership protection activation", "Open full systems record", "Open full HomeID timeline"]) expect(launch).toContain(action);
  });
  it("keeps prospective partners private and the contact owner unchanged", () => {
    expect(launch).toContain("Private source-review pipeline"); expect(launch).toContain("No signed partner claim");
    expect(launch).toContain("unconfirmed"); expect(launch).toContain("No pay-per-lead requirement");
    expect(launch).toContain('/admin/tradepartners'); expect(launch).not.toContain('apiRequest("POST"');
  });
  it("preserves uploads and adds authenticated downloads without equating references to files", () => {
    expect(record).toContain("uploadPrivateObject(docFile)"); expect(record).toContain("documentDownloadHref(homeId, item.id)");
    expect(record).toContain("Reference only"); expect(record).toContain("No files are stored yet");
    expect(launch).toContain("original file not stored as a downloadable attachment");
  });
  it("does not manufacture readiness or category-based coverage in either workspace", () => {
    for (const source of [record, launch]) {
      expect(source).not.toContain("Ready for next gate"); expect(source).not.toContain("Design and property screening");
      expect(source).not.toContain("COVERED.has"); expect(source).not.toMatch(/\.length\s*\|\|\s*(?:17|18|22|12|3)/);
    }
    expect(record).toContain("savedProjectStage(project)"); expect(launch).toContain("scopeConfirmation(model)");
  });
  it("scopes private reads by viewer and derives both navigation states from the URL", () => {
    expect(record).toContain('queryKey: [endpoint, "record", viewerId]');
    expect(record).toContain("readRecordDetail(await apiRequest"); expect(record).toContain("recordTab(search)");
    expect(launch).toContain("launchTab(search)"); expect(launch).toContain('"launch", user?.id');
    expect(record).not.toContain("history.replaceState"); expect(launch).not.toContain("history.replaceState");
    expect(record).toContain("requirePersistence()");
  });
  it("bounds the application record screens without global or custom-profile theme changes", () => {
    const css = read("client/src/pages/homeid/HomeRecordWorkspace.css");
    expect(css).toContain(".ts-home-record { position:relative");
    expect(css).not.toMatch(/(?:^|\n)\s*(?:body|html|:root)\b/);
    expect(css).toContain("min-height:44px"); expect(css).toContain("var(--ts-surface)");
    expect(entry).toContain('className="home-return-link"');
  });
});
