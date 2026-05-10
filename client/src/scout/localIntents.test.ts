import { describe, it, expect } from "vitest";
import { resolveExplicitNavigationIntent, resolveQuickActionIntent } from "./localIntents";

describe("localIntents", () => {
  describe("resolveExplicitNavigationIntent", () => {
    it("routes explicit direct connect navigation", () => {
      const intent = resolveExplicitNavigationIntent("Open Direct Connect");
      expect(intent).toEqual({
        to: "/direct-connect",
        label: "Direct Connect",
        confidence: 0.95,
      });
    });

    it("returns null for non-explicit prompts", () => {
      const intent = resolveExplicitNavigationIntent("I need help with a roof leak");
      expect(intent).toBeNull();
    });

    it("routes explicit create-account intents", () => {
      const intent = resolveExplicitNavigationIntent("Take me to create account");
      expect(intent?.to).toBe("/pre-scout-setup?mode=create");
    });

    it("routes explicit support navigation to help center", () => {
      const intent = resolveExplicitNavigationIntent("Open support tickets");
      expect(intent).toEqual({
        to: "/help",
        label: "Help",
        confidence: 0.95,
      });
    });

    it("routes explicit message navigation to the primary messages workspace", () => {
      const intent = resolveExplicitNavigationIntent("Open messages");
      expect(intent).toEqual({
        to: "/messages",
        label: "Messages",
        confidence: 0.95,
      });
    });
  });

  describe("resolveQuickActionIntent", () => {
    it("maps canonical quick action labels to nav routes", () => {
      const action = resolveQuickActionIntent("View invoices and payments");
      expect(action).toEqual({
        kind: "navigate",
        to: "/finances",
        label: "View invoices and payments",
      });
    });

    it("normalizes punctuation and casing", () => {
      const action = resolveQuickActionIntent(
        "Show local groups, HOAs, and boards I can join or follow"
      );
      expect(action).toEqual({
        kind: "navigate",
        to: "/hoa-management",
        label: "Show local groups, HOAs, and boards I can join or follow",
      });
    });

    it("returns open_note action for note labels", () => {
      const action = resolveQuickActionIntent("Open a floating note");
      expect(action).toEqual({
        kind: "open_note",
        label: "Open a floating note",
      });
    });

    it("routes auth-required create-account suggestion", () => {
      const action = resolveQuickActionIntent("Create account now");
      expect(action).toEqual({
        kind: "navigate",
        to: "/pre-scout-setup?mode=create",
        label: "Create account now",
      });
    });

    it("returns null for unmapped labels", () => {
      const action = resolveQuickActionIntent("Do something novel");
      expect(action).toBeNull();
    });

    it("maps support quick actions to help center", () => {
      const action = resolveQuickActionIntent("Open support tickets");
      expect(action).toEqual({
        kind: "navigate",
        to: "/help",
        label: "Open support tickets",
      });
    });
  });
});
