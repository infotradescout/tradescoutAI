import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getUiPathname,
  isApplicationUiSurface,
  isPublicProfileLikePath,
} from "./applicationUiScope";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("core application presentation boundary", () => {
  it.each([
    "/jw-stone",
    "/jw-stone/inventory",
    "/issa-build",
    "/issa-build/onyx",
    "/issa-build/services/roofing",
    "/u/issa-build",
    "/u/jw-stone/products/slab",
    "/p/business/services/item",
    "/business/example",
    "/business/example/edit",
    "/contractors/example",
    "/contractors/example/services",
    "/helpers/example",
    "/profile/person",
    "/u/EXAMPLE/?section=products#top",
  ])("never applies core UI to public profile %s", (route) => {
    expect(isPublicProfileLikePath(route)).toBe(true);
    expect(isApplicationUiSurface(route)).toBe(false);
  });

  it.each(["/", "/scout", "/settings", "/any-custom-path"])(
    "never applies core UI on a custom-domain profile at %s",
    (route) => {
      expect(isApplicationUiSurface(route, "custom-business")).toBe(false);
    }
  );

  it.each([
    "/scout",
    "/direct-connect",
    "/direct-connect/opportunities",
    "/contractors",
    "/contractors/top",
    "/contractors/board",
    "/community-feed",
    "/exchange",
    "/homes",
    "/finances/invoices",
    "/profile",
    "/settings",
    "/help",
  ])("keeps core app destination %s in scope", (route) =>
    expect(isApplicationUiSurface(route)).toBe(true)
  );

  it.each([
    "/admin",
    "/admin/users",
    "/pre-scout-setup",
    "/login?next=%2Fscout",
    "/signup",
    "/onboarding",
    "/onboarding/profile",
    "/profile-setup",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/landing",
    "/lp/test",
    "/r/token",
    "/bidrock",
  ])("leaves independent and focused surfaces out: %s", (route) =>
    expect(isApplicationUiSurface(route)).toBe(false)
  );

  it("normalizes query, fragment, and trailing separators without broad prefix collisions", () => {
    expect(getUiPathname("/exchange/tools/?near=me#filter")).toBe("/exchange/tools");
    expect(isPublicProfileLikePath("/jw-stone-workspace")).toBe(false);
    expect(isApplicationUiSurface("/administrator-notes")).toBe(true);
  });

  it("connects the real shell to the synchronous DOM boundary", () => {
    const shell = read("client/src/components/layout/AppShell.tsx");
    expect(shell).toContain("isApplicationUiSurface(location, customDomainProfileSlug)");
    expect(shell).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(shell).toContain('data-ts-core-ui={applicationUi ? "true" : undefined}');
    expect(shell).not.toContain('classList.toggle("ts-application-ui-scope"');
  });
});
