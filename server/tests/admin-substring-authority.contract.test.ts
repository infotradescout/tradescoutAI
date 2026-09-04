import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const accessControlFiles = [
  "client/src/components/ProtectedRoute.tsx",
  "client/src/lib/roleChecks.ts",
  "server/capabilities.ts",
  "server/routes/recommendation-generator.ts",
] as const;

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("admin substring authority contract", () => {
  it.each(accessControlFiles)("does not grant access from admin substrings in %s", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/\.includes\(\s*["']admin["']\s*\)/);
    expect(source).not.toMatch(/includes\(\s*["']admin["']/);
  });

  it("uses canonical persisted admin tiers for business-onboarding transition authority", () => {
    const routes = read("server/routes.ts");
    const start = routes.indexOf('app.patch(\n    "/api/user/business-onboarding"');
    const end = routes.indexOf('app.post(\n    "/api/user/complete-onboarding"', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = routes.slice(start, end);

    expect(section).toContain("collectAuthorityRoles(currentUser)");
    expect(section).toContain("isAdminTierRole(role)");
    expect(section).not.toContain('roleToken === "admin"');
  });
});
