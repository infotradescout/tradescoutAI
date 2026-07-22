import { describe, expect, it } from "vitest";
import { shouldUseInternetFallback } from "../services/knowledgeService";

describe("knowledgeService internet fallback sufficiency", () => {
  it("triggers web fallback for discovery queries when only knowledge docs are present", () => {
    const shouldFallback = shouldUseInternetFallback({
      message: "find a roofer near me",
      mode: "kb_site_then_web",
      sources: ["TradeScout Brain (data folder)"],
      meta: {},
      hasManualOverride: false,
    });

    expect(shouldFallback).toBe(true);
  });

  it("does not trigger web fallback for onboarding identity questions", () => {
    const shouldFallback = shouldUseInternetFallback({
      message: "what is TradeScout",
      mode: "kb_then_site",
      sources: ["TradeScout Brain (data folder)"],
      meta: {},
      hasManualOverride: false,
    });

    expect(shouldFallback).toBe(false);
  });

  it("does not trigger web fallback when local marketplace supply is healthy", () => {
    const shouldFallback = shouldUseInternetFallback({
      message: "find a plumber near me",
      mode: "kb_site_then_web",
      sources: ["TradeScout Database (contractors)"],
      meta: { contractors: { count: 6 } },
      hasManualOverride: false,
    });

    expect(shouldFallback).toBe(false);
  });

  it("does not trigger web fallback when manual override is present", () => {
    const shouldFallback = shouldUseInternetFallback({
      message: "best electrician in harris county",
      mode: "kb_site_then_web",
      sources: ["Admin Manual Override"],
      meta: {},
      hasManualOverride: true,
    });

    expect(shouldFallback).toBe(false);
  });

  it("requires a current authority lookup for code and permit questions", () => {
    const shouldFallback = shouldUseInternetFallback({
      message: "Do I need a permit and inspections for a new deck?",
      mode: "kb_site_then_web",
      sources: ["TradeScout Brain (data folder)"],
      meta: {},
      hasManualOverride: false,
    });

    expect(shouldFallback).toBe(true);
  });
});
