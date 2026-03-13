import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("commercial directory verification status contract", () => {
  it("returns an eligibility payload instead of 404 when the user has no contractor profile", () => {
    const source = read("server/routes/commercial-directory.ts");
    expect(source).toContain('"/api/commercial-directory/verification/status"');
    expect(source).toContain("contractorId: null");
    expect(source).toContain('requires: ["contractor_profile"]');
    expect(source).toContain('reason: "missing_contractor_profile"');
    expect(source).toContain("documents: []");
    expect(source).not.toContain(
      'return res.status(404).json({\n            message: "Contractor profile not found.",'
    );
  });
});
