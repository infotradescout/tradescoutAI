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
import { objectives, objectiveEvents } from "../../shared/schema";
import { eq, like } from "drizzle-orm";
import {
  classifyUserIntent,
  detectTopicShift,
  classifyFromMessageHeuristics,
} from "../services/intentsClassifier";
import {
  maybePromoteToWorkRequest,
  syncObjectiveFromScoutMessage,
} from "../scout/objectivesService";

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
    await db.delete(objectives).where(like(objectives.userId, `${TEST_USER_ID}%`));
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
      const metadata = (shiftEvent?.metadata ?? {}) as Record<string, unknown>;
      expect(metadata.reason).toBe("user_shifted_to_new_topic");
      expect(metadata.previousIntent).toBe("work_request");
      expect(metadata.newIntent).toBe("local_advice");

      // New objective should have a created event (sequence integrity)
      const newObjectiveEvents = await db
        .select()
        .from(objectiveEvents)
        .where(eq(objectiveEvents.objectiveId, result2?.objectiveId as string));
      expect(newObjectiveEvents.some((e) => e.eventType === "created")).toBe(true);
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

    test("applies create-rate-limit by reusing existing objective after 3 creations/hour", async () => {
      const userId = TEST_USER_ID + "-rate-limit";

      const step1 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "I need roof repairs",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      const step2 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "What restaurants are best near me?",
        userRole: "homeowner",
        scoutIntent: "advise",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      const step3 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "I have a couch for sale",
        userRole: "homeowner",
        scoutIntent: "unknown",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      const step4 = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Sharing an update with neighbors",
        userRole: "homeowner",
        scoutIntent: "unknown",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      expect(step1?.isNew).toBe(true);
      expect(step2?.isNew).toBe(true);
      expect(step3?.isNew).toBe(true);

      expect(step4?.isNew).toBe(false);
      expect(step4?.rateLimitedReuse).toBe(true);
      expect(step4?.objectiveId).toBe(step3?.objectiveId);

      const allUserObjectives = await db
        .select()
        .from(objectives)
        .where(eq(objectives.userId, userId));

      expect(allUserObjectives).toHaveLength(3);
    });

    test("does not downgrade active objective intent on ambiguous follow-up", async () => {
      const userId = TEST_USER_ID + "-ambiguous-followup";

      const first = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "I need an electrician tomorrow",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      const second = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "ok",
        scoutIntent: "unknown",
      });

      expect(second?.isNew).toBe(false);
      expect(second?.objectiveId).toBe(first?.objectiveId);
      expect(second?.intentClass).toBe("work_request");

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, first?.objectiveId as string))
        .then((r) => r[0]);

      expect(objective.intentClass).toBe("work_request");
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

      expect(objective).toBeDefined();
      const context = (objective.contextJson ?? {}) as Record<string, unknown>;
      expect(context.countyFips).toBe(TEST_COUNTY_FIPS);
      expect(context.stateCode).toBe(TEST_STATE_CODE);
      expect(context.addressId).toBe("test-address-123");
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

      expect(objective).toBeDefined();
      expect((objective.summary ?? "").length).toBeLessThanOrEqual(500);
    });

    test("context messageText is capped at 1000 chars", async () => {
      const veryLongMessage = "b".repeat(1400);

      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-ctx-cap",
        messageText: veryLongMessage,
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, result?.objectiveId as string))
        .then((r) => r[0]);

      const context = (objective.contextJson ?? {}) as Record<string, unknown>;
      expect(typeof context.messageText).toBe("string");
      expect((context.messageText as string).length).toBeLessThanOrEqual(1000);
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

    test("preserves existing location context on follow-up without location payload", async () => {
      const userId = TEST_USER_ID + "-ctx-preserve";

      const first = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Need plumbing help",
        userRole: "homeowner",
        scoutIntent: "hire",
        countyFips: TEST_COUNTY_FIPS,
        stateCode: TEST_STATE_CODE,
      });

      await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Also compare pricing options",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, first?.objectiveId as string))
        .then((r) => r[0]);

      const context = (objective.contextJson ?? {}) as Record<string, unknown>;
      expect(context.countyFips).toBe(TEST_COUNTY_FIPS);
      expect(context.stateCode).toBe(TEST_STATE_CODE);
      expect(context.lastMessageText).toBe("Also compare pricing options");
    });
  });

  // ==========================================
  // System Safeguards
  // ==========================================

  describe("System Safeguards", () => {
    test("returns null when objectives layer is disabled", async () => {
      const prev = process.env.OBJECTIVES_ENABLED;
      process.env.OBJECTIVES_ENABLED = "false";

      try {
        const result = await syncObjectiveFromScoutMessage({
          userId: TEST_USER_ID + "-disabled",
          messageText: "Need a contractor",
          userRole: "homeowner",
          scoutIntent: "hire",
        });

        expect(result).toBeNull();
      } finally {
        if (prev === undefined) {
          delete process.env.OBJECTIVES_ENABLED;
        } else {
          process.env.OBJECTIVES_ENABLED = prev;
        }
      }
    });

    test("returns null for whitespace-only message", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-blank-msg",
        messageText: "    ",
        userRole: "homeowner",
        scoutIntent: "unknown",
      });

      expect(result).toBeNull();
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
      const metadata = (createdEvent?.metadata ?? {}) as Record<string, unknown>;
      expect(metadata.classificationSource).toBeDefined();
      expect(metadata.intentClass).toBeDefined();
      expect(typeof metadata.confidence).toBe("number");
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
      const metadata = (updatedEvent?.metadata ?? {}) as Record<string, unknown>;
      expect(metadata.intentClass).toBeDefined();
      expect(metadata.classificationSource).toBeDefined();
      expect(typeof metadata.wasTopicShift).toBe("boolean");
    });

    test("does not log duplicate summary_updated for identical follow-up", async () => {
      const userId = TEST_USER_ID + "-dup-event";

      const first = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Need HVAC service",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Need HVAC service",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      const events = await db
        .select()
        .from(objectiveEvents)
        .where(eq(objectiveEvents.objectiveId, first?.objectiveId as string));

      const updateEvents = events.filter((e) => e.eventType === "summary_updated");
      expect(updateEvents).toHaveLength(0);
      expect(events.some((e) => e.eventType === "created")).toBe(true);
    });

    test("logs rateLimitedReuse in summary_updated metadata when create cap is hit", async () => {
      const userId = TEST_USER_ID + "-event-rate-limit";

      const first = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Need roofer",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Need local restaurant advice",
        userRole: "homeowner",
        scoutIntent: "advise",
      });

      await syncObjectiveFromScoutMessage({
        userId,
        messageText: "I have furniture for sale",
        userRole: "homeowner",
        scoutIntent: "unknown",
      });

      const reused = await syncObjectiveFromScoutMessage({
        userId,
        messageText: "Posting a neighborhood update",
        userRole: "homeowner",
        scoutIntent: "unknown",
      });

      const events = await db
        .select()
        .from(objectiveEvents)
        .where(eq(objectiveEvents.objectiveId, reused?.objectiveId as string));

      const latestSummaryUpdate = [...events]
        .filter((e) => e.eventType === "summary_updated")
        .pop();

      expect(latestSummaryUpdate).toBeDefined();
      const metadata = (latestSummaryUpdate?.metadata ?? {}) as Record<string, unknown>;
      expect(metadata.rateLimitedReuse).toBe(true);
    });
  });

  // ==========================================
  // Promotion Eligibility Layer
  // ==========================================

  describe("Promotion Eligibility", () => {
    test("allows promotion for high-confidence work_request objective", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-promote-1",
        messageText: "I need to hire a roofer",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      const promotion = await maybePromoteToWorkRequest(result?.objectiveId as string);
      expect(promotion).toEqual(
        expect.objectContaining({
          canPromote: true,
        })
      );
    });

    test("does not promote non-work_request objective", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-promote-2",
        messageText: "What should I ask a contractor about permits?",
        userRole: "homeowner",
        scoutIntent: "advise",
      });

      const promotion = await maybePromoteToWorkRequest(result?.objectiveId as string);
      expect(promotion).toBeNull();
    });

    test("does not promote when objective already linked", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-promote-3",
        messageText: "I need to hire a plumber",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      await db
        .update(objectives)
        .set({ linkedObjectType: "workRequest", linkedObjectId: "wr-test-123" })
        .where(eq(objectives.id, result?.objectiveId as string));

      const promotion = await maybePromoteToWorkRequest(result?.objectiveId as string);
      expect(promotion).toBeNull();
    });

    test("does not promote when confidence threshold is set above objective confidence", async () => {
      const result = await syncObjectiveFromScoutMessage({
        userId: TEST_USER_ID + "-promote-threshold",
        messageText: "I need to hire an electrician",
        userRole: "homeowner",
        scoutIntent: "hire",
      });

      const promotion = await maybePromoteToWorkRequest(result?.objectiveId as string, 0.95);
      expect(promotion).toBeNull();
    });

    test("returns null for unknown objective id", async () => {
      const promotion = await maybePromoteToWorkRequest("00000000-0000-0000-0000-000000000000");
      expect(promotion).toBeNull();
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
describe("Objectives Layer - Phase 2 (Promotion to other object types)", () => {
  test.todo("promotes community_post intent to draft post");
  test.todo("promotes marketplace_sell intent to draft listing");
  test.todo("marketplace_buy intent creates search or browse routing");
});
