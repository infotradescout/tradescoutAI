/**
 * Objectives Layer - Phase 1 Smoke Tests
 *
 * Tests core Phase 1 functionality:
 * - Intent classification
 * - Objective creation and updates
 * - Topic shift detection
 * - Work request promotion
 * - Auto-pause on new topic
 *
 * Run: npm test -- objectives.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { objectives, objectiveEvents, workRequests } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  classifyUserIntent,
  detectTopicShift,
  classifyFromMessageHeuristics,
} from "../services/intentsClassifier";
import { syncObjectiveFromScoutMessage } from "../scout/objectivesService";

const TEST_USER_ID = "test-user-" + Date.now();
const TEST_COUNTY_FIPS = "12345";
const TEST_STATE_CODE = "FL";
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeWithDb = hasTestDb ? describe : describe.skip;
let db!: (typeof import("../db"))["db"];

describeWithDb("Objectives Layer - Phase 1", () => {
  beforeAll(async () => {
    process.env.OBJECTIVES_ENABLED ??= "true";
    ({ db } = await import("../db"));
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(objectives).where(eq(objectives.userId, TEST_USER_ID));
  });

  // ==========================================
  // Intent Classification Tests
  // ==========================================

  describe("Intent Classification", () => {
    test("classifies 'hire' intent as work_request (homeowner)", () => {
      const result = classifyUserIntent({
        scoutIntent: "hire",
        userRole: "homeowner",
      });

      expect(result.intentClass).toBe("work_request");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.source).toBe("scout_classifier");
    });

    test("classifies 'hire' intent as marketplace_sell (contractor)", () => {
      const result = classifyUserIntent({
        scoutIntent: "hire",
        userRole: "contractor",
      });

      expect(result.intentClass).toBe("marketplace_sell");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test("classifies 'advise' intent with question as local_advice", () => {
      const result = classifyUserIntent({
        scoutIntent: "advise",
        messageText: "What should I ask a contractor about kitchen remodels?",
      });

      expect(result.intentClass).toBe("local_advice");
      expect(result.confidence).toBeGreaterThanOrEqual(0.65);
    });

    test("classifies 'unknown' intent via message heuristics", () => {
      const result = classifyUserIntent({
        scoutIntent: "unknown",
        messageText: "I need a plumber tomorrow",
      });

      expect(result.intentClass).toBe("work_request");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.source).toBe("message_heuristics");
    });

    test("detects 'for sale' as marketplace_sell", () => {
      const result = classifyFromMessageHeuristics("I have a couch for sale");

      expect(result.intentClass).toBe("marketplace_sell");
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });

    test("returns unknown for ambiguous message", () => {
      const result = classifyFromMessageHeuristics("hello");

      expect(result.intentClass).toBe("unknown");
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  // ==========================================
  // Topic Shift Detection Tests
  // ==========================================

  describe("Topic Shift Detection", () => {
    test("detects shift from work_request to marketplace_buy", () => {
      const shifted = detectTopicShift("work_request", "marketplace_buy", 0.65);
      expect(shifted).toBe(true);
    });

    test("does NOT detect shift within same group (both shopping)", () => {
      const shifted = detectTopicShift("marketplace_buy", "marketplace_sell", 0.65);
      expect(shifted).toBe(false); // Both are shopping-related
    });

    test("does NOT detect shift from unknown intent", () => {
      const shifted = detectTopicShift("unknown", "work_request", 0.65);
      expect(shifted).toBe(false); // Insufficient signal
    });

    test("detects shift from work_request to community_post", () => {
      const shifted = detectTopicShift("work_request", "community_post", 0.65);
      expect(shifted).toBe(true);
    });
  });

  // ==========================================
  // Objective Lifecycle Tests
  // ==========================================

  describe("Objective Lifecycle", () => {
    test("creates objective from Scout message", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID,
        messageText: "I need a kitchen remodeled",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      expect(result).not.toBeNull();
      expect(result?.isNew).toBe(true);

      // Verify in DB
      const created = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result?.objectiveId as string));

      expect(created).toHaveLength(1);
      expect(created[0].title).toContain("kitchen");
      expect(created[0].intentClass).toBe("work_request");
      expect(created[0].status).toBe("active");
    });

    test("updates existing objective on new message (same topic)", async () => {
      // Create first
      const result1 = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-2",
        messageText: "I need a bathroom remodeled",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      // Send follow-up message (same topic)
      const result2 = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-2",
        messageText: "I also need help comparing tile options for this remodel.",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      expect(result2?.isNew).toBe(false); // Should update, not create new
      expect(result2?.objectiveId).toBe(result1?.objectiveId);

      // Verify updated in DB
      const updated = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result1?.objectiveId as string));

      expect(updated[0].summary).toContain("tile options");
    });

    test("auto-pauses previous objective on topic shift", async () => {
      const userId = TEST_USER_ID + "-3";

      // Create first objective
      const result1 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "I need a plumber",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      // Send follow-up on DIFFERENT topic
      const result2 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Where can I find a good steakhouse?",
        userRole: "homeowner",
        scoutIntent: "advise",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      // First should be paused
      const previous = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result1?.objectiveId as string));

      expect(previous[0].status).toBe("paused");
      expect(result2?.wasTopicShift).toBe(true);

      // Verify topic_shift event logged
      const events = await db
        .select()
        .from(objectiveEvents)
        .where(eq(objectiveEvents.objectiveId, result1?.objectiveId as string));

      const shiftEvent = events.find((e) => e.eventType === "topic_shift");
      expect(shiftEvent).toBeDefined();
    });

    test("enforces one active objective per user", async () => {
      const userId = TEST_USER_ID + "-4";

      // Create objective 1
      const result1 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Interested in fixing my roof",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      // Create objective 2 (should auto-pause 1)
      const result2 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Can you recommend local parks for kids?",
        userRole: "homeowner",
        scoutIntent: "advise",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      const allUserObjectives = await db
        .select()
        .from(objectives)
        .where(eq(objectives.userId, userId));

      const activeCount = allUserObjectives.filter((o) => o.status === "active").length;
      expect(activeCount).toBe(1);
      expect(allUserObjectives).toHaveLength(2);
    });
  });

  // ==========================================
  // Context and Metadata Tests
  // ==========================================

  describe("Objective Context", () => {
    test("objective stores location context", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-5",
        messageText: "Fix my kitchen",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
        addressId: "test-address-123",
      });

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result?.objectiveId as string))
        .then((r) => r[0]);

      expect(objective.contextJson.countyFips).toBe(TEST_COUNTY_FIPS);
      expect(objective.contextJson.stateCode).toBe(TEST_STATE_CODE);
      expect(objective.contextJson.addressId).toBe("test-address-123");
    });

    test("objective summary is truncated message", async () => {
      const longMessage = "a".repeat(1000);

      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-6",
        messageText: longMessage,
      });

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result?.objectiveId as string))
        .then((r) => r[0]);

      expect(objective.summary.length).toBeLessThanOrEqual(500);
    });

    test("objective title extracted from message", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-7",
        messageText: "I need to fix my roof before winter. Can you help?",
      });

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result?.objectiveId as string))
        .then((r) => r[0]);

      expect(objective.title).toContain("roof");
      expect(objective.title.length).toBeLessThanOrEqual(80);
    });
  });

  // ==========================================
  // Event Logging Tests
  // ==========================================

  describe("Objective Event Logging", () => {
    test("logs created event when objective is created", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-8",
        messageText: "Need hvac service",
      });

      const events = await db
        .select()
        .from(objectiveEvents)
        .where(eq(objectiveEvents.objectiveId, result?.objectiveId as string));

      const createdEvent = events.find((e) => e.eventType === "created");
      expect(createdEvent).toBeDefined();
      expect(createdEvent?.actorType).toBe("system");
    });

    test("logs updated event when objective is refreshed", async () => {
      const userId = TEST_USER_ID + "-9";

      // Create
      const result1 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "First message",
      });

      // Update
      await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Follow-up message",
      });

      const events = await db
        .select()
        .from(objectiveEvents)
        .where(eq(objectiveEvents.objectiveId, result1?.objectiveId as string));

      const updatedEvent = events.find((e) => e.eventType === "summary_updated");
      expect(updatedEvent).toBeDefined();
    });
  });

  // ==========================================
  // Confidence and Classification Tests
  // ==========================================

  describe("Classification Confidence", () => {
    test("work_request intent has higher confidence than unknown", () => {
      const result1 = classifyUserIntent({
        scoutIntent: "hire",
        messageText: "I need a plumber",
        userRole: "homeowner",
      });

      const result2 = classifyUserIntent({
        scoutIntent: "unknown",
        messageText: "hello",
      });

      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });

    test("high-confidence classification stored in objective", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-10",
        messageText: "I need to hire a contractor",
        scoutIntent: "hire",
        userRole: "homeowner",
      });

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result?.objectiveId as string))
        .then((r) => r[0]);

      const confidence = parseFloat(String(objective.confidence));
      expect(confidence).toBeGreaterThanOrEqual(0.7);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });
  });
});

/**
 * PHASE 2 Tests (Not yet implemented, placeholder)
 */
describe.skip("Objectives Layer - Phase 2 (Promotion to other object types)", () => {
  test("promotes community_post intent to draft post", () => {
    // When available
  });

  test("promotes marketplace_sell intent to draft listing", () => {
    // When available
  });

  test("marketplace_buy intent creates search or browse routing", () => {
    // When available
  });
});
