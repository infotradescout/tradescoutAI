import { describe, expect, it } from "vitest";
import { buildProfileAccountResumePath, isProfileAccountResumePath } from "./profileAccountClient";

describe("profile account continuation paths", () => {
  it("recognizes only safe account-return paths on public profile surfaces", () => {
    expect(isProfileAccountResumePath("/jw-stone?profileAccount=1")).toBe(true);
    expect(isProfileAccountResumePath("/u/local-electrician?profileAccount=1")).toBe(true);
    expect(isProfileAccountResumePath("/jw-stone?profileAccount=0")).toBe(false);
    expect(isProfileAccountResumePath("/api/u/jw-stone/account?profileAccount=1")).toBe(false);
    expect(isProfileAccountResumePath("//evil.example/?profileAccount=1")).toBe(false);
    expect(isProfileAccountResumePath("/%252F%252Fevil.example/?profileAccount=1")).toBe(false);
  });

  it("keeps JW Stone sign-in on the canonical marketplace route", () => {
    expect(buildProfileAccountResumePath("jw-stone", "signin")).toBe(
      "/jw-stone?profileAccount=1&profileAccountMode=signin"
    );
  });
});
