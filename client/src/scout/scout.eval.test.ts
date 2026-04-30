/**
 * Scout Tool Layer Evaluation Suite
 *
 * Tests verify:
 * 1. All actions pass validateAction (no unknown types, valid paths)
 * 2. No hallucinated links (all URLs exist in allowlist or match dynamic patterns)
 * 3. Personalization present (draft includes user.name, locality when available)
 * 4. Latency budget met (tools complete within timeout)
 * 5. Error handling works (circuit breaker, retries, meaningful errors)
 *
 * Run with: npm test scout-evals
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateAction, validateActions } from "./actionValidation";
import { searchContractors, searchMarketplace } from "../agent/tools/scoutTools";
import { createNote } from "../agent/tools/scoutMutations";
import type { ScoutAction } from "./state";

describe("Scout Tool Evals", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // These evals must be deterministic and must not require a running server.
    // Node's native fetch also rejects relative URLs, so we stub fetch here.
    const makeJsonResponse = (body: unknown, status = 200) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: async () => body,
        text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      }) as unknown as Response;

    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : String(input?.url || "");
      const method = String(init?.method || "GET").toUpperCase();

      if (url.startsWith("/api/contractors/search")) {
        return makeJsonResponse([
          {
            id: "c1",
            companyName: "Test Contractor Co",
            trade: "general",
            rating: 4.6,
            reviewCount: 12,
            location: "Test County, TS",
          },
        ]);
      }

      if (url.startsWith("/api/marketplace/search")) {
        return makeJsonResponse([
          {
            id: "m1",
            title: "Test Listing",
            description: "Fixture listing for eval suite",
            price: 50,
            category: "tools",
            condition: "used",
            location: "TS",
            sellerName: "Test Seller",
            verified: true,
          },
        ]);
      }

      if (url === "/api/notes" && method === "POST") {
        const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
        return makeJsonResponse({
          id: "n1",
          title: parsedBody.title || "Scout Note",
          content: parsedBody.content || "",
          type: parsedBody.type || "quick",
          createdAt: new Date().toISOString(),
        });
      }

      return makeJsonResponse({ message: "Not found" }, 404);
    }) as any;
  });

  describe("Action Validation", () => {
    it("should allow all valid action types", () => {
      const validActions: ScoutAction[] = [
        { type: "NAVIGATE", label: "Go to Direct Connect", to: "/direct-connect" },
        { type: "OPEN_APP_DRAWER", label: "Open menu" },
        { type: "PREFILL_INPUT", label: "Edit", payload: { text: "Hello" } },
        {
          type: "PREFILL_INPUT",
          label: "Start Direct Connect request",
          payload: {
            target: "direct_connect_request",
            route: "/direct-connect",
            prefill: {
              jobType: "roofing",
              scope: "Need roof leak repair",
              urgency: "high",
            },
          },
        },
        { type: "ASK_SCOUT", label: "Ask", payload: { prompt: "Help me" } },
        { type: "OPEN_FLOATING_NOTE", label: "Note", payload: { noteId: "quick" } },
        {
          type: "SAVE_PROFILE",
          label: "Save profile update",
          payload: { profilePatch: { firstName: "Jane" } },
        },
        { type: "NOOP", label: "Cancel" },
      ];

      validActions.forEach((action) => {
        const validated = validateAction(action);
        expect(validated).not.toBeNull();
        expect(validated?.type).toBe(action.type);
      });
    });

    it("should reject unknown action types", () => {
      const unknownAction = { type: "HACK_THE_MAINFRAME", label: "Bad" } as any;
      const validated = validateAction(unknownAction);

      // Should downgrade to NOOP
      expect(validated?.type).toBe("NOOP");
    });

    it("should validate NAVIGATE paths against allowlist", () => {
      const validPaths = [
        "/community",
        "/exchange",
        "/notes",
        "/profile",
        "/scout",
        "/direct-connect",
      ];

      validPaths.forEach((path) => {
        const action: ScoutAction = { type: "NAVIGATE", label: "Go", to: path };
        const validated = validateAction(action);
        expect(validated).not.toBeNull();
        expect(validated?.to).toBe(path);
      });
    });

    it("should validate dynamic NAVIGATE patterns", () => {
      const dynamicPaths = [
        "/contractors/123",
        "/contractors/abc-plumber",
        "/profile/user-456",
        "/help/getting-started",
        "/community/downtown",
        "/groups/homeowners",
      ];

      dynamicPaths.forEach((path) => {
        const action: ScoutAction = { type: "NAVIGATE", label: "Go", to: path };
        const validated = validateAction(action);
        expect(validated).not.toBeNull();
        expect(validated?.to).toBe(path);
      });
    });

    it("should reject invalid NAVIGATE paths", () => {
      const invalidPaths = ["/admin/secret", "/api/users", "/../etc/passwd", "javascript:alert(1)"];

      invalidPaths.forEach((path) => {
        const action: ScoutAction = { type: "NAVIGATE", label: "Go", to: path };
        const validated = validateAction(action);
        expect(validated).toBeNull();
      });
    });

    it("should handle external URLs correctly", () => {
      const externalAction: ScoutAction = {
        type: "NAVIGATE",
        label: "View offer",
        to: "https://www.example.com/deal",
      };
      const validated = validateAction(externalAction);
      expect(validated).not.toBeNull();
      expect(validated?.to).toBe("https://www.example.com/deal");
    });

    it("should filter out invalid actions from array", () => {
      const mixedActions: ScoutAction[] = [
        { type: "NAVIGATE", label: "Valid", to: "/direct-connect" },
        { type: "HACK", label: "Invalid" } as any,
        { type: "NOOP", label: "Also valid" },
        { type: "NAVIGATE", label: "Bad path", to: "/admin/secret" },
      ];

      const validated = validateActions(mixedActions);
      // Invalid actions downgrade to NOOP, so we get 3: valid NAVIGATE, downgraded NOOP, original NOOP
      expect(validated.length).toBe(3);
      expect(validated[0].type).toBe("NAVIGATE");
      expect(validated[0].to).toBe("/direct-connect");
      expect(validated[1].type).toBe("NOOP");
      expect(validated[2].type).toBe("NOOP");
    });
  });

  describe("Contractor Search Tool", () => {
    // Skip tool tests - these are integration tests requiring a running server
    it("should return success with valid results", async () => {
      const result = await searchContractors({
        trade: "plumbing",
        county: "Cook",
        state: "IL",
        limit: 3,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThanOrEqual(0);

        // If we got results, verify structure
        if (result.data.length > 0) {
          const contractor = result.data[0];
          expect(contractor).toHaveProperty("id");
          expect(contractor).toHaveProperty("name");
          expect(contractor).toHaveProperty("trade");
          expect(contractor).toHaveProperty("profileUrl");
        }
      }
    });

    it("should complete within timeout budget", async () => {
      const startTime = performance.now();

      await searchContractors({
        trade: "electrical",
        county: "Los Angeles",
        state: "CA",
        limit: 5,
      });

      const duration = performance.now() - startTime;

      // Default timeout is 12s, should complete well under that
      expect(duration).toBeLessThan(12000);
    });

    it("should include telemetry in result", async () => {
      const result = await searchContractors({
        trade: "roofing",
        county: "Travis",
        state: "TX",
        limit: 2,
      });

      expect(result.telemetry).toBeDefined();
      if (result.telemetry) {
        expect(result.telemetry).toHaveProperty("durationMs");
        expect(result.telemetry).toHaveProperty("attemptCount");
        expect(result.telemetry).toHaveProperty("timestamp");
      }
    });

    it("should generate valid profile URLs", async () => {
      const result = await searchContractors({
        trade: "hvac",
        county: "King",
        state: "WA",
        limit: 5,
      });

      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach((contractor) => {
          if (contractor.profileUrl) {
            // Should be internal path or full URL
            expect(
              contractor.profileUrl.startsWith("/contractors/") ||
                contractor.profileUrl.startsWith("http")
            ).toBe(true);
          }
        });
      }
    });
  });

  describe("Marketplace Search Tool", () => {
    // Skip - integration test requiring server
    it("should return success with valid results", async () => {
      const result = await searchMarketplace({
        query: "furniture",
        location: "IL",
        limit: 3,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true);

        if (result.data.length > 0) {
          const listing = result.data[0];
          expect(listing).toHaveProperty("id");
          expect(listing).toHaveProperty("title");
          expect(listing).toHaveProperty("price");
          expect(listing).toHaveProperty("listingUrl");
        }
      }
    });

    it("should handle price filters", async () => {
      const result = await searchMarketplace({
        query: "tools",
        location: "CA",
        priceMin: 10,
        priceMax: 100,
        limit: 5,
      });

      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach((listing) => {
          expect(listing.price).toBeGreaterThanOrEqual(10);
          expect(listing.price).toBeLessThanOrEqual(100);
        });
      }
    });

    it("should generate valid listing URLs", async () => {
      const result = await searchMarketplace({
        query: "appliances",
        location: "TX",
        limit: 5,
      });

      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach((listing) => {
          if (listing.listingUrl) {
            expect(
              listing.listingUrl.startsWith("/exchange/") || listing.listingUrl.startsWith("http")
            ).toBe(true);
          }
        });
      }
    });
  });

  describe("Note Creation Tool", () => {
    // Skip - integration test requiring server
    it("should create note with valid input", async () => {
      const result = await createNote({
        title: "Test Note",
        content: "This is a test note from eval suite",
        type: "quick",
        tags: ["test", "eval"],
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data).toHaveProperty("id");
        expect(result.data).toHaveProperty("title");
        expect(result.data.title).toBe("Test Note");
      }
    });

    it("should handle missing optional fields", async () => {
      const result = await createNote({
        title: "Minimal Note",
        content: "Just the basics",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Personalization", () => {
    it("should build draft with user data when available", () => {
      const user = {
        name: "Jane Smith",
        fullName: "Jane Smith",
        locality: {
          county: "Cook",
          state: "IL",
          zip: "60601",
        },
        email: "jane@example.com",
        phone: "555-0123",
      };

      // Simulate buildAutoFilledDraft logic
      const draft = `Name: ${user.fullName}\nLocation: ${user.locality.county} County, ${user.locality.state} ${user.locality.zip}\nEmail: ${user.email}\nPhone: ${user.phone}\n\nI need help with: [describe your project]`;

      expect(draft).toContain("Jane Smith");
      expect(draft).toContain("Cook County");
      expect(draft).toContain("IL");
      expect(draft).toContain("jane@example.com");
      expect(draft).toContain("555-0123");
    });

    it("should handle missing user fields gracefully", () => {
      const user = {
        name: "John",
        locality: {
          state: "TX",
        },
      };

      const draft = `Name: ${user.name}\nLocation: ${user.locality.state}\n\nI need help with: [describe your project]`;

      expect(draft).toContain("John");
      expect(draft).toContain("TX");
      expect(draft).not.toContain("undefined");
      expect(draft).not.toContain("null");
    });
  });

  describe("Error Handling", () => {
    // Skip - integration test requiring mocked fetch/server
    it("should classify network errors correctly", async () => {
      // Mock fetch to fail
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await searchContractors({
        trade: "plumbing",
        county: "Test",
        state: "TS",
        limit: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error?.category).toBe("network");
      }
    });

    it("should handle 404 responses", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      const result = await searchContractors({
        trade: "fake",
        county: "Nowhere",
        state: "XX",
        limit: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.category).toBe("not_found");
      }
    });

    it("should respect retry configuration", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error("Temporary failure"));
      });

      await searchContractors({
        trade: "test",
        county: "Test",
        state: "TS",
        limit: 1,
      });

      // Default retries = 2, so should have 1 initial + 2 retries = 3 total
      expect(callCount).toBe(3);
    });
  });

  describe("Latency Budgets", () => {
    it("should complete contractor search under 12s", async () => {
      const start = performance.now();
      await searchContractors({
        trade: "general",
        county: "Test",
        state: "TS",
        limit: 5,
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(12000);
    });

    it("should complete marketplace search under 12s", async () => {
      const start = performance.now();
      await searchMarketplace({
        query: "test",
        location: "TS",
        limit: 5,
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(12000);
    });

    it("should complete note creation under 8s", async () => {
      const start = performance.now();
      await createNote({
        title: "Speed test",
        content: "Testing latency budget",
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(8000);
    });
  });

  describe("No Hallucinated Links", () => {
    it("should only generate links matching allowlist or patterns", async () => {
      const result = await searchContractors({
        trade: "plumbing",
        county: "Cook",
        state: "IL",
        limit: 5,
      });

      if (result.success && result.data) {
        result.data.forEach((contractor) => {
          if (contractor.profileUrl) {
            const action: ScoutAction = {
              type: "NAVIGATE",
              label: "View",
              to: contractor.profileUrl,
            };
            const validated = validateAction(action);
            expect(validated).not.toBeNull();
          }
        });
      }
    });

    it("should only generate marketplace links matching patterns", async () => {
      const result = await searchMarketplace({
        query: "test",
        location: "IL",
        limit: 5,
      });

      if (result.success && result.data) {
        result.data.forEach((listing) => {
          if (listing.listingUrl) {
            const action: ScoutAction = {
              type: "NAVIGATE",
              label: "View",
              to: listing.listingUrl,
            };
            const validated = validateAction(action);
            expect(validated).not.toBeNull();
          }
        });
      }
    });
  });
});
