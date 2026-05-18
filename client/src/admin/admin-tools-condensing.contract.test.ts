import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

function toolBlock(source: string, id: string): string {
  const marker = `id: "${id}"`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\n      tool({", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("admin tools condensing contracts", () => {
  it("keeps procurement inside the Admin OS instead of a parallel admin stack", () => {
    const toolsSource = read("client/src/admin/adminTools.tsx");
    const routesSource = read("client/src/AppRoutes.tsx");
    const procurement = toolBlock(toolsSource, "procurement");

    expect(procurement).toContain('path: "/admin/procurement"');
    expect(procurement).toContain('match: "prefix"');
    expect(procurement).toContain("AdminProcurementRouter");
    expect(routesSource).toContain('<Route path="/admin/procurement">');
    expect(routesSource).toContain("<LazyPage Component={AdminShell} />");
    expect(routesSource).toContain('<RedirectTo to="/admin/procurement" />');
  });

  it("keeps secondary admin tools routable but removes them from primary navigation", () => {
    const source = read("client/src/admin/adminTools.tsx");
    const secondaryToolIds = [
      "provision-user",
      "business-import",
      "homescout-listings",
      "homescout-sources",
      "tradepartner-interest",
      "tradepartner-rsvps",
      "cumulus-intelligence",
      "share-links",
      "platform-analytics",
      "professional-verification",
      "pricing",
      "vault-contributions",
    ];

    for (const id of secondaryToolIds) {
      expect(toolBlock(source, id)).toContain("navHidden: true");
    }
  });
});
