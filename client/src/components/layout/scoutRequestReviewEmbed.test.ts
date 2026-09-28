// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  isEmbeddedScoutRequestReview,
  isScoutRequestReviewWorkAreaUrl,
} from "./scoutRequestReviewEmbed";

function reviewWindow(frame: Element | null, parentPath = "/scout"): Window {
  return {
    frameElement: frame,
    location: { origin: "https://tradescout.test" },
    parent: { location: { origin: "https://tradescout.test", pathname: parentPath } },
  } as unknown as Window;
}

function directWindow(): Window {
  const current = {
    frameElement: null,
    location: { origin: "https://tradescout.test", pathname: "/direct-connect/post" },
  } as unknown as Window;
  Object.defineProperty(current, "parent", { value: current });
  return current;
}

describe("Scout embedded request review chrome", () => {
  it("marks only Scout's request-review work-area destination", () => {
    expect(isScoutRequestReviewWorkAreaUrl("/direct-connect/post?source=scout&staged=" + "a".repeat(64)))
      .toBe(true);
    for (const other of [
      "/direct-connect?source=scout",
      "/direct-connect/post?source=businesses_empty",
      "/direct-connect/post/other?source=scout",
      "https://tradescout.test/direct-connect/post?source=scout",
      "//elsewhere.test/direct-connect/post?source=scout",
    ]) {
      expect(isScoutRequestReviewWorkAreaUrl(other)).toBe(false);
    }
  });

  it("hides nested chrome only inside the marked same-origin Scout iframe", () => {
    const frame = document.createElement("iframe");
    frame.setAttribute("data-scout-request-review", "true");
    const embeddedWindow = reviewWindow(frame);
    expect(isEmbeddedScoutRequestReview("/direct-connect/post?source=scout", embeddedWindow))
      .toBe(true);

    expect(isEmbeddedScoutRequestReview("/direct-connect/post?source=scout", directWindow()))
      .toBe(false);
    expect(isEmbeddedScoutRequestReview("/direct-connect/post?source=scout", reviewWindow(frame, "/contractors")))
      .toBe(false);
    expect(isEmbeddedScoutRequestReview("/direct-connect/active?source=scout", embeddedWindow))
      .toBe(false);
    frame.removeAttribute("data-scout-request-review");
    expect(isEmbeddedScoutRequestReview("/direct-connect/post?source=scout", embeddedWindow))
      .toBe(false);
  });

  it("keeps full chrome when a parent frame is cross-origin or unreadable", () => {
    const frame = document.createElement("iframe");
    frame.setAttribute("data-scout-request-review", "true");
    const otherOrigin = reviewWindow(frame);
    Object.defineProperty(otherOrigin.parent.location, "origin", { value: "https://elsewhere.test" });
    expect(isEmbeddedScoutRequestReview("/direct-connect/post", otherOrigin)).toBe(false);

    const unreadableParent = reviewWindow(frame);
    Object.defineProperty(unreadableParent.parent, "location", {
      get: () => { throw new Error("Cross-origin parent"); },
    });
    expect(isEmbeddedScoutRequestReview("/direct-connect/post", unreadableParent)).toBe(false);
  });
});
