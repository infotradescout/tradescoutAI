import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBidRockProviderHandoffActionCapability,
  canBidRockViewerMutateStoneInventory,
  type BidRockViewerContext,
} from "../services/bidrockService";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function viewer(overrides: Partial<BidRockViewerContext> = {}): BidRockViewerContext {
  return {
    userId: "seller-user",
    admin: false,
    verifiedBusiness: true,
    businessProfileId: "business-profile",
    accountStatus: "active",
    ownedBusinessIds: new Set(["holder-business"]),
    readableInventoryBusinessIds: new Set(["holder-business"]),
    writableInventoryBusinessIds: new Set(["holder-business"]),
    publishableInventoryBusinessIds: new Set(["holder-business"]),
    ...overrides,
  };
}

describe("BidRock last narrow correction", () => {
  it("requires an active verified entitlement and the exact Stone mutation scope", () => {
    expect(
      canBidRockViewerMutateStoneInventory(viewer(), "holder-business", "inventory_write")
    ).toBe(true);
    expect(
      canBidRockViewerMutateStoneInventory(
        viewer({ accountStatus: "suspended", verifiedBusiness: false }),
        "holder-business",
        "inventory_write"
      )
    ).toBe(false);
    expect(
      canBidRockViewerMutateStoneInventory(
        viewer({ accountStatus: "revoked", verifiedBusiness: false }),
        "holder-business",
        "inventory_publish"
      )
    ).toBe(false);
    expect(
      canBidRockViewerMutateStoneInventory(
        viewer({ publishableInventoryBusinessIds: new Set() }),
        "holder-business",
        "inventory_publish"
      )
    ).toBe(false);
    expect(
      canBidRockViewerMutateStoneInventory(
        viewer({ writableInventoryBusinessIds: new Set() }),
        "holder-business",
        "inventory_write"
      )
    ).toBe(false);
    expect(
      canBidRockViewerMutateStoneInventory(
        viewer({ admin: true, accountStatus: "none", verifiedBusiness: false }),
        "other-business",
        "inventory_publish"
      )
    ).toBe(true);

    const routes = read("server/routes/stone-inventory.ts");
    expect(routes.match(/managedMutationTarget\(req, res, "inventory_write"\)/g)).toHaveLength(2);
    expect(routes.match(/managedMutationTarget\(req, res, "inventory_publish"\)/g)).toHaveLength(1);
    expect(routes).toContain("Active verified BidRock seller entitlement");
  });

  it("conflict-checks and merges actual legacy replay-order-status evidence before deletion", () => {
    const migration = read("migrations/0118_bidrock_marketplace.sql");
    const table = migration.indexOf("CREATE TABLE IF NOT EXISTS bidrock_handoffs");
    const conflict = migration.indexOf("Conflicting duplicate BidRock handoff replay order status");
    const merge = migration.indexOf("-- Merge only replay-order statuses present");
    const deletion = migration.indexOf("DELETE FROM bidrock_handoffs handoff");

    expect(conflict).toBeGreaterThan(table);
    expect(merge).toBeGreaterThan(conflict);
    expect(deletion).toBeGreaterThan(merge);
    expect(migration).toContain("handoff.metadata->'_bidrockReplayOrderStatuses'");
    expect(migration).toContain("jsonb_object_agg(key, order_status ORDER BY key)");
    expect(migration).toContain("'{_bidrockReplayOrderStatuses}'");
    expect(migration.slice(merge, deletion)).not.toContain("jsonb_build_object(");
  });

  it("computes provider actions from payment, custody, order, and handoff state", () => {
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "freight",
        orderStatus: "reservation_active",
      })
    ).toMatchObject({ nextStatus: "pending", enabled: false });
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "freight",
        orderStatus: "paid",
      })
    ).toEqual({
      handoffType: "freight",
      nextStatus: "pending",
      enabled: true,
      disabledReason: null,
    });
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "freight",
        orderStatus: "freight",
        currentHandoffStatus: "pending",
      })
    ).toMatchObject({ nextStatus: "in_progress", enabled: true });
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "fabrication",
        orderStatus: "custody_transferred",
      })
    ).toMatchObject({ enabled: false, disabledReason: expect.stringContaining("custody") });
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "fabrication",
        orderStatus: "custody_transferred",
        completedHandoffTypes: ["custody"],
      })
    ).toMatchObject({ nextStatus: "pending", enabled: true });
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "custody",
        orderStatus: "custody_transferred",
        currentHandoffStatus: "completed",
        completedHandoffTypes: ["custody"],
      })
    ).toMatchObject({ nextStatus: "completed", enabled: false });
  });

  it("rejects a new freight handoff after the order has reached fabrication", () => {
    expect(
      buildBidRockProviderHandoffActionCapability({
        handoffType: "freight",
        orderStatus: "fabrication",
      })
    ).toEqual({
      handoffType: "freight",
      nextStatus: "pending",
      enabled: false,
      disabledReason: "The current order state does not permit this handoff.",
    });
  });

  it("permits only the next forward freight handoff status", () => {
    const forwardSteps = [
      { currentHandoffStatus: null, nextStatus: "pending" },
      { currentHandoffStatus: "pending", nextStatus: "in_progress" },
      { currentHandoffStatus: "in_progress", nextStatus: "completed" },
    ] as const;

    for (const step of forwardSteps) {
      expect(
        buildBidRockProviderHandoffActionCapability({
          handoffType: "freight",
          orderStatus: "paid",
          currentHandoffStatus: step.currentHandoffStatus,
        })
      ).toMatchObject({ nextStatus: step.nextStatus, enabled: true });
    }
  });

  it("gates each new handoff write with the DTO capability after replay and prerequisites", () => {
    const service = read("server/services/bidrockService.ts");
    const recordStart = service.indexOf("export async function recordBidRockHandoff");
    const recordEnd = service.indexOf("export async function completeBidRockOrder", recordStart);
    const record = service.slice(recordStart, recordEnd);
    const replay = record.indexOf("const priorFingerprint");
    const prerequisites = record.indexOf("const completedPrerequisites");
    const capability = record.indexOf("const mutationCapability");
    const mutation = record.indexOf("const handoff = prior");

    expect(recordStart).toBeGreaterThan(-1);
    expect(recordEnd).toBeGreaterThan(recordStart);
    expect(replay).toBeGreaterThan(-1);
    expect(prerequisites).toBeGreaterThan(replay);
    expect(capability).toBeGreaterThan(prerequisites);
    expect(mutation).toBeGreaterThan(capability);
    expect(record).toContain("if (!mutationCapability.enabled)");
    expect(record).toContain("if (args.status !== mutationCapability.nextStatus)");
  });

  it("returns redacted server capabilities and makes provider UI consume them directly", () => {
    const service = read("server/services/bidrockService.ts");
    const client = read("client/src/features/bidrock/BidRockOrderSheet.tsx");
    const clientTypes = read("client/src/features/bidrock/bidrockClient.ts");

    expect(service).toContain("handoffActions: delegatedTypes.map");
    expect(service).toContain("handoffActions: handoffTypes.map");
    expect(service).not.toContain("allowedHandoffTypes: delegatedTypes");
    expect(clientTypes).not.toContain("allowedHandoffTypes");
    expect(client).toContain("selectedProviderAction?.nextStatus");
    expect(client).toContain("selectedAction?.enabled !== true");
    expect(client).toContain("selectedAction.disabledReason");
  });
});
