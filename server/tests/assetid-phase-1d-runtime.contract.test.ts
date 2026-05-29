import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HOMES_ROUTE_FILE = path.resolve(__dirname, "../routes/homes.ts");

function read(file: string) {
  return fs.readFileSync(file, "utf8");
}

describe("AssetID Phase 1D runtime contracts", () => {
  it("adds HomeID creation endpoint with required home type contract", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain('router.post("/api/homeid/create"');
    expect(src).toContain("homeType: z.enum(HOME_TYPES)");
    expect(src).toContain("creatorRole: z.enum(HOME_CREATOR_ROLES)");
  });

  it("adds HomeID dashboard endpoint with completion scoring and readiness", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain('router.get("/api/homes/:homeId/homeid-dashboard"');
    expect(src).toContain("completionScore");
    expect(src).toContain("buyerPacketReadiness");
    expect(src).toContain("handoffReady");
  });

  it("adds scoped request packet and request-evidence proposal endpoints", () => {
    const src = read(HOMES_ROUTE_FILE);
    expect(src).toContain('router.post("/api/homes/:homeId/homeid/request-packet"');
    expect(src).toContain('"/api/homes/:homeId/homeid/request-evidence-proposal"');
    expect(src).toContain("selectedFields");
    expect(src).toContain('verificationStatus: "proposed"');
  });
});
