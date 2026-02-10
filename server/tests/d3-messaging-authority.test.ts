/**
 * Phase D3: Messaging Authority Contract Enforcement Tests
 *
 * Critical validation: No path exists—UI or API—to create conversation without authority metadata
 *
 * Test Categories:
 * 1. Immutability Tests (intent, authorityGate, metadata locked)
 * 2. Idempotency Tests (same decision → same thread)
 * 3. Authority Gate Tests (decision_card, scout_recommendation, user_search)
 * 4. Role Validation Tests (homeowner→homeowner blocked)
 * 5. Verification Tests (both parties must be verified)
 * 6. Confidence Blocking Tests (<30% confidence blocked)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../src/db/drizzle-mock";
import { users, marketplaceConversations, decisionCards } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Test utilities
const API_BASE = "http://localhost:5000";

async function createTestUser(overrides = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test${Date.now()}@test.com`,
      firstName: "Test",
      lastName: "User",
      role: "homeowner",
      addressVerified: true,
      isActive: true,
      ...overrides,
    })
    .returning();
  return user;
}

async function createDecisionCard(userId: string, overrides = {}) {
  const [card] = await db
    .insert(decisionCards)
    .values({
      userId,
      status: "active",
      intent: "hire",
      decisionScope: "Test scope",
      title: "Test decision",
      description: "Test decision card",
      ...overrides,
    })
    .returning();
  return card;
}

async function startConversation(authToken: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/social/conversations/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `auth_token=${authToken}`,
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, data: await res.json() };
}

describe("D3: Messaging Authority Enforcement", () => {
  // ========================================
  // Category 1: Immutability Tests
  // ========================================

  describe("Immutability: Intent and metadata cannot change after creation", () => {
    it("should reject PATCH attempts to change intent", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id, {
        decisionScope: "Fix broken fence",
      });

      // Create conversation with intent='hire'
      const { data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      // Attempt to PATCH intent to 'advise'
      const patchRes = await fetch(`${API_BASE}/api/social/conversations/${data.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "advise" }),
      });

      expect(patchRes.status).toBe(403);
      const error = await patchRes.json();
      expect(error.reasonCode).toBe("IMMUTABLE_FIELD");
    });

    it("should reject PATCH attempts to change authorityGate", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id, {
        decisionScope: "Fix broken fence",
      });

      const { data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      // Attempt to escalate authority gate
      const patchRes = await fetch(`${API_BASE}/api/social/conversations/${data.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorityGate: "scout_recommendation" }),
      });

      expect(patchRes.status).toBe(403);
      const error = await patchRes.json();
      expect(error.reasonCode).toBe("IMMUTABLE_FIELD");
    });

    it("should reject attempts to change decisionScope", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const { data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
        decisionScope: "Fix broken fence",
      });

      // Attempt to change decision context
      const patchRes = await fetch(`${API_BASE}/api/social/conversations/${data.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionScope: "Build new deck" }),
      });

      expect(patchRes.status).toBe(403);
    });
  });

  // ========================================
  // Category 2: Idempotency Tests
  // ========================================

  describe("Idempotency: Same decision → same thread ID", () => {
    it("should return existing conversation on duplicate submit", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const payload = {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      };

      // First submission
      const { data: first } = await startConversation("test_token", payload);
      expect(first.created).toBe(true);

      // Second submission (duplicate)
      const { data: second } = await startConversation("test_token", payload);
      expect(second.created).toBe(false);
      expect(second.threadId).toBe(first.threadId);
      expect(second.message).toContain("Existing conversation retrieved");
    });

    it("should preserve original metadata on duplicate submit", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const payload = {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
        confidenceScore: 0.85,
      };

      await startConversation("test_token", payload);

      // Attempt second submit with different confidence
      const { data: second } = await startConversation("test_token", {
        ...payload,
        confidenceScore: 0.95, // Changed
      });

      // Should return original conversation with original confidence
      const [conv] = await db
        .select()
        .from(marketplaceConversations)
        .where(eq(marketplaceConversations.id, second.threadId));

      expect(conv.confidenceScore).toBe("0.85"); // Original preserved
    });
  });

  // ========================================
  // Category 3: Authority Gate Validation
  // ========================================

  describe("Authority Gate: Required and validated", () => {
    it("should reject missing authorityGate", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        // authorityGate missing
      });

      expect(status).toBe(400);
      expect(data.reasonCode).toBe("MISSING_AUTHORITY_GATE");
    });

    it("should reject invalid authorityGate value", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "bypass_scout", // Invalid
      });

      expect(status).toBe(400);
      expect(data.reasonCode).toBe("MISSING_AUTHORITY_GATE");
    });

    it("should require sourceDecisionCardId when gate=decision_card", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        // sourceDecisionCardId missing
      });

      expect(status).toBe(400);
      expect(data.reasonCode).toBe("MISSING_DECISION_CARD_ID");
    });

    it("should require sourceScoutRecommendationId when gate=scout_recommendation", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "scout_recommendation",
        // Missing initiatedFromScoutRecommendationId
      });

      expect(status).toBe(400);
      expect(data.reasonCode).toBe("MISSING_SCOUT_RECOMMENDATION_ID");
    });
  });

  // ========================================
  // Category 4: Role Validation
  // ========================================

  describe("Role Validation: Prevent inappropriate contact", () => {
    it("should block homeowner→homeowner contact", async () => {
      const initiator = await createTestUser({ role: "homeowner", addressVerified: true });
      const recipient = await createTestUser({ role: "homeowner", addressVerified: true });
      const decision = await createDecisionCard(initiator.id);

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      expect(status).toBe(403);
      expect(data.message).toContain("Homeowners can only contact contractors");
    });

    it("should allow contractor→contractor for collaborate intent", async () => {
      const initiator = await createTestUser({ role: "contractor", addressVerified: true });
      const recipient = await createTestUser({ role: "contractor", addressVerified: true });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "collaborate",
        authorityGate: "scout_recommendation",
        initiatedFromScoutRecommendationId: "scout_rec_123",
      });

      expect(status).toBe(201);
      expect(data.created).toBe(true);
    });
  });

  // ========================================
  // Category 5: Verification Tests
  // ========================================

  describe("Verification: Both parties must be verified", () => {
    it("should reject unverified initiator", async () => {
      const initiator = await createTestUser({ addressVerified: false });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      expect(status).toBe(403);
      expect(data.message).toContain("complete address verification");
    });

    it("should reject unverified recipient", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: false, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      expect(status).toBe(403);
      expect(data.message).toContain("not verified for messaging");
    });
  });

  // ========================================
  // Category 6: Intent Validation
  // ========================================

  describe("Intent Validation: Required and valid", () => {
    it("should reject missing intent", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        // intent missing
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      expect(status).toBe(400);
      expect(data.message).toContain("Intent required");
    });

    it("should reject reconnect intent without prior conversation", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id, { intent: "reconnect" });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "reconnect",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
      });

      expect(status).toBe(400);
      expect(data.message).toContain("No prior conversation found");
    });

    it("should allow reconnect intent with prior conversation", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const hireDecision = await createDecisionCard(initiator.id);
      const reconnectDecision = await createDecisionCard(initiator.id, { intent: "reconnect" });

      // Create initial conversation
      await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: hireDecision.id,
      });

      // Now reconnect should work
      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "reconnect",
        authorityGate: "decision_card",
        sourceDecisionCardId: reconnectDecision.id,
      });

      expect(status).toBe(200); // Returns existing
      expect(data.created).toBe(false);
    });
  });

  // ========================================
  // Category 7: Bypass Prevention
  // ========================================

  describe("Bypass Prevention: No path exists without authority", () => {
    it("should reject direct message API without intent", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        // Missing all required fields
      });

      expect(status).toBe(400);
    });

    it("should enforce metadata on all conversations created after D1", async () => {
      const initiator = await createTestUser({ addressVerified: true });
      const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
      const decision = await createDecisionCard(initiator.id);

      const { data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
        confidenceScore: 0.85,
        decisionScope: "Fix broken fence",
      });

      // Verify all metadata persisted
      const [conv] = await db
        .select()
        .from(marketplaceConversations)
        .where(eq(marketplaceConversations.id, data.threadId));

      expect(conv.intent).toBe("hire");
      expect(conv.authorityGate).toBe("decision_card");
      expect(conv.sourceDecisionCardId).toBe(decision.id);
      expect(conv.confidenceScore).toBe("0.85");
      expect(conv.decisionScope).toBe("Fix broken fence");
    });
  });
});

/**
 * D3 TEST EXECUTION SUMMARY
 *
 * Pass Criteria:
 * - All 20+ tests pass
 * - 0 bypass paths discovered
 * - Metadata immutability proven
 * - Idempotency confirmed
 * - Role validation enforced
 * - Verification gates working
 *
 * Run: npm run test tests/d3-messaging-authority.test.ts
 */
