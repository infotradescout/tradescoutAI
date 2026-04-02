import { describe, expect, it } from "vitest";
import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Home Maintenance Schedules Contracts", () => {
  it("adds maintenance schedules endpoints under the Home Vault router", () => {
    const src = read("server/routes/homes.ts");
    expect(src).toContain("/api/homes/:homeId/maintenance-schedules");
    expect(src).toContain("/api/provider/maintenance-schedules");
  });

  it("does not expose homeowner street address fields in provider schedule payload code", () => {
    const src = read("server/routes/homes.ts");
    const start = src.indexOf('router.get("/api/provider/maintenance-schedules"');
    expect(start).toBeGreaterThanOrEqual(0);
    const tail = src.slice(start);
    const end =
      tail.indexOf("\nrouter.") > 0 ? tail.indexOf("\nrouter.") : tail.indexOf("\nexport ");
    const block = end > 0 ? tail.slice(0, end) : tail;

    // We should never include address1/address2/zip in the provider response mapping.
    expect(block).not.toContain("address1");
    expect(block).not.toContain("address2");
    expect(block).not.toContain("zipCode");
  });
});
