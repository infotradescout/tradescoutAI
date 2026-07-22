import { describe, expect, it } from "vitest";
import {
  buildInternetKnowledgeSources,
  hasCitableInternetSource,
  shouldUseInternetFallback,
} from "../services/knowledgeService";

describe("knowledgeService internet fallback sufficiency", () => {
  it("keeps provider citation URLs for the active Scout knowledge response", () => {
    expect(
      buildInternetKnowledgeSources({
        provider: "openai-web-search",
        sources: [
          {
            title: "Official county permit guidance",
            url: "https://example.gov/permits",
            type: "url_citation",
          },
          {
            title: "Unsafe provider URL",
            url: "data:text/html,bad",
            type: "url_citation",
          },
        ],
      })
    ).toEqual([
      {
        title: "Official county permit guidance",
        url: "https://example.gov/permits",
        type: "url_citation",
        provider: "openai-web-search",
      },
    ]);
  });

  it("requires a real provider URL before rules-search output is citable", () => {
    expect(
      hasCitableInternetSource([
        { title: "Official permit office", url: "https://example.gov/permits" },
      ])
    ).toBe(true);
    expect(
      hasCitableInternetSource([
        { title: "Unsafe", url: "javascript:alert(1)", type: "url_citation" },
        { title: "Internet Search", type: "internet" },
      ])
    ).toBe(false);
  });

  it("returns no internet evidence when a provider supplies no citation metadata", () => {
    expect(buildInternetKnowledgeSources({ provider: "gemini:test" })).toEqual([]);
  });

  it("drops title-only and unsafe sources instead of manufacturing internet provenance", () => {
    expect(
      buildInternetKnowledgeSources({
        provider: "model-only",
        sources: [
          { title: "Generated source title", type: "internet" },
          { title: "Unsafe source", url: "javascript:alert(1)", type: "url_citation" },
        ],
      })
    ).toEqual([]);
  });

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
