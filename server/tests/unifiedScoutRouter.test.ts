import { beforeEach, describe, expect, it } from "vitest";
import {
  FEATURE_ROUTING_MAP,
  SCOUT_ACTION_REGISTRY,
  UnifiedScoutRouter,
  type UnifiedScoutUserContext,
} from "../services/unifiedScoutRouter";

describe("UnifiedScoutRouter", () => {
  let guest: UnifiedScoutUserContext;
  let homeowner: UnifiedScoutUserContext;
  let admin: UnifiedScoutUserContext;

  beforeEach(() => {
    guest = { isAuthenticated: false };
    homeowner = { userId: "user-1", isAuthenticated: true, userRole: "homeowner" };
    admin = { userId: "admin-1", isAuthenticated: true, userRole: "super_admin" };
  });

  describe("validateAction", () => {
    it("allows basic navigation for guests", () => {
      const result = UnifiedScoutRouter.validateAction(
        { type: "NAVIGATE", to: "/community" },
        guest
      );
      expect(result.valid).toBe(true);
    });

    it("blocks auth-required actions for guests", () => {
      const result = UnifiedScoutRouter.validateAction(
        { type: "FOLLOW_USER", payload: { userId: "target-1" } },
        guest
      );
      expect(result.valid).toBe(false);
      expect(result.metadata?.requiresAuth).toBe(true);
    });

    it("blocks admin broadcast for non-admin roles", () => {
      const result = UnifiedScoutRouter.validateAction(
        { type: "SEND_ADMIN_BROADCAST", payload: { title: "x", message: "y" } },
        homeowner
      );
      expect(result.valid).toBe(false);
      expect(result.metadata?.requiresRole).toBe("admin");
    });

    it("allows admin broadcast for super admins", () => {
      const result = UnifiedScoutRouter.validateAction(
        { type: "SEND_ADMIN_BROADCAST", payload: { title: "x", message: "y" } },
        admin
      );
      expect(result.valid).toBe(true);
    });

    it("rejects unsafe navigation urls", () => {
      const result = UnifiedScoutRouter.validateAction(
        { type: "NAVIGATE", to: "http://evil.example.com" },
        guest
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("resolveIntent", () => {
    it("routes direct-connect intent deterministically", () => {
      const result = UnifiedScoutRouter.resolveIntent("Open Direct Connect", guest);
      expect(result).not.toBeNull();
      expect(result?.action.type).toBe("NAVIGATE");
      expect(result?.action.to).toBe("/direct-connect");
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it("returns null when no feature keywords match", () => {
      const result = UnifiedScoutRouter.resolveIntent("This has no known feature words", guest);
      expect(result).toBeNull();
    });
  });

  describe("feature discovery + fallbacks", () => {
    it("discovers features by query keywords", () => {
      const matches = UnifiedScoutRouter.discoverFeatures("community groups", guest);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.featureId === "community")).toBe(true);
    });

    it("generates valid fallback actions for guests", () => {
      const actions = UnifiedScoutRouter.generateFallbackActions("unknown", "no_match", guest);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(UnifiedScoutRouter.validateAction(action, guest).valid).toBe(true);
      }
    });
  });

  describe("registry integrity", () => {
    it("keeps action registry keyed by action type", () => {
      for (const [type, definition] of Object.entries(SCOUT_ACTION_REGISTRY)) {
        expect(definition.type).toBe(type);
      }
    });

    it("keeps feature routes keyed by feature id", () => {
      for (const [featureId, route] of Object.entries(FEATURE_ROUTING_MAP)) {
        expect(route.featureId).toBe(featureId);
      }
    });
  });
});
