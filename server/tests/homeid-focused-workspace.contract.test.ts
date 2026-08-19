import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const entrySource = fs.readFileSync(path.join(repoRoot, "client/src/pages/homes.tsx"), "utf8");
const workspaceSource = fs.readFileSync(
  path.join(repoRoot, "client/src/pages/homeid/HomeIdWorkspace.tsx"),
  "utf8"
);
const propertyBlessingsSource = fs.readFileSync(
  path.join(repoRoot, "client/src/pages/homeid/PropertyBlessingsLaunchWorkspace.tsx"),
  "utf8"
);

describe("HomeID focused workspace product contract", () => {
  it("routes the Homes surface into the focused property workspace", () => {
    expect(entrySource).toContain('import HomeIdWorkspace from "./homeid/HomeIdWorkspace"');
    expect(workspaceSource).toContain('data-testid="homeid-workspace"');
  });

  it("routes the Property Blessings master HomeID into dedicated launch control", () => {
    expect(entrySource).toContain("073b355c-1aa3-4658-a776-ebedaa6aaefc");
    expect(entrySource).toContain("PropertyBlessingsLaunchWorkspace");
    expect(entrySource).toContain('mode !== "passport"');
    expect(propertyBlessingsSource).toContain(
      'data-testid="property-blessings-launch-workspace"'
    );
  });

  it("keeps the full property passport available for Property Blessings", () => {
    expect(propertyBlessingsSource).toContain('mode: "passport"');
    expect(propertyBlessingsSource).toContain("Open full property passport");
    expect(propertyBlessingsSource).toContain('passportUrl("property")');
    expect(propertyBlessingsSource).toContain('passportUrl("documents")');
    expect(propertyBlessingsSource).toContain('passportUrl("timeline")');
  });

  it("puts the selected HomeID, stage, facts, systems, decisions, and sources first", () => {
    for (const copy of [
      "Planning facts",
      "Package systems",
      "Decisions needed",
      "Source records",
      "Preconstruction",
      "Property not assigned",
    ]) {
      expect(workspaceSource).toContain(copy);
    }
  });

  it("provides the complete property-passport navigation and primary actions", () => {
    for (const copy of [
      "Overview",
      "Property",
      "Build",
      "Systems",
      "Documents",
      "Timeline",
      "Maintenance",
      "Requests",
      "Sale & Transfer",
      "Add Property",
      "Upload Documents",
      "Continue Planning",
      "Start a Request",
    ]) {
      expect(workspaceSource).toContain(copy);
    }
  });

  it("turns the uploaded package plan into visible Property Blessings execution control", () => {
    for (const copy of [
      "Launch Control",
      "First 90 days",
      "Launch board",
      "Scope Matrix",
      "18-line anchor metal-building scope matrix",
      "Package Levels",
      "Partner Pipeline",
      "No signed partner claim",
      "Source Records",
      "Release Gates",
      "Current launch gate",
      "Open saved scope request",
    ]) {
      expect(propertyBlessingsSource).toContain(copy);
    }
    expect(propertyBlessingsSource).toContain("metadata.launchBoard");
    expect(propertyBlessingsSource).toContain("metadata.partnerPipeline");
    expect(propertyBlessingsSource).toContain("partnerPipeline.primaryTargets");
    expect(propertyBlessingsSource).toContain("metadata.packageExecution");
    expect(propertyBlessingsSource).toContain("packageExecution.anchorScopeMatrix");
    expect(propertyBlessingsSource).toContain("packageExecution.packageLevels");
    expect(propertyBlessingsSource).not.toContain("partnerPipeline.primaryWave");
    expect(propertyBlessingsSource).not.toContain("partnerPipeline.backupAndConditional");
  });

  it("keeps target companies private and clearly unconfirmed", () => {
    expect(propertyBlessingsSource).toContain("Private source-review pipeline");
    expect(propertyBlessingsSource).toContain("No signed partner claim");
    expect(propertyBlessingsSource).toContain("No pay-per-lead requirement");
    expect(propertyBlessingsSource).toContain("Target only").or.toContain("unconfirmed");
  });

  it("keeps source references distinct from stored property files", () => {
    expect(workspaceSource).toContain("Reference only");
    expect(workspaceSource).toContain("Upload a real property document");
    expect(workspaceSource).toContain("No files are stored yet");
    expect(propertyBlessingsSource).toContain(
      "original file not stored as a downloadable attachment"
    );
  });

  it("removes the old generic dashboard-first guidance from the Homes route", () => {
    expect(entrySource).not.toContain("HomeID keeps your home history organized");
    expect(entrySource).not.toContain("Create request details when you need work done");
    expect(entrySource).not.toContain("Building a new home? Track it milestone-by-milestone");
  });
});
