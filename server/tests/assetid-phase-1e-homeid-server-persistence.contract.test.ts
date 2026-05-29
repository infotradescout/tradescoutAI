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
    expect(src).toContain('status: z.enum(["draft", "needs_info", "ready_for_handoff"])');
    expect(src).toContain('status: z.enum(["known", "needs_review"])');
  });

  it("persists by authenticated home owner scope using database records", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain("const home = await requireHomeOwner(userId, homeId)");
    expect(src).toContain("async function loadHomeIdPersistenceFromDb(");
    expect(src).toContain(".from(userHomeRecords)");
    expect(src).toContain("HOMEID_PERSISTENCE_PROPERTY_DETAILS_TITLE");
    expect(src).toContain("HOMEID_PERSISTENCE_REQUEST_PACKETS_TITLE");
  });

  it("keeps endpoint contract and supports read-after-write flow", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain('return res.status(401).json({ message: "Authentication required" })');
    expect(src).toContain('return res.status(404).json({ message: "Home not found" })');
    expect(src).toContain("const existing = await loadHomeIdPersistenceFromDb(homeId, userId)");
    expect(src).toContain("requestPackets: existing?.requestPackets || []");
    expect(src).toContain("propertyDetails: existing?.propertyDetails || []");
  });
});
