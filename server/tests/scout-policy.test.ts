import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  sanitizeScoutActionsForPolicy,
  sanitizeScoutMessageForPolicy,
} from "../services/scoutPolicy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT_PATH = path.join(__dirname, "..", "cache", "manual", "system_prompt.md");

describe("scoutPolicy", () => {
  it("sanitizes recommendation language in Scout messages", () => {
    const raw =
      "Scout recommends this provider. Who do you recommend? These recommendations are strong.";
    const { message, violations } = sanitizeScoutMessageForPolicy(raw);

    expect(message.toLowerCase()).not.toContain("scout recommends");
    expect(message.toLowerCase()).not.toContain("who do you recommend");
    expect(message.toLowerCase()).not.toContain("recommendations");
    expect(message.toLowerCase()).toContain("trust signals");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("sanitizes recommendation language in action labels and subtitles", () => {
    const rawActions = [
      {
        label: "Paid recommendation: call this contractor",
        subtitle: "Scout recommends this match",
        why: "Top recommendations in your area",
      },
    ];

    const { actions, violations } = sanitizeScoutActionsForPolicy(rawActions);

    expect(actions[0].label?.toLowerCase()).toContain("sponsored placement");
    expect(actions[0].subtitle?.toLowerCase()).not.toContain("recommends");
    expect(actions[0].why?.toLowerCase()).toContain("trust signals");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("system prompt avoids recommendation language in templates", () => {
    const prompt = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf8");
    const lowered = prompt.toLowerCase();

    expect(lowered).not.toContain("scout recommends");
    expect(lowered).not.toContain("who do you recommend");
    expect(lowered).not.toContain("recommend");
  });
});
