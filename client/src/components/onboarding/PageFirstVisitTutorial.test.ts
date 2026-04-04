import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetTutorialFallbackForTests,
  getPageTutorial,
  getTutorialStorageKeys,
  normalizePath,
  readTutorialNever,
  readTutorialSeenVersion,
  shouldSkipPath,
  TUTORIAL_VERSION,
  writeTutorialNever,
  writeTutorialSeenVersion,
} from "./PageFirstVisitTutorial";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

describe("PageFirstVisitTutorial helpers", () => {
  beforeEach(() => {
    const localStorageShim = new MemoryStorage();
    const sessionStorageShim = new MemoryStorage();
    (globalThis as any).localStorage = localStorageShim;
    (globalThis as any).sessionStorage = sessionStorageShim;
    (globalThis as any).window = {
      localStorage: localStorageShim,
      sessionStorage: sessionStorageShim,
    };
    __resetTutorialFallbackForTests();
  });

  it("normalizes trailing slashes and strips query/hash", () => {
    expect(normalizePath("/direct-connect///?foo=1#bar")).toBe("/direct-connect");
    expect(normalizePath("/")).toBe("/");
  });

  it("skips onboarding and auth paths", () => {
    expect(shouldSkipPath("/onboarding/profile")).toBe(true);
    expect(shouldSkipPath("/pre-scout-setup")).toBe(true);
    expect(shouldSkipPath("/login")).toBe(true);
    expect(shouldSkipPath("/privacy")).toBe(true);
    expect(shouldSkipPath("/terms")).toBe(true);
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

  it("returns tailored commercial-directory tutorial copy", () => {
    const tutorial = getPageTutorial("/commercial-directory");
    expect(tutorial.title).toContain("Commercial Opportunities");
    expect(tutorial.description).toContain("county-scoped commercial projects");
  });

  it("returns tailored foundation tutorial copy", () => {
    const tutorial = getPageTutorial("/foundation");
    expect(tutorial.title).toContain("Foundation");
    expect(tutorial.description).toContain("county vault projects");
  });

  it("returns tailored settings tutorial copy", () => {
    const tutorial = getPageTutorial("/settings");
    expect(tutorial.title).toContain("Account settings");
    expect(tutorial.bullets.join(" ")).toContain("county and identity details");
  });

  it("returns tailored admin tutorial copy", () => {
    const tutorial = getPageTutorial("/admin/live-stream");
    expect(tutorial.title).toContain("Admin OS");
    expect(tutorial.bullets.join(" ")).toContain("authority impact");
  });

  it("returns tailored local intelligence tutorial copy", () => {
    const tutorial = getPageTutorial("/county/fl/escambia");
    expect(tutorial.title).toContain("Local intelligence");
    expect(tutorial.bullets.join(" ")).toContain("decision context");
  });

  it("stores seen state per session", () => {
    const keys = getTutorialStorageKeys("guest", "/commercial-directory");
    writeTutorialSeenVersion(keys.seen, TUTORIAL_VERSION);

    expect(readTutorialSeenVersion(keys.seen)).toBe(TUTORIAL_VERSION);
    expect(localStorage.getItem(keys.seen)).toBeNull();
    expect(sessionStorage.getItem(keys.seen)).toBe(TUTORIAL_VERSION);
  });

  it("stores never-show state persistently", () => {
    const keys = getTutorialStorageKeys("guest", "/commercial-directory");
    writeTutorialNever(keys.never);

    expect(readTutorialNever(keys.never)).toBe(true);
    expect(localStorage.getItem(keys.never)).toBe("1");
  });
});
