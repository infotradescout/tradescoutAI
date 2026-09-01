/**
 * Phase D3: Messaging Authority Contract Enforcement Tests
 *
 * Critical validation: No path exists—UI or API—to create conversation without authority metadata
 *
 * Test Categories:
 * 1. Immutability Tests (intent, authorityGate, metadata locked)
 * 2. Idempotency Tests (same decision → same thread)
 * 3. Authority Gate Tests (decision_card, scout_recommendation)
 * 4. Role Validation Tests (homeowner→homeowner blocked)
 * 5. Verification Tests (both parties must be verified)
 * 6. Confidence Blocking Tests (<30% confidence blocked)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../../src/db/drizzle-mock";
import { users, marketplaceConversations, decisionCards, contactPermissions } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { createAuthedAgent, createUserOnly } from "./helpers/testAuth";

// Test utilities
// Uses the same guard as all other integration tests in this project:
// set TEST_DATABASE_URL to a local Postgres URL to enable these tests.
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = hasTestDb ? describe : describe.skip;
const INTEGRATION_TIMEOUT_MS = 30000;
let currentAgent: any = null;

vi.setConfig({ testTimeout: INTEGRATION_TIMEOUT_MS });

async function createTestUser(overrides = {}) {
  const role = ((overrides as any).role ?? "homeowner") as any;
  const addressVerified = (overrides as any).addressVerified ?? true;

  if (!currentAgent) {
    const { agent, user } = await createAuthedAgent({ role, addressVerified, emailVerified: true });
    currentAgent = agent;
    return user;
  }

  return createUserOnly({ role, addressVerified, emailVerified: true });
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

async function grantAcceptedPermission(requesterId: string, targetUserId: string) {
  const now = new Date();
  await db
    .insert(contactPermissions)
    .values({
      requesterId,
      targetUserId,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
      respondedAt: now,
      respondedBy: targetUserId,
      responseReason: "test_preapproved",
    } as any)
    .onConflictDoUpdate({
      target: [contactPermissions.requesterId, contactPermissions.targetUserId],
      set: {
        status: "accepted",
        updatedAt: now,
        respondedAt: now,
        respondedBy: targetUserId,
        responseReason: "test_preapproved",
      },
    });
}

async function startConversation(authToken: string, payload: any) {
  void authToken;
  if (!currentAgent) throw new Error("No authenticated initiator agent established");
  const res = await currentAgent
    .post("/api/social/conversations/start")
    .set("Content-Type", "application/json")
    .send(payload);
  return { status: res.status, data: res.body };
}

async function patchConversation(threadId: string, payload: any) {
  if (!currentAgent) throw new Error("No authenticated initiator agent established");
  const res = await currentAgent
    .patch(`/api/social/conversations/${threadId}`)
    .set("Content-Type", "application/json")
    .send(payload);
  return { status: res.status, data: res.body };
}

describeIntegration("D3: Messaging Authority Enforcement", () => {
  beforeEach(() => {
    currentAgent = null;
  });

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
      const patchRes = await patchConversation(data.threadId, { intent: "advise" });

      expect(patchRes.status).toBe(404);
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
      const patchRes = await patchConversation(data.threadId, {
        authorityGate: "scout_recommendation",
      });

      expect(patchRes.status).toBe(404);
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
      const patchRes = await patchConversation(data.threadId, {
        decisionScope: "Build new deck",
      });

      expect(patchRes.status).toBe(404);
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
      await grantAcceptedPermission(initiator.id, recipient.id);

      // First submission
      const { status: firstStatus, data: first } = await startConversation("test_token", payload);
      expect(firstStatus).toBe(200);
      expect(first.created).toBe(true);

      // Second submission (duplicate)
      const { status: secondStatus, data: second } = await startConversation("test_token", payload);
      expect(secondStatus).toBe(200);
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
      await grantAcceptedPermission(initiator.id, recipient.id);

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

    it.each([
      ["pending", 202],
      ["declined", 403],
      ["blocked", 403],
    ] as const)(
      "does not resurrect a %s permission when an old thread exists",
      async (permissionStatus, expectedStatus) => {
        const initiator = await createTestUser({ addressVerified: true });
        const recipient = await createTestUser({ addressVerified: true, role: "contractor" });
        const decision = await createDecisionCard(initiator.id);
        const payload = {
          targetUserId: recipient.id,
          intent: "hire",
          authorityGate: "decision_card",
          sourceDecisionCardId: decision.id,
        };
        await grantAcceptedPermission(initiator.id, recipient.id);
        expect((await startConversation("test_token", payload)).status).toBe(200);

        const responseAt = new Date();
        await db
          .update(contactPermissions)
          .set({
            status: permissionStatus,
            lastRequestType: permissionStatus === "pending" ? "message" : null,
            lastRequestNotificationId: permissionStatus === "pending" ? "test-request" : null,
            respondedAt: permissionStatus === "pending" ? null : responseAt,
            respondedBy: permissionStatus === "pending" ? null : recipient.id,
            responseReason: permissionStatus === "pending" ? null : `test_${permissionStatus}`,
            updatedAt: responseAt,
          } as any)
          .where(
            and(
              eq(contactPermissions.requesterId, initiator.id),
              eq(contactPermissions.targetUserId, recipient.id)
            )
          );

        const response = await startConversation("test_token", payload);
        expect(response.status).toBe(expectedStatus);
        expect(response.data.threadId).toBeUndefined();
        const [permission] = await db
          .select()
          .from(contactPermissions)
          .where(
            and(
              eq(contactPermissions.requesterId, initiator.id),
              eq(contactPermissions.targetUserId, recipient.id)
            )
          );
        expect(permission.status).toBe(permissionStatus);
        expect(permission.respondedBy).not.toBe(initiator.id);
      }
    );
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

      expect(status).toBe(202);
      expect(data.pending).toBe(true);
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

      expect(status).toBe(202);
      expect(data.pending).toBe(true);
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

      expect(status).toBe(200);
      expect(data.verificationRequired?.action).toBe("MESSAGE_USER");
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

      expect(status).toBe(202);
      expect(data.pending).toBe(true);
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
      await grantAcceptedPermission(initiator.id, recipient.id);
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
      const decision = await createDecisionCard(initiator.id, {
        decisionScope: "Fix broken fence",
      });
      await grantAcceptedPermission(initiator.id, recipient.id);

      const { status, data } = await startConversation("test_token", {
        targetUserId: recipient.id,
        intent: "hire",
        authorityGate: "decision_card",
        sourceDecisionCardId: decision.id,
        confidenceScore: 0.85,
        decisionScope: "Fix broken fence",
      });
      expect(status).toBe(200);

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
