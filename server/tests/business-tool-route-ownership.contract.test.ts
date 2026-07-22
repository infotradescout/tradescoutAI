import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("business tool route ownership", () => {
  it("protects the authenticated business operations dashboard", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const start = routes.indexOf('<Route path="/business-dashboard">');
    const block = routes.slice(start, start + 260);

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("<ProtectedRoute>");
    expect(block).toContain("<LazyPage Component={BusinessOwnerDashboard} />");
  });

  it("retires the fabricated public analytics and CRM surfaces to canonical tools", () => {
    const routes = read("client/src/AppRoutes.tsx");

    expect(routes).toContain('<RedirectTo to="/business-dashboard" />');
    expect(routes).toContain('<RedirectTo to="/finances/clients" />');
    expect(routes).not.toContain("<LazyPage Component={Analytics} />");
    expect(routes).not.toContain("<LazyPage Component={CRM} />");
  });
});
