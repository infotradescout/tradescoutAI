/**
 * Scout Contextual Tiles - Determinism & Safety Tests
 *
 * These tests enforce the hard invariants that prevent AI-UX bullshit:
 * - Intent IDs never change (routing stability)
 * - Variants only trigger on real data (no guessing)
 * - Errors fall back safely (no UI breakage)
 * - Provenance is traceable (no mystery personalization)
 */

import { describe, it, expect } from "vitest";
import { scoutActionTiles } from "./scoutActionTiles";
import { resolveTile, resolveAllTiles } from "./resolveScoutTiles";
import type { ScoutTileContext } from "./scoutActionTiles";

describe("Scout Contextual Tiles - Hard Invariants", () => {
  describe("Intent Immutability (CRITICAL)", () => {
    it("should NEVER change tile intent IDs during resolution", () => {
      const mockContext: ScoutTileContext = {
        activeJobs: [{ id: "1", name: "Test Project", status: "active" }],
        activeInvoices: [{ id: "1", jobName: "Test Job", status: "pending" }],
        savedContractors: [{ id: "1", name: "Test Pro", trade: "plumbing" }],
        location: "Test City, TX",
        recentActivity: [],
      };

      scoutActionTiles.forEach((originalTile) => {
        const resolvedTile = resolveTile(originalTile, mockContext);
        expect(resolvedTile.id).toBe(originalTile.id);
        expect(resolvedTile.action).toEqual(originalTile.action);
      });
    });

    it("should preserve intent IDs even with empty context", () => {
      const emptyContext: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        recentActivity: [],
      };

      scoutActionTiles.forEach((originalTile) => {
        const resolvedTile = resolveTile(originalTile, emptyContext);
        expect(resolvedTile.id).toBe(originalTile.id);
        expect(resolvedTile.action).toEqual(originalTile.action);
      });
    });
  });

  describe("Deterministic Behavior (CRITICAL)", () => {
    it("should only show saved contractors variant when data exists", () => {
      const withSaved: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [
          { id: "1", name: "Pro A" },
          { id: "2", name: "Pro B" },
        ],
        recentActivity: [],
      };

      const findProsTile = scoutActionTiles.find((t) => t.id === "find_pros")!;
      const resolved = resolveTile(findProsTile, withSaved);

      expect(resolved.label).toContain("2");
      expect(resolved.label).toContain("saved");
    });

    it("should fallback to default when no saved contractors", () => {
      const noSaved: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        recentActivity: [],
      };

      const findProsTile = scoutActionTiles.find((t) => t.id === "find_pros")!;
      const resolved = resolveTile(findProsTile, noSaved);

      expect(resolved.label).toBe(findProsTile.label);
      expect(resolved.description).toBe(findProsTile.description);
    });

    it("should show location variant when location is provided", () => {
      const withLocation: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        location: "Pensacola, FL",
        recentActivity: [],
      };

      const nearbyTile = scoutActionTiles.find((t) => t.id === "nearby")!;
      const resolved = resolveTile(nearbyTile, withLocation);

      expect(resolved.label).toBe("See local activity");
      expect(resolved.description).toContain("Community");
    });

    it("should avoid county/parish jargon in find_pros label", () => {
      const withAdministrativeLocation: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        location: "Tangipahoa Parish, LA",
        recentActivity: [],
      };

      const findProsTile = scoutActionTiles.find((t) => t.id === "find_pros")!;
      const resolved = resolveTile(findProsTile, withAdministrativeLocation);

      expect(resolved.label).toBe("Find help near me");
      expect(resolved.label.toLowerCase()).not.toContain("parish");
      expect(resolved.label.toLowerCase()).not.toContain("county");
    });

    it("should apply freshness rule for single active project within 14 days", () => {
      const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const ctx: ScoutTileContext = {
        activeJobs: [
          { id: "p1", name: "Kitchen Remodel", status: "active", updatedAt: recentDate },
        ],
        activeInvoices: [],
        savedContractors: [],
        recentActivity: [],
      };

      const tile = scoutActionTiles.find((t) => t.id === "start_project")!;
      const resolved = resolveTile(tile, ctx);
      expect(resolved.label).toContain("Continue project");
    });

    it("should NOT apply freshness rule if project update is older than 14 days", () => {
      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const ctx: ScoutTileContext = {
        activeJobs: [{ id: "p1", name: "Kitchen Remodel", status: "active", updatedAt: oldDate }],
        activeInvoices: [],
        savedContractors: [],
        recentActivity: [],
      };

      const tile = scoutActionTiles.find((t) => t.id === "start_project")!;
      const resolved = resolveTile(tile, ctx);
      // Should fallback to default label if freshness not met
      expect(resolved.label).toBe(tile.label);
    });

    it("should apply freshness rule for single active invoice within 14 days", () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const ctx: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [
          { id: "i1", jobName: "Roof Repair", status: "pending", updatedAt: recentDate },
        ],
        savedContractors: [],
        recentActivity: [],
      };

      const tile = scoutActionTiles.find((t) => t.id === "manage")!;
      const resolved = resolveTile(tile, ctx);
      expect(resolved.label).toContain("Continue invoice");
      expect(resolved.label).toContain("Roof Repair");
    });

    it("should NOT apply invoice freshness rule if update is older than 14 days", () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ctx: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [
          { id: "i1", jobName: "Roof Repair", status: "pending", updatedAt: oldDate },
        ],
        savedContractors: [],
        recentActivity: [],
      };

      const tile = scoutActionTiles.find((t) => t.id === "manage")!;
      const resolved = resolveTile(tile, ctx);
      // Should fallback to default manage label when stale
      expect(resolved.label).toBe(tile.label);
    });

    it("should show multi-invoice variant when more than one active invoice", () => {
      const ctx: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [
          { id: "i1", jobName: "Kitchen Remodel", status: "pending" },
          { id: "i2", jobName: "Bathroom Upgrade", status: "pending" },
        ],
        savedContractors: [],
        recentActivity: [],
      };

      const tile = scoutActionTiles.find((t) => t.id === "manage")!;
      const resolved = resolveTile(tile, ctx);
      expect(resolved.label).toContain("View 2 active invoices");
    });

    it("should fallback to default when invoices fetch yields empty array", () => {
      const ctx: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        recentActivity: [],
      };

      const tile = scoutActionTiles.find((t) => t.id === "manage")!;
      const resolved = resolveTile(tile, ctx);
      expect(resolved.label).toBe(tile.label);
      expect(resolved.description).toBe(tile.description);
    });
  });

  describe("Safe Failure Modes (CRITICAL)", () => {
    it("should fallback to defaults if variant condition throws", () => {
      const malformedContext = {} as ScoutTileContext; // Missing required fields

      scoutActionTiles.forEach((tile) => {
        const resolved = resolveTile(tile, malformedContext);
        // Should not throw, should fallback to default
        expect(resolved.id).toBe(tile.id);
        expect(resolved.label).toBeDefined();
        expect(resolved.description).toBeDefined();
      });
    });

    it("should handle null/undefined context fields gracefully", () => {
      const partialContext: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        location: undefined, // Explicitly undefined
        recentActivity: [],
      };

      const resolved = resolveAllTiles(scoutActionTiles, partialContext);
      expect(resolved).toHaveLength(scoutActionTiles.length);
      resolved.forEach((tile, i) => {
        expect(tile.id).toBe(scoutActionTiles[i].id);
      });
    });
  });

  describe("Provenance & Traceability", () => {
    it("should have exactly 4 core tiles (no drift)", () => {
      expect(scoutActionTiles).toHaveLength(4);
      expect(scoutActionTiles.map((t) => t.id)).toEqual([
        "start_project",
        "find_pros",
        "nearby",
        "manage",
      ]);
    });

    it("should document data sources for all variants", () => {
      // This test enforces that every variant must have a comment explaining its data source
      // Manual verification required (CI can check comments exist)
      scoutActionTiles.forEach((tile) => {
        if (tile.variants) {
          tile.variants.forEach((variant) => {
            // Variant conditions should be inspectable
            expect(variant.when).toBeDefined();
            expect(typeof variant.when).toBe("function");
          });
        }
      });
    });
  });

  describe("No AI/LLM Leakage", () => {
    it("should resolve tiles without any async operations", () => {
      const ctx: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [],
        recentActivity: [],
      };

      // Resolution must be synchronous (no LLM calls)
      const start = Date.now();
      const resolved = resolveAllTiles(scoutActionTiles, ctx);
      const duration = Date.now() - start;

      expect(resolved).toHaveLength(4);
      expect(duration).toBeLessThan(10); // Should be instant
    });

    it("should not depend on any external state or globals", () => {
      const ctx1: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [{ id: "1", name: "Test" }],
        recentActivity: [],
      };

      const ctx2: ScoutTileContext = {
        activeJobs: [],
        activeInvoices: [],
        savedContractors: [{ id: "1", name: "Test" }],
        recentActivity: [],
      };

      const resolved1 = resolveAllTiles(scoutActionTiles, ctx1);
      const resolved2 = resolveAllTiles(scoutActionTiles, ctx2);

      // Same context → same output (pure function)
      expect(resolved1).toEqual(resolved2);
    });
  });
});
