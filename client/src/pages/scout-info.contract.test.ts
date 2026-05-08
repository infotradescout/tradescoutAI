import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("scout info page", () => {
  it("mounts the Scout info route and links it from Scout OS", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const scoutOs = read("client/src/scout/ScoutOS.tsx");
    const scoutInfo = read("client/src/pages/scout-info.tsx");
    const showcase = read("client/src/pages/scout-info-showcase.tsx");

    expect(routes).toContain(
      'const ScoutInfoPage = React.lazy(() => import("./pages/scout-info"))'
    );
    expect(routes).toContain('path="/help/scout"');
    expect(routes).toContain('path="/scout-info"');
    expect(routes).toContain('RedirectTo to="/help/scout"');
    expect(scoutOs).toContain('navigate("/help/scout")');
    expect(scoutInfo).toContain('export { default } from "./scout-info-showcase"');
    expect(showcase).toContain("Scout Help");
    expect(showcase).toContain("Search TradeScout and your area");
    expect(showcase).toContain("Where Scout looks");
    expect(showcase).toContain("Before contact");
    expect(showcase).toContain("Search everything");
    expect(showcase).toContain("search the site and find nearby help");
    expect(showcase).toContain("How Scout Works");
    expect(showcase).toContain("Scout is for everyone");
    expect(showcase).toContain("not yet indexed");
    expect(showcase).toContain("Seeing someone does not mean sharing contact info");
  });
});
