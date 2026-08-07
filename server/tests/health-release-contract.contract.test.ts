import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public /api/health release contract shape", () => {
  it("returns commit and migration compatibility fields without secrets", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const healthStart = source.indexOf('app.get("/api/health"');
    expect(healthStart).toBeGreaterThan(0);
    const healthSlice = source.slice(healthStart, healthStart + 3500);

    expect(healthSlice).toContain("commit");
    expect(healthSlice).toContain("migrations");
    expect(healthSlice).toContain("getMigrationCompatibilityStatus");
    expect(healthSlice).toContain("compatibility");
    expect(healthSlice).toContain("appliedCount");
    expect(healthSlice).toContain("expectedCount");
    expect(healthSlice).toContain("requiredSchemaOk");
    expect(healthSlice).not.toContain("DATABASE_URL");
    expect(healthSlice).not.toContain("SESSION_SECRET");
    expect(healthSlice).not.toContain("password");
  });
});
