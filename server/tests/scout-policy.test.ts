import { describe, it, expect } from "vitest";
import {
  sanitizeScoutActionsForPolicy,
  sanitizeScoutMessageForPolicy,
} from "../services/scoutPolicy";

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
});
