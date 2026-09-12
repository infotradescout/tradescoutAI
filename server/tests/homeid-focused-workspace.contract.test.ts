import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGE_HOME_ID, resolveHomeView } from "../../client/src/pages/homeid/homeWorkspaceModel";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const entrySource = read("client/src/pages/homes.tsx");
const workspaceSource = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
const propertyBlessingsSource = read("client/src/pages/homeid/PropertyBlessingsLaunchWorkspace.tsx");
const overviewSource = read("client/src/pages/homeid/HomeOverview.tsx");

describe("HomeID focused workspace product contract", () => {
  it("defaults to the selected property and work rather than a record-specific launch dashboard", () => {
    expect(entrySource).toContain("HomeOverview");
    expect(entrySource).toContain("useSearch()");
    expect(entrySource).toContain("resolveHomeView(search, selectedHomeId)");
    expect(resolveHomeView(`homeId=${PACKAGE_HOME_ID}`, PACKAGE_HOME_ID)).toBe("overview");
    expect(overviewSource).toContain('data-testid="homeid-overview"');
    expect(workspaceSource).toContain('data-testid="homeid-workspace"');
  });
  it("keeps specialized package operations explicit and preserves all deep links", () => {
    expect(entrySource).toContain("PropertyBlessingsLaunchWorkspace");
    expect(resolveHomeView("workspace=launch", PACKAGE_HOME_ID)).toBe("launch");
    expect(resolveHomeView("launchTab=scope", PACKAGE_HOME_ID)).toBe("launch");
    expect(resolveHomeView("mode=passport", PACKAGE_HOME_ID)).toBe("record");
    expect(propertyBlessingsSource).toContain('data-testid="property-blessings-launch-workspace"');
  });
  it("keeps the full property passport available for Property Blessings", () => {
    expect(propertyBlessingsSource).toContain('mode: "passport"');
    expect(propertyBlessingsSource).toContain("Open full property passport");
    expect(propertyBlessingsSource).toContain('passportUrl("property")');
    expect(propertyBlessingsSource).toContain('passportUrl("documents")');
    expect(propertyBlessingsSource).toContain('passportUrl("timeline")');
  });
  it("uses saved projects, due maintenance, files and history without invented readiness", () => {
    for (const copy of ["What needs attention", "Projects & work", "Recent history", "Property details", "Documents"]) expect(overviewSource).toContain(copy);
    expect(overviewSource).not.toContain("Ready for next gate");
    expect(overviewSource).not.toContain("Design and property screening");
    expect(overviewSource).not.toMatch(/\.length\s*\|\|\s*(?:17|18|22|12)/);
    expect(overviewSource).toContain("not a property inspection or readiness rating");
  });
  it("preserves the complete existing property-passport features and mutations", () => {
    for (const copy of ["Overview", "Property", "Build", "Systems", "Documents", "Timeline", "Maintenance", "Requests", "Sale & Transfer", "Add Property", "Upload Documents", "Continue Planning", "Start a Request"]) expect(workspaceSource).toContain(copy);
    for (const action of ["saveFact", "uploadDoc", "saveTimeline", "saveSchedule", "savePacket", "createHome"]) expect(workspaceSource).toContain(action);
  });
  it("retains uploaded package-plan execution controls", () => {
    for (const copy of ["Launch Control", "First 90 days", "Launch board", "Scope Matrix", "18-line anchor metal-building scope matrix", "Package Levels", "Partner Pipeline", "No signed partner claim", "Source Records", "Release Gates", "Current launch gate", "Open saved scope request"]) expect(propertyBlessingsSource).toContain(copy);
    for (const source of ["metadata.launchBoard", "metadata.partnerPipeline", "partnerPipeline.primaryTargets", "metadata.packageExecution", "packageExecution.anchorScopeMatrix", "packageExecution.packageLevels"]) expect(propertyBlessingsSource).toContain(source);
    expect(propertyBlessingsSource).not.toContain("partnerPipeline.primaryWave");
    expect(propertyBlessingsSource).not.toContain("partnerPipeline.backupAndConditional");
  });
  it("keeps target companies private and clearly unconfirmed", () => {
    for (const copy of ["Private source-review pipeline", "No signed partner claim", "No pay-per-lead requirement", "unconfirmed"]) expect(propertyBlessingsSource).toContain(copy);
  });
  it("keeps source references distinct from stored property files", () => {
    for (const copy of ["Reference only", "Upload a real property document", "No files are stored yet"]) expect(workspaceSource).toContain(copy);
    expect(propertyBlessingsSource).toContain("original file not stored as a downloadable attachment");
    expect(overviewSource).toContain("References are not uploaded files");
  });
  it("bounds the retained record editor without global theme or public-profile changes", () => {
    const css = read("client/src/pages/homeid/HomeOverview.css");
    expect(css).toContain('.ts-home-record-frame > [data-testid="homeid-workspace"] { position:relative');
    expect(css).not.toMatch(/(?:^|\n)\s*(?:body|html|:root)\b/);
    expect(entrySource).toContain('className="home-return-link"');
  });
});
