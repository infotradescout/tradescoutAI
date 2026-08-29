import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isSafeNextPath } from "../../client/src/lib/postOnboardingRoute";
import { COMPATIBILITY_REDIRECT_ALIASES } from "../../client/src/routing/compatibilityRedirects";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const LEGACY_ALIAS_REDIRECTS: Array<{ legacy: string; canonical: string }> = [
  { legacy: "/admin/dashboard", canonical: "/admin" },
  { legacy: "/admin-users", canonical: "/admin/users" },
  { legacy: "/admin-observability", canonical: "/admin/live-stream" },
  { legacy: "/staff/hardrock-directory", canonical: "/admin/commercial-directory" },
  { legacy: "/staff/share-links", canonical: "/admin/share-links" },
  { legacy: "/staff/inspection-intelligence", canonical: "/admin/inspection-intelligence" },
  { legacy: "/contractor-verification", canonical: "/admin/professional-verification" },
  { legacy: "/content-moderation", canonical: "/admin/moderation" },
  { legacy: "/system-settings", canonical: "/admin/site-settings" },
  { legacy: "/support-tickets", canonical: "/admin/errors" },
  { legacy: "/platform-analytics", canonical: "/admin/platform-analytics" },
  { legacy: "/manage-users", canonical: "/admin/users" },
  { legacy: "/payment-processing", canonical: "/admin/payment-model" },
  { legacy: "/file-management", canonical: "/admin/attachments" },
];

const RETIRED_RUNTIME_ALIASES = ["/admin-panel", "/admin-dashboard"] as const;

describe("admin route alias contracts", () => {
  it("keeps legacy route redirects in the runtime compatibility registry", () => {
    const source = read("client/src/routing/compatibilityRedirects.ts");

    for (const entry of LEGACY_ALIAS_REDIRECTS) {
      expect(source).toContain(`from: "${entry.legacy}"`);
      expect(source).toContain(`to: "${entry.canonical}"`);
    }
  });

  it("keeps centralized ROUTES.ALIASES mappings aligned with canonical admin paths", () => {
    const source = read("client/src/routing/compatibilityRedirects.ts");
    const routeConfig = read("client/src/lib/routes.ts");

    const aliasPairs = [
      ...LEGACY_ALIAS_REDIRECTS,
      { legacy: "/admin/dashboard", canonical: "/admin" },
    ];

    for (const entry of aliasPairs) {
      expect(source).toContain(`from: "${entry.legacy}"`);
      expect(source).toContain(`to: "${entry.canonical}"`);
    }
    expect(source).toContain('from: "/admin/contractors"');
    expect(source).toContain('from: "/admin/contractor-settings"');
    expect(source).toContain('to: "/admin/business-provider-settings"');
    expect(routeConfig).toContain("ALIASES: COMPATIBILITY_REDIRECT_ALIASES");
  });

  it("retires ambiguous top-level aliases and keeps /admin and /admin/panel distinct", () => {
    const source = read("client/src/routing/compatibilityRedirects.ts");
    const routeConfig = read("client/src/lib/routes.ts");

    for (const alias of RETIRED_RUNTIME_ALIASES) {
      expect(COMPATIBILITY_REDIRECT_ALIASES[alias]).toBeUndefined();
      expect(source).not.toContain(`from: "${alias}"`);
    }
    expect(routeConfig).toContain('ADMIN_DASHBOARD: "/admin"');
    expect(routeConfig).toContain('ADMIN_PANEL: "/admin/panel"');
  });

  it("allows onboarding deep-links for approved legacy admin aliases", () => {
    const requiredSafePrefixes = [
      "/admin/professional-verification",
      "/admin/business-provider-settings",
      "/admin/contractors",
      "/admin/contractor-settings",
      "/contractor-verification",
      "/content-moderation",
      "/admin/dashboard",
      "/admin-users",
      "/admin/workspace",
      "/staff/hardrock-directory",
      "/staff/share-links",
      "/staff/inspection-intelligence",
      "/system-settings",
      "/support-tickets",
      "/platform-analytics",
      "/manage-users",
      "/payment-processing",
      "/file-management",
      "/admin-observability",
    ];

    for (const prefix of requiredSafePrefixes) {
      expect(isSafeNextPath(prefix)).toBe(true);
    }
  });

  it("enforces route-alias drift guard coverage for the same legacy alias set", () => {
    const source = read("scripts/guard-admin-route-aliases.mjs");

    for (const entry of LEGACY_ALIAS_REDIRECTS) {
      expect(source).toContain(`"${entry.legacy}"`);
    }
    for (const alias of RETIRED_RUNTIME_ALIASES) {
      expect(source).toContain(`"${alias}"`);
    }
    expect(source).toContain('"/admin/contractors"');
    expect(source).toContain('"/admin/contractor-settings"');
    expect(source).toContain('path.resolve("shared")');
    expect(source).toContain("RUNTIME_RETIRED_ALIASES");
    expect(source).toMatch(/re: new RegExp\([^\n]+, "i"\)/);
    expect(source).not.toMatch(/re: new RegExp\([^\n]+, "g"\)/);
    expect(source).toContain('"client/src/AppRoutes.tsx"');
    expect(source).toContain('"client/src/admin/adminTools.tsx"');
    expect(source).toContain('"client/src/lib/postOnboardingRoute.ts"');
    expect(source).toContain('"client/src/lib/routes.ts"');
    expect(source).toContain('"client/src/routing/compatibilityRedirects.ts"');
  });
});

describe("support routing contracts", () => {
  it("routes support navigation intent to the public help center", () => {
    const source = read("server/scout/scoutDecisionPipeline.ts");
    expect(source).toContain(
      '{ route: "/help", label: "Open Help Center", pattern: /support tickets?/i }'
    );
    expect(source).not.toContain(
      '{ route: "/support-tickets", label: "Open Support Tickets", pattern: /support tickets?/i }'
    );
    expect(source).not.toContain(
      '{ route: "/admin/errors", label: "Open Admin Error Reports", pattern: /support tickets?/i }'
    );
  });

  it("keeps support behavior handler actions on /help", () => {
    const source = read("server/scout/scoutBehaviorHandlers.ts");
    expect(source).toContain('to: "/help"');
    expect(source).toContain('path: "/help"');
    expect(source).toContain('label: "Open help center"');
    expect(source).not.toContain('to: "/support-tickets"');
    expect(source).not.toContain('to: "/admin/errors"');
  });
});
