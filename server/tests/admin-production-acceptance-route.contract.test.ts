import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routes = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/professional-partnerships.ts"),
  "utf8"
);

describe("production acceptance route registration", () => {
  it("registers authenticated JSON and human-readable reports", () => {
    expect(routes).toContain('"/api/admin/production-acceptance"');
    expect(routes).toContain('"/api/admin/production-acceptance/run"');
    expect(routes).toContain('"/admin/production-acceptance"');
    expect(routes).toContain('"/admin/acceptance"');
    expect(routes).toContain("renderAdminProductionAcceptanceHtml");
    expect(routes).toContain("runAdminProductionAcceptance");
  });
});
