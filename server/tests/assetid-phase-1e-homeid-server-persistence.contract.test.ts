import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HOMES_ROUTE_FILE = path.resolve(__dirname, "../routes/homes.ts");

function read(file: string) {
  return fs.readFileSync(file, "utf8");
}

describe("AssetID Phase 1E server persistence contracts", () => {
  it("adds HomeID persistence endpoints", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain('router.get("/api/homeid/:homeId/persistence"');
    expect(src).toContain('router.put("/api/homeid/:homeId/property-details"');
    expect(src).toContain('router.put("/api/homeid/:homeId/request-packets"');
  });

  it("validates property details and request packet payload contracts", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain("const homeIdPropertyDetailSchema = z.object(");
    expect(src).toContain("const homeIdRequestPacketSchema = z.object(");
    expect(src).toContain('status: z.enum(["draft", "ready", "needs_info"])');
    expect(src).toContain('status: z.enum(["known", "needs_review"])');
  });

  it("persists by authenticated home owner scope", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain("const key = `${userId}:${homeId}`");
    expect(src).toContain("const home = await requireHomeOwner(userId, homeId)");
    expect(src).toContain("homeIdPersistenceStore.set(key, persistence)");
  });
});
