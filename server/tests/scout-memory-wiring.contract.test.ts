import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Scout memory synthesis wiring", () => {
  it("passes bounded active history and durable memory into synthesis", () => {
    const route = readFileSync("server/routes/scout.ts", "utf8");

    expect(route).toContain("buildBoundedScoutHistory(rawBody.history, message)");
    expect(route).toContain("getReasoningMemoryContext(memoryUserId");
    expect(route).toContain("buildScoutSynthesisMemoryBlocks({");
    expect(route).toContain("conversationHistory,");
    expect(route).toContain("durableMemory: durableMemoryContext");
    expect(route).toContain("thread:${boundedHistory.digest}");
    expect(route).toContain('memory:${durableMemoryContext?.revision || "none"}');
  });

  it("persists only explicit user-confirmed memory through the durable service", () => {
    const route = readFileSync("server/routes/scout.ts", "utf8");
    const service = readFileSync("server/services/scoutMemoryService.ts", "utf8");
    const workingMemory = readFileSync("server/scout/scoutWorkingMemory.ts", "utf8");

    expect(route).toContain("extractExplicitScoutMemoryUpdate(message)");
    expect(route).toContain("storeExplicitReasoningMemory(");
    expect(service).toContain('source: "explicit_user_message"');
    expect(service).toContain("user_confirmed: true");
    expect(service).toContain('notLike(scoutMemory.key, "response_cache_%")');
    expect(workingMemory).toContain('row.key.startsWith("response_cache_")');
  });
});
