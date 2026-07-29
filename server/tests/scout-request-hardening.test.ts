import fs from "fs";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  buildScoutUnavailableResponse,
  createScoutRequestLimiters,
  validateScoutRequestBounds,
  type ScoutRequestLimits,
} from "../scout/scoutRequestHardening";
import {
  appendChatKnowledge,
  AUTOMATIC_CHAT_CORPUS_WRITES_ENABLED,
} from "../services/knowledgeService";
import {
  GENERATED_SCOUT_CORPUS_RETRIEVAL_ENABLED,
  getScoutCorpusContainmentStatus,
} from "../services/scoutCorpusContainment";
import { loadScoutKnowledgeBase } from "../services/scoutKnowledgeLoader";

const TEST_LIMITS: ScoutRequestLimits = {
  windowMs: 60_000,
  anonymousMax: 1,
  authenticatedMax: 1,
  maxMessageChars: 20,
  maxHistoryMessages: 2,
  maxHistoryMessageChars: 10,
  maxHistoryTotalChars: 12,
};

describe("Scout request hardening", () => {
  it("accepts a bounded request", () => {
    expect(
      validateScoutRequestBounds(
        {
          message: "Find a roofer",
          history: [
            { role: "user", content: "roof" },
            { role: "assistant", content: "where?" },
          ],
        },
        TEST_LIMITS
      )
    ).toEqual({ ok: true });
  });

  it("rejects missing and oversized messages before Scout runs", () => {
    expect(validateScoutRequestBounds({ message: "  " }, TEST_LIMITS)).toMatchObject({
      ok: false,
      status: 400,
      code: "scout_message_required",
    });
    expect(validateScoutRequestBounds({ message: "x".repeat(21) }, TEST_LIMITS)).toMatchObject({
      ok: false,
      status: 413,
      code: "scout_message_too_large",
      limit: 20,
      measured: 21,
    });
  });

  it("rejects malformed, oversized, and overlong history", () => {
    expect(
      validateScoutRequestBounds({ message: "ok", history: "not-an-array" }, TEST_LIMITS)
    ).toMatchObject({
      ok: false,
      status: 400,
      code: "scout_history_invalid",
    });
    expect(
      validateScoutRequestBounds(
        {
          message: "ok",
          history: [{ content: "one" }, { content: "two" }, { content: "three" }],
        },
        TEST_LIMITS
      )
    ).toMatchObject({
      ok: false,
      status: 413,
      code: "scout_history_too_large",
      limit: 2,
      measured: 3,
    });
    expect(
      validateScoutRequestBounds(
        { message: "ok", history: [{ content: "x".repeat(11) }] },
        TEST_LIMITS
      )
    ).toMatchObject({
      ok: false,
      status: 413,
      code: "scout_history_too_large",
      limit: 10,
      measured: 11,
    });
    expect(
      validateScoutRequestBounds(
        {
          message: "ok",
          history: [{ content: "1234567" }, { content: "1234567" }],
        },
        TEST_LIMITS
      )
    ).toMatchObject({
      ok: false,
      status: 413,
      code: "scout_history_too_large",
      limit: 12,
      measured: 14,
    });
  });

  it("rate limits anonymous requests by IP with a truthful 429", async () => {
    const app = express();
    app.use(express.json());
    app.post("/", ...createScoutRequestLimiters(TEST_LIMITS), (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).post("/").send({ message: "first" }).expect(200);
    const limited = await request(app).post("/").send({ message: "second" }).expect(429);

    expect(limited.body).toMatchObject({
      error: {
        code: "scout_rate_limited",
        retryable: true,
        scope: "anonymous_ip",
      },
      metadata: {
        fallbackUsed: false,
        degraded: true,
      },
    });
  });

  it("rate limits authenticated requests by user identity", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: "user-1" };
      next();
    });
    app.post("/", ...createScoutRequestLimiters(TEST_LIMITS), (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).post("/").send({ message: "first" }).expect(200);
    const limited = await request(app).post("/").send({ message: "second" }).expect(429);

    expect(limited.body.error).toMatchObject({
      code: "scout_rate_limited",
      scope: "authenticated_user",
    });
  });

  it("returns a truthful 503 payload without simulated success actions", () => {
    const payload = buildScoutUnavailableResponse({
      promptVersion: "test",
      requestId: "req-1",
    });

    expect(payload.error).toMatchObject({
      code: "scout_temporarily_unavailable",
      retryable: true,
    });
    expect(payload.message).toContain("Nothing was sent, changed, published, or marked complete");
    expect(payload.actions).toEqual([]);
    expect(payload.metadata).toMatchObject({
      fallbackUsed: false,
      degraded: true,
      requestId: "req-1",
    });
  });

  it("keeps automatic chat-corpus writes disabled even if a caller invokes the shim", () => {
    const writeSpy = vi.spyOn(fs, "writeFileSync");
    const result = appendChatKnowledge({
      question: "What is the permit rule?",
      answer: "Generated answer that must not enter the corpus.",
      layer: 3,
    });

    expect(AUTOMATIC_CHAT_CORPUS_WRITES_ENABLED).toBe(false);
    expect(result).toEqual({
      appended: false,
      reason: "automatic_corpus_writes_disabled",
    });
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it("quarantines generated Scout corpus retrieval without an environment override", async () => {
    const previous = process.env.SCOUT_GENERATED_CORPUS_RETRIEVAL_ENABLED;
    process.env.SCOUT_GENERATED_CORPUS_RETRIEVAL_ENABLED = "true";

    try {
      const result = await loadScoutKnowledgeBase({
        query: "permit requirements",
        countyFips: "12033",
        stateCode: "FL",
      });

      expect(GENERATED_SCOUT_CORPUS_RETRIEVAL_ENABLED).toBe(false);
      expect(getScoutCorpusContainmentStatus()).toEqual({
        generatedCorpusRetrievalEnabled: false,
        automaticChatCorpusWritesEnabled: false,
        reason: "source_validation_and_sanitation_required",
      });
      expect(result).toMatchObject({
        status: "quarantined",
        fileCount: 0,
        matchedCount: 0,
        entries: [],
      });
    } finally {
      if (previous === undefined) delete process.env.SCOUT_GENERATED_CORPUS_RETRIEVAL_ENABLED;
      else process.env.SCOUT_GENERATED_CORPUS_RETRIEVAL_ENABLED = previous;
    }
  });
});
