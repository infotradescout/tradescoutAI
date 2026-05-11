import { describe, expect, it } from "vitest";
import { resolveExplicitNavigationIntent } from "./localIntents";
import { buildConnectionFallback, buildExplicitNavigationMessage } from "./messageBuilders";
import { enforceResponseQualityContract } from "./responseQuality";
import type { ScoutAction, ScoutMessage } from "./state";

type SimulatedTurn = {
  message: ScoutMessage;
  actions: ScoutAction[];
  mode: "explicit_nav" | "fallback";
};

function simulateTurn(userPrompt: string): SimulatedTurn {
  const explicit = resolveExplicitNavigationIntent(userPrompt);
  if (explicit) {
    const message = buildExplicitNavigationMessage({
      to: explicit.to,
      label: explicit.label,
    });
    const primary = message.clusters?.[0]?.primaryAction;
    const actions = primary ? [primary] : [];
    const content = enforceResponseQualityContract({
      userMessage: userPrompt,
      content: message.content,
      hasActionOptions: actions.length > 0,
    });

    return {
      message: { ...message, content },
      actions,
      mode: "explicit_nav",
    };
  }

  const { message, actions } = buildConnectionFallback(
    {
      contractorsRoute: "/contractors",
      communityRoute: "/community",
      exchangeRoute: "/exchange",
    },
    userPrompt
  );

  return {
    message: {
      ...message,
      content: enforceResponseQualityContract({
        userMessage: userPrompt,
        content: message.content,
        hasActionOptions: actions.length > 0,
      }),
    },
    actions,
    mode: "fallback",
  };
}

describe("Scout Human Feel Acceptance", () => {
  const prompts: Array<{ prompt: string; expectsRoute: string }> = [
    { prompt: "Open Direct Connect", expectsRoute: "/direct-connect" },
    { prompt: "Take me to community", expectsRoute: "/community" },
    { prompt: "Show me marketplace", expectsRoute: "/exchange" },
    { prompt: "I need a plumber near me", expectsRoute: "/direct-connect/pros" },
    { prompt: "I want to buy tools", expectsRoute: "/exchange" },
    { prompt: "Help me post in community", expectsRoute: "/community" },
    { prompt: "Find a contractor for roof repair", expectsRoute: "/direct-connect/pros" },
    { prompt: "Where should I start?", expectsRoute: "/direct-connect" },
    {
      prompt: "I need roof repair help and maybe buy materials",
      expectsRoute: "/direct-connect/pros",
    },
    { prompt: "Open notes", expectsRoute: "/notes" },
  ];

  it("responds with acknowledgement + actionable next step for 10 real prompts", () => {
    for (const item of prompts) {
      const turn = simulateTurn(item.prompt);

      expect(turn.message.role).toBe("assistant");
      expect(turn.message.content.length).toBeGreaterThan(20);
      expect(turn.actions.length).toBeGreaterThan(0);
      expect(turn.actions.some((a) => a.type === "NAVIGATE")).toBe(true);
      const hasExpectedRoute = turn.actions.some((a) => a.to === item.expectsRoute);
      if (!hasExpectedRoute) {
        throw new Error(
          `Prompt '${item.prompt}' expected route '${item.expectsRoute}' but got [${turn.actions
            .map((a) => a.to || "")
            .join(", ")}]`
        );
      }

      const lower = turn.message.content.toLowerCase();
      expect(
        lower.includes("got it") ||
          lower.includes("next step") ||
          lower.includes("keep moving") ||
          lower.includes("start with")
      ).toBe(true);

      expect(lower.includes("i can help with that")).toBe(false);
      expect(lower.includes("here's what tradescout can do for your community")).toBe(false);
      if (turn.actions.length > 0) {
        expect(
          lower.includes("next") ||
            lower.includes("open") ||
            lower.includes("choose") ||
            lower.includes("continue") ||
            lower.includes("start with")
        ).toBe(true);
      }

      expect(lower.includes("which option should i run first")).toBe(false);
      expect(lower.includes("what should i help you with next")).toBe(false);
      expect(lower.includes("do you want to start with")).toBe(false);

      expect(lower.includes("can't help")).toBe(false);
      expect(lower.includes("not sure what to do")).toBe(false);
      expect(lower.includes("no next step")).toBe(false);
    }
  });

  it("fallback mode always offers retry plus at least one concrete route", () => {
    const turn = simulateTurn("I'm confused, what now?");

    expect(turn.mode).toBe("fallback");
    expect(turn.message.suggestedActions?.includes("Retry my question")).toBe(true);
    expect(turn.actions.some((a) => a.to === "/direct-connect")).toBe(true);
  });
});
