import { describe, expect, it } from "vitest";
import {
  getPageTutorial,
  getTutorialStorageKeys,
  normalizePath,
  shouldSkipPath,
} from "./PageFirstVisitTutorial";

describe("PageFirstVisitTutorial helpers", () => {
  it("normalizes trailing slashes and strips query/hash", () => {
    expect(normalizePath("/direct-connect///?foo=1#bar")).toBe("/direct-connect");
    expect(normalizePath("/")).toBe("/");
  });

  it("skips onboarding and auth paths", () => {
    expect(shouldSkipPath("/onboarding/profile")).toBe(true);
    expect(shouldSkipPath("/pre-scout-setup")).toBe(true);
    expect(shouldSkipPath("/login")).toBe(true);
    expect(shouldSkipPath("/direct-connect")).toBe(false);
  });

  it("builds storage keys scoped per user and per page", () => {
    const dcGuest = getTutorialStorageKeys("guest", "/direct-connect");
    const scoutGuest = getTutorialStorageKeys("guest", "/scout");
    const dcUser = getTutorialStorageKeys("user:123", "/direct-connect");

    expect(dcGuest.seen).not.toBe(scoutGuest.seen);
    expect(dcGuest.never).not.toBe(scoutGuest.never);
    expect(dcGuest.seen).not.toBe(dcUser.seen);
    expect(dcGuest.never).not.toBe(dcUser.never);
  });

  it("returns tailored direct-connect tutorial copy", () => {
    const tutorial = getPageTutorial("/direct-connect");
    expect(tutorial.title).toContain("Direct Connect");
    expect(tutorial.bullets.join(" ")).toContain("let Scout decide");
  });
});
