import { describe, expect, it } from "vitest";
import { STONE_LEARNING_TOPICS } from "./stoneLearning";

describe("stone learning topics", () => {
  it("stays proportional and sourced without role theater", () => {
    expect(STONE_LEARNING_TOPICS.length).toBeGreaterThanOrEqual(3);
    expect(STONE_LEARNING_TOPICS.length).toBeLessThanOrEqual(6);

    for (const topic of STONE_LEARNING_TOPICS) {
      expect(topic.title.trim()).toBeTruthy();
      expect(topic.text.trim().length).toBeGreaterThan(40);
      expect(topic.text).not.toMatch(
        /best for|ideal for|available now|in[- ]stock|live[- ]stock|fabricator path|buyer path/i
      );
      expect(topic.source.url).toMatch(/^https:\/\//);
      expect(
        topic.source.url.includes("usenaturalstone.org") ||
          topic.source.url.includes("naturalstoneinstitute.org")
      ).toBe(true);
    }
  });
});
