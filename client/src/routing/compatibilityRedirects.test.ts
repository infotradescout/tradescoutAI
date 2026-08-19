import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  COMPATIBILITY_REDIRECTS,
  getCompatibilityRedirectsForSlot,
  mergeCompatibilityRedirectTarget,
} from "./compatibilityRedirects";

describe("compatibility redirect registry", () => {
  it("has one owner for every legacy path", () => {
    const paths = COMPATIBILITY_REDIRECTS.map((redirect) => redirect.from);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("places routes that can be shadowed before dynamic or wildcard routes", () => {
    expect(getCompatibilityRedirectsForSlot("before-dashboard")).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: "/dashboard/messages" })])
    );
    expect(getCompatibilityRedirectsForSlot("before-contractor-slug")).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: "/contractors/dashboard" })])
    );
    expect(getCompatibilityRedirectsForSlot("before-admin-wildcard")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "/admin/contractors" }),
        expect.objectContaining({ from: "/admin/contractor-settings" }),
        expect.objectContaining({
          from: "/admin/partner-operations",
          to: "/admin/tradepartners",
          access: "admin",
        }),
      ])
    );
  });

  it("renders each ordered slot before the route that could shadow it", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/AppRoutes.tsx"), "utf8");
    expect(source.indexOf('renderCompatibilityRedirects("before-dashboard")')).toBeLessThan(
      source.indexOf('<Route path="/dashboard">')
    );
    expect(source.indexOf('renderCompatibilityRedirects("before-contractor-slug")')).toBeLessThan(
      source.indexOf('<Route path="/contractors/:slug">')
    );
    expect(source.indexOf('renderCompatibilityRedirects("before-admin-wildcard")')).toBeLessThan(
      source.indexOf('<Route path="/admin/:rest*">')
    );
    expect(source.indexOf('renderCompatibilityRedirects("standard")')).toBeLessThan(
      source.indexOf('<Route path="/:rest*">')
    );
  });

  it("merges query and hash context without overriding canonical target parameters", () => {
    expect(
      mergeCompatibilityRedirectTarget(
        "/settings?tab=profile#canonical",
        "/settings/location?return=/home&tab=ignored#source"
      )
    ).toBe("/settings?tab=profile&return=%2Fhome#canonical");
    expect(mergeCompatibilityRedirectTarget("/messages", "/conversations?thread=42#latest")).toBe(
      "/messages?thread=42#latest"
    );
  });
});
