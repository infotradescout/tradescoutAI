import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const entrySource = fs.readFileSync(path.join(repoRoot, "client/src/pages/homes.tsx"), "utf8");
const workspaceSource = fs.readFileSync(
  path.join(repoRoot, "client/src/pages/homeid/HomeIdWorkspace.tsx"),
  "utf8"
);

describe("HomeID focused workspace product contract", () => {
  it("routes the Homes surface into the dedicated property workspace", () => {
    expect(entrySource).toContain('export { default } from "./homeid/HomeIdWorkspace"');
    expect(workspaceSource).toContain('data-testid="homeid-workspace"');
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

  it("keeps source references distinct from stored property files", () => {
    expect(workspaceSource).toContain("Reference only");
    expect(workspaceSource).toContain("Upload a real property document");
    expect(workspaceSource).toContain("No files are stored yet");
  });

  it("removes the old generic dashboard-first guidance from the Homes route", () => {
    expect(entrySource).not.toContain("HomeID keeps your home history organized");
    expect(entrySource).not.toContain("Create request details when you need work done");
    expect(entrySource).not.toContain("Building a new home? Track it milestone-by-milestone");
  });
});
