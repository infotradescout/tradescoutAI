import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("scout v2 route registration", () => {
  it("mounts Scout 2.0 and exposes the new scout intelligence source kind", () => {
    const routes = read("server/routes.ts");
    const lisa = read("shared/lisa.ts");
    const runtime = read("server/services/lisaRuntime.ts");
    const route = read("server/routes/scout-v2.ts");

    expect(routes).toContain('await import("./routes/scout-v2")');
    expect(routes).toContain('app.use("/api/scout-v2", scoutV2Router)');
    expect(routes).toContain('app.use("/api/scout-v2-learning", scoutV2Router)');
    expect(routes).toContain('app.use("/api/scout-heatmap", scoutV2Router)');
    expect(lisa).toContain('"scout_intelligence"');
    expect(runtime).toContain("scout_intelligence");
    expect(runtime).toContain("scout_lisa_findings");
    expect(route).toContain("router.use(requireAdmin);");
    expect(route).toContain('router.get("/status"');
  });
});
