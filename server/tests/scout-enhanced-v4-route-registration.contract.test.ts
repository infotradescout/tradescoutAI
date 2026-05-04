import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("scout enhanced v4 route registration", () => {
  it("mounts the enhanced v4 router at the endpoint used by Scout proxy", () => {
    const routes = read("server/routes.ts");
    const scout = read("server/routes/scout.ts");
    const enhancedV4 = read("server/routes/scout-enhanced-v4.ts");

    expect(routes).toContain('await import("./routes/scout-enhanced-v4")');
    expect(routes).toContain('app.use("/api/scout-enhanced-v4", scoutEnhancedV4Router)');
    expect(scout).toContain("/api/scout-enhanced-v4/message-v4");
    expect(enhancedV4).toContain('router.post("/message-v4"');
  });

  it("keeps enhanced v4 opt-in instead of making it the default Scout engine", () => {
    const scout = read("server/routes/scout.ts");

    expect(scout).toContain(': "classic";');
    expect(scout).toContain("? false");
    expect(scout).toContain("const wantsEnhancedV4 = scoutEnhancedEnabled && isEnhancedEngine");
  });
});
