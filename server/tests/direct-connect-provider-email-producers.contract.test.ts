import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("server/routes/direct-connect.ts", "utf8");

describe("normal Direct Connect provider email producers", () => {
  it("enrolls only the normal routed, requester-selected, and new-request targeted provider notifications", () => {
    const producers = [
      ...source.matchAll(
        /notificationService\.createAssignedProviderNotification\(\s*\{[\s\S]*?\},\s*(?:requestId|String\(created\.id\))\s*\);/g
      ),
    ].map((match) => match[0]);
    expect(producers).toHaveLength(3);
    for (const producer of producers) {
      expect(producer).toContain('type: "new_project_request"');
      expect(producer).toContain('actionUrl: "/direct-connect/inbox"');
      expect(producer).toContain('deliveryMethods: ["in_app", "push"]');
      expect(producer).not.toContain('deliveryMethods: ["email"]');
    }
  });

  it("keeps staff-targeted and oversight producers outside the normal provider email enrollment path", () => {
    const marker = source.indexOf("// Staff-directed explicit targeting");
    expect(marker).toBeGreaterThan(0);
    expect(source.slice(marker)).not.toContain("createAssignedProviderNotification(");
    expect(source).toContain('deliveryMethods: ["in_app"]');
  });

  it("reuses canonical county, trade and public trust eligibility at the worker boundary", () => {
    expect(source).toContain("notificationService.configureDirectConnectEmailEligibility");
    const validator = source.slice(
      source.indexOf("notificationService.configureDirectConnectEmailEligibility"),
      source.indexOf("const routeRequestToTopContractors")
    );
    expect(validator).toContain("filterContractorsEligibleForRequest([contractor], request)");
    expect(validator).toContain("filterBusinessesEligibleForRequest([business], request)");
    expect(validator).toContain("return false;");
    expect(source).toContain("businessId: isBusinessProvider ? candidate.id : null");
  });
});
